import React, { useState } from "react";
import {
  ShieldAlert,
  Flame,
  Users,
  Clock,
  X,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  Download,
  Trash2,
  Filter,
  Search,
  ExternalLink,
  Sliders,
  Check,
  AlertOctagon,
  Eye,
  ChevronRight
} from "lucide-react";

export interface CriticalAlertEvent {
  id: string;
  timestamp: string; // e.g. "12:24:18 PM"
  timestampMs: number;
  videoTimeSec: number; // Video currentTime in seconds
  frame: number;
  type: "fcw_collision" | "pedestrian_hazard";
  severity: "CRITICAL" | "HIGH" | "EMERGENCY";
  title: string;
  description: string;
  metrics: {
    ttc?: number;
    distanceM?: number;
    closingSpeedKmh?: number;
    leadVehicleId?: number;
    pedestrianId?: number;
    confidence?: number;
    trajectory?: string;
  };
  acknowledged?: boolean;
}

interface HistoricalAlertsSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: CriticalAlertEvent[];
  onJumpToTimestamp: (timeSec: number) => void;
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
  onClearAll: () => void;
}

type FilterType = "all" | "fcw" | "pedestrian";

export const HistoricalAlertsSidePanel: React.FC<HistoricalAlertsSidePanelProps> = ({
  isOpen,
  onClose,
  alerts,
  onJumpToTimestamp,
  onAcknowledge,
  onAcknowledgeAll,
  onClearAll
}) => {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [showUnreviewedOnly, setShowUnreviewedOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen) return null;

  // Filter alerts
  const filteredAlerts = alerts.filter((alert) => {
    if (filterType === "fcw" && alert.type !== "fcw_collision") return false;
    if (filterType === "pedestrian" && alert.type !== "pedestrian_hazard") return false;
    if (showUnreviewedOnly && alert.acknowledged) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = alert.title.toLowerCase().includes(q);
      const matchDesc = alert.description.toLowerCase().includes(q);
      const matchFrame = `frame #${alert.frame}`.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchFrame) return false;
    }
    return true;
  });

  const fcwCount = alerts.filter((a) => a.type === "fcw_collision").length;
  const pedCount = alerts.filter((a) => a.type === "pedestrian_hazard").length;
  const unreviewedCount = alerts.filter((a) => !a.acknowledged).length;

  const exportAlertsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(alerts, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `critical_alerts_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportAlertsCsv = () => {
    const headers = [
      "ID",
      "Timestamp",
      "Frame",
      "VideoTimeSec",
      "Type",
      "Severity",
      "Title",
      "Description",
      "TTC_Sec",
      "Distance_M",
      "ClosingSpeed_Kmh",
      "LeadVehicleId",
      "PedestrianId",
      "Confidence",
      "Acknowledged"
    ];

    const rows = alerts.map((a) => [
      a.id,
      `"${a.timestamp}"`,
      a.frame,
      a.videoTimeSec.toFixed(2),
      a.type,
      a.severity,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.description.replace(/"/g, '""')}"`,
      a.metrics.ttc ?? "",
      a.metrics.distanceM ?? "",
      a.metrics.closingSpeedKmh ?? "",
      a.metrics.leadVehicleId ?? "",
      a.metrics.pedestrianId ?? "",
      a.metrics.confidence ? (a.metrics.confidence * 100).toFixed(0) + "%" : "",
      a.acknowledged ? "YES" : "NO"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `critical_alerts_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel Drawer */}
      <div className="relative w-full max-w-lg bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center relative">
              <ShieldAlert className="w-5 h-5" />
              {unreviewedCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Historical Critical Alerts</h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950 border border-red-500/40 text-red-400">
                  {alerts.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Forward Collision Warning (FCW) &amp; Vulnerable Pedestrian Log
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-3 gap-2 px-5 py-3 bg-slate-900/30 border-b border-slate-800/80 text-xs font-mono">
          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-850">
            <div className="text-[10px] text-slate-400">FCW Collisions</div>
            <div className="text-sm font-bold text-red-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-red-400" />
              {fcwCount} Events
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-850">
            <div className="text-[10px] text-slate-400">Pedestrian VRU</div>
            <div className="text-sm font-bold text-fuchsia-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-fuchsia-400" />
              {pedCount} Events
            </div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-850">
            <div className="text-[10px] text-slate-400">Unreviewed</div>
            <div className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              {unreviewedCount} Pending
            </div>
          </div>
        </div>

        {/* Controls & Filter Bar */}
        <div className="p-4 space-y-3 border-b border-slate-800/80 bg-slate-950">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search alerts by frame #, vehicle ID, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setFilterType("all")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  filterType === "all"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All ({alerts.length})
              </button>
              <button
                onClick={() => setFilterType("fcw")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  filterType === "fcw"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Flame className="w-3 h-3" />
                FCW ({fcwCount})
              </button>
              <button
                onClick={() => setFilterType("pedestrian")}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  filterType === "pedestrian"
                    ? "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Users className="w-3 h-3" />
                Pedestrians ({pedCount})
              </button>
            </div>

            {/* Unreviewed Toggle */}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showUnreviewedOnly}
                onChange={(e) => setShowUnreviewedOnly(e.target.checked)}
                className="accent-red-500 rounded cursor-pointer"
              />
              <span>Unreviewed only</span>
            </label>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                onClick={onAcknowledgeAll}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                title="Mark all as reviewed"
              >
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Mark All Reviewed</span>
              </button>

              <button
                onClick={onClearAll}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-900/60 text-slate-400 hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                title="Clear all alerts"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear History</span>
              </button>
            </div>

            {/* Export Menu */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={exportAlertsCsv}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1 transition-colors cursor-pointer font-mono"
              >
                <Download className="w-3 h-3 text-blue-400" />
                <span>CSV</span>
              </button>
              <button
                onClick={exportAlertsJson}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center gap-1 transition-colors cursor-pointer font-mono"
              >
                <Download className="w-3 h-3 text-purple-400" />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-850">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">No Critical Alerts Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {searchQuery || showUnreviewedOnly || filterType !== "all"
                    ? "No alerts match the active filters or search terms."
                    : "No forward collision or pedestrian safety hazards have occurred yet. Play the video or trigger simulated alerts."}
                </p>
              </div>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isFcw = alert.type === "fcw_collision";

              return (
                <div
                  key={alert.id}
                  className={`pt-3 first:pt-0 transition-all rounded-xl p-3 border ${
                    !alert.acknowledged
                      ? isFcw
                        ? "bg-red-950/20 border-red-500/40 shadow-sm"
                        : "bg-fuchsia-950/20 border-fuchsia-500/40 shadow-sm"
                      : "bg-slate-900/40 border-slate-850/80 hover:bg-slate-900/60"
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isFcw
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                        }`}
                      >
                        {isFcw ? <Flame className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              alert.severity === "CRITICAL"
                                ? "bg-red-600 text-white"
                                : "bg-amber-600 text-white"
                            }`}
                          >
                            {alert.severity}
                          </span>
                          <span className="text-xs font-bold text-white">{alert.title}</span>
                        </div>
                      </div>
                    </div>

                    {/* Timestamp & Frame */}
                    <div className="text-right font-mono text-[11px] text-slate-400">
                      <div className="flex items-center gap-1 text-slate-300">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{alert.timestamp}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Frame #{alert.frame}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {alert.description}
                  </p>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-800/60 text-xs font-mono">
                    {isFcw ? (
                      <>
                        <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
                          <span className="text-[10px] text-slate-500 block">TTC (Headway)</span>
                          <span className="font-bold text-red-400">
                            {alert.metrics.ttc ? `${alert.metrics.ttc.toFixed(1)}s` : "Critical"}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
                          <span className="text-[10px] text-slate-500 block">Range</span>
                          <span className="font-bold text-white">
                            {alert.metrics.distanceM ? `${alert.metrics.distanceM}m` : "N/A"}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
                          <span className="text-[10px] text-slate-500 block">Closing Spd</span>
                          <span className="font-bold text-sky-400">
                            {alert.metrics.closingSpeedKmh ? `+${alert.metrics.closingSpeedKmh}km/h` : "N/A"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
                          <span className="text-[10px] text-slate-500 block">Corridor Position</span>
                          <span className="font-bold text-fuchsia-400">
                            {alert.metrics.trajectory || "In Travel Path"}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
                          <span className="text-[10px] text-slate-500 block">Target Range</span>
                          <span className="font-bold text-white">
                            {alert.metrics.distanceM ? `${alert.metrics.distanceM}m` : "N/A"}
                          </span>
                        </div>
                        <div className="p-1.5 rounded bg-slate-950/60 border border-slate-850">
                          <span className="text-[10px] text-slate-500 block">Confidence</span>
                          <span className="font-bold text-emerald-400">
                            {alert.metrics.confidence ? `${(alert.metrics.confidence * 100).toFixed(0)}%` : "High"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => onJumpToTimestamp(alert.videoTimeSec)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Seek video directly to this alert frame timestamp"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Seek to Timestamp ({alert.videoTimeSec.toFixed(1)}s)</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {!alert.acknowledged ? (
                        <button
                          onClick={() => onAcknowledge(alert.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Mark Reviewed</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real-Time ADAS Logger</span>
          </div>
          <span>Auto-debounced logging</span>
        </div>
      </div>
    </div>
  );
};
