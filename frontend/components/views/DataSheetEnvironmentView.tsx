import React, { useState } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { 
  FileSpreadsheet, 
  CloudRain, 
  CloudFog, 
  Download, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Sun, 
  Moon,
  Droplets,
  Gauge,
  Sliders
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { downloadCsv, downloadJson } from '../../utils/exportCsv';
import { ThreatLevel } from '../../types/telemetry';

export const DataSheetEnvironmentView: React.FC = () => {
  const { 
    proximityZones, 
    rainLevel, 
    setRainLevel, 
    fogLevel, 
    setFogLevel, 
    rainRate, 
    fogDensityPct, 
    ambientLux, 
    lightScatterCoeff, 
    roadWetness, 
    frictionMu, 
    hydroplaningRisk, 
    nightMode, 
    daylightMode,
    toggleNightMode, 
    agsActive, 
    glareDetected, 
    history 
  } = useTelemetry();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [threatFilter, setThreatFilter] = useState<string>('ALL');

  const tooltipStyle = {
    backgroundColor: daylightMode ? '#ffffff' : '#090D16',
    border: daylightMode ? '1px solid #0284C7' : '1px solid #00F0FF',
    color: daylightMode ? '#0f172a' : '#f8fafc',
    fontSize: '11px',
    fontFamily: 'monospace',
    boxShadow: daylightMode ? '0 4px 12px rgba(0,0,0,0.1)' : '0 0 10px rgba(0,240,255,0.2)'
  };
  const gridStroke = daylightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

  // Filtered proximity rows
  const filteredZones = proximityZones.filter((zone) => {
    const matchesSearch = zone.zone.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          zone.sensorType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          zone.direction.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesThreat = threatFilter === 'ALL' || zone.threatLevel === threatFilter;
    return matchesSearch && matchesThreat;
  });

  const getThreatBadge = (level: ThreatLevel) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-rose-950/80 text-rose-300 border border-rose-500/70 animate-pulse">CRITICAL</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-orange-950/80 text-orange-300 border border-orange-500/70">WARNING</span>;
      case 'CAUTION':
        return <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/70">CAUTION</span>;
      case 'SAFE':
        return <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/70">SAFE</span>;
      default:
        return <span className="px-2 py-0.5 rounded font-bold font-mono text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-500/70">CLEAR</span>;
    }
  };

  // Section D: CSV / JSON Exporters
  const handleExportCsv = () => {
    const headers = [
      'Sensor_Zone',
      'Direction',
      'Sensor_Type',
      'Current_Distance_M',
      'Min_Clearance_M',
      'Max_Range_M',
      'Obstacle_Detected',
      'Threat_Level',
      'Last_Trigger_Time'
    ];

    const rows = proximityZones.map((z) => [
      z.zone,
      z.direction,
      z.sensorType,
      z.distance.toFixed(2),
      z.minClearance.toFixed(2),
      z.maxRange.toFixed(2),
      z.obstacleDetected ? 'TRUE' : 'FALSE',
      z.threatLevel,
      z.lastTriggerTime
    ]);

    downloadCsv(`pravah_360_proximity_datasheet_${Date.now()}`, headers, rows);
  };

  const handleExportJson = () => {
    const exportPayload = {
      timestamp: new Date().toISOString(),
      weather: {
        rainLevel,
        rainRateMmH: rainRate,
        fogLevel,
        fogDensityPct,
        ambientLux,
        lightScatterCoeff,
        roadWetnessPct: roadWetness,
        frictionCoefficientMu: frictionMu,
        hydroplaningRisk,
        antiGlareShieldActive: agsActive,
      },
      proximitySensorMatrix: proximityZones,
      historicalBufferPoints: history.length,
    };

    downloadJson(`pravah_telemetry_snapshot_${Date.now()}`, exportPayload);
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fadeIn">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-500/20 dark:border-cyan-500/20">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-wider text-sky-700 dark:text-cyan-400 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
            04. DATA SHEET & ENVIRONMENTAL TELEMETRY
          </h1>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            360° Multi-Directional Proximity Data Sheet · Weather Diagnostics · Surface Friction Coefficient Analytics
          </p>
        </div>

        {/* Section D: Export Data Sheet Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white dark:bg-cyan-600 dark:hover:bg-cyan-500 dark:text-slate-950 font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(2,132,199,0.3)]"
          >
            <Download className="w-3.5 h-3.5 text-white dark:text-slate-950" />
            <span>EXPORT CSV</span>
          </button>
          <button
            onClick={handleExportJson}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sky-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-cyan-300 font-mono text-xs font-bold border border-sky-500/30 dark:border-cyan-500/30 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
            <span>EXPORT JSON</span>
          </button>
        </div>
      </div>

      {/* SECTION A: 360° Directional Proximity Data Sheet (Table View) */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
              SECTION A: 360° DIRECTIONAL PROXIMITY DATA SHEET
            </h2>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
              Comprehensive tabular telemetry across all 8 peripheral vehicle zones
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search sensor zone..."
                className="pl-8 pr-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
              />
            </div>

            <select
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
            >
              <option value="ALL">ALL THREATS</option>
              <option value="CLEAR">CLEAR</option>
              <option value="SAFE">SAFE</option>
              <option value="CAUTION">CAUTION</option>
              <option value="WARNING">WARNING</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        </div>

        {/* Proximity Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/90 text-sky-800 dark:text-cyan-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">SENSOR ZONE</th>
                <th className="py-2.5 px-3">DIRECTION</th>
                <th className="py-2.5 px-3">HARDWARE SENSOR</th>
                <th className="py-2.5 px-3">CURRENT CLEARANCE</th>
                <th className="py-2.5 px-3">MIN / MAX</th>
                <th className="py-2.5 px-3">OBSTACLE DETECTED</th>
                <th className="py-2.5 px-3">THREAT LEVEL</th>
                <th className="py-2.5 px-3">LAST TRIGGER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredZones.map((row) => (
                <tr key={row.id} className="hover:bg-sky-50 dark:hover:bg-cyan-950/20 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-cyan-400" />
                    {row.zone}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{row.direction}</td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">{row.sensorType}</td>
                  <td className="py-2.5 px-3 font-bold text-sky-700 dark:text-cyan-300 tabular-nums">
                    {row.distance.toFixed(2)} m
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 tabular-nums">
                    {row.minClearance.toFixed(1)}m / {row.maxRange.toFixed(1)}m
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.obstacleDetected ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-400/40 dark:border-amber-500/40' : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {row.obstacleDetected ? 'YES (TRACKED)' : 'NO (CLEAR)'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">{getThreatBadge(row.threatLevel)}</td>
                  <td className="py-2.5 px-3 text-slate-500 tabular-nums">{row.lastTriggerTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION B: Weather & Environmental Telemetry Panel */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
              SECTION B: WEATHER & ENVIRONMENTAL TELEMETRY PANEL
            </h2>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
              Atmospheric transmissivity, precipitation rate, and road surface friction metrics
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-600 dark:text-slate-400">WEATHER ENGINE: <strong className="text-emerald-600 dark:text-emerald-400">ACTIVE</strong></span>
          </div>
        </div>

        {/* 4 Environmental Telemetry Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Panel 1: Fog Density Index */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-300">
                  <CloudFog className="w-4 h-4 text-amber-500 dark:text-amber-400" /> FOG DENSITY INDEX
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">OPTICAL ATTN</span>
              </div>

              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                  {fogDensityPct}%
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">DENSITY</span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${fogDensityPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Transmissivity:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{(1 - (fogDensityPct / 100) * 0.75).toFixed(2)} T</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Scatter Coeff:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{lightScatterCoeff} /m</span>
              </div>
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>SET FOG LEVEL</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">LVL {fogLevel}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="5" 
                  value={fogLevel}
                  onChange={(e) => setFogLevel(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Panel 2: Precipitation / Rain Rate */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-blue-300">
                  <CloudRain className="w-4 h-4 text-sky-600 dark:text-blue-400" /> RAIN RATE INTENSITY
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">CAPACITIVE</span>
              </div>

              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-mono font-bold text-sky-700 dark:text-blue-300 tabular-nums">
                  {rainRate}
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">MM / HOUR</span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                <div 
                  className="h-full bg-sky-600 dark:bg-blue-400 transition-all duration-300"
                  style={{ width: `${(rainLevel / 5) * 100}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Sensor Voltage:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{(3.3 - (rainLevel * 0.45)).toFixed(2)} V</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Relative Humidity:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{55 + rainLevel * 8}%</span>
              </div>
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>SET RAIN LEVEL</span>
                  <span className="text-sky-700 dark:text-blue-400 font-bold">LVL {rainLevel}</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="5" 
                  value={rainLevel}
                  onChange={(e) => setRainLevel(parseInt(e.target.value, 10))}
                  className="w-full accent-sky-600 dark:accent-blue-400 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Panel 3: Road Surface Condition */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="flex items-center gap-1.5 font-bold text-sky-700 dark:text-cyan-300">
                  <Droplets className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> ROAD SURFACE STATE
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">TIR & FRICTION</span>
              </div>

              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-mono font-bold text-sky-700 dark:text-cyan-300 tabular-nums">
                  {roadWetness}%
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">WETNESS</span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                <div 
                  className={`h-full transition-all duration-300 ${
                    roadWetness > 60 ? 'bg-rose-500' : roadWetness > 30 ? 'bg-amber-400' : 'bg-sky-500'
                  }`}
                  style={{ width: `${roadWetness}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Friction Coeff (µ):</span>
                <span className="text-slate-900 dark:text-white font-bold">{frictionMu}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Hydroplane Risk:</span>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  hydroplaningRisk === 'HIGH' ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500' :
                  hydroplaningRisk === 'MEDIUM' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500' :
                  'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500'
                }`}>
                  {hydroplaningRisk}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Stopping Distance:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">+{(roadWetness * 0.4).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Panel 4: Ambient Lighting & Anti-Glare Contrast */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Sun className="w-4 h-4 text-amber-500 dark:text-amber-400" /> LIGHT & ANTI-GLARE
                </span>
                <span className="text-[10px] text-sky-700 dark:text-cyan-400 font-semibold">OPTO-SHIELD</span>
              </div>

              <div className="flex items-baseline gap-2 my-2">
                <span className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-300 tabular-nums">
                  {ambientLux}
                </span>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">LUX</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Environment:</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold">{nightMode ? 'NIGHT DUSK' : 'DAYLIGHT'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Glare Detected:</span>
                <span className={`font-bold ${glareDetected ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`}>
                  {glareDetected ? 'ONCOMING BEAMS' : 'NONE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Anti-Glare Shield:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  agsActive ? 'bg-sky-100 dark:bg-blue-950 text-sky-800 dark:text-blue-300 border border-sky-400 dark:border-blue-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {agsActive ? 'ACTIVE (DIM 85%)' : 'CLEAR'}
                </span>
              </div>
              <button
                onClick={toggleNightMode}
                className="w-full mt-1 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
              >
                TOGGLE NIGHT MODE
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: Live Environmental Trend Graphs (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Graph 1: Rain Intensity & Fog Density vs Time */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                WEATHER SEVERITY STREAM (RAIN & FOG)
              </h2>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Precipitation (mm/h) & Fog Density (%) time-series telemetry
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-sky-700 dark:text-blue-400 font-semibold">
                <span className="w-2.5 h-1 bg-sky-600 dark:bg-blue-400 rounded-sm" /> RAIN (MM/H)
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                <span className="w-2.5 h-1 bg-amber-500 dark:bg-amber-400 rounded-sm" /> FOG (%)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="rainRate" stroke={daylightMode ? '#0284C7' : '#38BDF8'} strokeWidth={2} dot={false} isAnimationActive={false} name="Rain (mm/h)" />
                <Line type="monotone" dataKey="fogDensityPct" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} name="Fog Density (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: 4-Direction Clearance Distances Stream */}
        <div className="glass-panel p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                4-DIRECTION CLEARANCE DISTANCES STREAM
              </h2>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Synchronized Front LiDAR, Left, Right & Rear clearance boundaries
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono font-semibold">
              <span className="text-sky-700 dark:text-cyan-400">FRONT</span>
              <span className="text-amber-600 dark:text-amber-400">LEFT</span>
              <span className="text-emerald-600 dark:text-emerald-400">RIGHT</span>
              <span className="text-purple-600 dark:text-purple-400">REAR</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <YAxis domain={[0, 15]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="lidarDistance" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={2} dot={false} isAnimationActive={false} name="Front LiDAR (m)" />
                <Line type="monotone" dataKey="leftClearance" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Side Left (m)" />
                <Line type="monotone" dataKey="rightClearance" stroke="#10B981" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Side Right (m)" />
                <Line type="monotone" dataKey="rearClearance" stroke="#A855F7" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Rear Clearance (m)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
