import React, { useRef, useEffect } from 'react';

interface HeatmapChartProps {
  matrix: number[][]; // correlation matrix values [-1, 1]
  labels: string[];
  title?: string;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  matrix,
  labels,
  title = 'Correlation Matrix Heatmap',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const n = labels.length;
    if (n === 0 || matrix.length === 0) return;

    const size = Math.min(canvas.width, canvas.height);
    const cellSize = (size - 60) / n;
    const offsetX = 50;
    const offsetY = 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Color mapper from -1 (blue) through 0 (dark navy) to +1 (cyan/emerald)
    const getColor = (val: number) => {
      const clamped = Math.max(-1, Math.min(1, val));
      if (clamped >= 0) {
        // 0 to 1: dark slate to bright cyan/emerald
        const r = Math.round(15 + clamped * (16 - 15));
        const g = Math.round(23 + clamped * (185 - 23));
        const b = Math.round(42 + clamped * (129 - 42));
        return `rgb(${r}, ${g}, ${b})`;
      } else {
        // -1 to 0: rose to dark slate
        const mag = Math.abs(clamped);
        const r = Math.round(15 + mag * (244 - 15));
        const g = Math.round(23 + mag * (63 - 23));
        const b = Math.round(42 + mag * (94 - 42));
        return `rgb(${r}, ${g}, ${b})`;
      }
    };

    // Draw cells
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const val = matrix[r]?.[c] ?? 0;
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;

        ctx.fillStyle = getColor(val);
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);

        // Draw correlation text
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val.toFixed(2), x + cellSize / 2, y + cellSize / 2);
      }

      // Draw Row label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = labels[r].length > 6 ? labels[r].substring(0, 6) + '..' : labels[r];
      ctx.fillText(label, offsetX - 8, offsetY + r * cellSize + cellSize / 2);

      // Draw Column label
      ctx.save();
      ctx.translate(offsetX + r * cellSize + cellSize / 2, offsetY + n * cellSize + 10);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }, [matrix, labels]);

  return (
    <div className="w-full bg-[#071326]/60 rounded-xl border border-slate-800 p-4 space-y-3">
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {title}
          </h4>
          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block"></span>
              <span>-1 (Neg)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block"></span>
              <span>0 (Neutral)</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
              <span>+1 (Pos)</span>
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-center overflow-x-auto">
        <canvas
          ref={canvasRef}
          width={380}
          height={380}
          className="max-w-full"
        />
      </div>
    </div>
  );
};
