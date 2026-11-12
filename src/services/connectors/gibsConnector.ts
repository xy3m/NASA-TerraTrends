/**
 * NASA GIBS Connector — WMTS tile overlay manager for satellite imagery layers
 * Implements EarthDataConnector for map tile access (not time series)
 */
import type {
  EarthDataConnector,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  VariableId,
} from './types';

const BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best';

// ── GIBS Layer definitions ────────────────────────────────────────────

export interface GIBSLayer {
  id: string;
  name: string;
  description: string;
  defaultDate: string;
}

export const GIBS_LAYERS: GIBSLayer[] = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    name: 'MODIS Terra True Color',
    description: 'Corrected reflectance true-color imagery from the MODIS instrument on NASA Terra satellite. Daily global coverage at 250m resolution.',
    defaultDate: '2024-01-15',
  },
  {
    id: 'MODIS_Terra_NDVI_8Day',
    name: 'MODIS Terra NDVI (8-Day)',
    description: '8-day composite Normalized Difference Vegetation Index from MODIS Terra. Shows vegetation greenness and health globally.',
    defaultDate: '2024-01-01',
  },
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    name: 'VIIRS SNPP True Color',
    description: 'Corrected reflectance true-color imagery from the VIIRS instrument on Suomi NPP satellite. Higher resolution successor to MODIS.',
    defaultDate: '2024-01-15',
  },
  {
    id: 'MODIS_Terra_Snow_Cover',
    name: 'MODIS Snow Cover',
    description: 'Daily snow cover extent from MODIS Terra. Shows snow-covered land and ice in white, with cloud cover masked.',
    defaultDate: '2024-01-15',
  },
  {
    id: 'MODIS_Fire_Thermal_Anomalies_All',
    name: 'MODIS Fire & Thermal Anomalies',
    description: 'Active fire and thermal anomaly detections from both MODIS Terra and Aqua instruments. Red dots indicate fire hotspots.',
    defaultDate: '2024-01-15',
  },
  {
    id: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    name: 'Sea Surface Temperature (MUR)',
    description: 'Multi-scale Ultra-high Resolution (MUR) sea surface temperature analysis at ~1km resolution from the GHRSST project.',
    defaultDate: '2024-01-15',
  },
];

// ── GIBS tile URL builder ─────────────────────────────────────────────

/**
 * Build a WMTS tile URL for the given GIBS layer.
 *
 * @param layer - GIBS layer ID (e.g., 'MODIS_Terra_CorrectedReflectance_TrueColor')
 * @param date  - ISO date string (YYYY-MM-DD)
 * @param z     - Zoom level
 * @param x     - Tile column
 * @param y     - Tile row
 * @returns Full WMTS tile URL
 */
export function getGIBSTileUrl(
  layer: string,
  date: string,
  z: number,
  x: number,
  y: number
): string {
  const tileMatrixSet = 'EPSG4326_250m';
  return (
    `${BASE_URL}/${layer}/default/${date}/${tileMatrixSet}/${z}/${y}/${x}.jpg`
  );
}

// ── Connector implementation ──────────────────────────────────────────

const gibsCapabilities: ConnectorCapabilities = {
  timeSeries: false,
  mapTiles: true,
  catalogSearch: false,
  pointSubset: false,
  regionSubset: true,
};

export const gibsConnector: EarthDataConnector = {
  id: 'nasa-gibs',
  name: 'NASA GIBS WMTS Tile Service',
  shortName: 'GIBS',
  description:
    'NASA Global Imagery Browse Services (GIBS) — WMTS map tile overlays for satellite imagery visualization. Provides true-color, NDVI, snow, fire, and SST layers.',
  baseUrl: BASE_URL,
  capabilities: gibsCapabilities,
  supportedVariables: [], // Map tiles, not tied to specific VariableIds
  provenanceType: 'satellite_observation',
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(_variableId: VariableId): boolean {
    // GIBS provides map tiles, not variable-specific time series
    return false;
  },

  async fetchTimeSeries(_options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    // GIBS is a tile service — use getGIBSTileUrl() for map overlays
    return {
      points: [],
      provenance: 'satellite_observation',
      sourceLabel: 'NASA GIBS',
      statusMessage: 'GIBS provides map tile overlays. Use getGIBSTileUrl() and GIBS_LAYERS for imagery.',
    };
  },
};
