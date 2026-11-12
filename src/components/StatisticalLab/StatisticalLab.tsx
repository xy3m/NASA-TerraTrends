import React, { useState } from 'react';
import { DataIngestion, DataColumn } from './DataIngestion';
import { AnalysisPanel, AnalysisConfig } from './AnalysisPanel';
import { ResultsView } from './ResultsView';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import {
  computeDescriptiveStats,
  computeCorrelation,
  crossCorrelationFunction,
  oneSampleTTest,
  twoSampleTTest,
  oneWayAnova,
  twoWayAnova,
  bootstrapCI,
  multipleOLS,
  robustIRLS,
  nonlinearRegression,
  pcaAnalysis,
  seasonalMannKendall,
  senSlopeExact,
  trendAcceleration,
  fitGEV,
  pettittChangePoint,
  cusumChangePoint,
  shannonEntropy,
  sampleEntropy,
  benjaminiHochberg,
  bonferroniCorrection,
  holmCorrection,
  runDiagnostics,
} from '../../services/statistics';
import { runStatsWorkerTask } from '../../workers/statsWorkerClient';
import {
  DescriptiveStats,
  CorrelationResult,
  RegressionResult,
  PCAResult,
  ChangePointResult,
  SeasonalMKResult,
  DiagnosticResults,
  TwoWayAnovaResult,
  NonlinearRegressionResult,
  GEVResult,
} from '../../types/earthScience';
import { TTestResult, AnovaResult, BootstrapResult } from '../../services/statistics/inferential';
import { MultipleTestingResult } from '../../services/statistics/fdr';
import { FlaskConical, Database, LineChart, ShieldCheck } from 'lucide-react';

export interface LabResultsBundle {
  descriptive?: DescriptiveStats;
  bootstrap?: BootstrapResult & { statLabel: 'mean' | 'median' };
  entropy?: { shannon: number; sample: number };
  correlation?: CorrelationResult;
  correlationMatrix?: { matrix: number[][]; labels: string[] };
  crossCorrelation?: { lags: number[]; values: number[]; pairLabel: string };
  correlationFDR?: {
    pairs: string[];
    rawPValues: number[];
    bh: MultipleTestingResult;
    holm: MultipleTestingResult;
    bonferroni: MultipleTestingResult;
  };
  ttest?: TTestResult;
  anova?: AnovaResult;
  twoWayAnova?: TwoWayAnovaResult;
  regression?: RegressionResult;
  nonlinear?: NonlinearRegressionResult;
  pca?: PCAResult;
  trend?: SeasonalMKResult & {
    slope: number;
    acceleration?: number;
    isAccelerating?: boolean;
    reversalPoint?: number;
  };
  gev?: GEVResult;
  changePoint?: ChangePointResult;
  cusumChangePoint?: ChangePointResult;
  fdr?: {
    items: { name: string; tau: number; z: number; rawP: number }[];
    bh: MultipleTestingResult;
    holm: MultipleTestingResult;
    bonferroni: MultipleTestingResult;
  };
  executionMeta?: {
    viaWorker: boolean;
    durationMs: number;
    tasks: string[];
  };
}

interface StatisticalLabProps {
  onSendToPhase2?: (payload: { name: string; dates: string[]; values: (number | null)[] }) => void;
}

export const StatisticalLab: React.FC<StatisticalLabProps> = ({ onSendToPhase2 }) => {
  const [columns, setColumns] = useState<DataColumn[]>([]);
  const [datasetName, setDatasetName] = useState<string>('No Data Loaded');
  const [activeTab, setActiveTab] = useState<'data' | 'analysis' | 'diagnostics'>('data');

  const [lastConfig, setLastConfig] = useState<AnalysisConfig | null>(null);
  const [analysisResults, setAnalysisResults] = useState<LabResultsBundle>({});
  const [diagnosticsResult, setDiagnosticsResult] = useState<DiagnosticResults | null>(null);
  const [outlierMethod, setOutlierMethod] = useState<'iqr' | 'zscore' | 'grubbs'>('iqr');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleDataLoaded = (cols: DataColumn[], name: string) => {
    setColumns(cols);
    setDatasetName(name);
    setActiveTab('analysis'); // Auto switch to analysis
  };

  const handleRunAnalysis = async (config: AnalysisConfig) => {
    setIsRunning(true);
    setLastConfig(config);

    try {
      const primaryCol = columns.find(c => c.name === config.primaryCol);
      if (!primaryCol) return;

      const primaryVals = primaryCol.values;
      const newResults: LabResultsBundle = {};
      let workerUsed = false;
      let totalWorkerMs = 0;
      const workerTasks: string[] = [];

      const medianFn = (arr: number[]) => {
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
      };

      // 1. Descriptive (offloaded via statsWorker: descriptive + bootstrap) + Entropy
      if (config.type === 'descriptive') {
        const [descExec, bootExec] = await Promise.all([
          runStatsWorkerTask<DescriptiveStats>(
            'descriptive',
            { values: primaryVals },
            () => computeDescriptiveStats(primaryVals)
          ),
          runStatsWorkerTask<BootstrapResult>(
            'bootstrap',
            {
              values: primaryVals,
              statFn: config.bootstrapStat,
              B: config.bootstrapIter,
              alpha: config.alpha,
            },
            () =>
              bootstrapCI(
                primaryVals,
                config.bootstrapStat === 'median' ? medianFn : undefined,
                config.bootstrapIter,
                config.alpha
              )
          ),
        ]);

        workerUsed = descExec.viaWorker || bootExec.viaWorker;
        totalWorkerMs = descExec.durationMs + bootExec.durationMs;
        workerTasks.push('descriptive', `bootstrap(B=${config.bootstrapIter})`);

        newResults.descriptive = descExec.result;
        newResults.bootstrap = { ...bootExec.result, statLabel: config.bootstrapStat };
        newResults.entropy = {
          shannon: shannonEntropy(primaryVals),
          sample: sampleEntropy(primaryVals),
        };
        setDiagnosticsResult(runDiagnostics(primaryVals));
      }

      // 2. Correlation + Cross-Correlation Function + Pairwise FDR
      else if (config.type === 'correlation') {
        const secondaryCols = columns.filter(c => config.secondaryCols.includes(c.name));
        if (secondaryCols.length > 0) {
          newResults.correlation = computeCorrelation(primaryVals, secondaryCols[0].values);
          const minLen = Math.min(primaryVals.length, secondaryCols[0].values.length);
          const maxLag = Math.min(12, Math.max(1, Math.floor(minLen / 3)));
          const ccfVals = crossCorrelationFunction(primaryVals, secondaryCols[0].values, maxLag);
          const lags = Array.from({ length: 2 * maxLag + 1 }, (_, i) => i - maxLag);
          newResults.crossCorrelation = {
            lags,
            values: ccfVals,
            pairLabel: `${primaryCol.name} vs ${secondaryCols[0].name}`,
          };
        }

        // Full correlation matrix + pairwise p-values for multiple-testing correction
        const allCols = [primaryCol, ...secondaryCols];
        const matrix: number[][] = [];
        const pairLabels: string[] = [];
        const rawPValues: number[] = [];

        for (let i = 0; i < allCols.length; i++) {
          const row: number[] = [];
          for (let j = 0; j < allCols.length; j++) {
            if (i === j) {
              row.push(1.0);
            } else {
              const corr = computeCorrelation(allCols[i].values, allCols[j].values);
              row.push(corr.pearsonR);
              if (j > i) {
                pairLabels.push(`${allCols[i].name} × ${allCols[j].name}`);
                rawPValues.push(corr.pearsonP);
              }
            }
          }
          matrix.push(row);
        }
        newResults.correlationMatrix = { matrix, labels: allCols.map(c => c.name) };
        if (rawPValues.length >= 2) {
          newResults.correlationFDR = {
            pairs: pairLabels,
            rawPValues,
            bh: benjaminiHochberg(rawPValues, config.alpha),
            holm: holmCorrection(rawPValues, config.alpha),
            bonferroni: bonferroniCorrection(rawPValues, config.alpha),
          };
        }
        setDiagnosticsResult(runDiagnostics(primaryVals));
      }

      // 3. t-Test (2-sample Welch/Paired OR 1-sample vs mu0)
      else if (config.type === 'ttest') {
        const secondCol = columns.find(c => config.secondaryCols[0] === c.name);
        if (secondCol) {
          newResults.ttest = twoSampleTTest(primaryVals, secondCol.values, config.ttestPaired, config.alpha);
        } else {
          newResults.ttest = oneSampleTTest(primaryVals, config.ttestMu0, config.alpha);
        }
        setDiagnosticsResult(runDiagnostics(primaryVals, undefined, undefined, outlierMethod));
      }

      // 4. One-Way ANOVA
      else if (config.type === 'anova') {
        const allGroups = [
          primaryVals,
          ...columns.filter(c => config.secondaryCols.includes(c.name)).map(c => c.values),
        ];
        newResults.anova = oneWayAnova(allGroups);
        setDiagnosticsResult(runDiagnostics(primaryVals, undefined, undefined, outlierMethod));
      }

      // 4b. Two-Way Factorial ANOVA (builds two median-split factors or temporal halves x seasonal halves)
      else if (config.type === 'two_way_anova') {
        const factorCols = columns.filter(c => config.secondaryCols.includes(c.name));
        const obs: { value: number; levelA: string; levelB: string }[] = [];

        if (factorCols.length >= 2) {
          const colA = factorCols[0].values;
          const colB = factorCols[1].values;
          const medA = medianFn(colA.filter(v => isFinite(v)));
          const medB = medianFn(colB.filter(v => isFinite(v)));
          for (let i = 0; i < primaryVals.length; i++) {
            if (isFinite(primaryVals[i]) && isFinite(colA[i]) && isFinite(colB[i])) {
              obs.push({
                value: primaryVals[i],
                levelA: colA[i] >= medA ? `${factorCols[0].name} High` : `${factorCols[0].name} Low`,
                levelB: colB[i] >= medB ? `${factorCols[1].name} High` : `${factorCols[1].name} Low`,
              });
            }
          }
          newResults.twoWayAnova = twoWayAnova(obs, factorCols[0].name, factorCols[1].name);
        } else {
          // Automatic epoch (Early vs Late) x Phase (Warm/Peak vs Cool/Trough) factorial design
          const half = Math.floor(primaryVals.length / 2);
          for (let i = 0; i < primaryVals.length; i++) {
            if (!isFinite(primaryVals[i])) continue;
            const mod = i % 12;
            obs.push({
              value: primaryVals[i],
              levelA: i < half ? 'Early Epoch' : 'Late Epoch',
              levelB: mod >= 3 && mod <= 8 ? 'Warm/Peak Season' : 'Cool/Shoulder Season',
            });
          }
          newResults.twoWayAnova = twoWayAnova(obs, 'Epoch Half', 'Seasonal Phase');
        }
        setDiagnosticsResult(runDiagnostics(primaryVals, undefined, undefined, outlierMethod));
      }

      // 5. Multiple Regression
      else if (config.type === 'regression') {
        const predCols = columns.filter(c => config.secondaryCols.includes(c.name));
        if (predCols.length > 0) {
          const n = primaryVals.length;
          const X: number[][] = [];
          const y: number[] = [];

          for (let i = 0; i < n; i++) {
            const row = predCols.map(c => c.values[i]);
            if (!row.some(isNaN) && !isNaN(primaryVals[i])) {
              X.push(row);
              y.push(primaryVals[i]);
            }
          }

          if (config.regressionMethod === 'robust') {
            newResults.regression = robustIRLS(X, y);
          } else {
            newResults.regression = multipleOLS(X, y);
          }

          setDiagnosticsResult(runDiagnostics(y, newResults.regression.residuals, X, outlierMethod));
        }
      }

      // 5b. Nonlinear Regression Curve Fitting (offloaded via statsWorker)
      else if (config.type === 'nonlinear') {
        const xCol = columns.find(c => config.secondaryCols[0] === c.name);
        const xVals = xCol ? xCol.values : primaryVals.map((_, idx) => idx + 1);
        const nlExec = await runStatsWorkerTask<NonlinearRegressionResult>(
          'nonlinear',
          { x: xVals, y: primaryVals, model: config.nonlinearModel },
          () => nonlinearRegression(xVals, primaryVals, config.nonlinearModel)
        );
        workerUsed = nlExec.viaWorker;
        totalWorkerMs = nlExec.durationMs;
        workerTasks.push(`nonlinear(${config.nonlinearModel})`);
        newResults.nonlinear = nlExec.result;
        setDiagnosticsResult(runDiagnostics(primaryVals, nlExec.result.residuals, undefined, outlierMethod));
      }

      // 6. PCA (offloaded via statsWorker)
      else if (config.type === 'pca') {
        const pcaCols = [primaryCol, ...columns.filter(c => config.secondaryCols.includes(c.name))];
        const n = primaryVals.length;
        const matrix: number[][] = [];
        for (let i = 0; i < n; i++) {
          const row = pcaCols.map(c => c.values[i]);
          if (!row.some(isNaN)) {
            matrix.push(row);
          }
        }
        const labels = pcaCols.map(c => c.name);
        const pcaExec = await runStatsWorkerTask<PCAResult>(
          'pca',
          { dataMatrix: matrix, labels },
          () => pcaAnalysis(matrix, labels)
        );
        workerUsed = pcaExec.viaWorker;
        totalWorkerMs = pcaExec.durationMs;
        workerTasks.push('pca');
        newResults.pca = pcaExec.result;
        setDiagnosticsResult(runDiagnostics(primaryVals));
      }

      // 7. Trend (offloaded via statsWorker: seasonalMK + theilSenFull) + Acceleration & Entropy
      else if (config.type === 'trend') {
        const times = primaryVals.map((_, i) => i);
        const [mkExec, slopeExec] = await Promise.all([
          runStatsWorkerTask<SeasonalMKResult>(
            'seasonalMK',
            {
              values: primaryVals,
              seasonLength: config.seasonLength,
              method: config.trendMethod,
            },
            () => seasonalMannKendall(primaryVals, config.seasonLength, config.trendMethod)
          ),
          runStatsWorkerTask<number>(
            'theilSenFull',
            { times, values: primaryVals },
            () => senSlopeExact(primaryVals)
          ),
        ]);

        workerUsed = mkExec.viaWorker || slopeExec.viaWorker;
        totalWorkerMs = mkExec.durationMs + slopeExec.durationMs;
        workerTasks.push('seasonalMK', 'theilSenFull');

        const accel = trendAcceleration(primaryVals);
        newResults.trend = {
          ...mkExec.result,
          slope: slopeExec.result,
          acceleration: accel.acceleration,
          isAccelerating: accel.isAccelerating,
          reversalPoint: accel.reversalPoint,
        };
        newResults.entropy = {
          shannon: shannonEntropy(primaryVals),
          sample: sampleEntropy(primaryVals),
        };
        setDiagnosticsResult(runDiagnostics(primaryVals, undefined, undefined, outlierMethod));
      }

      // 7b. Extreme Value Analysis (GEV L-Moments via statsWorker)
      else if (config.type === 'extremes') {
        const gevExec = await runStatsWorkerTask<GEVResult>(
          'gev',
          { values: primaryVals, blockSize: config.gevBlockSize },
          () => fitGEV(primaryVals, config.gevBlockSize)
        );
        workerUsed = gevExec.viaWorker;
        totalWorkerMs = gevExec.durationMs;
        workerTasks.push('gev');
        newResults.gev = gevExec.result;
        setDiagnosticsResult(runDiagnostics(primaryVals, undefined, undefined, outlierMethod));
      }

      // 8. Change-Point (Pettitt via statsWorker + CUSUM comparison)
      else if (config.type === 'changepoint') {
        const pettittExec = await runStatsWorkerTask<ChangePointResult>(
          'pettitt',
          { values: primaryVals },
          () => pettittChangePoint(primaryVals)
        );
        workerUsed = pettittExec.viaWorker;
        totalWorkerMs = pettittExec.durationMs;
        workerTasks.push('pettitt');

        newResults.changePoint = pettittExec.result;
        newResults.cusumChangePoint = cusumChangePoint(primaryVals);
        setDiagnosticsResult(runDiagnostics(primaryVals));
      }

      // 9. Multiple-Testing Correction (FDR: BH, Holm, Bonferroni across selected columns)
      else if (config.type === 'fdr') {
        const targetCols = [
          primaryCol,
          ...columns.filter(c => c.type === 'numeric' && config.secondaryCols.includes(c.name)),
        ];
        const items = targetCols.map(col => {
          const mk = seasonalMannKendall(col.values, config.seasonLength, config.trendMethod);
          return { name: col.name, tau: mk.tau, z: mk.z, rawP: mk.pValue };
        });
        const rawPValues = items.map(item => item.rawP);
        newResults.fdr = {
          items,
          bh: benjaminiHochberg(rawPValues, config.alpha),
          holm: holmCorrection(rawPValues, config.alpha),
          bonferroni: bonferroniCorrection(rawPValues, config.alpha),
        };
        setDiagnosticsResult(runDiagnostics(primaryVals));
      }

      if (workerUsed) {
        newResults.executionMeta = {
          viaWorker: true,
          durationMs: totalWorkerMs,
          tasks: workerTasks,
        };
      }

      setAnalysisResults(newResults);
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const primaryColObj = columns.find(c => c.name === lastConfig?.primaryCol);
  const secondaryColsObj = columns.filter(c => lastConfig?.secondaryCols.includes(c.name));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#030915] via-[#0B1528] to-[#030915] border border-purple-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-600 text-white shadow-md shadow-purple-600/30 flex items-center space-x-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Statistical Analysis Lab</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Non-Spatial Tabular Computing Engine
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Scientific Hypothesis Testing, Regression & Multivariate Diagnostics
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Upload or paste any tabular dataset, execute exact Student's t-tests, One-Way ANOVA, Huber Robust Regression, Seasonal Mann-Kendall, PCA, and Pettitt change-points without geographic constraints.
          </p>

          <div className="pt-1 flex items-center space-x-3 text-xs text-purple-300 font-mono">
            <span>Current: {datasetName}</span>
            <span>•</span>
            <span>{columns.length} Columns Ready</span>
          </div>
        </div>
      </div>

      {/* Internal Navigation Subtabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('data')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'data'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>1. Data Ingestion & Variables</span>
        </button>

        <button
          onClick={() => setActiveTab('analysis')}
          disabled={columns.length === 0}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'analysis'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span>2. Analysis & Visual Results</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          disabled={!diagnosticsResult}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'diagnostics'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>3. Statistical Assumptions & Diagnostics</span>
        </button>
      </div>

      {/* SUBTAB 1: DATA INGESTION */}
      {activeTab === 'data' && (
        <div className="space-y-4">
          <DataIngestion onDataLoaded={handleDataLoaded} />
        </div>
      )}

      {/* SUBTAB 2: ANALYSIS & RESULTS */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <AnalysisPanel
            columns={columns}
            onRunAnalysis={handleRunAnalysis}
            isRunning={isRunning}
          />

          {lastConfig && primaryColObj && (
            <ResultsView
              config={lastConfig}
              data={{
                primaryColName: primaryColObj.name,
                primaryValues: primaryColObj.values,
                secondaryColsData: secondaryColsObj.map(c => ({ name: c.name, values: c.values })),
              }}
              results={analysisResults}
              onSendToPhase2={
                onSendToPhase2
                  ? () => {
                      const dates = primaryColObj.values.map((_, idx) => {
                        const yr = 2000 + Math.floor(idx / 12);
                        const mo = (idx % 12) + 1;
                        return `${yr}-${String(mo).padStart(2, '0')}`;
                      });
                      onSendToPhase2({
                        name: `${datasetName} — ${primaryColObj.name}`,
                        dates,
                        values: primaryColObj.values.map(v => (isFinite(v) ? v : null)),
                      });
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* SUBTAB 3: DIAGNOSTICS */}
      {activeTab === 'diagnostics' && diagnosticsResult && (
        <DiagnosticsPanel
          diagnostics={diagnosticsResult}
          variableName={primaryColObj?.name || 'Dataset'}
          outlierMethod={outlierMethod}
          onOutlierMethodChange={(method) => {
            setOutlierMethod(method);
            if (primaryColObj) {
              setDiagnosticsResult(runDiagnostics(primaryColObj.values, undefined, undefined, method));
            }
          }}
        />
      )}
    </div>
  );
};

export default StatisticalLab;
