import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import {
  Activity,
  Gauge,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Eye,
  Car,
  AlertTriangle,
  Users,
  Flame,
  Layers,
  Crosshair,
  Compass,
  Radar,
  Filter,
  Maximize2
} from "lucide-react";

export interface FrameHazardItem {
  id: string;
  type: "pothole" | "blind_spot" | "blind_corner";
  label: string;
  x: number; // 0 - 100 (% of frame width)
  y: number; // 0 - 100 (% of frame height)
  severity: "Low" | "Medium" | "High" | "Critical";
  confidence: number;
  metric?: string; // e.g. "Depth: 6.8cm" or "Range: 4.2m" or "Sightline: 24m"
  frame: number;
}

export interface FrameConfidenceRecord {
  frame: number;
  vehicleAvgConf: number; // 0.0 - 1.0
  potholeAvgConf: number; // 0.0 - 1.0
  pedestrianAvgConf: number; // 0.0 - 1.0
  fcwRiskScore: number; // 0.0 - 1.0 (1.0 = imminent collision, 0.0 = clear)
  vehicleCount: number;
  potholeCount: number;
  pedestrianCount: number;
  fcwTtc: number; // seconds
  hazards?: FrameHazardItem[];
}

interface ConfidenceHistoryChartProps {
  history: FrameConfidenceRecord[];
  minVehicleGate: number;
  minPotholeGate: number;
  minPedestrianGate?: number;
}

type HazardFilterMode = "all" | "potholes" | "blind_spots";
type ViewMode = "dual" | "spatial_density" | "temporal_stability";

export const ConfidenceHistoryChart: React.FC<ConfidenceHistoryChartProps> = ({
  history,
  minVehicleGate,
  minPotholeGate,
  minPedestrianGate = 0.65
}) => {
  const temporalSvgRef = useRef<SVGSVGElement>(null);
  const spatialSvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("dual");
  const [hazardFilter, setHazardFilter] = useState<HazardFilterMode>("all");
  const [hoveredTemporal, setHoveredTemporal] = useState<FrameConfidenceRecord | null>(null);
  const [hoveredHazard, setHoveredHazard] = useState<FrameHazardItem | null>(null);

  // Compute stability statistics over the 30-frame window
  const displayData = history.slice(-30);
  const vehicleConfs = displayData.filter((d) => d.vehicleCount > 0).map((d) => d.vehicleAvgConf);
  const potholeConfs = displayData.filter((d) => d.potholeCount > 0).map((d) => d.potholeAvgConf);
  const pedConfs = displayData.filter((d) => (d.pedestrianCount || 0) > 0).map((d) => d.pedestrianAvgConf || 0);

  const meanVeh = vehicleConfs.length > 0 ? (d3.mean(vehicleConfs) ?? 0) : 0;
  const stdVeh = vehicleConfs.length > 1 ? (d3.deviation(vehicleConfs) ?? 0) : 0;
  const meanPot = potholeConfs.length > 0 ? (d3.mean(potholeConfs) ?? 0) : 0;
  const stdPot = potholeConfs.length > 1 ? (d3.deviation(potholeConfs) ?? 0) : 0;
  const meanPed = pedConfs.length > 0 ? (d3.mean(pedConfs) ?? 0) : 0;

  // Stability Rating: lower standard deviation = higher model confidence consistency
  const stabilityPct = vehicleConfs.length > 0
    ? Math.max(70, Math.min(99, Math.round(100 - (stdVeh * 100 * 2))))
    : 95;

  // Flatten hazards across the 30-frame window
  const all30FrameHazards: FrameHazardItem[] = [];
  displayData.forEach((rec) => {
    if (rec.hazards && rec.hazards.length > 0) {
      all30FrameHazards.push(...rec.hazards);
    }
  });

  // Filtered hazards for spatial density analysis
  const filteredHazards = all30FrameHazards.filter((h) => {
    if (hazardFilter === "all") return true;
    if (hazardFilter === "potholes") return h.type === "pothole";
    if (hazardFilter === "blind_spots") return h.type === "blind_spot" || h.type === "blind_corner";
    return true;
  });

  const totalPotholesCount = all30FrameHazards.filter((h) => h.type === "pothole").length;
  const totalBlindSpotsCount = all30FrameHazards.filter((h) => h.type === "blind_spot" || h.type === "blind_corner").length;

  // Spatial clustering statistics
  const leftFlankHazards = filteredHazards.filter((h) => h.x <= 25).length;
  const centerLaneHazards = filteredHazards.filter((h) => h.x > 25 && h.x < 75).length;
  const rightFlankHazards = filteredHazards.filter((h) => h.x >= 75).length;

  let peakZoneLabel = "Balanced";
  if (leftFlankHazards > centerLaneHazards && leftFlankHazards > rightFlankHazards) {
    peakZoneLabel = "Left Blind Flank Hotspot";
  } else if (rightFlankHazards > centerLaneHazards && rightFlankHazards > leftFlankHazards) {
    peakZoneLabel = "Right Blind Flank Hotspot";
  } else if (centerLaneHazards >= leftFlankHazards && centerLaneHazards >= rightFlankHazards) {
    peakZoneLabel = "Ego Center Lane Potholes";
  }

  // ─────────────────────────────────────────────────────────────
  // 1. D3 RENDER EFFECT: PRIMARY TEMPORAL STABILITY PLOT
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!temporalSvgRef.current) return;
    if (viewMode === "spatial_density") return;

    const svg = d3.select(temporalSvgRef.current);
    svg.selectAll("*").remove();

    const width = Math.max(320, containerRef.current?.clientWidth || 740);
    const height = 210;
    const margin = { top: 25, right: 35, bottom: 28, left: 45 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    if (displayData.length === 0) {
      svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#64748b")
        .attr("font-size", "12px")
        .attr("font-family", "monospace")
        .text("Awaiting video playback frames to plot real-time confidence scores...");
      return;
    }

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = [0, Math.max(29, displayData.length - 1)];
    const xScale = d3.scaleLinear().domain(xExtent).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([0, 1.0]).range([innerH, 0]);

    // Defs & Linear Gradients
    const defs = svg.append("defs");

    // Vehicle blue gradient
    const vehGrad = defs
      .append("linearGradient")
      .attr("id", "veh-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    vehGrad.append("stop").attr("offset", "0%").attr("stop-color", "#38bdf8").attr("stop-opacity", 0.35);
    vehGrad.append("stop").attr("offset", "100%").attr("stop-color", "#38bdf8").attr("stop-opacity", 0.0);

    // Pothole red gradient
    const potGrad = defs
      .append("linearGradient")
      .attr("id", "pot-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    potGrad.append("stop").attr("offset", "0%").attr("stop-color", "#f87171").attr("stop-opacity", 0.30);
    potGrad.append("stop").attr("offset", "100%").attr("stop-color", "#f87171").attr("stop-opacity", 0.0);

    // Pedestrian magenta gradient
    const pedGrad = defs
      .append("linearGradient")
      .attr("id", "ped-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    pedGrad.append("stop").attr("offset", "0%").attr("stop-color", "#e879f9").attr("stop-opacity", 0.25);
    pedGrad.append("stop").attr("offset", "100%").attr("stop-color", "#e879f9").attr("stop-opacity", 0.0);

    // Horizontal Grid Lines
    const yGrid = d3.axisLeft(yScale).ticks(5).tickSize(-innerW).tickFormat(() => "");
    g.append("g")
      .attr("class", "grid")
      .call(yGrid)
      .selectAll("line")
      .attr("stroke", "#1e293b")
      .attr("stroke-dasharray", "3,3");
    g.select(".grid .domain").remove();

    // Vehicle Gate Line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", yScale(minVehicleGate))
      .attr("y2", yScale(minVehicleGate))
      .attr("stroke", "#0284c7")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1.2)
      .attr("opacity", 0.85);

    g.append("text")
      .attr("x", innerW - 4)
      .attr("y", yScale(minVehicleGate) - 4)
      .attr("text-anchor", "end")
      .attr("fill", "#38bdf8")
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text(`Veh Gate: ${(minVehicleGate * 100).toFixed(0)}%`);

    // Pothole Gate Line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", yScale(minPotholeGate))
      .attr("y2", yScale(minPotholeGate))
      .attr("stroke", "#dc2626")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1.2)
      .attr("opacity", 0.85);

    g.append("text")
      .attr("x", 4)
      .attr("y", yScale(minPotholeGate) - 4)
      .attr("text-anchor", "start")
      .attr("fill", "#f87171")
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text(`Pothole Gate: ${(minPotholeGate * 100).toFixed(0)}%`);

    // D3 Line & Area Generators
    const vehLine = d3
      .line<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.vehicleCount > 0 ? d.vehicleAvgConf : 0))
      .curve(d3.curveMonotoneX);

    const vehArea = d3
      .area<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y0(innerH)
      .y1((d) => yScale(d.vehicleCount > 0 ? d.vehicleAvgConf : 0))
      .curve(d3.curveMonotoneX);

    const potLine = d3
      .line<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.potholeCount > 0 ? d.potholeAvgConf : 0))
      .curve(d3.curveMonotoneX);

    const potArea = d3
      .area<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y0(innerH)
      .y1((d) => yScale(d.potholeCount > 0 ? d.potholeAvgConf : 0))
      .curve(d3.curveMonotoneX);

    const pedLine = d3
      .line<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y((d) => yScale((d.pedestrianCount || 0) > 0 ? (d.pedestrianAvgConf || 0) : 0))
      .curve(d3.curveMonotoneX);

    const pedArea = d3
      .area<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y0(innerH)
      .y1((d) => yScale((d.pedestrianCount || 0) > 0 ? (d.pedestrianAvgConf || 0) : 0))
      .curve(d3.curveMonotoneX);

    const fcwLine = d3
      .line<FrameConfidenceRecord>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d.fcwRiskScore || 0))
      .curve(d3.curveMonotoneX);

    // Area Fills
    g.append("path").datum(displayData).attr("fill", "url(#veh-grad)").attr("d", vehArea);
    g.append("path").datum(displayData).attr("fill", "url(#pot-grad)").attr("d", potArea);
    g.append("path").datum(displayData).attr("fill", "url(#ped-grad)").attr("d", pedArea);

    // Path Lines
    g.append("path")
      .datum(displayData)
      .attr("fill", "none")
      .attr("stroke", "#38bdf8")
      .attr("stroke-width", 2.2)
      .attr("filter", "drop-shadow(0px 0px 4px rgba(56, 189, 248, 0.4))")
      .attr("d", vehLine);

    g.append("path")
      .datum(displayData)
      .attr("fill", "none")
      .attr("stroke", "#f87171")
      .attr("stroke-width", 2.2)
      .attr("filter", "drop-shadow(0px 0px 4px rgba(248, 113, 113, 0.4))")
      .attr("d", potLine);

    g.append("path")
      .datum(displayData)
      .attr("fill", "none")
      .attr("stroke", "#e879f9")
      .attr("stroke-width", 2.0)
      .attr("stroke-dasharray", "4,2")
      .attr("d", pedLine);

    g.append("path")
      .datum(displayData)
      .attr("fill", "none")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1.8)
      .attr("d", fcwLine);

    // Active dots on latest frame
    if (displayData.length > 0) {
      const lastIdx = displayData.length - 1;
      const lastD = displayData[lastIdx];

      if (lastD.vehicleCount > 0) {
        g.append("circle")
          .attr("cx", xScale(lastIdx))
          .attr("cy", yScale(lastD.vehicleAvgConf))
          .attr("r", 4.5)
          .attr("fill", "#38bdf8")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5);
      }
      if (lastD.potholeCount > 0) {
        g.append("circle")
          .attr("cx", xScale(lastIdx))
          .attr("cy", yScale(lastD.potholeAvgConf))
          .attr("r", 4.5)
          .attr("fill", "#f87171")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5);
      }
      if ((lastD.pedestrianCount || 0) > 0) {
        g.append("circle")
          .attr("cx", xScale(lastIdx))
          .attr("cy", yScale(lastD.pedestrianAvgConf || 0))
          .attr("r", 4.5)
          .attr("fill", "#e879f9")
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 1.5);
      }
    }

    // Hover overlay
    const hoverG = g.append("g").attr("class", "hover-layer").style("display", "none");
    const hoverLine = hoverG
      .append("line")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");
    const hoverDot = hoverG
      .append("circle")
      .attr("r", 5)
      .attr("fill", "#38bdf8")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2);

    svg
      .append("rect")
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const idx = Math.max(0, Math.min(displayData.length - 1, Math.round(xScale.invert(mx))));
        const record = displayData[idx];
        if (record) {
          hoverG.style("display", null);
          hoverLine.attr("x1", xScale(idx)).attr("x2", xScale(idx));
          hoverDot.attr("cx", xScale(idx)).attr("cy", yScale(record.vehicleAvgConf));
          setHoveredTemporal(record);
        }
      })
      .on("mouseleave", () => {
        hoverG.style("display", "none");
        setHoveredTemporal(null);
      });

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((d) => `T-${Math.round(29 - Number(d))}`);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .attr("color", "#64748b")
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-family", "monospace");

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${Math.round(Number(d) * 100)}%`);

    g.append("g")
      .call(yAxis)
      .attr("color", "#64748b")
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-family", "monospace");
  }, [displayData, minPotholeGate, minVehicleGate, minPedestrianGate, viewMode]);

  // ─────────────────────────────────────────────────────────────
  // 2. D3 RENDER EFFECT: SECONDARY SPATIAL DENSITY PLOT
  //    (Identified hazards across frame over last 30 frames)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!spatialSvgRef.current) return;
    if (viewMode === "temporal_stability") return;

    const svg = d3.select(spatialSvgRef.current);
    svg.selectAll("*").remove();

    const width = Math.max(320, containerRef.current?.clientWidth || 740);
    const height = 300;
    const margin = { top: 38, right: 35, bottom: 42, left: 45 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const defs = svg.append("defs");

    // Glow filter for high hazard density
    const glowFilter = defs
      .append("filter")
      .attr("id", "heat-glow")
      .attr("x", "-30%").attr("y", "-30%")
      .attr("width", "160%").attr("height", "160%");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const glowMerge = glowFilter.append("feMerge");
    glowMerge.append("feMergeNode").attr("in", "blur");
    glowMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Lateral Density Gradient
    const latGrad = defs
      .append("linearGradient")
      .attr("id", "lat-density-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");
    latGrad.append("stop").attr("offset", "0%").attr("stop-color", "#f59e0b").attr("stop-opacity", 0.7); // Left Blind Spot
    latGrad.append("stop").attr("offset", "20%").attr("stop-color", "#f59e0b").attr("stop-opacity", 0.5);
    latGrad.append("stop").attr("offset", "35%").attr("stop-color", "#e2e8f0").attr("stop-opacity", 0.3);
    latGrad.append("stop").attr("offset", "50%").attr("stop-color", "#ef4444").attr("stop-opacity", 0.85); // Center Pothole cluster
    latGrad.append("stop").attr("offset", "65%").attr("stop-color", "#e2e8f0").attr("stop-opacity", 0.3);
    latGrad.append("stop").attr("offset", "80%").attr("stop-color", "#f59e0b").attr("stop-opacity", 0.5);
    latGrad.append("stop").attr("offset", "100%").attr("stop-color", "#f59e0b").attr("stop-opacity", 0.7); // Right Blind Spot

    // Coordinates: X from 0% to 100% (Camera Frame Width), Y from 0% to 100% (Camera Frame Depth)
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const yScale = d3.scaleLinear().domain([15, 100]).range([0, innerH]); // 15% horizon down to 100% bumper

    // Background Canvas Viewport representation
    g.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", innerH)
      .attr("fill", "#090d16")
      .attr("rx", 8)
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 1);

    // ──────────────────────────────────────────────────────────
    // SUB-COMPONENT A: 2D Camera Frame Road Geometry Guides
    // ──────────────────────────────────────────────────────────
    // Vanishing Point at (50%, 25%)
    const vpX = xScale(50);
    const vpY = yScale(22);

    // Horizon Line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", vpY)
      .attr("y2", vpY)
      .attr("stroke", "#334155")
      .attr("stroke-dasharray", "4,4")
      .attr("stroke-width", 1);

    g.append("text")
      .attr("x", 8)
      .attr("y", vpY - 4)
      .attr("fill", "#64748b")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .text("HORIZON / SIGHTLINE LIMIT (25%)");

    // Perspective Road Edges (Green dashed lines converging to horizon)
    g.append("line")
      .attr("x1", xScale(18))
      .attr("y1", innerH)
      .attr("x2", vpX - 10)
      .attr("y2", vpY)
      .attr("stroke", "#22c55e")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,4")
      .attr("opacity", 0.7);

    g.append("line")
      .attr("x1", xScale(82))
      .attr("y1", innerH)
      .attr("x2", vpX + 10)
      .attr("y2", vpY)
      .attr("stroke", "#22c55e")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,4")
      .attr("opacity", 0.7);

    // Ego Central Trajectory Corridor (Green Centerlines)
    g.append("line")
      .attr("x1", xScale(50))
      .attr("y1", innerH)
      .attr("x2", vpX)
      .attr("y2", vpY)
      .attr("stroke", "#10b981")
      .attr("stroke-width", 1.2)
      .attr("stroke-dasharray", "4,6")
      .attr("opacity", 0.5);

    // LEFT BLIND ZONE (BSD) Trapezoid (0% - 22% X)
    const leftBlindPoly = [
      `${xScale(0)},${yScale(38)}`,
      `${xScale(18)},${yScale(48)}`,
      `${xScale(22)},${innerH}`,
      `${xScale(0)},${innerH}`
    ].join(" ");

    g.append("polygon")
      .attr("points", leftBlindPoly)
      .attr("fill", "rgba(245, 158, 11, 0.08)")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "5,3")
      .attr("opacity", 0.8);

    g.append("text")
      .attr("x", xScale(2))
      .attr("y", innerH - 8)
      .attr("fill", "#f59e0b")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .text("LEFT BLIND ZONE (BSD)");

    // RIGHT BLIND ZONE (BSD) Trapezoid (78% - 100% X)
    const rightBlindPoly = [
      `${xScale(100)},${yScale(38)}`,
      `${xScale(82)},${yScale(48)}`,
      `${xScale(78)},${innerH}`,
      `${xScale(100)},${innerH}`
    ].join(" ");

    g.append("polygon")
      .attr("points", rightBlindPoly)
      .attr("fill", "rgba(245, 158, 11, 0.08)")
      .attr("stroke", "#f59e0b")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "5,3")
      .attr("opacity", 0.8);

    g.append("text")
      .attr("x", innerW - 6)
      .attr("y", innerH - 8)
      .attr("text-anchor", "end")
      .attr("fill", "#f59e0b")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .text("RIGHT BLIND ZONE (BSD)");

    // Center Ego Travel Path Label
    g.append("text")
      .attr("x", xScale(50))
      .attr("y", innerH - 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#10b981")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .text("EGO TRAVEL PATH");

    // ──────────────────────────────────────────────────────────
    // SUB-COMPONENT B: 2D Spatial Grid Density Heatmap (12x5 Bins)
    // ──────────────────────────────────────────────────────────
    const cols = 12;
    const rows = 5;
    const colStep = 100 / cols;
    const rowMin = 20;
    const rowMax = 100;
    const rowStep = (rowMax - rowMin) / rows;

    interface GridBin {
      c: number;
      r: number;
      x0: number;
      x1: number;
      y0: number;
      y1: number;
      count: number;
      weightedScore: number;
      potholes: number;
      blindSpots: number;
    }

    const bins: GridBin[] = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        bins.push({
          c,
          r,
          x0: c * colStep,
          x1: (c + 1) * colStep,
          y0: rowMin + r * rowStep,
          y1: rowMin + (r + 1) * rowStep,
          count: 0,
          weightedScore: 0,
          potholes: 0,
          blindSpots: 0
        });
      }
    }

    filteredHazards.forEach((h) => {
      bins.forEach((b) => {
        if (h.x >= b.x0 && h.x < b.x1 && h.y >= b.y0 && h.y < b.y1) {
          b.count += 1;
          const weight = h.severity === "Critical" ? 3 : h.severity === "High" ? 2 : 1;
          b.weightedScore += weight;
          if (h.type === "pothole") b.potholes += 1;
          if (h.type === "blind_spot" || h.type === "blind_corner") b.blindSpots += 1;
        }
      });
    });

    const maxDensity = Math.max(1, d3.max(bins, (d) => d.count) || 1);

    // Heat Color Scale: subtle deep indigo -> amber -> fiery red -> electric white
    const heatScale = d3
      .scaleSequential()
      .domain([0, maxDensity])
      .interpolator(d3.interpolateInferno);

    // Render Heatmap Cells
    bins.forEach((b) => {
      if (b.count === 0) return;

      const bx = xScale(b.x0) + 1;
      const by = yScale(b.y0) + 1;
      const bw = xScale(b.x1) - xScale(b.x0) - 2;
      const bh = yScale(b.y1) - yScale(b.y0) - 2;
      const intensity = b.count / maxDensity;

      g.append("rect")
        .attr("x", bx)
        .attr("y", by)
        .attr("width", Math.max(2, bw))
        .attr("height", Math.max(2, bh))
        .attr("rx", 3)
        .attr("fill", heatScale(b.count))
        .attr("opacity", 0.25 + intensity * 0.55)
        .attr("filter", intensity > 0.6 ? "url(#heat-glow)" : null)
        .style("cursor", "pointer")
        .on("mouseenter", () => {
          // Find representative hazard from this bin
          const rep = filteredHazards.find(
            (h) => h.x >= b.x0 && h.x < b.x1 && h.y >= b.y0 && h.y < b.y1
          );
          if (rep) setHoveredHazard(rep);
        });

      if (b.count > 1) {
        g.append("text")
          .attr("x", bx + bw / 2)
          .attr("y", by + bh / 2 + 3)
          .attr("text-anchor", "middle")
          .attr("fill", "#ffffff")
          .attr("font-size", "9px")
          .attr("font-weight", "bold")
          .attr("font-family", "monospace")
          .attr("pointer-events", "none")
          .text(`×${b.count}`);
      }
    });

    // ──────────────────────────────────────────────────────────
    // SUB-COMPONENT C: Hazard Centroid Scatter & Temporal Trails
    // ──────────────────────────────────────────────────────────
    const latestFrame = displayData.length > 0 ? displayData[displayData.length - 1].frame : 0;

    filteredHazards.forEach((h, idx) => {
      const cx = xScale(h.x);
      const cy = yScale(h.y);
      const frameDelta = latestFrame - h.frame;
      // Recency opacity: newer frames are brighter, older frames fade
      const recencyAlpha = Math.max(0.35, 1 - (frameDelta / 30) * 0.65);

      if (h.type === "pothole") {
        // Red Circular Hazard Blip with pulse ring
        const r = h.severity === "High" ? 6.5 : h.severity === "Medium" ? 5 : 4;

        // Outer radar ripple
        g.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", r * 1.8)
          .attr("fill", "none")
          .attr("stroke", "#ef4444")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2,2")
          .attr("opacity", recencyAlpha * 0.6);

        // Core dot
        g.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", r)
          .attr("fill", "#ef4444")
          .attr("stroke", "#fecaca")
          .attr("stroke-width", 1.2)
          .attr("opacity", recencyAlpha)
          .attr("filter", "drop-shadow(0px 0px 3px rgba(239, 68, 68, 0.7))")
          .style("cursor", "pointer")
          .on("mouseenter", () => setHoveredHazard(h));
      } else if (h.type === "blind_spot") {
        // Amber Diamond Warning Marker
        const size = 6.5;
        const dPath = `M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`;

        g.append("path")
          .attr("d", dPath)
          .attr("fill", "#f59e0b")
          .attr("stroke", "#fef3c7")
          .attr("stroke-width", 1.2)
          .attr("opacity", recencyAlpha)
          .attr("filter", "drop-shadow(0px 0px 4px rgba(245, 158, 11, 0.8))")
          .style("cursor", "pointer")
          .on("mouseenter", () => setHoveredHazard(h));
      } else if (h.type === "blind_corner") {
        // Purple Occluded Corner Arc Marker
        g.append("circle")
          .attr("cx", cx)
          .attr("cy", cy)
          .attr("r", 7)
          .attr("fill", "#a855f7")
          .attr("stroke", "#f3e8ff")
          .attr("stroke-width", 1.5)
          .attr("opacity", recencyAlpha)
          .style("cursor", "pointer")
          .on("mouseenter", () => setHoveredHazard(h));
      }
    });

    // ──────────────────────────────────────────────────────────
    // SUB-COMPONENT D: Lateral Spatial Density Profile Curve (1D Density)
    // Plotted along the top strip of the viewport
    // ──────────────────────────────────────────────────────────
    const stripH = 32;
    const lateralSamples = 40;
    const sampleStep = 100 / lateralSamples;

    const densityProfile: { x: number; density: number }[] = [];
    let maxProfileDensity = 0.001;

    for (let i = 0; i <= lateralSamples; i++) {
      const sampleX = i * sampleStep;
      // Kernel density estimate with Gaussian smoothing (bandwidth sigma = 6.0%)
      let d = 0;
      filteredHazards.forEach((h) => {
        const dist = sampleX - h.x;
        const weight = h.severity === "Critical" ? 1.5 : 1.0;
        d += weight * Math.exp(-(dist * dist) / (2 * 6 * 6));
      });
      densityProfile.push({ x: sampleX, density: d });
      if (d > maxProfileDensity) maxProfileDensity = d;
    }

    const yProfScale = d3.scaleLinear().domain([0, maxProfileDensity]).range([stripH, 4]);

    const profLine = d3
      .line<{ x: number; density: number }>()
      .x((d) => xScale(d.x))
      .y((d) => yProfScale(d.density))
      .curve(d3.curveBasis);

    const profArea = d3
      .area<{ x: number; density: number }>()
      .x((d) => xScale(d.x))
      .y0(stripH)
      .y1((d) => yProfScale(d.density))
      .curve(d3.curveBasis);

    // Marginal Strip Group
    const margG = g.append("g").attr("transform", "translate(0, 0)");

    margG.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", innerW)
      .attr("height", stripH)
      .attr("fill", "rgba(15, 23, 42, 0.75)")
      .attr("rx", 4)
      .attr("stroke", "#334155")
      .attr("stroke-width", 0.8);

    margG.append("path")
      .datum(densityProfile)
      .attr("fill", "url(#lat-density-grad)")
      .attr("d", profArea);

    margG.append("path")
      .datum(densityProfile)
      .attr("fill", "none")
      .attr("stroke", "#f8fafc")
      .attr("stroke-width", 1.5)
      .attr("d", profLine);

    margG.append("text")
      .attr("x", 8)
      .attr("y", 12)
      .attr("fill", "#94a3b8")
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .attr("font-weight", "bold")
      .text("LATERAL HAZARD DENSITY PROFILE P(x) [LAST 30 FRAMES]");

    // Peak Marker in Marginal Strip
    const peakPoint = densityProfile.reduce((max, cur) => cur.density > max.density ? cur : max, densityProfile[0]);
    if (peakPoint && peakPoint.density > 0.05) {
      const peakPx = xScale(peakPoint.x);
      margG.append("line")
        .attr("x1", peakPx)
        .attr("x2", peakPx)
        .attr("y1", 0)
        .attr("y2", stripH)
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 1.2)
        .attr("stroke-dasharray", "2,2");

      margG.append("text")
        .attr("x", Math.min(innerW - 10, Math.max(10, peakPx + 4)))
        .attr("y", 24)
        .attr("fill", "#ef4444")
        .attr("font-size", "8.5px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(`Peak: X ${peakPoint.x.toFixed(0)}%`);
    }

    // ──────────────────────────────────────────────────────────
    // SUB-COMPONENT E: Spatial Axis Lines & Road Bands
    // ──────────────────────────────────────────────────────────
    const xZones = [
      { name: "0% Left Blind Zone", val: 0 },
      { name: "20% Left Lane", val: 20 },
      { name: "50% Ego Path", val: 50 },
      { name: "80% Right Lane", val: 80 },
      { name: "100% Right Blind Zone", val: 100 }
    ];

    xZones.forEach((z) => {
      g.append("line")
        .attr("x1", xScale(z.val))
        .attr("x2", xScale(z.val))
        .attr("y1", stripH)
        .attr("y2", innerH)
        .attr("stroke", "#1e293b")
        .attr("stroke-dasharray", "2,4");
    });

    // Bottom X-Axis (Lateral Frame Coordinates in %)
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues([0, 20, 40, 60, 80, 100])
      .tickFormat((d) => `${d}%`);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(xAxis)
      .attr("color", "#64748b")
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-family", "monospace");

    // Left Y-Axis (Camera Frame Depth % from Horizon to Bumper)
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues([25, 45, 65, 85, 100])
      .tickFormat((d) => `${d}% Depth`);

    g.append("g")
      .call(yAxis)
      .attr("color", "#64748b")
      .selectAll("text")
      .attr("fill", "#94a3b8")
      .attr("font-size", "9px")
      .attr("font-family", "monospace");

    // Title label on secondary plot
    svg
      .append("text")
      .attr("x", margin.left)
      .attr("y", 22)
      .attr("fill", "#f8fafc")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("font-family", "sans-serif")
      .text("Spatial Density of Identified Hazards Across Frame (Potholes & Blind Spots)");

    svg
      .append("text")
      .attr("x", width - margin.right)
      .attr("y", 22)
      .attr("text-anchor", "end")
      .attr("fill", "#94a3b8")
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text(`30-Frame Accumulator: ${filteredHazards.length} Events Logged`);

  }, [filteredHazards, viewMode, hazardFilter, displayData]);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-2xl">
      {/* ──────────────────────────────────────────────────────────
          MAIN HEADER & VIEW SELECTOR
      ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              Real-Time Model Stability &amp; Spatial Hazard Intelligence (D3.js Window: Last 30 Frames)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Primary plot evaluates temporal confidence consistency; secondary plot maps spatial density of potholes &amp; blind spot intrusions across camera frame coordinates.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setViewMode("dual")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                viewMode === "dual"
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Dual Plots View
            </button>
            <button
              onClick={() => setViewMode("spatial_density")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                viewMode === "spatial_density"
                  ? "bg-amber-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Spatial Density Map
            </button>
            <button
              onClick={() => setViewMode("temporal_stability")}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                viewMode === "temporal_stability"
                  ? "bg-blue-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Temporal Stability
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">Stability Rating:</span>
            <span className="font-bold text-emerald-400">{stabilityPct}%</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="space-y-6">
        {/* ──────────────────────────────────────────────────────────
            PLOT 1: TEMPORAL STABILITY & CONFIDENCE TRACKING
        ────────────────────────────────────────────────────────── */}
        {(viewMode === "dual" || viewMode === "temporal_stability") && (
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Plot 1: Model Stability &amp; Confidence Tracking (T-29 to T-0)
                </span>
              </div>

              {/* Channels legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1 text-sky-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                  Vehicles ({(meanVeh * 100).toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  Potholes ({(meanPot * 100).toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1 text-fuchsia-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400"></span>
                  Pedestrians ({(meanPed * 100).toFixed(0)}%)
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  FCW Headway Risk
                </span>
              </div>
            </div>

            <div className="relative">
              <svg ref={temporalSvgRef} className="w-full h-52 overflow-visible"></svg>

              {/* Hover inspection pill */}
              {hoveredTemporal && (
                <div className="absolute top-2 right-4 bg-slate-950/95 border border-slate-700 rounded-xl px-3 py-1.5 text-[11px] font-mono shadow-2xl flex items-center gap-3">
                  <span className="text-slate-400">Frame #{hoveredTemporal.frame}</span>
                  <span className="text-sky-400">Veh: {(hoveredTemporal.vehicleAvgConf * 100).toFixed(0)}%</span>
                  <span className="text-red-400">Pot: {(hoveredTemporal.potholeAvgConf * 100).toFixed(0)}%</span>
                  <span className="text-fuchsia-400">Ped: {(hoveredTemporal.pedestrianAvgConf * 100).toFixed(0)}%</span>
                  <span className="text-amber-400">TTC: {hoveredTemporal.fcwTtc ? `${hoveredTemporal.fcwTtc.toFixed(1)}s` : "Safe"}</span>
                </div>
              )}
            </div>

            {/* Statistical Variance Diagnostics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400">Veh Mean Conf (&mu;)</span>
                <div className="text-sm font-bold text-sky-400">
                  {vehicleConfs.length > 0 ? `${(meanVeh * 100).toFixed(1)}%` : "N/A"}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400">Veh Variance (&sigma;)</span>
                <div className="text-sm font-bold text-white">
                  {vehicleConfs.length > 1 ? `±${(stdVeh * 100).toFixed(1)}%` : "±0.0%"}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400">Pothole Mean Conf (&mu;)</span>
                <div className="text-sm font-bold text-red-400">
                  {potholeConfs.length > 0 ? `${(meanPot * 100).toFixed(1)}%` : "N/A (Clear)"}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-0.5">
                <span className="text-[10px] text-slate-400">Tracking Consistency</span>
                <div className="text-sm font-bold text-emerald-400">
                  {stdVeh < 0.06 ? "High (Consistent)" : "Active Dynamic"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────────────────────────────────────────────────────────
            PLOT 2: SECONDARY SPATIAL DENSITY PLOT
            (Potholes & Blind Spots across frame over last 30 frames)
        ────────────────────────────────────────────────────────── */}
        {(viewMode === "dual" || viewMode === "spatial_density") && (
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Radar className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs font-bold text-white font-mono uppercase tracking-wider block">
                    Plot 2: Spatial Density of Identified Hazards Across Camera Frame
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Maps 30-frame spatial hotspots: Left/Right Blind Spots, Ego Travel Path, and Surface Potholes
                  </span>
                </div>
              </div>

              {/* Hazard Category Filter Tabs */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                  <Filter className="w-3 h-3 text-slate-500" />
                  Filter:
                </span>
                <div className="inline-flex p-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
                  <button
                    onClick={() => setHazardFilter("all")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      hazardFilter === "all"
                        ? "bg-slate-800 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All Hazards ({all30FrameHazards.length})
                  </button>
                  <button
                    onClick={() => setHazardFilter("potholes")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      hazardFilter === "potholes"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Potholes Only ({totalPotholesCount})
                  </button>
                  <button
                    onClick={() => setHazardFilter("blind_spots")}
                    className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                      hazardFilter === "blind_spots"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Blind Spots Only ({totalBlindSpotsCount})
                  </button>
                </div>
              </div>
            </div>

            {/* D3 Render Container for Secondary Plot */}
            <div className="relative">
              <svg ref={spatialSvgRef} className="w-full h-80 overflow-visible"></svg>

              {/* Interactive Hazard Inspection Tooltip */}
              {hoveredHazard && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-slate-950/95 border border-amber-500/50 rounded-xl px-4 py-2 text-xs font-mono shadow-2xl flex items-center gap-4 z-20 pointer-events-none">
                  <div className="flex items-center gap-2">
                    {hoveredHazard.type === "pothole" ? (
                      <span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>
                    ) : (
                      <span className="w-3 h-3 rotate-45 bg-amber-400 inline-block"></span>
                    )}
                    <span className="text-white font-bold">{hoveredHazard.label}</span>
                  </div>
                  <span className="text-slate-400">Frame #{hoveredHazard.frame}</span>
                  <span className="text-emerald-400">Coord: X:{hoveredHazard.x.toFixed(0)}% • Y:{hoveredHazard.y.toFixed(0)}%</span>
                  <span className="text-amber-400 font-bold">Severity: {hoveredHazard.severity}</span>
                  {hoveredHazard.metric && (
                    <span className="text-slate-300 font-mono">({hoveredHazard.metric})</span>
                  )}
                </div>
              )}
            </div>

            {/* Spatial Density Diagnostics & KPI Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block">Identified Hazards (30 Frames)</span>
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <span>{filteredHazards.length} Events</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Rolling Window)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block">Primary Hotspot Zone</span>
                <div className="text-base font-bold text-amber-400">
                  {peakZoneLabel}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block">Pothole Distribution</span>
                <div className="text-base font-bold text-red-400">
                  {totalPotholesCount} Potholes ({centerLaneHazards} In-Path)
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 block">Blind Zone Perimeter Risk</span>
                <div className="text-base font-bold text-emerald-400">
                  {leftFlankHazards} Left • {rightFlankHazards} Right
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
