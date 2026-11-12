/**
 * PRAVAH Backend Telemetry Engine (Raspberry Pi 5 Node Service)
 * Simulates real-time CAN 2.0B bus traffic, LiDAR ranging, 6-axis IMU dynamics,
 * environmental optical sensors, and 360-degree ultrasonic/IR proximity matrix.
 */

export interface TelemetrySnapshot {
  timestamp: string;
  speed: number; // km/h
  steerAngle: number; // deg
  gear: 'P' | 'R' | 'N' | 'D';
  heading: number; // deg
  lidarDistance: number; // m
  lidarSignal: number; // %
  lidarSnr: number; // dB
  healthScore: number; // 0-100
  fcwState: string;
  aebActive: boolean;
  lkaActive: boolean;
  accActive: boolean;
  agsActive: boolean;
  servoAngle: number; // deg (0-90)
  cameraFps: number;
  inferenceLatency: number; // ms
  rainLevel: number; // 0-5
  fogLevel: number; // 0-5
  rainRate: number; // mm/h
  fogDensityPct: number; // %
  ambientLux: number; // lux
  lightScatterCoeff: number;
  roadWetness: number; // %
  frictionMu: number; // 0.15 - 0.85
  hydroplaningRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  nightMode: boolean;
  daylightMode: boolean;
  glareDetected: boolean;
  cpuTemp: number; // °C
  cpuLoad: number; // %
  ramUsage: number; // %
  latencyMs: number; // ms
  packetDeliveryRate: number; // %
  uptimeSeconds: number;
  canBusLoad: number; // %
  imu: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  gps: { lat: number; lng: number; satellites: number; alt: number; fix: boolean };
  detectedObjectsCount: number;
  isSimRunning: boolean;
}

class TelemetryService {
  private state: TelemetrySnapshot = {
    timestamp: new Date().toISOString(),
    speed: 42,
    steerAngle: 1.5,
    gear: 'D',
    heading: 142,
    lidarDistance: 4.52,
    lidarSignal: 94,
    lidarSnr: 36,
    healthScore: 98,
    fcwState: 'FCW: SYSTEM NOMINAL',
    aebActive: false,
    lkaActive: true,
    accActive: true,
    agsActive: false,
    servoAngle: 12,
    cameraFps: 60,
    inferenceLatency: 14.2,
    rainLevel: 0,
    fogLevel: 0,
    rainRate: 0,
    fogDensityPct: 0,
    ambientLux: 9200,
    lightScatterCoeff: 0.08,
    roadWetness: 0,
    frictionMu: 0.85,
    hydroplaningRisk: 'LOW',
    nightMode: false,
    daylightMode: false,
    glareDetected: false,
    cpuTemp: 48.5,
    cpuLoad: 26.4,
    ramUsage: 42.1,
    latencyMs: 12,
    packetDeliveryRate: 99.8,
    uptimeSeconds: 14320,
    canBusLoad: 34.8,
    imu: { ax: 0.04, ay: -0.02, az: 0.99, gx: 0.2, gy: -0.1, gz: 0.4 },
    gps: { lat: 28.6139, lng: 77.2090, satellites: 14, alt: 216, fix: true },
    detectedObjectsCount: 3,
    isSimRunning: true
  };

  private history: Array<{ timestamp: string; speed: number; lidarDistance: number; cpuTemp: number; cpuLoad: number; rainRate: number; fogDensityPct: number; ambientLux: number; threatIndex: number }> = [];
  private eventLogs: Array<{ id: string; timestamp: string; severity: string; category: string; message: string; metricValue?: string }> = [];

  constructor() {
    this.initLogs();
    this.startEngine();
  }

  private initLogs(): void {
    const now = new Date().toLocaleTimeString();
    this.eventLogs = [
      { id: 'log-1', timestamp: now, severity: 'INFO', category: 'SYSTEM', message: 'PRAVAH Telemetry Engine initialized on Raspberry Pi 5 node' },
      { id: 'log-2', timestamp: now, severity: 'INFO', category: 'CAN_BUS', message: 'CAN bus transceiver synchronized at 500kbps arbitration rate' },
      { id: 'log-3', timestamp: now, severity: 'INFO', category: 'LIDAR', message: 'TF-Luna LiDAR stream calibrated. Ranging active' }
    ];
  }

  private startEngine(): void {
    setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick(): void {
    this.state.uptimeSeconds += 1;
    this.state.timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (this.state.isSimRunning && !this.state.aebActive) {
      // Dynamic vehicle cruising simulation
      const speedJitter = (Math.random() - 0.48) * 3.5;
      this.state.speed = Math.min(85, Math.max(22, Math.round(this.state.speed + speedJitter)));
      
      const steerJitter = Number(((Math.random() - 0.5) * 4).toFixed(1));
      this.state.steerAngle = Math.min(25, Math.max(-25, Number((this.state.steerAngle * 0.7 + steerJitter).toFixed(1))));

      this.state.heading = (this.state.heading + (this.state.steerAngle * 0.2) + 360) % 360;

      // LiDAR forward distance fluctuation
      const distDelta = (Math.random() - 0.5) * 0.6;
      let newDist = this.state.lidarDistance + distDelta;
      if (newDist > 16) newDist = 13;
      if (newDist < 0.9) newDist = 1.4;
      this.state.lidarDistance = Number(newDist.toFixed(2));

      // Calculate servo brake angle
      this.state.servoAngle = Math.min(40, Math.max(0, Math.round(Math.abs(this.state.steerAngle) * 1.2 + (this.state.lidarDistance < 3 ? 35 : 5))));

      // IMU
      this.state.imu.ax = Number((0.02 + (speedJitter * 0.05)).toFixed(2));
      this.state.imu.ay = Number((this.state.steerAngle * 0.02).toFixed(2));
      this.state.imu.gz = Number((this.state.steerAngle * 0.3).toFixed(1));
    } else if (this.state.aebActive) {
      this.state.speed = 0;
      this.state.servoAngle = 90;
      this.state.imu.ax = -0.85;
    }

    // Environmental calculations
    this.state.rainRate = Number((this.state.rainLevel * 9.2).toFixed(1));
    this.state.fogDensityPct = this.state.fogLevel * 20;
    this.state.lightScatterCoeff = Number((0.08 + (this.state.fogLevel * 0.16) + (this.state.rainLevel * 0.06)).toFixed(2));
    
    const baseLux = this.state.daylightMode ? 14500 : this.state.nightMode ? 40 : 8500;
    this.state.ambientLux = Math.max(15, Math.round(baseLux - (this.state.fogLevel * 1200) - (this.state.rainLevel * 600)));

    this.state.roadWetness = Math.min(100, Math.round(this.state.rainLevel * 18 + (this.state.fogLevel > 2 ? 15 : 0)));
    this.state.frictionMu = Number(Math.max(0.18, 0.85 - (this.state.roadWetness * 0.0062)).toFixed(2));
    this.state.hydroplaningRisk = this.state.roadWetness > 65 && this.state.speed > 50 ? 'HIGH' : this.state.roadWetness > 35 && this.state.speed > 40 ? 'MEDIUM' : 'LOW';

    // RPi 5 CPU
    this.state.cpuLoad = Number((22 + (this.state.speed * 0.12) + (Math.random() * 4)).toFixed(1));
    this.state.cpuTemp = Number((46 + (this.state.fogLevel > 2 ? 3 : 0) + (Math.random() * 2)).toFixed(1));
    this.state.canBusLoad = Number((28 + (this.state.speed * 0.3) + (Math.random() * 3)).toFixed(1));
    this.state.latencyMs = Math.round(10 + Math.random() * 4);

    // FCW threat check
    if (this.state.lidarDistance < 1.8) {
      this.state.fcwState = 'FCW: CRITICAL COLLISION ALERT';
      this.state.aebActive = true;
    } else if (this.state.lidarDistance < 3.5) {
      this.state.fcwState = 'FCW: WARNING - DISTANCE CLOSING';
    } else {
      this.state.fcwState = 'FCW: SYSTEM NOMINAL';
    }

    // Append history
    this.history.push({
      timestamp: this.state.timestamp,
      speed: this.state.speed,
      lidarDistance: this.state.lidarDistance,
      cpuTemp: this.state.cpuTemp,
      cpuLoad: this.state.cpuLoad,
      rainRate: this.state.rainRate,
      fogDensityPct: this.state.fogDensityPct,
      ambientLux: this.state.ambientLux,
      threatIndex: this.state.aebActive ? 95 : this.state.lidarDistance < 3 ? 75 : 15
    });

    if (this.history.length > 60) {
      this.history.shift();
    }
  }

  public getSnapshot(): TelemetrySnapshot {
    return { ...this.state };
  }

  public getHistory() {
    return [...this.history];
  }

  public getLogs() {
    return [...this.eventLogs];
  }

  public triggerAEB(): void {
    this.state.aebActive = true;
    this.state.speed = 0;
    this.state.servoAngle = 90;
    this.state.fcwState = 'FCW: EMERGENCY BRAKING OVERRIDE (AEB)';
    this.eventLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      severity: 'CRITICAL',
      category: 'AEB',
      message: 'MANUAL OVERRIDE: AEB Emergency Brake applied immediately',
      metricValue: 'Speed: 0 km/h | Servo: 90°'
    });
  }

  public releaseAEB(): void {
    this.state.aebActive = false;
    this.state.servoAngle = 0;
    this.state.fcwState = 'FCW: SYSTEM NOMINAL';
    this.eventLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      severity: 'INFO',
      category: 'AEB',
      message: 'AEB Emergency Brake released. Normal actuation restored',
      metricValue: 'Servo: 0°'
    });
  }

  public setWeather(rain: number, fog: number): void {
    this.state.rainLevel = Math.max(0, Math.min(5, rain));
    this.state.fogLevel = Math.max(0, Math.min(5, fog));
  }

  public setDaylightMode(enabled: boolean): void {
    this.state.daylightMode = enabled;
  }

  public setSimRunning(running: boolean): void {
    this.state.isSimRunning = running;
  }

  public isSimRunning(): boolean {
    return this.state.isSimRunning;
  }

  public isDaylightMode(): boolean {
    return this.state.daylightMode;
  }
}

export const telemetryService = new TelemetryService();
