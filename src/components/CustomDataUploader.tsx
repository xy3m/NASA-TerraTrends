import React, { useState } from 'react';
import { EarthVariable, HotspotRegion, TimeSeriesPoint, TrendAnalysisResult, VariableId } from '../types/earthScience';
import { EARTH_VARIABLES, fetchLiveNasaPowerData, parseCustomCsv } from '../services/nasaData';
import { analyzeTrend, processTimeSeries } from '../services/statistics';
import { TimeSeriesChart } from './TimeSeriesChart';
import { StatsSummaryCard } from './StatsSummaryCard';
import { 
  UploadCloud, 
  MapPin, 
  FileSpreadsheet, 
  Radio, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Code
} from 'lucide-react';

interface CustomDataUploaderProps {
  onAnalyzeCustomData: (
    region: HotspotRegion,
    variable: EarthVariable,
    points: TimeSeriesPoint[],
    isLiveNasa: boolean
  ) => void;
}

export const CustomDataUploader: React.FC<CustomDataUploaderProps> = ({
  onAnalyzeCustomData,
}) => {
  const [activeTab, setActiveTab] = useState<'coordinates' | 'csv'>('coordinates');

  // Coordinates state
  const [latInput, setLatInput] = useState<string>('40.71');
  const [lonInput, setLonInput] = useState<string>('-74.01');
  const [selectedVarId, setSelectedVarId] = useState<VariableId>('temp_air');
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [apiFeedback, setApiFeedback] = useState<string | null>(null);

  // CSV state
  const [csvText, setCsvText] = useState<string>(
`Date,Value
1990-01,12.4
1990-02,13.1
1990-03,14.2
1990-04,16.5
1990-05,19.8
1990-06,22.3
1990-07,25.6
1990-08,24.9
1990-09,21.5
1990-10,17.2
1990-11,14.1
1990-12,12.8
2020-01,14.1
2020-02,14.8
2020-03,15.9
2020-04,18.2
2020-05,21.5
2020-06,24.1
2020-07,27.5
2020-08,26.8
2020-09,23.4
2020-10,19.1
2020-11,15.8
2020-12,14.4`
  );
  const [customDatasetName, setCustomDatasetName] = useState<string>('Local Environmental Station');
  const [csvError, setCsvError] = useState<string | null>(null);

  // Coordinate presets
  const presets = [
    { name: 'New York City', lat: 40.71, lon: -74.01 },
    { name: 'London, UK', lat: 51.51, lon: -0.13 },
    { name: 'Tokyo, Japan', lat: 35.68, lon: 139.77 },
    { name: 'Sahara (Tamanrasset)', lat: 22.78, lon: 5.52 },
    { name: 'Great Barrier Reef', lat: -16.92, lon: 145.77 },
  ];

  // Handle Live NASA API fetch
  const handleFetchLiveNasa = async () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      setApiFeedback('Please enter a valid latitude between -90 and 90.');
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      setApiFeedback('Please enter a valid longitude between -180 and 180.');
      return;
    }

    setIsLoadingApi(true);
    setApiFeedback(null);

    try {
      const { points, isLiveNasa } = await fetchLiveNasaPowerData(lat, lon, selectedVarId);
      const targetVar = EARTH_VARIABLES.find(v => v.id === selectedVarId) || EARTH_VARIABLES[0];

      const customRegion: HotspotRegion = {
        id: `coord_${lat.toFixed(2)}_${lon.toFixed(2)}`,
        name: `Query Point (${lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S'}, ${lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W'})`,
        countryOrOcean: 'Custom Coordinates',
        coordinates: [lat, lon],
        category: 'Urban',
        description: `Direct NASA Earth Science observation query for ${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
        keyPhenomenon: 'Geographic Trend Exploration',
        primaryVariable: selectedVarId,
      };

      onAnalyzeCustomData(customRegion, targetVar, points, isLiveNasa);
      setApiFeedback(isLiveNasa ? 'Successfully retrieved live NASA POWER data!' : 'Loaded calibrated Earth science model data for this location.');
    } catch (err: any) {
      setApiFeedback(`Error retrieving NASA data: ${err.message || err}`);
    } finally {
      setIsLoadingApi(false);
    }
  };

  // Handle CSV file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCsvText(text);
        setCustomDatasetName(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsText(file);
  };

  // Process Custom CSV
  const handleProcessCsv = () => {
    setCsvError(null);
    try {
      const rawPoints = parseCustomCsv(csvText);
      const processed = processTimeSeries(rawPoints);
      const targetVar = EARTH_VARIABLES.find(v => v.id === selectedVarId) || EARTH_VARIABLES[0];

      const customRegion: HotspotRegion = {
        id: `csv_${Date.now()}`,
        name: customDatasetName || 'User CSV Dataset',
        countryOrOcean: 'Uploaded Time Series',
        coordinates: [0, 0],
        category: 'Agricultural',
        description: 'User-provided custom environmental observations',
        keyPhenomenon: 'Custom Time Series Significance Test',
        primaryVariable: selectedVarId,
      };

      onAnalyzeCustomData(customRegion, targetVar, processed, false);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to parse CSV');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 rounded-2xl border border-emerald-800/40 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-slate-950 uppercase tracking-widest flex items-center space-x-1">
              <UploadCloud className="w-3 h-3" />
              <span>Data Studio & API Hub</span>
            </span>
            <span className="text-xs text-slate-400">• Query Any Global Coordinates or Upload CSV</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Analyze Custom Data & Global Coordinates
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Query live satellite data directly from the official NASA POWER API for any coordinate on Earth, or import your own field sensor CSV files to run Mann-Kendall significance tests.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('coordinates')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'coordinates'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>NASA Coordinates API</span>
          </button>

          <button
            onClick={() => setActiveTab('csv')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'csv'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Import CSV Time Series</span>
          </button>
        </div>
      </div>

      {/* TAB 1: COORDINATES LIVE QUERY */}
      {activeTab === 'coordinates' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Live NASA POWER API Query</span>
              </h3>
              <p className="text-xs text-slate-400">
                Direct satellite & MERRA-2 meteorological database (1995–2024)
              </p>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
              CORS-Enabled NASA Endpoint
            </span>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-400 font-semibold block">Quick Global Presets:</span>
            <div className="flex flex-wrap gap-2">
              {presets.map(p => (
                <button
                  key={p.name}
                  onClick={() => {
                    setLatInput(p.lat.toString());
                    setLonInput(p.lon.toString());
                  }}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 text-xs font-mono transition-colors"
                >
                  {p.name} ({p.lat}°, {p.lon}°)
                </button>
              ))}
            </div>
          </div>

          {/* Coordinate Form */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Latitude (-90 to +90)
              </label>
              <input
                type="number"
                step="0.01"
                min="-90"
                max="90"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g. 40.71"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Longitude (-180 to +180)
              </label>
              <input
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={lonInput}
                onChange={(e) => setLonInput(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="e.g. -74.01"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Earth Science Variable
              </label>
              <select
                value={selectedVarId}
                onChange={(e) => setSelectedVarId(e.target.value as VariableId)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {EARTH_VARIABLES.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.shortName} ({v.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Feedback & Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div>
              {apiFeedback && (
                <div className="flex items-center space-x-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{apiFeedback}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleFetchLiveNasa}
              disabled={isLoadingApi}
              className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isLoadingApi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Contacting NASA POWER API...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Fetch & Analyze Coordinates</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CSV UPLOADER */}
      {activeTab === 'csv' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                <span>Upload Custom Environmental CSV Data</span>
              </h3>
              <p className="text-xs text-slate-400">
                Run Mann-Kendall, Sen's slope, and deseasonalization on your own time-series
              </p>
            </div>

            <label className="cursor-pointer px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors">
              <span>Choose CSV File</span>
              <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Dataset / Station Name
              </label>
              <input
                type="text"
                value={customDatasetName}
                onChange={(e) => setCustomDatasetName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Alpine Weather Station"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                Target Variable Interpretation
              </label>
              <select
                value={selectedVarId}
                onChange={(e) => setSelectedVarId(e.target.value as VariableId)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {EARTH_VARIABLES.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 font-semibold block mb-1.5">
              CSV Content (Paste or Edit Below):
            </label>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Format: Date (YYYY-MM or YYYY-MM-DD), Value. Comma, semicolon, or tab delimited.
            </p>
          </div>

          {csvError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={handleProcessCsv}
              className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all"
            >
              <Play className="w-4 h-4" />
              <span>Process Custom CSV & Calculate Significance</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
