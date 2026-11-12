/**
 * USGS Water Services Connector — Monthly mean streamflow from NWIS gauge sites
 * Implements EarthDataConnector for streamflow variable
 */
import type {
  EarthDataConnector,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  VariableId,
} from './types';
import { haversineDistance } from './types';
import { processTimeSeries } from '../statistics';

const BASE_URL = 'https://waterservices.usgs.gov/nwis';

/** Conversion factor: ft³/s → m³/s */
const CFS_TO_CMS = 0.028317;

// ── USGS gauge sites ──────────────────────────────────────────────────

interface USGSSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

const GAUGE_SITES: USGSSite[] = [
  { id: '01646500', name: 'Potomac River at Little Falls, DC',       lat: 38.9478, lon: -77.1286 },
  { id: '07010000', name: 'Mississippi River at St. Louis, MO',      lat: 38.6272, lon: -90.1819 },
  { id: '11303500', name: 'San Joaquin River near Vernalis, CA',     lat: 37.6758, lon: -121.2650 },
  { id: '02089500', name: 'Neuse River at Kinston, NC',              lat: 35.2590, lon: -77.5836 },
  { id: '05586100', name: 'Illinois River at Valley City, IL',       lat: 39.6936, lon: -90.6464 },
  { id: '12340000', name: 'Clark Fork River at Missoula, MT',        lat: 46.8686, lon: -114.0178 },
  { id: '09380000', name: 'Colorado River at Lees Ferry, AZ',        lat: 36.8622, lon: -111.5886 },
  { id: '02296750', name: 'Peace River at Arcadia, FL',              lat: 27.2178, lon: -81.8653 },
  { id: '14105700', name: 'Columbia River at The Dalles, OR',        lat: 45.6089, lon: -121.1711 },
  { id: '03290500', name: 'Kentucky River at Lock 2, KY',            lat: 38.2006, lon: -84.8472 },
];

/**
 * Find the nearest USGS gauge site to the given coordinates
 */
export function findNearestSite(lat: number, lon: number): USGSSite {
  let nearest = GAUGE_SITES[0];
  let minDist = Infinity;

  for (const site of GAUGE_SITES) {
    const dist = haversineDistance(lat, lon, site.lat, site.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = site;
    }
  }

  return nearest;
}

// ── Connector implementation ──────────────────────────────────────────

const usgsCapabilities: ConnectorCapabilities = {
  timeSeries: true,
  mapTiles: false,
  catalogSearch: false,
  pointSubset: true,
  regionSubset: false,
};

const SUPPORTED_VARIABLES: VariableId[] = ['streamflow'];

export const usgsConnector: EarthDataConnector = {
  id: 'usgs-water',
  name: 'USGS Water Services (NWIS)',
  shortName: 'USGS Water',
  description:
    'USGS National Water Information System (NWIS) — monthly mean streamflow from major U.S. river gauge stations. Parameter code 00060 (discharge in ft³/s, converted to m³/s).',
  baseUrl: BASE_URL,
  capabilities: usgsCapabilities,
  supportedVariables: SUPPORTED_VARIABLES,
  provenanceType: 'satellite_observation', // Actually in-situ gauges
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(variableId: VariableId): boolean {
    return variableId === 'streamflow';
  },

  async fetchTimeSeries(options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    const { lat, lon, variableId } = options;

    if (variableId !== 'streamflow') {
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'USGS Water',
        statusMessage: `Variable "${variableId}" is not supported by USGS Water connector.`,
      };
    }

    const site = findNearestSite(lat, lon);

    // USGS monthly statistics endpoint
    const url =
      `${BASE_URL}/stat/` +
      `?format=json` +
      `&sites=${site.id}` +
      `&statReportType=monthly` +
      `&statTypeCd=mean` +
      `&parameterCd=00060`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`USGS API returned status ${response.status}`);
      }

      const json = await response.json();

      // Navigate the USGS WaterML-like JSON response structure
      const timeSeries = json?.value?.timeSeries;
      if (!Array.isArray(timeSeries) || timeSeries.length === 0) {
        throw new Error('Invalid USGS response: missing timeSeries');
      }

      const rawPoints: { date: string; value: number }[] = [];

      // Extract monthly statistics from the first matching time series
      const series = timeSeries[0];
      const values = series?.values;

      if (Array.isArray(values)) {
        for (const valueSet of values) {
          const valueArray = valueSet?.value;
          if (!Array.isArray(valueArray)) continue;

          for (const entry of valueArray) {
            // USGS monthly stats have: year, month_nu (or dateTime), value
            const val = parseFloat(entry.value || '');
            if (isNaN(val) || val < 0) continue;

            // Convert ft³/s to m³/s
            const valueCms = +(val * CFS_TO_CMS).toFixed(3);

            // Build YYYY-MM date from year and month
            // Monthly stats entries typically include a dateTime or separate year/month fields
            let dateStr: string;

            if (entry.dateTime) {
              // Format: "2020-01-15T00:00:00.000"
              dateStr = entry.dateTime.substring(0, 7);
            } else {
              // Fallback: construct from year and month_nu
              const year = entry.year || entry.begin_yr;
              const month = entry.month_nu;
              if (year && month) {
                const monthStr = String(month).padStart(2, '0');
                dateStr = `${year}-${monthStr}`;
              } else {
                continue;
              }
            }

            rawPoints.push({ date: dateStr, value: valueCms });
          }
        }
      }

      if (rawPoints.length < 12) {
        throw new Error(`Insufficient USGS data: only ${rawPoints.length} monthly points`);
      }

      rawPoints.sort((a, b) => a.date.localeCompare(b.date));

      const distKm = haversineDistance(lat, lon, site.lat, site.lon);

      return {
        points: processTimeSeries(rawPoints),
        provenance: 'satellite_observation',
        sourceLabel: `USGS (${site.name})`,
        statusMessage: `Retrieved ${rawPoints.length} months of streamflow data from ${site.name} (${distKm.toFixed(0)} km from query point).`,
      };
    } catch (err) {
      console.warn(`USGS Water connector error:`, err);
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'USGS Water',
        statusMessage: `USGS request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
