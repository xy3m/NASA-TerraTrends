export type VariableId = 
  | 'temp_air'
  | 'precip'
  | 'ndvi'
  | 'soil_moist'
  | 'evapo'
  | 'aod'
  | 'lst_day'
  | 'ozone';

export interface EarthVariable {
  id: VariableId;
  name: string;
  shortName: string;
  unit: string;
  category: 'Atmosphere' | 'Land' | 'Hydrosphere' | 'Biosphere';
  description: string;
  studentExplanation: string;
  missions: string[]; // e.g. ["MODIS (Terra/Aqua)", "MERRA-2"]
  measurementType: 'Satellite Instrument' | 'Global Assimilation Model' | 'Combined Reanalysis';
  typicalRange: [number, number];
  color: string;
  iconName: string;
  driverExamples: string[];
}

export interface HotspotRegion {
  id: string;
  name: string;
  countryOrOcean: string;
  coordinates: [number, number]; // [lat, lon]
  hasCoordinates?: boolean; // False when uploaded CSV lacks lat/lon columns
  category: 'Polar' | 'Tropical Rainforest' | 'Arid / Desert' | 'Agricultural' | 'Urban' | 'Marine' | 'High Altitude';
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
  raw: number;
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
