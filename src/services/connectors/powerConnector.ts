/**
 * NASA POWER Connector — Refactored from nasaData.ts fetchLiveNasaPowerData
 * Implements EarthDataConnector for NASA POWER monthly API (MERRA-2/GLDAS reanalysis)
 */
import type {
  EarthDataConnector,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  VariableId,
  TimeSeriesPoint,
} from './types';
import { daysInMonth } from './types';
import { processTimeSeries } from '../statistics';

// ── Expanded NASA POWER parameter map ─────────────────────────────────

export const POWER_PARAM_MAP: Partial<Record<VariableId, string>> = {
  // Original mappings
  temp_air: 'T2M',            // Temperature at 2 Meters (°C)
  precip: 'PRECTOTCORR',      // Precipitation Corrected (mm/day → mm/month)
  lst_day: 'TS',              // Earth Skin Temperature (°C)
  evapo: 'EVLAND',            // Evaporation Land (mm/day → mm/month)
  aod: 'AOD_55',              // Aerosol Optical Depth 550nm (dimensionless)

  // Expanded Phase 1 mappings
  pressure: 'PS',              // Surface Pressure (kPa)
  humidity: 'RH2M',            // Relative Humidity at 2m (%)
  specific_humidity: 'QV2M',   // Specific Humidity at 2m (g/kg)
  wind_speed: 'WS10M',         // Wind Speed at 10m (m/s)
  radiation_sw: 'ALLSKY_SFC_SW_DWN',  // Shortwave Radiation (W/m²)
  radiation_lw: 'ALLSKY_SFC_LW_DWN',  // Longwave Radiation (W/m²)
  albedo: 'ALLSKY_SRF_ALB',           // Surface Albedo (fraction)
  snow_depth: 'SNODP',         // Snow Depth (cm)
  snow_precip: 'PRECSNO',      // Snowfall (mm/day → mm/month)
  ozone_total: 'TO3',          // Total Column Ozone (DU)
  soil_moist_top: 'GWETTOP',   // Top Soil Wetness (0-1)
  soil_moist_prof: 'GWETPROF', // Profile Soil Wetness (0-1)
  sst: 'TS',                   // Sea Surface Temp uses Earth Skin Temp for ocean points
};

/** Parameters that are in mm/day and must be converted to mm/month */
const MM_DAY_PARAMS = new Set(['PRECTOTCORR', 'EVLAND', 'PRECSNO']);

/** NASA POWER fill value for missing data (polar night, ocean, etc.) */
const FILL_VALUE = -999.0;

// ── In-memory cache ───────────────────────────────────────────────────

const powerCache = new Map<string, ConnectorFetchResult>();

// ── Connector implementation ──────────────────────────────────────────

const powerCapabilities: ConnectorCapabilities = {
  timeSeries: true,
  mapTiles: false,
  catalogSearch: false,
  pointSubset: true,
  regionSubset: false,
};

const SUPPORTED_VARIABLES: VariableId[] = Object.keys(POWER_PARAM_MAP) as VariableId[];

export const powerConnector: EarthDataConnector = {
  id: 'nasa-power',
  name: 'NASA POWER Monthly API',
  shortName: 'NASA POWER',
  description:
    'NASA Prediction Of Worldwide Energy Resources — gridded monthly data from MERRA-2, GLDAS, and CERES reanalysis products. Covers 1981–present, global 0.5°×0.625° grid.',
  baseUrl: 'https://power.larc.nasa.gov/api/temporal/monthly/point',
  capabilities: powerCapabilities,
  supportedVariables: SUPPORTED_VARIABLES,
  provenanceType: 'reanalysis_model',
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(variableId: VariableId): boolean {
    return variableId in POWER_PARAM_MAP;
  },

  async fetchTimeSeries(options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    const { lat, lon, variableId, startYear = 1995, endYear = 2024 } = options;
    const nasaParam = POWER_PARAM_MAP[variableId];

    if (!nasaParam) {
      return {
        points: [],
        provenance: 'reanalysis_model',
        sourceLabel: 'NASA POWER',
        statusMessage: `Variable "${variableId}" is not supported by NASA POWER.`,
      };
    }

    // Check cache
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${variableId}_${startYear}_${endYear}`;
    const cached = powerCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        points: cached.points.map(p => ({ ...p })),
      };
    }

    const url =
      `https://power.larc.nasa.gov/api/temporal/monthly/point` +
      `?parameters=${nasaParam}` +
      `&community=RE` +
      `&longitude=${lon.toFixed(2)}` +
      `&latitude=${lat.toFixed(2)}` +
      `&start=${startYear}` +
      `&end=${endYear}` +
      `&format=JSON`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`NASA POWER API returned status ${response.status}`);
      }

      const json = await response.json();
      const parameterData = json?.properties?.parameter?.[nasaParam];

      if (!parameterData || typeof parameterData !== 'object') {
        throw new Error('Invalid NASA POWER payload format');
      }

      const rawPoints: { date: string; value: number | null }[] = [];
      let validCount = 0;

      for (const key of Object.keys(parameterData)) {
        if (key.length !== 6) continue;

        const yearStr = key.substring(0, 4);
        const monthStr = key.substring(4, 6);
        const yearNum = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);

        // Skip month 13 (annual summary)
        if (monthNum < 1 || monthNum > 12) continue;

        let val: number = parameterData[key];

        // Preserve -999.0 fill values (polar night, missing data) as explicit null slots
        // so seasonal index alignment (y * 12 + m) remains intact.
        if (typeof val !== 'number' || !isFinite(val) || val <= FILL_VALUE + 100) {
          rawPoints.push({
            date: `${yearStr}-${monthStr}`,
            value: null,
          });
          continue;
        }

        // Convert mm/day → mm/month for applicable parameters
        if (MM_DAY_PARAMS.has(nasaParam)) {
          val = val * daysInMonth(yearNum, monthNum);
        }

        validCount++;
        rawPoints.push({
          date: `${yearStr}-${monthStr}`,
          value: +val.toFixed(2),
        });
      }

      if (validCount < 24) {
        throw new Error(`Insufficient valid data points (${validCount}) from NASA POWER`);
      }

      rawPoints.sort((a, b) => a.date.localeCompare(b.date));

      const result: ConnectorFetchResult = {
        points: processTimeSeries(rawPoints),
        provenance: 'reanalysis_model',
        sourceLabel: `NASA POWER (${nasaParam})`,
        statusMessage: `Successfully retrieved ${validCount} valid months (${rawPoints.length - validCount} missing/polar-night slots preserved) of NASA POWER (${nasaParam}) data.`,
      };

      // Cache the result
      powerCache.set(cacheKey, {
        ...result,
        points: result.points.map(p => ({ ...p })),
      });

      return result;
    } catch (err) {
      console.warn(`NASA POWER connector error for ${variableId}:`, err);
      return {
        points: [],
        provenance: 'reanalysis_model',
        sourceLabel: 'NASA POWER',
        statusMessage: `NASA POWER request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};
