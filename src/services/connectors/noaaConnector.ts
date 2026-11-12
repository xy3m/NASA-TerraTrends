/**
 * NOAA Tides & Currents Connector — Monthly mean sea level from coastal tide gauge stations
 * Implements EarthDataConnector for sea_level variable
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

const BASE_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// ── Coastal tide gauge stations ───────────────────────────────────────

interface TideStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

const TIDE_STATIONS: TideStation[] = [
  { id: '8518750', name: 'The Battery, New York, NY',   lat: 40.7006, lon: -74.0142 },
  { id: '9414290', name: 'San Francisco, CA',           lat: 37.8063, lon: -122.4659 },
  { id: '8443970', name: 'Boston, MA',                  lat: 42.3539, lon: -71.0503 },
  { id: '8658120', name: 'Wilmington, NC',              lat: 34.2275, lon: -77.9536 },
  { id: '8545240', name: 'Philadelphia, PA',            lat: 39.9334, lon: -75.1418 },
  { id: '8574680', name: 'Baltimore, MD',               lat: 39.2667, lon: -76.5794 },
  { id: '8726520', name: 'St. Petersburg, FL',          lat: 27.7606, lon: -82.6269 },
  { id: '9410660', name: 'Los Angeles, CA',             lat: 33.7200, lon: -118.2720 },
  { id: '9447130', name: 'Seattle, WA',                 lat: 47.6026, lon: -122.3393 },
  { id: '1612340', name: 'Honolulu, HI',                lat: 21.3067, lon: -157.8670 },
];

/**
 * Find the nearest NOAA tide station to the given coordinates
 */
export function findNearestStation(lat: number, lon: number): TideStation {
  let nearest = TIDE_STATIONS[0];
  let minDist = Infinity;

  for (const station of TIDE_STATIONS) {
    const dist = haversineDistance(lat, lon, station.lat, station.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  }

  return nearest;
}

// ── Connector implementation ──────────────────────────────────────────

const noaaCapabilities: ConnectorCapabilities = {
  timeSeries: true,
  mapTiles: false,
  catalogSearch: false,
  pointSubset: true,
  regionSubset: false,
};

const SUPPORTED_VARIABLES: VariableId[] = ['sea_level'];

export const noaaConnector: EarthDataConnector = {
  id: 'noaa-tides',
  name: 'NOAA Tides & Currents',
  shortName: 'NOAA Tides',
  description:
    'NOAA CO-OPS Tides & Currents API — monthly mean sea level observations from U.S. coastal tide gauge stations. Datum: MSL, units: meters.',
  baseUrl: BASE_URL,
  capabilities: noaaCapabilities,
  supportedVariables: SUPPORTED_VARIABLES,
  provenanceType: 'satellite_observation', // Actually in-situ gauges
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(variableId: VariableId): boolean {
    return variableId === 'sea_level';
  },

  async fetchTimeSeries(options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    const { lat, lon, variableId, startYear = 2000, endYear = 2024 } = options;

    if (variableId !== 'sea_level') {
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'NOAA Tides',
        statusMessage: `Variable "${variableId}" is not supported by NOAA Tides connector.`,
      };
    }

    const station = findNearestStation(lat, lon);
    const startDate = `${startYear}0101`;
    const endDate = `${endYear}1231`;

    const url =
      `${BASE_URL}` +
      `?begin_date=${startDate}` +
      `&end_date=${endDate}` +
      `&station=${station.id}` +
      `&product=monthly_mean` +
      `&datum=MSL` +
      `&units=metric` +
      `&time_zone=gmt` +
      `&format=json`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`NOAA API returned status ${response.status}`);
      }

      const json = await response.json();

      if (!json.data || !Array.isArray(json.data)) {
        throw new Error('Invalid NOAA response: missing data array');
      }

      const rawPoints: { date: string; value: number }[] = [];

      for (const entry of json.data) {
        const t: string = entry.t || ''; // format: "YYYY-MM-DD HH:MM" or "YYYY-MM"
        const v: string = entry.v || '';
        const val = parseFloat(v);

        if (isNaN(val)) continue;

        // Parse date to YYYY-MM
        let dateStr: string;
        if (t.length >= 7) {
          dateStr = t.substring(0, 7);
        } else {
          continue;
        }

        rawPoints.push({
          date: dateStr,
          value: +val.toFixed(4),
        });
      }

      if (rawPoints.length < 12) {
        throw new Error(`Insufficient NOAA data: only ${rawPoints.length} monthly points`);
      }

      rawPoints.sort((a, b) => a.date.localeCompare(b.date));

      const distKm = haversineDistance(lat, lon, station.lat, station.lon);

      return {
        points: processTimeSeries(rawPoints),
        provenance: 'satellite_observation',
        sourceLabel: `NOAA Tides (${station.name})`,
        statusMessage: `Retrieved ${rawPoints.length} months of sea level data from ${station.name} (${distKm.toFixed(0)} km from query point).`,
      };
    } catch (err) {
      console.warn(`NOAA Tides connector error:`, err);
      return {
        points: [],
        provenance: 'satellite_observation',
        sourceLabel: 'NOAA Tides',
        statusMessage: `NOAA Tides request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
