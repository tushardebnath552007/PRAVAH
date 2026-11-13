import React, { useState } from 'react';
import { Video } from 'lucide-react';
import { RoadVehicleDetector } from '../ai-perception/RoadVehicleDetector';
import type { VisionTabItem, VisionTabType } from '../ai-perception/types';

const VISION_TABS: VisionTabItem[] = [
  { id: 'road_vision', label: 'Road, Vehicle & Hazard Vision', hint: 'Green lines · YOLO · Live' },
  { id: 'adas_safety', label: 'Blind Spots & Forward Collision', hint: 'FCW · BSD · Corner' },
  { id: 'road_conditions', label: 'Unstructured Road & Potholes', hint: 'Terrain & Surface' },
  { id: 'stability_analytics', label: 'Model Stability (D3.js)', hint: '30-frame window' }
];

export const AiPerceptionView: React.FC = () => {
  const [visionTab, setVisionTab] = useState<VisionTabType>('road_vision');

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fadeIn">
      {/* Road, Vehicle & Hazard Vision — video detection engine */}
      <div className="rounded-2xl border border-sky-500/25 dark:border-cyan-500/25 bg-white/70 dark:bg-[#04070D] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-cyan-500/10 border border-sky-500/25 dark:border-cyan-500/25 text-sky-600 dark:text-cyan-400 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs font-mono font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                03. AI Perception &amp; Road Hazard Vision
              </h1>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Video-based perception lab · optical flow, NMS tracking, blind-spot and forward-collision analytics
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-2 py-0.5 rounded border border-sky-500/30 dark:border-cyan-500/30 bg-sky-500/10 dark:bg-cyan-500/10 text-[10px] font-mono font-bold text-sky-700 dark:text-cyan-300">
            NMS · TRACKING · D3
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {VISION_TABS.map((tab) => {
            const isActive = visionTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setVisionTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap transition-colors border ${
                  isActive
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold border-sky-600 dark:border-cyan-400'
                    : 'bg-slate-100 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`hidden lg:inline text-[9px] ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {tab.hint}
                </span>
              </button>
            );
          })}
        </div>

        {/* The vision console is intentionally dark, like a camera feed wall. */}
        <div className="rounded-2xl bg-[#04070D] border border-slate-800 p-3 sm:p-4">
          <RoadVehicleDetector activeTab={visionTab} setActiveTab={setVisionTab} />
        </div>
      </div>
    </div>
  );
};
