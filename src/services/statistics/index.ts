/**
 * GEOIRIS Modular Statistics Engine
 * Exports all statistical modules and maintains 100% backward compatibility with original statistics.ts
 */

export * from './distributions';
export * from './descriptive';
export * from './inferential';
export * from './regression';
export * from './timeseries';
export * from './diagnostics';
export * from './fdr';

// ── Backward compatibility exports for existing codebase ─────────────

import { TimeSeriesPoint, TrendAnalysisResult, VariableId } from '../../types/earthScience';
import { normalPValue, tCDF, tQuantile } from './distributions';

/**
 * Calculate Deseasonalized Anomalies and 12-Month Moving Averages
 * Explicitly preserves null/missing (e.g. -999.0 polar night) time slots.
 */
export function processTimeSeries(rawPoints: { date: string; value: number | null }[]): TimeSeriesPoint[] {
  if (rawPoints.length === 0) return [];

  const points: TimeSeriesPoint[] = rawPoints.map(p => {
    const parts = p.date.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const isValid = p.value !== null && typeof p.value === 'number' && !isNaN(p.value) && isFinite(p.value);
    return {
      date: p.date,
      year,
      month,
      raw: isValid ? p.value : null,
      isMissing: !isValid,
    };
  });

  const monthlySums: { [m: number]: { sum: number; count: number } } = {};
  for (let m = 1; m <= 12; m++) {
    monthlySums[m] = { sum: 0, count: 0 };
  }

  for (const p of points) {
    if (p.raw !== null && monthlySums[p.month]) {
      monthlySums[p.month].sum += p.raw;
      monthlySums[p.month].count += 1;
    }
  }

  const monthlyMeans: { [m: number]: number } = {};
  for (let m = 1; m <= 12; m++) {
    monthlyMeans[m] = monthlySums[m].count > 0 ? monthlySums[m].sum / monthlySums[m].count : 0;
  }

  for (const p of points) {
    if (p.raw === null) {
      p.anomaly = undefined;
      continue;
    }
    const baseline = monthlyMeans[p.month] || 0;
    p.anomaly = +(p.raw - baseline).toFixed(3);
  }

  const windowSize = 12;
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    if (points[i].raw === null) {
      points[i].movingAvg = undefined;
      continue;
    }
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(points.length, i + halfWindow);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      const val = points[j].raw;
      if (val !== null) {
        sum += val;
        count++;
      }
    }
    points[i].movingAvg = count > 0 ? +(sum / count).toFixed(3) : undefined;
  }

  return points;
}

function getValidPointEntries(
  points: TimeSeriesPoint[],
  useAnomaly: boolean
): { t: number; y: number; raw: number }[] {
  const valid: { t: number; y: number; raw: number }[] = [];
  for (const p of points) {
    if (p.raw === null || !isFinite(p.raw)) continue;
    const val = useAnomaly && p.anomaly !== undefined ? p.anomaly : p.raw;
    if (!isFinite(val)) continue;
    valid.push({
      t: p.year + (p.month - 1) / 12,
      y: val,
      raw: p.raw,
    });
  }
  return valid;
}

/**
 * Compute Theil-Sen Robust Slope Estimator
 */
export function calculateTheilSenSlope(points: TimeSeriesPoint[], useAnomaly = true): number {
  const valid = getValidPointEntries(points, useAnomaly);
  const n = valid.length;
  if (n < 2) return 0;

  const slopes: number[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dt = valid[j].t - valid[i].t;
      if (dt > 0.001) {
        slopes.push((valid[j].y - valid[i].y) / dt);
      }
    }
  }

  if (slopes.length === 0) return 0;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 === 0 ? (slopes[mid - 1] + slopes[mid]) / 2 : slopes[mid];
}

/**
 * Perform Mann-Kendall Non-Parametric Trend Test
 */
export function calculateMannKendall(points: TimeSeriesPoint[], useAnomaly = true): {
  s: number;
  varS: number;
  z: number;
  tau: number;
  pValue: number;
} {
  const values = getValidPointEntries(points, useAnomaly).map(e => e.y);
  const n = values.length;
  if (n < 4) {
    return { s: 0, varS: 1, z: 0, tau: 0, pValue: 1 };
  }

  let s = 0;
  for (let k = 0; k < n - 1; k++) {
    for (let j = k + 1; j < n; j++) {
      const diff = values[j] - values[k];
      if (diff > 1e-7) s += 1;
      else if (diff < -1e-7) s -= 1;
    }
  }

  const valueCounts = new Map<number, number>();
  for (const v of values) {
    const rounded = Math.round(v * 1000) / 1000;
    valueCounts.set(rounded, (valueCounts.get(rounded) || 0) + 1);
  }

  let tieTerm = 0;
  for (const count of valueCounts.values()) {
    if (count > 1) {
      tieTerm += count * (count - 1) * (2 * count + 5);
    }
  }

  const varS = Math.max(1e-9, (n * (n - 1) * (2 * n + 5) - tieTerm) / 18);

  let z = 0;
  if (s > 0) {
    z = (s - 1) / Math.sqrt(varS);
  } else if (s < 0) {
    z = (s + 1) / Math.sqrt(varS);
  }

  const tau = (2 * s) / (n * (n - 1));
  const pValue = normalPValue(z);

  return { s, varS, z, tau, pValue };
}

/**
 * Complete Statistical Trend Analysis
 */
export function analyzeTrend(
  points: TimeSeriesPoint[],
  variableId: VariableId,
  variableName: string,
  unit: string,
  regionName: string,
  coordinates: [number, number],
  useAnomaly = true
): TrendAnalysisResult {
  const totalSlots = points.length;
  if (totalSlots === 0) {
    throw new Error('Cannot analyze empty time series');
  }

  const valid = getValidPointEntries(points, useAnomaly);
  const n = valid.length;
  const missingCount = totalSlots - n;
  if (n < 3) {
    throw new Error('Insufficient valid observations in time series');
  }

  const times = valid.map(e => e.t);
  const values = valid.map(e => e.y);

  const meanT = times.reduce((a, b) => a + b, 0) / n;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  let ssXX = 0;
  let ssYY = 0;
  let ssXY = 0;

  for (let i = 0; i < n; i++) {
    const dt = times[i] - meanT;
    const dy = values[i] - meanY;
    ssXX += dt * dt;
    ssYY += dy * dy;
    ssXY += dt * dy;
  }

  const olsSlope = ssXX !== 0 ? ssXY / ssXX : 0;
  const olsIntercept = meanY - olsSlope * meanT;

  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = olsSlope * times[i] + olsIntercept;
    const res = values[i] - pred;
    ssRes += res * res;
  }

  const rSquared = ssYY !== 0 ? Math.max(0, 1 - ssRes / ssYY) : 0;
  const df = Math.max(1, n - 2);
  const sErrSq = ssRes / df;
  const standardError = Math.sqrt(sErrSq);
  const slopeSE = ssXX > 0 ? Math.sqrt(sErrSq / ssXX) : 0;

  const tStatistic = slopeSE > 0 ? olsSlope / slopeSE : 0;
  const tPValue = 2 * (1 - tCDF(Math.abs(tStatistic), df));

  const sensSlopePerYear = calculateTheilSenSlope(points, useAnomaly);
  const sensSlopePerDecade = sensSlopePerYear * 10;

  const mk = calculateMannKendall(points, useAnomaly);

  const rawTCrit = tQuantile(0.975, df);
  const tCritical = isFinite(rawTCrit) ? rawTCrit : 1.96;
  for (let i = 0; i < totalSlots; i++) {
    const t = points[i].year + (points[i].month - 1) / 12;
    const trendVal = olsSlope * t + olsIntercept;
    points[i].trend = +trendVal.toFixed(3);

    const marginOfError =
      ssXX > 0
        ? tCritical * standardError * Math.sqrt(1 / n + Math.pow(t - meanT, 2) / ssXX)
        : 0;
    points[i].ciUpper = +(trendVal + marginOfError).toFixed(3);
    points[i].ciLower = +(trendVal - marginOfError).toFixed(3);
  }

  const slopePerYear = olsSlope;
  const slopePerDecade = olsSlope * 10;
  const totalDurationYears = times[n - 1] - times[0];
  const totalChange = slopePerYear * totalDurationYears;

  const rawMean = valid.reduce((acc, p) => acc + p.raw, 0) / n;
  const percentChange = rawMean !== 0 ? (totalChange / Math.abs(rawMean)) * 100 : 0;

  let direction: 'Increasing' | 'Decreasing' | 'Stable' = 'Stable';
  if (Math.abs(olsSlope) > 0.0001 && mk.pValue < 0.1) {
    direction = olsSlope > 0 ? 'Increasing' : 'Decreasing';
  }

  const p = mk.pValue;
  let significanceLevel: 'Extremely Significant' | 'Highly Significant' | 'Significant' | 'Marginally Significant' | 'Not Significant';
  let significanceStars: '***' | '**' | '*' | '†' | 'n.s.';
  let significanceColor: string;

  if (p < 0.001) {
    significanceLevel = 'Extremely Significant';
    significanceStars = '***';
    significanceColor = '#10B981';
  } else if (p < 0.01) {
    significanceLevel = 'Highly Significant';
    significanceStars = '**';
    significanceColor = '#06B6D4';
  } else if (p < 0.05) {
    significanceLevel = 'Significant';
    significanceStars = '*';
    significanceColor = '#3B82F6';
  } else if (p < 0.10) {
    significanceLevel = 'Marginally Significant';
    significanceStars = '†';
    significanceColor = '#F59E0B';
  } else {
    significanceLevel = 'Not Significant';
    significanceStars = 'n.s.';
    significanceColor = '#94A3B8';
  }

  const dirText = direction === 'Increasing' ? 'an upward (increasing)' : direction === 'Decreasing' ? 'a downward (decreasing)' : 'a neutral (stable)';
  const rateFmt = Math.abs(slopePerDecade).toFixed(2);
  const pFmt = p < 0.001 ? '< 0.001' : `= ${p.toFixed(3)}`;

  let plainEnglishVerdict = '';
  if (significanceLevel === 'Extremely Significant' || significanceLevel === 'Highly Significant' || significanceLevel === 'Significant') {
    plainEnglishVerdict = `A statistically confirmed ${significanceLevel.toLowerCase()} ${dirText} trend was detected in ${variableName} for ${regionName}. Over the past ${Math.round(totalDurationYears)} years, the variable changed by ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(2)} ${unit} (rate of ${totalChange > 0 ? '+' : '-'}${rateFmt} ${unit}/decade, p ${pFmt}). This persistent shift is not caused by random seasonal fluctuations.`;
  } else if (significanceLevel === 'Marginally Significant') {
    plainEnglishVerdict = `A weak or emerging ${dirText} trend is visible (${totalChange > 0 ? '+' : ''}${rateFmt} ${unit}/decade, p = ${p.toFixed(3)}), but it falls slightly short of rigorous 95% scientific certainty (p < 0.05). Additional observational years are required to rule out natural decadal variability.`;
  } else {
    plainEnglishVerdict = `No statistically significant monotonic trend was detected in ${variableName} for ${regionName} (p = ${p.toFixed(3)}). Variations observed over time remain within expected natural seasonal cycles and inter-annual climate oscillations.`;
  }

  const scientificImplication = generateScientificImplication(variableId, direction, significanceLevel, slopePerDecade, unit, regionName);

  return {
    variableId,
    variableName,
    unit,
    regionName,
    coordinates,
    startDate: points[0].date,
    endDate: points[n - 1].date,
    sampleCount: n,
    missingCount,
    slopePerYear: +slopePerYear.toFixed(4),
    slopePerDecade: +slopePerDecade.toFixed(3),
    sensSlopePerDecade: +sensSlopePerDecade.toFixed(3),
    totalChange: +totalChange.toFixed(3),
    percentChange: +percentChange.toFixed(2),
    direction,
    rSquared: +rSquared.toFixed(3),
    olsSlope: +olsSlope.toFixed(5),
    olsIntercept: +olsIntercept.toFixed(3),
    standardError: +standardError.toFixed(3),
    tStatistic: +tStatistic.toFixed(3),
    tPValue: +tPValue.toFixed(4),
    mkS: mk.s,
    mkVarS: +mk.varS.toFixed(1),
    mkZ: +mk.z.toFixed(3),
    mkTau: +mk.tau.toFixed(3),
    mkPValue: +mk.pValue.toFixed(4),
    significanceLevel,
    significanceStars,
    significanceColor,
    plainEnglishVerdict,
    scientificImplication,
  };
}

function generateScientificImplication(
  variableId: VariableId,
  direction: 'Increasing' | 'Decreasing' | 'Stable',
  significance: string,
  ratePerDecade: number,
  unit: string,
  regionName: string
): string {
  if (significance === 'Not Significant') {
    return `In ${regionName}, the system currently maintains dynamic equilibrium for this variable, exhibiting resilient inter-annual buffering against directional drift.`;
  }

  switch (variableId) {
    case 'temp_air':
    case 'lst_day':
      return direction === 'Increasing'
        ? `Sustained thermal warming (+${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) accelerates latent heat fluxes, enhances evaporation demands, and alters regional atmospheric circulation patterns.`
        : `Cooling trend reflects regional radiative forcing anomalies, cloud cover feedbacks, or aerosol dimming effects.`;

    case 'precip':
      return direction === 'Increasing'
        ? `Intensification of regional hydrological cycling (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) indicates elevated atmospheric water-holding capacity under Clausius-Clapeyron dynamics, potentially raising extreme flood frequencies.`
        : `Persistent precipitation deficit (-${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) exacerbates meteorological drought risk, vegetative moisture stress, and groundwater recharge depletion.`;

    case 'ndvi':
      return direction === 'Decreasing'
        ? `Decline in vegetation photosynthetic activity (-${Math.abs(ratePerDecade).toFixed(3)}/decade) directly tracks biomass loss, canopy fragmentation from land clearing, or severe chronic water stress.`
        : `Greenness expansion (+${Math.abs(ratePerDecade).toFixed(3)}/decade) indicates vegetative colonization, prolonged growing seasons, or agricultural intensification.`;

    case 'soil_moist':
      return direction === 'Decreasing'
        ? `Continuous root-zone desiccation (-${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) threatens agricultural yields and reduces convective precipitation recycling.`
        : `Increased soil saturation elevates flood susceptibility and shifts soil microbial respiration rates.`;

    case 'evapo':
      return direction === 'Decreasing'
        ? `Suppression of evapotranspiration reveals depleted surface water availability or reduced stomatal transpiration from forest loss.`
        : `Elevated evapotranspiration indicates increased thermal atmospheric thirst or expanded irrigated agricultural acreage.`;

    case 'aod':
      return direction === 'Increasing'
        ? `Surge in aerosol optical depth tracks intensified anthropogenic particulate emissions, biomass burning plumes, or dust storm frequency, directly impacting public respiratory health and surface solar insolation.`
        : `Declining aerosol optical depth reflects effective regional emissions reductions and cleaner atmospheric columns.`;

    case 'ozone':
      return direction === 'Decreasing'
        ? `Stratospheric ozone depletion reduces UV shielding, while tropospheric ozone declines indicate shifts in precursor nitrogen oxides and volatile organic compounds.`
        : `Elevated tropospheric ozone acts as a potent ground-level pollutant and secondary greenhouse gas.`;

    case 'pressure':
      return direction === 'Decreasing'
        ? `Barometric pressure decline (-${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) indicates intensified cyclogenesis, deepened regional thermal depressions, or poleward displacement of storm tracks.`
        : `Rising barometric pressure (+${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) reveals strengthening anticyclonic ridges, prolonged fair-weather stagnation, and subsidence drying.`;

    case 'humidity':
      return direction === 'Decreasing'
        ? `Desiccation of relative humidity (-${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) reflects atmospheric vapor pressure deficit expansion, escalating evaporative demand and wildfire fuel dryness.`
        : `Increasing relative humidity (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) amplifies heat index stress and enhances condensation potential in maritime boundary layers.`;

    case 'specific_humidity':
      return direction === 'Increasing'
        ? `Absolute moisture surge (+${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) follows thermodynamic Clausius-Clapeyron scaling (~7% per 1°C warming), enhancing total precipitable water available for extreme storm events.`
        : `Atmospheric specific humidity deficit indicates continental interior drying or shifts in maritime air mass advection.`;

    case 'wind_speed':
      return direction === 'Increasing'
        ? `Wind speed acceleration (+${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) strengthens oceanic wave mixing, dust suspension, and wind energy yields, but elevates windthrow and storm damage risk.`
        : `Surface atmospheric stilling (-${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) weakens particulate dispersion, worsening urban smog trapping and reducing surface boundary layer ventilation.`;

    case 'radiation_sw':
      return direction === 'Increasing'
        ? `Solar brightening (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) reflects reduced optical cloud thickness or declining aerosol particulate pollution, increasing daytime ground insolation.`
        : `Solar dimming (-${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) indicates elevated cloud cover reflectivity or particulate scattering from industrial emissions or biomass smoke.`;

    case 'radiation_lw':
      return direction === 'Increasing'
        ? `Amplified downward longwave irradiance (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) provides direct empirical evidence of enhanced greenhouse radiative forcing by rising carbon dioxide, methane, and water vapor.`
        : `Diminished downward thermal radiation suggests clearing low-cloud decks or decreasing boundary layer moisture.`;

    case 'albedo':
      return direction === 'Decreasing'
        ? `Surface albedo darkening (-${Math.abs(ratePerDecade).toFixed(3)}/decade) is a critical positive feedback: retreating snow and ice expose darker land/water, absorbing vastly more solar heat.`
        : `Albedo increase indicates surface snow cover expansion, glacier advance, or desertification with exposed high-reflectance mineral soils.`;

    case 'snow_depth':
      return direction === 'Decreasing'
        ? `Snowpack shrinkage (-${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) threatens downstream meltwater reservoirs, accelerates spring runoff timing, and curtails winter tourism.`
        : `Accumulating snowpack (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) reflects winter precipitation intensification in sub-freezing polar and alpine elevations.`;

    case 'snow_precip':
      return direction === 'Decreasing'
        ? `Shift from snowfall to rainfall (-${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) indicates winter isotherms climbing above freezing, reducing seasonal mountain snowpack storage.`
        : `Heightened snowfall indicates ocean warming providing extra moisture to sub-zero continental storms.`;

    case 'ozone_total':
      return direction === 'Increasing'
        ? `Total column ozone recovery (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) confirms the success of Montreal Protocol chlorofluorocarbon bans, restoring the vital UV-B shielding shield.`
        : `Total ozone column reduction indicates persistent polar vortex cold pooling or springtime catalytic halogen destruction.`;

    case 'soil_moist_top':
    case 'soil_moist_prof':
      return direction === 'Decreasing'
        ? `Soil wetness depletion (-${Math.abs(ratePerDecade).toFixed(3)}/decade) directly constrains agricultural productivity, triggers vegetative wilt, and exacerbates sensible heat flux partitioning.`
        : `Elevated soil wetness enhances root-zone water supplies but may create anaerobic root conditions or elevate groundwater tables.`;

    case 'sea_level':
      return direction === 'Increasing'
        ? `Accelerating sea level rise (+${Math.abs(ratePerDecade).toFixed(3)} ${unit}/decade) compounds coastal inundation, saltwater intrusion into aquifers, and coastal erosion from combined thermal expansion and land ice discharge.`
        : `Relative local sea level fall indicates post-glacial isostatic rebound outpacing eustatic ocean volume rise.`;

    case 'sst':
      return direction === 'Increasing'
        ? `Marine thermal accumulation (+${Math.abs(ratePerDecade).toFixed(2)} ${unit}/decade) triggers coral bleaching events, shifts fish species distributions, and fuels tropical cyclone intensification.`
        : `Marine cooling reflects localized upwelling enhancement or freshwater melt lens stratification.`;

    case 'streamflow':
      return direction === 'Decreasing'
        ? `River discharge contraction (-${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) imperils municipal water supplies, hydroelectric generation capacity, and freshwater riverine ecosystems.`
        : `Heightened river discharge (+${Math.abs(ratePerDecade).toFixed(1)} ${unit}/decade) amplifies peak flood stage hazards and sediment export to deltaic basins.`;

    case 'evi':
      return direction === 'Decreasing'
        ? `Enhanced Vegetation Index decline (-${Math.abs(ratePerDecade).toFixed(3)}/decade) indicates canopy degradation and canopy defoliation independent of soil background interference.`
        : `Enhanced Vegetation Index increase (+${Math.abs(ratePerDecade).toFixed(3)}/decade) demonstrates robust structural biomass gain and canopy leaf area index growth.`;

    default:
      return `Observed rate of change represents a measurable directional forcing on local ecological and climatic balances.`;
  }
}
