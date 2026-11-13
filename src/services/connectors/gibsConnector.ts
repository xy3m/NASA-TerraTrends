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
export const GIBS_WMS_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';

// ── GIBS Layer definitions ────────────────────────────────────────────

export type GIBSServiceType = 'wmts' | 'wms';

export interface GIBSLayer {
  id: string;
  name: string;
  description: string;
  service: GIBSServiceType;
  tileMatrixSet: string;
  format: 'jpeg' | 'png';
  maxZoom: number;
  /** Number of UTC days behind today before complete daily global swath imagery settles. */
  safeLagDays: number;
  /** Earliest valid ISO date on the GIBS `best` endpoint. */
  minDate?: string;
  /** Rolling archive lookback in days (for NRT-only layers whose retention window advances). */
  rollingWindowDays?: number;
  /** Concise cadence / resolution badge shown in the overlay controller. */
  resolutionLabel: string;
  /** Fallback default ISO date or `'default'`, preserved for compatibility. */
  defaultDate: string;
}

export function formatUtcDateOffset(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().split('T')[0];
}

export function getLayerDateBounds(layer: GIBSLayer): { minDate: string; maxDate: string } {
  const maxDate = formatUtcDateOffset(layer.safeLagDays);
  const minDate = layer.rollingWindowDays
    ? formatUtcDateOffset(layer.rollingWindowDays)
    : (layer.minDate ?? '2000-02-24');
  return {
    minDate: minDate <= maxDate ? minDate : maxDate,
    maxDate,
  };
}

export function clampDateForLayer(layer: GIBSLayer, date: string): string {
  const { minDate, maxDate } = getLayerDateBounds(layer);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return maxDate;
  if (date < minDate) return minDate;
  if (date > maxDate) return maxDate;
  return date;
}

export const GIBS_LAYERS: GIBSLayer[] = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    name: 'MODIS Terra True Color',
    description: 'Corrected reflectance true-color imagery from the MODIS instrument on NASA Terra satellite. Daily global coverage at 250m resolution.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpeg',
    maxZoom: 9,
    safeLagDays: 2,
    minDate: '2000-02-24',
    resolutionLabel: '250m Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    name: 'VIIRS NOAA-20 True Color',
    description: 'Corrected reflectance true-color imagery from the VIIRS instrument on NOAA-20 satellite.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpeg',
    maxZoom: 9,
    safeLagDays: 2,
    minDate: '2018-01-05',
    resolutionLabel: '375m Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MODIS_Terra_NDVI_8Day',
    name: 'MODIS Terra NDVI (8-Day)',
    description: '8-day composite Normalized Difference Vegetation Index from MODIS Terra. Shows vegetation greenness and health globally (rolling archive window).',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'png',
    maxZoom: 9,
    safeLagDays: 2,
    rollingWindowDays: 365,
    resolutionLabel: '250m 8-Day • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MODIS_Terra_NDSI_Snow_Cover',
    name: 'MODIS Snow Cover (NDSI)',
    description: 'Daily Normalized Difference Snow Index cover extent from MODIS Terra.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    format: 'png',
    maxZoom: 8,
    safeLagDays: 2,
    minDate: '2000-02-24',
    resolutionLabel: '500m Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    name: 'MODIS Land Surface Temp (Day)',
    description: 'Daytime radiative skin Land Surface Temperature from MODIS Terra at 1km resolution.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
    safeLagDays: 2,
    minDate: '2000-02-24',
    resolutionLabel: '1km Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    name: 'Sea Surface Temperature (MUR)',
    description: 'Multi-scale Ultra-high Resolution (MUR) sea surface temperature analysis at ~1km resolution from the GHRSST project.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
    safeLagDays: 2,
    minDate: '2002-06-01',
    resolutionLabel: '1km L4 Blend • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MODIS_Combined_Thermal_Anomalies_All',
    name: 'MODIS Active Fires & Thermal Anomalies',
    description: 'Combined Terra/Aqua MODIS daytime and nighttime active fire & thermal hotspot detections (FIRMS layer rasterized via GIBS WMS).',
    service: 'wms',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 8,
    safeLagDays: 2,
    minDate: '2002-07-04',
    resolutionLabel: '1km FIRMS • WMS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'VIIRS_NOAA20_Chlorophyll_a',
    name: 'VIIRS NOAA-20 Ocean Chlorophyll-a',
    description: 'Near-surface concentration of chlorophyll-a in ocean water (mg/m^3), tracking marine phytoplankton blooms and upwelling.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
    safeLagDays: 2,
    minDate: '2018-02-24',
    resolutionLabel: '750m Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MODIS_Terra_Aerosol',
    name: 'MODIS Terra Aerosol Optical Depth',
    description: 'Atmospheric Aerosol Optical Depth (AOD) at 550 nm showing smoke plumes, Saharan dust transport, and urban haze.',
    service: 'wmts',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    maxZoom: 6,
    safeLagDays: 2,
    minDate: '2000-02-24',
    resolutionLabel: '3km Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
];

// ── GIBS tile URL builders ────────────────────────────────────────────

/**
 * Build a Leaflet `{z}/{y}/{x}` WMTS tile URL template (or WMS base URL) for the given GIBS layer.
 */
export function getGIBSTileTemplate(layerId: string, date?: string): string {
  const layer = GIBS_LAYERS.find(l => l.id === layerId);
  if (layer?.service === 'wms') {
    return GIBS_WMS_URL;
  }
  const tileMatrixSet = layer?.tileMatrixSet ?? 'GoogleMapsCompatible_Level9';
  const format = layer?.format ?? 'png';
  const resolvedDate = layer
    ? clampDateForLayer(layer, date ?? formatUtcDateOffset(layer.safeLagDays))
    : (date && date !== 'default' ? date : formatUtcDateOffset(2));
  return `${BASE_URL}/${layerId}/default/${resolvedDate}/${tileMatrixSet}/{z}/{y}/{x}.${format}`;
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
