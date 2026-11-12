import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { 
  Camera, 
  Eye, 
  RotateCcw, 
  Maximize2, 
  Compass, 
  Sliders, 
  AlertTriangle, 
  ShieldCheck, 
  ShieldAlert, 
  CloudRain, 
  Sun, 
  Info,
  Car,
  Zap,
  Play,
  Pause
} from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

interface HoveredObjectInfo {
  name: string;
  type: 'EGO_VEHICLE' | 'LIDAR_SENSOR' | 'LEAD_VEHICLE' | 'PEDESTRIAN' | 'LANE_SYSTEM';
  description: string;
  metric: string;
  safetyStatus: string;
  screenX: number;
  screenY: number;
}

export const Custom3dSimulation: React.FC<{
  height?: string;
  allowFullscreen?: boolean;
}> = ({ height = '500px', allowFullscreen = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    speed,
    steerAngle,
    lidarDistance,
    aebActive,
    fogLevel,
    rainLevel,
    daylightMode,
    isSimRunning,
    toggleSimRunning,
    triggerManualAEB,
    releaseAEB
  } = useTelemetry();

  const [cameraMode, setCameraMode] = useState<'chase' | 'orbit' | 'cockpit' | 'overhead'>('chase');
  const [hoveredInfo, setHoveredInfo] = useState<HoveredObjectInfo | null>(null);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);

  // References for Three.js scene objects
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reqIdRef = useRef<number | null>(null);

  // 3D Scene Components
  const egoCarGroupRef = useRef<THREE.Group | null>(null);
  const lidarBeamRef = useRef<THREE.Mesh | null>(null);
  const lidarRingsGroupRef = useRef<THREE.Group | null>(null);
  const lidarDomeRef = useRef<THREE.Mesh | null>(null);
  const frontWheelsRef = useRef<THREE.Group[]>([]);
  const rearWheelsRef = useRef<THREE.Group[]>([]);
  const brakeLightsRef = useRef<THREE.Mesh[]>([]);
  const leadCarRef = useRef<THREE.Group | null>(null);
  const pedestrianRef = useRef<THREE.Group | null>(null);
  const roadLinesRef = useRef<THREE.InstancedMesh | null>(null);
  const rainSystemRef = useRef<THREE.Points | null>(null);

  // Mouse interaction & Orbit controls
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const orbitAnglesRef = useRef({ theta: 0, phi: 0.35, radius: 14 });
  const mouseRaycasterRef = useRef(new THREE.Raycaster());
  const mouseCoordRef = useRef(new THREE.Vector2());

  // Software WebGL probe
  const isSoftwareGl = useRef((() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return false;
    }
  })());

  // Setup Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const heightPx = containerRef.current.clientHeight;

    // 1. Scene & Lighting
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const bgColor = daylightMode ? 0xEDF2F7 : 0x050811;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.FogExp2(bgColor, 0.015 + (fogLevel * 0.018));

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / heightPx, 0.1, 500);
    camera.position.set(0, 4.5, 11);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !isSoftwareGl.current,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(isSoftwareGl.current ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = daylightMode ? 1.05 : 1.25;
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(daylightMode ? 0xE2E8F0 : 0x1E293B, daylightMode ? 1.4 : 0.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(daylightMode ? 0xFFFBEB : 0x38BDF8, daylightMode ? 1.8 : 1.2);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00F0FF, 0.6);
    rimLight.position.set(-20, 15, -25);
    scene.add(rimLight);

    // 5. Environment: Road Ground
    const roadWidth = 14;
    const roadLength = 240;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 1);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: daylightMode ? 0x242D3D : 0x0D111A,
      roughness: Math.max(0.2, 0.85 - (rainLevel * 0.12)),
      metalness: 0.15,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, 0, 0);
    scene.add(road);

    // Shoulders & grass edges
    const terrainGeo = new THREE.PlaneGeometry(120, roadLength);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: daylightMode ? 0xCBD5E1 : 0x06090F,
      roughness: 0.95,
      metalness: 0.05,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.set(0, -0.05, 0);
    scene.add(terrain);

    // Road Barriers (Left & Right guard rails with glowing reflectors)
    const barrierGeo = new THREE.BoxGeometry(0.3, 0.6, roadLength);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: daylightMode ? 0x94A3B8 : 0x1E293B,
      metalness: 0.6,
      roughness: 0.4
    });
    const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    leftBarrier.position.set(-roadWidth / 2 - 0.2, 0.3, 0);
    scene.add(leftBarrier);

    const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    rightBarrier.position.set(roadWidth / 2 + 0.2, 0.3, 0);
    scene.add(rightBarrier);

    // 6. Road Lane Lines (InstancedMesh for high performance)
    const lineCount = 30;
    const lineGeo = new THREE.BoxGeometry(0.18, 0.02, 3.5);
    const lineMat = new THREE.MeshStandardMaterial({
      color: daylightMode ? 0xFFFFFF : 0x00F0FF,
      emissive: daylightMode ? 0x000000 : 0x00F0FF,
      emissiveIntensity: daylightMode ? 0 : 0.6,
      roughness: 0.3
    });
    const roadLines = new THREE.InstancedMesh(lineGeo, lineMat, lineCount * 2);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < lineCount; i++) {
      const zPos = (i * 8) - (roadLength / 2);
      // Left lane divider
      dummy.position.set(-roadWidth / 4, 0.02, zPos);
      dummy.updateMatrix();
      roadLines.setMatrixAt(i * 2, dummy.matrix);

      // Right lane divider
      dummy.position.set(roadWidth / 4, 0.02, zPos);
      dummy.updateMatrix();
      roadLines.setMatrixAt(i * 2 + 1, dummy.matrix);
    }
    roadLines.instanceMatrix.needsUpdate = true;
    scene.add(roadLines);
    roadLinesRef.current = roadLines;

    // 7. Ego Vehicle Construction (Hierarchical Composite 3D Model)
    const egoCar = new THREE.Group();
    egoCar.userData = {
      name: 'PRAVAH Smart Vehicle (You)',
      type: 'EGO_VEHICLE',
      description: 'Autonomous vehicle digital twin connected via Raspberry Pi 5 CAN bus',
      safetyStatus: 'Active Driving',
      metric: `${speed} km/h`
    };

    // Chassis body
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.75, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: daylightMode ? 0x0284C7 : 0x0F172A,
      metalness: 0.8,
      roughness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.65;
    egoCar.add(bodyMesh);

    // Cabin Glass / Roof
    const cabinGeo = new THREE.BoxGeometry(1.7, 0.6, 2.3);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0B1220,
      metalness: 0.95,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 1.25, -0.2);
    egoCar.add(cabinMesh);

    // Headlights (Cyan LED strips)
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0x00F0FF,
      emissive: 0x00F0FF,
      emissiveIntensity: 2.2,
      roughness: 0.1
    });
    const leftHeadlight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), headlightMat);
    leftHeadlight.position.set(-0.75, 0.65, -2.2);
    egoCar.add(leftHeadlight);

    const rightHeadlight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), headlightMat);
    rightHeadlight.position.set(0.75, 0.65, -2.2);
    egoCar.add(rightHeadlight);

    // Brake Lights (Dual Red LEDs)
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0xFF0055,
      emissive: 0xFF0055,
      emissiveIntensity: aebActive ? 3.5 : 1.0,
      roughness: 0.2
    });
    const leftBrake = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), brakeMat);
    leftBrake.position.set(-0.75, 0.65, 2.2);
    egoCar.add(leftBrake);

    const rightBrake = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), brakeMat);
    rightBrake.position.set(0.75, 0.65, 2.2);
    egoCar.add(rightBrake);
    brakeLightsRef.current = [leftBrake, rightBrake];

    // Wheels (4 PBR Wheels with tire treads)
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.32, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.85,
      metalness: 0.2
    });
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x38BDF8,
      metalness: 0.9,
      roughness: 0.2
    });

    const createWheel = () => {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 8), hubMat);
      hub.rotateZ(Math.PI / 2);
      g.add(tire);
      g.add(hub);
      return g;
    };

    const flWheel = createWheel();
    flWheel.position.set(-1.08, 0.4, -1.35);
    egoCar.add(flWheel);

    const frWheel = createWheel();
    frWheel.position.set(1.08, 0.4, -1.35);
    egoCar.add(frWheel);
    frontWheelsRef.current = [flWheel, frWheel];

    const rlWheel = createWheel();
    rlWheel.position.set(-1.08, 0.4, 1.35);
    egoCar.add(rlWheel);

    const rrWheel = createWheel();
    rrWheel.position.set(1.08, 0.4, 1.35);
    egoCar.add(rrWheel);
    rearWheelsRef.current = [rlWheel, rrWheel];

    // LiDAR Sensor Dome on top of roof
    const lidarDomeGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.22, 16);
    const lidarDomeMat = new THREE.MeshStandardMaterial({
      color: 0x00F0FF,
      emissive: 0x00F0FF,
      emissiveIntensity: 1.5,
      metalness: 0.9,
      roughness: 0.1
    });
    const lidarDome = new THREE.Mesh(lidarDomeGeo, lidarDomeMat);
    lidarDome.position.set(0, 1.65, -0.1);
    lidarDome.userData = {
      name: 'TF-Luna LiDAR Sensor',
      type: 'LIDAR_SENSOR',
      description: 'Continuous 100Hz laser distance scanner measuring obstacle proximity ahead',
      safetyStatus: 'Active Scanning',
      metric: `${lidarDistance.toFixed(2)} m forward`
    };
    egoCar.add(lidarDome);
    lidarDomeRef.current = lidarDome;

    // 3D Forward LiDAR Projected Sensing Beam Cone
    const lidarBeamGeo = new THREE.ConeGeometry(3.5, 14, 16, 1, true);
    lidarBeamGeo.rotateX(-Math.PI / 2);
    lidarBeamGeo.translate(0, 0, -7);
    const lidarBeamMat = new THREE.MeshBasicMaterial({
      color: aebActive ? 0xFF0055 : lidarDistance < 3 ? 0xF59E0B : 0x00F0FF,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      wireframe: true
    });
    const lidarBeam = new THREE.Mesh(lidarBeamGeo, lidarBeamMat);
    lidarBeam.position.set(0, 0.7, -2.2);
    egoCar.add(lidarBeam);
    lidarBeamRef.current = lidarBeam;

    // Ground Proximity Safety Bubble Rings
    const ringsGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(2.8, 3.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00F0FF,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.05;
    ringsGroup.add(ringMesh);
    egoCar.add(ringsGroup);
    lidarRingsGroupRef.current = ringsGroup;

    egoCar.position.set(0, 0, 0);
    scene.add(egoCar);
    egoCarGroupRef.current = egoCar;

    // 8. Lead Vehicle (Obstacle Ahead)
    const leadCar = new THREE.Group();
    leadCar.userData = {
      name: 'Forward Vehicle Target (Sedan)',
      type: 'LEAD_VEHICLE',
      description: 'Tracked forward vehicle detected by camera and TF-Luna LiDAR',
      safetyStatus: lidarDistance < 2.0 ? 'Immediate Collision Risk' : 'Safely Monitored Ahead',
      metric: `${lidarDistance.toFixed(2)} meters away`
    };
    const leadBodyGeo = new THREE.BoxGeometry(2.0, 0.7, 4.2);
    const leadBodyMat = new THREE.MeshStandardMaterial({
      color: 0xE11D48,
      metalness: 0.7,
      roughness: 0.3
    });
    const leadBody = new THREE.Mesh(leadBodyGeo, leadBodyMat);
    leadBody.position.y = 0.65;
    leadCar.add(leadBody);

    const leadCabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.2 })
    );
    leadCabin.position.set(0, 1.2, -0.2);
    leadCar.add(leadCabin);

    // Glowing target bounding box
    const leadBBoxGeo = new THREE.BoxGeometry(2.3, 1.6, 4.5);
    const leadBBoxMat = new THREE.MeshBasicMaterial({
      color: aebActive ? 0xFF0055 : 0x00F0FF,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    leadCar.add(new THREE.Mesh(leadBBoxGeo, leadBBoxMat));

    leadCar.position.set(0, 0, -lidarDistance * 2.2 - 2);
    scene.add(leadCar);
    leadCarRef.current = leadCar;

    // 9. Pedestrian (Crossing Side Walk / Shoulder)
    const pedestrian = new THREE.Group();
    pedestrian.userData = {
      name: 'Pedestrian on Road Edge',
      type: 'PEDESTRIAN',
      description: 'YOLO-D object detection classification with 96% confidence',
      safetyStatus: 'Caution - Pedestrian in Vicinity',
      metric: '8.4 m clearance'
    };
    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xFDE047, roughness: 0.5 })
    );
    head.position.y = 1.65;
    pedestrian.add(head);

    // Torso
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: 0x38BDF8, roughness: 0.4 })
    );
    torso.position.y = 1.15;
    pedestrian.add(torso);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.8 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.12, 0.4, 0);
    pedestrian.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.12, 0.4, 0);
    pedestrian.add(rightLeg);

    pedestrian.position.set(4.2, 0, -8);
    scene.add(pedestrian);
    pedestrianRef.current = pedestrian;

    // 10. Weather Particles (Rain Drops)
    if (rainLevel > 0) {
      const dropCount = rainLevel * 600;
      const rainGeo = new THREE.BufferGeometry();
      const rainPositions = new Float32Array(dropCount * 3);
      for (let i = 0; i < dropCount * 3; i += 3) {
        rainPositions[i] = (Math.random() - 0.5) * 40;
        rainPositions[i + 1] = Math.random() * 25;
        rainPositions[i + 2] = (Math.random() - 0.5) * 60;
      }
      rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
      const rainMat = new THREE.PointsMaterial({
        color: 0x7DD3FC,
        size: 0.12,
        transparent: true,
        opacity: 0.6
      });
      const rainSystem = new THREE.Points(rainGeo, rainMat);
      scene.add(rainSystem);
      rainSystemRef.current = rainSystem;
    }

    // 11. Animation Tick Loop
    let lastTime = performance.now();
    let roadScrollOffset = 0;

    const animate = () => {
      reqIdRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Rotate LiDAR sensor dome
      if (lidarDomeRef.current) {
        lidarDomeRef.current.rotation.y += delta * 12;
      }

      // Scroll road markings based on vehicle speed
      if (roadLinesRef.current && isSimRunning) {
        roadScrollOffset += (speed * 0.28) * delta;
        const lineSpacing = 8;
        const dummyMatrix = new THREE.Matrix4();
        const dummyPos = new THREE.Vector3();
        const dummyRot = new THREE.Quaternion();
        const dummyScale = new THREE.Vector3(1, 1, 1);

        for (let i = 0; i < lineCount; i++) {
          let baseZ = (i * lineSpacing) - (roadLength / 2) + (roadScrollOffset % lineSpacing);
          if (baseZ > roadLength / 2) baseZ -= roadLength;

          // Left
          dummyPos.set(-roadWidth / 4, 0.02, baseZ);
          dummyMatrix.compose(dummyPos, dummyRot, dummyScale);
          roadLinesRef.current.setMatrixAt(i * 2, dummyMatrix);

          // Right
          dummyPos.set(roadWidth / 4, 0.02, baseZ);
          dummyMatrix.compose(dummyPos, dummyRot, dummyScale);
          roadLinesRef.current.setMatrixAt(i * 2 + 1, dummyMatrix);
        }
        roadLinesRef.current.instanceMatrix.needsUpdate = true;
      }

      // Wheels rotation & steering
      const wheelTurnAngle = (steerAngle * Math.PI) / 180;
      frontWheelsRef.current.forEach(w => {
        w.rotation.y = wheelTurnAngle;
        if (isSimRunning) w.children[0].rotation.x += (speed * 0.08) * delta;
      });
      rearWheelsRef.current.forEach(w => {
        if (isSimRunning) w.children[0].rotation.x += (speed * 0.08) * delta;
      });

      // Animate Rain
      if (rainSystemRef.current) {
        const positions = rainSystemRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 1; i < positions.length; i += 3) {
          positions[i] -= 32 * delta;
          if (positions[i] < 0) positions[i] = 22;
        }
        rainSystemRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Update Lead Car position based on live lidarDistance
      if (leadCarRef.current) {
        const targetZ = -Math.max(1.8, lidarDistance * 1.8 + 2.5);
        leadCarRef.current.position.z += (targetZ - leadCarRef.current.position.z) * 0.15;
      }

      // Update LiDAR Beam color and pulsing
      if (lidarBeamRef.current) {
        const beamMat = lidarBeamRef.current.material as THREE.MeshBasicMaterial;
        const targetColor = aebActive ? 0xFF0055 : lidarDistance < 2.5 ? 0xFF6B00 : lidarDistance < 4 ? 0xF59E0B : 0x00F0FF;
        beamMat.color.setHex(targetColor);
        beamMat.opacity = aebActive ? (Math.sin(now * 0.015) * 0.2 + 0.35) : 0.22;
      }

      // Update Brake Lights
      if (brakeLightsRef.current.length > 0) {
        brakeLightsRef.current.forEach(light => {
          const mat = light.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = aebActive ? 3.5 : speed === 0 ? 2.5 : 0.8;
        });
      }

      // Update Camera based on selected camera mode
      if (cameraRef.current && egoCarGroupRef.current) {
        const egoPos = egoCarGroupRef.current.position;

        if (cameraMode === 'chase') {
          // Smooth chase cam behind and slightly elevated
          const targetCamPos = new THREE.Vector3(
            egoPos.x + Math.sin(wheelTurnAngle * 0.2) * 0.6,
            egoPos.y + 3.8,
            egoPos.z + 9.5
          );
          cameraRef.current.position.lerp(targetCamPos, 0.08);
          cameraRef.current.lookAt(egoPos.x, egoPos.y + 1.2, egoPos.z - 6);
        } else if (cameraMode === 'cockpit') {
          // Inside driver seat
          cameraRef.current.position.set(egoPos.x - 0.35, egoPos.y + 1.25, egoPos.z - 0.2);
          cameraRef.current.lookAt(egoPos.x, egoPos.y + 1.2, egoPos.z - 25);
        } else if (cameraMode === 'overhead') {
          // Top-down tactical drone
          cameraRef.current.position.set(egoPos.x, egoPos.y + 24, egoPos.z - 2);
          cameraRef.current.lookAt(egoPos.x, egoPos.y, egoPos.z - 4);
        } else if (cameraMode === 'orbit') {
          // Orbit spherical coordinates around vehicle center
          const { theta, phi, radius } = orbitAnglesRef.current;
          const x = egoPos.x + radius * Math.sin(phi) * Math.sin(theta);
          const y = egoPos.y + radius * Math.cos(phi);
          const z = egoPos.z + radius * Math.sin(phi) * Math.cos(theta);
          cameraRef.current.position.set(x, y, z);
          cameraRef.current.lookAt(egoPos.x, egoPos.y + 1.0, egoPos.z);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 12. Resize Listener
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 13. Cleanup on Unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
      roadGeo.dispose();
      roadMat.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      renderer.dispose();
    };
  }, [daylightMode, rainLevel, fogLevel, cameraMode]);

  // Mouse / Pointer handlers for interactive Orbit and Raycasting Hover
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    // Handle Orbit drag when in Orbit mode
    if (isDraggingRef.current && cameraMode === 'orbit') {
      const deltaX = e.clientX - prevMousePosRef.current.x;
      const deltaY = e.clientY - prevMousePosRef.current.y;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };

      orbitAnglesRef.current.theta -= deltaX * 0.008;
      orbitAnglesRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, orbitAnglesRef.current.phi - deltaY * 0.008));
    }

    // Raycast hover detection over 3D interactive actors
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseCoordRef.current.set(x, y);

    mouseRaycasterRef.current.setFromCamera(mouseCoordRef.current, cameraRef.current);

    const interactiveTargets: THREE.Object3D[] = [];
    if (egoCarGroupRef.current) interactiveTargets.push(egoCarGroupRef.current);
    if (leadCarRef.current) interactiveTargets.push(leadCarRef.current);
    if (pedestrianRef.current) interactiveTargets.push(pedestrianRef.current);
    if (lidarDomeRef.current) interactiveTargets.push(lidarDomeRef.current);

    const intersects = mouseRaycasterRef.current.intersectObjects(interactiveTargets, true);

    if (intersects.length > 0) {
      let rootObj: THREE.Object3D | null = intersects[0].object;
      while (rootObj && !rootObj.userData?.name && rootObj.parent) {
        rootObj = rootObj.parent;
      }

      if (rootObj && rootObj.userData?.name) {
        setHoveredInfo({
          name: rootObj.userData.name,
          type: rootObj.userData.type || 'EGO_VEHICLE',
          description: rootObj.userData.description || 'Active ADAS Digital Twin Object',
          safetyStatus: rootObj.userData.safetyStatus || 'Nominal',
          metric: rootObj.userData.metric || `${speed} km/h`,
          screenX: e.clientX - rect.left,
          screenY: e.clientY - rect.top
        });
        return;
      }
    }

    setHoveredInfo(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (cameraMode === 'orbit') {
      orbitAnglesRef.current.radius = Math.max(6, Math.min(28, orbitAnglesRef.current.radius + e.deltaY * 0.02));
    }
  };

  return (
    <div 
      ref={containerRef} 
      className="relative w-full rounded-2xl overflow-hidden glass-panel border border-sky-400/25 dark:border-cyan-500/25 shadow-2xl select-none"
      style={{ height }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top Floating Telemetry & Camera HUD */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10 font-mono text-xs">
        {/* Left: Simulation Status & Drive Readout */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-cyan-500/30 text-cyan-300 shadow-lg">
            <Car className="w-4 h-4 text-cyan-400" />
            <span className="font-bold tracking-wider font-display">PRAVAH 3D DIGITAL TWIN</span>
          </div>

          <button
            onClick={toggleSimRunning}
            title={isSimRunning ? 'Pause Driving Simulation' : 'Resume Driving Simulation'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold transition-all shadow-md ${
              isSimRunning
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-amber-950/80 border-amber-500/50 text-amber-300 hover:bg-amber-900/80'
            }`}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimRunning ? 'LIVE DRIVING' : 'PAUSED'}</span>
          </button>
        </div>

        {/* Right: Camera Presets & AEB Trigger */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/85 backdrop-blur-md border border-slate-700/60 text-[11px]">
            <button
              onClick={() => setCameraMode('chase')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cameraMode === 'chase'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Chase Cam: Follows car smoothly from behind"
            >
              CHASE
            </button>
            <button
              onClick={() => setCameraMode('cockpit')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cameraMode === 'cockpit'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Cockpit: Driver perspective through windshield"
            >
              COCKPIT
            </button>
            <button
              onClick={() => setCameraMode('overhead')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cameraMode === 'overhead'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Overhead: Top-down aerial drone view"
            >
              DRONE
            </button>
            <button
              onClick={() => setCameraMode('orbit')}
              className={`px-2.5 py-1 rounded transition-colors ${
                cameraMode === 'orbit'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Orbit: Click and drag anywhere to spin 360°"
            >
              ORBIT 360°
            </button>
          </div>

          <button
            onClick={() => setShowHelpTooltip(prev => !prev)}
            className="p-1.5 rounded-lg bg-slate-900/85 border border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-cyan-300 transition-colors"
            title="User Guide & Interaction Tips"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-Time Hover Tooltip Card (Directly over 3D raycasted object) */}
      {hoveredInfo && (
        <div 
          className="absolute pointer-events-none z-30 transition-all duration-75 p-3 rounded-xl bg-slate-950/95 backdrop-blur-md border border-cyan-400/60 shadow-[0_0_20px_rgba(0,240,255,0.25)] text-white font-mono max-w-xs animate-fadeIn"
          style={{
            left: Math.min(hoveredInfo.screenX + 15, (containerRef.current?.clientWidth || 600) - 270),
            top: Math.min(hoveredInfo.screenY - 20, (containerRef.current?.clientHeight || 400) - 130),
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold border-b border-cyan-500/30 pb-1.5 mb-1.5">
            <span className="text-cyan-300 font-display uppercase tracking-wide">{hoveredInfo.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              {hoveredInfo.metric}
            </span>
          </div>
          <p className="font-sans text-[11px] text-slate-300 leading-snug mb-2">
            {hoveredInfo.description}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
            <span>Safety Status:</span>
            <span className={`font-bold ${hoveredInfo.safetyStatus.includes('Risk') ? 'text-rose-400' : 'text-emerald-400'}`}>
              {hoveredInfo.safetyStatus}
            </span>
          </div>
        </div>
      )}

      {/* Floating User-Friendly Help Overlay */}
      {showHelpTooltip && (
        <div className="absolute top-14 right-3 z-30 p-4 rounded-xl bg-slate-950/95 backdrop-blur-md border border-cyan-500/50 text-white max-w-sm font-sans text-xs space-y-2 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between font-display font-bold text-cyan-300 border-b border-slate-800 pb-2">
            <span>HOW TO USE THIS 3D SIMULATOR</span>
            <button 
              onClick={() => setShowHelpTooltip(false)}
              className="text-slate-400 hover:text-white font-mono"
            >
              ✕
            </button>
          </div>
          <p className="text-slate-300 leading-relaxed">
            This digital twin represents your real car and road obstacles in live 3D space:
          </p>
          <ul className="space-y-1.5 text-slate-300 pl-4 list-disc">
            <li><strong>Hover over any object</strong> (the car, laser sensor, or obstacle) to inspect its distance, speed, and safety state.</li>
            <li><strong>Switch Camera Views</strong>: Choose <em>Chase</em>, <em>Cockpit</em>, <em>Drone</em>, or <em>Orbit 360°</em> (click & drag to rotate).</li>
            <li><strong>Laser Beam Color</strong>: Cyan = Safe clear road, Amber = Closing in, Red = Automatic brake deployed.</li>
          </ul>
        </div>
      )}

      {/* Bottom Floating Safety Controls Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-3 pointer-events-none z-10 font-mono text-xs">
        {/* Speedometer & Laser Distance Pill */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white shadow-lg">
            <span className="text-slate-400 text-[11px]">VEHICLE SPEED:</span>
            <strong className="text-cyan-400 font-bold text-sm tabular-nums">{speed} km/h</strong>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border shadow-lg ${
            lidarDistance < 2.0 ? 'border-rose-500/80 text-rose-300' : 'border-slate-700/80 text-white'
          }`}>
            <span className="text-slate-400 text-[11px]">OBSTACLE DISTANCE:</span>
            <strong className={`font-bold text-sm tabular-nums ${lidarDistance < 2.0 ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`}>
              {lidarDistance.toFixed(2)} meters
            </strong>
          </div>
        </div>

        {/* Live Safety Actuation Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {aebActive ? (
            <button
              onClick={releaseAEB}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>RELEASE BRAKES & RESUME</span>
            </button>
          ) : (
            <button
              onClick={triggerManualAEB}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(255,0,85,0.4)] hover:scale-105 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>TEST EMERGENCY BRAKE</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
