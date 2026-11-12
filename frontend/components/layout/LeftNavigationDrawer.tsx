import React from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  Eye, 
  FileSpreadsheet, 
  ShieldAlert, 
  BarChart3, 
  Power, 
  Radio, 
  Car, 
  Activity,
  Play,
  Pause,
  Sun,
  Moon,
  Compass
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { NavigationTab, ConnectionMode } from '../../types/telemetry';

export const LeftNavigationDrawer: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    connectionMode, 
    setConnectionMode, 
    killSwitchActive, 
    toggleKillSwitch,
    setSimulatorModalOpen,
    cpuLoad,
    cpuTemp,
    ramUsage,
    latencyMs,
    packetDeliveryRate,
    aebActive,
    lidarDistance,
    speed,
    steerAngle,
    heading,
    gear,
    cameraFps,
    detectedObjects,
    proximityZones,
    servoAngle,
    canBusLoad,
    isSimRunning,
    toggleSimRunning,
    daylightMode,
    toggleDaylightMode,
    rainLevel,
    fogLevel
  } = useTelemetry();

  // 6 Dynamic Navigation Items with user-friendly titles and live updating metrics
  const navItems: { 
    id: NavigationTab; 
    label: string; 
    description: string;
    icon: React.ElementType; 
    liveData: string;
    statusTone: 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue';
  }[] = [
    { 
      id: 'command-center', 
      label: 'COMMAND CENTER', 
      description: 'Live 3D car simulation & radar view',
      icon: LayoutDashboard,
      liveData: `${speed} KM/H · ${lidarDistance.toFixed(1)}m`,
      statusTone: lidarDistance < 1.8 ? 'rose' : speed > 0 ? 'emerald' : 'cyan'
    },
    { 
      id: 'sensor-matrix', 
      label: 'SENSOR MATRIX', 
      description: 'LiDAR rangefinder & hardware health',
      icon: Cpu,
      liveData: `${cpuTemp.toFixed(1)}°C · ${cpuLoad.toFixed(0)}%`,
      statusTone: cpuTemp > 60 ? 'amber' : 'cyan'
    },
    { 
      id: 'ai-perception', 
      label: 'AI PERCEPTION', 
      description: 'Camera object & pedestrian detection',
      icon: Eye,
      liveData: `${cameraFps} FPS · ${detectedObjects.length} OBJ`,
      statusTone: 'blue'
    },
    { 
      id: 'data-sheet', 
      label: 'DATA SHEET & ENV', 
      description: 'Road grip, weather & distance sheet',
      icon: FileSpreadsheet,
      liveData: `${rainLevel > 0 ? 'RAIN' : fogLevel > 0 ? 'FOG' : 'CLEAR'} · ${proximityZones[3]?.distance.toFixed(1)}m`,
      statusTone: rainLevel > 2 || fogLevel > 2 ? 'amber' : 'cyan'
    },
    { 
      id: 'threat-actuation', 
      label: 'THREAT & ACTUATION', 
      description: 'Automatic emergency braking system',
      icon: ShieldAlert,
      liveData: `${servoAngle}° · ${aebActive ? 'BRAKE' : 'ARMED'}`,
      statusTone: aebActive ? 'rose' : 'emerald'
    },
    { 
      id: 'diagnostics-logs', 
      label: 'DIAGNOSTICS & LOGS', 
      description: 'Response time plots & event audit log',
      icon: BarChart3,
      liveData: `${canBusLoad.toFixed(0)}% CAN · ${packetDeliveryRate}%`,
      statusTone: 'cyan'
    },
  ];

  return (
    <aside className="w-80 bg-white/95 dark:bg-[#04070D]/95 border-r border-slate-300 dark:border-cyan-500/20 flex flex-col justify-between shrink-0 h-screen sticky top-0 backdrop-blur-xl z-30 select-none transition-colors duration-200">
      {/* Brand & Top Status */}
      <div className="p-4 border-b border-slate-200 dark:border-cyan-500/15">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-cyan-950/60 border border-blue-400 dark:border-cyan-500/40 text-blue-600 dark:text-cyan-400 shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <Activity className="w-5 h-5 text-blue-600 dark:text-cyan-400 animate-pulse" />
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                connectionMode === 'OFFLINE' ? 'bg-slate-400' : 
                killSwitchActive ? 'bg-rose-500 animate-ping' : 
                speed > 0 ? 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-950 animate-pulse' :
                'bg-amber-400 ring-2 ring-amber-200 dark:ring-amber-950'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Chakra_Petch'] text-2xl font-bold tracking-widest text-blue-700 dark:bg-gradient-to-r dark:from-cyan-300 dark:via-sky-200 dark:to-cyan-500 dark:bg-clip-text dark:text-transparent">
                  PRAVAH
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-cyan-500/10 dark:text-cyan-400 border border-blue-200 dark:border-cyan-500/30">
                  v2.4
                </span>
              </div>
              <p className="text-[10px] font-mono tracking-tight text-slate-500 dark:text-slate-400 uppercase">
                Pi 5 ADAS Telemetry Hub
              </p>
            </div>
          </div>
        </div>

        {/* Live Vehicle Simulation Dynamic Strip */}
        <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-cyan-500/15 text-xs font-mono mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-cyan-400">
              <Car className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              SIMULATION ENGINE
            </span>
            <button
              onClick={toggleSimRunning}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                isSimRunning 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/50' 
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-500/50'
              }`}
            >
              {isSimRunning ? (
                <>
                  <Pause className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>RUNNING</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  <span>PAUSED</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className={speed > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
              {speed > 0 ? `CRUISING: ${speed} KM/H` : 'IDLE: 0 KM/H'}
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              GEAR: {gear} · {steerAngle}°
            </span>
          </div>
        </div>

        {/* Live System Status Header Widget */}
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center font-mono">
          <div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">CPU LOAD</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{cpuLoad}%</div>
          </div>
          <div className="border-x border-slate-200 dark:border-slate-800">
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">RAM</div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{ramUsage}%</div>
          </div>
          <div>
            <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase">PING</div>
            <div className="text-xs font-bold text-blue-600 dark:text-cyan-300">{latencyMs}ms</div>
          </div>
        </div>
      </div>

      {/* Main Navigation Menu with Dynamic Live Data for Every View */}
      <nav className="p-3 flex-1 space-y-1.5 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-1 text-[10px] font-mono tracking-wider uppercase text-slate-500 dark:text-slate-400 font-semibold">
          <span>NAVIGATION</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">LIVE SYNC</span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all text-xs font-medium border group ${
                isActive
                  ? 'bg-blue-50 dark:bg-gradient-to-r dark:from-cyan-950/80 dark:to-slate-900/90 text-blue-900 dark:text-cyan-200 border-blue-400 dark:border-cyan-400/50 shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.2)] font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 border-transparent hover:border-slate-300 dark:hover:border-cyan-500/20'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className="tracking-wide text-xs font-display font-semibold">{item.label}</span>
                </div>

                {/* Live simulation badge updating in real time */}
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold transition-all ${
                  item.statusTone === 'rose'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/50 animate-pulse'
                    : item.statusTone === 'emerald'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                    : item.statusTone === 'amber'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                    : 'bg-blue-100 text-blue-800 dark:bg-cyan-500/10 dark:text-cyan-300 border border-blue-200 dark:border-cyan-500/25'
                }`}>
                  {item.liveData}
                </span>
              </div>

              {/* User-friendly subtitle */}
              <div className="pl-6 text-[10px] font-sans text-slate-500 dark:text-slate-400 line-clamp-1 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                {item.description}
              </div>
            </button>
          );
        })}

        {/* 3D Simulator Interactive Launcher */}
        <div className="pt-2">
          <button
            onClick={() => setSimulatorModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-gradient-to-r dark:from-blue-950/60 dark:to-cyan-950/60 border border-blue-300 dark:border-cyan-500/30 hover:border-blue-400 dark:hover:border-cyan-400 text-xs font-medium text-blue-900 dark:text-cyan-200 shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Car className="w-4 h-4 text-blue-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="font-semibold tracking-wide">3D CITY SIMULATOR</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-200 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-300 dark:border-blue-400/30">
              HUD LIVE
            </span>
          </button>
        </div>
      </nav>

      {/* Bottom Controls: Daylight Mode Toggle + Connection Mode + Kill Switch */}
      <div className="p-4 border-t border-slate-200 dark:border-cyan-500/15 space-y-2.5 bg-slate-50 dark:bg-[#060A12] transition-colors">
        {/* High-Contrast Daylight Mode Toggle Button */}
        <button
          onClick={toggleDaylightMode}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-mono text-xs font-bold border transition-all ${
            daylightMode
              ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm'
              : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {daylightMode ? (
              <Sun className="w-4 h-4 text-amber-200 animate-spin-slow" />
            ) : (
              <Moon className="w-4 h-4 text-cyan-300" />
            )}
            <span>{daylightMode ? 'DAYLIGHT MODE (ON)' : 'CYBER DARK (ON)'}</span>
          </div>
          <span className="text-[10px] opacity-80 uppercase">
            {daylightMode ? 'SWITCH DARK' : 'SWITCH LIGHT'}
          </span>
        </button>

        {/* Connection Mode Selector */}
        <div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
            <span>DATA STREAM MODE</span>
            <span className="text-blue-600 dark:text-cyan-400 font-bold">
              {connectionMode === 'ONLINE_PI5' ? 'PI 5 LIVE' : connectionMode === 'SIMULATION' ? 'SIM DEMO' : 'OFFLINE'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-white dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono">
            {(['ONLINE_PI5', 'SIMULATION', 'OFFLINE'] as ConnectionMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setConnectionMode(mode)}
                className={`py-1 rounded text-center transition-colors ${
                  connectionMode === mode
                    ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {mode === 'ONLINE_PI5' ? 'PI 5' : mode === 'SIMULATION' ? 'DEMO' : 'OFF'}
              </button>
            ))}
          </div>
        </div>

        {/* Emergency Kill Switch Simulator */}
        <button
          onClick={toggleKillSwitch}
          className={`w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg font-mono text-xs font-bold tracking-wider transition-all shadow-md ${
            killSwitchActive
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border border-rose-400 animate-hazard'
              : 'bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
          }`}
        >
          <Power className={`w-4 h-4 ${killSwitchActive ? 'animate-spin' : ''}`} />
          {killSwitchActive ? 'KILL SWITCH ENGAGED' : 'EMERGENCY KILL SWITCH'}
        </button>
      </div>
    </aside>
  );
};
