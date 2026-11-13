export type VariableId = 
  | 'temp_air'
  | 'precip'
  | 'ndvi'
  | 'soil_moist'
  | 'evapo'
  | 'aod'
  | 'lst_day'
  | 'ozone'
  // Phase 1 expanded variables
  | 'pressure'
  | 'humidity'
  | 'specific_humidity'
  | 'wind_speed'
  | 'radiation_sw'
  | 'radiation_lw'
  | 'albedo'
  | 'snow_depth'
  | 'snow_precip'
  | 'ozone_total'
  | 'soil_moist_top'
  | 'soil_moist_prof'
  | 'sea_level'
  | 'sst'
  | 'streamflow'
  | 'evi';

export type VariableCategory = 'Atmosphere' | 'Land' | 'Hydrosphere' | 'Biosphere' | 'Cryosphere' | 'Ocean';

export type MeasurementType = 'Satellite Instrument' | 'Global Assimilation Model' | 'Combined Reanalysis' | 'In-Situ Gauge Network';

export type ProvenanceTier =
  | 'satellite_observation' // ORNL MODIS, NOAA, USGS real-time
  | 'reanalysis_model'      // NASA POWER (MERRA-2/GLDAS)
  | 'user_upload'           // CSV/JSON uploaded by user
  | 'synthetic_demo';       // Calibrated model fallback data

export const PROVENANCE_META: Record<ProvenanceTier, {
  label: string;
  shortLabel: string;
  icon: string;
  colorClass: string;
  description: string;
}> = {
  satellite_observation: {
    label: 'Satellite Observation',
    shortLabel: 'SAT OBS',
    icon: '🛰️',
    colorClass: 'text-emerald-400',
    description: 'Direct satellite or in-situ instrument measurements (ORNL MODIS, NOAA gauges, USGS streamflow)',
  },
  reanalysis_model: {
    label: 'NASA Model / Reanalysis',
    shortLabel: 'REANALYSIS',
    icon: '🔄',
    colorClass: 'text-cyan-400',
    description: 'NASA POWER gridded reanalysis data (MERRA-2, GLDAS, CERES assimilations)',
  },
  user_upload: {
    label: 'User Upload',
    shortLabel: 'USER CSV',
    icon: '📤',
    colorClass: 'text-amber-400',
    description: 'Custom CSV or JSON data uploaded by the user',
  },
  synthetic_demo: {
    label: 'Calibrated Demonstration',
    shortLabel: 'DEMO',
    icon: '🧪',
    colorClass: 'text-slate-400',
    description: 'Synthetic time series calibrated against published observations for offline demonstration',
  },
};

export interface EarthVariable {
  id: VariableId;
  name: string;
  shortName: string;
  unit: string;
  category: VariableCategory;
  description: string;
  studentExplanation: string;
  missions: string[]; // e.g. ["MODIS (Terra/Aqua)", "MERRA-2"]
  measurementType: MeasurementType;
  typicalRange: [number, number];
  color: string;
  iconName: string;
  driverExamples: string[];
  fillValue?: number; // e.g. -999 for NASA POWER polar-night
}

export interface HotspotRegion {
  id: string;
  name: string;
  countryOrOcean: string;
  coordinates: [number, number]; // [lat, lon]
  hasCoordinates?: boolean; // False when uploaded CSV lacks lat/lon columns
  category: 'Polar' | 'Tropical Rainforest' | 'Arid / Desert' | 'Agricultural' | 'Urban' | 'Marine' | 'High Altitude' | 'Coastal' | 'Riverine';
  description: string;
  keyPhenomenon: string;
  primaryVariable: VariableId;
  oppositePairId?: string; // Links to another region with contrasting trend
  oppositeExplanation?: string;
}

export interface TimeSeriesPoint {
  date: string; // YYYY-MM
  year: number;
  month: number;
  raw: number | null;
  isMissing?: boolean;
  movingAvg?: number; // 12-month rolling mean
  anomaly?: number;   // deseasonalized baseline anomaly
  trend?: number;     // linear regression value
  ciUpper?: number;   // 95% confidence upper bound
  ciLower?: number;   // 95% confidence lower bound
}

export interface TrendAnalysisResult {
  variableId: VariableId;
  variableName: string;
  unit: string;
  regionName: string;
  coordinates: [number, number];
  startDate: string;
  endDate: string;
  sampleCount: number;
  
  // Rate of change
  slopePerYear: number;
  slopePerDecade: number;
  sensSlopePerDecade: number;
  totalChange: number;
  percentChange: number;
  direction: 'Increasing' | 'Decreasing' | 'Stable';
  
  // Regression metrics
  rSquared: number;
  olsSlope: number;
  olsIntercept: number;
  standardError: number;
  
  // Student's t-test
  tStatistic: number;
  tPValue: number;
  
  // Mann-Kendall Trend Test
  mkS: number;
  mkVarS: number;
  mkZ: number;
  mkTau: number;
  mkPValue: number;
  
  // Significance Level
  significanceLevel: 'Extremely Significant' | 'Highly Significant' | 'Significant' | 'Marginally Significant' | 'Not Significant';
  significanceStars: '***' | '**' | '*' | '†' | 'n.s.';
  significanceColor: string;
  
  // Descriptive summary
  plainEnglishVerdict: string;
  scientificImplication: string;

  // Provenance & Missingness
  provenance?: ProvenanceTier;
  provenanceSource?: string;
  statusMessage?: string;
  missingCount?: number;
}

// ── Connector Registry Types ──────────────────────────────────────────

export interface ConnectorCapabilities {
  timeSeries: boolean;       // Can return TimeSeriesPoint[]
  mapTiles: boolean;         // Can provide WMTS/tile overlays
  catalogSearch: boolean;    // Can search metadata/collections
  pointSubset: boolean;      // Can query by lat/lon point
  regionSubset: boolean;     // Can query by bounding box
}

export interface ConnectorFetchOptions {
  lat: number;
  lon: number;
  variableId: VariableId;
  startYear?: number;
  endYear?: number;
  parameter?: string; // connector-specific parameter override
}

export interface ConnectorFetchResult {
  points: TimeSeriesPoint[];
  provenance: ProvenanceTier;
  sourceLabel: string;
  statusMessage: string;
}

export interface EarthDataConnector {
  id: string;
  name: string;
  shortName: string;
  description: string;
  baseUrl: string;
  capabilities: ConnectorCapabilities;
  supportedVariables: VariableId[];
  provenanceType: ProvenanceTier;
  requiresAuth: boolean;
  requiresProxy: boolean;

  /** Fetch time-series data for a point */
  fetchTimeSeries(options: ConnectorFetchOptions): Promise<ConnectorFetchResult>;

  /** Check if a variable is supported by this connector */
  supportsVariable(variableId: VariableId): boolean;
}

// ── Statistical Lab Types ─────────────────────────────────────────────

export interface DescriptiveStats {
  count: number;
  mean: number;
  median: number;
  mode: number[];
  stdDev: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  cv: number; // coefficient of variation
  sem: number; // standard error of mean
  missingCount: number;
  missingPercent: number;
}

export interface CorrelationResult {
  pearsonR: number;
  pearsonP: number;
  spearmanRho: number;
  spearmanP: number;
  kendallTau: number;
  kendallP: number;
}

export interface RegressionResult {
  coefficients: number[];
  intercept: number;
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
  standardErrors: number[];
  tStatistics: number[];
  tPValues: number[];
  residuals: number[];
  predictedValues: number[];
  durbinWatson: number;
}

export interface PCAResult {
  eigenvalues: number[];
  explainedVariance: number[];
  cumulativeVariance: number[];
  loadings: number[][];
  scores: number[][];
  componentLabels: string[];
}

export interface ChangePointResult {
  method: 'Pettitt' | 'CUSUM';
  changePointIndex: number;
  changePointDate: string;
  testStatistic: number;
  pValue: number;
  significanceLevel: string;
  meanBefore: number;
  meanAfter: number;
  shift: number;
}

export interface DiagnosticResults {
  normalityTest: { method: string; statistic: number; pValue: number; isNormal: boolean };
  outliers: { index: number; value: number; method: string; zScore?: number }[];
  missingnessProfile: { total: number; missing: number; percent: number; pattern: string };
  autocorrelation: { lag1: number; durbinWatson: number; ljungBoxQ: number; ljungBoxP: number };
  heteroskedasticity?: { bpStatistic: number; bpPValue: number; isHomoskedastic: boolean };
  vif?: { variable: string; vif: number }[];
}

export interface SeasonalMKResult {
  s: number;
  varS: number;
  z: number;
  pValue: number;
  tau: number;
  method: 'standard' | 'hamed_rao' | 'tfpw';
  seasonCount: number;
  autocorrelationCorrection?: number;
}

export interface DetectiveCase {
  id: string;
  title: string;
  mysteryTitle: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  regionId: string;
  variableId: VariableId;
  teaser: string;
  briefing: string;
  suspectDrivers: string[];
  satelliteClue: string;
  guidingQuestions: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  verdictDebrief: string;
  realWorldImpact: string;
}

export interface RegionalContrastScenario {
  id: string;
  title: string;
  commonDriver: string;
  description: string;
  variableId: VariableId;
  regionA: {
    hotspotId: string;
    trendDescription: string;
    mechanism: string;
  };
  regionB: {
    hotspotId: string;
    trendDescription: string;
    mechanism: string;
  };
  scientificTakeaway: string;
}

export interface TwoWayAnovaResult {
  factorALabel: string;
  factorBLabel: string;
  factorA: { f: number; df: number; ss: number; ms: number; pValue: number };
  factorB: { f: number; df: number; ss: number; ms: number; pValue: number };
  interaction: { f: number; df: number; ss: number; ms: number; pValue: number };
  within: { df: number; ss: number; ms: number };
  grandMean: number;
  cellMeans: { levelA: string; levelB: string; mean: number; n: number }[];
}

export interface NonlinearRegressionResult {
  model: 'exponential' | 'logarithmic' | 'power' | 'quadratic' | 'logistic';
  equation: string;
  paramLabels: string[];
  params: number[];
  rSquared: number;
  rmse: number;
  aic: number;
  predictedValues: number[];
  residuals: number[];
}

export interface GEVResult {
  shapeXi: number;
  locationMu: number;
  scaleSigma: number;
  family: 'Frechet (heavy-tailed)' | 'Gumbel (light-tailed)' | 'Weibull (bounded)';
  blockMaxima: number[];
  returnLevels: { period: number; level: number }[];
}
