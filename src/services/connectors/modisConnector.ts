/**
 * ORNL DAAC MODIS Connector — MOD13Q1 vegetation indices via REST API
 * Implements EarthDataConnector for NDVI and EVI from MODIS satellite observations.
 * ORNL DAAC /subset enforces <=10 composite dates per request, so we fetch /dates once,
 * slice <=10-date batches, and execute them with bounded concurrency and per-request timeouts.
 */
import type {
  EarthDataConnector,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  VariableId,
} from './types';
import { dayOfYearToMonth } from './types';
import { processTimeSeries } from '../statistics';

const BASE_URL = 'https://modis.ornl.gov/rst/api/v1';

/** MODIS product / band mapping for supported variables */
const MODIS_VARIABLE_CONFIG: Record<string, { product: string; band: string }> = {
  ndvi: { product: 'MOD13Q1', band: '250m_16_days_NDVI' },
  evi: { product: 'MOD13Q1', band: '250m_16_days_EVI' },
};

const SCALE_FACTOR = 0.0001;
const VALID_MIN = -0.2;
const VALID_MAX = 1.0;

/** Max composite dates allowed by ORNL DAAC /subset per API call */
const MAX_DATES_PER_SUBSET = 10;
/** 7 batches * 10 composites (~3 years, ~36 months) ensures >=24 valid months even at high latitudes */
const MAX_BATCHES = 7;
const SUBSET_CONCURRENCY = 3;

const modisCapabilities: ConnectorCapabilities = {
  timeSeries: true,
  mapTiles: false,
  catalogSearch: false,
  pointSubset: true,
  regionSubset: false,
};

const SUPPORTED_VARIABLES: VariableId[] = ['ndvi', 'evi'];

const modisCache = new Map<string, ConnectorFetchResult>();
const datesCache = new Map<string, ModisDateItem[]>();

interface ModisDateItem {
  modis_date: string;
  calendar_date: string;
}

type SubsetEntry = { calendar_date?: string; modis_date?: string; data?: number[] };

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSubsetBatch(
  product: string,
  band: string,
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<{ ok: boolean; status: number; subset: SubsetEntry[] }> {
  const url =
    `${BASE_URL}/${product}/subset` +
    `?latitude=${lat}` +
    `&longitude=${lon}` +
    `&band=${band}` +
    `&startDate=${startDate}` +
    `&endDate=${endDate}` +
    `&kmAboveBelow=0` +
    `&kmLeftRight=0`;

  const response = await fetchWithTimeout(url, 20000);
  if (!response.ok) {
    return { ok: false, status: response.status, subset: [] };
  }
  const json = await response.json();
  return {
    ok: true,
    status: response.status,
    subset: Array.isArray(json.subset) ? json.subset : [],
  };
}

export const modisConnector: EarthDataConnector = {
  id: 'ornl-modis',
  name: 'ORNL DAAC MODIS Web Service',
  shortName: 'MODIS',
  description:
    'ORNL DAAC MODIS REST API providing 16-day composite NDVI and EVI vegetation indices from the MOD13Q1 (250m) product. Covers 2000–present.',
  baseUrl: BASE_URL,
  capabilities: modisCapabilities,
  supportedVariables: SUPPORTED_VARIABLES,
  provenanceType: 'satellite_observation',
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(variableId: VariableId): boolean {
    return variableId in MODIS_VARIABLE_CONFIG;
  },

  async fetchTimeSeries(options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    const { lat, lon, variableId } = options;
    const config = MODIS_VARIABLE_CONFIG[variableId];

    if (!config) {
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'MODIS',
        statusMessage: `Variable "${variableId}" is not supported by MODIS connector.`,
      };
    }

    const coordKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cacheKey = `${variableId}_${coordKey}`;
    const cached = modisCache.get(cacheKey);
    if (cached) return cached;

    const { product, band } = config;

    try {
      // Step 1: Discover available composite dates for this coordinate (cached per location)
      const datesKey = `${product}_${coordKey}`;
      let allDates: ModisDateItem[] | undefined = datesCache.get(datesKey);
      if (!allDates) {
        const datesUrl = `${BASE_URL}/${product}/dates?latitude=${lat}&longitude=${lon}`;
        const datesRes = await fetchWithTimeout(datesUrl, 15000);
        if (!datesRes.ok) {
          throw new Error(`MODIS /dates returned status ${datesRes.status}`);
        }
        const datesJson = await datesRes.json();
        const parsedDates: ModisDateItem[] = Array.isArray(datesJson.dates) ? datesJson.dates : [];
        allDates = parsedDates;
        if (parsedDates.length > 0) {
          datesCache.set(datesKey, parsedDates);
        }
      }

      if (!allDates || allDates.length < 10) {
        throw new Error('Insufficient MODIS composite dates available.');
      }

      // Take the most recent up to MAX_BATCHES * MAX_DATES_PER_SUBSET composites
      const windowDates = allDates.slice(-(MAX_BATCHES * MAX_DATES_PER_SUBSET));
      const batches: Array<{ start: string; end: string }> = [];
      for (let i = 0; i < windowDates.length; i += MAX_DATES_PER_SUBSET) {
        const chunk = windowDates.slice(i, i + MAX_DATES_PER_SUBSET);
        batches.push({
          start: chunk[0].modis_date,
          end: chunk[chunk.length - 1].modis_date,
        });
      }

      // Step 2: Execute <=10-date subset batches in small waves with independent 20s timeouts
      const allSubsetEntries: SubsetEntry[] = [];
      for (let i = 0; i < batches.length; i += SUBSET_CONCURRENCY) {
        const wave = batches.slice(i, i + SUBSET_CONCURRENCY);
        const results = await Promise.all(
          wave.map(b => fetchSubsetBatch(product, band, lat, lon, b.start, b.end))
        );
        for (const r of results) {
          if (r.ok) {
            allSubsetEntries.push(...r.subset);
          } else if (i === 0 && results.every(x => !x.ok)) {
            throw new Error(`MODIS API returned status ${r.status}`);
          }
        }
      }

      // Accumulate values by YYYY-MM for monthly averaging
      const monthlyBuckets = new Map<string, number[]>();

      for (const entry of allSubsetEntries) {
        let year = NaN;
        let month = NaN;

        if (entry.calendar_date && /^\d{4}-\d{2}-\d{2}/.test(entry.calendar_date)) {
          year = parseInt(entry.calendar_date.slice(0, 4), 10);
          month = parseInt(entry.calendar_date.slice(5, 7), 10);
        } else if (entry.modis_date && entry.modis_date.startsWith('A') && entry.modis_date.length >= 8) {
          year = parseInt(entry.modis_date.substring(1, 5), 10);
          const doy = parseInt(entry.modis_date.substring(5), 10);
          if (!isNaN(year) && !isNaN(doy) && doy >= 1 && doy <= 366) {
            month = dayOfYearToMonth(doy, year);
          }
        }

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) continue;

        const monthStr = month < 10 ? `0${month}` : `${month}`;
        const dateKey = `${year}-${monthStr}`;
        const dataValues: number[] = Array.isArray(entry.data) ? entry.data : [];

        for (const raw of dataValues) {
          const scaled = raw * SCALE_FACTOR;
          if (scaled >= VALID_MIN && scaled <= VALID_MAX) {
            const bucket = monthlyBuckets.get(dateKey) || [];
            bucket.push(scaled);
            monthlyBuckets.set(dateKey, bucket);
          }
        }
      }

      const rawPoints: { date: string; value: number }[] = [];
      for (const [date, values] of monthlyBuckets.entries()) {
        if (values.length > 0) {
          const mean = values.reduce((s, v) => s + v, 0) / values.length;
          rawPoints.push({ date, value: +mean.toFixed(4) });
        }
      }

      rawPoints.sort((a, b) => a.date.localeCompare(b.date));

      if (rawPoints.length < 12) {
        throw new Error(`Insufficient MODIS data: only ${rawPoints.length} monthly points`);
      }

      const result: ConnectorFetchResult = {
        points: processTimeSeries(rawPoints),
        provenance: 'satellite_observation',
        sourceLabel: `MODIS ${product} (${band})`,
        statusMessage: `Retrieved ${rawPoints.length} months of MODIS ${variableId.toUpperCase()} data.`,
      };
      modisCache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.warn(`MODIS connector error for ${variableId}:`, err);
      const failure: ConnectorFetchResult = {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'MODIS',
        statusMessage: `MODIS request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      if (err instanceof Error && err.message.includes('status 400')) {
        modisCache.set(cacheKey, failure);
      }
      return failure;
    }
  },
};
