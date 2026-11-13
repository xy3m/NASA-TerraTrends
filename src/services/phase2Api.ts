/**
 * Phase 2 Scientific Computing Backend Client (/api/v1/*).
 * Communicates with the FastAPI engine via Vite dev proxy (/api -> http://127.0.0.1:8000),
 * VITE_BACKEND_URL, or a runtime-configurable URL override stored in localStorage.
 */

import type { ProvenanceTier } from '../types/earthScience';

const BACKEND_URL_STORAGE_KEY = 'geo_iris_phase2_backend_url';

export interface BackendProvenance {
  tier: ProvenanceTier;
  source_name: string;
  dataset_id: string;
  is_live: boolean;
  status_message: string;
  citation?: string | null;
}

export interface Phase2SeriesHandoff {
  title: string;
  variableId?: string;
  unit?: string;
  regionName?: string;
  dates: string[];
  values: (number | null)[];
  provenanceTier?: ProvenanceTier;
}

export interface AuthConfigPayload {
  earthdata_token?: string | null;
  earthdata_username?: string | null;
  earthdata_password?: string | null;
  firms_map_key?: string | null;
  clear_session?: boolean;
}

export interface AuthStatusResponse {
  earthdata_configured: boolean;
  earthdata_source: string;
  earthdata_username_hint?: string | null;
  earthdata_token_hint?: string | null;
  firms_configured: boolean;
  firms_source: string;
  firms_key_hint?: string | null;
  keyless_feeds_available: string[];
}

export interface HealthResponse {
  status: string;
  version: string;
  capabilities: Record<string, boolean>;
  auth: AuthStatusResponse;
}

export interface SarimaRequest {
  dates: string[];
  values: (number | null)[];
  forecast_steps?: number;
  seasonal_period?: number;
  auto_order?: boolean;
  order?: [number, number, number];
  seasonal_order?: [number, number, number, number];
  holdout_size?: number;
  variable_name?: string;
}

export interface SarimaForecastStep {
  date: string;
  mean: number;
  ci80_lower: number;
  ci80_upper: number;
  ci95_lower: number;
  ci95_upper: number;
}

export interface SarimaResponse {
  variable_name: string;
  n_total: number;
  n_valid: number;
  n_missing: number;
  selected_order: number[];
  selected_seasonal_order: number[];
  aic: number;
  bic: number;
  log_likelihood: number;
  historical_dates: string[];
  observed: (number | null)[];
  fitted: (number | null)[];
  forecast: SarimaForecastStep[];
  diagnostics: {
    ljung_box_q: number | null;
    ljung_box_p: number | null;
    shapiro_p: number | null;
    residual_std: number | null;
  };
  holdout: {
    holdout_steps: number;
    rmse: number;
    mae: number;
    mape_pct: number | null;
  } | null;
  decomposition: {
    trend: (number | null)[];
    seasonal: (number | null)[];
    residual: (number | null)[];
  } | null;
  model_candidates: Array<{
    order: number[];
    seasonal_order: number[];
    aic: number;
    bic: number;
  }>;
}

export interface BayesianMcmcRequest {
  dates: string[];
  values: (number | null)[];
  model_type: 'robust_ar1' | 'changepoint';
  chains?: number;
  draws?: number;
  burn_in?: number;
  seed?: number;
}

export interface McmcParamSummary {
  mean: number;
  median: number;
  sd: number;
  hdi_95_low: number;
  hdi_95_high: number;
  ci_95_low: number;
  ci_95_high: number;
  r_hat: number;
  ess: number;
}

export interface BayesianMcmcResponse {
  model_type: 'robust_ar1' | 'changepoint';
  model_description: string;
  n_total: number;
  n_valid: number;
  n_missing: number;
  valid_dates: string[];
  observed_valid: number[];
  diagnostics: {
    chains: number;
    draws_per_chain: number;
    burn_in: number;
    mean_acceptance_rate: number;
    converged: boolean;
  };
  parameters: Record<string, McmcParamSummary>;
  estimated_changepoint_date?: string;
  estimated_changepoint_index?: number;
  probability_of_direction: {
    p_positive: number;
    p_negative: number;
    direction: string;
    certainty: number;
  };
  posterior_histogram_decade: {
    centers: number[];
    density: number[];
  };
  traces_slope_decade: number[][];
  predictive_trend: {
    t_years: number[];
    mean: number[];
    ci95_low: number[];
    ci95_high: number[];
    ci50_low: number[];
    ci50_high: number[];
  };
}

export interface ExtremeValueRequest {
  values: (number | null)[];
  dates?: string[];
  mode: 'gev_block_maxima' | 'gpd_pot';
  block_size?: number;
  threshold_quantile?: number;
  return_periods?: number[];
}

export interface ExtremeValueResponse {
  mode: 'gev_block_maxima' | 'gpd_pot';
  family_classification: string;
  n_samples: number;
  threshold?: number;
  threshold_quantile?: number;
  exceedance_rate_per_period?: number;
  parameters: Record<string, number>;
  goodness_of_fit: {
    ks_statistic: number;
    ks_p_value: number;
  };
  block_maxima?: number[];
  block_labels?: string[];
  empirical_return_plot: Array<{ return_period: number; value: number }>;
  return_levels: Array<{
    return_period: number;
    return_level: number;
    ci95_low: number | null;
    ci95_high: number | null;
  }>;
}

export interface SpatialFdrRequest {
  region_name?: string;
  center_lat?: number;
  center_lon?: number;
  grid_rows?: number;
  grid_cols?: number;
  n_years?: number;
  alpha?: number;
  correction_method?: 'bh' | 'by' | 'holm' | 'bonferroni';
  cube?: (number | null)[][][] | null;
  seed?: number;
}

export interface SpatialFdrResponse {
  region_name: string;
  provenance: BackendProvenance;
  dimensions: { time_steps: number; rows: number; cols: number };
  method: string;
  alpha: number;
  summary: {
    total_valid_cells: number;
    raw_significant_cells: number;
    fdr_significant_cells: number;
    false_positives_pruned: number;
    pct_area_raw_sig: number;
    pct_area_fdr_sig: number;
    field_significant: boolean;
    min_raw_p: number;
    min_adjusted_q: number;
    max_positive_slope_decade: number;
    min_negative_slope_decade: number;
    wilks_effective_alpha: number;
  };
  images: {
    trend_png: string;
    fdr_png: string;
  };
  grid: {
    latitudes: number[];
    longitudes: number[];
    slope_decade: number[][];
    p_values: number[][];
    q_values: number[][];
    raw_significant: boolean[][];
    fdr_significant: boolean[][];
  };
}

export interface FirmsQueryRequest {
  west: number;
  south: number;
  east: number;
  north: number;
  source?: 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA20_NRT' | 'MODIS_NRT';
  day_range?: number;
  region_label?: string;
  allow_eonet_fallback?: boolean;
}

export interface FirmsHotspot {
  latitude: number;
  longitude: number;
  acq_date: string;
  acq_time: string;
  frp_mw: number | null;
  brightness_k: number | null;
  confidence: string;
  daynight: string;
  satellite: string;
  title?: string;
}

export interface FirmsQueryResponse {
  provenance: BackendProvenance;
  region_label: string;
  bbox: [number, number, number, number];
  source: string;
  day_range: number;
  summary: {
    total_detections: number;
    regional_matches?: number;
    total_frp_mw: number | null;
    mean_frp_mw: number | null;
    p95_frp_mw: number | null;
    max_frp_mw: number | null;
    day_detections: number | null;
    night_detections: number | null;
    high_confidence_count: number;
  };
  daily_series: Array<{
    date: string;
    count: number;
    total_frp_mw: number | null;
    mean_frp_mw: number | null;
  }>;
  hotspots: FirmsHotspot[];
}

export interface VerticalProfileRequest {
  lat: number;
  lon: number;
  start_year?: number;
  end_year?: number;
  product?: 'AIRS3STM' | 'MERRA2_M2IMNPASM';
}

export interface CmrGranuleItem {
  id: string | null;
  title: string | null;
  time_start: string | null;
  time_end: string | null;
  granule_size_mb?: string | null;
  links?: string[];
}

export interface VerticalProfileResponse {
  provenance: BackendProvenance;
  coordinate: { lat: number; lon: number };
  product: string;
  years: number[];
  cmr_granules: CmrGranuleItem[];
  profile_by_pressure: Array<{
    pressure_hpa: number;
    altitude_km: number;
    mean_temp_c: number;
    trend_c_per_decade: number;
    ci95_half_width: number;
    p_value: number;
    regime: string;
  }>;
  anomaly_heatmap: number[][];
}

export interface TraceGasRequest {
  gas: 'NO2' | 'CH4' | 'CO' | 'SO2';
  lat: number;
  lon: number;
  region_label?: string;
  start_year?: number;
  end_year?: number;
}

export interface TraceGasResponse {
  provenance: BackendProvenance;
  gas: string;
  unit: string;
  sensor: string;
  description: string;
  region_label: string;
  coordinate: { lat: number; lon: number };
  cmr_granules: CmrGranuleItem[];
  trend_per_year: number;
  trend_per_decade: number;
  r_squared: number;
  p_value: number;
  dates: string[];
  values: number[];
}

export interface NetcdfInspectResponse {
  filename: string;
  dims: Record<string, number>;
  coords: Record<string, { length: number; sample: string[] }>;
  variables: Array<{
    name: string;
    dims: string[];
    shape: number[];
    units: string;
    long_name: string;
    min: number | null;
    max: number | null;
    mean: number | null;
    missing_count: number;
  }>;
  global_attrs: Record<string, string>;
}

export interface NetcdfExtractResponse {
  provenance: BackendProvenance;
  variable: string;
  units: string;
  selected_point: { lat: number; lon: number; spatial_mean?: boolean } | null;
  series: Array<{ date: string; value: number | null }>;
  has_spatial_cube: boolean;
  spatial_cube: (number | null)[][][] | null;
}

export interface AppeearsPointRequest {
  product: string;
  layer: string;
  lat: number;
  lon: number;
  start_date: string;
  end_date: string;
  task_name: string;
}

export interface AppeearsPointResponse {
  authenticated: boolean;
  status: string;
  message: string;
  planned_endpoint?: string;
  appeears_response?: Record<string, unknown>;
  task_payload: Record<string, unknown>;
}

export interface DemDiffResponse {
  provenance: BackendProvenance;
  label: string;
  dimensions: { rows: number; cols: number; pixel_size_m: number };
  lod_threshold_m: number;
  summary: {
    mean_elevation_change_m: number;
    median_change_m: number;
    max_deposition_m: number;
    max_erosion_m: number;
    pct_area_changed: number;
    deposition_volume_m3: number;
    erosion_volume_m3: number;
    net_volume_change_m3: number;
  };
  histogram: { centers_m: number[]; counts: number[] };
  images: {
    before_png: string;
    after_png: string;
    dod_png: string;
    lod_mask_png: string;
  };
}

export interface SarChangeResponse {
  provenance: BackendProvenance;
  label: string;
  speckle_filter: string;
  window_size: number;
  threshold_db: number;
  otsu_suggested_threshold_db: number;
  summary: {
    total_area_km2: number;
    backscatter_drop_area_km2: number;
    backscatter_gain_area_km2: number;
    pct_changed: number;
    mean_log_ratio_db: number;
    std_log_ratio_db: number;
  };
  histogram: { centers_db: number[]; counts: number[] };
  images: {
    before_png: string;
    after_png: string;
    log_ratio_png: string;
    change_mask_png: string;
  };
}

export interface AsfSearchResponse {
  provenance: BackendProvenance;
  granule_count: number;
  granules: Array<{
    scene_name: string | null;
    platform: string | null;
    beam_mode: string | null;
    polarization: string | null;
    flight_direction: string | null;
    path_number: number | null;
    frame_number: number | null;
    start_time: string | null;
    bytes_mb: number | null;
    browse_url: string | null;
    download_url: string | null;
  }>;
}

export interface LulcTransitionResponse {
  provenance: BackendProvenance;
  label: string;
  overall_persistence_pct: number;
  pct_changed: number;
  cohen_kappa: number;
  classes: Array<{
    class_id: number;
    label: string;
    before_pct: number;
    after_pct: number;
    net_change_pct_pts: number;
    net_area_km2: number;
    persistence_pct: number;
  }>;
  transition_matrix: {
    labels: string[];
    counts: number[][];
    area_km2: number[][];
  };
  images: {
    before_png: string;
    after_png: string;
    change_mask_png: string;
  };
}

export class Phase2OfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Phase2OfflineError';
  }
}

export function getBackendBaseUrl(): string {
  try {
    const stored = window.localStorage.getItem(BACKEND_URL_STORAGE_KEY)?.trim();
    if (stored) {
      return stored.replace(/\/+$/, '');
    }
  } catch {
    // Ignore storage access failures (e.g. private browsing)
  }
  const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  return envUrl ? envUrl.replace(/\/+$/, '') : '';
}

export function setBackendBaseUrl(url: string): void {
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (cleaned) {
      window.localStorage.setItem(BACKEND_URL_STORAGE_KEY, cleaned);
    } else {
      window.localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

async function requestApi<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<T> {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? {}
    : { 'Content-Type': 'application/json' };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> | undefined),
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      let detail = `Backend returned HTTP ${response.status}`;
      if (contentType.includes('application/json')) {
        try {
          const errJson = await response.json();
          if (typeof errJson?.detail === 'string') {
            detail = errJson.detail;
          }
        } catch {
          // keep generic HTTP status message
        }
      } else if (response.status >= 502 && response.status <= 504) {
        throw new Phase2OfflineError(
          `Python compute backend is unreachable (HTTP ${response.status}). Start FastAPI with: uvicorn app.main:app --port 8000`
        );
      }
      throw new Error(detail);
    }

    if (!contentType.includes('application/json')) {
      throw new Phase2OfflineError(
        'Received non-JSON response from /api/v1. Ensure the FastAPI compute server is running or set VITE_BACKEND_URL.'
      );
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Phase2OfflineError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Phase2OfflineError(`Compute backend request timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    if (err instanceof TypeError) {
      throw new Phase2OfflineError(
        'Cannot connect to the FastAPI compute backend (port 8000). Start `uvicorn app.main:app --port 8000` inside `backend/`.'
      );
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

function postJson<TResponse, TBody>(
  path: string,
  body: TBody,
  timeoutMs = 30000
): Promise<TResponse> {
  return requestApi<TResponse>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    timeoutMs
  );
}

export const phase2Api = {
  getHealth: () => requestApi<HealthResponse>('/api/v1/health', { method: 'GET' }, 6000),
  getAuthStatus: () => requestApi<AuthStatusResponse>('/api/v1/auth/status', { method: 'GET' }, 6000),
  configureAuth: (payload: AuthConfigPayload) =>
    postJson<AuthStatusResponse, AuthConfigPayload>('/api/v1/auth/configure', payload, 10000),

  // Advanced Statistical Modeling
  runSarima: (payload: SarimaRequest) =>
    postJson<SarimaResponse, SarimaRequest>('/api/v1/stats/sarima', payload, 35000),
  runBayesianMcmc: (payload: BayesianMcmcRequest) =>
    postJson<BayesianMcmcResponse, BayesianMcmcRequest>('/api/v1/stats/bayesian-mcmc', payload, 45000),
  runExtremeValue: (payload: ExtremeValueRequest) =>
    postJson<ExtremeValueResponse, ExtremeValueRequest>('/api/v1/stats/extreme-value', payload, 35000),
  runSpatialFdr: (payload: SpatialFdrRequest) =>
    postJson<SpatialFdrResponse, SpatialFdrRequest>('/api/v1/stats/spatial-fdr', payload, 30000),

  // NASA FIRMS & EONET
  queryFirmsFires: (payload: FirmsQueryRequest) =>
    postJson<FirmsQueryResponse, FirmsQueryRequest>('/api/v1/firms/fires', payload, 25000),

  // Earthdata, Profiles, Trace Gases & NetCDF
  getVerticalProfile: (payload: VerticalProfileRequest) =>
    postJson<VerticalProfileResponse, VerticalProfileRequest>('/api/v1/earthdata/vertical-profile', payload, 25000),
  getTraceGases: (payload: TraceGasRequest) =>
    postJson<TraceGasResponse, TraceGasRequest>('/api/v1/earthdata/trace-gases', payload, 25000),
  submitAppeearsPoint: (payload: AppeearsPointRequest) =>
    postJson<AppeearsPointResponse, AppeearsPointRequest>('/api/v1/earthdata/appeears-point', payload, 25000),
  inspectNetcdf: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return requestApi<NetcdfInspectResponse>('/api/v1/earthdata/netcdf/inspect', { method: 'POST', body: fd }, 30000);
  },
  extractNetcdf: (
    file: File,
    opts: { variable?: string; target_lat?: number | null; target_lon?: number | null; spatial_mean?: boolean }
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.variable) fd.append('variable', opts.variable);
    if (opts.target_lat !== null && opts.target_lat !== undefined && Number.isFinite(opts.target_lat)) {
      fd.append('target_lat', String(opts.target_lat));
    }
    if (opts.target_lon !== null && opts.target_lon !== undefined && Number.isFinite(opts.target_lon)) {
      fd.append('target_lon', String(opts.target_lon));
    }
    fd.append('spatial_mean', opts.spatial_mean ? 'true' : 'false');
    return requestApi<NetcdfExtractResponse>('/api/v1/earthdata/netcdf/extract', { method: 'POST', body: fd }, 40000);
  },

  // Rasters: DEM DoD, SAR Change Detection + ASF Search, LULC Transitions
  runDemPreset: (payload: {
    scenario: 'mount_st_helens_lahar' | 'colorado_river_incision' | 'thwaites_glacier_thinning';
    lod_threshold_m?: number;
    pixel_size_m?: number;
  }) => postJson<DemDiffResponse, typeof payload>('/api/v1/rasters/dem-diff', payload, 25000),
  runDemUpload: (beforeFile: File, afterFile: File, lodThresholdM: number) => {
    const fd = new FormData();
    fd.append('before_file', beforeFile);
    fd.append('after_file', afterFile);
    fd.append('lod_threshold_m', String(lodThresholdM));
    return requestApi<DemDiffResponse>('/api/v1/rasters/dem-diff/upload', { method: 'POST', body: fd }, 40000);
  },
  runSarPreset: (payload: {
    scenario: 'amazon_seasonal_flooding' | 'rondonia_deforestation_clearcut' | 'kilauea_lava_emplacement';
    speckle_filter?: 'none' | 'lee' | 'mean';
    window_size?: number;
    threshold_db?: number;
    pixel_size_m?: number;
  }) => postJson<SarChangeResponse, typeof payload>('/api/v1/rasters/sar-change', payload, 25000),
  runSarUpload: (
    beforeFile: File,
    afterFile: File,
    opts: { speckle_filter: 'none' | 'lee' | 'mean'; window_size: number; threshold_db: number }
  ) => {
    const fd = new FormData();
    fd.append('before_file', beforeFile);
    fd.append('after_file', afterFile);
    fd.append('speckle_filter', opts.speckle_filter);
    fd.append('window_size', String(opts.window_size));
    fd.append('threshold_db', String(opts.threshold_db));
    return requestApi<SarChangeResponse>('/api/v1/rasters/sar-change/upload', { method: 'POST', body: fd }, 40000);
  },
  searchAsfSar: (payload: {
    lat: number;
    lon: number;
    radius_deg?: number;
    platform?: 'SENTINEL-1' | 'ALOS' | 'UAVSAR' | 'SEASAT';
    start_date?: string;
    end_date?: string;
    max_results?: number;
  }) => postJson<AsfSearchResponse, typeof payload>('/api/v1/rasters/asf-search', payload, 25000),
  runLulcPreset: (payload: {
    scenario: 'amazon_arc_deforestation' | 'pearl_river_urbanization' | 'aral_sea_desiccation';
  }) => postJson<LulcTransitionResponse, typeof payload>('/api/v1/rasters/lulc-transitions', payload, 25000),
  runLulcUpload: (beforeFile: File, afterFile: File) => {
    const fd = new FormData();
    fd.append('before_file', beforeFile);
    fd.append('after_file', afterFile);
    return requestApi<LulcTransitionResponse>('/api/v1/rasters/lulc-transitions/upload', { method: 'POST', body: fd }, 40000);
  },
};
