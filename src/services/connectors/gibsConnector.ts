/**
 * NASA GIBS Connector — WMTS tile overlay manager for satellite imagery layers
 * Uses Web Mercator (EPSG:3857) GoogleMapsCompatible tile matrices to match Leaflet natively.
 */
import type {
  EarthDataConnector,
  ConnectorCapabilities,
  ConnectorFetchOptions,
  ConnectorFetchResult,
  VariableId,
} from './types';

const BASE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

// ── GIBS Layer definitions ────────────────────────────────────────────

export interface GIBSLayer {
  id: string;
  name: string;
  description: string;
  defaultDate: string;
  tileMatrixSet: string;
  format: 'jpeg' | 'png';
  maxZoom: number;
}

export const GIBS_LAYERS: GIBSLayer[] = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    name: 'MODIS Terra True Color',
    description: 'Corrected reflectance true-color imagery from the MODIS instrument on NASA Terra satellite. Daily global coverage at 250m resolution.',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpeg',
    maxZoom: 9,
  },
  {
    id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    name: 'VIIRS NOAA-20 True Color',
    description: 'Corrected reflectance true-color imagery from the VIIRS instrument on NOAA-20 satellite.',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpeg',
    maxZoom: 9,
  },
  {
    id: 'MODIS_Terra_NDVI_8Day',
    name: 'MODIS Terra NDVI (8-Day)',
    description: '8-day composite Normalized Difference Vegetation Index from MODIS Terra. Shows vegetation greenness and health globally.',
    defaultDate: '2024-01-01',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'png',
    maxZoom: 9,
  },
  {
    id: 'MODIS_Terra_NDSI_Snow_Cover',
    name: 'MODIS Snow Cover (NDSI)',
    description: 'Daily Normalized Difference Snow Index cover extent from MODIS Terra.',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    format: 'png',
    maxZoom: 8,
  },
  {
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    name: 'MODIS Land Surface Temp (Day)',
    description: 'Daytime radiative skin Land Surface Temperature from MODIS Terra at 1km resolution.',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
  },
  {
    id: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    name: 'Sea Surface Temperature (MUR)',
    description: 'Multi-scale Ultra-high Resolution (MUR) sea surface temperature analysis at ~1km resolution from the GHRSST project.',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
  },
  {
    id: 'MODIS_Combined_Thermal_Anomalies_All',
    name: 'MODIS Active Fires & Thermal Anomalies',
    description: 'Combined Terra/Aqua MODIS daytime and nighttime active fire & thermal hotspot detections (FIRMS layer).',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    maxZoom: 6,
  },
  {
    id: 'MODIS_Aqua_Chlorophyll_A',
    name: 'MODIS Aqua Ocean Chlorophyll-A',
    description: 'Near-surface concentration of chlorophyll-a in ocean water (mg/m^3), tracking marine phytoplankton blooms and upwelling.',
    defaultDate: 'default',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
  },
  {
    id: 'MODIS_Terra_Aerosol',
    name: 'MODIS Terra Aerosol Optical Depth',
    description: 'Atmospheric Aerosol Optical Depth (AOD) at 550 nm showing smoke plumes, Saharan dust transport, and urban haze.',
    defaultDate: '2024-01-15',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    maxZoom: 6,
  },
];

// ── GIBS tile URL builders ────────────────────────────────────────────

/**
 * Build a Leaflet `{z}/{y}/{x}` tile URL template for the given GIBS layer.
 */
export function getGIBSTileTemplate(layerId: string, date: string = 'default'): string {
  const layer = GIBS_LAYERS.find(l => l.id === layerId);
  const tileMatrixSet = layer?.tileMatrixSet ?? 'GoogleMapsCompatible_Level9';
  const format = layer?.format ?? 'png';
  const timeSegment = date || 'default';
  return `${BASE_URL}/${layerId}/default/${timeSegment}/${tileMatrixSet}/{z}/{y}/{x}.${format}`;
}

/**
 * Build a concrete WMTS tile URL for the given GIBS layer.
 */
export function getGIBSTileUrl(
  layer: string,
  date: string,
  z: number,
  x: number,
  y: number
): string {
  return getGIBSTileTemplate(layer, date)
    .replace('{z}', String(z))
    .replace('{y}', String(y))
    .replace('{x}', String(x));
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
    'NASA Global Imagery Browse Services (GIBS) — WMTS map tile overlays for satellite imagery visualization. Provides true-color, NDVI, snow, land surface temperature, and SST layers.',
  baseUrl: BASE_URL,
  capabilities: gibsCapabilities,
  supportedVariables: [],
  provenanceType: 'satellite_observation',
  requiresAuth: false,
  requiresProxy: false,

  supportsVariable(_variableId: VariableId): boolean {
    return false;
  },

  async fetchTimeSeries(_options: ConnectorFetchOptions): Promise<ConnectorFetchResult> {
    return {
      points: [],
      provenance: 'satellite_observation',
      sourceLabel: 'NASA GIBS',
      statusMessage: 'GIBS provides map tile overlays. Use getGIBSTileUrl() and GIBS_LAYERS for imagery.',
    };
  },
};
