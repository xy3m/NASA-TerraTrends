import React, { useEffect, useMemo, useState } from 'react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import {
  Activity,
  BrainCircuit,
  Waves,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  phase2Api,
  Phase2SeriesHandoff,
  SarimaResponse,
  BayesianMcmcResponse,
  ExtremeValueResponse,
} from '../../services/phase2Api';
import { PROVENANCE_META } from '../../types/earthScience';
import {
  BenchmarkSeriesPresetId,
  buildBenchmarkSeries,
  InfoBanner,
  MetricTile,
  Phase2ErrorAlert,
} from './shared';

interface ForecastMcmcPanelProps {
  handoffSeries?: Phase2SeriesHandoff | null;
  onClearHandoff?: () => void;
}

type SubEngine = 'sarima' | 'mcmc' | 'extremes';

const DARK_SCALES = {
  x: {
    ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
    grid: { color: 'rgba(148, 163, 184, 0.08)' },
  },
  y: {
    ticks: { color: '#94a3b8' },
    grid: { color: 'rgba(148, 163, 184, 0.1)' },
  },
};

export const ForecastMcmcPanel: React.FC<ForecastMcmcPanelProps> = ({
  handoffSeries,
  onClearHandoff,
}) => {
  const [subEngine, setSubEngine] = useState<SubEngine>('sarima');
  const [presetId, setPresetId] = useState<BenchmarkSeriesPresetId>('arctic_temp');

  const activeSeries: Phase2SeriesHandoff = useMemo(() => {
    if (handoffSeries && handoffSeries.dates.length >= 24) {
      return handoffSeries;
    }
    return buildBenchmarkSeries(presetId);
  }, [handoffSeries, presetId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // SARIMA config & state
  const [forecastSteps, setForecastSteps] = useState(12);
  const [seasonalPeriod, setSeasonalPeriod] = useState(12);
  const [autoOrder, setAutoOrder] = useState(true);
  const [manualOrder, setManualOrder] = useState<[number, number, number]>([1, 1, 1]);
  const [manualSeasonal, setManualSeasonal] = useState<[number, number, number, number]>([1, 0, 1, 12]);
  const [holdoutSize, setHoldoutSize] = useState(6);
  const [sarimaRes, setSarimaRes] = useState<SarimaResponse | null>(null);

  // Bayesian MCMC config & state
  const [mcmcModel, setMcmcModel] = useState<'robust_ar1' | 'changepoint'>('robust_ar1');
  const [mcmcChains, setMcmcChains] = useState(3);
  const [mcmcDraws, setMcmcDraws] = useState(900);
  const [mcmcRes, setMcmcRes] = useState<BayesianMcmcResponse | null>(null);

  // Extreme Value config & state
  const [evtMode, setEvtMode] = useState<'gev_block_maxima' | 'gpd_pot'>('gev_block_maxima');
  const [blockSize, setBlockSize] = useState(12);
  const [thresholdQuantile, setThresholdQuantile] = useState(0.85);
  const [evtRes, setEvtRes] = useState<ExtremeValueResponse | null>(null);

  // Auto-run active sub-engine when series changes cleanly
  const runActiveEngine = async (engine: SubEngine = subEngine) => {
    setLoading(true);
    setError(null);
    try {
      if (engine === 'sarima') {
        const res = await phase2Api.runSarima({
          dates: activeSeries.dates,
          values: activeSeries.values,
          forecast_steps: forecastSteps,
          seasonal_period: seasonalPeriod,
          auto_order: autoOrder,
          order: manualOrder,
          seasonal_order: [manualSeasonal[0], manualSeasonal[1], manualSeasonal[2], seasonalPeriod],
          holdout_size: holdoutSize,
          variable_name: activeSeries.title,
        });
        setSarimaRes(res);
      } else if (engine === 'mcmc') {
        const res = await phase2Api.runBayesianMcmc({
          dates: activeSeries.dates,
          values: activeSeries.values,
          model_type: mcmcModel,
          chains: mcmcChains,
          draws: mcmcDraws,
          burn_in: Math.max(200, Math.floor(mcmcDraws / 2)),
        });
        setMcmcRes(res);
      } else {
        const res = await phase2Api.runExtremeValue({
          dates: activeSeries.dates,
          values: activeSeries.values,
          mode: evtMode,
          block_size: blockSize,
          threshold_quantile: thresholdQuantile,
        });
        setEvtRes(res);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runActiveEngine(subEngine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeries, subEngine]);

  const provMeta = PROVENANCE_META[activeSeries.provenanceTier ?? 'synthetic_demo'];
  const validCount = activeSeries.values.filter((v) => v !== null && Number.isFinite(v)).length;

  return (
    <div className="space-y-4">
      {/* Active Time Series Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white">{activeSeries.title}</span>
            {activeSeries.regionName && (
              <span className="text-xs font-mono text-cyan-300 px-2 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-500/30">
                {activeSeries.regionName}
              </span>
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950 border border-slate-800 ${provMeta.colorClass}`}>
              {provMeta.icon} {provMeta.shortLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-1">
            {activeSeries.dates[0]} to {activeSeries.dates[activeSeries.dates.length - 1]} &middot;{' '}
            {validCount} valid / {activeSeries.values.length} slots &middot; Unit: {activeSeries.unit || 'native'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {handoffSeries ? (
            <button
              onClick={onClearHandoff}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 cursor-pointer"
            >
              Reset to Phase 2 Benchmarks
            </button>
          ) : (
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value as BenchmarkSeriesPresetId)}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="arctic_temp">Benchmark: Arctic Temperature (+Missing Gaps)</option>
              <option value="co2_seasonal">Benchmark: Atmospheric Column Record</option>
              <option value="extreme_precip">Benchmark: Heavy-Tailed Extreme Precipitation</option>
            </select>
          )}
        </div>
      </div>

      {/* Sub-Engine Navigation */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            id: 'sarima' as const,
            label: 'SARIMA Forecast & STL Decomposition',
            icon: Activity,
            accent: 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200',
          },
          {
            id: 'mcmc' as const,
            label: 'Bayesian Adaptive MCMC & Changepoint',
            icon: BrainCircuit,
            accent: 'border-purple-500/60 bg-purple-950/40 text-purple-200',
          },
          {
            id: 'extremes' as const,
            label: 'Extreme Value (GEV Block Maxima & GPD POT)',
            icon: Waves,
            accent: 'border-amber-500/60 bg-amber-950/40 text-amber-200',
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subEngine === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubEngine(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                active
                  ? tab.accent
                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <Phase2ErrorAlert error={error} onRetry={() => void runActiveEngine(subEngine)} />

      {/* ================================================================= */}
      {/* SUB-TAB 1: SARIMA FORECASTING & DECOMPOSITION                      */}
      {/* ================================================================= */}
      {subEngine === 'sarima' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Order Selection</span>
              <select
                value={autoOrder ? 'auto' : 'manual'}
                onChange={(e) => setAutoOrder(e.target.value === 'auto')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="auto">Auto-AIC Search</option>
                <option value="manual">Manual (p,d,q)(P,D,Q,s)</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Horizon (steps)</span>
              <input
                type="number"
                min={3}
                max={48}
                value={forecastSteps}
                onChange={(e) => setForecastSteps(Math.max(3, Math.min(48, Number(e.target.value) || 12)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Seasonal Period (s)</span>
              <input
                type="number"
                min={1}
                max={24}
                value={seasonalPeriod}
                onChange={(e) => setSeasonalPeriod(Math.max(1, Math.min(24, Number(e.target.value) || 12)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Holdout Backtest</span>
              <input
                type="number"
                min={0}
                max={24}
                value={holdoutSize}
                onChange={(e) => setHoldoutSize(Math.max(0, Math.min(24, Number(e.target.value) || 0)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>

            {!autoOrder && (
              <label className="text-[11px] text-slate-300 space-y-1">
                <span className="block text-slate-400 font-semibold">(p,d,q) / (P,D,Q)</span>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={manualOrder.join(',')}
                    onChange={(e) => {
                      const parts = e.target.value.split(',').map((n) => Number(n.trim()) || 0);
                      if (parts.length === 3) setManualOrder([parts[0], parts[1], parts[2]]);
                    }}
                    className="w-1/2 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={`${manualSeasonal[0]},${manualSeasonal[1]},${manualSeasonal[2]}`}
                    onChange={(e) => {
                      const parts = e.target.value.split(',').map((n) => Number(n.trim()) || 0);
                      if (parts.length === 3) setManualSeasonal([parts[0], parts[1], parts[2], seasonalPeriod]);
                    }}
                    className="w-1/2 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                  />
                </div>
              </label>
            )}

            <button
              onClick={() => void runActiveEngine('sarima')}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run SARIMAX
            </button>
          </div>

          {sarimaRes && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricTile
                  label="Selected Spec"
                  value={`(${sarimaRes.selected_order.join(',')})×(${sarimaRes.selected_seasonal_order.join(',')})`}
                  accent="text-cyan-300"
                />
                <MetricTile label="AIC / BIC" value={`${sarimaRes.aic} / ${sarimaRes.bic}`} />
                <MetricTile
                  label="Holdout RMSE"
                  value={sarimaRes.holdout ? sarimaRes.holdout.rmse.toFixed(3) : 'N/A'}
                  sub={sarimaRes.holdout ? `MAE: ${sarimaRes.holdout.mae.toFixed(3)}` : 'Enable holdout > 2'}
                  accent="text-emerald-300"
                />
                <MetricTile
                  label="Ljung-Box White Noise"
                  value={sarimaRes.diagnostics.ljung_box_p !== null ? `p = ${sarimaRes.diagnostics.ljung_box_p.toFixed(3)}` : 'N/A'}
                  sub={
                    sarimaRes.diagnostics.ljung_box_p !== null
                      ? sarimaRes.diagnostics.ljung_box_p > 0.05
                        ? 'Independent residuals'
                        : 'Residual autocorr remains'
                      : undefined
                  }
                  accent={
                    sarimaRes.diagnostics.ljung_box_p && sarimaRes.diagnostics.ljung_box_p > 0.05
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }
                />
                <MetricTile
                  label="Shapiro Normality"
                  value={sarimaRes.diagnostics.shapiro_p !== null ? `p = ${sarimaRes.diagnostics.shapiro_p.toFixed(3)}` : 'N/A'}
                />
                <MetricTile
                  label="Missing Slots Preserved"
                  value={sarimaRes.n_missing}
                  sub={`Out of ${sarimaRes.n_total} steps`}
                />
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs font-bold text-slate-200 mb-3">
                  SARIMAX State-Space Kalman Fit &amp; Multi-Step Forecast Envelope (80% &amp; 95% Prediction Intervals)
                </div>
                <div className="h-80">
                  <Line
                    data={{
                      labels: [
                        ...sarimaRes.historical_dates,
                        ...sarimaRes.forecast.map((f) => f.date),
                      ],
                      datasets: [
                        {
                          label: 'Observed',
                          data: [
                            ...sarimaRes.observed,
                            ...sarimaRes.forecast.map(() => null),
                          ],
                          borderColor: '#38bdf8',
                          backgroundColor: 'rgba(56, 189, 248, 0.12)',
                          pointRadius: 1.5,
                          borderWidth: 1.8,
                          spanGaps: false,
                        },
                        {
                          label: 'Kalman In-Sample Fit',
                          data: [
                            ...sarimaRes.fitted,
                            ...sarimaRes.forecast.map(() => null),
                          ],
                          borderColor: '#a855f7',
                          borderDash: [4, 3],
                          pointRadius: 0,
                          borderWidth: 1.4,
                          spanGaps: false,
                        },
                        {
                          label: 'Forecast Mean',
                          data: [
                            ...sarimaRes.observed.slice(0, -1).map(() => null),
                            sarimaRes.observed[sarimaRes.observed.length - 1],
                            ...sarimaRes.forecast.map((f) => f.mean),
                          ],
                          borderColor: '#f59e0b',
                          pointRadius: 2.5,
                          borderWidth: 2.4,
                        },
                        {
                          label: '95% Upper CI',
                          data: [
                            ...sarimaRes.observed.map(() => null),
                            ...sarimaRes.forecast.map((f) => f.ci95_upper),
                          ],
                          borderColor: 'rgba(245, 158, 11, 0.25)',
                          backgroundColor: 'rgba(245, 158, 11, 0.14)',
                          pointRadius: 0,
                          borderWidth: 1,
                          fill: '+1',
                        },
                        {
                          label: '95% Lower CI',
                          data: [
                            ...sarimaRes.observed.map(() => null),
                            ...sarimaRes.forecast.map((f) => f.ci95_lower),
                          ],
                          borderColor: 'rgba(245, 158, 11, 0.25)',
                          pointRadius: 0,
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                      scales: DARK_SCALES,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sarimaRes.decomposition && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                    <div className="text-xs font-bold text-slate-200 mb-2">
                      Additive Seasonal Decomposition (Trend &amp; Seasonal Cycle)
                    </div>
                    <div className="h-56">
                      <Line
                        data={{
                          labels: sarimaRes.historical_dates,
                          datasets: [
                            {
                              label: 'Secular Trend',
                              data: sarimaRes.decomposition.trend,
                              borderColor: '#10b981',
                              pointRadius: 0,
                              borderWidth: 2,
                            },
                            {
                              label: 'Residual Anomaly',
                              data: sarimaRes.decomposition.residual,
                              borderColor: '#f43f5e',
                              pointRadius: 0,
                              borderWidth: 1.2,
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                          scales: DARK_SCALES,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Candidate SARIMA AIC / BIC Ranking &amp; Forecast Tail
                  </div>
                  <table className="w-full text-[11px] font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-1.5 pr-3">Model Spec</th>
                        <th className="py-1.5 pr-3">AIC</th>
                        <th className="py-1.5 pr-3">BIC</th>
                        <th className="py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sarimaRes.model_candidates.map((cand, idx) => (
                        <tr key={idx} className="border-b border-slate-800/50 text-slate-300">
                          <td className="py-1.5 pr-3">
                            ({cand.order.join(',')})&times;({cand.seasonal_order.join(',')})
                          </td>
                          <td className="py-1.5 pr-3">{cand.aic.toFixed(2)}</td>
                          <td className="py-1.5 pr-3">{cand.bic.toFixed(2)}</td>
                          <td className="py-1.5">
                            {idx === 0 ? (
                              <span className="text-emerald-400 font-bold">Selected</span>
                            ) : (
                              <span className="text-slate-500">Evaluated</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 2: BAYESIAN MCMC (ADAPTIVE METROPOLIS-WITHIN-GIBBS)        */}
      {/* ================================================================= */}
      {subEngine === 'mcmc' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1 col-span-2 sm:col-span-2">
              <span className="block text-slate-400 font-semibold">Hierarchical Model Specification</span>
              <select
                value={mcmcModel}
                onChange={(e) => setMcmcModel(e.target.value as 'robust_ar1' | 'changepoint')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="robust_ar1">Robust Student-t (df=5) Deseasonalized AR(1)</option>
                <option value="changepoint">Piecewise Structural Change-Point Hinge</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Chains</span>
              <select
                value={mcmcChains}
                onChange={(e) => setMcmcChains(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              >
                <option value={2}>2 Chains</option>
                <option value={3}>3 Chains</option>
                <option value={4}>4 Chains</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Draws / Chain</span>
              <select
                value={mcmcDraws}
                onChange={(e) => setMcmcDraws(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              >
                <option value={600}>600</option>
                <option value={900}>900</option>
                <option value={1500}>1500</option>
              </select>
            </label>

            <button
              onClick={() => void runActiveEngine('mcmc')}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Sample Posteriori
            </button>
          </div>

          <InfoBanner>
            Uses multi-chain Component-wise Adaptive Metropolis-within-Gibbs MCMC in NumPy/SciPy to quantify exact
            parameter credible intervals (95% HDI), Gelman-Rubin split-R&#770;, and bulk Effective Sample Size (ESS).
          </InfoBanner>

          {mcmcRes && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricTile
                  label="Convergence Diagnostic"
                  value={mcmcRes.diagnostics.converged ? 'R̂ < 1.05 PASS' : 'Check Chains'}
                  sub={`Accept rate: ${(mcmcRes.diagnostics.mean_acceptance_rate * 100).toFixed(1)}%`}
                  accent={mcmcRes.diagnostics.converged ? 'text-emerald-300' : 'text-amber-300'}
                />
                <MetricTile
                  label="Prob. of Direction (PD)"
                  value={`${(mcmcRes.probability_of_direction.certainty * 100).toFixed(1)}%`}
                  sub={`P(>0)=${(mcmcRes.probability_of_direction.p_positive * 100).toFixed(1)}% · ${mcmcRes.probability_of_direction.direction}`}
                  accent="text-purple-300"
                />
                {mcmcRes.parameters.slope_per_decade ? (
                  <MetricTile
                    label="Posterior Slope / Decade"
                    value={`${mcmcRes.parameters.slope_per_decade.mean > 0 ? '+' : ''}${mcmcRes.parameters.slope_per_decade.mean.toFixed(3)}`}
                    sub={`95% HDI [${mcmcRes.parameters.slope_per_decade.hdi_95_low.toFixed(3)}, ${mcmcRes.parameters.slope_per_decade.hdi_95_high.toFixed(3)}]`}
                    accent="text-cyan-300"
                  />
                ) : (
                  <MetricTile
                    label="Changepoint Date (τ)"
                    value={mcmcRes.estimated_changepoint_date || 'N/A'}
                    sub={`Fraction: ${mcmcRes.parameters.changepoint_fraction?.median.toFixed(2) ?? ''}`}
                    accent="text-cyan-300"
                  />
                )}
                <MetricTile
                  label={mcmcRes.parameters.ar1_rho ? 'AR(1) Persistence (ρ)' : 'Post-Break Slope/yr'}
                  value={
                    mcmcRes.parameters.ar1_rho
                      ? mcmcRes.parameters.ar1_rho.mean.toFixed(3)
                      : mcmcRes.parameters.post_slope_per_year?.mean.toFixed(4) ?? 'N/A'
                  }
                />
                <MetricTile
                  label="Total Posterior Draws"
                  value={mcmcRes.diagnostics.chains * mcmcRes.diagnostics.draws_per_chain}
                  sub={`${mcmcRes.n_valid} valid time steps`}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Posterior Predictive Mean &amp; 95% Credible Envelope
                  </div>
                  <div className="h-72">
                    <Line
                      data={{
                        labels: mcmcRes.valid_dates,
                        datasets: [
                          {
                            label: 'Observed (Valid)',
                            data: mcmcRes.observed_valid,
                            borderColor: 'rgba(148, 163, 184, 0.55)',
                            pointRadius: 1.4,
                            borderWidth: 1.2,
                          },
                          {
                            label: 'Posterior Mean',
                            data: mcmcRes.predictive_trend.mean,
                            borderColor: '#c084fc',
                            pointRadius: 0,
                            borderWidth: 2.3,
                          },
                          {
                            label: '95% Credible Upper',
                            data: mcmcRes.predictive_trend.ci95_high,
                            borderColor: 'rgba(192, 132, 252, 0.25)',
                            backgroundColor: 'rgba(192, 132, 252, 0.16)',
                            pointRadius: 0,
                            borderWidth: 1,
                            fill: '+1',
                          },
                          {
                            label: '95% Credible Lower',
                            data: mcmcRes.predictive_trend.ci95_low,
                            borderColor: 'rgba(192, 132, 252, 0.25)',
                            pointRadius: 0,
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                        scales: DARK_SCALES,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    {mcmcRes.model_type === 'robust_ar1'
                      ? 'Posterior Density of Decadal Slope (unit/decade)'
                      : 'Posterior Density of Decadal Slope Shift Δ'}
                  </div>
                  <div className="h-72">
                    <Bar
                      data={{
                        labels: mcmcRes.posterior_histogram_decade.centers.map((c) => c.toFixed(2)),
                        datasets: [
                          {
                            label: 'Posterior Density',
                            data: mcmcRes.posterior_histogram_decade.density,
                            backgroundColor: 'rgba(168, 85, 247, 0.65)',
                            borderColor: '#c084fc',
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                        scales: DARK_SCALES,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    MCMC Multi-Chain Mixing Traces (Decadal Slope Draws)
                  </div>
                  <div className="h-56">
                    <Line
                      data={{
                        labels: mcmcRes.traces_slope_decade[0]?.map((_, i) => String(i + 1)) || [],
                        datasets: mcmcRes.traces_slope_decade.map((trace, cIdx) => {
                          const colors = ['#38bdf8', '#c084fc', '#10b981', '#f59e0b'];
                          return {
                            label: `Chain ${cIdx + 1}`,
                            data: trace,
                            borderColor: colors[cIdx % colors.length],
                            borderWidth: 1.2,
                            pointRadius: 0,
                          };
                        }),
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                        scales: DARK_SCALES,
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Posterior Parameter Summary &amp; Gelman-Rubin Convergence
                  </div>
                  <table className="w-full text-[11px] font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-1.5 pr-3">Parameter</th>
                        <th className="py-1.5 pr-3">Mean &plusmn; SD</th>
                        <th className="py-1.5 pr-3">95% HDI</th>
                        <th className="py-1.5 pr-3">Split-R&#770;</th>
                        <th className="py-1.5">ESS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(mcmcRes.parameters).map(([key, stat]) => (
                        <tr key={key} className="border-b border-slate-800/50 text-slate-200">
                          <td className="py-1.5 pr-3 text-cyan-300">{key}</td>
                          <td className="py-1.5 pr-3">
                            {stat.mean.toFixed(4)} &plusmn; {stat.sd.toFixed(4)}
                          </td>
                          <td className="py-1.5 pr-3">
                            [{stat.hdi_95_low.toFixed(3)}, {stat.hdi_95_high.toFixed(3)}]
                          </td>
                          <td className="py-1.5 pr-3">
                            <span
                              className={`inline-flex items-center gap-1 ${
                                stat.r_hat <= 1.05 ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {stat.r_hat <= 1.05 ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <AlertCircle className="w-3 h-3" />
                              )}
                              {stat.r_hat.toFixed(3)}
                            </span>
                          </td>
                          <td className="py-1.5">{Math.round(stat.ess)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUB-TAB 3: EXTREME VALUE THEORY (GEV / GPD)                       */}
      {/* ================================================================= */}
      {subEngine === 'extremes' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">EVT Framework</span>
              <select
                value={evtMode}
                onChange={(e) => setEvtMode(e.target.value as 'gev_block_maxima' | 'gpd_pot')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="gev_block_maxima">GEV Block Maxima</option>
                <option value="gpd_pot">GPD Peaks-Over-Threshold (POT)</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">
                {evtMode === 'gev_block_maxima' ? 'Block Size (steps)' : 'Periods / Block'}
              </span>
              <input
                type="number"
                min={2}
                max={36}
                value={blockSize}
                onChange={(e) => setBlockSize(Math.max(2, Math.min(36, Number(e.target.value) || 12)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">POT Threshold Quantile</span>
              <input
                type="number"
                step={0.05}
                min={0.55}
                max={0.95}
                disabled={evtMode !== 'gpd_pot'}
                value={thresholdQuantile}
                onChange={(e) => setThresholdQuantile(Math.min(0.95, Math.max(0.55, Number(e.target.value) || 0.85)))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono disabled:opacity-40"
              />
            </label>

            <button
              onClick={() => void runActiveEngine('extremes')}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Fit Return Levels
            </button>
          </div>

          {evtRes && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricTile
                  label="Tail Family"
                  value={evtRes.family_classification}
                  sub={`Samples fitted: ${evtRes.n_samples}`}
                  accent="text-amber-300"
                />
                <MetricTile
                  label="Shape Parameter (ξ)"
                  value={evtRes.parameters.shape_xi?.toFixed(4) ?? '0'}
                  accent="text-cyan-300"
                />
                <MetricTile
                  label={evtRes.mode === 'gev_block_maxima' ? 'Location (μ)' : 'Threshold (u)'}
                  value={(evtRes.parameters.location_mu ?? evtRes.parameters.location_u ?? 0).toFixed(3)}
                />
                <MetricTile
                  label="Scale (σ)"
                  value={(evtRes.parameters.scale_sigma ?? 0).toFixed(3)}
                />
                <MetricTile
                  label="KS Goodness-of-Fit"
                  value={`p = ${evtRes.goodness_of_fit.ks_p_value.toFixed(3)}`}
                  sub={`D = ${evtRes.goodness_of_fit.ks_statistic.toFixed(3)}`}
                  accent={evtRes.goodness_of_fit.ks_p_value > 0.05 ? 'text-emerald-300' : 'text-amber-300'}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Return-Period Curve (Model Fit, 95% Parametric Bootstrap CI &amp; Empirical Gringorten Points)
                  </div>
                  <div className="h-72">
                    <Scatter
                      data={{
                        datasets: [
                          {
                            label: 'Empirical Extremes',
                            data: evtRes.empirical_return_plot.map((p) => ({
                              x: p.return_period,
                              y: p.value,
                            })),
                            backgroundColor: '#38bdf8',
                            pointRadius: 4,
                          },
                          {
                            label: 'MLE Return Level',
                            data: evtRes.return_levels.map((r) => ({
                              x: r.return_period,
                              y: r.return_level,
                            })),
                            borderColor: '#f59e0b',
                            backgroundColor: '#f59e0b',
                            showLine: true,
                            pointRadius: 4,
                            borderWidth: 2.2,
                          },
                          {
                            label: '95% Upper Bound',
                            data: evtRes.return_levels
                              .filter((r) => r.ci95_high !== null)
                              .map((r) => ({ x: r.return_period, y: r.ci95_high as number })),
                            borderColor: 'rgba(245, 158, 11, 0.35)',
                            borderDash: [4, 4],
                            showLine: true,
                            pointRadius: 0,
                          },
                          {
                            label: '95% Lower Bound',
                            data: evtRes.return_levels
                              .filter((r) => r.ci95_low !== null)
                              .map((r) => ({ x: r.return_period, y: r.ci95_low as number })),
                            borderColor: 'rgba(245, 158, 11, 0.35)',
                            borderDash: [4, 4],
                            showLine: true,
                            pointRadius: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                        scales: {
                          x: {
                            type: 'logarithmic',
                            title: { display: true, text: 'Return Period (years / blocks)', color: '#94a3b8' },
                            ticks: { color: '#94a3b8' },
                            grid: { color: 'rgba(148, 163, 184, 0.1)' },
                          },
                          y: DARK_SCALES.y,
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Projected Extremes by Return Period
                  </div>
                  <table className="w-full text-[11px] font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-1.5 pr-3">Return Period (T)</th>
                        <th className="py-1.5 pr-3">Annual Exceedance Prob</th>
                        <th className="py-1.5 pr-3">Return Level</th>
                        <th className="py-1.5">95% Bootstrap CI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evtRes.return_levels.map((row) => (
                        <tr key={row.return_period} className="border-b border-slate-800/50 text-slate-200">
                          <td className="py-1.5 pr-3 text-amber-300 font-bold">{row.return_period}-yr</td>
                          <td className="py-1.5 pr-3">{(100 / row.return_period).toFixed(1)}%</td>
                          <td className="py-1.5 pr-3 font-bold">{row.return_level.toFixed(3)}</td>
                          <td className="py-1.5 text-slate-400">
                            {row.ci95_low !== null && row.ci95_high !== null
                              ? `[${row.ci95_low.toFixed(2)}, ${row.ci95_high.toFixed(2)}]`
                              : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
