import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Scatter, Bar } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, LineElement, BarElement, Title, Tooltip);

interface DiagnosticPlotsProps {
  residuals: number[];
  fitted?: number[];
  values: number[];
}

export const DiagnosticPlots: React.FC<DiagnosticPlotsProps> = ({
  residuals,
  fitted,
  values,
}) => {
  // 1. Residuals vs. Fitted
  const resFittedData = useMemo(() => {
    const f = fitted && fitted.length === residuals.length
      ? fitted
      : values.map((_, i) => i);

    const points = residuals.map((r, i) => ({ x: f[i], y: r }));

    return {
      datasets: [
        {
          label: 'Residuals',
          data: points,
          backgroundColor: 'rgba(239, 68, 68, 0.7)',
          pointRadius: 3,
        },
      ],
    };
  }, [residuals, fitted, values]);

  // 2. Normal Q-Q plot
  const qqData = useMemo(() => {
    const clean = [...residuals].sort((a, b) => a - b);
    const n = clean.length;
    if (n < 4) return { datasets: [] };

    const mean = clean.reduce((s, v) => s + v, 0) / n;
    const std = Math.sqrt(clean.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) || 1;

    // Approximate theoretical normal quantiles (Beasley-Springer-Moro approx)
    const points = [];
    for (let i = 0; i < n; i++) {
      const p = (i + 0.5) / n;
      const t = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p));
      const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
      const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
      const z = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
      const theoreticalQ = p < 0.5 ? -z : z;
      const sampleQ = (clean[i] - mean) / std;
      points.push({ x: theoreticalQ, y: sampleQ });
    }

    return {
      datasets: [
        {
          label: 'Sample vs Theoretical Quantiles',
          data: points,
          backgroundColor: 'rgba(56, 189, 248, 0.8)',
          pointRadius: 3,
        },
      ],
    };
  }, [residuals]);

  // 3. Autocorrelation Function (ACF)
  const acfData = useMemo(() => {
    const n = residuals.length;
    const maxLag = Math.min(15, Math.floor(n / 4));
    if (n < 4 || maxLag < 1) return { labels: [], datasets: [] };

    const mean = residuals.reduce((s, v) => s + v, 0) / n;
    let var0 = 0;
    for (let i = 0; i < n; i++) var0 += (residuals[i] - mean) ** 2;

    const labels: string[] = [];
    const autocorrs: number[] = [];

    for (let lag = 1; lag <= maxLag; lag++) {
      let num = 0;
      for (let i = 0; i < n - lag; i++) {
        num += (residuals[i] - mean) * (residuals[i + lag] - mean);
      }
      const r = var0 > 0 ? num / var0 : 0;
      labels.push(`Lag ${lag}`);
      autocorrs.push(+r.toFixed(3));
    }

    return {
      labels,
      datasets: [
        {
          label: 'ACF Autocorrelation',
          data: autocorrs,
          backgroundColor: autocorrs.map(v => Math.abs(v) > 2 / Math.sqrt(n) ? '#f43f5e' : '#38bdf8'),
          borderRadius: 2,
        },
      ],
    };
  }, [residuals]);

  const scatterOptions = (xLabel: string, yLabel: string) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        title: { display: true, text: xLabel, color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#64748b', font: { size: 9 } },
      },
      y: {
        title: { display: true, text: yLabel, color: '#94a3b8', font: { size: 10 } },
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#64748b', font: { size: 9 } },
      },
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Residuals vs Fitted */}
      <div className="bg-[#071326]/60 border border-slate-800 rounded-xl p-3 space-y-2">
        <h5 className="text-xs font-semibold text-slate-300">Residuals vs Fitted</h5>
        <div className="h-44">
          <Scatter data={resFittedData} options={scatterOptions('Fitted Values', 'Residuals')} />
        </div>
      </div>

      {/* 2. Normal Q-Q Plot */}
      <div className="bg-[#071326]/60 border border-slate-800 rounded-xl p-3 space-y-2">
        <h5 className="text-xs font-semibold text-slate-300">Normal Q-Q Plot</h5>
        <div className="h-44">
          <Scatter data={qqData} options={scatterOptions('Theoretical Quantiles', 'Standardized Residuals')} />
        </div>
      </div>

      {/* 3. ACF Autocorrelation */}
      <div className="bg-[#071326]/60 border border-slate-800 rounded-xl p-3 space-y-2">
        <h5 className="text-xs font-semibold text-slate-300">Autocorrelation Function (ACF)</h5>
        <div className="h-44">
          <Bar
            data={acfData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
                y: { min: -1, max: 1, ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};
