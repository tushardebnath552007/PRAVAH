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
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Volume2, 
  Sliders, 
  Zap, 
  BellRing, 
  CheckCircle2, 
  Power,
  RotateCw,
  Gauge
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const ThreatActuationView: React.FC = () => {
  const { 
    aebActive, 
    triggerManualAEB, 
    releaseAEB, 
    servoAngle, 
    lidarDistance, 
    settings, 
    updateSettings, 
    testPiezoBeep, 
    speakVoiceAlert, 
    history,
    killSwitchActive,
    daylightMode
  } = useTelemetry();

  const [testBeepPlaying, setTestBeepPlaying] = useState<boolean>(false);

  const tooltipStyle = {
    backgroundColor: daylightMode ? '#ffffff' : '#090D16',
    border: daylightMode ? '1px solid #FF0055' : '1px solid #FF0055',
    color: daylightMode ? '#0f172a' : '#f8fafc',
    fontSize: '11px',
    fontFamily: 'monospace',
    boxShadow: daylightMode ? '0 4px 12px rgba(0,0,0,0.1)' : '0 0 10px rgba(255,0,85,0.2)'
  };
  const gridStroke = daylightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';

  const handleTestBeep = () => {
    setTestBeepPlaying(true);
    testPiezoBeep();
    setTimeout(() => setTestBeepPlaying(false), 300);
  };

  const handleVoiceTest = (phrase: string) => {
    speakVoiceAlert(phrase);
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fadeIn">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-500/20 dark:border-cyan-500/20">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-wider text-rose-600 dark:text-cyan-400 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            05. THREAT MATRIX & HARDWARE ACTUATION
          </h1>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Emergency braking controls, servo braking angle actuation, piezo acoustic transducers, and ADAS calibration
          </p>
        </div>

        {/* Primary Manual Override */}
        <div>
          {aebActive ? (
            <button
              onClick={releaseAEB}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white dark:text-slate-950 font-mono text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              <CheckCircle2 className="w-4 h-4 text-white dark:text-slate-950" />
              <span>DISENGAGE AEB OVERRIDE</span>
            </button>
          ) : (
            <button
              onClick={triggerManualAEB}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_20px_rgba(255,0,85,0.4)] animate-pulse"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>ENGAGE AEB BRAKE NOW</span>
            </button>
          )}
        </div>
      </div>

      {/* ADAS Feature Control Panel */}
      <div className="glass-panel p-5 rounded-xl space-y-4">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
          ADAS SAFETY PROTOCOL CALIBRATION
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* FCW Sensitivity */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">FCW SENSITIVITY</span>
              <span className="text-sky-700 dark:text-cyan-400 font-bold">{settings.fcwSensitivity}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Forward collision warning lookahead distance margin</p>
            <div className="grid grid-cols-3 gap-1 pt-2">
              {(['Conservative', 'Balanced', 'Aggressive'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateSettings({ fcwSensitivity: mode })}
                  className={`py-1.5 rounded text-[10px] font-bold transition-colors ${
                    settings.fcwSensitivity === mode 
                      ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 shadow-sm' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* AEB Threshold */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">AEB THRESHOLD</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{settings.aebThresholdMeters.toFixed(1)} METERS</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Automatic emergency braking actuation trigger point</p>
            <div className="pt-2">
              <input 
                type="range" 
                min="1.0" 
                max="3.0" 
                step="0.1"
                value={settings.aebThresholdMeters}
                onChange={(e) => updateSettings({ aebThresholdMeters: parseFloat(e.target.value) })}
                className="w-full accent-rose-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>1.0m (Tight)</span>
                <span>2.0m</span>
                <span>3.0m (Early)</span>
              </div>
            </div>
          </div>

          {/* LKA Drift Assist */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">LKA ASSIST</span>
              <span className={`font-bold ${settings.lkaEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {settings.lkaEnabled ? 'ARMED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Lane keeping steering torque and boundary departure warning</p>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Drift Limit: 8°</span>
              <button
                onClick={() => updateSettings({ lkaEnabled: !settings.lkaEnabled })}
                className={`px-3 py-1 rounded text-[11px] font-bold ${
                  settings.lkaEnabled 
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-400/40 dark:border-emerald-500/50' 
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {settings.lkaEnabled ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* ACC Gap Setting */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200">ACC CRUISE GAP</span>
              <span className="text-sky-700 dark:text-cyan-400 font-bold">{settings.accTimeGapSec.toFixed(1)}s TIME GAP</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">Adaptive cruise control following distance gap</p>
            <div className="pt-2">
              <input 
                type="range" 
                min="1.0" 
                max="2.5" 
                step="0.5"
                value={settings.accTimeGapSec}
                onChange={(e) => updateSettings({ accTimeGapSec: parseFloat(e.target.value) })}
                className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>1.0s (Sport)</span>
                <span>1.5s (Std)</span>
                <span>2.5s (Safe)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Actuators Telemetry & Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Actuator 1: Model Servo Braking Angle */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-sky-700 dark:text-cyan-400 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                BRAKE SERVO ANGLE
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                servoAngle > 45 ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-400 dark:border-rose-500 animate-pulse' : 'text-slate-500 dark:text-slate-400'
              }`}>
                PWM GPIO 18
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className={`text-4xl font-mono font-bold tabular-nums ${
                servoAngle > 70 ? 'text-rose-600 dark:text-rose-400' : servoAngle > 30 ? 'text-amber-600 dark:text-amber-300' : 'text-sky-700 dark:text-cyan-300'
              }`}>
                {servoAngle}°
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {servoAngle === 90 ? 'FULL STOP' : servoAngle === 0 ? 'FREE ROLL' : 'PARTIAL'}
              </span>
            </div>

            {/* Visual Servo Gauge Arc */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 overflow-hidden my-3">
              <div 
                className={`h-full transition-all duration-300 ${
                  servoAngle > 70 ? 'bg-rose-500' : servoAngle > 30 ? 'bg-amber-400' : 'bg-sky-500'
                }`}
                style={{ width: `${(servoAngle / 90) * 100}%` }}
              />
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>0° Free Roll</span>
            <span>45° Moderate</span>
            <span>90° Emergency</span>
          </div>
        </div>

        {/* Actuator 2: Piezo Acoustic Alarm (Web Audio API) */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                PIEZO TRANSDUCER
              </span>
              <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-semibold">
                {settings.piezoFrequency} Hz
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-3xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                {settings.piezoVolume}%
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">DECIBEL GAIN</span>
            </div>

            <div className="space-y-2 my-2 text-xs font-mono">
              <div className="flex justify-between text-[11px] text-slate-700 dark:text-slate-300">
                <span>Tone Frequency:</span>
                <span className="text-amber-600 dark:text-amber-300 font-bold">{settings.piezoFrequency} Hz</span>
              </div>
              <input 
                type="range" 
                min="1200" 
                max="3600" 
                step="200"
                value={settings.piezoFrequency}
                onChange={(e) => updateSettings({ piezoFrequency: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={handleTestBeep}
            className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              testBeepPlaying 
                ? 'bg-amber-400 text-slate-950 scale-95 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-950/90 text-amber-800 dark:text-amber-300 border border-amber-400/40 dark:border-amber-500/40'
            }`}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{testBeepPlaying ? 'SOUND EMITTED' : 'TEST PIEZO BEEP'}</span>
          </button>
        </div>

        {/* Actuator 3: Warning LED Matrix */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                LED MATRIX PATTERN
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">WS2812B</span>
            </div>

            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-3">
              Automotive external visual hazard strobe array on front grille
            </p>

            <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
              {[
                { id: 'OFF', label: 'OFF / STEADY' },
                { id: 'FLASH_RED', label: 'FLASH RED' },
                { id: 'STROBE_AMBER', label: 'STROBE AMBER' },
                { id: 'SOLID_BLUE', label: 'SOLID BLUE' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => updateSettings({ ledPattern: p.id as any })}
                  className={`py-1.5 px-2 rounded text-[10px] font-bold border transition-colors ${
                    settings.ledPattern === p.id 
                      ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 border-sky-600 dark:border-cyan-400 font-bold' 
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>ACTIVE: {settings.ledPattern}</span>
            <span>VOLTAGE: 5.0V</span>
          </div>
        </div>

        {/* Actuator 4: Voice Guidance System */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-sky-700 dark:text-cyan-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-sky-600 dark:text-cyan-400" />
                VOICE GUIDANCE
              </span>
              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">I2S DAC</span>
            </div>

            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mb-3">
              Synthetic cockpit speech synthesis for critical driver situational alerts
            </p>

            <div className="space-y-1.5 text-xs font-mono">
              <button
                onClick={() => handleVoiceTest('Warning: Obstacle Ahead! Distance closing.')}
                className="w-full py-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 hover:text-sky-700 dark:text-slate-300 dark:hover:text-cyan-300 text-left border border-slate-200 dark:border-slate-800 text-[11px] flex justify-between transition-colors"
              >
                <span>"Obstacle Ahead"</span>
                <span className="text-sky-700 dark:text-cyan-400 font-bold">PLAY ▶</span>
              </button>
              <button
                onClick={() => handleVoiceTest('Emergency Brake Applied!')}
                className="w-full py-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 hover:text-rose-700 dark:text-slate-300 dark:hover:text-rose-300 text-left border border-slate-200 dark:border-slate-800 text-[11px] flex justify-between transition-colors"
              >
                <span>"Brake Applied"</span>
                <span className="text-rose-600 dark:text-rose-400 font-bold">PLAY ▶</span>
              </button>
              <button
                onClick={() => handleVoiceTest('Lane Departure Warning. Correct Steering.')}
                className="w-full py-1 px-2.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300 text-left border border-slate-200 dark:border-slate-800 text-[11px] flex justify-between transition-colors"
              >
                <span>"Lane Drift Alert"</span>
                <span className="text-amber-600 dark:text-amber-400 font-bold">PLAY ▶</span>
              </button>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>DAC: MAX98357A</span>
            <span>SAMPLE: 44.1 kHz</span>
          </div>
        </div>
      </div>

      {/* Live Recharts Threat Index Graph over the last 60 seconds */}
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
              60-SECOND COMPOSITE THREAT INDEX STREAM
            </h2>
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
              Real-time multi-sensor risk scoring combining LiDAR clearance, time-to-collision (TTC), and surface traction
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-600 dark:text-slate-400">HAZARD THRESHOLD: <strong className="text-rose-600 dark:text-rose-400">75+ INDEX</strong></span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="threatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF0055" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#FF0055" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
              <XAxis dataKey="timestamp" stroke="#64748b" fontSize={10} fontFamily="monospace" />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} fontFamily="monospace" />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="threatIndex" stroke="#FF0055" strokeWidth={2} fill="url(#threatGrad)" dot={false} isAnimationActive={false} name="Threat Index (0-100)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
