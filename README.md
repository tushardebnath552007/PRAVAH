# PRAVAH — Predictive Road Awareness & Vehicle Assistance Hub

PRAVAH is a full-stack ADAS (Advanced Driver Assistance System) telemetry and control dashboard. It pairs a React operator console with a real-time Three.js driving world, so every gauge, chart, sensor zone, detection and log on the site reflects what is happening inside the simulation.

The interface is built for a Raspberry Pi 5-class vehicle node: CAN 2.0B telemetry, TF-Luna LiDAR, ultrasonic/IR proximity sensors, 6-axis IMU, GPS, camera inference metrics, weather, and emergency actuation controls.

---

## Table of contents

- [What the site does](#what-the-site-does)
- [Feature tour](#feature-tour)
- [Live 3D simulation](#live-3d-simulation)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Available scripts](#available-scripts)
- [Environment variables](#environment-variables)
- [Simulation ↔ dashboard protocol](#simulation--dashboard-protocol)
- [Backend API](#backend-api)
- [Build and deployment](#build-and-deployment)
- [Verification checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

---

## What the site does

PRAVAH is an operator console for a live vehicle telemetry feed, with a 3D world as the live source when DATA STREAM MODE is set to DEMO.

- **Live telemetry** — speed, steering, gear, heading, LiDAR range, detection list, 8-zone proximity matrix, AEB/FCW state, servo position, IMU, GPS, and Raspberry Pi 5 hardware load.
- **3D driving world** — a Three.js city loop with traffic, pedestrians, potholes, rain, fog, night driving and oncoming headlights.
- **Driver assistance logic** — forward-collision warning, automatic emergency braking, lane-keeping status, adaptive-cruise status, and an anti-glare shield that reacts to oncoming vehicles at night.
- **Emergency controls** — global kill switch and manual AEB test/release.
- **Data exports** — CSV/JSON snapshots of telemetry history and sensor matrices.
- **Responsive dual theme** — daylight cockpit theme and a dark cyber telemetry theme.

Everything the dashboard displays is driven by the embedded simulation **only while DATA STREAM MODE is set to DEMO**. In PI 5 mode the 3D world stays visible as a view-only preview and the local telemetry fallback owns the dashboard; in OFF mode updates stop and the last values remain on screen.

---

## Feature tour

### 01. Command Center

The default screen and the home of the 3D world.

- Live speed, gear, heading, steering and LiDAR readouts
- Embedded 3D ADAS simulation with chase/orbit cameras, pause, reset, night mode, AEB test, and fullscreen
- Drive pad (accelerate, reverse, steer left/right, brake) that works without focusing the iframe
- Critical hazard modal with audio alarm and voice alert
- Health score, weather state, threat level and quick vehicle status

### 02. Sensor Matrix

- 360° proximity matrix with eight zones: front center, front left/right, side left/right, rear left/right, rear center
- Distance, max range, clearance and threat level per zone, fed from the simulation's LiDAR sectors
- Radar sweep visualization
- Ultrasonic / IR / TF-Luna sensor metadata
- Live clearance bars and obstacle indicators

### 03. AI Perception

- Animated forward-camera view rendered on canvas
- Bounding boxes for vehicles, pedestrians, potholes and traffic signs, streamed from the simulation's detection list
- Confidence, distance and velocity tags
- Overlay toggles and confidence threshold
- Fog/rain, night and anti-glare visualization
- Inference latency and camera FPS metrics
- **Road, Vehicle & Hazard Vision Engine** — a video-based perception lab embedded below the HUD:
  - sample highway video (`public/assets/road-vision/demo.mp4`), custom upload or live webcam
  - optical-flow detection with NMS, IoU tracking, counting line and green road-line tracing
  - vehicles, pedestrians, potholes, blind spots, blind corners and unstructured-road classification
  - forward-collision warning with TTC, hazard banner and audio chime
  - D3.js temporal confidence stability and 2D spatial hazard-density charts
  - historical critical-alert side panel and CSV telemetry export
  - four sub-tabs: `Road, Vehicle & Hazard Vision`, `Blind Spots & Forward Collision`, `Unstructured Road & Potholes`, `Model Stability (D3.js)`

### 04. Data Sheet & Environment

- Weather controls for rain and fog (0–5), with derived rain rate, fog density, ambient lux, road wetness, friction coefficient and hydroplaning risk
- Environment and sensor tables
- CSV and JSON export of telemetry history, proximity zones and detections
- Night/day lighting state

### 05. Threat & Actuation

- FCW sensitivity, AEB distance threshold, LKA and ACC configuration
- Servo / brake actuator status and test controls
- Piezo buzzer test with adjustable frequency and volume
- LED pattern selection
- Voice-alert toggle
- Live threat index and AEB state

### 06. Diagnostics & Logs

- Event audit trail with severity, category and metric values
- Acknowledgement and clear actions
- History charts for speed, LiDAR distance, CPU temperature/load, weather and threat index
- IMU and GPS readouts
- System, CAN bus and sensor health panels

### Global controls

- **Kill switch** — locks actuators into a safe state and freezes the simulation feed.
- **Data stream mode** — selects which source owns the dashboard: `DEMO` (3D simulation), `PI 5` (local fallback feed) or `OFF` (freeze updates).
- **Manual AEB** — trigger or release emergency braking from the header or the simulator panel.
- **Daylight mode** — switches the entire site between the daylight cockpit theme and the dark telemetry theme.
- **Notification drawer** — recent events and diagnostic alerts.
- **Fullscreen simulator modal** — opens the 3D world at full size, with an alternate `DIGITAL TWIN` engine available.

---

## Live 3D simulation

The world lives at `public/assets/simulation/adas-world.html`. It is a self-contained Three.js scene served from the same origin and embedded through an iframe.

### Data stream modes

The DATA STREAM MODE selector in the left drawer decides whether the 3D world is allowed to drive the dashboard.

| Mode | UI label | Behaviour |
| --- | --- | --- |
| `SIMULATION` | **DEMO** | The 3D world drives every telemetry parameter |
| `ONLINE_PI5` | **PI 5** | The 3D world is still visible but view-only; the dashboard runs the local telemetry fallback |
| `OFFLINE` | **OFF** | Dashboard updates stop and the last values remain frozen |

DEMO is the default. Switching away from DEMO immediately detaches the simulation feed; switching back reconnects as soon as the next frame arrives (within ~100 ms).

### How it drives the dashboard

1. The simulator advances physics, traffic, weather and ADAS inference on a ~33 ms engine interval.
2. It broadcasts a telemetry frame on `BroadcastChannel('adas_telemetry_channel')` at most every 100 ms.
3. `TelemetryContext` accepts the frame only in DEMO mode, filters it by instance (`embedded` vs `modal`), and writes it into React state.
4. Every view reads that shared state, so the dashboard follows the 3D world continuously.

The simulation keeps running while the iframe is not visible or not painting, because physics runs on an interval and rendering runs separately on `requestAnimationFrame`.

### What the simulation feeds

| Area | Dashboard values |
| --- | --- |
| Vehicle | speed, steering angle, gear, heading |
| LiDAR | front range, min distance, range, 8 directional sectors |
| Vision | detections (type, label, confidence, distance, screen position, size, velocity) |
| ADAS | AEB state, FCW message, servo angle, anti-glare shield |
| Motion | IMU accelerations and gyro rates, GPS coordinates/fix/satellites |
| Environment | rain, fog, night mode, glare detection |
| Link health | sequence number, paused/kill state, active AEB threshold |

### Simulation controls

Controls inside the dashboard (and their simulator keys):

| Action | Dashboard control | Keyboard (iframe focused) |
| --- | --- | --- |
| Accelerate | ▲ drive pad | `W` / `↑` |
| Reverse | ▼ drive pad | `S` / `↓` |
| Steer left | ◀ drive pad | `A` / `←` |
| Steer right | ▶ drive pad | `D` / `→` |
| Brake | BRAKE button | `Space` |
| Pause / resume | Pause button | — |
| Reset | Reset button | — |
| Chase camera | CHASE button | `1` |
| Orbit camera | ORBIT button | `2` |
| Night / day | Moon/Sun button | — |
| AEB test | Shield button | — |
| Weather | Rain/fog sliders on Data Sheet | Simulator sliders |
| Fullscreen | Expand button | — |

The site is authoritative for weather and night mode. Slider changes are pushed into both the embedded and modal simulation instances, and the simulator echoes them back so both stay in sync. Simulator-originated weather/night changes are accepted only in DEMO mode.

### Two simulation instances

- `embedded` — the panel on the Command Center.
- `modal` — the fullscreen simulator.

Each instance tags its telemetry with `instance`. The context ignores modal frames while the modal is closed and ignores embedded frames while the modal is open. This prevents two engines from fighting over the same dashboard values.

### Fallback behavior

In DEMO mode, if no simulation frame has arrived for 2.5 seconds, `TelemetryContext` marks the link as stale and starts a lightweight mock cruise loop so charts and gauges stay populated until the simulation reconnects. PI 5 mode always uses that fallback loop; OFF mode stops the update loop entirely. When the kill switch is active, incoming frames are acknowledged for link status but do not update telemetry.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (same origin)                       │
│                                                                     │
│  ┌───────────────────────────┐      ┌────────────────────────────┐  │
│  │ React dashboard           │      │ 3D ADAS world (iframe)     │  │
│  │                           │      │ Three.js scene + physics   │  │
│  │ TelemetryContext          │◄─────┤ BroadcastChannel           │  │
│  │  • telemetry state        │      │  • adas_telemetry_channel  │  │
│  │  • settings / alarms      │─────►│  • adas_control_channel    │  │
│  │  • history / logs         │      │  • adas_weather_channel    │  │
│  └─────────────┬─────────────┘      └────────────────────────────┘  │
│                │                                                    │
│                │ fetch                                              │
└────────────────┼────────────────────────────────────────────────────┘
                 ▼
      ┌──────────────────────────────┐
      │ Express server (tsx)         │
      │ /api/telemetry               │
      │ /api/history                 │
      │ /api/logs                    │
      │ /api/weather                 │
      │ /api/daylight-mode           │
      │ /api/simulation/state        │
      │ /api/aeb/trigger | release   │
      │ /api/health                  │
      │                              │
      │ Vite middleware (dev)        │
      │ static dist + SPA (prod)     │
      └──────────────────────────────┘
```

### State ownership

- **`TelemetryContext`** owns all live dashboard state, settings, history, logs, audio alerts and modal state.
- **The simulator owns physics** — position, speed, collisions, LiDAR ray hits and detections.
- **The Express backend** owns an independent in-memory telemetry engine used by the REST API. It is a separate feed from the browser simulation; the frontend only calls it for health/state endpoints.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript 7, Tailwind CSS 4 |
| Charts | Recharts 3, D3.js 7 (AI Perception vision analytics) |
| Icons | Lucide React |
| Animation | CSS keyframes, `motion` |
| 3D world | Three.js 0.187 (loaded in the iframe), OrbitControls |
| Build tool | Vite 8 |
| Server | Express 4, `tsx` |
| Audio | Web Audio API + Speech Synthesis |
| Transport | BroadcastChannel (browser), REST (API) |

No database or external telemetry service is required. All state is in memory or `localStorage`.

---

## Project structure

```
.
├── backend/
│   ├── server.ts            # Express app, Vite middleware, static/SPA serving
│   ├── routes.ts            # REST API router
│   └── telemetryService.ts  # In-memory telemetry engine (snapshot/history/logs)
├── frontend/
│   ├── App.tsx              # Shell, tab routing, persistent Command Center
│   ├── main.tsx             # React root
│   ├── index.css            # Tailwind theme, glass panels, animations
│   ├── components/
│   │   ├── ai-perception/   # Video perception engine, D3 charts, alert side panel
│   │   ├── layout/          # Navigation drawer, top header
│   │   ├── modals/          # Critical hazard modal, simulator modal
│   │   ├── radar/           # Radar sweep viewport
│   │   ├── simulation/      # ADAS world wrapper, digital twin engine
│   │   └── views/           # Six dashboard views
│   ├── context/
│   │   └── TelemetryContext.tsx
│   ├── types/
│   │   └── telemetry.ts
│   └── utils/
│       ├── audioSynthesizer.ts
│       └── exportCsv.ts
├── public/
│   └── assets/
│       ├── road-vision/
│       │   └── demo.mp4          # Sample highway video for the AI Perception vision engine
│       └── simulation/
│           └── adas-world.html   # Self-contained Three.js simulation
├── index.html               # HTML shell, fonts, meta
├── server.ts                # Server entry point
├── vite.config.ts           # React + Tailwind plugins, aliases, HMR switch
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── frontend/HANDOFF.md
└── backend/HANDOFF.md
```

---

## Getting started

### Prerequisites

- **Node.js 20.19+ or 22.12+** (Node 22 LTS recommended)
- **npm 10+**
- A modern Chromium/Firefox/Safari browser with `BroadcastChannel` support

### Install

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required because Recharts peers on React 19 while some transitive packages still advertise React 18 ranges.

### Run in development

```bash
npm run dev
```

Open **http://localhost:3000**.

The dev server is an Express process (`tsx server.ts`) that mounts Vite middleware, so API routes and the React app share one port and one origin.

### Run in production mode

```bash
npm run build
set NODE_ENV=production
npm start
```

On macOS/Linux use `NODE_ENV=production npm start`.

In production the server serves the built `dist/` bundle and falls back to `index.html` for client-side navigation. The API stays on the same origin.

### Type-check / lint

```bash
npm run lint
```

This runs `tsc --noEmit` across the project.

---

## Available scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run dev` | `tsx server.ts` | Start Express + Vite dev server on port 3000 |
| `npm start` | `tsx server.ts` | Start the server (use with `NODE_ENV=production` for built assets) |
| `npm run build` | `vite build` | Build the frontend into `dist/` |
| `npm run preview` | `vite preview` | Preview the built frontend only (no API) |
| `npm run lint` | `tsc --noEmit` | Type-check the whole project |
| `npm run clean` | `rm -rf dist server.js` | Remove build output (POSIX shells) |

---

## Environment variables

The server reads variables from the **process environment**. `.env.example` documents the supported values; export them in your shell, process manager, or hosting platform. A local `.env` file is not loaded automatically.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port for the Express server |
| `NODE_ENV` | `development` | Set to `production` to serve `dist/` and the SPA fallback |
| `DISABLE_HMR` | `false` | Set to `true` to disable Vite HMR and file watching on constrained hosts |

The app does not require any external API keys to run.

---

## Simulation ↔ dashboard protocol

All channels are same-origin `BroadcastChannel`s. Messages are plain objects.

### Telemetry: sim → dashboard

Channel: `adas_telemetry_channel`

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | string | `"adas-world"` |
| `instance` | `"embedded" \| "modal"` | Which simulation produced the frame |
| `linked` | boolean | Simulator reports an active link |
| `seq` | number | Frame counter |
| `timestamp` | string | Simulator clock, e.g. `14:03:22.481` |
| `speed` | number | km/h |
| `steer` | number | Steering angle in degrees |
| `gear` | `"P" \| "R" \| "N" \| "D"` | Selected gear |
| `heading` | number | Degrees, 0–360 |
| `objects` | number | Critical collision object count |
| `objectCount` | number | Detection count |
| `minDistance` | number | Nearest forward range (m) |
| `range` | number | Minimum observed range across sensors (m) |
| `sectors` | object | `front`, `frontLeft`, `frontRight`, `left`, `right`, `rearLeft`, `rearRight`, `rear` ranges |
| `detections` | array | `{ id, type, label, confidence, distance, x, y, width, height, velocity }` |
| `aebActive` | boolean | Automated braking engaged |
| `fcwState` | string | Human-readable FCW message |
| `rainLevel` / `fogLevel` | number | 0–5 |
| `nightMode` | boolean | Night scene active |
| `glareDetected` | boolean | Oncoming headlight glare detected |
| `agsActive` | boolean | Anti-glare shield active |
| `servoAngle` | number | Brake servo, 0–90° |
| `imu` | object | `ax, ay, az, gx, gy, gz` |
| `gps` | object | `lat, lng, alt, satellites, fix` |
| `paused` / `killSwitch` | boolean | Simulator pause / safety state |
| `aebThreshold` | number | Active AEB threshold in metres |

The context clamps the forward LiDAR value to 12 m for display consistency and maps the eight sectors to the proximity zones, deriving `CLEAR`, `SAFE`, `CAUTION`, `WARNING`, or `CRITICAL` from each zone's max range.

### Control: dashboard → sim

Channel: `adas_control_channel`

| `type` | Payload | Effect |
| --- | --- | --- |
| `drive` | `{ key: "w" \| "a" \| "s" \| "d" \| "Space", down }` | Press/release a driving key |
| `brake` | `{ down }` | Brake pedal |
| `camera` | `{ mode: "chase" \| "orbit" }` | Camera mode |
| `weather` | `{ rainLevel?, fogLevel? }` | Set weather |
| `night` | `{ enabled }` | Day/night scene |
| `pause` | `{ paused }` | Freeze/resume physics |
| `kill` | `{ active }` | Kill switch |
| `aeb` | `{ active }` | Manual AEB override |
| `config` | `{ aebThreshold?, antiGlare? }` | ADAS settings |
| `reset` | `{}` | Reset vehicle to start |

Messages may include `target: "embedded" | "modal"`; the simulator ignores messages addressed to the other instance. The simulator emits `{ type: "nightState", enabled }` so a night toggle made inside the iframe updates the dashboard.

### Weather echo

Channel: `adas_weather_channel`

- Dashboard → sim: `{ rainLevel }` and/or `{ fogLevel }` when sliders move.
- Sim → dashboard: the same shape when weather changes inside the simulator.

### Query parameters

`GET /assets/simulation/adas-world.html`

| Param | Values | Purpose |
| --- | --- | --- |
| `embed` | `0` / `1` | `1` applies the compact HUD, hides the simulator's own nav/control deck |
| `instance` | `embedded` / `modal` | Instance identity for telemetry and control routing |

The standalone URL `/assets/simulation/adas-world.html` runs the full simulator UI without the dashboard.

---

## Backend API

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service health + node identity |
| `GET` | `/telemetry` | Latest in-memory telemetry snapshot |
| `GET` | `/history` | Up to 60 history frames (1 per second) |
| `GET` | `/logs` | Diagnostic audit trail |
| `POST` | `/weather` | Set rain/fog levels (`rainLevel`, `fogLevel`, 0–5) |
| `POST` | `/daylight-mode` | Set daylight mode (`enabled`) |
| `GET` | `/simulation/state` | Read `isSimRunning` and `daylightMode` |
| `POST` | `/simulation/state` | Set simulation running (`running`) |
| `POST` | `/aeb/trigger` | Engage the backend AEB override |
| `POST` | `/aeb/release` | Release the backend AEB override |

### Examples

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/telemetry
curl http://localhost:3000/api/history

curl -X POST http://localhost:3000/api/weather \
  -H "Content-Type: application/json" \
  -d "{\"rainLevel\":3,\"fogLevel\":1}"

curl -X POST http://localhost:3000/api/daylight-mode \
  -H "Content-Type: application/json" \
  -d "{\"enabled\":true}"

curl -X POST http://localhost:3000/api/simulation/state \
  -H "Content-Type: application/json" \
  -d "{\"running\":false}"

curl -X POST http://localhost:3000/api/aeb/trigger
curl -X POST http://localhost:3000/api/aeb/release
```

All responses follow:

```json
{ "status": "success", "data": { } }
```

> The backend engine is an independent 1 Hz simulation used by the REST surface. In DEMO mode, the dashboard's live values come from the browser 3D world through `BroadcastChannel`, not from `/api/telemetry`. This is intentional: the 3D world is the interactive source of truth while DEMO is selected, while the API provides a headless telemetry surface for integrations and diagnostics.

---

## Build and deployment

### Build

```bash
npm install --legacy-peer-deps
npm run build
```

Output goes to `dist/`. The backend is TypeScript executed directly by `tsx`, so no separate server bundle step is required.

### Run

```bash
NODE_ENV=production PORT=3000 npm start
```

Serving behavior:

- **Development** — Express mounts Vite middleware; React, API and assets come from one server.
- **Production** — Express serves `public/` and `dist/`, then falls back to `dist/index.html` for SPA routes.

### Deployment notes

- Expose the port used by `PORT` (default `3000`).
- `tsx`, Vite and TypeScript are dev dependencies but are used at runtime/build time (`npm start` runs `tsx server.ts`). Keep dev dependencies installed, or install a global `tsx` and build step in your deployment image.
- Persist nothing: history, logs and telemetry are in memory and reset on restart.
- The simulation is a static file under `public/`; it is copied into `dist/` by Vite during the build.
- For a vehicle node, run the server on the same host as the dashboard or place a reverse proxy in front of it.
- Keep the dashboard and iframe on the **same origin**. `BroadcastChannel` requires it, and iframe embedding is same-origin.

---

## Verification checklist

Use this after changes to the simulation or context:

1. **Boot** — Command Center shows `LIVE FEED`; speed and front range move without input (DEMO is the default mode).
2. **Drive** — hold ▲; speed rises. Hold ◀/▶; steering and heading change. Press BRAKE; speed drops.
3. **Pause/resume** — pause freezes speed at 0 and reports `FCW: SIMULATION PAUSED`; resume continues.
4. **AEB** — press the shield button; speed goes to 0, servo shows 90°, FCW reports AEB. Release restores normal drive.
5. **Kill switch** — engaging locks the actuators and freezes telemetry; disengaging restores the feed.
6. **Night** — toggle night; scene darkens. With oncoming traffic, glare/anti-glare activates.
7. **Weather** — set rain/fog on Data Sheet; the simulator updates, and the dashboard weather cards change.
8. **Zones** — drive close to an object; the matching proximity zone warning escalates.
9. **Tabs** — switch tabs; telemetry keeps updating and charts keep appending.
10. **Fullscreen** — open the simulator modal; the embedded instance pauses, the modal instance drives telemetry. Close it; the embedded instance resumes.
11. **Logs** — AEB transitions appear in Diagnostics & Logs.
12. **Mode switch** — select `PI 5`: the simulator chip changes to `VIEW ONLY` and website values stop following the 3D world. Select `DEMO`: the chip returns to `LIVE FEED` within a second. Select `OFF`: all updates freeze.
13. **Road-vision engine** — open AI Perception, scroll to the vision engine, press **Play & Detect**, and confirm video overlays, the alert drawer and all four sub-tabs (including the D3 stability charts) work.
14. **Build** — `npm run lint` and `npm run build` both pass.

---

## Troubleshooting

**Speed stays static**
Make sure DATA STREAM MODE is set to `DEMO`. In `PI 5` mode the simulator panel shows `VIEW ONLY` and the dashboard uses the local fallback; in `OFF` mode updates are frozen. In DEMO, the panel should show `LIVE FEED`, not `CONNECTING`. Check the browser console for `BroadcastChannel` errors. If the link is stale for more than 2.5 s, the fallback mock loop takes over until frames return.

**Keyboard controls do nothing**
The iframe must have focus for raw key events. Click inside the 3D viewport or use the dashboard drive pad, which sends messages directly over the control channel.

**Weather resets on reload**
Rain and fog are stored in `localStorage` under `adas_rain` and `adas_fog`. Clear those keys or move the sliders to reset the state.

**No sound**
Browsers block audio until the first user gesture. Click any button first, then test the piezo buzzer or trigger AEB.

**Night toggle flips back**
The dashboard and simulator both send night state. The site is authoritative after load; toggling from inside the simulator sends `nightState` back to the site. If you are testing both at once, wait for the echo before toggling again.

**`npm install` fails on peer dependencies**
Use `npm install --legacy-peer-deps`. The React 19 / Recharts peer range mismatch is expected.

**Port already in use**
Set `PORT=3001 npm run dev` (or the PowerShell equivalent) and open the new port.

**Production build shows a blank page**
`npm start` must run with `NODE_ENV=production` to serve `dist/`. Without it, Express mounts a new Vite dev server instead of the built assets.

**Charts look empty**
History is capped at 50 points client-side and one point per second, so a fresh tab needs a few seconds to fill. The initial seed history renders immediately.

---

## Related documentation

- [`frontend/HANDOFF.md`](frontend/HANDOFF.md) — frontend state model, component map, simulation wiring, gotchas.
- [`backend/HANDOFF.md`](backend/HANDOFF.md) — server setup, routes, telemetry engine, deployment notes.

---

**PRAVAH** — Predictive Road Awareness & Vehicle Assistance Hub
