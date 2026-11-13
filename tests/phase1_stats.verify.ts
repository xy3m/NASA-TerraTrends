/**
 * Automated verification tests for Geo-Iris Phase 1 statistical engine upgrades.
 */
import {
  processTimeSeries,
  analyzeTrend,
  seasonalMannKendall,
  hamedRaoCorrection,
  tfpwMannKendall,
  twoWayAnova,
  nonlinearRegression,
  fitGEV,
} from '../src/services/statistics';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// 1. Missing Polar-Night Slot Preservation & Time-Axis Fidelity
{
  const raw: { date: string; value: number | null }[] = [];
  for (let i = 0; i < 60; i++) {
    const yr = 2018 + Math.floor(i / 12);
    const mo = (i % 12) + 1;
    const date = `${yr}-${String(mo).padStart(2, '0')}`;
    const seasonal = 5 * Math.sin((2 * Math.PI * (mo - 1)) / 12);
    const signal = 10 + 0.12 * (i / 12) + seasonal;
    // Inject 2 missing slots (polar night gaps)
    raw.push({ date, value: i === 12 || i === 36 ? null : Number(signal.toFixed(3)) });
  }

  const processed = processTimeSeries(raw);
  assert(processed.length === 60, 'Should preserve all 60 monthly time slots');
  assert(processed[12].raw === null && processed[12].isMissing === true, 'Slot 12 must stay null');
  assert(processed[12].movingAvg === undefined, 'Moving avg must not fabricate missing slot 12');

  const summary = analyzeTrend(processed, 'temp_air', 'Surface Temp', '°C', 'Svalbard Test', [78, 15], true);
  assert(summary.missingCount === 2, `Expected missingCount=2, got ${summary.missingCount}`);
  assert(summary.sampleCount === 58, `Expected sampleCount=58, got ${summary.sampleCount}`);
  assert(
    Math.abs(summary.slopePerDecade - 1.2) < 0.25,
    `Expected slope ~ +1.2/decade despite gaps, got ${summary.slopePerDecade}`
  );
  assert(summary.mkPValue < 0.001, `Expected highly significant trend mkPValue < 0.001, got ${summary.mkPValue}`);
  assert(summary.tPValue < 0.001, `Expected highly significant trend tPValue < 0.001, got ${summary.tPValue}`);
}

// 2. Hamed-Rao (1998) Variance Inflation & Yue et al. (2002) TFPW
{
  // Build strongly autocorrelated AR(1) stationary red-noise monthly series (rho = 0.85, zero trend)
  const redNoise: number[] = [];
  let state = 0;
  let rngState = 12345;
  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296 - 0.5;
  };
  for (let i = 0; i < 180; i++) {
    state = 0.85 * state + rand() * 2.0;
    const season = 4.0 * Math.cos((2 * Math.PI * (i % 12)) / 12);
    redNoise.push(season + state);
  }

  const mkStd = seasonalMannKendall(redNoise, 12, 'standard');
  const mkHr = hamedRaoCorrection(redNoise, 12);
  assert(
    mkHr.varS >= mkStd.varS,
    `Hamed-Rao varS (${mkHr.varS.toFixed(1)}) should inflate or preserve std varS (${mkStd.varS.toFixed(1)}) under positive AR(1)`
  );

  // Trending autocorrelated seasonal series
  const trending = redNoise.map((v, i) => v + 0.08 * i);
  const mkTfpw = tfpwMannKendall(trending, 12);
  assert(mkTfpw.z > 4 && mkTfpw.pValue < 0.001, `TFPW should detect true +0.08/mo trend (z=${mkTfpw.z})`);
}

// 3. Two-Way Factorial ANOVA
{
  const obs = [
    // Level A=North, Level B=Summer
    { levelA: 'North', levelB: 'Summer', value: 10 },
    { levelA: 'North', levelB: 'Summer', value: 11 },
    { levelA: 'North', levelB: 'Summer', value: 9 },
    // Level A=North, Level B=Winter
    { levelA: 'North', levelB: 'Winter', value: 2 },
    { levelA: 'North', levelB: 'Winter', value: 3 },
    { levelA: 'North', levelB: 'Winter', value: 1 },
    // Level A=South, Level B=Summer
    { levelA: 'South', levelB: 'Summer', value: 20 },
    { levelA: 'South', levelB: 'Summer', value: 21 },
    { levelA: 'South', levelB: 'Summer', value: 19 },
    // Level A=South, Level B=Winter (strong interaction: stays warm)
    { levelA: 'South', levelB: 'Winter', value: 19 },
    { levelA: 'South', levelB: 'Winter', value: 18 },
    { levelA: 'South', levelB: 'Winter', value: 20 },
  ];
  const anova2 = twoWayAnova(obs, 'Latitude', 'Season');
  assert(anova2.factorA.pValue < 0.001, `Factor A should be significant, p=${anova2.factorA.pValue}`);
  assert(anova2.factorB.pValue < 0.001, `Factor B should be significant, p=${anova2.factorB.pValue}`);
  assert(anova2.interaction.pValue < 0.001, `Interaction A×B should be significant, p=${anova2.interaction.pValue}`);
}

// 4. Bounded Nonlinear Regression (Quadratic, Exponential, Logistic)
{
  const x = Array.from({ length: 40 }, (_, i) => i + 1);
  const yQuad = x.map(xi => 3 - 0.5 * xi + 0.08 * xi * xi);
  const resQuad = nonlinearRegression(x, yQuad, 'quadratic');
  assert(resQuad.rSquared > 0.999, `Quadratic R² should exceed 0.999, got ${resQuad.rSquared}`);

  const yExp = x.map((_, idx) => {
    const u = idx / 39;
    return 1.5 + 2.0 * Math.exp(1.8 * u);
  });
  const resExp = nonlinearRegression(x, yExp, 'exponential');
  assert(resExp.rSquared > 0.99, `Exponential LM fit R² should exceed 0.99, got ${resExp.rSquared}`);

  const yLogi = x.map((_, idx) => {
    const u = idx / 39;
    return 5.0 + 12.0 / (1 + Math.exp(-8.0 * (u - 0.5)));
  });
  const resLogi = nonlinearRegression(x, yLogi, 'logistic');
  assert(resLogi.rSquared > 0.99, `Logistic LM fit R² should exceed 0.99, got ${resLogi.rSquared}`);
}

// 5. GEV Block-Maxima L-Moments Fit
{
  const vals: number[] = [];
  let s = 9876;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return Math.max(1e-4, Math.min(0.9999, s / 4294967296));
  };
  for (let i = 0; i < 240; i++) {
    // Gumbel-like positive shocks
    vals.push(25 + (-10) * Math.log(-Math.log(rnd())));
  }
  const gev = fitGEV(vals, 12);
  assert(gev.blockMaxima.length === 20, `Expected 20 annual block maxima, got ${gev.blockMaxima.length}`);
  assert(gev.scaleSigma > 0 && isFinite(gev.shapeXi), 'GEV scale & shape must be valid');
  for (let i = 1; i < gev.returnLevels.length; i++) {
    assert(
      gev.returnLevels[i].level >= gev.returnLevels[i - 1].level,
      'GEV return levels must increase monotonically with return period'
    );
  }
}

console.log('ALL_PHASE1_STATISTICS_TESTS_PASSED');
