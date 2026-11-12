import React, { useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export interface DataColumn {
  name: string;
  values: number[];
  type: 'numeric' | 'categorical';
  missing: number;
}

interface DataIngestionProps {
  onDataLoaded: (columns: DataColumn[], rawDataName: string) => void;
}

const SAMPLE_DATASETS: { name: string; description: string; csv: string }[] = [
  {
    name: 'Global Climate Multi-Variable (1995-2024)',
    description: 'Monthly air temperature (°C), precipitation (mm), root-zone moisture, and aerosol optical depth',
    csv: `year,month,temp_air,precip,soil_moist,aod
1995,1,-2.4,45.2,0.32,0.14
1995,2,-1.8,42.1,0.31,0.15
1995,3,3.5,55.0,0.35,0.18
1995,4,9.2,62.3,0.34,0.22
1995,5,15.1,70.1,0.30,0.25
1995,6,19.4,78.5,0.26,0.24
1995,7,22.1,65.2,0.22,0.21
1995,8,21.5,58.4,0.21,0.19
1995,9,16.8,50.2,0.24,0.17
1995,10,10.2,48.0,0.28,0.16
1995,11,4.1,44.5,0.31,0.15
1995,12,-0.5,46.0,0.33,0.14
2005,1,-1.8,48.2,0.30,0.16
2005,2,-1.0,43.5,0.29,0.18
2005,3,4.2,58.1,0.33,0.20
2005,4,10.1,65.0,0.31,0.24
2005,5,16.0,72.4,0.27,0.27
2005,6,20.5,82.1,0.23,0.26
2005,7,23.4,68.0,0.19,0.23
2005,8,22.6,60.2,0.18,0.21
2005,9,17.9,52.3,0.21,0.19
2005,10,11.0,50.1,0.25,0.17
2005,11,4.9,46.0,0.28,0.16
2005,12,0.2,47.8,0.30,0.15
2015,1,-0.9,52.0,0.28,0.18
2015,2,-0.2,46.2,0.27,0.20
2015,3,5.1,62.0,0.31,0.23
2015,4,11.2,68.5,0.28,0.27
2015,5,17.2,76.0,0.24,0.30
2015,6,21.8,85.2,0.20,0.29
2015,7,24.8,71.5,0.16,0.26
2015,8,23.9,63.1,0.15,0.24
2015,9,19.0,55.0,0.18,0.22
2015,10,12.1,52.4,0.22,0.19
2015,11,5.8,48.1,0.25,0.18
2015,12,1.1,49.5,0.27,0.17
2024,1,-0.2,56.1,0.25,0.21
2024,2,0.8,49.0,0.24,0.23
2024,3,6.2,65.2,0.28,0.26
2024,4,12.4,72.1,0.25,0.31
2024,5,18.5,79.5,0.21,0.34
2024,6,23.0,89.0,0.17,0.32
2024,7,26.1,75.2,0.13,0.29
2024,8,25.2,66.4,0.12,0.27
2024,9,20.2,58.1,0.15,0.25
2024,10,13.2,55.0,0.19,0.22
2024,11,6.8,50.2,0.22,0.20
2024,12,2.0,51.8,0.24,0.19`,
  },
  {
    name: 'Svalbard Arctic Amplification Series',
    description: '30-year polar air temperature anomalies with accelerated warming trend',
    csv: `year,month,temp_anomaly,sea_ice_extent
1995,1,-1.2,14.5
1995,4,-0.8,15.2
1995,7,0.2,9.8
1995,10,-0.5,8.2
2000,1,-0.6,14.1
2000,4,-0.3,14.8
2000,7,0.5,9.2
2000,10,0.1,7.6
2005,1,0.2,13.6
2005,4,0.6,14.2
2005,7,1.1,8.5
2005,10,0.8,6.8
2010,1,0.8,13.1
2010,4,1.2,13.8
2010,7,1.8,7.9
2010,10,1.4,6.1
2015,1,1.5,12.5
2015,4,1.9,13.1
2015,7,2.4,7.2
2015,10,2.1,5.4
2020,1,2.2,11.8
2020,4,2.6,12.4
2020,7,3.1,6.5
2020,10,2.8,4.8
2024,1,2.9,11.2
2024,4,3.2,11.9
2024,7,3.8,5.8
2024,10,3.4,4.2`,
  },
];

export const DataIngestion: React.FC<DataIngestionProps> = ({ onDataLoaded }) => {
  const [csvText, setCsvText] = useState<string>('');
  const [datasetName, setDatasetName] = useState<string>('Custom Ingestion');
  const [parsedColumns, setParsedColumns] = useState<DataColumn[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = (rawText: string, name: string) => {
    try {
      setParseError(null);
      const lines = rawText
        .trim()
        .split(/\r?\n/)
        .filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));

      if (lines.length < 2) {
        throw new Error('CSV must contain a header row and at least 1 data row.');
      }

      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"(.*)"$/, '$1'));

      const cols: DataColumn[] = headers.map(h => ({
        name: h,
        values: [],
        type: 'numeric',
        missing: 0,
      }));

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
        for (let j = 0; j < cols.length; j++) {
          const val = row[j];
          if (val === undefined || val === '' || val === 'NA' || val === 'null' || val === '-999') {
            cols[j].missing++;
          } else {
            const num = parseFloat(val);
            if (!isNaN(num)) {
              cols[j].values.push(num);
            } else {
              cols[j].type = 'categorical';
            }
          }
        }
      }

      const numericCols = cols.filter(c => c.type === 'numeric' && c.values.length > 0);
      if (numericCols.length === 0) {
        throw new Error('No numeric columns found in dataset.');
      }

      setParsedColumns(cols);
      setDatasetName(name);
      onDataLoaded(cols, name);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      setParsedColumns(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const text = evt.target?.result as string;
      setCsvText(text);
      handleParse(text, file.name);
    };
    reader.readAsText(file);
  };

  const loadSample = (sample: typeof SAMPLE_DATASETS[0]) => {
    setCsvText(sample.csv);
    handleParse(sample.csv, sample.name);
  };

  return (
    <div className="space-y-6">
      {/* Sample Quick Load Buttons */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Quick Load Verified Datasets</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SAMPLE_DATASETS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => loadSample(s)}
              className="text-left p-3 rounded-xl bg-[#071326] border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-900/60 transition-all group"
            >
              <div className="font-semibold text-xs text-white group-hover:text-cyan-300">
                {s.name}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                {s.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* CSV Paste / Upload */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Or Paste Custom Tabular Data (CSV / TSV)</span>
          </label>
          <label className="cursor-pointer text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 font-medium">
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload File</span>
            <input
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <textarea
          rows={5}
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder="year,month,variable1,variable2&#10;2020,1,14.2,55.1&#10;2020,2,15.8,48.3..."
          className="w-full bg-[#030915] border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400/60 transition-all resize-y"
        />

        <button
          onClick={() => handleParse(csvText, 'User Input Data')}
          disabled={!csvText.trim()}
          className="px-4 py-2 bg-[#3EC7F2] hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#030915] font-bold text-xs rounded-lg transition-all shadow-md shadow-cyan-500/20"
        >
          Parse & Load Columns
        </button>
      </div>

      {/* Error alert */}
      {parseError && (
        <div className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{parseError}</span>
        </div>
      )}

      {/* Parsed Columns Summary */}
      {parsedColumns && (
        <div className="space-y-3 bg-[#071326] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white">
                Loaded: {datasetName}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {parsedColumns.length} columns detected
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
            {parsedColumns.map((col, idx) => (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs space-y-1"
              >
                <div className="font-semibold text-slate-200 truncate" title={col.name}>
                  {col.name}
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className={`px-1.5 py-0.5 rounded font-mono ${
                    col.type === 'numeric' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {col.type}
                  </span>
                  <span>{col.values.length} rows</span>
                </div>
                {col.missing > 0 && (
                  <div className="text-[10px] text-amber-400 font-mono">
                    {col.missing} missing
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
