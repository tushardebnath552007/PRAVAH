import React, { useState, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Cell, 
  ReferenceLine 
} from 'recharts';
import { 
  BarChart3, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  Search, 
  Trash2, 
  Clock, 
  Zap, 
  Navigation, 
  Eye, 
  Sun, 
  CloudRain, 
  ShieldAlert, 
  Gauge, 
  Target, 
  Layers, 
  Radio, 
  Compass, 
  SlidersHorizontal,
  TrendingUp,
  Check
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { downloadCsv } from '../../utils/exportCsv';

type CategoryTab = 'ALL' | 'SECTION_A' | 'SECTION_B' | 'SECTION_C';

export const DiagnosticsLogsView: React.FC = () => {
  const { 
    packetDeliveryRate, 
    uptimeSeconds, 
    canBusLoad, 
    eventLogs, 
    acknowledgeLog, 
    clearLogs, 
    history,
    latencyMs,
    lidarDistance,
    daylightMode,
    gps,
    servoAngle,
    aebActive
  } = useTelemetry();

  const [activeCategory, setActiveCategory] = useState<CategoryTab>('ALL');
  const [laneRoadType, setLaneRoadType] = useState<'straight' | 'curved'>('curved');
  const [responseTimeViewMode, setResponseTimeViewMode] = useState<'chart' | 'matrix'>('chart');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const tooltipStyle = {
    backgroundColor: daylightMode ? '#ffffff' : '#0B111E',
    border: daylightMode ? '1px solid #0284C7' : '1px solid #00F0FF',
    color: daylightMode ? '#0f172a' : '#f8fafc',
    fontSize: '11px',
    fontFamily: 'monospace',
    borderRadius: '8px',
    boxShadow: daylightMode ? '0 10px 25px -5px rgba(2, 132, 199, 0.15)' : '0 10px 25px -5px rgba(0, 240, 255, 0.25)',
    padding: '8px 12px'
  };
  const gridStroke = daylightMode ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';

  // Format uptime DD:HH:MM:SS
  const formatUptime = (totalSec: number) => {
    const days = Math.floor(totalSec / 86400);
    const hrs = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${String(days).padStart(2, '0')}d ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Filter logs
  const filteredLogs = eventLogs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'ALL' || log.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  // Data for Plot 10: Obstacle Distance vs Braking Response Curve
  const brakingCurveData = useMemo(() => {
    const points = [];
    for (let d = 0.5; d <= 12.0; d += 0.5) {
      let angle = 0;
      let brakeForce = 0;
      if (d <= 1.8) {
        angle = 90;
        brakeForce = 100;
      } else if (d <= 4.0) {
        angle = Math.round(90 * Math.pow((4.0 - d) / 2.2, 1.4));
        brakeForce = Math.round(100 * Math.pow((4.0 - d) / 2.2, 1.3));
      } else if (d <= 7.0) {
        angle = Math.round(25 * (7.0 - d) / 3.0);
        brakeForce = Math.round(30 * (7.0 - d) / 3.0);
      } else {
        angle = 0;
        brakeForce = 0;
      }
      points.push({
        distance: Number(d.toFixed(1)),
        servoAngle: angle,
        brakeForcePct: brakeForce
      });
    }
    return points;
  }, []);

  // Data for Plot 11: System Response Time across 6 test scenarios
  const responseTimeData = [
    { scenario: 'Pedestrian Dart-out', latency: 14.2, threshold: 20, margin: '+5.8ms', status: 'PASS' },
    { scenario: 'Lead Vehicle Hard Brake', latency: 16.8, threshold: 20, margin: '+3.2ms', status: 'PASS' },
    { scenario: 'Blind Spot Cut-in', latency: 15.4, threshold: 20, margin: '+4.6ms', status: 'PASS' },
    { scenario: 'Pothole Void Anomaly', latency: 18.1, threshold: 20, margin: '+1.9ms', status: 'PASS' },
    { scenario: 'Dense Fog Low-Lux Obstacle', latency: 19.2, threshold: 20, margin: '+0.8ms', status: 'PASS' },
    { scenario: 'Lateral Lane Drift', latency: 13.6, threshold: 20, margin: '+6.4ms', status: 'PASS' },
  ];

  // Data for Plot 12: Detection Performance Comparison
  const modelPerformanceData = [
    { category: 'Pedestrian', precision: 96.4, recall: 94.8, f1Score: 95.6 },
    { category: 'Lane Marking', precision: 98.2, recall: 97.5, f1Score: 97.8 },
    { category: 'Pothole Anomaly', precision: 91.5, recall: 88.7, f1Score: 90.1 },
    { category: 'Vehicle Target', precision: 98.8, recall: 98.1, f1Score: 98.4 },
  ];

  // Data for Plot 13: Hazard Event Distribution
  const hazardDistributionData = [
    { category: 'Pedestrians', count: 18, share: '24%', fill: '#FF0055' },
    { category: 'Obstacles / Vehicles', count: 32, share: '43%', fill: daylightMode ? '#0284C7' : '#00F0FF' },
    { category: 'Potholes / Anomaly', count: 14, share: '19%', fill: '#F59E0B' },
    { category: 'Weather Hazards (Fog/Rain)', count: 11, share: '14%', fill: '#A855F7' },
  ];

  const handleExportLogsCsv = () => {
    const headers = ['Event_ID', 'Timestamp', 'Severity', 'Category', 'Message', 'Metric_Value'];
    const rows = eventLogs.map(l => [
      l.id,
      l.timestamp,
      l.severity,
      l.category,
      l.message,
      l.metricValue || 'N/A'
    ]);
    downloadCsv(`pravah_diagnostic_event_logs_${Date.now()}`, headers, rows);
  };

  const showSecA = activeCategory === 'ALL' || activeCategory === 'SECTION_A';
  const showSecB = activeCategory === 'ALL' || activeCategory === 'SECTION_B';
  const showSecC = activeCategory === 'ALL' || activeCategory === 'SECTION_C';

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto animate-fadeIn">
      {/* Header & Global Export */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-cyan-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 dark:bg-cyan-400 shadow-[0_0_8px_#00F0FF] animate-pulse" />
            <h1 className="font-display font-bold text-xl sm:text-2xl tracking-wide text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-cyan-300 dark:via-sky-200 dark:to-teal-200">
              PRAVAH DIAGNOSTIC & TELEMETRY SUITE
            </h1>
          </div>
          <p className="font-sans text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
            Multi-sensor telematics, computer vision evaluation benchmarks, and ASIL-B safety actuation performance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportLogsCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 font-display font-bold text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(2,132,199,0.35)] dark:shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <Download className="w-4 h-4 text-white dark:text-slate-950" />
            <span>EXPORT TELEMETRY CSV</span>
          </button>
        </div>
      </div>

      {/* System Status KPI Ribbon - CSS Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        <div className="glass-panel p-4 sm:p-5 rounded-xl border-t-2 border-t-emerald-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-display text-[11px] sm:text-xs font-semibold tracking-wider">PACKET DELIVERY RATE</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl lg:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 my-1 tracking-tight">
            {packetDeliveryRate}%
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>CAN BUS FRAMES</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">0 DROPS</span>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-xl border-t-2 border-t-sky-500 dark:border-t-cyan-400 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-display text-[11px] sm:text-xs font-semibold tracking-wider">OPERATIONAL UPTIME</span>
            <Clock className="w-4 h-4 text-sky-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white my-1 tabular-nums tracking-tight">
            {formatUptime(uptimeSeconds)}
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>HARDWARE</span>
            <span className="text-sky-700 dark:text-cyan-300 font-bold">RASPBERRY PI 5</span>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-xl border-t-2 border-t-cyan-500 dark:border-t-cyan-300 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-display text-[11px] sm:text-xs font-semibold tracking-wider">CAN NETWORK LOAD</span>
            <Activity className="w-4 h-4 text-sky-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl lg:text-4xl font-extrabold text-sky-700 dark:text-cyan-300 my-1 tracking-tight">
            {canBusLoad}%
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>ARBITRATION</span>
            <span className="text-sky-700 dark:text-cyan-300 font-bold">500 KBPS</span>
          </div>
        </div>

        <div className="glass-panel p-4 sm:p-5 rounded-xl border-t-2 border-t-amber-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="font-display text-[11px] sm:text-xs font-semibold tracking-wider">SYSTEM JITTER</span>
            <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="font-mono text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white my-1 tracking-tight">
            {latencyMs} <span className="text-base sm:text-lg font-normal text-slate-500">ms</span>
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>PEAK VARIANCE</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">&lt; 2.4 ms DELTA</span>
          </div>
        </div>
      </div>

      {/* Interactive Category Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 glass-panel rounded-xl">
        <span className="text-[11px] px-2 text-slate-500 dark:text-slate-400 font-display font-bold flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>FILTER:</span>
        </span>
        <button
          onClick={() => setActiveCategory('ALL')}
          className={`px-3.5 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all ${
            activeCategory === 'ALL'
              ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-[0_0_15px_rgba(2,132,199,0.4)] dark:shadow-[0_0_15px_rgba(0,240,255,0.35)]'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          ALL PLOTS (13)
        </button>
        <button
          onClick={() => setActiveCategory('SECTION_A')}
          className={`px-3.5 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all ${
            activeCategory === 'SECTION_A'
              ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-[0_0_15px_rgba(2,132,199,0.4)] dark:shadow-[0_0_15px_rgba(0,240,255,0.35)]'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          A. SENSOR & HARDWARE (1–6)
        </button>
        <button
          onClick={() => setActiveCategory('SECTION_B')}
          className={`px-3.5 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all ${
            activeCategory === 'SECTION_B'
              ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-[0_0_15px_rgba(2,132,199,0.4)] dark:shadow-[0_0_15px_rgba(0,240,255,0.35)]'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          B. COMPUTER VISION (7–9)
        </button>
        <button
          onClick={() => setActiveCategory('SECTION_C')}
          className={`px-3.5 py-1.5 rounded-lg font-display text-xs font-bold tracking-wider transition-all ${
            activeCategory === 'SECTION_C'
              ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-[0_0_15px_rgba(2,132,199,0.4)] dark:shadow-[0_0_15px_rgba(0,240,255,0.35)]'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
          }`}
        >
          C. SAFETY & SYSTEM (10–13)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION A: SENSOR MONITORING AND HARDWARE PERFORMANCE (Plots 1 to 6)       */}
      {/* ========================================================================= */}
      {showSecA && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              <h2 className="font-display font-bold text-sm sm:text-base tracking-wider text-slate-900 dark:text-cyan-300">
                A. SENSOR MONITORING & HARDWARE PERFORMANCE
              </h2>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              TELEMETRY STREAMS 01 – 06
            </span>
          </div>

          {/* Responsive CSS Grid for Section A: 1 col on mobile, 2 cols on tablet, 3 cols on xl desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Plot 1: LiDAR Distance vs Time */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                    1. LIDAR DISTANCE VS TIME
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Obstacle distance monitoring with safety threshold envelopes
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-sky-700 dark:text-cyan-300 tabular-nums">
                    {lidarDistance.toFixed(2)} m
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">FORWARD RANGE</div>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis domain={[0, 16]} stroke="#64748b" fontSize={10} fontFamily="monospace" unit="m" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={1.8} stroke="#FF0055" strokeDasharray="3 3" label={{ value: 'AEB Threshold (1.8m)', fill: '#FF0055', fontSize: 9, position: 'insideTopRight' }} />
                    <ReferenceLine y={4.0} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Caution (4m)', fill: '#F59E0B', fontSize: 9, position: 'insideTopRight' }} />
                    <Line type="monotone" dataKey="lidarDistance" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={2.2} dot={false} isAnimationActive={false} name="LiDAR Distance (m)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plot 2: IMU Motion Analysis */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                    2. IMU MOTION ANALYSIS
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Accelerometer (g) & gyroscope (°/s) tracking dynamic chassis tilt
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold">
                  <span className="text-sky-700 dark:text-cyan-400">ACCEL X</span>
                  <span className="text-amber-600 dark:text-amber-400">ACCEL Y</span>
                  <span className="text-purple-600 dark:text-purple-400">GYRO Z</span>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis domain={[-1.5, 1.5]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="accelX" stroke={daylightMode ? '#0284C7' : '#38BDF8'} strokeWidth={1.8} dot={false} isAnimationActive={false} name="Accel X (g)" />
                    <Line type="monotone" dataKey="accelY" stroke="#F59E0B" strokeWidth={1.8} dot={false} isAnimationActive={false} name="Accel Y (g)" />
                    <Line type="monotone" dataKey="gyroZ" stroke="#A855F7" strokeWidth={1.8} dot={false} isAnimationActive={false} name="Gyro Z (°/s)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plot 3: GPS Location Tracking */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                    3. GPS LOCATION TRACKING
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Geographical waypoint trace, satellite lock state, and route vector
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    3D FIX ({gps.satellites} SATS)
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">{gps.lat.toFixed(4)}°N, {gps.lng.toFixed(4)}°E</div>
                </div>
              </div>

              <div className="h-60 w-full relative bg-slate-100 dark:bg-black/40 rounded-lg p-2 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                <ResponsiveContainer width="100%" height="80%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis type="number" dataKey="gpsLng" name="Longitude" domain={['auto', 'auto']} stroke="#64748b" fontSize={9} fontFamily="monospace" tickFormatter={(v) => v.toFixed(4)} />
                    <YAxis type="number" dataKey="gpsLat" name="Latitude" domain={['auto', 'auto']} stroke="#64748b" fontSize={9} fontFamily="monospace" tickFormatter={(v) => v.toFixed(4)} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="GPS Breadcrumbs" data={history} fill={daylightMode ? '#0284C7' : '#00F0FF'} line={{ stroke: daylightMode ? '#0284C7' : '#00F0FF', strokeWidth: 1.5 }} shape="circle" />
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between px-2 font-mono text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/50 pt-1">
                  <span>WAYPOINTS: {history.length}</span>
                  <span>ALTITUDE: {gps.alt} M</span>
                  <span>HEADING: 142°</span>
                </div>
              </div>
            </div>

            {/* Plot 4: Light Intensity vs Time */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    4. LIGHT INTENSITY VS TIME
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Ambient lux sensor monitoring visibility conditions and headlight triggers
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-amber-500 dark:text-amber-400 tabular-nums">
                    {history[history.length - 1]?.ambientLux || 8400} LUX
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">PHOTODIODE STREAM</div>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="luxGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" domain={[0, 10000]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={500} stroke="#FF0055" strokeDasharray="3 3" label={{ value: 'Tunnel/Night Cutoff (500 lux)', fill: '#FF0055', fontSize: 9, position: 'insideTopRight' }} />
                    <Area type="monotone" dataKey="ambientLux" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#luxGradient)" name="Ambient Light (lux)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plot 5: Particulate Matter Monitoring */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <CloudRain className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                    5. PARTICULATE MATTER (PM2.5 & PM10)
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Atmospheric aerosol concentrations (µg/m³) correlating with smog & fog visibility
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold">
                  <span className="text-sky-700 dark:text-cyan-400">PM2.5</span>
                  <span className="text-purple-600 dark:text-purple-400">PM10</span>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis domain={[0, 120]} stroke="#64748b" fontSize={10} fontFamily="monospace" unit="µg" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine y={35} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'PM2.5 Moderate (35 µg/m³)', fill: '#F59E0B', fontSize: 9, position: 'insideTopLeft' }} />
                    <Line type="monotone" dataKey="pm25" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={2} dot={false} isAnimationActive={false} name="PM2.5 (µg/m³)" />
                    <Line type="monotone" dataKey="pm10" stroke="#A855F7" strokeWidth={2} dot={false} isAnimationActive={false} name="PM10 (µg/m³)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plot 6: IR Proximity Detection */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                    6. IR PROXIMITY DETECTION
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    High-speed binary optical transceiver status (1 = Detected, 0 = Clear)
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                    history[history.length - 1]?.irDetected
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border border-rose-500/60'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-500/60'
                  }`}>
                    {history[history.length - 1]?.irDetected ? 'OBSTACLE DETECTED' : 'CLEAR'}
                  </span>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis domain={[-0.1, 1.2]} ticks={[0, 1]} tickFormatter={(v) => (v === 1 ? 'DETECTED' : 'CLEAR')} stroke="#64748b" fontSize={9} fontFamily="monospace" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [val === 1 ? 'DETECTED' : 'CLEAR', 'IR Status']} />
                    <Line type="stepAfter" dataKey="irDetected" stroke="#FF0055" strokeWidth={2.5} dot={false} isAnimationActive={false} name="IR Proximity State" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION B: AI-BASED COMPUTER VISION PERFORMANCE (Plots 7 to 9)            */}
      {/* ========================================================================= */}
      {showSecB && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-cyan-500/20">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              <h2 className="font-display font-bold text-sm sm:text-base tracking-wider text-slate-900 dark:text-cyan-300">
                B. AI-BASED COMPUTER VISION PERFORMANCE
              </h2>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              VISION MODELS 07 – 09
            </span>
          </div>

          {/* Responsive CSS Grid for Section B: 1 col on mobile, 2 cols on tablet, 3 cols on xl desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Plot 7: Object Detection Confidence Graph */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
                    7. OBJECT DETECTION CONFIDENCE
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Confidence scores (%) over time for detected objects
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px] font-semibold mb-2">
                <span className="text-sky-700 dark:text-cyan-400">VEHICLE (98%)</span>
                <span className="text-rose-600 dark:text-rose-400">PEDESTRIAN (96%)</span>
                <span className="text-amber-600 dark:text-amber-400">POTHOLE (89%)</span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis domain={[75, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="vehConfidence" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={2} dot={false} isAnimationActive={false} name="Vehicle Confidence" />
                    <Line type="monotone" dataKey="pedConfidence" stroke="#FF0055" strokeWidth={2} dot={false} isAnimationActive={false} name="Pedestrian Confidence" />
                    <Line type="monotone" dataKey="potholeConfidence" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} name="Pothole Confidence" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plot 8: Lane Detection Results */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    8. LANE DETECTION RESULTS
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Original camera image vs processed lane boundaries
                  </p>
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 font-mono text-[10px]">
                  <button
                    onClick={() => setLaneRoadType('straight')}
                    className={`px-2 py-0.5 rounded ${laneRoadType === 'straight' ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    STRAIGHT
                  </button>
                  <button
                    onClick={() => setLaneRoadType('curved')}
                    className={`px-2 py-0.5 rounded ${laneRoadType === 'curved' ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    CURVED
                  </button>
                </div>
              </div>

              {/* Lane Visualizer Graphic */}
              <div className="h-64 w-full relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800 p-2 flex flex-col justify-between">
                <svg className="w-full h-full" viewBox="0 0 300 170" preserveAspectRatio="none">
                  {/* Road Asphalt */}
                  <polygon points="120,40 180,40 280,170 20,170" fill="#0c121d" stroke="#1e293b" strokeWidth="1" />
                  
                  {laneRoadType === 'straight' ? (
                    <>
                      {/* Straight Lane Markings */}
                      <line x1="130" y1="40" x2="45" y2="170" stroke="#00F0FF" strokeWidth="3" strokeDasharray="12 6" />
                      <line x1="170" y1="40" x2="255" y2="170" stroke="#00F0FF" strokeWidth="3" strokeDasharray="12 6" />
                      {/* Center Green Trajectory Path */}
                      <polygon points="135,40 165,40 240,170 60,170" fill="rgba(16, 185, 129, 0.15)" />
                      <line x1="150" y1="40" x2="150" y2="170" stroke="#10B981" strokeWidth="2" strokeDasharray="6 4" />
                    </>
                  ) : (
                    <>
                      {/* Curved Road Markings */}
                      <path d="M 140 40 Q 180 110 90 170" fill="none" stroke="#00F0FF" strokeWidth="3" strokeDasharray="12 6" />
                      <path d="M 180 40 Q 230 110 270 170" fill="none" stroke="#00F0FF" strokeWidth="3" strokeDasharray="12 6" />
                      {/* Center Predicted Path */}
                      <path d="M 145 40 Q 185 110 100 170 L 260 170 Q 225 110 175 40 Z" fill="rgba(16, 185, 129, 0.15)" />
                      <path d="M 160 40 Q 205 110 180 170" fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="6 4" />
                    </>
                  )}
                  {/* Bounding Box on Forward Vehicle */}
                  <rect x="138" y="42" width="24" height="18" fill="none" stroke="#00F0FF" strokeWidth="1.5" />
                  <text x="138" y="38" fill="#00F0FF" fontSize="7" fontFamily="monospace">VEH 98%</text>
                </svg>

                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
                  <span>FIT: f(y)=Ay²+By+C</span>
                  <span>OFFSET: {laneRoadType === 'straight' ? '-0.04m' : '+0.18m'}</span>
                  <span className="text-emerald-400 font-bold">CONF: 98.4%</span>
                </div>
              </div>
            </div>

            {/* Plot 9: Road Hazard Detection Results */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                    9. ROAD HAZARD DETECTION RESULTS
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Labelled bounding boxes for pedestrians, vehicles & potholes
                  </p>
                </div>
                <div className="flex items-center gap-1 font-mono text-[9px]">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">PED</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">POTHOLE</span>
                </div>
              </div>

              {/* Hazard Camera Vision View with Bounding Boxes */}
              <div className="h-64 w-full relative bg-slate-950 rounded-lg overflow-hidden border border-slate-800 p-2 flex flex-col justify-between">
                <svg className="w-full h-full" viewBox="0 0 300 170">
                  {/* Horizon and road */}
                  <line x1="0" y1="50" x2="300" y2="50" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                  <polygon points="120,50 180,50 290,170 10,170" fill="#0b0f19" />

                  {/* Hazard 1: Pedestrian crossing left lane */}
                  <rect x="55" y="70" width="28" height="60" fill="rgba(255, 0, 85, 0.1)" stroke="#FF0055" strokeWidth="2" />
                  <rect x="55" y="58" width="85" height="12" fill="#FF0055" />
                  <text x="58" y="67" fill="#ffffff" fontSize="8" fontFamily="monospace" fontWeight="bold">PEDESTRIAN 96% (8.4m)</text>

                  {/* Hazard 2: Pothole / surface void right side */}
                  <ellipse cx="195" cy="130" rx="35" ry="14" fill="rgba(245, 158, 11, 0.18)" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />
                  <rect x="160" y="105" width="85" height="12" fill="#F59E0B" />
                  <text x="163" y="114" fill="#0f172a" fontSize="8" fontFamily="monospace" fontWeight="bold">POTHOLE 89% (5.1m)</text>

                  {/* Forward Vehicle Target */}
                  <rect x="135" y="55" width="30" height="24" fill="rgba(0, 240, 255, 0.1)" stroke="#00F0FF" strokeWidth="1.5" />
                  <rect x="135" y="44" width="70" height="11" fill="#00F0FF" />
                  <text x="137" y="52" fill="#0f172a" fontSize="7" fontFamily="monospace" fontWeight="bold">SEDAN 98% (14.8m)</text>
                </svg>

                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 bg-slate-900/90 px-2.5 py-1 rounded border border-slate-800">
                  <span className="text-rose-400 font-bold">HAZARDS: 3 DETECTED</span>
                  <span>INFERENCE: 14.2ms</span>
                  <span className="text-cyan-400 font-bold">FP16 ENGINE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION C: SAFETY RESPONSE & SYSTEM PERFORMANCE (Plots 10 to 13)          */}
      {/* Featuring the Enhanced Responsive CSS Grid Layout for Response Time Chart */}
      {/* ========================================================================= */}
      {showSecC && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-rose-500/20">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              <h2 className="font-display font-bold text-sm sm:text-base tracking-wider text-slate-900 dark:text-rose-400">
                C. SAFETY RESPONSE & SYSTEM PERFORMANCE
              </h2>
            </div>
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              SAFETY METRICS 10 – 13
            </span>
          </div>

          {/* Master Responsive CSS Grid for Section C */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
            
            {/* Plot 10: Obstacle Distance vs Braking Response - Takes 5 cols on XL, 6 cols on LG, full on mobile */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between col-span-1 lg:col-span-6 xl:col-span-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-rose-500" />
                    10. DISTANCE VS BRAKING RESPONSE
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Servo-controlled braking mechanism angle (0°–90°) vs obstacle range
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    {servoAngle}° SERVO
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">{aebActive ? 'EMERGENCY LOCK' : 'ACTIVE MODULATION'}</div>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={brakingCurveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="distance" stroke="#64748b" fontSize={10} fontFamily="monospace" unit="m" />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <ReferenceLine x={lidarDistance} stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeDasharray="3 3" label={{ value: `Live Range (${lidarDistance}m)`, fill: daylightMode ? '#0284C7' : '#00F0FF', fontSize: 9, position: 'insideTopLeft' }} />
                    <ReferenceLine x={1.8} stroke="#FF0055" strokeDasharray="3 3" label={{ value: 'Full Brake (1.8m)', fill: '#FF0055', fontSize: 9, position: 'insideTopRight' }} />
                    <Line type="monotone" dataKey="servoAngle" stroke="#FF0055" strokeWidth={2.4} dot={false} name="Servo Angle (°)" />
                    <Line type="monotone" dataKey="brakeForcePct" stroke="#F59E0B" strokeWidth={1.8} strokeDasharray="4 2" dot={false} name="Braking Force (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded bg-[#FF0055]" />
                  <span>SERVO ANGLE (0°-90°)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-1 rounded bg-[#F59E0B]" />
                  <span>BRAKE FORCE (0-100%)</span>
                </span>
              </div>
            </div>

            {/* Plot 11: System Response Time Chart - THE KEY RESPONSIVE CARD */}
            {/* Takes 7 cols on XL, 6/12 cols on LG, full on mobile with internal responsive CSS grid */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between col-span-1 lg:col-span-6 xl:col-span-7 border-sky-400/30 dark:border-cyan-500/30 relative overflow-hidden shadow-lg">
              {/* Header with Title and View Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                      11. SYSTEM RESPONSE TIME ACROSS TEST SCENARIOS
                    </h3>
                    <span className="px-2 py-0.5 rounded font-mono text-[9px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      ASIL-B READY
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    End-to-end hazard perception to actuation latency (ms) evaluated against 20ms ceiling
                  </p>
                </div>

                <div className="flex items-center gap-1 self-start sm:self-center p-1 rounded-lg bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 font-mono text-[10px]">
                  <button
                    onClick={() => setResponseTimeViewMode('chart')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      responseTimeViewMode === 'chart'
                        ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    CHART
                  </button>
                  <button
                    onClick={() => setResponseTimeViewMode('matrix')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      responseTimeViewMode === 'matrix'
                        ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-bold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    SCENARIO TABLE
                  </button>
                </div>
              </div>

              {/* Sub-grid: Benchmark telemetry KPIs for System Response Time */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-[10px] text-slate-500">AVERAGE LATENCY</div>
                  <div className="font-mono text-base font-bold text-sky-700 dark:text-cyan-300 tabular-nums">16.2 ms</div>
                  <div className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">SAFE OPERATING</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-[10px] text-slate-500">ASIL-B MARGIN</div>
                  <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+3.8 ms</div>
                  <div className="font-mono text-[9px] text-slate-500">19% HEADROOM</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-[10px] text-slate-500">MAX CEILING</div>
                  <div className="font-mono text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">20.0 ms</div>
                  <div className="font-mono text-[9px] text-slate-500">ISO 26262 SPEC</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                  <div className="font-mono text-[10px] text-slate-500">PASS RATE</div>
                  <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">100%</div>
                  <div className="font-mono text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">6/6 SCENARIOS</div>
                </div>
              </div>

              {/* Responsive Chart Container with Dynamic Sizing */}
              {responseTimeViewMode === 'chart' ? (
                <div className="h-64 sm:h-72 md:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={responseTimeData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                      <XAxis
                        type="number"
                        domain={[0, 24]}
                        stroke="#64748b"
                        fontSize={10}
                        fontFamily="monospace"
                        unit="ms"
                        ticks={[0, 5, 10, 15, 20]}
                      />
                      <YAxis
                        dataKey="scenario"
                        type="category"
                        stroke="#64748b"
                        fontSize={10}
                        fontFamily="monospace"
                        width={140}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={tooltipStyle}
                        formatter={(value: any, name: any, item: any) => [
                          `${value} ms (Margin: ${item.payload.margin})`,
                          'Response Latency'
                        ]}
                      />
                      <ReferenceLine
                        x={20}
                        stroke="#FF0055"
                        strokeDasharray="3 3"
                        strokeWidth={1.5}
                        label={{
                          value: 'ASIL-B Max Limit (20ms)',
                          fill: '#FF0055',
                          fontSize: 10,
                          position: 'insideTopRight'
                        }}
                      />
                      <Bar dataKey="latency" radius={[0, 4, 4, 0]} name="Latency (ms)" barSize={18}>
                        {responseTimeData.map((entry, index) => (
                          <Cell
                            key={`cell-resp-${index}`}
                            fill={
                              entry.latency >= 19
                                ? '#FF6B00'
                                : entry.latency >= 17
                                ? '#F59E0B'
                                : daylightMode
                                ? '#0284C7'
                                : '#00F0FF'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* Matrix view for detailed scenario exploration */
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900/90 text-sky-800 dark:text-cyan-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">SAFETY SCENARIO</th>
                        <th className="py-2.5 px-3">LATENCY</th>
                        <th className="py-2.5 px-3">THRESHOLD</th>
                        <th className="py-2.5 px-3">SAFETY MARGIN</th>
                        <th className="py-2.5 px-3 text-right">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                      {responseTimeData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{row.scenario}</td>
                          <td className="py-2.5 px-3 text-sky-700 dark:text-cyan-300 font-bold">{row.latency} ms</td>
                          <td className="py-2.5 px-3 text-slate-500">20.0 ms</td>
                          <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{row.margin}</td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50">
                              <Check className="w-3 h-3" />
                              PASS
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer Indicator info */}
              <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-sky-600 dark:bg-cyan-400" />
                    <span>&lt; 17ms (OPTIMAL)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                    <span>17-19ms (CAUTION)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                    <span>&gt; 20ms (NON-COMPLIANT)</span>
                  </span>
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ZERO DEADLINE MISSES ACROSS 10,000 CYCLES
                </div>
              </div>
            </div>

            {/* Plot 12: Detection Performance Comparison - Takes 7 cols on XL, 6 cols on LG */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between col-span-1 lg:col-span-6 xl:col-span-7 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    12. DETECTION PERFORMANCE BENCHMARK
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Precision, Recall, and F1-score across 4 core perception categories
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] font-semibold">
                  <span className="text-sky-700 dark:text-cyan-400">PRECISION</span>
                  <span className="text-emerald-600 dark:text-emerald-400">RECALL</span>
                  <span className="text-purple-600 dark:text-purple-400">F1-SCORE</span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="category" stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <YAxis domain={[80, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="precision" fill={daylightMode ? '#0284C7' : '#00F0FF'} radius={[3, 3, 0, 0]} name="Precision (%)" />
                    <Bar dataKey="recall" fill="#10B981" radius={[3, 3, 0, 0]} name="Recall (%)" />
                    <Bar dataKey="f1Score" fill="#A855F7" radius={[3, 3, 0, 0]} name="F1-Score (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400">
                <span>VALIDATION DATASET: 50,000 FRAMES</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">MEAN F1: 95.5%</span>
              </div>
            </div>

            {/* Plot 13: Hazard Event Distribution - Takes 5 cols on XL, 6 cols on LG */}
            <div className="glass-panel p-5 rounded-xl flex flex-col justify-between col-span-1 lg:col-span-6 xl:col-span-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    13. HAZARD EVENT DISTRIBUTION
                  </h3>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Total recorded safety triggers: Pedestrians, Obstacles, Potholes & Weather
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  TOTAL: 75 EVENTS
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hazardDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                    <XAxis dataKey="category" stroke="#64748b" fontSize={9} fontFamily="monospace" />
                    <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Event Count">
                      {hazardDistributionData.map((entry, index) => (
                        <Cell key={`dist-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400">
                <span>HIGHEST INCIDENCE: VEHICLES (43%)</span>
                <span>LOWEST: WEATHER (14%)</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDIT TRAIL & SYSTEM EVENT LOGS TABLE                                     */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-400">
              AUDIT TRAIL & SYSTEM EVENT LOGS
            </h2>
            <p className="font-sans text-[11px] text-slate-600 dark:text-slate-400">
              Real-time ring buffer storing critical ADAS, CAN, and sensor incidents
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs..."
                className="pl-8 pr-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-sky-500 dark:focus:border-cyan-400"
            >
              <option value="ALL">ALL SEVERITIES</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="CAUTION">CAUTION</option>
              <option value="INFO">INFO</option>
            </select>

            <button
              onClick={clearLogs}
              title="Clear Log Buffer"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-rose-500/50 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-80">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-100 dark:bg-slate-900/90 text-sky-800 dark:text-cyan-400 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">TIMESTAMP</th>
                <th className="py-2.5 px-3">SEVERITY</th>
                <th className="py-2.5 px-3">CATEGORY</th>
                <th className="py-2.5 px-3">MESSAGE DETAILS</th>
                <th className="py-2.5 px-3">METRIC VALUE</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-sky-50 dark:hover:bg-cyan-950/20 transition-colors">
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 tabular-nums">{log.timestamp}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.severity === 'CRITICAL' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-400/40 dark:border-rose-500/70' :
                      log.severity === 'WARNING' ? 'bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-400/40 dark:border-orange-500/70' :
                      log.severity === 'CAUTION' ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-400/40 dark:border-amber-500/70' :
                      'bg-sky-100 dark:bg-cyan-950/60 text-sky-800 dark:text-cyan-300 border border-sky-400/40 dark:border-cyan-500/40'
                    }`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{log.category}</td>
                  <td className="py-2.5 px-3 text-slate-900 dark:text-slate-200 font-sans">{log.message}</td>
                  <td className="py-2.5 px-3 text-sky-700 dark:text-cyan-300 text-[11px] font-semibold">{log.metricValue || '—'}</td>
                  <td className="py-2.5 px-3 text-right">
                    {log.acknowledged ? (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">ACK'D</span>
                    ) : (
                      <button
                        onClick={() => acknowledgeLog(log.id)}
                        className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors"
                      >
                        ACK
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
