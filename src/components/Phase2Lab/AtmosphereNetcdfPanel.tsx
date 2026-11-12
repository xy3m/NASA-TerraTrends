import React, { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  CloudRain,
  Wind,
  FileCode2,
  Send,
  Play,
  Loader2,
  ExternalLink,
  ArrowRight,
  Grid,
} from 'lucide-react';
import {
  AppeearsPointResponse,
  NetcdfExtractResponse,
  NetcdfInspectResponse,
  phase2Api,
  Phase2SeriesHandoff,
  TraceGasResponse,
  VerticalProfileResponse,
} from '../../services/phase2Api';
import { InfoBanner, MetricTile, Phase2ErrorAlert, ProvenanceBanner } from './shared';

interface AtmosphereNetcdfPanelProps {
  onSendSeries: (series: Phase2SeriesHandoff) => void;
  onSendCube: (cube: { label: string; cube: (number | null)[][][] }) => void;
}

type SubTab = 'vertical' | 'trace' | 'netcdf' | 'appeears';

export const AtmosphereNetcdfPanel: React.FC<AtmosphereNetcdfPanelProps> = ({
  onSendSeries,
  onSendCube,
}) => {
  const [subTab, setSubTab] = useState<SubTab>('vertical');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // Domain 1: Vertical Profile
  const [vpLat, setVpLat] = useState(0);
  const [vpLon, setVpLon] = useState(-60);
  const [vpProduct, setVpProduct] = useState<'AIRS3STM' | 'MERRA2_M2IMNPASM'>('AIRS3STM');
  const [vpRes, setVpRes] = useState<VerticalProfileResponse | null>(null);

  // Domain 11: Trace Gases
  const [gas, setGas] = useState<'NO2' | 'CH4' | 'CO' | 'SO2'>('NO2');
  const [gasLat, setGasLat] = useState(31.2);
  const [gasLon, setGasLon] = useState(121.5);
  const [gasRes, setGasRes] = useState<TraceGasResponse | null>(null);

  // NetCDF4 / HDF5 xarray
  const [ncFile, setNcFile] = useState<File | null>(null);
  const [ncInspect, setNcInspect] = useState<NetcdfInspectResponse | null>(null);
  const [selectedVar, setSelectedVar] = useState<string>('');
  const [spatialMean, setSpatialMean] = useState(true);
  const [extractLat, setExtractLat] = useState<string>('');
  const [extractLon, setExtractLon] = useState<string>('');
  const [ncExtract, setNcExtract] = useState<NetcdfExtractResponse | null>(null);

  // AppEEARS
  const [appProduct, setAppProduct] = useState('MOD13Q1.061');
  const [appLayer, setAppLayer] = useState('_250m_16_days_NDVI');
  const [appLat, setAppLat] = useState(-3.1);
  const [appLon, setAppLon] = useState(-60.0);
  const [appRes, setAppRes] = useState<AppeearsPointResponse | null>(null);

  const runVertical = async () => {
    setLoading(true);
    setError(null);
    try {
      setVpRes(
        await phase2Api.getVerticalProfile({
          lat: vpLat,
          lon: vpLon,
          product: vpProduct,
          start_year: 2003,
          end_year: 2024,
        })
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const runTraceGas = async () => {
    setLoading(true);
    setError(null);
    try {
      setGasRes(
        await phase2Api.getTraceGases({
          gas,
          lat: gasLat,
          lon: gasLon,
          start_year: 2018,
          end_year: 2025,
        })
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectNetcdf = async (file: File) => {
    setNcFile(file);
    setNcExtract(null);
    setLoading(true);
    setError(null);
    try {
      const info = await phase2Api.inspectNetcdf(file);
      setNcInspect(info);
      setSelectedVar(info.variables[0]?.name || '');
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractNetcdf = async () => {
    if (!ncFile) return;
    setLoading(true);
    setError(null);
    try {
      const res = await phase2Api.extractNetcdf(ncFile, {
        variable: selectedVar || undefined,
        target_lat: extractLat.trim() ? Number(extractLat) : null,
        target_lon: extractLon.trim() ? Number(extractLon) : null,
        spatial_mean: spatialMean,
      });
      setNcExtract(res);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const runAppeears = async () => {
    setLoading(true);
    setError(null);
    try {
      setAppRes(
        await phase2Api.submitAppeearsPoint({
          product: appProduct,
          layer: appLayer,
          lat: appLat,
          lon: appLon,
          start_date: '01-01-2020',
          end_date: '12-31-2024',
          task_name: 'geo_iris_point_extract',
        })
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'vertical' && !vpRes) void runVertical();
    if (subTab === 'trace' && !gasRes) void runTraceGas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'vertical' as const, label: 'Domain 1: Vertical Pressure Profile', icon: CloudRain },
          { id: 'trace' as const, label: 'Domain 11: Trace Gases (NO₂, CH₄, CO, SO₂)', icon: Wind },
          { id: 'netcdf' as const, label: 'NetCDF4 / HDF5 Xarray Extractor', icon: FileCode2 },
          { id: 'appeears' as const, label: 'NASA AppEEARS Point Proxy', icon: Send },
        ].map((item) => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSubTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition ${
                active
                  ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200'
                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      <Phase2ErrorAlert error={error} />

      {/* ================================================================= */}
      {/* 1. VERTICAL SOUNDING PROFILE                                      */}
      {/* ================================================================= */}
      {subTab === 'vertical' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Satellite / Reanalysis</span>
              <select
                value={vpProduct}
                onChange={(e) => setVpProduct(e.target.value as typeof vpProduct)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="AIRS3STM">AIRS Level-3 (AIRS3STM)</option>
                <option value="MERRA2_M2IMNPASM">MERRA-2 Pressure (M2IMNPASM)</option>
              </select>
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Latitude (°)</span>
              <input
                type="number"
                value={vpLat}
                onChange={(e) => setVpLat(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Longitude (°)</span>
              <input
                type="number"
                value={vpLon}
                onChange={(e) => setVpLon(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>
            <button
              onClick={() => void runVertical()}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Sound Profile + CMR
            </button>
          </div>

          {vpRes && (
            <>
              <ProvenanceBanner provenance={vpRes.provenance} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
                  <div className="text-xs font-bold text-slate-200 mb-2">
                    Vertical Trend Fingerprint: Tropospheric Warming vs Stratospheric Cooling (°C/decade)
                  </div>
                  <div className="h-72">
                    <Bar
                      data={{
                        labels: vpRes.profile_by_pressure.map(
                          (r) => `${r.pressure_hpa} hPa (${r.altitude_km} km)`
                        ),
                        datasets: [
                          {
                            label: 'Decadal Trend (°C/decade)',
                            data: vpRes.profile_by_pressure.map((r) => r.trend_c_per_decade),
                            backgroundColor: vpRes.profile_by_pressure.map((r) =>
                              r.trend_c_per_decade >= 0
                                ? 'rgba(244, 63, 94, 0.72)'
                                : 'rgba(56, 189, 248, 0.72)'
                            ),
                          },
                        ],
                      }}
                      options={{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                          y: { ticks: { color: '#cbd5e1', font: { size: 10 } }, grid: { display: false } },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 overflow-x-auto space-y-3">
                  <div className="text-xs font-bold text-slate-200">
                    Pressure Level Summary &amp; Live NASA CMR Granules
                  </div>
                  <table className="w-full text-[11px] font-mono text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="py-1 pr-2">Level</th>
                        <th className="py-1 pr-2">Regime</th>
                        <th className="py-1 pr-2">Trend/dec</th>
                        <th className="py-1">p-val</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vpRes.profile_by_pressure.map((row) => (
                        <tr key={row.pressure_hpa} className="border-b border-slate-800/40 text-slate-300">
                          <td className="py-1 pr-2">{row.pressure_hpa} hPa</td>
                          <td className="py-1 pr-2 text-slate-400">{row.regime}</td>
                          <td
                            className={`py-1 pr-2 font-bold ${
                              row.trend_c_per_decade >= 0 ? 'text-rose-400' : 'text-cyan-400'
                            }`}
                          >
                            {row.trend_c_per_decade > 0 ? '+' : ''}
                            {row.trend_c_per_decade.toFixed(3)} °C
                          </td>
                          <td className="py-1">{row.p_value.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {vpRes.cmr_granules.length > 0 && (
                    <div className="pt-2 border-t border-slate-800 text-[10px] space-y-1">
                      <div className="font-bold text-emerald-300">
                        Matching Live NASA CMR Granules ({vpRes.cmr_granules.length}):
                      </div>
                      {vpRes.cmr_granules.map((g, i) => (
                        <div key={i} className="flex items-center justify-between text-slate-400 font-mono">
                          <span className="truncate max-w-[260px]">{g.title || g.id}</span>
                          {g.links?.[0] && (
                            <a
                              href={g.links[0]}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline inline-flex items-center gap-0.5 shrink-0"
                            >
                              OPeNDAP/Link <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 2. TRACE GASES                                                    */}
      {/* ================================================================= */}
      {subTab === 'trace' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Trace Gas Species</span>
              <select
                value={gas}
                onChange={(e) => setGas(e.target.value as typeof gas)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                <option value="NO2">NO₂ (OMI / TROPOMI)</option>
                <option value="CH4">CH₄ Methane Column</option>
                <option value="CO">CO Wildfire Tracer</option>
                <option value="SO2">SO₂ Volcanic/Industrial</option>
              </select>
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Latitude (°)</span>
              <input
                type="number"
                step={0.5}
                value={gasLat}
                onChange={(e) => setGasLat(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Longitude (°)</span>
              <input
                type="number"
                step={0.5}
                value={gasLon}
                onChange={(e) => setGasLon(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
              />
            </label>
            <button
              onClick={() => void runTraceGas()}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Analyze {gas} Column
            </button>
          </div>

          {gasRes && (
            <>
              <ProvenanceBanner provenance={gasRes.provenance} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricTile label="Species / Sensor" value={gasRes.gas} sub={gasRes.sensor} accent="text-cyan-300" />
                <MetricTile
                  label="Decadal Slope"
                  value={`${gasRes.trend_per_decade > 0 ? '+' : ''}${gasRes.trend_per_decade.toFixed(3)}`}
                  sub={`${gasRes.unit}/dec`}
                  accent={gasRes.trend_per_decade >= 0 ? 'text-rose-300' : 'text-emerald-300'}
                />
                <MetricTile label="R² Explained" value={gasRes.r_squared.toFixed(3)} />
                <MetricTile label="Trend p-value" value={gasRes.p_value.toFixed(4)} />
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-200">
                    {gasRes.gas} Monthly Column Series ({gasRes.unit})
                  </div>
                  <button
                    onClick={() =>
                      onSendSeries({
                        title: `${gasRes.gas} Atmospheric Column`,
                        unit: gasRes.unit,
                        regionName: gasRes.region_label,
                        dates: gasRes.dates,
                        values: gasRes.values,
                        provenanceTier: gasRes.provenance.tier,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/80 hover:bg-purple-500 text-[11px] font-bold text-white cursor-pointer"
                  >
                    Send to SARIMA / Bayesian MCMC
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="h-64">
                  <Line
                    data={{
                      labels: gasRes.dates,
                      datasets: [
                        {
                          label: `${gasRes.gas} (${gasRes.unit})`,
                          data: gasRes.values,
                          borderColor: '#38bdf8',
                          backgroundColor: 'rgba(56, 189, 248, 0.14)',
                          fill: true,
                          pointRadius: 1.4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                      scales: {
                        x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 }, grid: { display: false } },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                      },
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. NETCDF4 / HDF5 XARRAY FILE INSPECTOR & EXTRACTOR               */}
      {/* ================================================================= */}
      {subTab === 'netcdf' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-100">
                  Server-Side NASA NetCDF4 / HDF5 Xarray Inspector (.nc, .nc4, .h5)
                </div>
                <p className="text-[11px] text-slate-400">
                  Upload any gridded climate or satellite product; inspect variables &amp; extract 1D time-series or 3D cubes directly into SARIMA, MCMC &amp; Spatial FDR.
                </p>
              </div>
              <input
                type="file"
                accept=".nc,.nc4,.h5,.hdf5"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleInspectNetcdf(f);
                }}
                className="text-xs text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-cyan-600 file:text-white file:font-semibold cursor-pointer"
              />
            </div>

            {ncInspect && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-slate-300">
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    File: {ncInspect.filename}
                  </span>
                  {Object.entries(ncInspect.dims).map(([d, sz]) => (
                    <span key={d} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-cyan-300">
                      {d}: {sz}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <label className="text-[11px] text-slate-300 space-y-1 lg:col-span-2">
                    <span className="block text-slate-400 font-semibold">Variable to Extract</span>
                    <select
                      value={selectedVar}
                      onChange={(e) => setSelectedVar(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      {ncInspect.variables.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} ({v.units}) [{v.dims.join('×')}]
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-[11px] text-slate-300 space-y-1">
                    <span className="block text-slate-400 font-semibold">Target Lat (opt)</span>
                    <input
                      type="text"
                      value={extractLat}
                      placeholder="Auto / Center"
                      disabled={spatialMean}
                      onChange={(e) => setExtractLat(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono disabled:opacity-40"
                    />
                  </label>

                  <label className="text-[11px] text-slate-300 space-y-1">
                    <span className="block text-slate-400 font-semibold">Spatial Reduction</span>
                    <select
                      value={spatialMean ? 'mean' : 'point'}
                      onChange={(e) => setSpatialMean(e.target.value === 'mean')}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    >
                      <option value="mean">Area-Weighted Spatial Mean</option>
                      <option value="point">Nearest Grid Pixel</option>
                    </select>
                  </label>

                  {!spatialMean && (
                    <label className="text-[11px] text-slate-300 space-y-1">
                      <span className="block text-slate-400 font-semibold">Target Lon (opt)</span>
                      <input
                        type="text"
                        value={extractLon}
                        placeholder="Auto / Center"
                        onChange={(e) => setExtractLon(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                      />
                    </label>
                  )}

                  <button
                    onClick={() => void handleExtractNetcdf()}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Extract via xarray
                  </button>
                </div>
              </div>
            )}
          </div>

          {ncExtract && (
            <div className="space-y-4">
              <ProvenanceBanner provenance={ncExtract.provenance} />
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-200">
                    Extracted Variable: <span className="text-cyan-300">{ncExtract.variable}</span> ({ncExtract.units})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        onSendSeries({
                          title: `NetCDF: ${ncExtract.variable}`,
                          unit: ncExtract.units,
                          regionName: ncInspect?.filename || 'NetCDF Subset',
                          dates: ncExtract.series.map((s) => s.date),
                          values: ncExtract.series.map((s) => s.value),
                          provenanceTier: 'user_upload',
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-[11px] font-bold text-white cursor-pointer"
                    >
                      Run SARIMA / MCMC <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {ncExtract.has_spatial_cube && ncExtract.spatial_cube && (
                      <button
                        onClick={() =>
                          onSendCube({
                            label: `${ncExtract.variable} (${ncInspect?.filename || 'NetCDF'})`,
                            cube: ncExtract.spatial_cube!,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[11px] font-bold text-white cursor-pointer"
                      >
                        <Grid className="w-3.5 h-3.5" />
                        Run Spatial FDR on 3D Cube
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-64">
                  <Line
                    data={{
                      labels: ncExtract.series.map((s) => s.date),
                      datasets: [
                        {
                          label: `${ncExtract.variable} (${ncExtract.units})`,
                          data: ncExtract.series.map((s) => s.value),
                          borderColor: '#10b981',
                          pointRadius: 1.5,
                          spanGaps: false,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { labels: { color: '#cbd5e1', font: { size: 11 } } } },
                      scales: {
                        x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 }, grid: { display: false } },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.1)' } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 4. APPEEARS ASYNC POINT TASK PROXY                                */}
      {/* ================================================================= */}
      {subTab === 'appeears' && (
        <div className="space-y-4">
          <InfoBanner>
            NASA AppEEARS (Application for Extracting and Exploring Analysis Ready Samples) provides point and polygon
            time series for MODIS, VIIRS, Daymet, SMAP, and ECOSTRESS. Configure Earthdata Login credentials via the
            Backend Auth drawer above to submit live tasks.
          </InfoBanner>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Product ID</span>
              <input
                type="text"
                value={appProduct}
                onChange={(e) => setAppProduct(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Science Layer</span>
              <input
                type="text"
                value={appLayer}
                onChange={(e) => setAppLayer(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Lat</span>
              <input
                type="number"
                step={0.1}
                value={appLat}
                onChange={(e) => setAppLat(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </label>
            <label className="text-[11px] text-slate-300 space-y-1">
              <span className="block text-slate-400 font-semibold">Lon</span>
              <input
                type="number"
                step={0.1}
                value={appLon}
                onChange={(e) => setAppLon(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
              />
            </label>
            <button
              onClick={() => void runAppeears()}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-xs font-bold text-white cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit AppEEARS Task
            </button>
          </div>

          {appRes && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                    appRes.status === 'submitted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {appRes.status}
                </span>
                <span className="text-slate-200">{appRes.message}</span>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-200 overflow-x-auto">
                {JSON.stringify(appRes.appeears_response ?? appRes.task_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
