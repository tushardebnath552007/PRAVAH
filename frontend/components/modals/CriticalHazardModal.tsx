import React from 'react';
import { AlertTriangle, ShieldAlert, XCircle, CheckCircle } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const CriticalHazardModal: React.FC = () => {
  const { 
    criticalHazardModal, 
    dismissHazardModal, 
    triggerManualAEB, 
    aebActive, 
    speed, 
    lidarDistance 
  } = useTelemetry();

  if (!criticalHazardModal.isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn select-none">
      <div className="max-w-md w-full glass-panel-danger rounded-2xl p-6 text-center border-2 border-rose-500 animate-hazard relative">
        {/* Pulsing Hazard Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-rose-950/80 border-2 border-rose-500 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(255,0,85,0.6)]">
          <AlertTriangle className="w-9 h-9 text-rose-400 animate-bounce" />
        </div>

        {/* Hazard Title */}
        <h2 className="text-xl font-['Chakra_Petch'] font-bold text-white tracking-widest uppercase mb-1">
          CRITICAL ADAS PROXIMITY HAZARD
        </h2>
        <p className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider mb-4">
          AUTOMATIC COLLISION AVOIDANCE INITIATED
        </p>

        {/* Hazard Reason Box */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/40 text-left font-mono text-xs space-y-1.5 mb-5">
          <div className="flex justify-between text-slate-400">
            <span>TRIGGER CAUSE:</span>
            <span className="text-rose-400 font-bold">{criticalHazardModal.reason}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>FORWARD LIDAR RANGE:</span>
            <span className="text-white font-bold">{lidarDistance.toFixed(2)} METERS</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>CURRENT VEHICLE SPEED:</span>
            <span className="text-white font-bold">{speed} KM/H</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>ACTUATOR STATE:</span>
            <span className={aebActive ? 'text-rose-400 font-bold' : 'text-amber-400'}>
              {aebActive ? 'SERVO LOCK 90° (AEB ACTIVE)' : 'STANDBY'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 font-mono text-xs font-bold">
          {!aebActive && (
            <button
              onClick={triggerManualAEB}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_20px_rgba(255,0,85,0.4)] transition-all flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>ENGAGE AEB BRAKE</span>
            </button>
          )}

          <button
            onClick={dismissHazardModal}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>ACKNOWLEDGE & DISMISS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
