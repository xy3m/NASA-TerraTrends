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
export type GIBSCadence = 'daily' | '8day' | 'monthly' | 'static';

export interface GIBSLayer {
  id: string;
  name: string;
  description: string;
  service: GIBSServiceType;
  /** Comma-separated GIBS WMS layer identifiers when compositing multiple sensors server-side. */
  wmsLayers?: string;
  /** Publishing cadence determining valid GIBS TIME stamps. */
  cadence: GIBSCadence;
  tileMatrixSet: string;
  format: 'jpeg' | 'png';
  maxZoom: number;
  /** Number of UTC days behind today before complete global imagery/composites settle. */
  safeLagDays: number;
  /** Earliest valid ISO date on the GIBS `best` endpoint. */
  minDate?: string;
  /** Rolling archive lookback in days (for NRT-only layers whose retention window advances). */
  rollingWindowDays?: number;
  /** Concise cadence / resolution badge shown in the overlay controller. */
  resolutionLabel: string;
  /** Fallback default ISO date (empty string for timeless static mosaics). */
  defaultDate: string;
}

const MS_PER_DAY = 86_400_000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIsoUtc(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatUtcDateOffset(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * MS_PER_DAY);
  return toIsoUtc(d);
}

/**
 * Snap an ISO date backward to the nearest valid GIBS interval start for a layer's cadence.
 * MODIS L3 8-day composites start at Jan 1 of each year (`DOY = 1 + 8*k`).
 * Monthly MERRA-2 composites use the first day of each UTC month (`YYYY-MM-01`).
 */
export function snapDateToCadence(cadence: GIBSCadence, isoDate: string): string {
  if (cadence === 'static') return '';
  if (cadence === 'daily' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  if (cadence === 'monthly') {
    return `${isoDate.slice(0, 7)}-01`;
  }
  const dt = parseUtcDate(isoDate);
  const year = dt.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const daysSinceJan1 = Math.max(0, Math.floor((dt.getTime() - jan1) / MS_PER_DAY));
  const snappedDays = Math.floor(daysSinceJan1 / 8) * 8;
  return toIsoUtc(new Date(jan1 + snappedDays * MS_PER_DAY));
}

export function getLayerDateBounds(layer: GIBSLayer): { minDate: string; maxDate: string } {
  if (layer.cadence === 'static') {
    return { minDate: '', maxDate: '' };
  }
  const maxDate = snapDateToCadence(layer.cadence, formatUtcDateOffset(layer.safeLagDays));
  const rawMin = layer.rollingWindowDays
    ? formatUtcDateOffset(layer.rollingWindowDays)
    : (layer.minDate ?? '2000-02-24');
  const minDate = rawMin <= maxDate ? rawMin : maxDate;
  return { minDate, maxDate };
}

export function clampDateForLayer(layer: GIBSLayer, date: string): string {
  if (layer.cadence === 'static') return '';
  const { minDate, maxDate } = getLayerDateBounds(layer);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return maxDate;
  const bounded = date < minDate ? minDate : date > maxDate ? maxDate : date;
  const snapped = snapDateToCadence(layer.cadence, bounded);
  if (snapped >= minDate) return snapped;
  // Backward snap at lower edge can fall before minDate; step forward one cadence unit when needed.
  if (layer.cadence === 'monthly') {
    const dt = parseUtcDate(minDate);
    return toIsoUtc(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + (dt.getUTCDate() === 1 ? 0 : 1), 1)));
  }
  return maxDate;
}

export interface CompositePeriodOption {
  date: string;
  label: string;
}

/**
 * Enumerate valid selectable GIBS timestamps (newest first) for discrete `8day` and `monthly` layers.
 */
export function listCompositeDates(layer: GIBSLayer): CompositePeriodOption[] {
  if (layer.cadence !== '8day' && layer.cadence !== 'monthly') return [];
  const { minDate, maxDate } = getLayerDateBounds(layer);
  if (!minDate || !maxDate) return [];

  const options: CompositePeriodOption[] = [];
  if (layer.cadence === 'monthly') {
    const endDt = parseUtcDate(maxDate);
    let y = endDt.getUTCFullYear();
    let m = endDt.getUTCMonth();
    while (options.length < 48) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      if (iso < minDate) break;
      options.push({ date: iso, label: `${MONTH_NAMES[m]} ${y}` });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }
    return options;
  }

  // `8day` MODIS L3 cadence: each year generates `Jan 1 + 8*k` intervals within the year.
  const minYear = parseUtcDate(minDate).getUTCFullYear();
  const maxYear = parseUtcDate(maxDate).getUTCFullYear();
  for (let y = maxYear; y >= minYear && options.length < 72; y -= 1) {
    const jan1Ms = Date.UTC(y, 0, 1);
    const dec31Ms = Date.UTC(y, 11, 31);
    const yearPeriods: CompositePeriodOption[] = [];
    for (let startMs = jan1Ms; startMs <= dec31Ms; startMs += 8 * MS_PER_DAY) {
      const iso = toIsoUtc(new Date(startMs));
      if (iso < minDate || iso > maxDate) continue;
      const startDt = new Date(startMs);
      const endMs = Math.min(startMs + 7 * MS_PER_DAY, dec31Ms);
      const endDt = new Date(endMs);
      const rangeLabel = `${MONTH_NAMES[startDt.getUTCMonth()]} ${startDt.getUTCDate()} – ${MONTH_NAMES[endDt.getUTCMonth()]} ${endDt.getUTCDate()}, ${y}`;
      yearPeriods.push({ date: iso, label: rangeLabel });
    }
    options.push(...yearPeriods.reverse());
  }
  return options.slice(0, 72);
}

export const GIBS_LAYERS: GIBSLayer[] = [
  {
    id: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    name: 'VIIRS NOAA-20 True Color',
    description:
      'Gap-free 3,040 km overlapping swath true-color satellite imagery from NOAA-20 VIIRS. Eliminates narrow-swath orbital black stripes; winter polar night appears dark in visible bands.',
    service: 'wmts',
    cadence: 'daily',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'jpeg',
    maxZoom: 9,
    safeLagDays: 2,
    minDate: '2022-01-14',
    resolutionLabel: '375m Daily • WMTS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'BlueMarble_NextGeneration',
    name: 'NASA Blue Marble (Cloud-Free)',
    description:
      'Seamless pole-to-pole sunlit cloud-free true-color global Earth mosaic derived from MODIS observations.',
    service: 'wmts',
    cadence: 'static',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    format: 'jpeg',
    maxZoom: 8,
    safeLagDays: 0,
    resolutionLabel: '500m Composite • WMTS',
    defaultDate: '',
  },
  {
    id: 'MODIS_Terra_NDVI_8Day',
    name: 'MODIS Terra NDVI (Vegetation)',
    description:
      'Rolling 8-day composite Normalized Difference Vegetation Index from MODIS Terra, tracking global vegetation greenness without orbital gores.',
    service: 'wms',
    cadence: 'daily',
    tileMatrixSet: 'GoogleMapsCompatible_Level9',
    format: 'png',
    maxZoom: 9,
    safeLagDays: 3,
    rollingWindowDays: 270,
    resolutionLabel: '250m 8-Day • WMS',
    defaultDate: formatUtcDateOffset(3),
  },
  {
    id: 'MODIS_Terra_L3_Snow_Extent_8Day',
    name: 'MODIS Snow & Ice Extent (8-Day)',
    description:
      'Gap-free 8-day MODIS Terra Level-3 snow and sea-ice extent composite across mountains, boreal zones, and polar caps.',
    service: 'wms',
    cadence: '8day',
    tileMatrixSet: 'GoogleMapsCompatible_Level8',
    format: 'png',
    maxZoom: 8,
    safeLagDays: 12,
    minDate: '2026-02-02',
    resolutionLabel: '500m 8-Day • WMS',
    defaultDate: snapDateToCadence('8day', formatUtcDateOffset(12)),
  },
  {
    id: 'MODIS_Terra_L3_Land_Surface_Temp_8Day_Day',
    name: 'MODIS Land Surface Temp (8-Day Day)',
    description:
      'Gap-free 8-day daytime Level-3 Land Surface Temperature composite from MODIS Terra at 1km resolution, free of daily orbital stripes and cloud cutouts.',
    service: 'wms',
    cadence: '8day',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
    safeLagDays: 12,
    minDate: '2026-01-09',
    resolutionLabel: '1km 8-Day • WMS',
    defaultDate: snapDateToCadence('8day', formatUtcDateOffset(12)),
  },
  {
    id: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    name: 'Sea Surface Temperature (MUR)',
    description:
      'Multi-scale Ultra-high Resolution (MUR) Level-4 gap-free sea surface temperature analysis at 1km resolution across all global oceans.',
    service: 'wms',
    cadence: 'daily',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
    safeLagDays: 3,
    minDate: '2026-02-08',
    resolutionLabel: '1km L4 Gap-Free • WMS',
    defaultDate: formatUtcDateOffset(3),
  },
  {
    id: 'MODIS_Combined_Thermal_Anomalies_All',
    name: 'MODIS Active Fires & Thermal Anomalies',
    description:
      'Combined Terra and Aqua MODIS daytime/nighttime active fire and thermal hotspot detections rasterized via GIBS WMS.',
    service: 'wms',
    cadence: 'daily',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 8,
    safeLagDays: 2,
    minDate: '2025-09-17',
    resolutionLabel: '1km FIRMS • WMS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MultiSensor_Ocean_Chlorophyll_a',
    name: 'Multi-Sensor Ocean Chlorophyll-a',
    description:
      'Fused NOAA-20 VIIRS, NOAA-21 VIIRS, and NASA PACE OCI daily ocean chlorophyll-a concentration (mg/m^3), eliminating single-orbit equatorial bowtie gaps.',
    service: 'wms',
    wmsLayers: 'VIIRS_NOAA20_Chlorophyll_a,VIIRS_NOAA21_Chlorophyll_a,OCI_PACE_Chlorophyll_a',
    cadence: 'daily',
    tileMatrixSet: 'GoogleMapsCompatible_Level7',
    format: 'png',
    maxZoom: 7,
    safeLagDays: 2,
    minDate: '2018-02-24',
    resolutionLabel: 'Multi-Satellite • WMS',
    defaultDate: formatUtcDateOffset(2),
  },
  {
    id: 'MERRA2_Aerosol_Optical_Depth_Analysis_Monthly',
    name: 'MERRA-2 Global Aerosol Optical Depth',
    description:
      'NASA MERRA-2 global assimilated Aerosol Optical Depth (AOD) monthly analysis capturing Saharan dust, wildfire smoke, and urban haze with complete global coverage.',
    service: 'wmts',
    cadence: 'monthly',
    tileMatrixSet: 'GoogleMapsCompatible_Level6',
    format: 'png',
    maxZoom: 6,
    safeLagDays: 100,
    minDate: '2025-07-01',
    resolutionLabel: '50km Monthly • WMTS',
    defaultDate: snapDateToCadence('monthly', formatUtcDateOffset(100)),
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
  if (layer?.cadence === 'static') {
    return `${BASE_URL}/${layerId}/default/${tileMatrixSet}/{z}/{y}/{x}.${format}`;
  }
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
