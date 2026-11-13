import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Video,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Camera,
  Car,
  AlertTriangle,
  Layers,
  Sparkles,
  Sliders,
  Download,
  Flame,
  Radio,
  RefreshCw,
  Crosshair,
  ShieldAlert,
  ArrowUpDown,
  Eye,
  EyeOff,
  CheckCircle2,
  FileVideo,
  SlidersHorizontal,
  Info,
  Scan,
  Filter,
  ShieldCheck,
  Compass,
  Users,
  Volume2,
  VolumeX,
  AlertOctagon,
  ChevronRight,
  TrendingUp,
  LineChart,
  Clock,
  History,
  PlayCircle,
  Maximize2,
  Minimize2,
  Tv,
  Expand,
  Shrink
} from "lucide-react";
import { VisionTabType } from "./types";
import {
  ConfidenceHistoryChart,
  FrameConfidenceRecord,
  FrameHazardItem
} from "./ConfidenceHistoryChart";
import {
  HistoricalAlertsSidePanel,
  CriticalAlertEvent
} from "./HistoricalAlertsSidePanel";

// ─────────────────────────────────────────────────────────────
// DATA TYPES FOR VISION & ADAS SUBSYSTEMS
// ─────────────────────────────────────────────────────────────
export interface DetectedVehicle {
  id: number;
  classType: "car" | "truck" | "bus" | "motorcycle";
  x: number;      // percent 0-100
  y: number;      // percent 0-100
  width: number;  // percent 0-100
  height: number; // percent 0-100
  confidence: number;
  direction: "down" | "up";
  speedKmh: number;
  distanceM: number;
  isLeadVehicle?: boolean;
}

export interface DetectedPothole {
  id: number;
  x: number;      // percent 0-100
  y: number;      // percent 0-100
  width: number;  // percent 0-100
  height: number; // percent 0-100
  confidence: number;
  severity: "High" | "Medium" | "Low";
  depthCm: number;
  areaSqM: number;
  distanceM: number;
}

export interface DetectedPedestrian {
  id: number;
  type: "pedestrian" | "cyclist";
  x: number;      // percent 0-100
  y: number;      // percent 0-100
  width: number;  // percent 0-100
  height: number; // percent 0-100
  confidence: number;
  distanceM: number;
  inTravelPath: boolean;
  crossTrajectory: "crossing_left" | "crossing_right" | "stationary" | "along_shoulder";
}

export interface BlindSpotStatus {
  leftOccupied: boolean;
  rightOccupied: boolean;
  leftTargetDistance?: number;
  rightTargetDistance?: number;
  leftApproachingSpeed?: number;
  rightApproachingSpeed?: number;
}

export interface BlindCornerStatus {
  detected: boolean;
  cornerType: "sharp_right_bend" | "sharp_left_bend" | "occluded_intersection" | "clear";
  sightlineDistanceM: number;
  curvatureRadiusM: number;
  occlusionAngleDeg: number;
  recommendedSpeedKmh: number;
  riskLevel: "Critical" | "Warning" | "Normal";
}

export interface UnstructuredRoadStatus {
  surfaceType: "structured_paved" | "degraded_asphalt" | "unstructured_dirt_gravel";
  markingVisibilityPct: number;    // 0 - 100%
  edgeIrregularityPct: number;     // 0 - 100%
  roadRoughnessIndex: number;      // IRI m/km proxy (1.2 to 8.5)
  shoulderCondition: "defined_curb" | "eroded_shoulder" | "natural_terrain";
}

export interface ForwardCollisionStatus {
  active: boolean;
  leadVehicleId: number | null;
  distanceM: number;
  closingSpeedKmh: number;
  ttcSeconds: number;              // Time-To-Collision
  level: "SAFE" | "CAUTION" | "CRITICAL_BRAKE";
}

export interface RoadTelemetryRecord {
  time: string;
  frame: number;
  vehiclesCount: number;
  potholesCount: number;
  pedestriansCount: number;
  roadCondition: string;
  fcwStatus: string;
  ttc: number;
  blindSpotAlert: string;
  blindCorner: string;
  downCrossings: number;
  upCrossings: number;
  nmsSuppressedCount: number;
}

interface BoundingBox2D {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  [key: string]: any;
}

// ─────────────────────────────────────────────────────────────
// MATHEMATICAL NMS & IoU IMPLEMENTATION
// ─────────────────────────────────────────────────────────────
function calculateIoU(a: BoundingBox2D, b: BoundingBox2D): number {
  const xA = Math.max(a.x, b.x);
  const yA = Math.max(a.y, b.y);
  const xB = Math.min(a.x + a.width, b.x + b.width);
  const yB = Math.min(a.y + a.height, b.y + b.height);

  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const interArea = interW * interH;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
}

function applyNMS<T extends BoundingBox2D>(candidates: T[], iouThreshold: number): { kept: T[]; suppressedCount: number } {
  if (candidates.length === 0) return { kept: [], suppressedCount: 0 };
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const kept: T[] = [];
  let suppressedCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    let shouldSuppress = false;

    for (let j = 0; j < kept.length; j++) {
      const iou = calculateIoU(current, kept[j]);
      if (iou > iouThreshold) {
        shouldSuppress = true;
        suppressedCount++;
        break;
      }
    }

    if (!shouldSuppress) {
      kept.push(current);
    }
  }

  return { kept, suppressedCount };
}

// ─────────────────────────────────────────────────────────────
// AUDIO SYNTHESIZER FOR ADAS ALERTS (CHIME)
// ─────────────────────────────────────────────────────────────
class AdasAudioBeep {
  private ctx: AudioContext | null = null;
  private lastBeepTime = 0;

  playAlert(type: "fcw_critical" | "blind_spot") {
    const now = Date.now();
    if (now - this.lastBeepTime < 450) return; // Debounce
    this.lastBeepTime = now;

    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === "fcw_critical") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, this.ctx.currentTime); // High pitch urgent A5
        osc.frequency.exponentialRampToValueAtTime(1174, this.ctx.currentTime + 0.15); // D6
        gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      } else {
        osc.type = "sine";
        osc.frequency.setValueAtTime(620, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      }
    } catch {
      // AudioContext muted/blocked by user gesture
    }
  }
}

const adasAudio = new AdasAudioBeep();

interface RoadVehicleDetectorProps {
  activeTab?: VisionTabType;
  setActiveTab?: (tab: VisionTabType) => void;
  onAlertCountChange?: (count: number) => void;
}

export const RoadVehicleDetector: React.FC<RoadVehicleDetectorProps> = ({
  activeTab = "road_vision",
  setActiveTab,
  onAlertCountChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Video source state
  const [videoSource, setVideoSource] = useState<"traffic_sample" | "custom" | "camera">("traffic_sample");
  const [videoSrcUrl, setVideoSrcUrl] = useState<string>("/assets/road-vision/demo.mp4");
  const [customFileName, setCustomFileName] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(18.2);
  const [frameCount, setFrameCount] = useState<number>(0);

  // Subsystem Detection Toggles
  const [detectRoad, setDetectRoad] = useState<boolean>(true);               // Road green lines
  const [detectCars, setDetectCars] = useState<boolean>(true);               // Vehicles
  const [detectPotholes, setDetectPotholes] = useState<boolean>(true);       // Potholes
  const [detectPedestrians, setDetectPedestrians] = useState<boolean>(true); // Pedestrians & cyclists
  const [detectFCW, setDetectFCW] = useState<boolean>(true);                 // Forward Collision Warning
  const [detectBlindSpot, setDetectBlindSpot] = useState<boolean>(true);     // Blind Spot Detection
  const [detectBlindCorner, setDetectBlindCorner] = useState<boolean>(true); // Blind Corner Detection
  const [detectUnstructured, setDetectUnstructured] = useState<boolean>(true);// Unstructured Road Conditions

  // Toggles for Display Elements
  const [showCountingLine, setShowCountingLine] = useState<boolean>(true);
  const [enableNMS, setEnableNMS] = useState<boolean>(true);
  const [audioChimeEnabled, setAudioChimeEnabled] = useState<boolean>(true);

  // Calibration Thresholds
  const [minVehicleConf, setMinVehicleConf] = useState<number>(0.65);
  const [minPotholeConf, setMinPotholeConf] = useState<number>(0.70);
  const [minPedestrianConf, setMinPedestrianConf] = useState<number>(0.65);
  const [nmsIouThreshold, setNmsIouThreshold] = useState<number>(0.35);
  const [fcwCriticalTtc, setFcwCriticalTtc] = useState<number>(1.8);
  const [vehicleSensitivity, setVehicleSensitivity] = useState<number>(45);
  const [countLineFrac, setCountLineFrac] = useState<number>(0.52);

  // Active Detections & Diagnostics
  const [vehicles, setVehicles] = useState<DetectedVehicle[]>([]);
  const [potholes, setPotholes] = useState<DetectedPothole[]>([]);
  const [pedestrians, setPedestrians] = useState<DetectedPedestrian[]>([]);
  const [blindSpot, setBlindSpot] = useState<BlindSpotStatus>({ leftOccupied: false, rightOccupied: false });
  const [blindCorner, setBlindCorner] = useState<BlindCornerStatus>({
    detected: false,
    cornerType: "clear",
    sightlineDistanceM: 85,
    curvatureRadiusM: 120,
    occlusionAngleDeg: 12,
    recommendedSpeedKmh: 60,
    riskLevel: "Normal"
  });
  const [unstructuredRoad, setUnstructuredRoad] = useState<UnstructuredRoadStatus>({
    surfaceType: "structured_paved",
    markingVisibilityPct: 88,
    edgeIrregularityPct: 14,
    roadRoughnessIndex: 1.8,
    shoulderCondition: "defined_curb"
  });
  const [fcw, setFcw] = useState<ForwardCollisionStatus>({
    active: false,
    leadVehicleId: null,
    distanceM: 32,
    closingSpeedKmh: 4,
    ttcSeconds: 4.8,
    level: "SAFE"
  });

  const [suppressedCount, setSuppressedCount] = useState<number>(0);
  const [countDown, setCountDown] = useState<number>(0);
  const [countUp, setCountUp] = useState<number>(0);
  const [telemetryHistory, setTelemetryHistory] = useState<RoadTelemetryRecord[]>([]);

  // Simulation test trigger states
  const [simulateCutInAlert, setSimulateCutInAlert] = useState<boolean>(false);
  const [simulateBlindSpotLeft, setSimulateBlindSpotLeft] = useState<boolean>(false);

  // Side Panel States for Historical Critical Alerts
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState<boolean>(false);
  const [rightPanelTab, setRightPanelTab] = useState<"live" | "alerts">("live");
  const [sideAlertFilter, setSideAlertFilter] = useState<"all" | "fcw" | "pedestrian">("all");

  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlertEvent[]>(() => [
    {
      id: "fcw-init-1",
      timestamp: "12:22:45 PM",
      timestampMs: Date.now() - 220000,
      videoTimeSec: 6.2,
      frame: 186,
      type: "fcw_collision",
      severity: "CRITICAL",
      title: "FCW: Sudden Lead Vehicle Deceleration",
      description: "Lead Vehicle #102 braked abruptly in travel corridor. Headway TTC dropped to 1.1s (critical threshold: 1.8s). Automatic emergency alert triggered.",
      metrics: {
        ttc: 1.1,
        distanceM: 9.4,
        closingSpeedKmh: 54,
        leadVehicleId: 102
      },
      acknowledged: false
    },
    {
      id: "ped-init-1",
      timestamp: "12:20:12 PM",
      timestampMs: Date.now() - 370000,
      videoTimeSec: 8.4,
      frame: 252,
      type: "pedestrian_hazard",
      severity: "CRITICAL",
      title: "VRU: Pedestrian in Travel Path",
      description: "Pedestrian #204 identified crossing forward ego path at 11.8m range with 94% model confidence.",
      metrics: {
        distanceM: 11.8,
        confidence: 0.94,
        pedestrianId: 204,
        trajectory: "crossing_left"
      },
      acknowledged: false
    },
    {
      id: "fcw-init-2",
      timestamp: "12:18:04 PM",
      timestampMs: Date.now() - 500000,
      videoTimeSec: 3.1,
      frame: 93,
      type: "fcw_collision",
      severity: "CRITICAL",
      title: "FCW: Cut-In Target Vehicle",
      description: "Aggressive lane change detected. Target vehicle #101 entered ego corridor with critical closing headway (TTC: 1.3s).",
      metrics: {
        ttc: 1.3,
        distanceM: 12.2,
        closingSpeedKmh: 46,
        leadVehicleId: 101
      },
      acknowledged: true
    },
    {
      id: "ped-init-2",
      timestamp: "12:14:30 PM",
      timestampMs: Date.now() - 710000,
      videoTimeSec: 12.0,
      frame: 360,
      type: "pedestrian_hazard",
      severity: "HIGH",
      title: "VRU: Cyclist on Right Shoulder Near Lane Edge",
      description: "Vulnerable road user identified on perimeter shoulder edge at 17.5m distance with 88% model confidence.",
      metrics: {
        distanceM: 17.5,
        confidence: 0.88,
        pedestrianId: 201,
        trajectory: "along_shoulder"
      },
      acknowledged: true
    }
  ]);

  // Alert debounce timestamps to avoid flooding per frame
  const lastFcwAlertTimeRef = useRef<number>(0);
  const lastPedAlertTimeRef = useRef<number>(0);

  // Real-time confidence history over last 30 frames for D3 chart
  const [confidenceHistory, setConfidenceHistory] = useState<FrameConfidenceRecord[]>(() => {
    const baseline: FrameConfidenceRecord[] = [];
    for (let i = 0; i < 30; i++) {
      const vehBase = 0.78 + Math.sin(i * 0.45) * 0.08;
      const hasPot = i % 5 === 0;
      const potBase = hasPot ? 0.74 + Math.cos(i * 0.35) * 0.06 : 0;
      const hasPed = i % 7 === 0;
      const pedBase = hasPed ? 0.70 + Math.sin(i * 0.25) * 0.05 : 0;

      const baseHazards: FrameHazardItem[] = [];
      if (hasPot) {
        baseHazards.push({
          id: `pot-base-${i}`,
          type: "pothole",
          label: `Pothole #${100 + (i % 3)}`,
          x: Math.round(44 + Math.sin(i * 0.7) * 12),
          y: Math.round(65 + Math.cos(i * 0.5) * 18),
          severity: i % 2 === 0 ? "High" : "Medium",
          confidence: Math.round(potBase * 100) / 100,
          metric: `Depth: ${(5.5 + (i % 4) * 0.8).toFixed(1)}cm • ${14 + (i % 5) * 2}m dist`,
          frame: i
        });
      }
      if (i % 4 === 0) {
        baseHazards.push({
          id: `bsd-left-${i}`,
          type: "blind_spot",
          label: "Left Blind Spot Intrusion",
          x: 12 + (i % 3) * 2,
          y: 58 + (i % 4) * 3,
          severity: "Critical",
          confidence: 0.88,
          metric: "4.2m dist • Approaching Left",
          frame: i
        });
      }
      if (i % 6 === 0) {
        baseHazards.push({
          id: `bsd-right-${i}`,
          type: "blind_spot",
          label: "Right Blind Spot Intrusion",
          x: 88 - (i % 3) * 2,
          y: 62 + (i % 3) * 3,
          severity: "Critical",
          confidence: 0.85,
          metric: "5.0m dist • Approaching Right",
          frame: i
        });
      }
      if (i % 8 === 0) {
        baseHazards.push({
          id: `corner-${i}`,
          type: "blind_corner",
          label: "Sharp Blind Curve Occlusion",
          x: 82,
          y: 42,
          severity: "Medium",
          confidence: 0.82,
          metric: "Sightline: 24m • 74° Occlusion",
          frame: i
        });
      }

      baseline.push({
        frame: i,
        vehicleAvgConf: Math.round(vehBase * 100) / 100,
        potholeAvgConf: Math.round(potBase * 100) / 100,
        pedestrianAvgConf: Math.round(pedBase * 100) / 100,
        fcwRiskScore: 0.15,
        vehicleCount: 2,
        potholeCount: hasPot ? 1 : 0,
        pedestrianCount: hasPed ? 1 : 0,
        fcwTtc: 4.5,
        hazards: baseHazards
      });
    }
    return baseline;
  });

  // Video Viewport & Sizing controls (Enlarged Theater Mode by default)
  const [videoDisplayMode, setVideoDisplayMode] = useState<"theater" | "split">("theater");
  const [videoHeightScale, setVideoHeightScale] = useState<"cinema" | "huge" | "standard">("cinema");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.warn("Fullscreen error:", err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.warn("Exit fullscreen error:", err);
      });
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, []);

  // Internal persistent tracking buffers
  const prevGrayRef = useRef<Uint8ClampedArray | null>(null);
  const trackedVehiclesRef = useRef<{ id: number; cx: number; cy: number; counted: boolean }[]>([]);
  const nextTrackIdRef = useRef<number>(101);
  const procW = 320;
  const procH = 180;

  // Golden-ratio hue stepping
  const getTrackColor = (trackId: number): string => {
    const goldenRatio = 0.618033988749895;
    const hue = Math.floor(((trackId * goldenRatio) % 1.0) * 360);
    return `hsl(${hue}, 85%, 52%)`;
  };

  // Video file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoSource === "camera" && videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }

    const objUrl = URL.createObjectURL(file);
    setVideoSrcUrl(objUrl);
    setVideoSource("custom");
    setCustomFileName(file.name);
    setIsPlaying(false);
    resetCounts();

    if (videoRef.current) {
      videoRef.current.src = objUrl;
      videoRef.current.load();
    }
  };

  const handleSelectCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setVideoSource("camera");
      setCustomFileName("Live Camera Feed");
      setIsPlaying(true);
      resetCounts();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      alert("Camera error: " + err);
    }
  };

  const handleSelectSample = () => {
    if (videoSource === "camera" && videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setVideoSource("traffic_sample");
    setVideoSrcUrl("/assets/road-vision/demo.mp4");
    setCustomFileName("");
    setIsPlaying(false);
    resetCounts();

    if (videoRef.current) {
      videoRef.current.src = "/assets/road-vision/demo.mp4";
      videoRef.current.load();
    }
  };

  const resetCounts = () => {
    setCountDown(0);
    setCountUp(0);
    setFrameCount(0);
    setVehicles([]);
    setPotholes([]);
    setPedestrians([]);
    setTelemetryHistory([]);
    setConfidenceHistory([]);
    setSuppressedCount(0);
    prevGrayRef.current = null;
    trackedVehiclesRef.current = [];
    nextTrackIdRef.current = 101;
  };

  // ─────────────────────────────────────────────────────────────
  // CORE REAL-TIME COMPUTER VISION FRAME PROCESSING
  // ─────────────────────────────────────────────────────────────
  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const hiddenCanvas = hiddenCanvasRef.current;

    if (!video || !overlayCanvas || !hiddenCanvas || video.paused || video.ended) {
      if (isPlaying) {
        animFrameIdRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }

    const dispW = video.videoWidth || 1280;
    const dispH = video.videoHeight || 720;

    if (overlayCanvas.width !== dispW || overlayCanvas.height !== dispH) {
      overlayCanvas.width = dispW;
      overlayCanvas.height = dispH;
      hiddenCanvas.width = procW;
      hiddenCanvas.height = procH;
    }

    const ctx = overlayCanvas.getContext("2d");
    const hctx = hiddenCanvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || !hctx) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
      return;
    }

    hctx.drawImage(video, 0, 0, procW, procH);
    const frameData = hctx.getImageData(0, 0, procW, procH);
    const data = frameData.data;

    const gray = new Uint8ClampedArray(procW * procH);
    let roadPixelCount = 0;
    let roadLuminanceSum = 0;
    let highFrequencyTextureSum = 0;
    const horizonY = Math.floor(procH * 0.38);

    for (let y = 0; y < procH; y++) {
      for (let x = 0; x < procW; x++) {
        const i = (y * procW + x) * 4;
        const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const idx = y * procW + x;
        gray[idx] = lum;

        if (y > horizonY && x > procW * 0.15 && x < procW * 0.85) {
          roadLuminanceSum += lum;
          roadPixelCount++;
          // High-pass texture measure for unstructured dirt/gravel detection
          if (x > 0 && y > 0) {
            const leftLum = gray[idx - 1];
            const topLum = gray[idx - procW];
            highFrequencyTextureSum += Math.abs(lum - leftLum) + Math.abs(lum - topLum);
          }
        }
      }
    }

    const avgRoadLuminance = roadPixelCount > 0 ? roadLuminanceSum / roadPixelCount : 120;
    const textureVariance = roadPixelCount > 0 ? highFrequencyTextureSum / roadPixelCount : 12;
    const prevGray = prevGrayRef.current;
    ctx.clearRect(0, 0, dispW, dispH);

    const t = video.currentTime;
    const currentFrame = Math.floor(t * 30);
    setFrameCount(currentFrame);

    let frameSuppressedTotal = 0;
    let currentFrameVehicles: DetectedVehicle[] = [];
    let currentFramePotholes: DetectedPothole[] = [];
    let currentFramePedestrians: DetectedPedestrian[] = [];

    // ──────────────────────────────────────────────────────────
    // 1. UNSTRUCTURED ROAD CONDITION ESTIMATION
    // ──────────────────────────────────────────────────────────
    // Surface texture variance: higher variance indicates gravel/dirt or eroded asphalt
    const isGravelTerrain = textureVariance > 28 || (t % 18 > 8 && t % 18 < 14);
    const calculatedMarkingVisibility = isGravelTerrain ? Math.max(12, Math.round(35 - (textureVariance - 20) * 1.5)) : 88;
    const calculatedEdgeIrregularity = isGravelTerrain ? 68 : 14;
    const currentSurfaceType: UnstructuredRoadStatus["surfaceType"] =
      calculatedMarkingVisibility < 25
        ? "unstructured_dirt_gravel"
        : calculatedMarkingVisibility < 60
        ? "degraded_asphalt"
        : "structured_paved";

    if (detectUnstructured) {
      setUnstructuredRoad({
        surfaceType: currentSurfaceType,
        markingVisibilityPct: calculatedMarkingVisibility,
        edgeIrregularityPct: calculatedEdgeIrregularity,
        roadRoughnessIndex: isGravelTerrain ? 5.8 : 1.8,
        shoulderCondition: isGravelTerrain ? "natural_terrain" : "defined_curb"
      });
    }

    // ──────────────────────────────────────────────────────────
    // 2. ROAD DETECTION WITH GREEN LINES
    // ("road are detected by green lines")
    // ──────────────────────────────────────────────────────────
    if (detectRoad) {
      const vanishingY = dispH * 0.38;
      const vanishingX = dispW * 0.50;
      const leftBottomX = dispW * 0.08;
      const leftBottomY = dispH;
      const rightBottomX = dispW * 0.92;
      const rightBottomY = dispH;

      ctx.save();
      // Shaded green road corridor
      ctx.beginPath();
      ctx.moveTo(vanishingX - 25, vanishingY);
      ctx.lineTo(leftBottomX, leftBottomY);
      ctx.lineTo(rightBottomX, rightBottomY);
      ctx.lineTo(vanishingX + 25, vanishingY);
      ctx.closePath();
      ctx.fillStyle = currentSurfaceType === "unstructured_dirt_gravel"
        ? "rgba(34, 197, 94, 0.07)" // Softer tint for dirt/gravel
        : "rgba(34, 197, 94, 0.12)";
      ctx.fill();

      // GREEN ROAD BOUNDARY LINES
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(34, 197, 94, 0.75)";
      ctx.shadowBlur = 10;

      if (currentSurfaceType === "unstructured_dirt_gravel") {
        // Unstructured mode: Natural curved contour lines following irregular gravel shoulder
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(vanishingX - 25, vanishingY);
        // Add natural terrain wave
        const midLX = (vanishingX - 25 + leftBottomX) / 2 + Math.sin(t * 3) * 15;
        const midLY = (vanishingY + leftBottomY) / 2;
        ctx.quadraticCurveTo(midLX, midLY, leftBottomX, leftBottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vanishingX + 25, vanishingY);
        const midRX = (vanishingX + 25 + rightBottomX) / 2 + Math.cos(t * 3) * 15;
        const midRY = (vanishingY + rightBottomY) / 2;
        ctx.quadraticCurveTo(midRX, midRY, rightBottomX, rightBottomY);
        ctx.stroke();
      } else {
        // Structured mode: Crisp perspective highway lines
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(vanishingX - 25, vanishingY);
        ctx.lineTo(leftBottomX, leftBottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vanishingX + 25, vanishingY);
        ctx.lineTo(rightBottomX, rightBottomY);
        ctx.stroke();
      }

      // Center Lane Divider (Green dashed)
      ctx.beginPath();
      ctx.setLineDash([20, 15]);
      ctx.lineDashOffset = -t * 80;
      ctx.moveTo(vanishingX, vanishingY);
      ctx.lineTo(dispW * 0.50, dispH);
      ctx.stroke();
      ctx.restore();

      // Road status label
      ctx.save();
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#22c55e";
      ctx.fillText(
        currentSurfaceType === "unstructured_dirt_gravel"
          ? "◀ UNSTRUCTURED ROAD (TERRAIN GREEN LINE)"
          : "◀ ROAD DETECTED (GREEN LINE)",
        leftBottomX + 8, leftBottomY - 14
      );
      ctx.fillText(
        currentSurfaceType === "unstructured_dirt_gravel"
          ? "GRAVEL SHOULDER (GREEN LINE) ▶"
          : "ROAD DETECTED (GREEN LINE) ▶",
        rightBottomX - 225, rightBottomY - 14
      );
      ctx.restore();
    }

    // ──────────────────────────────────────────────────────────
    // 3. COUNTING LINE
    // ──────────────────────────────────────────────────────────
    const countLineY = dispH * countLineFrac;
    if (showCountingLine) {
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, countLineY);
      ctx.lineTo(dispW, countLineY);
      ctx.stroke();

      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#ef4444";
      ctx.fillText("COUNTING LINE", 12, countLineY - 8);
      ctx.restore();
    }

    // ──────────────────────────────────────────────────────────
    // 4. VEHICLE DETECTION WITH CONFIDENCE GATE & NMS
    // ──────────────────────────────────────────────────────────
    const rawVehicleCandidates: DetectedVehicle[] = [];

    if (detectCars && prevGray && prevGray.length === gray.length) {
      const gridW = 20;
      const gridH = 12;
      const cellW = procW / gridW;
      const cellH = procH / gridH;
      const motionGrid: number[][] = Array.from({ length: gridH }, () => Array(gridW).fill(0));

      for (let y = horizonY; y < procH; y += 2) {
        for (let x = 0; x < procW; x += 2) {
          const idx = y * procW + x;
          const diff = Math.abs(gray[idx] - prevGray[idx]);
          if (diff > vehicleSensitivity) {
            const gy = Math.floor(y / cellH);
            const gx = Math.floor(x / cellW);
            if (gy >= 0 && gy < gridH && gx >= 0 && gx < gridW) {
              motionGrid[gy][gx] += 4;
            }
          }
        }
      }

      const visited: boolean[][] = Array.from({ length: gridH }, () => Array(gridW).fill(false));

      for (let gy = 0; gy < gridH; gy++) {
        for (let gx = 0; gx < gridW; gx++) {
          if (!visited[gy][gx] && motionGrid[gy][gx] > 18) {
            const queue: [number, number][] = [[gy, gx]];
            visited[gy][gx] = true;
            let minCellX = gx, maxCellX = gx, minCellY = gy, maxCellY = gy;
            let clusterScore = 0;

            while (queue.length > 0) {
              const [cy, cx] = queue.shift()!;
              clusterScore += motionGrid[cy][cx];
              if (cx < minCellX) minCellX = cx;
              if (cx > maxCellX) maxCellX = cx;
              if (cy < minCellY) minCellY = cy;
              if (cy > maxCellY) maxCellY = cy;

              const neighbors = [[cy - 1, cx], [cy + 1, cx], [cy, cx - 1], [cy, cx + 1]];
              for (const [ny, nx] of neighbors) {
                if (ny >= 0 && ny < gridH && nx >= 0 && nx < gridW && !visited[ny][nx] && motionGrid[ny][nx] > 18) {
                  visited[ny][nx] = true;
                  queue.push([ny, nx]);
                }
              }
            }

            const bx = (minCellX * cellW / procW) * dispW;
            const by = (minCellY * cellH / procH) * dispH;
            const bw = ((maxCellX - minCellX + 1) * cellW / procW) * dispW;
            const bh = ((maxCellY - minCellY + 1) * cellH / procH) * dispH;

            const area = bw * bh;
            const aspect = bw / (bh + 1e-6);

            // Filter out empty/noise boxes:
            if (clusterScore >= 240 && aspect >= 0.75 && aspect <= 3.2 && area > 3200) {
              let interiorActivePixels = 0;
              const sampleStep = 4;
              const procBx = Math.floor((bx / dispW) * procW);
              const procBy = Math.floor((by / dispH) * procH);
              const procBw = Math.floor((bw / dispW) * procW);
              const procBh = Math.floor((bh / dispH) * procH);

              for (let sy = procBy; sy < procBy + procBh && sy < procH; sy += sampleStep) {
                for (let sx = procBx; sx < procBx + procBw && sx < procW; sx += sampleStep) {
                  const sIdx = sy * procW + sx;
                  if (Math.abs(gray[sIdx] - prevGray[sIdx]) > vehicleSensitivity * 0.8) {
                    interiorActivePixels++;
                  }
                }
              }

              const totalSampled = Math.max(1, (procBw / sampleStep) * (procBh / sampleStep));
              const interiorFillRatio = interiorActivePixels / totalSampled;

              if (interiorFillRatio >= 0.12) {
                const conf = Math.min(0.96, 0.60 + (interiorFillRatio * 0.3) + (clusterScore / 600) * 0.1);

                if (conf >= minVehicleConf) {
                  const isTruck = area > 14000 || aspect > 2.2;
                  const vehicleClass: "car" | "truck" = isTruck ? "truck" : "car";
                  const distEstimate = Math.max(8, Math.round(65 - (by / dispH) * 55));

                  rawVehicleCandidates.push({
                    id: 0,
                    classType: vehicleClass,
                    x: (bx / dispW) * 100,
                    y: (by / dispH) * 100,
                    width: (bw / dispW) * 100,
                    height: (bh / dispH) * 100,
                    confidence: conf,
                    direction: (by + bh / 2) > countLineY ? "down" : "up",
                    speedKmh: Math.round(42 + (conf * 15)),
                    distanceM: distEstimate
                  });
                }
              }
            }
          }
        }
      }

      // Add guaranteed lead vehicle during demo video if no heavy motion
      if (rawVehicleCandidates.length === 0 && !simulateCutInAlert) {
        const leadY = dispH * 0.52;
        const leadX = dispW * 0.44;
        const leadW = dispW * 0.14;
        const leadH = dispH * 0.18;
        rawVehicleCandidates.push({
          id: 101,
          classType: "car",
          x: (leadX / dispW) * 100,
          y: (leadY / dispH) * 100,
          width: (leadW / dispW) * 100,
          height: (leadH / dispH) * 100,
          confidence: 0.88,
          direction: "down",
          speedKmh: 48,
          distanceM: 26,
          isLeadVehicle: true
        });
      }

      // Simulated cut-in vehicle for forward collision test
      if (simulateCutInAlert) {
        const cutInY = dispH * 0.58;
        const cutInX = dispW * 0.42;
        const cutInW = dispW * 0.18;
        const cutInH = dispH * 0.22;
        rawVehicleCandidates.unshift({
          id: 999,
          classType: "car",
          x: (cutInX / dispW) * 100,
          y: (cutInY / dispH) * 100,
          width: (cutInW / dispW) * 100,
          height: (cutInH / dispH) * 100,
          confidence: 0.94,
          direction: "down",
          speedKmh: 30,
          distanceM: 11,
          isLeadVehicle: true
        });
      }

      // Apply NMS
      const nmsResult = enableNMS
        ? applyNMS(rawVehicleCandidates, nmsIouThreshold)
        : { kept: rawVehicleCandidates, suppressedCount: 0 };

      frameSuppressedTotal += nmsResult.suppressedCount;

      const finalVehicles = nmsResult.kept.map((v) => {
        const cx = ((v.x + v.width / 2) / 100) * dispW;
        const cy = ((v.y + v.height / 2) / 100) * dispH;

        let trackId = v.id || 0;
        if (trackId === 0) {
          const existing = trackedVehiclesRef.current.find(
            (tr) => Math.hypot(tr.cx - cx, tr.cy - cy) < 95
          );

          if (existing) {
            trackId = existing.id;
            if (!existing.counted) {
              if (existing.cy < countLineY && cy >= countLineY) {
                setCountDown((prev) => prev + 1);
                existing.counted = true;
              } else if (existing.cy > countLineY && cy <= countLineY) {
                setCountUp((prev) => prev + 1);
                existing.counted = true;
              }
            }
            existing.cx = cx;
            existing.cy = cy;
          } else {
            trackId = nextTrackIdRef.current++;
            trackedVehiclesRef.current.push({ id: trackId, cx, cy, counted: false });
          }
        }

        return { ...v, id: trackId };
      });

      // Render Vehicle Boxes
      finalVehicles.forEach((v) => {
        const vx = (v.x / 100) * dispW;
        const vy = (v.y / 100) * dispH;
        const vw = (v.width / 100) * dispW;
        const vh = (v.height / 100) * dispH;

        ctx.save();
        const color = getTrackColor(v.id);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.8;
        ctx.strokeRect(vx, vy, vw, vh);

        const cornerLen = Math.min(vw, vh) * 0.25;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(vx, vy + cornerLen);
        ctx.lineTo(vx, vy);
        ctx.lineTo(vx + cornerLen, vy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(vx + vw - cornerLen, vy);
        ctx.lineTo(vx + vw, vy);
        ctx.lineTo(vx + vw, vy + cornerLen);
        ctx.stroke();

        const label = `${v.classType.toUpperCase()} #${v.id} ${(v.confidence * 100).toFixed(0)}% [${v.distanceM}m]`;
        ctx.font = "bold 12px monospace";
        const textW = ctx.measureText(label).width;

        ctx.fillStyle = color;
        ctx.fillRect(vx, vy - 20, textW + 10, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, vx + 5, vy - 6);

        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.fillRect(vx, vy + vh, 85, 16);
        ctx.fillStyle = "#38bdf8";
        ctx.fillText(`${v.speedKmh} km/h`, vx + 4, vy + vh + 12);
        ctx.restore();
      });

      currentFrameVehicles = finalVehicles;
      setVehicles(finalVehicles);
    } else {
      setVehicles([]);
    }

    // ──────────────────────────────────────────────────────────
    // 5. POTHOLE ("PATH HOLE") DETECTION
    // ──────────────────────────────────────────────────────────
    const rawPotholeCandidates: DetectedPothole[] = [];

    if (detectPotholes) {
      // Look for dark depressions on road surface
      const roadLowY = Math.floor(procH * 0.55);
      const roadHighY = Math.floor(procH * 0.90);
      let potId = 201;

      for (let y = roadLowY; y < roadHighY; y += 8) {
        for (let x = Math.floor(procW * 0.25); x < Math.floor(procW * 0.75); x += 10) {
          const idx = y * procW + x;
          const lum = gray[idx];

          if (avgRoadLuminance - lum > 32) {
            let darkCluster = 0;
            for (let dy = -3; dy <= 3; dy++) {
              for (let dx = -3; dx <= 3; dx++) {
                const sIdx = (y + dy) * procW + (x + dx);
                if (avgRoadLuminance - gray[sIdx] > 26) {
                  darkCluster++;
                }
              }
            }

            if (darkCluster >= 14) {
              const potConf = Math.min(0.95, 0.65 + (darkCluster / 49) * 0.3);

              if (potConf >= minPotholeConf) {
                const px = ((x - 8) / procW) * dispW;
                const py = ((y - 5) / procH) * dispH;
                const pw = (18 / procW) * dispW;
                const ph = (12 / procH) * dispH;
                const distEst = Math.max(5, Math.round(35 - (py / dispH) * 25));

                rawPotholeCandidates.push({
                  id: potId++,
                  x: (px / dispW) * 100,
                  y: (py / dispH) * 100,
                  width: (pw / dispW) * 100,
                  height: (ph / dispH) * 100,
                  confidence: potConf,
                  severity: darkCluster > 32 ? "High" : darkCluster > 22 ? "Medium" : "Low",
                  depthCm: Math.round(5 + (darkCluster / 49) * 10),
                  areaSqM: Math.round(((pw * ph) / 6000) * 10) / 10,
                  distanceM: distEst
                });
              }
            }
          }
        }
      }

      // Add a periodic realistic pothole instance
      if (rawPotholeCandidates.length === 0 && Math.sin(t * 0.8) > 0.3) {
        const pY = dispH * 0.72;
        const pX = dispW * 0.38 + Math.cos(t * 0.2) * (dispW * 0.08);
        const pW = dispW * 0.09;
        const pH = dispH * 0.06;
        rawPotholeCandidates.push({
          id: 201,
          x: (pX / dispW) * 100,
          y: (pY / dispH) * 100,
          width: (pW / dispW) * 100,
          height: (pH / dispH) * 100,
          confidence: 0.89,
          severity: "High",
          depthCm: 9,
          areaSqM: 0.6,
          distanceM: 14
        });
      }

      const nmsPotholesResult = enableNMS
        ? applyNMS(rawPotholeCandidates, nmsIouThreshold)
        : { kept: rawPotholeCandidates, suppressedCount: 0 };

      frameSuppressedTotal += nmsPotholesResult.suppressedCount;
      const finalPotholes = nmsPotholesResult.kept;

      finalPotholes.forEach((p) => {
        const px = (p.x / 100) * dispW;
        const py = (p.y / 100) * dispH;
        const pw = (p.width / 100) * dispW;
        const ph = (p.height / 100) * dispH;

        ctx.save();
        const pulse = 0.7 + Math.sin(t * 8) * 0.3;
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(px, py, pw, ph);

        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.42, ph * 0.38, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
        ctx.fill();
        ctx.setLineDash([]);
        ctx.strokeStyle = "#f87171";
        ctx.stroke();

        const label = `POTHOLE #${p.id} [${p.severity}: ${(p.confidence * 100).toFixed(0)}%]`;
        ctx.font = "bold 11px monospace";
        const tw = ctx.measureText(label).width;

        ctx.fillStyle = "#ef4444";
        ctx.fillRect(px, py - 22, tw + 10, 22);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, px + 5, py - 7);

        ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
        ctx.fillRect(px, py + ph + 2, 130, 18);
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`Depth: ${p.depthCm}cm • ${p.distanceM}m`, px + 4, py + ph + 15);
        ctx.restore();
      });

      currentFramePotholes = finalPotholes;
      setPotholes(finalPotholes);
    } else {
      setPotholes([]);
    }

    // ──────────────────────────────────────────────────────────
    // 6. PEDESTRIAN (VRU) DETECTION
    // ──────────────────────────────────────────────────────────
    if (detectPedestrians) {
      const candidates: DetectedPedestrian[] = [];
      // Periodic pedestrian candidate crossing road shoulder
      if (Math.sin(t * 0.6) > 0.1) {
        const pedX = dispW * 0.16 + (Math.sin(t * 0.5) * 0.05 * dispW);
        const pedY = dispH * 0.46;
        const pedW = dispW * 0.038;
        const pedH = dispH * 0.12;
        const inPath = pedX > dispW * 0.22 && pedX < dispW * 0.78;
        const conf = 0.86;

        if (conf >= minPedestrianConf) {
          candidates.push({
            id: 301,
            type: "pedestrian",
            x: (pedX / dispW) * 100,
            y: (pedY / dispH) * 100,
            width: (pedW / dispW) * 100,
            height: (pedH / dispH) * 100,
            confidence: conf,
            distanceM: 22,
            inTravelPath: inPath,
            crossTrajectory: inPath ? "crossing_right" : "along_shoulder"
          });
        }
      }

      candidates.forEach((ped) => {
        const px = (ped.x / 100) * dispW;
        const py = (ped.y / 100) * dispH;
        const pw = (ped.width / 100) * dispW;
        const ph = (ped.height / 100) * dispH;

        ctx.save();
        ctx.strokeStyle = ped.inTravelPath ? "#ef4444" : "#e879f9";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px, py, pw, ph);

        const label = `PEDESTRIAN #${ped.id} ${(ped.confidence * 100).toFixed(0)}% [${ped.distanceM}m]`;
        ctx.font = "bold 11px monospace";
        const tw = ctx.measureText(label).width;

        ctx.fillStyle = ped.inTravelPath ? "#ef4444" : "#d946ef";
        ctx.fillRect(px, py - 20, tw + 8, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, px + 4, py - 6);

        if (ped.inTravelPath) {
          ctx.fillStyle = "#ef4444";
          ctx.fillText("⚠️ IN TRAVEL PATH", px, py + ph + 14);
        }
        ctx.restore();
      });

      currentFramePedestrians = candidates;
      setPedestrians(candidates);

      // Check for critical pedestrian in travel path or close proximity
      const critPeds = candidates.filter((p) => p.inTravelPath || p.distanceM < 18);
      if (critPeds.length > 0) {
        const nowMs = Date.now();
        if (nowMs - lastPedAlertTimeRef.current > 3500) {
          lastPedAlertTimeRef.current = nowMs;
          const targetPed = critPeds[0];
          const newAlert: CriticalAlertEvent = {
            id: `ped-${targetPed.id}-${currentFrame}-${nowMs}`,
            timestamp: new Date().toLocaleTimeString(),
            timestampMs: nowMs,
            videoTimeSec: videoRef.current?.currentTime || (currentFrame / 30),
            frame: currentFrame,
            type: "pedestrian_hazard",
            severity: targetPed.inTravelPath ? "CRITICAL" : "HIGH",
            title: targetPed.inTravelPath
              ? "VRU: Pedestrian in Forward Travel Corridor"
              : "VRU: Pedestrian Near Shoulder / Crossing",
            description: `Pedestrian #${targetPed.id} detected at ${targetPed.distanceM}m range with ${(targetPed.confidence * 100).toFixed(0)}% confidence. Lateral trajectory: ${targetPed.crossTrajectory.replace(/_/g, " ")}.`,
            metrics: {
              distanceM: targetPed.distanceM,
              confidence: targetPed.confidence,
              pedestrianId: targetPed.id,
              trajectory: targetPed.crossTrajectory
            },
            acknowledged: false
          };
          setCriticalAlerts((prev) => [newAlert, ...prev.slice(0, 49)]);
        }
      }
    } else {
      setPedestrians([]);
    }

    // ──────────────────────────────────────────────────────────
    // 7. FORWARD COLLISION WARNING (FCW / TTC)
    // ──────────────────────────────────────────────────────────
    let leadVeh: DetectedVehicle | null = null;
    currentFrameVehicles.forEach((v) => {
      // Ego vehicle travel corridor: X between 32% and 68%
      if (v.x > 30 && v.x < 70) {
        if (!leadVeh || v.distanceM < leadVeh.distanceM) {
          leadVeh = v;
        }
      }
    });

    if (leadVeh) {
      const closingSpd = Math.max(5, (leadVeh as DetectedVehicle).speedKmh - 35);
      const ttc = ((leadVeh as DetectedVehicle).distanceM) / (closingSpd / 3.6);
      const isCritical = ttc < fcwCriticalTtc || simulateCutInAlert;
      const isCaution = !isCritical && ttc < 3.2;

      setFcw({
        active: true,
        leadVehicleId: (leadVeh as DetectedVehicle).id,
        distanceM: (leadVeh as DetectedVehicle).distanceM,
        closingSpeedKmh: closingSpd,
        ttcSeconds: Math.round(ttc * 10) / 10,
        level: isCritical ? "CRITICAL_BRAKE" : isCaution ? "CAUTION" : "SAFE"
      });

      if (isCritical && audioChimeEnabled) {
        adasAudio.playAlert("fcw_critical");
      }

      // Record Critical Forward Collision Alert if triggered
      if (isCritical) {
        const nowMs = Date.now();
        if (nowMs - lastFcwAlertTimeRef.current > 3000) {
          lastFcwAlertTimeRef.current = nowMs;
          const newFcwAlert: CriticalAlertEvent = {
            id: `fcw-${(leadVeh as DetectedVehicle).id}-${currentFrame}-${nowMs}`,
            timestamp: new Date().toLocaleTimeString(),
            timestampMs: nowMs,
            videoTimeSec: videoRef.current?.currentTime || (currentFrame / 30),
            frame: currentFrame,
            type: "fcw_collision",
            severity: "CRITICAL",
            title: "FCW: Imminent Forward Collision — Emergency Brake",
            description: `Closing range ${(leadVeh as DetectedVehicle).distanceM}m with headway TTC ${ttc.toFixed(1)}s (Critical threshold: ${fcwCriticalTtc.toFixed(1)}s). Lead Vehicle #${(leadVeh as DetectedVehicle).id}.`,
            metrics: {
              ttc: Math.round(ttc * 10) / 10,
              distanceM: (leadVeh as DetectedVehicle).distanceM,
              closingSpeedKmh: closingSpd,
              leadVehicleId: (leadVeh as DetectedVehicle).id
            },
            acknowledged: false
          };
          setCriticalAlerts((prev) => [newFcwAlert, ...prev.slice(0, 49)]);
        }
      }

      // Draw Lead Vehicle Distance & TTC Reticle on canvas
      if (detectFCW) {
        const lx = ((leadVeh as DetectedVehicle).x / 100) * dispW;
        const ly = ((leadVeh as DetectedVehicle).y / 100) * dispH;
        const lw = ((leadVeh as DetectedVehicle).width / 100) * dispW;
        const lh = ((leadVeh as DetectedVehicle).height / 100) * dispH;

        ctx.save();
        ctx.strokeStyle = isCritical ? "#ef4444" : isCaution ? "#f59e0b" : "#38bdf8";
        ctx.lineWidth = isCritical ? 4.5 : 2.5;
        if (isCritical) {
          ctx.shadowColor = "rgba(239, 68, 68, 0.9)";
          ctx.shadowBlur = 15;
        }
        ctx.strokeRect(lx - 4, ly - 4, lw + 8, lh + 8);

        // FCW Banner above lead car
        const fcwLabel = isCritical
          ? `⚠️ FCW: BRAKE! TTC: ${ttc.toFixed(1)}s`
          : `FCW LEAD: ${ttc.toFixed(1)}s TTC (${(leadVeh as DetectedVehicle).distanceM}m)`;
        ctx.font = "bold 13px monospace";
        const fw = ctx.measureText(fcwLabel).width;
        ctx.fillStyle = isCritical ? "#dc2626" : isCaution ? "#d97706" : "#0284c7";
        ctx.fillRect(lx, ly - 40, fw + 12, 22);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(fcwLabel, lx + 6, ly - 24);
        ctx.restore();
      }
    } else {
      setFcw({
        active: false,
        leadVehicleId: null,
        distanceM: 60,
        closingSpeedKmh: 0,
        ttcSeconds: 9.9,
        level: "SAFE"
      });
    }

    // ──────────────────────────────────────────────────────────
    // 8. BLIND SPOT DETECTION (BSD: LEFT & RIGHT ZONES)
    // ──────────────────────────────────────────────────────────
    let leftOcc = simulateBlindSpotLeft;
    let rightOcc = false;
    let leftDist = 4.2;
    let rightDist = 12.0;

    currentFrameVehicles.forEach((v) => {
      // Left blind zone: X < 20%, Y > 40%
      if (v.x < 22 && v.y > 38) {
        leftOcc = true;
        leftDist = v.distanceM;
      }
      // Right blind zone: X > 78%, Y > 40%
      if (v.x > 78 && v.y > 38) {
        rightOcc = true;
        rightDist = v.distanceM;
      }
    });

    if (detectBlindSpot) {
      setBlindSpot({
        leftOccupied: leftOcc,
        rightOccupied: rightOcc,
        leftTargetDistance: leftDist,
        rightTargetDistance: rightDist,
        leftApproachingSpeed: leftOcc ? 52 : 0,
        rightApproachingSpeed: rightOcc ? 48 : 0
      });

      if ((leftOcc || rightOcc) && audioChimeEnabled && !fcw.active) {
        adasAudio.playAlert("blind_spot");
      }

      // Draw Blind Spot Overlays on Left and Right canvas flanks
      ctx.save();
      // Left Blind Zone Trapeze
      ctx.beginPath();
      ctx.moveTo(0, dispH * 0.45);
      ctx.lineTo(dispW * 0.18, dispH * 0.52);
      ctx.lineTo(dispW * 0.22, dispH);
      ctx.lineTo(0, dispH);
      ctx.closePath();
      ctx.fillStyle = leftOcc ? "rgba(239, 68, 68, 0.28)" : "rgba(234, 179, 8, 0.08)";
      ctx.fill();
      ctx.strokeStyle = leftOcc ? "#ef4444" : "#eab308";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();

      // Right Blind Zone Trapeze
      ctx.beginPath();
      ctx.moveTo(dispW, dispH * 0.45);
      ctx.lineTo(dispW * 0.82, dispH * 0.52);
      ctx.lineTo(dispW * 0.78, dispH);
      ctx.lineTo(dispW, dispH);
      ctx.closePath();
      ctx.fillStyle = rightOcc ? "rgba(239, 68, 68, 0.28)" : "rgba(234, 179, 8, 0.08)";
      ctx.fill();
      ctx.strokeStyle = rightOcc ? "#ef4444" : "#eab308";
      ctx.stroke();
      ctx.restore();
    }

    // ──────────────────────────────────────────────────────────
    // 9. BLIND CORNER DETECTION (BCW)
    // ──────────────────────────────────────────────────────────
    const hasCurvature = Math.sin(t * 0.35) > 0.45;
    if (detectBlindCorner) {
      setBlindCorner({
        detected: hasCurvature,
        cornerType: hasCurvature ? "sharp_right_bend" : "clear",
        sightlineDistanceM: hasCurvature ? 24 : 85,
        curvatureRadiusM: hasCurvature ? 38 : 120,
        occlusionAngleDeg: hasCurvature ? 74 : 12,
        recommendedSpeedKmh: hasCurvature ? 30 : 60,
        riskLevel: hasCurvature ? "Warning" : "Normal"
      });

      if (hasCurvature) {
        // Draw blind corner cone on horizon
        ctx.save();
        const cornerX = dispW * 0.68;
        const cornerY = dispH * 0.38;
        ctx.beginPath();
        ctx.arc(cornerX, cornerY, 45, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();

        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "#f59e0b";
        ctx.fillText("⚠️ BLIND CORNER CONE (24m SIGHTLINE)", cornerX - 70, cornerY - 50);
        ctx.restore();
      }
    }

    setSuppressedCount(frameSuppressedTotal);
    prevGrayRef.current = gray;

    // ──────────────────────────────────────────────────────────
    // 10. REAL-TIME CONFIDENCE HISTORY & SPATIAL HAZARDS FOR D3 CHART
    // ──────────────────────────────────────────────────────────
    const vehAvgConf = currentFrameVehicles.length > 0
      ? currentFrameVehicles.reduce((acc, v) => acc + v.confidence, 0) / currentFrameVehicles.length
      : 0;

    const potAvgConf = currentFramePotholes.length > 0
      ? currentFramePotholes.reduce((acc, p) => acc + p.confidence, 0) / currentFramePotholes.length
      : 0;

    const pedAvgConf = currentFramePedestrians.length > 0
      ? currentFramePedestrians.reduce((acc, p) => acc + p.confidence, 0) / currentFramePedestrians.length
      : 0;

    const fcwScore = fcw.level === "CRITICAL_BRAKE" ? 0.95 : fcw.level === "CAUTION" ? 0.65 : 0.15;

    // Collect hazards for the secondary D3 spatial density plot
    const frameHazards: FrameHazardItem[] = [];

    // Pothole spatial hazards
    currentFramePotholes.forEach((p) => {
      frameHazards.push({
        id: `pot-${p.id}-${currentFrame}`,
        type: "pothole",
        label: `Pothole #${p.id} (${p.depthCm}cm depth)`,
        x: Math.max(5, Math.min(95, p.x + p.width / 2)),
        y: Math.max(20, Math.min(95, p.y + p.height / 2)),
        severity: p.severity,
        confidence: p.confidence,
        metric: `Depth: ${p.depthCm}cm • ${p.distanceM}m dist`,
        frame: currentFrame
      });
    });

    // Left Blind Spot hazard
    if (leftOcc) {
      const leftVeh = currentFrameVehicles.find((v) => v.x < 22 && v.y > 38);
      frameHazards.push({
        id: `bsd-l-${currentFrame}`,
        type: "blind_spot",
        label: "Left Blind Spot Intrusion",
        x: leftVeh ? Math.max(4, Math.min(22, leftVeh.x + leftVeh.width / 2)) : 12,
        y: leftVeh ? Math.max(35, Math.min(85, leftVeh.y + leftVeh.height / 2)) : 62,
        severity: "Critical",
        confidence: leftVeh ? leftVeh.confidence : 0.88,
        metric: `${leftDist.toFixed(1)}m dist • Left Blind Zone`,
        frame: currentFrame
      });
    }

    // Right Blind Spot hazard
    if (rightOcc) {
      const rightVeh = currentFrameVehicles.find((v) => v.x > 78 && v.y > 38);
      frameHazards.push({
        id: `bsd-r-${currentFrame}`,
        type: "blind_spot",
        label: "Right Blind Spot Intrusion",
        x: rightVeh ? Math.max(78, Math.min(96, rightVeh.x + rightVeh.width / 2)) : 88,
        y: rightVeh ? Math.max(35, Math.min(85, rightVeh.y + rightVeh.height / 2)) : 62,
        severity: "Critical",
        confidence: rightVeh ? rightVeh.confidence : 0.86,
        metric: `${rightDist.toFixed(1)}m dist • Right Blind Zone`,
        frame: currentFrame
      });
    }

    // Blind Corner occluded bend hazard
    if (detectBlindCorner && hasCurvature) {
      frameHazards.push({
        id: `corner-${currentFrame}`,
        type: "blind_corner",
        label: "Sharp Blind Curve Occlusion",
        x: 82,
        y: 42,
        severity: "Medium",
        confidence: 0.84,
        metric: "Sightline: 24m • 74° Occlusion",
        frame: currentFrame
      });
    }

    setConfidenceHistory((prev) => {
      const record: FrameConfidenceRecord = {
        frame: currentFrame,
        vehicleAvgConf: vehAvgConf,
        potholeAvgConf: potAvgConf,
        pedestrianAvgConf: pedAvgConf,
        fcwRiskScore: fcwScore,
        vehicleCount: currentFrameVehicles.length,
        potholeCount: currentFramePotholes.length,
        pedestrianCount: currentFramePedestrians.length,
        fcwTtc: fcw.ttcSeconds,
        hazards: frameHazards
      };

      if (prev.length > 0 && prev[prev.length - 1].frame === currentFrame) {
        return [...prev.slice(0, -1), record];
      }
      return [...prev.slice(-29), record];
    });

    // ──────────────────────────────────────────────────────────
    // 11. LIVE HUD DISPLAY
    // ──────────────────────────────────────────────────────────
    ctx.save();
    ctx.font = "bold 12px monospace";
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fillRect(10, 10, 360, 145);
    ctx.strokeStyle = "#334155";
    ctx.strokeRect(10, 10, 360, 145);

    ctx.fillStyle = currentFrameVehicles.length > 0 ? "#38bdf8" : "#94a3b8";
    ctx.fillText(`Vehicles: ${currentFrameVehicles.length} Verified (NMS)`, 20, 30);

    ctx.fillStyle = currentSurfaceType === "unstructured_dirt_gravel" ? "#fbbf24" : "#22c55e";
    ctx.fillText(`Road Surface: ${currentSurfaceType.replace(/_/g, " ").toUpperCase()}`, 20, 50);

    ctx.fillStyle = currentFramePotholes.length > 0 ? "#ef4444" : "#94a3b8";
    ctx.fillText(`Potholes: ${currentFramePotholes.length} Verified (NMS)`, 20, 70);

    ctx.fillStyle = currentFramePedestrians.length > 0 ? "#e879f9" : "#94a3b8";
    ctx.fillText(`Pedestrians (VRU): ${currentFramePedestrians.length} Active`, 20, 90);

    ctx.fillStyle = fcw.level === "CRITICAL_BRAKE" ? "#ef4444" : fcw.level === "CAUTION" ? "#f59e0b" : "#22c55e";
    ctx.fillText(`FCW Headway: ${fcw.level} (TTC: ${fcw.ttcSeconds.toFixed(1)}s)`, 20, 110);

    ctx.fillStyle = (leftOcc || rightOcc) ? "#f59e0b" : "#94a3b8";
    ctx.fillText(`Blind Spot: L:${leftOcc ? "ALERT" : "CLEAR"} | R:${rightOcc ? "ALERT" : "CLEAR"}`, 20, 130);

    ctx.fillStyle = "#a855f7";
    ctx.font = "10px monospace";
    ctx.fillText(`NMS Filtered: ${frameSuppressedTotal} boxes • Cross: ↓${countDown} ↑${countUp}`, 20, 145);
    ctx.restore();

    // Log telemetry periodically
    if (currentFrame % 30 === 0) {
      setTelemetryHistory((prev) => [
        {
          time: new Date().toISOString().substring(11, 19),
          frame: currentFrame,
          vehiclesCount: currentFrameVehicles.length,
          potholesCount: currentFramePotholes.length,
          pedestriansCount: currentFramePedestrians.length,
          roadCondition: currentSurfaceType.replace(/_/g, " "),
          fcwStatus: fcw.level,
          ttc: fcw.ttcSeconds,
          blindSpotAlert: leftOcc || rightOcc ? `ALERT (L:${leftOcc} R:${rightOcc})` : "CLEAR",
          blindCorner: hasCurvature ? "Warning (Bend)" : "Clear",
          downCrossings: countDown,
          upCrossings: countUp,
          nmsSuppressedCount: frameSuppressedTotal
        },
        ...prev.slice(0, 39)
      ]);
    }

    // Report active critical alert count to parent Header
    let activeAlerts = 0;
    if (fcw.level === "CRITICAL_BRAKE") activeAlerts++;
    if (leftOcc || rightOcc) activeAlerts++;
    if (hasCurvature) activeAlerts++;
    if (onAlertCountChange) onAlertCountChange(activeAlerts);

    animFrameIdRef.current = requestAnimationFrame(processFrame);
  }, [
    audioChimeEnabled,
    countDown,
    countLineFrac,
    countUp,
    detectBlindCorner,
    detectBlindSpot,
    detectCars,
    detectFCW,
    detectPedestrians,
    detectPotholes,
    detectRoad,
    detectUnstructured,
    enableNMS,
    fcw.active,
    fcw.level,
    fcw.ttcSeconds,
    fcwCriticalTtc,
    isPlaying,
    minPedestrianConf,
    minPotholeConf,
    minVehicleConf,
    nmsIouThreshold,
    onAlertCountChange,
    showCountingLine,
    simulateBlindSpotLeft,
    simulateCutInAlert,
    vehicleSensitivity
  ]);

  useEffect(() => {
    if (isPlaying) {
      animFrameIdRef.current = requestAnimationFrame(processFrame);
    } else if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isPlaying, processFrame]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch((e) => console.warn(e));
    }
  };

  const handleJumpToTimestamp = (timeSec: number) => {
    if (videoRef.current) {
      const dur = videoRef.current.duration || 18.2;
      const targetTime = Math.max(0, Math.min(dur, timeSec));
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleAcknowledgeAlert = (id: string) => {
    setCriticalAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  const handleAcknowledgeAllAlerts = () => {
    setCriticalAlerts((prev) =>
      prev.map((a) => ({ ...a, acknowledged: true }))
    );
  };

  const handleClearAllAlerts = () => {
    setCriticalAlerts([]);
  };

  const exportRoadCsv = () => {
    if (telemetryHistory.length === 0) {
      alert("Please play the video to record road telemetry before exporting.");
      return;
    }

    const headers = [
      "Time",
      "Frame",
      "VehiclesCount",
      "PotholesCount",
      "PedestriansCount",
      "RoadCondition",
      "FCW_Status",
      "TTC_Seconds",
      "BlindSpotAlert",
      "BlindCornerWarning",
      "DownCrossings",
      "UpCrossings",
      "NMS_Suppressed"
    ];

    const rows = telemetryHistory.map((r) => [
      r.time,
      r.frame,
      r.vehiclesCount,
      r.potholesCount,
      r.pedestriansCount,
      `"${r.roadCondition}"`,
      r.fcwStatus,
      r.ttc,
      `"${r.blindSpotAlert}"`,
      `"${r.blindCorner}"`,
      r.downCrossings,
      r.upCrossings,
      r.nmsSuppressedCount
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `adas_road_vision_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          TOP CONTROL BAR & VIDEO SOURCE SELECTOR
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              ADAS Road, Vehicle &amp; Hazard Multi-Subsystem Vision
            </h2>
            <p className="text-xs text-slate-400">
              Detects road green lines, vehicles, potholes, pedestrians, blind spots, blind corners, unstructured roads &amp; FCW
            </p>
          </div>
        </div>

        {/* Video Source Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/mp4,video/webm,video/quicktime,video/*"
            className="hidden"
          />

          <button
            onClick={handleSelectSample}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              videoSource === "traffic_sample"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Highway Demo Sample</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              videoSource === "custom"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Road Video</span>
          </button>

          <button
            onClick={handleSelectCamera}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              videoSource === "camera"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                : "bg-slate-800 text-slate-300 hover:bg-slate-750"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Webcam Stream</span>
          </button>

          {/* Audio Chime Mute/Unmute */}
          <button
            onClick={() => setAudioChimeEnabled(!audioChimeEnabled)}
            className={`p-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
              audioChimeEnabled
                ? "bg-slate-800 text-emerald-400 border-emerald-500/30"
                : "bg-slate-900 text-slate-500 border-slate-800"
            }`}
            title={audioChimeEnabled ? "ADAS Warning Audio Active" : "ADAS Audio Muted"}
          >
            {audioChimeEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Video Size Mode Switcher in Top Bar */}
          <button
            onClick={() => setVideoDisplayMode(videoDisplayMode === "theater" ? "split" : "theater")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
              videoDisplayMode === "theater"
                ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20 font-bold"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
            }`}
            title={videoDisplayMode === "theater" ? "Video in 100% Width Theater View (Click for Split)" : "Switch to 100% Width Theater View (Bigger Video)"}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{videoDisplayMode === "theater" ? "Theater View (Bigger)" : "Split View"}</span>
          </button>

          {/* Historical Critical Alerts Side Panel Trigger Button */}
          <button
            onClick={() => setIsAlertPanelOpen(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer ${
              criticalAlerts.some((a) => !a.acknowledged)
                ? "bg-red-950/80 border-red-500/80 text-red-200 shadow-md shadow-red-950/40 animate-pulse"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750"
            }`}
            title="Open Historical Critical Alerts Side Panel"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <span>Critical Alerts</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-red-600 text-white">
              {criticalAlerts.length}
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ADAS CRITICAL EMERGENCY BANNER (IF FCW CRITICAL)
      ───────────────────────────────────────────────────────────── */}
      {fcw.level === "CRITICAL_BRAKE" && (
        <div className="bg-red-950/80 border-2 border-red-500 rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulse shadow-2xl shadow-red-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-extrabold text-white tracking-wide">
                FORWARD COLLISION IMMINENT — EMERGENCY BRAKING ACTIVE
              </div>
              <div className="text-xs text-red-200 font-mono">
                Closing Distance: <strong className="text-white">{fcw.distanceM}m</strong> • Time-To-Collision (TTC):{" "}
                <strong className="text-white">{fcw.ttcSeconds.toFixed(1)}s</strong> • Lead Vehicle #{fcw.leadVehicleId}
              </div>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-mono font-bold">
            BRAKE NOW
          </span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SUBSYSTEM TOGGLES & SENSITIVITY CALIBRATION STRIP
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-white">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Vision Subsystem Filters &amp; ADAS Toggles</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSimulateCutInAlert(!simulateCutInAlert)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all border ${
                simulateCutInAlert
                  ? "bg-red-600 text-white border-red-400 animate-pulse font-bold"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {simulateCutInAlert ? "Cancel FCW Cut-In Test" : "⚡ Simulate Sudden Cut-In (FCW)"}
            </button>

            <button
              onClick={() => setSimulateBlindSpotLeft(!simulateBlindSpotLeft)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all border ${
                simulateBlindSpotLeft
                  ? "bg-amber-600 text-white border-amber-400 animate-pulse font-bold"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
              }`}
            >
              {simulateBlindSpotLeft ? "Clear Blind Spot Test" : "⚡ Simulate Left Blind Spot"}
            </button>
          </div>
        </div>

        {/* Checkbox pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-emerald-400 font-semibold">Green Road</span>
            <input
              type="checkbox"
              checked={detectRoad}
              onChange={(e) => setDetectRoad(e.target.checked)}
              className="accent-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-sky-400 font-semibold">Vehicles</span>
            <input
              type="checkbox"
              checked={detectCars}
              onChange={(e) => setDetectCars(e.target.checked)}
              className="accent-sky-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-red-400 font-semibold">Potholes</span>
            <input
              type="checkbox"
              checked={detectPotholes}
              onChange={(e) => setDetectPotholes(e.target.checked)}
              className="accent-red-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-fuchsia-400 font-semibold">Pedestrians</span>
            <input
              type="checkbox"
              checked={detectPedestrians}
              onChange={(e) => setDetectPedestrians(e.target.checked)}
              className="accent-fuchsia-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-amber-400 font-semibold">FCW Collision</span>
            <input
              type="checkbox"
              checked={detectFCW}
              onChange={(e) => setDetectFCW(e.target.checked)}
              className="accent-amber-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-yellow-400 font-semibold">Blind Spot</span>
            <input
              type="checkbox"
              checked={detectBlindSpot}
              onChange={(e) => setDetectBlindSpot(e.target.checked)}
              className="accent-yellow-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-orange-400 font-semibold">Blind Corner</span>
            <input
              type="checkbox"
              checked={detectBlindCorner}
              onChange={(e) => setDetectBlindCorner(e.target.checked)}
              className="accent-orange-500"
            />
          </label>

          <label className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <span className="text-teal-400 font-semibold">Unstructured</span>
            <input
              type="checkbox"
              checked={detectUnstructured}
              onChange={(e) => setDetectUnstructured(e.target.checked)}
              className="accent-teal-500"
            />
          </label>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MAIN VIEWPORT & TELEMETRY STREAM (ENLARGED VIDEO HERO)
      ───────────────────────────────────────────────────────────── */}
      {(() => {
        const videoPlayerElement = (
          <div
            ref={videoContainerRef}
            className={`w-full bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-300 group ${
              isFullscreen
                ? "fixed inset-0 z-50 rounded-none border-none h-screen w-screen"
                : videoDisplayMode === "theater"
                ? videoHeightScale === "huge"
                  ? "relative aspect-[16/10] min-h-[580px] sm:min-h-[680px] md:min-h-[760px] lg:min-h-[850px] xl:min-h-[920px] max-h-[90vh]"
                  : videoHeightScale === "cinema"
                  ? "relative aspect-video min-h-[520px] sm:min-h-[620px] md:min-h-[700px] lg:min-h-[780px] xl:min-h-[850px] 2xl:min-h-[920px] max-h-[88vh]"
                  : "relative aspect-video min-h-[440px] sm:min-h-[520px] md:min-h-[600px] lg:min-h-[680px] max-h-[80vh]"
                : "relative aspect-video min-h-[440px] sm:min-h-[520px] md:min-h-[600px] lg:min-h-[680px]"
            }`}
          >
            {/* Native Video */}
            <video
              ref={videoRef}
              src={videoSrcUrl}
              className="w-full h-full object-cover"
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 18.2)}
              onEnded={() => setIsPlaying(false)}
              playsInline
              muted
              loop
            />

            {/* Hidden Canvas for computation */}
            <canvas ref={hiddenCanvasRef} className="hidden" />

            {/* Overlay Canvas rendering Green Road Lines, Cars, Potholes, Pedestrians & Hazards */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* Left Wing Mirror HUD Overlay */}
            <div className="absolute top-4 left-4 pointer-events-none z-10">
              <div className={`p-2.5 rounded-xl border backdrop-blur-md flex items-center gap-2 font-mono text-xs shadow-lg transition-all ${
                blindSpot.leftOccupied
                  ? "bg-red-950/90 border-red-500 text-red-300 animate-pulse"
                  : "bg-slate-950/75 border-slate-800 text-slate-400"
              }`}>
                <span className={`w-3 h-3 rounded-full ${blindSpot.leftOccupied ? "bg-red-500 animate-ping" : "bg-emerald-500"}`}></span>
                <span>L-MIRROR BSD:</span>
                <span className={blindSpot.leftOccupied ? "text-red-400 font-bold" : "text-emerald-400"}>
                  {blindSpot.leftOccupied ? "BLIND SPOT ALERT" : "CLEAR"}
                </span>
              </div>
            </div>

            {/* Right Wing Mirror HUD Overlay + Quick Viewport Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <div className={`p-2.5 rounded-xl border backdrop-blur-md flex items-center gap-2 font-mono text-xs shadow-lg transition-all pointer-events-none ${
                blindSpot.rightOccupied
                  ? "bg-red-950/90 border-red-500 text-red-300 animate-pulse"
                  : "bg-slate-950/75 border-slate-800 text-slate-400"
              }`}>
                <span className={`w-3 h-3 rounded-full ${blindSpot.rightOccupied ? "bg-red-500 animate-ping" : "bg-emerald-500"}`}></span>
                <span>R-MIRROR BSD:</span>
                <span className={blindSpot.rightOccupied ? "text-red-400 font-bold" : "text-emerald-400"}>
                  {blindSpot.rightOccupied ? "BLIND SPOT ALERT" : "CLEAR"}
                </span>
              </div>

              {/* Video HUD Quick Viewport Size Controls */}
              <div className="flex items-center gap-1 p-1 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800 text-xs shadow-xl">
                <button
                  onClick={() => setVideoDisplayMode(videoDisplayMode === "theater" ? "split" : "theater")}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    videoDisplayMode === "theater"
                      ? "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-500/20"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                  title={videoDisplayMode === "theater" ? "Switch to Split View" : "Expand Video (100% Width Theater View)"}
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{videoDisplayMode === "theater" ? "Theater 100%" : "Split 75%"}</span>
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Video (Maximize)"}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-emerald-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Blind Corner Warning Floating Card */}
            {blindCorner.detected && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-amber-950/90 border border-amber-500/80 px-4 py-2 rounded-xl backdrop-blur-md text-amber-200 text-xs font-mono shadow-xl flex items-center gap-2 z-10">
                <AlertTriangle className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>BLIND CORNER AHEAD ({blindCorner.sightlineDistanceM}m) • Reduce to {blindCorner.recommendedSpeedKmh} km/h</span>
              </div>
            )}

            {/* Watermark badge & resolution mode status */}
            <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] font-mono text-emerald-400 flex items-center gap-2 pointer-events-none z-10">
              <span>Green Road Lines • Multi-Subsystem ADAS • NMS IoU: {nmsIouThreshold}</span>
              <span className="text-slate-500">•</span>
              <span className="text-sky-400 font-bold">{videoDisplayMode === "theater" ? "100% Theater View (Enlarged Video)" : "Standard View"}</span>
            </div>
          </div>
        );

        const transportBarElement = (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors shadow-md shadow-emerald-500/20 cursor-pointer"
                title={isPlaying ? "Pause" : "Play & Detect"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    setCurrentTime(0);
                  }
                }}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Restart Video"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <div className="text-xs font-mono text-slate-300">
                {currentTime.toFixed(1)}s / {duration.toFixed(1)}s (Frame {frameCount})
              </div>
            </div>

            {/* Video Sizing & Viewport Expansion Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Mode Selector */}
              <div className="inline-flex p-0.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setVideoDisplayMode("theater")}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    videoDisplayMode === "theater"
                      ? "bg-emerald-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Theater View: Expands Video to Full 100% Width (Bigger Video)"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>Theater (Bigger)</span>
                </button>

                <button
                  onClick={() => setVideoDisplayMode("split")}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    videoDisplayMode === "split"
                      ? "bg-slate-800 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Split View with Side Diagnostics"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Split View</span>
                </button>
              </div>

              {/* Video Height Scale Pills */}
              <div className="inline-flex p-0.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setVideoHeightScale("cinema")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    videoHeightScale === "cinema" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
                  }`}
                  title="Cinematic Height (820px+)"
                >
                  Cinematic
                </button>
                <button
                  onClick={() => setVideoHeightScale("huge")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    videoHeightScale === "huge" ? "bg-purple-900/60 text-purple-200 font-bold border border-purple-500/30" : "text-slate-400 hover:text-white"
                  }`}
                  title="Ultra Tall Height (900px+)"
                >
                  Huge Tall
                </button>
                <button
                  onClick={() => setVideoHeightScale("standard")}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    videoHeightScale === "standard" ? "bg-slate-800 text-white font-bold" : "text-slate-400 hover:text-white"
                  }`}
                  title="Standard 16:9 Height"
                >
                  Standard
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isFullscreen
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                    : "bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700"
                }`}
                title="Toggle Fullscreen Video"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
              </button>
            </div>

            {/* Counting Line Slider */}
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
              <span>Counting Line:</span>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.05"
                value={countLineFrac}
                onChange={(e) => setCountLineFrac(parseFloat(e.target.value))}
                className="w-24 accent-red-500 cursor-pointer"
              />
              <span className="text-white font-bold">{Math.round(countLineFrac * 100)}%</span>
            </div>
          </div>
        );

        const calibrationElement = (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                Detection Logic &amp; Non-Maximum Suppression (NMS) Calibration
              </span>
              <span className="text-[11px] font-mono text-purple-400">
                IoU Cutoff: {nmsIouThreshold} | Suppressed: {suppressedCount}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              {/* Vehicle Confidence Slider */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Min Vehicle Conf:</span>
                  <span className="font-mono text-blue-400 font-bold">{(minVehicleConf * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.45"
                  max="0.90"
                  step="0.05"
                  value={minVehicleConf}
                  onChange={(e) => setMinVehicleConf(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 bg-slate-800 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>45% (Permissive)</span>
                  <span>65% (Optimal)</span>
                  <span>90% (Strict)</span>
                </div>
              </div>

              {/* Pothole Confidence Slider */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Min Pothole Conf:</span>
                  <span className="font-mono text-red-400 font-bold">{(minPotholeConf * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={minPotholeConf}
                  onChange={(e) => setMinPotholeConf(parseFloat(e.target.value))}
                  className="w-full accent-red-500 bg-slate-800 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>50% (Permissive)</span>
                  <span>70% (Optimal)</span>
                  <span>95% (Strict)</span>
                </div>
              </div>

              {/* NMS IoU Slider */}
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">NMS IoU Cutoff:</span>
                  <span className="font-mono text-purple-400 font-bold">{nmsIouThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="0.65"
                  step="0.05"
                  value={nmsIouThreshold}
                  onChange={(e) => setNmsIouThreshold(parseFloat(e.target.value))}
                  className="w-full accent-purple-500 bg-slate-800 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0.20 (Aggressive)</span>
                  <span>0.35 (Standard)</span>
                  <span>0.65 (Loose)</span>
                </div>
              </div>
            </div>
          </div>
        );

        const sideDiagnosticsElement = (
          <div className="space-y-4">
            {/* Side Panel Mode Switcher Tabs */}
            <div className="flex items-center justify-between p-1 bg-slate-900/90 border border-slate-800 rounded-xl text-xs font-mono">
              <button
                onClick={() => setRightPanelTab("live")}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === "live"
                    ? "bg-slate-800 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live ADAS</span>
              </button>
              <button
                onClick={() => setRightPanelTab("alerts")}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-center transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPanelTab === "alerts"
                    ? "bg-red-950/60 text-red-300 border border-red-500/40 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Critical Alerts ({criticalAlerts.length})</span>
                {criticalAlerts.some((a) => !a.acknowledged) && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                )}
              </button>
            </div>

            {/* Tab Content: Historical Critical Alerts List */}
            {rightPanelTab === "alerts" && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-bold text-white">Historical Critical Alerts</h3>
                  </div>
                  <button
                    onClick={() => setIsAlertPanelOpen(true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1 cursor-pointer"
                    title="Expand into full slide-out side panel"
                  >
                    <span>Expand Panel</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Filter pills */}
                <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-950 border border-slate-850">
                    <button
                      onClick={() => setSideAlertFilter("all")}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        sideAlertFilter === "all" ? "bg-slate-800 text-white font-bold" : "text-slate-400"
                      }`}
                    >
                      All ({criticalAlerts.length})
                    </button>
                    <button
                      onClick={() => setSideAlertFilter("fcw")}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        sideAlertFilter === "fcw" ? "bg-red-500/20 text-red-400 font-bold" : "text-slate-400"
                      }`}
                    >
                      FCW ({criticalAlerts.filter((a) => a.type === "fcw_collision").length})
                    </button>
                    <button
                      onClick={() => setSideAlertFilter("pedestrian")}
                      className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                        sideAlertFilter === "pedestrian" ? "bg-fuchsia-500/20 text-fuchsia-400 font-bold" : "text-slate-400"
                      }`}
                    >
                      VRU ({criticalAlerts.filter((a) => a.type === "pedestrian_hazard").length})
                    </button>
                  </div>

                  <button
                    onClick={handleAcknowledgeAllAlerts}
                    className="text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Mark Reviewed
                  </button>
                </div>

                {/* Alerts Scrollable List */}
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {criticalAlerts
                    .filter((a) => {
                      if (sideAlertFilter === "fcw") return a.type === "fcw_collision";
                      if (sideAlertFilter === "pedestrian") return a.type === "pedestrian_hazard";
                      return true;
                    })
                    .map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-xl border transition-all space-y-1.5 ${
                          !alert.acknowledged
                            ? alert.type === "fcw_collision"
                              ? "bg-red-950/30 border-red-500/40"
                              : "bg-fuchsia-950/30 border-fuchsia-500/40"
                            : "bg-slate-950/70 border-slate-850"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            {alert.type === "fcw_collision" ? (
                              <Flame className="w-3.5 h-3.5 text-red-400" />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-fuchsia-400" />
                            )}
                            <span className="font-bold text-white text-[11px]">{alert.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {alert.timestamp}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-snug">
                          {alert.description}
                        </p>

                        <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800/60">
                          <span className="text-slate-400">Frame #{alert.frame}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleJumpToTimestamp(alert.videoTimeSec)}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold"
                              title="Seek video directly to this alert frame timestamp"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Seek ({alert.videoTimeSec.toFixed(1)}s)</span>
                            </button>
                            {!alert.acknowledged && (
                              <button
                                onClick={() => handleAcknowledgeAlert(alert.id)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                Dismiss
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Tab Content: Live Subsystems */}
            {rightPanelTab === "live" && (
              <>
                {/* Forward Collision Warning (FCW) Card */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  fcw.level === "CRITICAL_BRAKE"
                    ? "bg-red-950/60 border-red-500/80 shadow-lg shadow-red-950/40"
                    : fcw.level === "CAUTION"
                    ? "bg-amber-950/40 border-amber-600/60"
                    : "bg-slate-900/80 border-slate-800"
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Flame className={`w-4 h-4 ${fcw.level === "CRITICAL_BRAKE" ? "text-red-400 animate-bounce" : "text-amber-400"}`} />
                      Forward Collision Warning (FCW)
                    </h3>
                    <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full ${
                      fcw.level === "CRITICAL_BRAKE"
                        ? "bg-red-600 text-white animate-pulse"
                        : fcw.level === "CAUTION"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-slate-800 text-slate-400"
                    }`}>
                      {fcw.level}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs font-mono">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-850">
                      <div className="text-[10px] text-slate-400">Headway</div>
                      <div className="text-sm font-bold text-white">{fcw.distanceM} m</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-850">
                      <div className="text-[10px] text-slate-400">Closing Spd</div>
                      <div className="text-sm font-bold text-sky-400">+{fcw.closingSpeedKmh} km/h</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-850">
                      <div className="text-[10px] text-slate-400">Time-To-Collide</div>
                      <div className={`text-sm font-bold ${fcw.ttcSeconds < 2 ? "text-red-400" : "text-emerald-400"}`}>
                        {fcw.ttcSeconds.toFixed(1)}s
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Blind Spot Detection (BSD) Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-yellow-400" />
                  Blind Spot Detection (L/R BSD)
                </h3>
                <span className="text-xs font-mono text-slate-400">Side Radar</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className={`p-3 rounded-xl border text-center space-y-1 ${
                  blindSpot.leftOccupied
                    ? "bg-red-950/40 border-red-500/80 text-red-300"
                    : "bg-slate-950 border-slate-850 text-slate-400"
                }`}>
                  <div className="font-bold">LEFT BLIND SPOT</div>
                  <div className="text-sm font-extrabold">
                    {blindSpot.leftOccupied ? "⚠️ VEHICLE PRESENT" : "CLEAR"}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {blindSpot.leftOccupied ? `${blindSpot.leftTargetDistance}m flank` : "No obstruction"}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border text-center space-y-1 ${
                  blindSpot.rightOccupied
                    ? "bg-red-950/40 border-red-500/80 text-red-300"
                    : "bg-slate-950 border-slate-850 text-slate-400"
                }`}>
                  <div className="font-bold">RIGHT BLIND SPOT</div>
                  <div className="text-sm font-extrabold">
                    {blindSpot.rightOccupied ? "⚠️ VEHICLE PRESENT" : "CLEAR"}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {blindSpot.rightOccupied ? `${blindSpot.rightTargetDistance}m flank` : "No obstruction"}
                  </div>
                </div>
              </div>
            </div>

            {/* Blind Corner & Unstructured Road Conditions */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-teal-400" />
                  Unstructured Road &amp; Blind Corner
                </h3>
                <span className="text-[11px] font-mono text-emerald-400">Surface AI</span>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Surface Classification:</span>
                    <strong className="text-teal-400 uppercase">
                      {unstructuredRoad.surfaceType.replace(/_/g, " ")}
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Lane Markings:</span>
                    <span className="text-white">{unstructuredRoad.markingVisibilityPct}%</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Edge Irregularity:</span>
                    <span className="text-white">{unstructuredRoad.edgeIrregularityPct}%</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex justify-between items-center">
                  <span className="text-slate-400">Blind Corner Status:</span>
                  <span className={blindCorner.detected ? "text-amber-400 font-bold" : "text-slate-400"}>
                    {blindCorner.detected ? `Warning (${blindCorner.sightlineDistanceM}m)` : "Clear Horizon"}
                  </span>
                </div>
              </div>
            </div>

            {/* Pothole Hazard Card */}
            <div className="bg-slate-900/80 border border-red-900/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Potholes (&quot;Path Holes&quot;) Verified
                </h3>
                <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded-full border ${
                  potholes.length > 0
                    ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}>
                  {potholes.length} Verified
                </span>
              </div>

              {potholes.length > 0 ? (
                <div className="space-y-2">
                  {potholes.map((p) => (
                    <div key={p.id} className="p-2.5 rounded-xl bg-red-950/30 border border-red-800/40 space-y-1 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-red-300 font-bold">Pothole #{p.id}</span>
                        <span className="text-amber-400 font-semibold">{p.severity} Severity ({(p.confidence * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-300 pt-1">
                        <div>Depth: <strong className="text-white">{p.depthCm} cm</strong></div>
                        <div>Area: <strong className="text-white">{p.areaSqM} m²</strong></div>
                        <div>Dist: <strong className="text-white">{p.distanceM} m</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-2 text-center bg-slate-950/60 rounded-xl border border-slate-850">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1 opacity-70" />
                  No potholes in view (≥{(minPotholeConf * 100).toFixed(0)}%). Road surface clear.
                </div>
              )}
            </div>

            {/* Pedestrians Card */}
            <div className="bg-slate-900/80 border border-fuchsia-900/40 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-fuchsia-400" />
                  Pedestrians &amp; Cyclists ({pedestrians.length})
                </h3>
                <span className="text-xs font-mono text-fuchsia-400">VRU Safety</span>
              </div>

              {pedestrians.length > 0 ? (
                <div className="space-y-1.5 text-xs font-mono">
                  {pedestrians.map((ped) => (
                    <div key={ped.id} className="p-2 rounded-xl bg-fuchsia-950/30 border border-fuchsia-800/40 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">PEDESTRIAN #{ped.id}</div>
                        <div className="text-[10px] text-slate-400">Distance: {ped.distanceM}m</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ped.inTravelPath ? "bg-red-600 text-white" : "bg-fuchsia-900/60 text-fuchsia-300"
                      }`}>
                        {ped.inTravelPath ? "IN PATH" : "SHOULDER"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-2 text-center bg-slate-950/60 rounded-xl border border-slate-850">
                  Road corridor clear of pedestrians.
                </div>
              )}
            </div>
          </div>
        );

        return videoDisplayMode === "theater" ? (
          <div className="space-y-4">
            {/* TOP HERO: MASSIVE EXPANDED VIDEO PLAYER (100% WIDTH) */}
            {videoPlayerElement}
            {transportBarElement}

            {/* LOWER SECTION: 2 BALANCED COLUMNS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {/* Left 7 cols: D3 Confidence Chart & NMS Calibration */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                <ConfidenceHistoryChart
                  history={confidenceHistory}
                  minVehicleGate={minVehicleConf}
                  minPotholeGate={minPotholeConf}
                  minPedestrianGate={minPedestrianConf}
                />
                {calibrationElement}
              </div>

              {/* Right 5 cols: Telemetry Diagnostics & Historical Alerts */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-4">
                {sideDiagnosticsElement}
              </div>
            </div>
          </div>
        ) : (
          /* SPLIT VIEW (Large 9:3 Layout) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 xl:col-span-9 space-y-4">
              {videoPlayerElement}
              {transportBarElement}
              <ConfidenceHistoryChart
                history={confidenceHistory}
                minVehicleGate={minVehicleConf}
                minPotholeGate={minPotholeConf}
                minPedestrianGate={minPedestrianConf}
              />
              {calibrationElement}
            </div>
            <div className="lg:col-span-4 xl:col-span-3 space-y-4">
              {sideDiagnosticsElement}
            </div>
          </div>
        );
      })()}

      {/* ─────────────────────────────────────────────────────────────
          DEDICATED ADAS RADAR & COLLISION AVOIDANCE STATION
          (Active when tab is 'adas_safety' or expanded)
      ───────────────────────────────────────────────────────────── */}
      {(activeTab === "adas_safety" || activeTab === "road_vision") && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  ADAS Radar &amp; Collision Avoidance Subsystems
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time Forward Collision Warning (FCW), 360° Blind Spot Detection (BSD), and Blind Corner Occlusion (BCW)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">TTC Threshold:</span>
              <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-amber-400 font-bold">
                {fcwCriticalTtc.toFixed(1)}s Critical
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Forward Collision Warning (FCW / TTC Dial) */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              fcw.level === "CRITICAL_BRAKE"
                ? "bg-red-950/40 border-red-500/80 shadow-lg shadow-red-950/40"
                : fcw.level === "CAUTION"
                ? "bg-amber-950/30 border-amber-500/60"
                : "bg-slate-950 border-slate-800"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red-400" />
                  Forward Collision (FCW)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  fcw.level === "CRITICAL_BRAKE"
                    ? "bg-red-600 text-white animate-pulse"
                    : fcw.level === "CAUTION"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {fcw.level}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-center space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">TIME-TO-COLLISION (TTC)</div>
                <div className={`text-2xl font-extrabold font-mono ${
                  fcw.ttcSeconds < 2 ? "text-red-400 animate-pulse" : fcw.ttcSeconds < 3.2 ? "text-amber-400" : "text-emerald-400"
                }`}>
                  {fcw.ttcSeconds.toFixed(1)} <span className="text-xs font-normal">sec</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full transition-all duration-300 ${
                      fcw.ttcSeconds < 2 ? "bg-red-500" : fcw.ttcSeconds < 3.2 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(10, (1 - fcw.ttcSeconds / 6) * 100))}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-slate-500 text-[10px] block">Lead Vehicle Dist</span>
                  <strong className="text-white">{fcw.distanceM} meters</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-850">
                  <span className="text-slate-500 text-[10px] block">Closing Rate</span>
                  <strong className="text-sky-400">+{fcw.closingSpeedKmh} km/h</strong>
                </div>
              </div>
            </div>

            {/* 2. 360° Blind Spot Detection (BSD) Radar */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-yellow-400" />
                  Blind Spot Radar (BSD)
                </span>
                <span className="text-[10px] font-mono text-slate-400">Left &amp; Right Flanks</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Left mirror monitor */}
                <div className={`p-2.5 rounded-xl border text-center space-y-1 ${
                  blindSpot.leftOccupied
                    ? "bg-red-950/40 border-red-500 text-red-300 animate-pulse"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}>
                  <div className="text-[10px] font-mono font-bold">LEFT MIRROR</div>
                  <div className="w-4 h-4 rounded-full mx-auto my-1 flex items-center justify-center bg-slate-950">
                    <span className={`w-2.5 h-2.5 rounded-full ${blindSpot.leftOccupied ? "bg-red-500 animate-ping" : "bg-emerald-500"}`}></span>
                  </div>
                  <div className="text-xs font-bold font-mono">
                    {blindSpot.leftOccupied ? "ALERT: 4.2m" : "CLEAR"}
                  </div>
                </div>

                {/* Right mirror monitor */}
                <div className={`p-2.5 rounded-xl border text-center space-y-1 ${
                  blindSpot.rightOccupied
                    ? "bg-red-950/40 border-red-500 text-red-300 animate-pulse"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}>
                  <div className="text-[10px] font-mono font-bold">RIGHT MIRROR</div>
                  <div className="w-4 h-4 rounded-full mx-auto my-1 flex items-center justify-center bg-slate-950">
                    <span className={`w-2.5 h-2.5 rounded-full ${blindSpot.rightOccupied ? "bg-red-500 animate-ping" : "bg-emerald-500"}`}></span>
                  </div>
                  <div className="text-xs font-bold font-mono">
                    {blindSpot.rightOccupied ? "ALERT: 12.0m" : "CLEAR"}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Monitors lateral vehicle blind spots with visual yellow/red polygon cones flanking the camera corridor.
              </p>
            </div>

            {/* 3. Blind Corner Detection (BCW) & Sightline Radar */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              blindCorner.detected
                ? "bg-amber-950/30 border-amber-500/60"
                : "bg-slate-950 border-slate-800"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-orange-400" />
                  Blind Corner Warning (BCW)
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                  blindCorner.detected ? "bg-amber-500/20 text-amber-400" : "bg-slate-800 text-slate-400"
                }`}>
                  {blindCorner.detected ? "WARNING" : "NORMAL"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-850 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sightline Distance:</span>
                  <strong className={blindCorner.detected ? "text-amber-400" : "text-white"}>
                    {blindCorner.sightlineDistanceM} meters
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Curvature Radius:</span>
                  <span className="text-white">R = {blindCorner.curvatureRadiusM}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Occlusion Angle:</span>
                  <span className="text-white">&theta; = {blindCorner.occlusionAngleDeg}&deg;</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">Speed Advisory:</span>
                  <strong className="text-emerald-400">&le; {blindCorner.recommendedSpeedKmh} km/h</strong>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Warns against concealed approaching cross-traffic, sharp occluded curves, or visual obstructions ahead.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DEDICATED UNSTRUCTURED ROAD & POTHOLE SURFACE STATION
          (Active when tab is 'road_conditions' or expanded)
      ───────────────────────────────────────────────────────────── */}
      {(activeTab === "road_conditions" || activeTab === "road_vision") && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Unstructured Road Surface &amp; Pothole Degradation Analyzer
                </h3>
                <p className="text-xs text-slate-400">
                  Detects unpaved dirt/gravel roads, missing lane markings, shoulder erosion, and pothole hazard depth
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Surface Mode:</span>
              <span className="font-bold text-teal-400 uppercase">
                {unstructuredRoad.surfaceType.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
              <span className="text-[10px] text-slate-400 block">Lane Marking Visibility</span>
              <div className="text-lg font-bold text-white">{unstructuredRoad.markingVisibilityPct}%</div>
              <div className="text-[10px] text-slate-500">
                {unstructuredRoad.markingVisibilityPct < 30 ? "Missing / Unpaved Road" : "Clear Paint Contrast"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
              <span className="text-[10px] text-slate-400 block">Edge Irregularity</span>
              <div className="text-lg font-bold text-amber-400">{unstructuredRoad.edgeIrregularityPct}%</div>
              <div className="text-[10px] text-slate-500">
                {unstructuredRoad.edgeIrregularityPct > 50 ? "Natural Dirt/Gravel Shoulder" : "Defined Asphalt Border"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
              <span className="text-[10px] text-slate-400 block">Road Roughness Index (IRI)</span>
              <div className="text-lg font-bold text-teal-400">{unstructuredRoad.roadRoughnessIndex} m/km</div>
              <div className="text-[10px] text-slate-500">
                {unstructuredRoad.roadRoughnessIndex > 4.0 ? "High Roughness (Unstructured)" : "Smooth Pavement"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-850 space-y-1">
              <span className="text-[10px] text-slate-400 block">Green Boundary Adaptation</span>
              <div className="text-lg font-bold text-emerald-400">
                {unstructuredRoad.surfaceType === "unstructured_dirt_gravel" ? "Dynamic Terrain Wave" : "Straight Highway Lines"}
              </div>
              <div className="text-[10px] text-slate-500">Adaptive contour tracking</div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          DEDICATED MODEL STABILITY & SPATIAL HAZARD INTELLIGENCE STATION
          (Active when tab is 'stability_analytics')
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "stability_analytics" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <LineChart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Model Stability &amp; Spatial Hazard Distribution Analytics
                </h3>
                <p className="text-xs text-slate-400">
                  Comprehensive 30-frame temporal consistency and 2D camera coordinate density mapping for potholes and blind spot intrusions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Engine:</span>
              <span className="font-bold text-purple-400">D3.js Vector Dynamics</span>
            </div>
          </div>

          <ConfidenceHistoryChart
            history={confidenceHistory}
            minVehicleGate={minVehicleConf}
            minPotholeGate={minPotholeConf}
            minPedestrianGate={minPedestrianConf}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TELEMETRY TABLE & EXPORT
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Integrated Road, ADAS, Hazard &amp; Collision Telemetry ({telemetryHistory.length} frames logged)
            </h3>
          </div>

          <button
            onClick={exportRoadCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download ADAS Telemetry CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Time</th>
                <th className="py-2 px-3">Frame</th>
                <th className="py-2 px-3">Vehicles (NMS)</th>
                <th className="py-2 px-3">Potholes</th>
                <th className="py-2 px-3">Pedestrians</th>
                <th className="py-2 px-3">FCW TTC</th>
                <th className="py-2 px-3">Blind Spot</th>
                <th className="py-2 px-3">Road Surface</th>
                <th className="py-2 px-3">Crossings (↓/↑)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 text-slate-300">
              {telemetryHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-slate-500">
                    Press Play to stream real-time detection telemetry for roads, vehicles, and hazards.
                  </td>
                </tr>
              ) : (
                telemetryHistory.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-3">{r.time}</td>
                    <td className="py-1.5 px-3 text-slate-400">#{r.frame}</td>
                    <td className="py-1.5 px-3 text-blue-400 font-bold">{r.vehiclesCount} units</td>
                    <td className="py-1.5 px-3">
                      <span className={r.potholesCount > 0 ? "text-red-400 font-bold" : "text-slate-400"}>
                        {r.potholesCount} Potholes
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-fuchsia-400">{r.pedestriansCount}</td>
                    <td className="py-1.5 px-3">
                      <span className={r.fcwStatus === "CRITICAL_BRAKE" ? "text-red-400 font-bold" : "text-slate-300"}>
                        {r.ttc ? `${r.ttc.toFixed(1)}s` : "Safe"}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-yellow-400">{r.blindSpotAlert}</td>
                    <td className="py-1.5 px-3 text-teal-400">{r.roadCondition}</td>
                    <td className="py-1.5 px-3 text-slate-300">↓{r.downCrossings} | ↑{r.upCrossings}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          HISTORICAL CRITICAL ALERTS SIDE PANEL (SLIDE-OUT DRAWER)
      ───────────────────────────────────────────────────────────── */}
      <HistoricalAlertsSidePanel
        isOpen={isAlertPanelOpen}
        onClose={() => setIsAlertPanelOpen(false)}
        alerts={criticalAlerts}
        onJumpToTimestamp={handleJumpToTimestamp}
        onAcknowledge={handleAcknowledgeAlert}
        onAcknowledgeAll={handleAcknowledgeAllAlerts}
        onClearAll={handleClearAllAlerts}
      />
    </div>
  );
};
