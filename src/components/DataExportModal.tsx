import React from 'react';
import { EarthVariable, HotspotRegion, TimeSeriesPoint, TrendAnalysisResult } from '../types/earthScience';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  CheckCircle2, 
  Copy 
} from 'lucide-react';

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  region: HotspotRegion;
  variable: EarthVariable;
  points: TimeSeriesPoint[];
  stats: TrendAnalysisResult;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({
  isOpen,
  onClose,
  region,
  variable,
  points,
  stats,
}) => {
  const [copiedCitation, setCopiedCitation] = React.useState<boolean>(false);

  if (!isOpen) return null;

  // Generate CSV Text
  const generateCsv = () => {
    let csv = `# NASA TerraTrends Earth Science Analysis Export\n`;
    csv += `# Region: ${region.name} (${region.coordinates[0].toFixed(2)}N, ${region.coordinates[1].toFixed(2)}E)\n`;
    csv += `# Variable: ${variable.name} (${variable.unit})\n`;
    csv += `# Missions: ${variable.missions.join(', ')}\n`;
    csv += `# Mann-Kendall Z: ${stats.mkZ}, Tau: ${stats.mkTau}, p-value: ${stats.mkPValue}\n`;
    csv += `# Sen's Slope: ${stats.sensSlopePerDecade} ${variable.unit}/decade, OLS Slope: ${stats.slopePerDecade} ${variable.unit}/decade\n`;
    csv += `# Significance: ${stats.significanceLevel} (${stats.significanceStars})\n`;
    csv += `Date,Year,Month,Raw_${variable.id},MovingAvg_12Mo,Deseasonalized_Anomaly,Trend_OLS,CI95_Lower,CI95_Upper\n`;

    points.forEach(p => {
      csv += `${p.date},${p.year},${p.month},${p.raw},${p.movingAvg ?? ''},${p.anomaly ?? ''},${p.trend ?? ''},${p.ciLower ?? ''},${p.ciUpper ?? ''}\n`;
    });

    return csv;
  };

  const handleDownloadCsv = () => {
    const csvData = generateCsv();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NASA_TerraTrends_${variable.id}_${region.name.replace(/\s+/g, '_')}_${stats.startDate}_${stats.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const jsonPayload = {
      metadata: {
        tool: 'NASA TerraTrends Earth Science Change Detective',
        event: '2026 NASA Space Apps Challenge',
        exportDate: new Date().toISOString(),
        region: {
          name: region.name,
          category: region.category,
          coordinates: region.coordinates,
          phenomenon: region.keyPhenomenon,
        },
        variable: {
          id: variable.id,
          name: variable.name,
          unit: variable.unit,
          missions: variable.missions,
          category: variable.category,
        },
        statistics: stats,
      },
      timeSeries: points,
    };

    const blob = new Blob([JSON.stringify(jsonPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NASA_TerraTrends_${variable.id}_${region.name.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const citationText = `NASA TerraTrends (2026). Decadal Trend and Significance Analysis of ${variable.name} in ${region.name} (${stats.startDate} to ${stats.endDate}). NASA Space Apps Challenge. Based on ${variable.missions.join(', ')} observations.`;

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(citationText);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5 pb-3 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-blue-950 text-cyan-400 border border-blue-800">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Export Planetary Science Dossier</h3>
            <p className="text-xs text-slate-400">
              Download clean time-series datasets, statistical tables, and citations
            </p>
          </div>
        </div>

        {/* Dossier Summary Preview */}
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400">Target Region:</span>
            <span className="font-bold text-white">{region.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400">Observed Variable:</span>
            <span className="font-bold text-cyan-300">{variable.name} ({variable.unit})</span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400">Rate of Change:</span>
            <span className="font-mono font-bold text-white">
              {stats.slopePerDecade > 0 ? '+' : ''}{stats.slopePerDecade.toFixed(2)} {variable.unit}/decade
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-800/80 pb-2">
            <span className="text-slate-400">Statistical Significance:</span>
            <span className="font-bold text-emerald-400">
              {stats.significanceLevel} ({stats.significanceStars}) • p {stats.mkPValue < 0.001 ? '< 0.001' : `= ${stats.mkPValue.toFixed(4)}`}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Sample Records:</span>
            <span className="font-mono text-slate-300">{stats.sampleCount} monthly data points ({stats.startDate} → {stats.endDate})</span>
          </div>
        </div>

        {/* Export Formats Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
          <button
            onClick={handleDownloadCsv}
            className="flex flex-col items-center justify-center p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center transition-all group"
          >
            <FileSpreadsheet className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white block">Download CSV</span>
            <span className="text-[10px] text-slate-400">Raw, Anomaly & Trend data</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="flex flex-col items-center justify-center p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center transition-all group"
          >
            <FileText className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white block">Download JSON</span>
            <span className="text-[10px] text-slate-400">Structured statistical API payload</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex flex-col items-center justify-center p-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-center transition-all group"
          >
            <Printer className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform mb-2" />
            <span className="text-xs font-bold text-white block">Print / PDF Report</span>
            <span className="text-[10px] text-slate-400">Formatted dossier summary</span>
          </button>
        </div>

        {/* Academic Citation Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Suggested Citation:</span>
            <button
              onClick={handleCopyCitation}
              className="flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {copiedCitation ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCitation ? 'Copied to Clipboard!' : 'Copy Citation'}</span>
            </button>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed">
            {citationText}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
