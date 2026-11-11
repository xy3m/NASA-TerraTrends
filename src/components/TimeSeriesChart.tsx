import React, { useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { EarthVariable, TimeSeriesPoint, TrendAnalysisResult } from '../types/earthScience';
import { 
  Eye, 
  EyeOff, 
  Download, 
  TrendingUp, 
  Activity, 
  Calendar,
  Layers,
  Sparkles 
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  variable: EarthVariable;
  regionName: string;
  stats: TrendAnalysisResult;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  points,
  variable,
  regionName,
  stats,
}) => {
  const chartRef = useRef<any>(null);

  // Toggle states
  const [showRaw, setShowRaw] = useState<boolean>(true);
  const [showMovingAvg, setShowMovingAvg] = useState<boolean>(true);
  const [showAnomaly, setShowAnomaly] = useState<boolean>(false);
  const [showTrend, setShowTrend] = useState<boolean>(true);
  const [showCI, setShowCI] = useState<boolean>(true);

  // Range filter
  const [timeRange, setTimeRange] = useState<'all' | '20y' | '10y'>('all');

  // Filter points based on selected range
  const filteredPoints = React.useMemo(() => {
    if (points.length === 0) return [];
    if (timeRange === '10y') {
      const minYear = points[points.length - 1].year - 10;
      return points.filter(p => p.year >= minYear);
    }
    if (timeRange === '20y') {
      const minYear = points[points.length - 1].year - 20;
      return points.filter(p => p.year >= minYear);
    }
    return points;
  }, [points, timeRange]);

  const labels = filteredPoints.map(p => p.date);

  // Datasets preparation
  const datasets: any[] = [];

  // 1. Raw Observations
  if (showRaw && !showAnomaly) {
    datasets.push({
      label: `Raw Monthly ${variable.shortName} (${variable.unit})`,
      data: filteredPoints.map(p => p.raw),
      borderColor: 'rgba(148, 163, 184, 0.45)', // muted slate
      backgroundColor: 'rgba(148, 163, 184, 0.1)',
      borderWidth: 1.2,
      pointRadius: 1,
      pointHoverRadius: 4,
      tension: 0.2,
      order: 3,
    });
  }

  // 2. 12-Month Moving Average
  if (showMovingAvg && !showAnomaly) {
    datasets.push({
      label: '12-Month Moving Average',
      data: filteredPoints.map(p => p.movingAvg),
      borderColor: variable.color || '#3B82F6',
      backgroundColor: 'transparent',
      borderWidth: 2.2,
      pointRadius: 0,
      pointHoverRadius: 5,
      tension: 0.3,
      order: 2,
    });
  }

  // 3. Deseasonalized Baseline Anomaly
  if (showAnomaly) {
    datasets.push({
      label: `Deseasonalized Anomaly (${variable.unit} from 30-yr monthly norm)`,
      data: filteredPoints.map(p => p.anomaly),
      borderColor: '#06B6D4', // cyan
      backgroundColor: 'rgba(6, 182, 212, 0.08)',
      fill: true,
      borderWidth: 2,
      pointRadius: 1.5,
      pointHoverRadius: 5,
      tension: 0.25,
      order: 2,
    });
  }

  // 4. Linear Trend Line
  if (showTrend) {
    datasets.push({
      label: `OLS Trend Line (${stats.slopePerDecade > 0 ? '+' : ''}${stats.slopePerDecade.toFixed(2)} ${variable.unit}/decade)`,
      data: filteredPoints.map(p => p.trend),
      borderColor: '#F59E0B', // amber
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      borderDash: [6, 4],
      pointRadius: 0,
      tension: 0,
      order: 1,
    });
  }

  // 5. 95% Confidence Interval Upper Bound
  if (showCI && showTrend) {
    datasets.push({
      label: '95% CI Upper Bound',
      data: filteredPoints.map(p => p.ciUpper),
      borderColor: 'transparent',
      backgroundColor: 'rgba(245, 158, 11, 0.12)', // subtle amber shading
      fill: '+1', // fill down to the next dataset (CI Lower Bound)
      pointRadius: 0,
      tension: 0,
      order: 4,
    });

    // 6. 95% Confidence Interval Lower Bound
    datasets.push({
      label: '95% CI Lower Bound',
      data: filteredPoints.map(p => p.ciLower),
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      fill: false,
      pointRadius: 0,
      tension: 0,
      order: 5,
    });
  }

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 600,
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#38bdf8',
        bodyColor: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || '';
            const val = context.parsed.y;
            if (val === null || val === undefined) return '';
            return ` ${label.split('(')[0].trim()}: ${val.toFixed(2)} ${variable.unit}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(51, 65, 85, 0.25)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          maxTicksLimit: 12,
          font: {
            family: "'JetBrains Mono', monospace",
            size: 10,
          },
        },
      },
      y: {
        grid: {
          color: 'rgba(51, 65, 85, 0.25)',
          drawBorder: false,
        },
        ticks: {
          color: '#64748b',
          font: {
            family: "'JetBrains Mono', monospace",
            size: 10,
          },
          callback: (value: any) => `${value} ${variable.unit}`,
        },
      },
    },
  };

  // Download chart as PNG image
  const handleDownloadImage = () => {
    if (chartRef.current) {
      const url = chartRef.current.toBase64Image();
      const link = document.createElement('a');
      link.download = `NASA_TerraTrends_${variable.id}_${regionName.replace(/\s+/g, '_')}.png`;
      link.href = url;
      link.click();
    }
  };

  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-6 shadow-xl space-y-4">
      {/* Top Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <span>{variable.name}</span>
              <span className="text-slate-500 font-normal">in</span>
              <span className="text-cyan-400">{regionName}</span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Missions: {variable.missions.join(' • ')} • Sampling: Monthly (1990–2024)
          </p>
        </div>

        {/* Action Buttons: Time Range & Image Download */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            <button
              onClick={() => setTimeRange('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                timeRange === 'all' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All (35y)
            </button>
            <button
              onClick={() => setTimeRange('20y')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                timeRange === '20y' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              2004–2024
            </button>
            <button
              onClick={() => setTimeRange('10y')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                timeRange === '10y' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              2014–2024
            </button>
          </div>

          <button
            onClick={handleDownloadImage}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shadow-sm"
            title="Download high-resolution chart snapshot"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export PNG</span>
          </button>
        </div>
      </div>

      {/* Interactive Layer Toggles */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
        <span className="text-slate-400 font-semibold mr-1 flex items-center space-x-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>View Layers:</span>
        </span>

        {/* Deseasonalized Anomaly Toggle */}
        <button
          onClick={() => setShowAnomaly(!showAnomaly)}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-medium transition-all ${
            showAnomaly
              ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500/30'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Deseasonalized Anomaly</span>
        </button>

        {!showAnomaly && (
          <>
            {/* Raw Observations Toggle */}
            <button
              onClick={() => setShowRaw(!showRaw)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-medium transition-all ${
                showRaw
                  ? 'bg-slate-800 border-slate-600 text-slate-200'
                  : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
              }`}
            >
              {showRaw ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Raw Seasonal Data</span>
            </button>

            {/* 12-Month Moving Avg Toggle */}
            <button
              onClick={() => setShowMovingAvg(!showMovingAvg)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-medium transition-all ${
                showMovingAvg
                  ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-1 ring-blue-500/30'
                  : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
              }`}
            >
              <Activity className="w-3 h-3" />
              <span>12-Mo Moving Avg</span>
            </button>
          </>
        )}

        {/* Linear Trend Toggle */}
        <button
          onClick={() => setShowTrend(!showTrend)}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-medium transition-all ${
            showTrend
              ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-500/30'
              : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          <span>OLS Trend Line</span>
        </button>

        {/* 95% Confidence Interval Toggle */}
        {showTrend && (
          <button
            onClick={() => setShowCI(!showCI)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg border font-medium transition-all ${
              showCI
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/30'
                : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
            }`}
          >
            <span>95% CI Band</span>
          </button>
        )}
      </div>

      {/* Main Chart Canvas */}
      <div className="relative h-72 sm:h-80 md:h-96 w-full pt-2">
        <Line ref={chartRef} data={{ labels, datasets }} options={chartOptions} />
      </div>

      {/* Deseasonalization Scientific Note */}
      {showAnomaly && (
        <div className="p-3 bg-cyan-950/30 border border-cyan-800/50 rounded-xl text-xs text-cyan-200/90 flex items-start space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong>Scientific Deseasonalization Active:</strong> Each monthly value has been subtracted from its 30-year climatological monthly baseline. This eliminates the repeating summer/winter cycle, isolating true long-term climate warming or cooling.
          </p>
        </div>
      )}
    </div>
  );
};
