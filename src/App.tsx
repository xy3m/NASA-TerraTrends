import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  EarthVariable, 
  HotspotRegion, 
  TimeSeriesPoint, 
  TrendAnalysisResult, 
  VariableId,
  ProvenanceTier
} from './types/earthScience';
import { 
  EARTH_VARIABLES, 
  HOTSPOT_REGIONS, 
  NASA_POWER_PARAM_MAP,
  generateCuratedTimeSeries, 
  fetchLiveNasaPowerData,
  parseCustomCsv
} from './services/nasaData';
import { connectorRegistry } from './services/connectors';
import { analyzeTrend, processTimeSeries } from './services/statistics';
import { Navbar, AppMode, DataFeedSource } from './components/Navbar';
import { EarthMap } from './components/EarthMap';
import { VariableSelector } from './components/VariableSelector';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { StatsSummaryCard } from './components/StatsSummaryCard';
import { PlainEnglishSummary } from './components/PlainEnglishSummary';
import { DetectiveMode } from './components/DetectiveMode';
import { RegionalContrastView } from './components/RegionalContrastView';
import { VariableEncyclopedia } from './components/VariableEncyclopedia';
import { CustomDataUploader } from './components/CustomDataUploader';
import { DataExportModal } from './components/DataExportModal';

const StatisticalLab = React.lazy(() => import('./components/StatisticalLab/StatisticalLab'));
import { 
  Sparkles, 
  Globe2, 
  Compass, 
  ArrowRight, 
  Satellite, 
  Database,
  ExternalLink,
  BookOpen
} from 'lucide-react';

export const App: React.FC = () => {
  // Navigation & view modes
  const [currentMode, setCurrentMode] = useState<AppMode>('explorer');

  // Selected Region & Variable
  const [selectedRegion, setSelectedRegion] = useState<HotspotRegion>(HOTSPOT_REGIONS[0]); // Svalbard Arctic by default
  const [selectedVariable, setSelectedVariable] = useState<EarthVariable>(EARTH_VARIABLES[0]); // Surface Air Temp by default

  // Custom data overrides (from live API or CSV upload)
  const [customPoints, setCustomPoints] = useState<TimeSeriesPoint[] | null>(null);
  const [uploadedCsvText, setUploadedCsvText] = useState<string | null>(null);
  const [isLiveNasa, setIsLiveNasa] = useState<boolean>(false);
  const [provenanceTier, setProvenanceTier] = useState<ProvenanceTier>('reanalysis_model');
  const liveQueryIdRef = useRef<number>(0);
  const section1Ref = useRef<HTMLElement | null>(null);
  const section2Ref = useRef<HTMLElement | null>(null);
  const scrollTargetRef = useRef<'section1' | 'section2' | null>(null);

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Time series generation
  const activePoints = useMemo(() => {
    if (customPoints) {
      return customPoints;
    }
    return generateCuratedTimeSeries(selectedRegion, selectedVariable);
  }, [selectedRegion, selectedVariable, customPoints]);

  // Statistical trend analysis
  const trendStats: TrendAnalysisResult = useMemo(() => {
    return analyzeTrend(
      activePoints,
      selectedVariable.id,
      selectedVariable.name,
      selectedVariable.unit,
      selectedRegion.name,
      selectedRegion.coordinates,
      true // use anomaly for trend
    );
  }, [activePoints, selectedVariable, selectedRegion]);

  // Fetch live connector data (or calibrated fallback) for coordinates with race guard
  const loadCoordinateData = async (lat: number, lon: number, variableId: VariableId) => {
    const queryId = ++liveQueryIdRef.current;

    // Check connector registry (supports POWER, ORNL MODIS, NOAA Tides, USGS Water)
    const connector = connectorRegistry.getBestConnector(variableId, lat, lon);
    if (connector?.capabilities.timeSeries) {
      try {
        const res = await connector.fetchTimeSeries({ lat, lon, variableId });
        if (queryId !== liveQueryIdRef.current) return;
        if (res.points.length >= 24) {
          setCustomPoints(res.points);
          setIsLiveNasa(true);
          setProvenanceTier(res.provenance);
          return;
        }
      } catch (err) {
        console.warn(`Connector ${connector.id} query failed, attempting NASA POWER fallback:`, err);
      }
    }

    // Direct NASA POWER API / calibrated fallback
    const { points, isLiveNasa: isLive } = await fetchLiveNasaPowerData(lat, lon, variableId);
    if (queryId !== liveQueryIdRef.current) return;
    setCustomPoints(points);
    setIsLiveNasa(isLive);
    setProvenanceTier(isLive ? 'reanalysis_model' : 'synthetic_demo');
  };

  // Fetch live connector data on initial load for the default hotspot if supported
  useEffect(() => {
    const connector = connectorRegistry.getBestConnector(
      selectedVariable.id,
      selectedRegion.coordinates[0],
      selectedRegion.coordinates[1]
    );
    if (connector?.capabilities.timeSeries || NASA_POWER_PARAM_MAP[selectedVariable.id]) {
      loadCoordinateData(
        selectedRegion.coordinates[0],
        selectedRegion.coordinates[1],
        selectedVariable.id
      );
    }
  }, []);

  // Handle region selection from map or list
  const handleSelectRegion = (region: HotspotRegion) => {
    liveQueryIdRef.current++;
    setSelectedRegion(region);
    setCustomPoints(null);
    setUploadedCsvText(null);
    setIsLiveNasa(false);
    setProvenanceTier('synthetic_demo');

    // Auto-select the region's primary variable if available
    const primary = EARTH_VARIABLES.find(v => v.id === region.primaryVariable);
    const targetVar = primary || selectedVariable;
    if (primary) {
      setSelectedVariable(primary);
    }

    const connector = connectorRegistry.getBestConnector(targetVar.id, region.coordinates[0], region.coordinates[1]);
    if (connector?.capabilities.timeSeries || NASA_POWER_PARAM_MAP[targetVar.id]) {
      loadCoordinateData(region.coordinates[0], region.coordinates[1], targetVar.id);
    }
  };

  // Handle map click anywhere on Earth
  const handleSelectCustomCoordinates = async (lat: number, lon: number) => {
    setUploadedCsvText(null);
    const customRegion: HotspotRegion = {
      id: `coord_${lat.toFixed(2)}_${lon.toFixed(2)}`,
      name: `Earth Point (${lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S'}, ${lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W'})`,
      countryOrOcean: 'Custom Query',
      coordinates: [lat, lon],
      category: 'Polar',
      description: `User-selected coordinate query at latitude ${lat}°, longitude ${lon}°`,
      keyPhenomenon: 'Geographic Trend Exploration',
      primaryVariable: selectedVariable.id,
    };

    setSelectedRegion(customRegion);
    await loadCoordinateData(lat, lon, selectedVariable.id);
  };

  // Handle Custom Data Studio analysis callback
  const handleAnalyzeCustomData = (
    region: HotspotRegion,
    variable: EarthVariable,
    points: TimeSeriesPoint[],
    isLive: boolean,
    rawCsvText?: string
  ) => {
    liveQueryIdRef.current++;
    scrollTargetRef.current = region.hasCoordinates === false ? 'section2' : 'section1';
    setSelectedRegion(region);
    setSelectedVariable(variable);
    setCustomPoints(points);
    setUploadedCsvText(rawCsvText ?? null);
    setIsLiveNasa(isLive);
    setProvenanceTier('user_upload');
    setCurrentMode('explorer'); // Navigate back to explorer to inspect
  };

  useEffect(() => {
    if (currentMode !== 'explorer' || !scrollTargetRef.current) return;
    const target = scrollTargetRef.current;
    scrollTargetRef.current = null;

    requestAnimationFrame(() => {
      const targetEl = target === 'section2' ? section2Ref.current : section1Ref.current;
      targetEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [currentMode, selectedRegion]);

  const dataFeedSource: DataFeedSource = selectedRegion.id.startsWith('csv_')
    ? 'csv'
    : provenanceTier === 'satellite_observation'
      ? 'satellite'
      : isLiveNasa
        ? 'reanalysis'
        : 'calibrated';

  return (
    <div className="min-h-screen bg-[#030915] text-white flex flex-col selection:bg-[#3EC7F2] selection:text-[#030915]">
      
      {/* Top Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        onOpenExport={() => setIsExportOpen(true)}
        dataFeedSource={dataFeedSource}
        selectedRegionName={selectedRegion.name}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* MODE 1: TREND EXPLORER (Default) */}
        {currentMode === 'explorer' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Mission Hero Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#030915] via-[#071A2F] to-[#030915] border border-[#3EC7F2]/20 p-6 sm:p-8 shadow-2xl">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-[#3EC7F2]/10 blur-3xl pointer-events-none"></div>
              <div className="relative z-10 max-w-3xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#3EC7F2] text-[#030915] shadow-md shadow-[#3EC7F2]/20 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>NASA Earth Science Challenge</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    MODIS • AIRS • OMI • GPM • MERRA-2 • GLDAS
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Detect, Visualize & Prove Significance in Earth's Changing Climate
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Select planetary variables measured by Earth science satellite missions, explore trends across global biomes, eliminate seasonal cycles, and compute mathematical significance using Mann-Kendall and Sen’s slope statistics.
                </p>

                {/* Hotspot Quick Select Carousel */}
                <div className="pt-2 flex items-center space-x-2 overflow-x-auto pb-1 max-w-full">
                  <span className="text-xs font-semibold text-slate-400 shrink-0">
                    Iconic Hotspots:
                  </span>
                  {HOTSPOT_REGIONS.slice(0, 7).map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleSelectRegion(r)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        selectedRegion.id === r.id
                          ? 'bg-[#3EC7F2] text-[#030915] font-bold shadow-sm shadow-[#3EC7F2]/25'
                          : 'bg-[#030915]/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {r.name.split(',')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 1: Global Interactive Map */}
            <section ref={section1Ref} className="space-y-3 scroll-mt-24">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Compass className="w-5 h-5 text-cyan-400" />
                    <span>1. Select Region of Interest</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any marker on the globe or click ANY geographic coordinates to query NASA observations
                  </p>
                </div>
              </div>

              <EarthMap
                selectedRegion={selectedRegion}
                onSelectRegion={handleSelectRegion}
                onSelectCustomCoordinates={handleSelectCustomCoordinates}
              />
            </section>

            {/* Section 2: Earth Science Variable Selector */}
            <section ref={section2Ref} className="space-y-3 scroll-mt-24">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Satellite className="w-5 h-5 text-blue-400" />
                    <span>2. Select Earth Science Variable & Mission</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Choose from satellite-measured parameters and reanalysis models to identify directional trends.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentMode('encyclopedia');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center space-x-1 text-[#3EC7F2] hover:text-cyan-300 underline underline-offset-2 font-medium"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>Visit the Encyclopedia tab</span>
                    </button>{' '}
                    to learn more about the variables, the missions and the models.
                  </p>
                </div>
              </div>

              <VariableSelector
                selectedVariableId={selectedVariable.id}
                onSelectVariable={(v) => {
                  setSelectedVariable(v);
                  if (selectedRegion.id.startsWith('csv_') && uploadedCsvText) {
                    try {
                      const rawPoints = parseCustomCsv(uploadedCsvText, v.id);
                      setCustomPoints(processTimeSeries(rawPoints));
                    } catch {
                      // Keep existing points if re-parsing fails
                    }
                  } else if (!selectedRegion.id.startsWith('csv_')) {
                    liveQueryIdRef.current++;
                    setCustomPoints(null);
                    setIsLiveNasa(false);
                    setProvenanceTier('synthetic_demo');
                    const connector = connectorRegistry.getBestConnector(v.id, selectedRegion.coordinates[0], selectedRegion.coordinates[1]);
                    if (connector?.capabilities.timeSeries || NASA_POWER_PARAM_MAP[v.id]) {
                      const [lat, lon] = selectedRegion.coordinates;
                      loadCoordinateData(lat, lon, v.id);
                    }
                  }
                }}
                recommendedVariableId={selectedRegion.primaryVariable}
              />
            </section>

            {/* Section 3: Time Series Visualization */}
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Database className="w-5 h-5 text-indigo-400" />
                  <span>3. Multi-Decade Time Series & Deseasonalization</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Toggle between raw seasonal cycles, 12-month moving averages, baseline anomalies, and 95% confidence intervals
                </p>
              </div>

              <TimeSeriesChart
                points={activePoints}
                variable={selectedVariable}
                regionName={selectedRegion.name}
                stats={trendStats}
              />
            </section>

            {/* Section 4: Statistical Significance Analysis */}
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>4. Statistical Significance & Rate of Change</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Rigorous Mann-Kendall rank correlation, Theil-Sen slope, and Student's t-test evaluations
                </p>
              </div>

              <StatsSummaryCard stats={trendStats} />
            </section>

            {/* Section 5: Data Detective Plain English Analysis */}
            <section>
              <PlainEnglishSummary
                stats={trendStats}
                variable={selectedVariable}
                region={selectedRegion}
              />
            </section>

          </div>
        )}

        {/* MODE 2: DATA DETECTIVE (Guided Student Missions) */}
        {currentMode === 'detective' && (
          <div className="animate-fadeIn">
            <DetectiveMode />
          </div>
        )}

        {/* MODE 3: OPPOSITE TRENDS LAB */}
        {currentMode === 'contrast' && (
          <div className="animate-fadeIn">
            <RegionalContrastView />
          </div>
        )}

        {/* MODE 4: ENCYCLOPEDIA & MISSIONS DIRECTORY */}
        {currentMode === 'encyclopedia' && (
          <div className="animate-fadeIn">
            <VariableEncyclopedia />
          </div>
        )}

        {/* MODE 5: CUSTOM DATA STUDIO & API */}
        {currentMode === 'upload' && (
          <div className="animate-fadeIn">
            <CustomDataUploader
              initialCoordinates={selectedRegion.coordinates}
              onAnalyzeCustomData={handleAnalyzeCustomData}
            />
          </div>
        )}

        {/* MODE 6: STATISTICAL ANALYSIS LAB */}
        {currentMode === 'lab' && (
          <div className="animate-fadeIn">
            <React.Suspense fallback={
              <div className="flex items-center justify-center p-16 text-slate-400 font-mono text-xs">
                Loading Statistical Analysis Lab...
              </div>
            }>
              <StatisticalLab />
            </React.Suspense>
          </div>
        )}

      </main>

      {/* Export Report Modal */}
      <DataExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        region={selectedRegion}
        variable={selectedVariable}
        points={activePoints}
        stats={trendStats}
      />

      {/* Footer */}
      <footer className="mt-12 bg-[#030915] border-t border-slate-900 py-8 px-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 font-bold tracking-wider">
              <Globe2 className="w-4 h-4 text-[#3EC7F2]" />
              <span>
                <span className="text-white">GEO</span><span className="text-[#3EC7F2]">IRIS</span>
              </span>
            </div>
            <span>•</span>
            <span>2026 NASA Space Apps Challenge</span>
            <span>•</span>
            <span className="text-[#3EC7F2]">Advanced Earth Science & Software</span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <span>Data: NASA POWER, MODIS, AIRS, GPM, MERRA-2, GLDAS</span>
            <span>•</span>
            <button
              onClick={() => setIsExportOpen(true)}
              className="text-[#3EC7F2] hover:text-cyan-300 underline"
            >
              Export Dossier
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
