import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { AlertTriangle, Terminal, Info } from 'lucide-react';
import { PROVENANCE_META } from '../../types/earthScience';
import { BackendProvenance, Phase2OfflineError, Phase2SeriesHandoff } from '../../services/phase2Api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const ProvenanceBanner: React.FC<{ provenance: BackendProvenance }> = ({ provenance }) => {
  const meta = PROVENANCE_META[provenance.tier] ?? PROVENANCE_META.synthetic_demo;
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
        provenance.tier === 'satellite_observation'
          ? 'bg-emerald-950/35 border-emerald-500/35 text-emerald-200'
          : provenance.tier === 'user_upload'
          ? 'bg-amber-950/35 border-amber-500/35 text-amber-200'
          : provenance.tier === 'reanalysis_model'
          ? 'bg-cyan-950/35 border-cyan-500/35 text-cyan-200'
          : 'bg-slate-900/90 border-slate-700 text-slate-300'
      }`}
    >
      <div className="flex items-start sm:items-center gap-2.5">
        <span className="text-base leading-none mt-0.5 sm:mt-0">{meta.icon}</span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-bold uppercase tracking-wider text-[10px] ${meta.colorClass}`}>
              {meta.shortLabel}
            </span>
            <span className="font-semibold text-white">{provenance.source_name}</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950/70 border border-slate-800 text-slate-400">
              {provenance.dataset_id}
            </span>
            {provenance.is_live && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE API
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-300/90 mt-0.5">{provenance.status_message}</p>
        </div>
      </div>
      {provenance.citation && (
        <span className="text-[10px] text-slate-400 font-mono">{provenance.citation}</span>
      )}
    </div>
  );
};

export const Phase2ErrorAlert: React.FC<{
  error: unknown;
  onRetry?: () => void;
}> = ({ error, onRetry }) => {
  if (!error) return null;
  const isOffline = error instanceof Phase2OfflineError;
  const msg = error instanceof Error ? error.message : String(error);

  return (
    <div
      className={`rounded-xl border p-4 text-xs space-y-2 ${
        isOffline
          ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
          : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {isOffline ? (
            <Terminal className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm">
              {isOffline ? 'Python Compute Backend Offline' : 'Computation Error'}
            </div>
            <p className="mt-1 leading-relaxed text-slate-200/90">{msg}</p>
          </div>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold shrink-0 cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
      {isOffline && (
        <div className="rounded-lg bg-slate-950/90 border border-slate-800 p-2.5 font-mono text-[11px] text-cyan-300">
          cd backend &amp;&amp; pip install -r requirements.txt &amp;&amp; uvicorn app.main:app --reload --port 8000
        </div>
      )}
    </div>
  );
};

export const MetricTile: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  title?: string;
}> = ({ label, value, sub, accent = 'text-white', title }) => (
  <div
    title={title}
    className="bg-slate-950/75 border border-slate-800 rounded-xl p-3 flex flex-col justify-between"
  >
    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
      {label}
    </span>
    <div className={`text-lg font-black font-mono mt-1 ${accent}`}>{value}</div>
    {sub && <span className="text-[10px] text-slate-500 mt-0.5 font-mono">{sub}</span>}
  </div>
);

export const InfoBanner: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-3.5 py-2.5 text-[11px] text-slate-300 flex items-start gap-2">
    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
    <div>{children}</div>
  </div>
);

export type BenchmarkSeriesPresetId = 'arctic_temp' | 'co2_seasonal' | 'extreme_precip';

export function buildBenchmarkSeries(preset: BenchmarkSeriesPresetId): Phase2SeriesHandoff {
  const dates: string[] = [];
  const values: (number | null)[] = [];
  const startYear = 2012;
  const totalMonths = 144; // 12 years monthly

  // Deterministic pseudo-random helper so results are reproducible
  let seed = preset === 'arctic_temp' ? 17 : preset === 'co2_seasonal' ? 31 : 73;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };

  for (let i = 0; i < totalMonths; i++) {
    const year = startYear + Math.floor(i / 12);
    const month = (i % 12) + 1;
    dates.push(`${year}-${String(month).padStart(2, '0')}`);
    const tYr = i / 12;

    if (preset === 'arctic_temp') {
      // Polar amplification with 2019 acceleration & occasional missing satellite gaps
      const postBreak = Math.max(0, tYr - 6.5);
      const val =
        -11.8 +
        0.095 * tYr +
        0.08 * postBreak +
        11.2 * Math.sin((2 * Math.PI * (month - 4)) / 12) +
        nextRand() * 2.1;
      values.push(i === 52 || i === 109 ? null : Number(val.toFixed(2)));
    } else if (preset === 'co2_seasonal') {
      const val =
        393.5 +
        2.35 * tYr +
        0.025 * tYr * tYr +
        3.4 * Math.sin((2 * Math.PI * (month - 2)) / 12) +
        nextRand() * 0.7;
      values.push(Number(val.toFixed(2)));
    } else {
      // Heavy-tailed extreme monthly rainfall index (mm/day max)
      const u = Math.max(0.02, 0.5 + nextRand());
      const burst = u < 0.09 ? 38.0 / (u * 8.0) : 0;
      const val =
        42.0 +
        1.1 * tYr +
        26.0 * Math.max(0, Math.sin((2 * Math.PI * (month - 11)) / 12)) +
        burst +
        Math.abs(nextRand()) * 14.0;
      values.push(Number(val.toFixed(2)));
    }
  }

  const meta: Record<BenchmarkSeriesPresetId, { title: string; unit: string; regionName: string }> = {
    arctic_temp: {
      title: 'Arctic Shelf Surface Temperature Benchmark',
      unit: '°C',
      regionName: 'Svalbard / Barents Sea (Benchmark)',
    },
    co2_seasonal: {
      title: 'Global Atmospheric Column Benchmark',
      unit: 'ppm',
      regionName: 'Mauna Loa Baseline (Benchmark)',
    },
    extreme_precip: {
      title: 'Heavy-Tailed Coastal Precipitation Maxima',
      unit: 'mm',
      regionName: 'Western Sierra Watershed (Benchmark)',
    },
  };

  return {
    ...meta[preset],
    dates,
    values,
    provenanceTier: 'synthetic_demo',
  };
}
