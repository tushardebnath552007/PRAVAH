import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Car,
  Camera,
  Play,
  Pause,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Gauge,
  Radio,
  CloudRain,
  Moon,
  Sun,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  OctagonX,
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

type SimInstance = 'embedded' | 'modal';

interface AdasWorldSimulationProps {
  height?: string;
  allowFullscreen?: boolean;
  /** Compact HUD for the dashboard panel (false for the fullscreen modal). */
  embed?: boolean;
  instance?: SimInstance;
}

export const AdasWorldSimulation: React.FC<AdasWorldSimulationProps> = ({
  height = '620px',
  allowFullscreen = true,
  embed = true,
  instance = 'embedded',
}) => {
  const {
    speed,
    gear,
    heading,
    lidarDistance,
    detectedObjects,
    aebActive,
    simulationLinked,
    connectionMode,
    isSimRunning,
    toggleSimRunning,
    triggerManualAEB,
    releaseAEB,
    setSimulatorModalOpen,
    simulatorModalOpen,
    settings,
    rainLevel,
    fogLevel,
    nightMode,
    daylightMode,
    toggleNightMode,
  } = useTelemetry();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlRef = useRef<BroadcastChannel | null>(null);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'chase' | 'orbit'>('chase');
  const [heldKey, setHeldKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      controlRef.current = new BroadcastChannel('adas_control_channel');
    } catch {
      controlRef.current = null;
    }
    return () => {
      controlRef.current?.close();
      controlRef.current = null;
    };
  }, []);

  const send = useCallback(
    (payload: Record<string, unknown>) => {
      try {
        controlRef.current?.postMessage({ ...payload, target: instance });
      } catch {
        // channel not available
      }
    },
    [instance]
  );

  const syncSimulator = useCallback(() => {
    send({
      type: 'config',
      aebThreshold: settings.aebThresholdMeters,
      antiGlare: settings.antiGlareShieldAuto,
    });
    send({ type: 'weather', rainLevel, fogLevel });
    send({ type: 'night', enabled: nightMode });
    send({ type: 'camera', mode: cameraMode });
    const paused = !isSimRunning || (embed && simulatorModalOpen);
    send({ type: 'pause', paused });
  }, [
    send,
    settings.aebThresholdMeters,
    settings.antiGlareShieldAuto,
    rainLevel,
    fogLevel,
    nightMode,
    cameraMode,
    isSimRunning,
    simulatorModalOpen,
    embed,
  ]);

  // Re-apply controls whenever site settings or weather change
  useEffect(() => {
    send({
      type: 'config',
      aebThreshold: settings.aebThresholdMeters,
      antiGlare: settings.antiGlareShieldAuto,
    });
  }, [send, settings.aebThresholdMeters, settings.antiGlareShieldAuto]);

  useEffect(() => {
    send({ type: 'weather', rainLevel, fogLevel });
  }, [send, rainLevel, fogLevel]);

  useEffect(() => {
    send({ type: 'night', enabled: nightMode });
  }, [send, nightMode]);

  useEffect(() => {
    send({ type: 'camera', mode: cameraMode });
  }, [send, cameraMode]);

  useEffect(() => {
    const paused = !isSimRunning || (embed && simulatorModalOpen);
    send({ type: 'pause', paused });
  }, [send, isSimRunning, simulatorModalOpen, embed]);

  const handleIframeLoad = () => {
    setLoaded(true);
    // Give the module a moment to attach its control channel listener.
    window.setTimeout(syncSimulator, 250);
    window.setTimeout(syncSimulator, 1200);
  };

  const pressDrive = (key: string, down: boolean) => {
    send({ type: 'drive', key, down });
    setHeldKey(down ? key : null);
  };

  const handleAebToggle = () => {
    if (aebActive) {
      releaseAEB();
    } else {
      triggerManualAEB();
    }
  };

  const src = `/assets/simulation/adas-world.html?embed=${embed ? '1' : '0'}&instance=${instance}`;
  const simControlsDashboard = connectionMode === 'SIMULATION';
  const linkLive = simControlsDashboard && simulationLinked && isSimRunning;
  const statusLabel = !simControlsDashboard
    ? 'VIEW ONLY'
    : simulationLinked
      ? (isSimRunning ? 'LIVE FEED' : 'PAUSED')
      : 'CONNECTING';
  const accentText = daylightMode ? 'text-sky-700' : 'text-cyan-300';
  const panelBg = daylightMode ? 'bg-white/80' : 'bg-[#04070D]/80';
  const border = daylightMode ? 'border-slate-300' : 'border-cyan-500/30';
  const muted = daylightMode ? 'text-slate-500' : 'text-slate-400';
  const labelColor = daylightMode ? 'text-slate-500' : 'text-cyan-500/80';

  return (
    <div
      className={`w-full flex flex-col glass-panel rounded-xl overflow-hidden border ${border} shadow-lg`}
      style={{ height }}
    >
      {/* Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b ${border} ${panelBg} backdrop-blur`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Car className={`w-4 h-4 shrink-0 ${accentText}`} />
          <div className="min-w-0">
            <div className={`font-display text-[11px] sm:text-xs font-bold tracking-wider uppercase truncate ${accentText}`}>
              3D ADAS WORLD SIMULATION
            </div>
            <div className={`font-mono text-[9px] truncate ${muted}`}>
              LIVE PHYSICS · 360° LiDAR · VISION INFERENCE
            </div>
          </div>
          <span
            title={!simControlsDashboard ? 'Switch DATA STREAM MODE to DEMO to let the 3D world drive the dashboard' : undefined}
            className={`ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[9px] font-bold ${
              linkLive
                ? 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10'
                : 'text-amber-500 border-amber-500/40 bg-amber-500/10'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${linkLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className={`flex items-center p-0.5 rounded-lg border ${border} ${daylightMode ? 'bg-slate-100' : 'bg-slate-900/70'}`}>
            <button
              onClick={() => setCameraMode('chase')}
              className={`px-2 py-1 rounded-md font-mono text-[9px] font-bold transition-colors flex items-center gap-1 ${
                cameraMode === 'chase' ? 'bg-cyan-500 text-slate-950' : muted
              }`}
              title="Chase camera (key 1)"
            >
              <Camera className="w-3 h-3" /> CHASE
            </button>
            <button
              onClick={() => setCameraMode('orbit')}
              className={`px-2 py-1 rounded-md font-mono text-[9px] font-bold transition-colors flex items-center gap-1 ${
                cameraMode === 'orbit' ? 'bg-cyan-500 text-slate-950' : muted
              }`}
              title="Orbit camera (key 2)"
            >
              <Camera className="w-3 h-3" /> ORBIT
            </button>
          </div>

          <button
            onClick={toggleSimRunning}
            className={`p-1.5 rounded-lg border ${border} hover:border-cyan-400 transition-colors ${aebActive ? 'text-rose-400' : muted}`}
            title={isSimRunning ? 'Pause simulation' : 'Resume simulation'}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleAebToggle}
            className={`p-1.5 rounded-lg border transition-colors ${
              aebActive
                ? 'border-rose-500 text-rose-400 bg-rose-500/10'
                : `${border} hover:border-rose-500/60 ${muted}`
            }`}
            title={aebActive ? 'Release AEB' : 'Test manual AEB'}
          >
            {aebActive ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => send({ type: 'reset' })}
            className={`p-1.5 rounded-lg border ${border} hover:border-cyan-400 transition-colors ${muted}`}
            title="Reset vehicle to start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={toggleNightMode}
            className={`p-1.5 rounded-lg border ${border} hover:border-cyan-400 transition-colors ${nightMode ? 'text-amber-300' : muted}`}
            title={nightMode ? 'Switch to day' : 'Switch to night'}
          >
            {nightMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {allowFullscreen && embed && (
            <button
              onClick={() => setSimulatorModalOpen(true)}
              className={`p-1.5 rounded-lg border ${border} hover:border-cyan-400 transition-colors ${muted}`}
              title="Open fullscreen simulator"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Simulator viewport */}
      <div className={`relative flex-1 min-h-0 ${daylightMode ? 'bg-slate-900' : 'bg-black'}`}>
        <iframe
          ref={iframeRef}
          src={src}
          title="PRAVAH 3D ADAS World Simulation"
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope"
          onLoad={handleIframeLoad}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 font-mono text-xs text-cyan-300">
              <Radio className="w-4 h-4 animate-pulse" /> BOOTING 3D WORLD…
            </div>
          </div>
        )}
      </div>

      {/* Footer telemetry + drive pad */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t ${border} ${panelBg} font-mono`}>
        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <Gauge className={`w-3 h-3 ${accentText}`} />
            <span className={labelColor}>SPEED</span>
            <strong className={accentText}>{Math.round(speed)} km/h</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className={labelColor}>GEAR</span>
            <strong className={accentText}>{gear}</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className={labelColor}>HDG</span>
            <strong className={daylightMode ? 'text-slate-800' : 'text-slate-200'}>{Math.round(heading)}°</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className={labelColor}>FRONT</span>
            <strong className={lidarDistance < 3 ? 'text-rose-400' : accentText}>{lidarDistance.toFixed(2)} m</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className={labelColor}>OBJECTS</span>
            <strong className={daylightMode ? 'text-slate-800' : 'text-slate-200'}>{detectedObjects.length}</strong>
          </span>
          <span className="flex items-center gap-1">
            <CloudRain className={`w-3 h-3 ${muted}`} />
            <span className={labelColor}>RAIN</span>
            <strong className={daylightMode ? 'text-slate-800' : 'text-slate-200'}>{rainLevel}/5</strong>
          </span>
          <span className="flex items-center gap-1">
            <span className={labelColor}>FOG</span>
            <strong className={daylightMode ? 'text-slate-800' : 'text-slate-200'}>{fogLevel}/5</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onPointerDown={(e) => { e.preventDefault(); pressDrive('a', true); }}
            onPointerUp={() => pressDrive('a', false)}
            onPointerLeave={() => heldKey === 'a' && pressDrive('a', false)}
            onPointerCancel={() => pressDrive('a', false)}
            className={`p-1.5 rounded border ${border} ${heldKey === 'a' ? 'bg-cyan-500 text-slate-950' : muted}`}
            title="Steer left (A / ArrowLeft)"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); pressDrive('w', true); }}
            onPointerUp={() => pressDrive('w', false)}
            onPointerLeave={() => heldKey === 'w' && pressDrive('w', false)}
            onPointerCancel={() => pressDrive('w', false)}
            className={`p-1.5 rounded border ${border} ${heldKey === 'w' ? 'bg-cyan-500 text-slate-950' : muted}`}
            title="Accelerate (W / ArrowUp)"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); pressDrive('s', true); }}
            onPointerUp={() => pressDrive('s', false)}
            onPointerLeave={() => heldKey === 's' && pressDrive('s', false)}
            onPointerCancel={() => pressDrive('s', false)}
            className={`p-1.5 rounded border ${border} ${heldKey === 's' ? 'bg-cyan-500 text-slate-950' : muted}`}
            title="Reverse (S / ArrowDown)"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); pressDrive('d', true); }}
            onPointerUp={() => pressDrive('d', false)}
            onPointerLeave={() => heldKey === 'd' && pressDrive('d', false)}
            onPointerCancel={() => pressDrive('d', false)}
            className={`p-1.5 rounded border ${border} ${heldKey === 'd' ? 'bg-cyan-500 text-slate-950' : muted}`}
            title="Steer right (D / ArrowRight)"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); pressDrive('Space', true); }}
            onPointerUp={() => pressDrive('Space', false)}
            onPointerLeave={() => heldKey === 'Space' && pressDrive('Space', false)}
            onPointerCancel={() => pressDrive('Space', false)}
            className={`px-2 py-1.5 rounded border ${border} font-mono text-[9px] font-bold ${
              heldKey === 'Space' ? 'bg-rose-500 text-white border-rose-400' : 'text-rose-400 border-rose-500/40'
            }`}
            title="Brake (Space)"
          >
            <OctagonX className="w-3 h-3 inline mr-1" /> BRAKE
          </button>
        </div>
      </div>
    </div>
  );
};
