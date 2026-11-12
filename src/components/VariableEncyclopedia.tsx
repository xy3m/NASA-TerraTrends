import React, { useState } from 'react';
import { EARTH_VARIABLES } from '../services/nasaData';
import { EarthVariable } from '../types/earthScience';
import {
  searchCollections,
  searchGranules,
  CMRCollection,
  CMRGranule,
} from '../services/connectors/cmrConnector';
import { 
  BookOpen, 
  Satellite, 
  Cpu, 
  Thermometer, 
  CloudRain, 
  Trees, 
  Sprout, 
  Droplets, 
  Wind, 
  Sun, 
  ShieldAlert, 
  Search,
  ExternalLink,
  Database,
  Loader2
} from 'lucide-react';

interface MissionInfo {
  id: string;
  name: string;
  acronym: string;
  type: 'Satellite Instrument' | 'Global Model / Reanalysis';
  spacecraft: string;
  launchYear: string;
  status: string;
  agency: string;
  description: string;
  primaryVariables: string[];
  keyScienceRole: string;
}

const NASA_MISSIONS: MissionInfo[] = [
  {
    id: 'modis',
    name: 'Moderate Resolution Imaging Spectroradiometer',
    acronym: 'MODIS',
    type: 'Satellite Instrument',
    spacecraft: 'Terra (10:30 AM orbit) & Aqua (1:30 PM orbit)',
    launchYear: '1999 (Terra) / 2002 (Aqua)',
    status: 'Operational (25+ years continuous record)',
    agency: 'NASA Goddard Space Flight Center',
    description: 'The workhorse of NASA Earth observation. Scans the entire planetary surface every 1 to 2 days across 36 spectral bands from visible to thermal infrared (0.4 µm to 14.4 µm).',
    primaryVariables: ['NDVI Vegetation Index', 'Aerosol Optical Depth (AOD)', 'Land Surface Temperature (LST)', 'Fire / Thermal Anomalies'],
    keyScienceRole: 'Provides unprecedented continuous decadal time-series for global vegetation dynamics, deforestation, wildfires, and ocean color.',
  },
  {
    id: 'merra2',
    name: 'Modern-Era Retrospective analysis for Research and Applications, Version 2',
    acronym: 'MERRA-2',
    type: 'Global Model / Reanalysis',
    spacecraft: 'NASA Global Modeling and Assimilation Office (GMAO)',
    launchYear: 'Operational since 1980 (continually updated)',
    status: 'Active',
    agency: 'NASA GSFC / GMAO',
    description: 'An advanced atmospheric reanalysis model that integrates tens of millions of satellite observations from microwave, infrared, and radar sensors into the Goddard Earth Observing System (GEOS) atmospheric model.',
    primaryVariables: ['Surface Air Temperature (T2M)', 'Precipitation Flux', 'Wind Vectors', 'Tropospheric Ozone'],
    keyScienceRole: 'Synthesizes spatially continuous, gap-free historical climate grids from 1980 to the present at 0.5° × 0.625° resolution.',
  },
  {
    id: 'airs',
    name: 'Atmospheric Infrared Sounder',
    acronym: 'AIRS',
    type: 'Satellite Instrument',
    spacecraft: 'Aqua Satellite',
    launchYear: '2002',
    status: 'Operational',
    agency: 'NASA Jet Propulsion Laboratory (JPL)',
    description: 'A cross-track grating spectrometer with 2,378 infrared channels measuring thermal radiation emitted by Earth atmosphere, slicing through the troposphere in vertical layers.',
    primaryVariables: ['Atmospheric Temperature Profiles', 'Water Vapor Columns', 'Carbon Monoxide', 'Methane'],
    keyScienceRole: 'Created the first daily 3D global atmospheric temperature and humidity map, revolutionizing weather forecasting and greenhouse warming verification.',
  },
  {
    id: 'gpm',
    name: 'Global Precipitation Measurement Core Observatory',
    acronym: 'GPM',
    type: 'Satellite Instrument',
    spacecraft: 'GPM Core + International Constellation',
    launchYear: '2014 (Succeeding TRMM)',
    status: 'Operational',
    agency: 'NASA & JAXA (Japan)',
    description: 'Carries the Dual-frequency Precipitation Radar (DPR) and GPM Microwave Imager (GMI) to map rain and snowfall worldwide every 3 hours.',
    primaryVariables: ['Precipitation Rate (IMERG)', 'Liquid Equivalent Snowfall', 'Raindrop Size Distribution'],
    keyScienceRole: 'Unifies global precipitation measurements across polar and tropical zones, essential for hurricane tracking and flood warnings.',
  },
  {
    id: 'gldas',
    name: 'Global Land Data Assimilation System',
    acronym: 'GLDAS',
    type: 'Global Model / Reanalysis',
    spacecraft: 'NASA GSFC & NOAA NCEP',
    launchYear: 'Continuous since 1979',
    status: 'Active',
    agency: 'NASA GSFC / NOAA',
    description: 'Fuses satellite and ground-based meteorological data (solar insolation, rainfall, humidity) into sophisticated land surface physics models (Noah, Catchment, CLM).',
    primaryVariables: ['Root-Zone Soil Moisture', 'Evapotranspiration (ET)', 'Snow Water Equivalent', 'Surface Runoff'],
    keyScienceRole: 'Simulates fluxes of water and energy across the planetary land surface where physical soil sensors are absent.',
  },
  {
    id: 'omi',
    name: 'Ozone Monitoring Instrument',
    acronym: 'OMI',
    type: 'Satellite Instrument',
    spacecraft: 'Aura Satellite',
    launchYear: '2004',
    status: 'Operational',
    agency: 'NASA & KNMI (Netherlands)',
    description: 'A nadir-viewing ultraviolet-visible spectrometer measuring solar backscattered radiation from 270 nm to 500 nm with daily global coverage.',
    primaryVariables: ['Total Column Ozone', 'Tropospheric NO2 Smog', 'SO2 Volcanic Plumes', 'Aerosol UV Index'],
    keyScienceRole: 'Tracks the recovery of the Antarctic stratospheric ozone hole and monitors urban air pollution emissions across major industrial corridors.',
  },
  {
    id: 'smap',
    name: 'Soil Moisture Active Passive',
    acronym: 'SMAP',
    type: 'Satellite Instrument',
    spacecraft: 'SMAP Observatory',
    launchYear: '2015',
    status: 'Operational (Radiometer)',
    agency: 'NASA JPL',
    description: 'Utilizes a 6-meter spinning mesh antenna to capture 1.4 GHz L-band microwave emissions emitted naturally from the top 5 cm of Earth soil.',
    primaryVariables: ['Surface Soil Moisture', 'Freeze/Thaw State', 'Carbon Respiration'],
    keyScienceRole: 'Detects agricultural water deficits before plants show visible wilting, transforming drought forecasting.',
  },
];

export const VariableEncyclopedia: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'variables' | 'missions' | 'cmr'>('variables');
  const [filterText, setFilterText] = useState<string>('');
  const [cmrQuery, setCmrQuery] = useState<string>('MODIS NDVI');
  const [cmrCollections, setCmrCollections] = useState<CMRCollection[]>([]);
  const [cmrLoading, setCmrLoading] = useState<boolean>(false);
  const [cmrSearched, setCmrSearched] = useState<boolean>(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [granules, setGranules] = useState<CMRGranule[]>([]);
  const [granulesLoading, setGranulesLoading] = useState<boolean>(false);

  const handleCmrSearch = async (keywordOverride?: string) => {
    const q = (keywordOverride ?? cmrQuery).trim();
    if (!q) return;
    setCmrQuery(q);
    setCmrLoading(true);
    setCmrSearched(true);
    setSelectedCollectionId(null);
    setGranules([]);
    const results = await searchCollections(q, 10);
    setCmrCollections(results);
    setCmrLoading(false);
  };

  const handleSelectCollection = async (collectionId: string) => {
    if (selectedCollectionId === collectionId) {
      setSelectedCollectionId(null);
      setGranules([]);
      return;
    }
    setSelectedCollectionId(collectionId);
    setGranulesLoading(true);
    const items = await searchGranules(collectionId, undefined, 6);
    setGranules(items);
    setGranulesLoading(false);
  };

  const getVariableIcon = (id: string) => {
    switch (id) {
      case 'temp_air': return <Thermometer className="w-5 h-5 text-rose-400" />;
      case 'precip': return <CloudRain className="w-5 h-5 text-blue-400" />;
      case 'ndvi': return <Trees className="w-5 h-5 text-emerald-400" />;
      case 'soil_moist': return <Sprout className="w-5 h-5 text-amber-400" />;
      case 'evapo': return <Droplets className="w-5 h-5 text-cyan-400" />;
      case 'aod': return <Wind className="w-5 h-5 text-purple-400" />;
      case 'lst_day': return <Sun className="w-5 h-5 text-orange-400" />;
      case 'ozone': return <ShieldAlert className="w-5 h-5 text-pink-400" />;
      default: return <Satellite className="w-5 h-5 text-slate-400" />;
    }
  };

  const filteredVariables = EARTH_VARIABLES.filter(v =>
    v.name.toLowerCase().includes(filterText.toLowerCase()) ||
    v.shortName.toLowerCase().includes(filterText.toLowerCase()) ||
    v.description.toLowerCase().includes(filterText.toLowerCase()) ||
    v.category.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredMissions = NASA_MISSIONS.filter(m =>
    m.name.toLowerCase().includes(filterText.toLowerCase()) ||
    m.acronym.toLowerCase().includes(filterText.toLowerCase()) ||
    m.description.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-900 rounded-2xl border border-cyan-800/40 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500 text-slate-950 uppercase tracking-widest flex items-center space-x-1">
              <BookOpen className="w-3 h-3" />
              <span>Reference Field Guide</span>
            </span>
            <span className="text-xs text-slate-400">• For Students, Educators & Science Enthusiasts</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            NASA Earth Science Encyclopedia
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Simple definitions, spectral mechanics, physical units, and observing satellites (MODIS, AIRS, GPM, MERRA-2, GLDAS).
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('variables')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'variables'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Variables ({EARTH_VARIABLES.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('missions')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'missions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            <span>Missions & Models ({NASA_MISSIONS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cmr')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'cmr'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>CMR Catalog</span>
          </button>
        </div>
      </div>

      {/* Search Input (for local Variables & Missions) */}
      {activeTab !== 'cmr' && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder={activeTab === 'variables' ? 'Search variables, categories, units...' : 'Search missions, sensors, models...'}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      )}

      {/* TAB 1: VARIABLES DIRECTORY */}
      {activeTab === 'variables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVariables.map(variable => (
            <div
              key={variable.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3.5 flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      {getVariableIcon(variable.id)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{variable.name}</h4>
                      <span className="text-[11px] font-mono text-cyan-400">{variable.category} System</span>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2 py-1 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                    {variable.unit}
                  </span>
                </div>

                {/* Plain English Detective Clue */}
                <div className="mt-3 p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-xs text-blue-200 leading-relaxed">
                  <strong className="text-white block mb-0.5">Student Concept:</strong>
                  {variable.studentExplanation}
                </div>

                {/* Scientific Description */}
                <p className="text-xs text-slate-300 leading-relaxed mt-2.5">
                  {variable.description}
                </p>
              </div>

              {/* Technical Metadata Footer */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Observing Missions:</span>
                  <span className="font-semibold text-slate-200">{variable.missions.join(', ')}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Measurement Mode:</span>
                  <span className="font-mono text-cyan-400">{variable.measurementType}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Typical Terrestrial Range:</span>
                  <span className="font-mono text-slate-200">
                    {variable.typicalRange[0]} to {variable.typicalRange[1]} {variable.unit}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: MISSIONS & MODELS DIRECTORY */}
      {activeTab === 'missions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMissions.map(mission => (
            <div
              key={mission.id}
              className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-3.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-blue-950 text-cyan-400 border border-blue-800">
                      {mission.type === 'Satellite Instrument' ? <Satellite className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
                        <span>{mission.name}</span>
                      </h4>
                      <div className="flex items-center space-x-2 text-[11px] font-mono mt-0.5">
                        <span className="font-bold text-cyan-300">{mission.acronym}</span>
                        <span>•</span>
                        <span className="text-slate-400">{mission.agency}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {mission.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mt-3">
                  {mission.description}
                </p>

                <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                  <strong className="text-white block mb-1">Key Science Role:</strong>
                  {mission.keyScienceRole}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs space-y-1.5">
                <span className="text-slate-400 font-semibold block text-[11px] uppercase tracking-wider">
                  Primary Analyzable Variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {mission.primaryVariables.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-cyan-300 font-mono">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: LIVE NASA CMR CATALOG SEARCH */}
      {activeTab === 'cmr' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={cmrQuery}
                  onChange={e => setCmrQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCmrSearch()}
                  placeholder="Query NASA Common Metadata Repository (e.g., MODIS, SMAP, GPM, AIRS, MERRA-2)..."
                  className="w-full pl-9 pr-4 py-2 bg-[#030915] border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                />
              </div>
              <button
                onClick={() => handleCmrSearch()}
                disabled={cmrLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center space-x-1.5"
              >
                {cmrLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>{cmrLoading ? 'Searching CMR...' : 'Search NASA CMR'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-400 mr-1">Quick queries:</span>
              {['MODIS NDVI', 'SMAP soil moisture', 'GPM IMERG', 'AIRS temperature', 'MERRA-2'].map(preset => (
                <button
                  key={preset}
                  onClick={() => handleCmrSearch(preset)}
                  className="px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {cmrSearched && !cmrLoading && cmrCollections.length === 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
              No collections returned for "{cmrQuery}". Try another NASA mission or variable keyword.
            </div>
          )}

          <div className="space-y-3">
            {cmrCollections.map(col => {
              const isExpanded = selectedCollectionId === col.id;
              return (
                <div
                  key={col.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-white">{col.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                        <span className="text-emerald-400">{col.id}</span>
                        {col.dataCenter && <span>• {col.dataCenter}</span>}
                        {col.platforms.length > 0 && <span>• Platforms: {col.platforms.join(', ')}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelectCollection(col.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 shrink-0"
                    >
                      {isExpanded ? 'Hide Granules' : 'Inspect Granules'}
                    </button>
                  </div>

                  {col.summary && (
                    <p className="text-xs text-slate-300 line-clamp-2">{col.summary}</p>
                  )}

                  {(col.timeStart || col.timeEnd) && (
                    <div className="text-[11px] font-mono text-slate-400">
                      Temporal Coverage: {col.timeStart?.slice(0, 10) || '?'} → {col.timeEnd?.slice(0, 10) || 'Present'}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-800 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                        Recent CMR Granules
                      </div>
                      {granulesLoading ? (
                        <div className="flex items-center space-x-2 text-xs text-slate-400 py-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Querying granules for {col.id}...</span>
                        </div>
                      ) : granules.length === 0 ? (
                        <div className="text-xs text-slate-500">No recent public granules listed.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {granules.map(g => (
                            <div
                              key={g.id}
                              className="bg-[#030915] border border-slate-800 rounded-xl p-2.5 text-[11px] font-mono space-y-1"
                            >
                              <div className="text-white font-semibold truncate" title={g.title}>
                                {g.title}
                              </div>
                              <div className="text-slate-400">
                                {g.timeStart.slice(0, 10)} → {g.timeEnd.slice(0, 10)}
                              </div>
                              {g.downloadLinks[0] && (
                                <a
                                  href={g.downloadLinks[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 underline"
                                >
                                  <span>Granule Link</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
