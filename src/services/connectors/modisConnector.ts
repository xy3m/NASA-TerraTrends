/**
 * ORNL DAAC MODIS Connector — MOD13Q1 vegetation indices via REST API
 * Implements EarthDataConnector for NDVI and EVI from MODIS satellite observations
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

/** MODIS scale factor — raw integer values × 0.0001 = actual index */
const SCALE_FACTOR = 0.0001;

/** Valid NDVI/EVI range after scaling */
const VALID_MIN = -0.2;
const VALID_MAX = 1.0;

const modisCapabilities: ConnectorCapabilities = {
  timeSeries: true,
  mapTiles: false,
  catalogSearch: false,
  pointSubset: true,
  regionSubset: false,
};

const SUPPORTED_VARIABLES: VariableId[] = ['ndvi', 'evi'];

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
    const { lat, lon, variableId, startYear = 2000, endYear = 2024 } = options;
    const config = MODIS_VARIABLE_CONFIG[variableId];

    if (!config) {
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'MODIS',
        statusMessage: `Variable "${variableId}" is not supported by MODIS connector.`,
      };
    }

    const { product, band } = config;
    const url =
      `${BASE_URL}/${product}/subset` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&band=${band}` +
      `&startDate=A${startYear}001` +
      `&endDate=A${endYear}365` +
      `&kmAboveBelow=0` +
      `&kmLeftRight=0`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`MODIS API returned status ${response.status}`);
      }

      const json = await response.json();

      if (!json.subset || !Array.isArray(json.subset)) {
        throw new Error('Invalid MODIS response: missing subset array');
      }

      // Accumulate values by YYYY-MM for monthly averaging
      const monthlyBuckets: Map<string, number[]> = new Map();

      for (const entry of json.subset) {
        // Parse calendar date from MODIS format: "A2024001" → year 2024, DOY 1
        const calendarStr: string = entry.calendar_date || entry.modisDate || '';
        let year: number;
        let doy: number;

        if (calendarStr.startsWith('A') && calendarStr.length >= 8) {
          year = parseInt(calendarStr.substring(1, 5), 10);
          doy = parseInt(calendarStr.substring(5), 10);
        } else {
          continue;
        }

        if (isNaN(year) || isNaN(doy) || doy < 1 || doy > 366) continue;

        const month = dayOfYearToMonth(doy, year);
        const monthStr = month < 10 ? `0${month}` : `${month}`;
        const dateKey = `${year}-${monthStr}`;

        // Extract data values
        const dataValues: number[] = Array.isArray(entry.data) ? entry.data : [];

        for (const raw of dataValues) {
          const scaled = raw * SCALE_FACTOR;
          // Filter invalid / fill values
          if (scaled >= VALID_MIN && scaled <= VALID_MAX) {
            const bucket = monthlyBuckets.get(dateKey) || [];
            bucket.push(scaled);
            monthlyBuckets.set(dateKey, bucket);
          }
        }
      }

      // Average each monthly bucket
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

      return {
        points: processTimeSeries(rawPoints),
        provenance: 'satellite_observation',
        sourceLabel: `MODIS ${product} (${band})`,
        statusMessage: `Retrieved ${rawPoints.length} months of MODIS ${variableId.toUpperCase()} data.`,
      };
    } catch (err) {
      console.warn(`MODIS connector error for ${variableId}:`, err);
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'MODIS',
        statusMessage: `MODIS request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
