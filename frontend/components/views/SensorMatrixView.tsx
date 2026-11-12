import React from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';
import { 
  Cpu, 
  Radio, 
  Video, 
  Layers, 
  Compass, 
  MapPin, 
  SunMedium, 
  CloudRain,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const SensorMatrixView: React.FC = () => {
  const { 
    cpuTemp, 
    cpuLoad, 
    ramUsage, 
    lidarDistance, 
    lidarSignal, 
    lidarSnr, 
    cameraFps, 
    inferenceLatency, 
    proximityZones, 
    imu, 
    gps, 
    speed, 
    ambientLux, 
    lightScatterCoeff, 
    rainLevel, 
    rainRate, 
    fogLevel, 
    history,
    daylightMode
  } = useTelemetry();

  const flZone = proximityZones.find(z => z.direction === 'Front Left');
  const frZone = proximityZones.find(z => z.direction === 'Front Right');
  const rlZone = proximityZones.find(z => z.direction === 'Rear Left');
  const rrZone = proximityZones.find(z => z.direction === 'Rear Right');

  const tooltipStyle = {
    backgroundColor: daylightMode ? '#ffffff' : '#090D16',
    border: daylightMode ? '1px solid #0284C7' : '1px solid #00F0FF',
    color: daylightMode ? '#0f172a' : '#f8fafc',
    fontSize: '10px',
    boxShadow: daylightMode ? '0 4px 12px rgba(0,0,0,0.1)' : '0 0 10px rgba(0,240,255,0.2)'
  };

  const gridStroke = daylightMode ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
  const axisStroke = daylightMode ? '#64748b' : '#64748b';

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-500/20 dark:border-cyan-500/20">
        <div>
          <h1 className="text-lg font-mono font-bold tracking-wider text-sky-700 dark:text-cyan-400 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-sky-600 dark:text-cyan-400" />
            02. SENSOR MATRIX & HARDWARE TELEMETRY
          </h1>
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            Real-time multi-bus sensor ingestion running on Raspberry Pi 5 GPIO, I2C, SPI & UART interfaces
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> 8/8 SENSORS ONLINE
          </span>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span className="text-sky-700 dark:text-cyan-300 font-semibold">BUS: CAN 2.0B + I2C-1</span>
        </div>
      </div>

      {/* 8-Card Sensor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Raspberry Pi 5 Core */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <Cpu className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> RPi 5 CORE
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-500/30 font-semibold">
                NOMINAL
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div>
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">{cpuTemp}°C</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">TEMP</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-mono font-bold text-sky-700 dark:text-cyan-400 tabular-nums">{cpuLoad}%</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">LOAD</span>
              </div>
            </div>
          </div>

          <div className="h-32 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={[20, 80]} stroke={axisStroke} fontSize={9} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="cpuTemp" stroke="#FF6B00" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Temp (°C)" />
                <Line type="monotone" dataKey="cpuLoad" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={1.5} dot={false} isAnimationActive={false} name="Load (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>RAM: {ramUsage}% / 8GB</span>
            <span>FREQ: 2.40 GHz</span>
          </div>
        </div>

        {/* Card 2: TF-Luna LiDAR Sensor */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <Radio className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> TF-LUNA LIDAR
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 dark:bg-cyan-950/60 text-sky-800 dark:text-cyan-400 border border-sky-400/40 dark:border-cyan-500/30 font-semibold">
                UART 115200
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div>
                <span className="text-2xl font-mono font-bold text-sky-700 dark:text-cyan-300 tabular-nums">{lidarDistance.toFixed(2)}m</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">DIST</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">{lidarSignal}%</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">SIG</span>
              </div>
            </div>
          </div>

          <div className="h-32 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="lunaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={daylightMode ? '#0284C7' : '#00F0FF'} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={daylightMode ? '#0284C7' : '#00F0FF'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={[0, 15]} stroke={axisStroke} fontSize={9} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="lidarDistance" stroke={daylightMode ? '#0284C7' : '#00F0FF'} strokeWidth={1.5} fill="url(#lunaGrad)" dot={false} isAnimationActive={false} name="Distance (m)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>SNR: {lidarSnr} dB</span>
            <span>FREQ: 100 Hz</span>
          </div>
        </div>

        {/* Card 3: Camera Module & ISP */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <Video className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> CAMERA ISP
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-500/30 font-semibold">
                MIPI CSI-2
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div>
                <span className="text-2xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">{inferenceLatency}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">MS LAT</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{cameraFps}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">FPS</span>
              </div>
            </div>
          </div>

          <div className="h-32 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={[5, 75]} stroke={axisStroke} fontSize={9} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="cameraFps" stroke="#10B981" strokeWidth={1.5} dot={false} isAnimationActive={false} name="FPS" />
                <Line type="monotone" dataKey="inferenceLatency" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>RES: 1920x1080p</span>
            <span>SHUTTER: AUTO</span>
          </div>
        </div>

        {/* Card 4: IR Proximity Array (4-Zone Status Grid) */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <Layers className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> IR 4-ZONE ARRAY
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border border-blue-400/40 dark:border-blue-500/30 font-semibold">
                GPIO ADC
              </span>
            </div>

            {/* 4-Zone Quadrant Grid */}
            <div className="grid grid-cols-2 gap-2 my-2 font-mono">
              <div className="p-2 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">FRONT-LEFT</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-300">{flZone?.distance.toFixed(2)}m</div>
                <div className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">{flZone?.threatLevel}</div>
              </div>
              <div className="p-2 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">FRONT-RIGHT</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-300">{frZone?.distance.toFixed(2)}m</div>
                <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">{frZone?.threatLevel}</div>
              </div>
              <div className="p-2 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">REAR-LEFT</div>
                <div className="text-base font-bold text-sky-700 dark:text-cyan-300">{rlZone?.distance.toFixed(2)}m</div>
                <div className="text-[9px] text-sky-700 dark:text-cyan-400 font-semibold">{rlZone?.threatLevel}</div>
              </div>
              <div className="p-2 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">REAR-RIGHT</div>
                <div className="text-base font-bold text-sky-700 dark:text-cyan-300">{rrZone?.distance.toFixed(2)}m</div>
                <div className="text-[9px] text-sky-700 dark:text-cyan-400 font-semibold">{rrZone?.threatLevel}</div>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>PHOTODIODE: 940nm</span>
            <span>BEAM: 35° CONE</span>
          </div>
        </div>

        {/* Card 5: MPU6050 6-Axis IMU Sensor */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <Compass className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> MPU6050 IMU
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-500/30 font-semibold">
                I2C @ 400kHz
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1 my-2 text-center font-mono">
              <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/40">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">ACCEL X</div>
                <div className="text-sm font-bold text-sky-700 dark:text-cyan-300">{imu.ax}g</div>
              </div>
              <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/40">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">ACCEL Y</div>
                <div className="text-sm font-bold text-sky-700 dark:text-cyan-300">{imu.ay}g</div>
              </div>
              <div className="p-1 rounded bg-slate-100 dark:bg-slate-900/40">
                <div className="text-[9px] text-slate-500 dark:text-slate-400">ACCEL Z</div>
                <div className="text-sm font-bold text-sky-700 dark:text-cyan-300">{imu.az}g</div>
              </div>
            </div>
          </div>

          <div className="h-28 w-full my-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" hide />
                <YAxis domain={[-1.5, 1.5]} stroke={axisStroke} fontSize={9} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="accelX" stroke="#0284C7" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Accel X (g)" />
                <Line type="monotone" dataKey="accelY" stroke="#F59E0B" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Accel Y (g)" />
                <Line type="monotone" dataKey="accelZ" stroke="#A855F7" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Accel Z (g)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>GYRO Z: {imu.gz}°/s</span>
            <span>SAMPLE: 200 Hz</span>
          </div>
        </div>

        {/* Card 6: NEO-6M GPS Module */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-sky-600 dark:text-cyan-400" /> NEO-6M GPS
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-500/30 font-semibold">
                3D FIX (14 SATS)
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div>
                <span className="text-2xl font-mono font-bold text-sky-700 dark:text-cyan-300 tabular-nums">{speed}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">KM/H</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">ALT: {gps.alt}m</span>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">HDOP: 0.8</div>
              </div>
            </div>
          </div>

          <div className="p-2 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1 my-2">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">LAT:</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">{gps.lat.toFixed(5)}° N</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">LNG:</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">{gps.lng.toFixed(5)}° E</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">EPOCH:</span>
              <span className="text-sky-700 dark:text-cyan-400 font-semibold">NMEA 0183 RMC</span>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>SATELLITES: {gps.satellites} LOCK</span>
            <span>REFRESH: 10 Hz</span>
          </div>
        </div>

        {/* Card 7: Light & Fog Optical Sensor */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <SunMedium className="w-4 h-4 text-amber-500 dark:text-amber-400" /> OPTICAL LUX / FOG
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-400/40 dark:border-amber-500/30 font-semibold">
                BH1750 + OPTICAL
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div>
                <span className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-300 tabular-nums">{ambientLux}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">LUX</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">{lightScatterCoeff}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">SCATTER</span>
              </div>
            </div>
          </div>

          <div className="h-32 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="luxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke={axisStroke} fontSize={9} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="ambientLux" stroke="#F59E0B" strokeWidth={1.5} fill="url(#luxGrad)" dot={false} isAnimationActive={false} name="Ambient Lux" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>FOG INDEX: {fogLevel * 20}%</span>
            <span>RANGE: 1-65535 lx</span>
          </div>
        </div>

        {/* Card 8: Environmental & Moisture Sensor */}
        <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                <CloudRain className="w-4 h-4 text-sky-600 dark:text-blue-400" /> MOISTURE & RAIN
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border border-blue-400/40 dark:border-blue-500/30 font-semibold">
                CAPACITIVE + SHT40
              </span>
            </div>

            <div className="flex items-baseline justify-between my-2">
              <div>
                <span className="text-2xl font-mono font-bold text-sky-700 dark:text-blue-300 tabular-nums">{rainRate}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">MM/H</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">LVL {rainLevel}</span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">RAIN</span>
              </div>
            </div>
          </div>

          <div className="h-32 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={daylightMode ? '#0284C7' : '#38BDF8'} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={daylightMode ? '#0284C7' : '#38BDF8'} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke={gridStroke} />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke={axisStroke} fontSize={9} fontFamily="monospace" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="rainRate" stroke={daylightMode ? '#0284C7' : '#38BDF8'} strokeWidth={1.5} fill="url(#rainGrad)" dot={false} isAnimationActive={false} name="Rain Rate (mm/h)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between">
            <span>HUMIDITY: {55 + rainLevel * 8}%</span>
            <span>PM2.5: {18 + fogLevel * 14} µg/m³</span>
          </div>
        </div>
      </div>
    </div>
  );
};
