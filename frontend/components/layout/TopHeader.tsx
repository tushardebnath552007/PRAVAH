import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Cpu, 
  Eye, 
  FileSpreadsheet, 
  ShieldAlert, 
  BarChart3, 
  ShieldCheck, 
  Clock, 
  CloudFog, 
  CloudRain, 
  Bell, 
  AlertTriangle, 
  CheckCircle2, 
  Flame,
  X 
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { NavigationTab } from '../../types/telemetry';

const TAB_META: Record<NavigationTab, { title: string; subtitle: string; icon: React.ElementType }> = {
  'command-center': {
    title: 'Command Center',
    subtitle: 'Autonomous Telemetry & Spatial Radar',
    icon: LayoutDashboard,
  },
  'sensor-matrix': {
    title: 'Sensor Matrix',
    subtitle: 'Raspberry Pi 5 Hardware & Stream Telemetry',
    icon: Cpu,
  },
  'ai-perception': {
    title: 'AI Perception',
    subtitle: 'Neural Vision Feed & Object Detection',
    icon: Eye,
  },
  'data-sheet': {
    title: 'Data Sheet & Environment',
    subtitle: '360° Proximity & Road Friction Diagnostics',
    icon: FileSpreadsheet,
  },
  'threat-actuation': {
    title: 'Threat & Actuation',
    subtitle: 'AEB Braking Override & Servo Controllers',
    icon: ShieldAlert,
  },
  'diagnostics-logs': {
    title: 'Diagnostics & Logs',
    subtitle: 'CAN Bus Health & Timestamped Event History',
    icon: BarChart3,
  },
};

export const TopHeader: React.FC = () => {
  const { 
    aebActive, 
    killSwitchActive, 
    fogDensityPct, 
    fogLevel, 
    rainLevel, 
    triggerManualAEB, 
    releaseAEB, 
    eventLogs,
    activeTab
  } = useTelemetry();

  const [currentTime, setCurrentTime] = useState<string>('');
  const [notificationOpen, setNotificationOpen] = useState<boolean>(false);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadAlertsCount = eventLogs.filter(l => l.severity === 'CRITICAL' || l.severity === 'WARNING').length;
  const currentTab = TAB_META[activeTab] || TAB_META['command-center'];
  const TabIcon = currentTab.icon;

  return (
    <header className="h-16 px-4 sm:px-6 bg-white/95 dark:bg-[#04070D]/90 border-b border-slate-200 dark:border-cyan-500/20 backdrop-blur-xl flex items-center justify-between sticky top-0 z-20 transition-colors duration-200">
      {/* Left: Clean Active View Context */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 dark:bg-cyan-950/50 border border-blue-200 dark:border-cyan-500/30 text-blue-600 dark:text-cyan-400 shrink-0">
          <TabIcon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold tracking-wide text-slate-900 dark:text-cyan-300 font-mono truncate">
            {currentTab.title}
          </h1>
          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate hidden sm:block">
            {currentTab.subtitle}
          </p>
        </div>
      </div>

      {/* Center: ADAS System Safety Status Pill */}
      <div className="hidden md:flex items-center justify-center">
        <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wide border flex items-center gap-2 transition-all shadow-sm ${
          killSwitchActive
            ? 'bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-500/80'
            : aebActive
            ? 'bg-rose-100 text-rose-900 border-rose-400 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-500/70 animate-pulse'
            : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-500/40'
        }`}>
          {killSwitchActive ? (
            <>
              <Flame className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
              <span>KILL SWITCH ACTIVE</span>
            </>
          ) : aebActive ? (
            <>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>AEB BRAKING ACTIVE</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ADAS SAFETY NOMINAL</span>
            </>
          )}
        </span>
      </div>

      {/* Right: Weather Condition (if adverse) + Clock + Alerts + Manual AEB */}
      <div className="flex items-center gap-3">
        {fogLevel > 1 && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-mono">
            <CloudFog className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
            <span>Fog: {fogDensityPct}%</span>
          </div>
        )}

        {rainLevel > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-500/40 text-blue-800 dark:text-blue-300 text-xs font-mono">
            <CloudRain className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Rain: Lvl {rainLevel}</span>
          </div>
        )}

        {/* Live System Digital Clock */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
          <span className="tabular-nums font-bold text-slate-900 dark:text-slate-100">{currentTime || '--:--:--'}</span>
        </div>

        {/* Diagnostic Notifications Drawer Toggle */}
        <div className="relative">
          <button
            onClick={() => setNotificationOpen(prev => !prev)}
            className="relative p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-300 transition-colors"
            title="System Alerts & Diagnostics"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-mono font-bold text-white shadow-sm">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-[#090D16] border border-slate-200 dark:border-cyan-500/30 shadow-2xl p-4 z-50 text-slate-800 dark:text-slate-200 animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs font-mono font-bold">
                  <Bell className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                  <span>SYSTEM TELEMETRY ALERTS</span>
                </div>
                <button
                  onClick={() => setNotificationOpen(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 my-2">
                {eventLogs.slice(0, 8).map((log) => (
                  <div key={log.id} className="py-2 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className={`font-bold ${
                        log.severity === 'CRITICAL' ? 'text-rose-600 dark:text-rose-400' :
                        log.severity === 'WARNING' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-cyan-400'
                      }`}>
                        [{log.severity}] {log.category}
                      </span>
                      <span className="text-slate-400">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-tight">{log.message}</p>
                    {log.metricValue && (
                      <span className="inline-block mt-1 text-[10px] font-mono text-blue-700 dark:text-cyan-300/80 bg-blue-50 dark:bg-cyan-950/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-cyan-800/40">
                        {log.metricValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[11px] font-mono">
                <button
                  onClick={() => setNotificationOpen(false)}
                  className="text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  Close Panel
                </button>
                <span className="text-slate-400">Total: {eventLogs.length} events</span>
              </div>
            </div>
          )}
        </div>

        {/* Primary Action: AEB Brake / Release Button */}
        {aebActive ? (
          <button
            onClick={releaseAEB}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-md"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RELEASE AEB</span>
          </button>
        ) : (
          <button
            onClick={triggerManualAEB}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all shadow-md animate-pulse"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AEB BRAKE</span>
          </button>
        )}
      </div>
    </header>
  );
};
