import React, { useState } from 'react';
import { DataIngestion, DataColumn } from './DataIngestion';
import { AnalysisPanel, AnalysisConfig } from './AnalysisPanel';
import { ResultsView } from './ResultsView';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import {
  computeDescriptiveStats,
  computeCorrelation,
  oneSampleTTest,
  twoSampleTTest,
  oneWayAnova,
  multipleOLS,
  robustIRLS,
  pcaAnalysis,
  seasonalMannKendall,
  senSlopeExact,
  trendAcceleration,
  pettittChangePoint,
  cusumChangePoint,
  runDiagnostics,
} from '../../services/statistics';
import {
  DescriptiveStats,
  CorrelationResult,
  RegressionResult,
  PCAResult,
  ChangePointResult,
  SeasonalMKResult,
  DiagnosticResults,
} from '../../types/earthScience';
import { TTestResult, AnovaResult } from '../../services/statistics/inferential';
import { FlaskConical, Database, LineChart, ShieldCheck, Sparkles } from 'lucide-react';

export const StatisticalLab: React.FC = () => {
  const [columns, setColumns] = useState<DataColumn[]>([]);
  const [datasetName, setDatasetName] = useState<string>('No Data Loaded');
  const [activeTab, setActiveTab] = useState<'data' | 'analysis' | 'diagnostics'>('data');

  const [lastConfig, setLastConfig] = useState<AnalysisConfig | null>(null);
  const [analysisResults, setAnalysisResults] = useState<{
    descriptive?: DescriptiveStats;
    correlation?: CorrelationResult;
    correlationMatrix?: { matrix: number[][]; labels: string[] };
    ttest?: TTestResult;
    anova?: AnovaResult;
    regression?: RegressionResult;
    pca?: PCAResult;
    trend?: SeasonalMKResult & { slope: number; acceleration?: number };
    changePoint?: ChangePointResult;
  }>({});
  const [diagnosticsResult, setDiagnosticsResult] = useState<DiagnosticResults | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleDataLoaded = (cols: DataColumn[], name: string) => {
    setColumns(cols);
    setDatasetName(name);
    setActiveTab('analysis'); // Auto switch to analysis
  };

  const handleRunAnalysis = (config: AnalysisConfig) => {
    setIsRunning(true);
    setLastConfig(config);

    setTimeout(() => {
      try {
        const primaryCol = columns.find(c => c.name === config.primaryCol);
        if (!primaryCol) return;

        const primaryVals = primaryCol.values;
        const newResults: typeof analysisResults = {};

        // 1. Descriptive
        if (config.type === 'descriptive') {
          newResults.descriptive = computeDescriptiveStats(primaryVals);
          setDiagnosticsResult(runDiagnostics(primaryVals));
        }

        // 2. Correlation
        else if (config.type === 'correlation') {
          const secondaryCols = columns.filter(c => config.secondaryCols.includes(c.name));
          if (secondaryCols.length > 0) {
            newResults.correlation = computeCorrelation(primaryVals, secondaryCols[0].values);
          }

          // Full correlation matrix
          const allCols = [primaryCol, ...secondaryCols];
          const matrix: number[][] = [];
          for (let i = 0; i < allCols.length; i++) {
            const row: number[] = [];
            for (let j = 0; j < allCols.length; j++) {
              if (i === j) {
                row.push(1.0);
              } else {
                const corr = computeCorrelation(allCols[i].values, allCols[j].values);
                row.push(corr.pearsonR);
              }
            }
            matrix.push(row);
          }
          newResults.correlationMatrix = { matrix, labels: allCols.map(c => c.name) };
          setDiagnosticsResult(runDiagnostics(primaryVals));
        }

        // 3. t-Test
        else if (config.type === 'ttest') {
          const secondCol = columns.find(c => config.secondaryCols[0] === c.name);
          if (secondCol) {
            newResults.ttest = twoSampleTTest(primaryVals, secondCol.values, false, config.alpha);
          } else {
            newResults.ttest = oneSampleTTest(primaryVals, 0, config.alpha);
          }
          setDiagnosticsResult(runDiagnostics(primaryVals));
        }

        // 4. ANOVA
        else if (config.type === 'anova') {
          const allGroups = [
            primaryVals,
            ...columns.filter(c => config.secondaryCols.includes(c.name)).map(c => c.values),
          ];
          newResults.anova = oneWayAnova(allGroups);
          setDiagnosticsResult(runDiagnostics(primaryVals));
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

            setDiagnosticsResult(runDiagnostics(y, newResults.regression.residuals, X));
          }
        }

        // 6. PCA
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
          newResults.pca = pcaAnalysis(matrix, pcaCols.map(c => c.name));
          setDiagnosticsResult(runDiagnostics(primaryVals));
        }

        // 7. Trend
        else if (config.type === 'trend') {
          const mkRes = seasonalMannKendall(primaryVals, config.seasonLength, config.trendMethod);
          const slope = senSlopeExact(primaryVals);
          const accel = trendAcceleration(primaryVals);
          newResults.trend = {
            ...mkRes,
            slope,
            acceleration: accel.acceleration,
          };
          setDiagnosticsResult(runDiagnostics(primaryVals));
        }

        // 8. Change-Point
        else if (config.type === 'changepoint') {
          newResults.changePoint = pettittChangePoint(primaryVals);
          setDiagnosticsResult(runDiagnostics(primaryVals));
        }

        setAnalysisResults(newResults);
      } catch (err) {
        console.error('Analysis error:', err);
      } finally {
        setIsRunning(false);
      }
    }, 150);
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
            />
          )}
        </div>
      )}

      {/* SUBTAB 3: DIAGNOSTICS */}
      {activeTab === 'diagnostics' && diagnosticsResult && (
        <DiagnosticsPanel
          diagnostics={diagnosticsResult}
          variableName={primaryColObj?.name || 'Dataset'}
        />
      )}
    </div>
  );
};

export default StatisticalLab;
