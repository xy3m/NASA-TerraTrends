import React, { useEffect, useState } from 'react';
import {
  Cpu,
  KeyRound,
  RefreshCw,
  Server,
  TrendingUp,
  Grid,
  Mountain,
  Flame,
  Wind,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getBackendBaseUrl,
  HealthResponse,
  phase2Api,
  Phase2SeriesHandoff,
  setBackendBaseUrl,
} from '../../services/phase2Api';
import { ForecastMcmcPanel } from './ForecastMcmcPanel';
import { SpatialFdrPanel } from './SpatialFdrPanel';
import { RasterChangePanel } from './RasterChangePanel';
import { FirmsWildfirePanel } from './FirmsWildfirePanel';
import { AtmosphereNetcdfPanel } from './AtmosphereNetcdfPanel';

export type Phase2ModuleId = 'forecast_mcmc' | 'spatial_fdr' | 'rasters' | 'firms' | 'atmosphere';

interface Phase2LabProps {
  initialHandoff?: Phase2SeriesHandoff | null;
  onClearHandoff?: () => void;
}

export const Phase2Lab: React.FC<Phase2LabProps> = ({ initialHandoff, onClearHandoff }) => {
  const [activeTab, setActiveTab] = useState<Phase2ModuleId>('forecast_mcmc');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);

  const [localHandoff, setLocalHandoff] = useState<Phase2SeriesHandoff | null>(initialHandoff ?? null);
  const [externalCube, setExternalCube] = useState<{
    label: string;
    cube: (number | null)[][][];
  } | null>(null);

  // Settings / Session Credentials drawer state
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(getBackendBaseUrl());
  const [edlToken, setEdlToken] = useState('');
  const [edlUser, setEdlUser] = useState('');
  const [edlPass, setEdlPass] = useState('');
  const [firmsKey, setFirmsKey] = useState('');
  const [authSaving, setAuthSaving] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    if (initialHandoff) {
      setLocalHandoff(initialHandoff);
      setActiveTab('forecast_mcmc');
    }
  }, [initialHandoff]);

  const checkHealth = async () => {
    setHealthChecking(true);
    try {
      const h = await phase2Api.getHealth();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setHealthChecking(false);
    }
  };

  useEffect(() => {
    void checkHealth();
  }, []);

  const handleSaveBackendUrl = () => {
    setBackendBaseUrl(backendUrlInput);
    setAuthNotice(
      backendUrlInput.trim()
        ? `Backend target updated to ${backendUrlInput.trim()}`
        : 'Backend target reset to Vite /api proxy (default localhost:8000)'
    );
    void checkHealth();
  };

  const handleSaveSessionAuth = async (clear = false) => {
    setAuthSaving(true);
    setAuthNotice(null);
    try {
      await phase2Api.configureAuth(
        clear
          ? { clear_session: true }
          : {
              earthdata_token: edlToken.trim() || undefined,
              earthdata_username: edlUser.trim() || undefined,
              earthdata_password: edlPass.trim() || undefined,
              firms_map_key: firmsKey.trim() || undefined,
            }
      );
      if (clear) {
        setEdlToken('');
        setEdlUser('');
        setEdlPass('');
        setFirmsKey('');
      }
      await checkHealth();
      setAuthNotice(
        clear ? 'Session credentials cleared.' : 'Session credentials registered in Python backend memory.'
      );
    } catch (err) {
      setAuthNotice(err instanceof Error ? err.message : 'Failed to configure session credentials');
    } finally {
      setAuthSaving(false);
    }
  };

  const modules: Array<{ id: Phase2ModuleId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'forecast_mcmc', label: 'SARIMA, Bayesian MCMC & Extremes', icon: TrendingUp },
    { id: 'spatial_fdr', label: 'Gridded Spatial FDR (Wilks)', icon: Grid },
    { id: 'rasters', label: 'DEM, SAR & LULC Rasters', icon: Mountain },
    { id: 'firms', label: 'FIRMS & EONET Wildfires', icon: Flame },
    { id: 'atmosphere', label: 'Vertical, Trace Gases & NetCDF4', icon: Wind },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Phase 2 Header Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/35 border border-slate-800 p-5 shadow-2xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                <Cpu className="w-3.5 h-3.5" />
                Phase 2 Scientific Engine
              </span>
              {health ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Python FastAPI Online (v{health.version})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-bold">
                  <AlertTriangle className="w-3 h-3" />
                  Backend Offline (Start uvicorn on :8000)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Geo-Iris Phase 2 Computational Modeling &amp; Geospatial Lab
            </h1>
            <p className="text-xs text-slate-400 max-w-3xl">
              Server-side Python scientific workflows powered by Statsmodels SARIMAX, Adaptive MCMC posterior
              sampling, Wilks Spatial FDR, Xarray NetCDF4/HDF5 extraction, Rasterio DEM/SAR/LULC analysis,
              and live NASA FIRMS / EONET / ASF / CMR feeds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => void checkHealth()}
              disabled={healthChecking}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthChecking ? 'animate-spin' : ''}`} />
              Ping API
            </button>
            <button
              onClick={() => setShowAuthDrawer((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                showAuthDrawer
                  ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-950/90 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Backend &amp; NASA Auth
            </button>
          </div>
        </div>

        {/* Collapsible Backend URL + Session NASA Credentials Drawer */}
        {showAuthDrawer && (
          <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Server className="w-4 h-4 text-cyan-400" />
                  FastAPI Backend URL (Optional Override)
                </div>
                <p className="text-[11px] text-slate-400">
                  Leave empty in local dev to route seamlessly through Vite&#39;s proxy (<code>/api &rarr; 127.0.0.1:8000</code>),
                  or specify a hosted backend URL (e.g. <code>https://your-fastapi-host.run.app</code>).
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backendUrlInput}
                    onChange={(e) => setBackendUrlInput(e.target.value)}
                    placeholder="Empty = Vite /api proxy (default localhost:8000)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <button
                    onClick={handleSaveBackendUrl}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white cursor-pointer"
                  >
                    Apply URL
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Session-Only NASA Credentials (In-Memory Only)
                  </div>
                  {health && (
                    <span className="text-[10px] font-mono text-slate-400">
                      EDL: {health.auth.earthdata_configured ? `Active (${health.auth.earthdata_source})` : 'Keyless'} &middot;
                      FIRMS: {health.auth.firms_configured ? `Active (${health.auth.firms_source})` : 'EONET Fallback'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="password"
                    value={firmsKey}
                    onChange={(e) => setFirmsKey(e.target.value)}
                    placeholder="NASA FIRMS MAP_KEY"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <input
                    type="password"
                    value={edlToken}
                    onChange={(e) => setEdlToken(e.target.value)}
                    placeholder="Earthdata Bearer Token"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <input
                    type="text"
                    value={edlUser}
                    onChange={(e) => setEdlUser(e.target.value)}
                    placeholder="Earthdata Username (opt)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <input
                    type="password"
                    value={edlPass}
                    onChange={(e) => setEdlPass(e.target.value)}
                    placeholder="Earthdata Password (opt)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => void handleSaveSessionAuth(false)}
                    disabled={authSaving}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                  >
                    Save Session Keys
                  </button>
                  <button
                    onClick={() => void handleSaveSessionAuth(true)}
                    disabled={authSaving}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                  >
                    Clear Session
                  </button>
                  {authNotice && <span className="text-[11px] text-cyan-300">{authNotice}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5 Module Tabs */}
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80">
          {modules.map((mod) => {
            const Icon = mod.icon;
            const active = activeTab === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveTab(mod.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 shadow-lg shadow-cyan-950/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {mod.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Phase 2 Workspace */}
      {activeTab === 'forecast_mcmc' && (
        <ForecastMcmcPanel
          handoffSeries={localHandoff}
          onClearHandoff={() => {
            setLocalHandoff(null);
            onClearHandoff?.();
          }}
        />
      )}

      {activeTab === 'spatial_fdr' && (
        <SpatialFdrPanel
          externalCube={externalCube}
          onClearExternalCube={() => setExternalCube(null)}
        />
      )}

      {activeTab === 'rasters' && <RasterChangePanel />}

      {activeTab === 'firms' && <FirmsWildfirePanel />}

      {activeTab === 'atmosphere' && (
        <AtmosphereNetcdfPanel
          onSendSeries={(series) => {
            setLocalHandoff(series);
            setActiveTab('forecast_mcmc');
          }}
          onSendCube={(cubePayload) => {
            setExternalCube(cubePayload);
            setActiveTab('spatial_fdr');
          }}
        />
      )}
    </div>
  );
};
