import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { 
  Gauge, 
  Compass, 
  Eye, 
  CloudSun, 
  ShieldAlert, 
  ShieldCheck, 
  Zap, 
  Radio,
  Sliders,
  AlertTriangle,
  Info,
  Car,
  Layers,
  HelpCircle,
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { RadarSurroundingsViewport } from '../radar/RadarSurroundingsViewport';
import { Custom3dSimulation } from '../simulation/Custom3dSimulation';

export const CommandCenterView: React.FC = () => {
  const { 
    healthScore, 
    lidarDistance, 
    lidarSignal, 
    speed, 
    steerAngle, 
    heading, 
    gear, 
    rainLevel, 
    fogDensityPct, 
    ambientLux, 
    cameraFps, 
    inferenceLatency, 
    fcwState, 
    aebActive, 
    lkaActive, 
    agsActive, 
    servoAngle, 
    history, 
    hydroplaningRisk, 
    daylightMode,
    setSimulatorModalOpen
  } = useTelemetry();

  const [activeCenterpiece, setActiveCenterpiece] = useState<'3d-sim' | '2d-radar'>('3d-sim');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Friendly proximity color indicator
  const getProximityColor = (dist: number) => {
    if (dist < 1.0) return 'from-rose-600 to-red-500';
    if (dist < 2.0) return 'from-orange-500 to-amber-500';
    if (dist < 3.5) return 'from-amber-400 to-yellow-400';
    return daylightMode ? 'from-sky-600 to-sky-400' : 'from-cyan-500 to-emerald-400';
  };

  const proximityPercent = Math.min(100, Math.max(5, (lidarDistance / 10.0) * 100));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto animate-fadeIn select-none">
      {/* Top Welcome & Driving Mode Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-cyan-500/20">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-cyan-300 dark:via-sky-200 dark:to-teal-200 flex items-center gap-2">
            <span>VEHICLE SAFETY & COMMAND CENTER</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </h1>
          <p className="font-sans text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Real-time automated driver assistance, 3D obstacle tracking, and active emergency brake monitoring
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimulatorModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white dark:bg-cyan-500 dark:hover:bg-cyan-400 dark:text-slate-950 font-display font-bold text-xs tracking-wider transition-all shadow-md hover:scale-[1.02] active:scale-[0.98]"
            title="Open Fullscreen 3D Driving Environment"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>FULLSCREEN 3D SIMULATOR</span>
          </button>
        </div>
      </div>

      {/* 5 User-Friendly KPI Cards with Hover Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Overall Vehicle Health */}
        <div 
          className="glass-panel p-4 rounded-xl flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:border-cyan-400/50 group"
          onMouseEnter={() => setActiveTooltip('health')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-display font-bold text-slate-800 dark:text-cyan-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              OVERALL CAR HEALTH
            </span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60">
              NOMINAL
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {healthScore}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">/ 100 PTS</span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden my-1">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${
                healthScore > 90 ? 'bg-emerald-500' : healthScore > 75 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>

          <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>Sensors & Brakes</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">100% Ready</span>
          </div>

          {activeTooltip === 'health' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl flex flex-col justify-center text-xs text-slate-200 animate-fadeIn z-20">
              <span className="font-display font-bold text-cyan-300 mb-1">Vehicle Health Status</span>
              <p className="font-sans text-[11px] text-slate-300 leading-snug">
                Continuously tests all laser distance sensors, brake servos, camera inference, and computer temperatures to ensure road safety.
              </p>
            </div>
          )}
        </div>

        {/* KPI 2: Front Distance Laser Sensor */}
        <div 
          className={`glass-panel p-4 rounded-xl flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group ${
            lidarDistance < 1.8 ? 'border-rose-500 shadow-[0_0_20px_rgba(255,0,85,0.25)]' : ''
          }`}
          onMouseEnter={() => setActiveTooltip('lidar')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-display font-bold text-slate-800 dark:text-cyan-300 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              FRONT CLEARANCE
            </span>
            <span className="font-mono text-[10px] text-sky-700 dark:text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-sky-100 dark:bg-cyan-950/60">
              {lidarSignal}% SIGNAL
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className={`font-mono text-3xl font-extrabold tracking-tight tabular-nums ${
              lidarDistance < 1.8 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : lidarDistance < 3.5 ? 'text-amber-600 dark:text-amber-300' : 'text-sky-700 dark:text-cyan-300'
            }`}>
              {lidarDistance.toFixed(2)}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">METERS</span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden my-1">
            <div 
              className={`h-full bg-gradient-to-r transition-all duration-300 rounded-full ${getProximityColor(lidarDistance)}`}
              style={{ width: `${proximityPercent}%` }}
            />
          </div>

          <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>Laser Rangefinder</span>
            <span className={lidarDistance < 2.0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500'}>
              {lidarDistance < 2.0 ? 'Warning: Close!' : 'Clear Road'}
            </span>
          </div>

          {activeTooltip === 'lidar' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl flex flex-col justify-center text-xs text-slate-200 animate-fadeIn z-20">
              <span className="font-display font-bold text-cyan-300 mb-1">Forward Laser Distance</span>
              <p className="font-sans text-[11px] text-slate-300 leading-snug">
                Measures the exact distance in meters to any car, cyclist, or obstacle in front. Automatically triggers brakes under 1.8 meters.
              </p>
            </div>
          )}
        </div>

        {/* KPI 3: Driving Speed & Steering */}
        <div 
          className="glass-panel p-4 rounded-xl flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
          onMouseEnter={() => setActiveTooltip('speed')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-display font-bold text-slate-800 dark:text-cyan-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              DRIVING SPEED
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-sky-800 dark:text-cyan-300 font-bold">
              GEAR: {gear}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
              {speed}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">KM/H</span>
          </div>

          <div className="flex items-center justify-between font-mono text-[11px] text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span>STEERING: <strong className="text-sky-700 dark:text-cyan-300">{steerAngle}°</strong></span>
            <span>HEADING: <strong className="text-sky-700 dark:text-cyan-300">{Math.round(heading)}°</strong></span>
          </div>

          <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>Brake Servo</span>
            <span className="font-mono font-bold text-sky-700 dark:text-cyan-300">{servoAngle}° Angle</span>
          </div>

          {activeTooltip === 'speed' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl flex flex-col justify-center text-xs text-slate-200 animate-fadeIn z-20">
              <span className="font-display font-bold text-cyan-300 mb-1">Vehicle Motion & Steering</span>
              <p className="font-sans text-[11px] text-slate-300 leading-snug">
                Tracks current cruising speed in km/h, steering angle, vehicle direction, and the automatic brake servo actuator position.
              </p>
            </div>
          )}
        </div>

        {/* KPI 4: Weather & Road Grip */}
        <div 
          className="glass-panel p-4 rounded-xl flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
          onMouseEnter={() => setActiveTooltip('weather')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-display font-bold text-slate-800 dark:text-cyan-300 flex items-center gap-1.5">
              <CloudSun className="w-4 h-4 text-amber-500" />
              ROAD & WEATHER
            </span>
            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
              fogDensityPct > 40 ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400'
            }`}>
              {fogDensityPct > 40 ? 'LOW VISIBILITY' : 'OPTIMAL'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-300 tabular-nums">
              {ambientLux}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">LUX LIGHT</span>
          </div>

          <div className="flex items-center justify-between font-mono text-[11px] text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span>FOG: {fogDensityPct}%</span>
            <span>RAIN: LVL {rainLevel}</span>
          </div>

          <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>Traction Risk:</span>
            <span className={`font-semibold ${hydroplaningRisk === 'HIGH' ? 'text-rose-500' : 'text-emerald-500'}`}>
              {hydroplaningRisk}
            </span>
          </div>

          {activeTooltip === 'weather' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl flex flex-col justify-center text-xs text-slate-200 animate-fadeIn z-20">
              <span className="font-display font-bold text-cyan-300 mb-1">Weather & Road Friction</span>
              <p className="font-sans text-[11px] text-slate-300 leading-snug">
                Monitors outside light intensity (lux), fog thickness, and rain levels to calculate tire road grip and hydroplaning safety margins.
              </p>
            </div>
          )}
        </div>

        {/* KPI 5: Onboard AI Camera Speed */}
        <div 
          className="glass-panel p-4 rounded-xl flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
          onMouseEnter={() => setActiveTooltip('camera')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-display font-bold text-slate-800 dark:text-cyan-300 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
              CAMERA AI SPEED
            </span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60">
              HIGH SPEED
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-1">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-sky-700 dark:text-cyan-300 tabular-nums">
              {cameraFps}
            </span>
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">FPS</span>
          </div>

          <div className="flex items-center justify-between font-mono text-[11px] text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-800">
            <span>DELAY: {inferenceLatency}ms</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">SMOOTH</span>
          </div>

          <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
            <span>Neural Engine:</span>
            <span className="text-sky-700 dark:text-cyan-300 font-semibold">14ms Per Frame</span>
          </div>

          {activeTooltip === 'camera' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl flex flex-col justify-center text-xs text-slate-200 animate-fadeIn z-20">
              <span className="font-display font-bold text-cyan-300 mb-1">AI Vision Performance</span>
              <p className="font-sans text-[11px] text-slate-300 leading-snug">
                The onboard AI camera analyzes the road 60 times every second to detect pedestrians, other cars, potholes, and lane markings with zero lag.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ADAS Safety Status Banner in Friendly Language */}
      <div className="p-3.5 rounded-xl glass-panel flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display font-bold text-slate-700 dark:text-slate-300">
            ACTIVE DRIVER ASSISTANCE:
          </span>
          <div className="flex flex-wrap items-center gap-2 font-mono">
            {/* Front Collision Warning */}
            <span 
              className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500/40 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1.5 font-bold cursor-pointer hover:scale-105 transition-transform"
              title="Front Collision Warning: Constantly scans ahead for unexpected stopped vehicles or obstacles"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>COLLISION SHIELD ARMED</span>
            </span>

            {/* Emergency Braking */}
            <span 
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-bold cursor-pointer hover:scale-105 transition-transform ${
                aebActive 
                  ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/90 dark:border-rose-500 dark:text-rose-300 border-rose-400 animate-pulse' 
                  : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500/40 dark:text-emerald-300 border-emerald-300'
              }`}
              title="Automatic Emergency Braking: Automatically halts the vehicle if a sudden obstacle enters the 1.8m safety zone"
            >
              {aebActive ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              <span>{aebActive ? 'EMERGENCY BRAKE ACTIVE!' : 'AUTO-BRAKE STANDBY'}</span>
            </span>

            {/* Lane Keeping */}
            <span 
              className="px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:border-sky-500/40 dark:text-sky-300 border border-sky-300 flex items-center gap-1.5 font-bold cursor-pointer hover:scale-105 transition-transform"
              title="Lane Keeping Assist: Gently guides the car within painted highway lane lines"
            >
              <Zap className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
              <span>LANE ASSIST ACTIVE</span>
            </span>

            {/* Anti-Glare Shield */}
            <span 
              className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 font-bold cursor-pointer hover:scale-105 transition-transform ${
                agsActive
                  ? 'bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950/80 dark:border-blue-400 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
              title="Anti-Glare Shield: Automatically dims high-beam glare from oncoming cars at night"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>GLARE SHIELD {agsActive ? 'DIMMED' : 'CLEAR'}</span>
            </span>
          </div>
        </div>

        <div className="font-mono text-xs font-bold text-sky-700 dark:text-cyan-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{fcwState}</span>
        </div>
      </div>

      {/* Main Centerpiece: Custom 3D Simulation & 2D Radar Split View */}
      <div className="space-y-3">
        {/* View Switcher Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm tracking-wider text-slate-800 dark:text-cyan-300 uppercase">
              INTERACTIVE ENVIRONMENT VIEW:
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl glass-panel text-xs font-display font-bold">
            <button
              onClick={() => setActiveCenterpiece('3d-sim')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeCenterpiece === '3d-sim'
                  ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-md'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Car className="w-4 h-4" />
              <span>CUSTOM 3D SIMULATION (DIGITAL TWIN)</span>
            </button>

            <button
              onClick={() => setActiveCenterpiece('2d-radar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeCenterpiece === '2d-radar'
                  ? 'bg-sky-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-md'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2D PROXIMITY RADAR MATRIX</span>
            </button>
          </div>
        </div>

        {/* View Content: Custom 3D Simulation OR 2D Radar + Telemetry Stream */}
        {activeCenterpiece === '3d-sim' ? (
          <div className="space-y-4">
            {/* Embedded Native Three.js Custom 3D Simulation with Raycasting Hover */}
            <Custom3dSimulation height="560px" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7">
              <RadarSurroundingsViewport />
            </div>

            <div className="lg:col-span-5 glass-panel p-5 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-display text-xs font-bold uppercase tracking-wider text-sky-800 dark:text-cyan-400">
                    REAL-TIME VEHICLE DYNAMICS STREAM
                  </h2>
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">
                    Synchronized Speed (km/h) vs. Forward Obstacle Distance (m)
                  </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px]">
                  <span className="flex items-center gap-1 text-sky-700 dark:text-cyan-300 font-bold">
                    <span className="w-2.5 h-1 bg-sky-600 dark:bg-cyan-400 rounded-sm" /> SPEED (KM/H)
                  </span>
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                    <span className="w-2.5 h-1 bg-amber-500 dark:bg-amber-400 rounded-sm" /> DISTANCE (M)
                  </span>
                </div>
              </div>

              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={daylightMode ? "#0284C7" : "#00F0FF"} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={daylightMode ? "#0284C7" : "#00F0FF"} stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="lidarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={daylightMode ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)"} />
                    <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} fontFamily="monospace" domain={[0, 80]} tickLine={false} />
                    <Tooltip contentStyle={{
                      backgroundColor: daylightMode ? '#FFFFFF' : '#0B111E',
                      border: daylightMode ? '1px solid #0284C7' : '1px solid #00F0FF',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: daylightMode ? '#0F172A' : '#f8fafc',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }} />
                    <Area type="monotone" dataKey="speed" stroke={daylightMode ? "#0284C7" : "#00F0FF"} strokeWidth={2.5} fillOpacity={1} fill="url(#speedGrad)" name="Speed (km/h)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="lidarDistance" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#lidarGrad)" name="LiDAR Distance (m)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-center font-mono text-xs">
                <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-900/40">
                  <div className="text-[10px] text-slate-500">ACCELERATION</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">0.04 g</div>
                </div>
                <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-900/40">
                  <div className="text-[10px] text-slate-500">BRAKING FORCE</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">{aebActive ? '-0.85 g' : '0.00 g'}</div>
                </div>
                <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-900/40">
                  <div className="text-[10px] text-slate-500">STOPPING MARGIN</div>
                  <div className="font-bold text-sky-700 dark:text-cyan-300">{(lidarDistance * 0.8).toFixed(1)}m</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
