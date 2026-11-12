import React from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip);

export interface ScatterColumn {
  name: string;
  values: number[];
}

interface ScatterMatrixProps {
  columns: ScatterColumn[];
  maxCols?: number;
}

export const ScatterMatrix: React.FC<ScatterMatrixProps> = ({
  columns,
  maxCols = 4,
}) => {
  const activeCols = columns.slice(0, maxCols);
  const p = activeCols.length;

  if (p < 2) {
    return (
      <div className="p-6 text-center text-xs text-slate-500">
        Please select at least 2 numeric columns for pairwise scatter matrix.
      </div>
    );
  }

  // Compute correlation between two series
  const computeR = (x: number[], y: number[]) => {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
    const my = y.slice(0, n).reduce((s, v) => s + v, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i] - mx) * (y[i] - my);
      dx += (x[i] - mx) ** 2;
      dy += (y[i] - my) ** 2;
    }
    const den = Math.sqrt(dx * dy);
    return den > 0 ? num / den : 0;
  };

  return (
    <div className="w-full overflow-x-auto p-2 bg-[#071326]/60 rounded-xl border border-slate-800">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${p}, minmax(140px, 1fr))` }}
      >
        {activeCols.map((rowCol, rIdx) => (
          <React.Fragment key={rIdx}>
            {activeCols.map((colCol, cIdx) => {
              // Diagonal: Variable name and summary
              if (rIdx === cIdx) {
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className="h-32 flex flex-col items-center justify-center bg-slate-900/80 rounded-lg border border-slate-800 p-2 text-center"
                  >
                    <span className="text-xs font-bold text-[#3EC7F2] truncate max-w-full">
                      {rowCol.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-1">
                      N = {rowCol.values.length}
                    </span>
                  </div>
                );
              }

              // Upper triangle: correlation value
              if (rIdx < cIdx) {
                const r = computeR(rowCol.values, colCol.values);
                const color = r > 0 ? 'text-emerald-400' : 'text-rose-400';
                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className="h-32 flex flex-col items-center justify-center bg-slate-900/40 rounded-lg border border-slate-800/80 p-2 text-center"
                  >
                    <span className="text-[10px] text-slate-400 uppercase">r</span>
                    <span className={`text-sm font-bold font-mono ${color}`}>
                      {r.toFixed(3)}
                    </span>
                    <div
                      className="w-12 h-1 rounded mt-2"
                      style={{
                        backgroundColor: r > 0 ? '#10b981' : '#f43f5e',
                        opacity: Math.max(0.2, Math.abs(r)),
                      }}
                    />
                  </div>
                );
              }

              // Lower triangle: mini scatter plot
              const pairs = [];
              const n = Math.min(rowCol.values.length, colCol.values.length);
              for (let i = 0; i < n; i++) {
                pairs.push({ x: colCol.values[i], y: rowCol.values[i] });
              }

              const scatterData = {
                datasets: [
                  {
                    data: pairs,
                    backgroundColor: 'rgba(62, 199, 242, 0.6)',
                    borderColor: 'rgba(62, 199, 242, 0.9)',
                    pointRadius: 2,
                  },
                ],
              };

              const options = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false },
                },
                scales: {
                  x: { display: false },
                  y: { display: false },
                },
              };

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className="h-32 bg-slate-950/60 rounded-lg border border-slate-800/80 p-1"
                >
                  <Scatter data={scatterData} options={options} />
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
