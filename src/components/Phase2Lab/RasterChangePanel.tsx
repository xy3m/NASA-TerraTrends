import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Mountain,
  Radar,
  Layers,
  Upload,
  Play,
  Loader2,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  phase2Api,
  DemDiffResponse,
  SarChangeResponse,
  AsfSearchResponse,
  LulcTransitionResponse,
} from '../../services/phase2Api';
import { MetricTile, Phase2ErrorAlert, ProvenanceBanner } from './shared';

type RasterTab = 'dem' | 'sar' | 'lulc';

export const RasterChangePanel: React.FC = () => {
  const [tab, setTab] = useState<RasterTab>('dem');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // DEM DoD state
  const [demScenario, setDemScenario] = useState<
    'mount_st_helens_lahar' | 'colorado_river_incision' | 'thwaites_glacier_thinning'
  >('mount_st_helens_lahar');
  const [lodM, setLodM] = useState(0.75);
  const [demFiles, setDemFiles] = useState<{ before: File | null; after: File | null }>({
    before: null,
    after: null,
  });
  const [demRes, setDemRes] = useState<DemDiffResponse | null>(null);

  // SAR state + ASF live search
  const [sarScenario, setSarScenario] = useState<
    'amazon_seasonal_flooding' | 'rondonia_deforestation_clearcut' | 'kilauea_lava_emplacement'
  >('amazon_seasonal_flooding');
  const [speckleFilter, setSpeckleFilter] = useState<'lee' | 'mean' | 'none'>('lee');
  const [windowSize, setWindowSize] = useState(5);
  const [thresholdDb, setThresholdDb] = useState(3.0);
  const [sarFiles, setSarFiles] = useState<{ before: File | null; after: File | null }>({
    before: null,
    after: null,
  });
  const [sarRes, setSarRes] = useState<SarChangeResponse | null>(null);

  const [asfLat, setAsfLat] = useState(-3.46);
  const [asfLon, setAsfLon] = useState(-62.21);
  const [asfPlatform, setAsfPlatform] = useState<'SENTINEL-1' | 'ALOS' | 'UAVSAR' | 'SEASAT'>('SENTINEL-1');
  const [asfLoading, setAsfLoading] = useState(false);
  const [asfRes, setAsfRes] = useState<AsfSearchResponse | null>(null);

  // LULC state
  const [lulcScenario, setLulcScenario] = useState<
    'amazon_arc_deforestation' | 'pearl_river_urbanization' | 'aral_sea_desiccation'
  >('amazon_arc_deforestation');
  const [lulcFiles, setLulcFiles] = useState<{ before: File | null; after: File | null }>({
    before: null,
    after: null,
  });
  const [lulcRes, setLulcRes] = useState<LulcTransitionResponse | null>(null);

  const runCurrent = async (forceTab: RasterTab = tab) => {
    setLoading(true);
    setError(null);
    try {
      if (forceTab === 'dem') {
        if (demFiles.before && demFiles.after) {
          setDemRes(await phase2Api.runDemUpload(demFiles.before, demFiles.after, lodM));
        } else {
          setDemRes(await phase2Api.runDemPreset({ scenario: demScenario, lod_threshold_m: lodM }));
        }
      } else if (forceTab === 'sar') {
        if (sarFiles.before && sarFiles.after) {
          setSarRes(
            await phase2Api.runSarUpload(sarFiles.before, sarFiles.after, {
              speckle_filter: speckleFilter,
              window_size: windowSize,
              threshold_db: thresholdDb,
            })
          );
        } else {
          setSarRes(
            await phase2Api.runSarPreset({
              scenario: sarScenario,
              speckle_filter: speckleFilter,
              window_size: windowSize,
              threshold_db: thresholdDb,
            })
          );
        }
      } else {
        if (lulcFiles.before && lulcFiles.after) {
          setLulcRes(await phase2Api.runLulcUpload(lulcFiles.before, lulcFiles.after));
        } else {
          setLulcRes(await phase2Api.runLulcPreset({ scenario: lulcScenario }));
        }
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const runAsfSearch = async () => {
    setAsfLoading(true);
    setError(null);
    try {
      const out = await phase2Api.searchAsfSar({
        lat: asfLat,
        lon: asfLon,
        platform: asfPlatform,
        radius_deg: 0.4,
        max_results: 8,
      });
      setAsfRes(out);
    } catch (err) {
      setError(err);
    } finally {
      setAsfLoading(false);
    }
  };

  useEffect(() => {
    void runCurrent(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, demScenario, sarScenario, lulcScenario]);

  const histogramOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true }, grid: { display: false } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'dem' as const, label: 'DEM Differencing (DoD & Volume)', icon: Mountain },
          { id: 'sar' as const, label: 'SAR Change Detection & NASA ASF', icon: Radar },
          { id: 'lulc' as const, label: 'LULC Transition Matrix & κ', icon: Layers },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition ${
                active
                  ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200'
                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <Phase2ErrorAlert error={error} onRetry={() => void runCurrent(tab)} />

      {/* ================================================================= */}
      {/* TAB 1: DEM DIFFERENCING (DoD)                                     */}
      {/* ================================================================= */}
      {tab === 'dem' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Benchmark Terrain Scenario</span>
              <select
                value={demScenario}
                onChange={(e) => {
                  setDemFiles({ before: null, after: null });
                  setDemScenario(e.target.value as typeof demScenario);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="mount_st_helens_lahar">Mount St. Helens Lahar</option>
                <option value="colorado_river_incision">Colorado Canyon Incision</option>
                <option value="thwaites_glacier_thinning">Thwaites Glacier Thinning</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">LoD Error Threshold (m)</span>
              <input
                type="number"
                step={0.1}
                min={0}
                max={10}
                value={lodM}
                onChange={(e) => setLodM(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Before DEM GeoTIFF</span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={(e) => setDemFiles((p) => ({ ...p, before: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200"
              />
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">After DEM GeoTIFF</span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={(e) => setDemFiles((p) => ({ ...p, after: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200"
              />
            </label>

            <button
              onClick={() => void runCurrent('dem')}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : demFiles.before && demFiles.after ? <Upload className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {demFiles.before && demFiles.after ? 'Analyze GeoTIFF Pair' : 'Compute DEM DoD'}
            </button>
          </div>

          {demRes && (
            <>
              <ProvenanceBanner provenance={demRes.provenance} />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <MetricTile label="Mean ΔZ" value={`${demRes.summary.mean_elevation_change_m} m`} />
                <MetricTile
                  label="Max Deposition"
                  value={`+${demRes.summary.max_deposition_m} m`}
                  accent="text-cyan-300"
                />
                <MetricTile
                  label="Max Erosion"
                  value={`${demRes.summary.max_erosion_m} m`}
                  accent="text-rose-300"
                />
                <MetricTile label="% Area > LoD" value={`${demRes.summary.pct_area_changed}%`} />
                <MetricTile
                  label="Deposition Volume"
                  value={`${(demRes.summary.deposition_volume_m3 / 1000).toFixed(1)}k m³`}
                  accent="text-cyan-300"
                />
                <MetricTile
                  label="Net Volume Budget"
                  value={`${(demRes.summary.net_volume_change_m3 / 1000).toFixed(1)}k m³`}
                  sub={`Erosion: ${(demRes.summary.erosion_volume_m3 / 1000).toFixed(1)}k m³`}
                  accent={demRes.summary.net_volume_change_m3 >= 0 ? 'text-emerald-300' : 'text-amber-300'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { title: 'Epoch 1 Elevation (Before)', src: demRes.images.before_png },
                  { title: 'Epoch 2 Elevation (After)', src: demRes.images.after_png },
                  { title: 'DEM of Difference (Z2 - Z1)', src: demRes.images.dod_png },
                  { title: `LoD Mask (|ΔZ| ≥ ${demRes.lod_threshold_m} m)`, src: demRes.images.lod_mask_png },
                ].map((panel) => (
                  <div key={panel.title} className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">{panel.title}</div>
                    <img src={panel.src} alt={panel.title} className="w-full rounded-lg bg-slate-950 border border-slate-800" />
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                <div className="text-xs font-bold text-slate-200 mb-2">
                  Elevation Difference Distribution (meters)
                </div>
                <div className="h-52">
                  <Bar
                    data={{
                      labels: demRes.histogram.centers_m.map((v) => v.toFixed(1)),
                      datasets: [
                        {
                          data: demRes.histogram.counts,
                          backgroundColor: demRes.histogram.centers_m.map((v) =>
                            v >= 0 ? 'rgba(56, 189, 248, 0.7)' : 'rgba(244, 63, 94, 0.7)'
                          ),
                        },
                      ],
                    }}
                    options={histogramOptions}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: SAR SPECKLE & CHANGE DETECTION + ASF CATALOG               */}
      {/* ================================================================= */}
      {tab === 'sar' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1 lg:col-span-2">
              <span className="block text-slate-400 font-semibold">SAR Scenario / GeoTIFF Pair</span>
              <select
                value={sarScenario}
                onChange={(e) => {
                  setSarFiles({ before: null, after: null });
                  setSarScenario(e.target.value as typeof sarScenario);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="amazon_seasonal_flooding">Amazon Floodplain Backscatter Drop</option>
                <option value="rondonia_deforestation_clearcut">Rondônia Forest Clearcut Drop</option>
                <option value="kilauea_lava_emplacement">Kīlauea Lava Flow Emplacement</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Speckle Filter</span>
              <select
                value={speckleFilter}
                onChange={(e) => setSpeckleFilter(e.target.value as 'lee' | 'mean' | 'none')}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="lee">Adaptive Lee Filter</option>
                <option value="mean">Boxcar Mean</option>
                <option value="none">Unfiltered Raw</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Window (px)</span>
              <select
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              >
                <option value={3}>3 &times; 3</option>
                <option value={5}>5 &times; 5</option>
                <option value={7}>7 &times; 7</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Log-Ratio Cutoff (dB)</span>
              <input
                type="number"
                step={0.5}
                min={0.5}
                max={12}
                value={thresholdDb}
                onChange={(e) => setThresholdDb(Math.max(0.5, Number(e.target.value) || 3))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>

            <button
              onClick={() => void runCurrent('sar')}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run SAR Ratio
            </button>

            <label className="text-[11px] text-slate-300 space-y-1 lg:col-span-3">
              <span className="block text-slate-400 font-semibold">Optional Pre-Event SAR GeoTIFF</span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={(e) => setSarFiles((p) => ({ ...p, before: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200"
              />
            </label>
            <label className="text-[11px] text-slate-300 space-y-1 lg:col-span-3">
              <span className="block text-slate-400 font-semibold">Optional Post-Event SAR GeoTIFF</span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={(e) => setSarFiles((p) => ({ ...p, after: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200"
              />
            </label>
          </div>

          {sarRes && (
            <>
              <ProvenanceBanner provenance={sarRes.provenance} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricTile
                  label="Flood / Canopy Loss Area"
                  value={`${sarRes.summary.backscatter_drop_area_km2} km²`}
                  accent="text-rose-300"
                />
                <MetricTile
                  label="Backscatter Gain Area"
                  value={`${sarRes.summary.backscatter_gain_area_km2} km²`}
                  accent="text-cyan-300"
                />
                <MetricTile label="% Footprint Changed" value={`${sarRes.summary.pct_changed}%`} />
                <MetricTile
                  label="Otsu Auto-Threshold"
                  value={`${sarRes.otsu_suggested_threshold_db} dB`}
                  sub={`Applied: ±${sarRes.threshold_db} dB`}
                  accent="text-amber-300"
                />
                <MetricTile
                  label="Mean ± Std Log-Ratio"
                  value={`${sarRes.summary.mean_log_ratio_db} dB`}
                  sub={`σ = ${sarRes.summary.std_log_ratio_db} dB`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { title: `Before σ0 (${sarRes.speckle_filter.toUpperCase()} filtered)`, src: sarRes.images.before_png },
                  { title: 'After σ0 (dB backscatter)', src: sarRes.images.after_png },
                  { title: 'Log-Ratio 10·log10(I2/I1) dB', src: sarRes.images.log_ratio_png },
                  { title: `Change Mask (±${sarRes.threshold_db} dB)`, src: sarRes.images.change_mask_png },
                ].map((panel) => (
                  <div key={panel.title} className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">{panel.title}</div>
                    <img src={panel.src} alt={panel.title} className="w-full rounded-lg bg-slate-950 border border-slate-800" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Live Keyless NASA ASF SAR Scene Search */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-100">
                  Live Keyless NASA Alaska Satellite Facility (ASF DAAC) SAR Granule Search
                </div>
                <p className="text-[11px] text-slate-400">
                  Queries public ESA Sentinel-1, ALOS PALSAR, and UAVSAR scenes around a target coordinate.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  step={0.1}
                  value={asfLat}
                  onChange={(e) => setAsfLat(Number(e.target.value) || 0)}
                  placeholder="Lat"
                  className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                />
                <input
                  type="number"
                  step={0.1}
                  value={asfLon}
                  onChange={(e) => setAsfLon(Number(e.target.value) || 0)}
                  placeholder="Lon"
                  className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                />
                <select
                  value={asfPlatform}
                  onChange={(e) => setAsfPlatform(e.target.value as typeof asfPlatform)}
                  className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="SENTINEL-1">Sentinel-1 C-SAR</option>
                  <option value="ALOS">ALOS PALSAR</option>
                  <option value="UAVSAR">NASA UAVSAR</option>
                </select>
                <button
                  onClick={() => void runAsfSearch()}
                  disabled={asfLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-cyan-300 cursor-pointer"
                >
                  {asfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Query ASF
                </button>
              </div>
            </div>

            {asfRes && (
              <div className="space-y-2">
                <ProvenanceBanner provenance={asfRes.provenance} />
                {asfRes.granules.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] font-mono text-left">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="py-1.5 pr-3">Scene ID</th>
                          <th className="py-1.5 pr-3">Mode / Pol</th>
                          <th className="py-1.5 pr-3">Acquisition</th>
                          <th className="py-1.5 pr-3">Size</th>
                          <th className="py-1.5">Links</th>
                        </tr>
                      </thead>
                      <tbody>
                        {asfRes.granules.map((g, i) => (
                          <tr key={i} className="border-b border-slate-800/40 text-slate-300">
                            <td className="py-1.5 pr-3 max-w-[240px] truncate">{g.scene_name}</td>
                            <td className="py-1.5 pr-3">
                              {g.beam_mode} ({g.polarization})
                            </td>
                            <td className="py-1.5 pr-3">{g.start_time?.slice(0, 16)}</td>
                            <td className="py-1.5 pr-3">{g.bytes_mb ? `${g.bytes_mb} MB` : '—'}</td>
                            <td className="py-1.5 flex items-center gap-2">
                              {g.browse_url && (
                                <a
                                  href={g.browse_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  Quicklook <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {g.download_url && (
                                <a
                                  href={g.download_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                                >
                                  Granule <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: LULC TRANSITION MATRIX                                     */}
      {/* ================================================================= */}
      {tab === 'lulc' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Land Cover Transition Preset</span>
              <select
                value={lulcScenario}
                onChange={(e) => {
                  setLulcFiles({ before: null, after: null });
                  setLulcScenario(e.target.value as typeof lulcScenario);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="amazon_arc_deforestation">Amazon Arc of Deforestation</option>
                <option value="pearl_river_urbanization">Pearl River Delta Urbanization</option>
                <option value="aral_sea_desiccation">Aral Sea Lake Desiccation</option>
              </select>
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Epoch 1 Classified GeoTIFF</span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={(e) => setLulcFiles((p) => ({ ...p, before: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200"
              />
            </label>

            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Epoch 2 Classified GeoTIFF</span>
              <input
                type="file"
                accept=".tif,.tiff"
                onChange={(e) => setLulcFiles((p) => ({ ...p, after: e.target.files?.[0] || null }))}
                className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200"
              />
            </label>

            <button
              onClick={() => void runCurrent('lulc')}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Compute Transitions
            </button>
          </div>

          {lulcRes && (
            <>
              <ProvenanceBanner provenance={lulcRes.provenance} />
              <div className="grid grid-cols-3 gap-3">
                <MetricTile
                  label="Cohen's Kappa (κ)"
                  value={lulcRes.cohen_kappa.toFixed(3)}
                  accent="text-purple-300"
                />
                <MetricTile
                  label="Class Persistence"
                  value={`${lulcRes.overall_persistence_pct}%`}
                  accent="text-emerald-300"
                />
                <MetricTile
                  label="Converted Footprint"
                  value={`${lulcRes.pct_changed}%`}
                  accent="text-amber-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: 'Epoch 1 Land Cover', src: lulcRes.images.before_png },
                  { title: 'Epoch 2 Land Cover', src: lulcRes.images.after_png },
                  { title: 'Class Transition Mask (Red = Changed)', src: lulcRes.images.change_mask_png },
                ].map((panel) => (
                  <div key={panel.title} className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-300">{panel.title}</div>
                    <img src={panel.src} alt={panel.title} className="w-full rounded-lg bg-slate-950 border border-slate-800" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <div className="text-xs font-bold text-slate-200 mb-2">Class Net Area Change Budget</div>
                  <table className="w-full text-[11px] font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-1.5 pr-3">Class</th>
                        <th className="py-1.5 pr-3">Before</th>
                        <th className="py-1.5 pr-3">After</th>
                        <th className="py-1.5 pr-3">Net Δ</th>
                        <th className="py-1.5">Persistence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lulcRes.classes.map((c) => (
                        <tr key={c.class_id} className="border-b border-slate-800/50 text-slate-200">
                          <td className="py-1.5 pr-3 font-sans font-semibold">{c.label}</td>
                          <td className="py-1.5 pr-3">{c.before_pct}%</td>
                          <td className="py-1.5 pr-3">{c.after_pct}%</td>
                          <td
                            className={`py-1.5 pr-3 font-bold ${
                              c.net_area_km2 > 0
                                ? 'text-emerald-400'
                                : c.net_area_km2 < 0
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {c.net_area_km2 > 0 ? '+' : ''}
                            {c.net_area_km2} km²
                          </td>
                          <td className="py-1.5">{c.persistence_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-x-auto">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    From → To Transition Area Matrix (km²)
                  </div>
                  <table className="w-full text-[10px] font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-1.5 pr-2">From \ To</th>
                        {lulcRes.transition_matrix.labels.map((lbl) => (
                          <th key={lbl} className="py-1.5 px-1.5 truncate max-w-[80px]">
                            {lbl}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lulcRes.transition_matrix.area_km2.map((row, rIdx) => (
                        <tr key={rIdx} className="border-b border-slate-800/40 text-slate-200">
                          <td className="py-1.5 pr-2 font-sans font-semibold text-slate-300">
                            {lulcRes.transition_matrix.labels[rIdx]}
                          </td>
                          {row.map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className={`py-1.5 px-1.5 ${
                                rIdx === cIdx
                                  ? 'bg-emerald-950/40 text-emerald-300 font-bold'
                                  : val > 0
                                  ? 'text-amber-300'
                                  : 'text-slate-600'
                              }`}
                            >
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
