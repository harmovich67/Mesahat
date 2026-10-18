import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  X,
  Maximize2,
  Minimize2,
  Compass,
  Sun,
  Moon,
  Info,
  Navigation,
  CheckCircle,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { formatEGP } from '../../lib/utils';
import { useLanguageStore } from '../../store/languageStore';

export function SpaceVirtualTourModal({ isOpen, onClose, space, onBookNow }) {
  const containerRef = useRef(null);
  const { lang, t } = useLanguageStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightingMode, setLightingMode] = useState('day'); // 'day' | 'evening'
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [cameraMode, setCameraMode] = useState('walk'); // 'walk' | 'dollhouse' | 'table' | 'screen'

  // Three.js internal state ref
  const threeRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    animId: null,
    controls: {
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      isDragging: false,
      prevMouseX: 0,
      prevMouseY: 0,
      pitch: 0,
      yaw: 0,
    },
    lights: {},
    hotspots: [],
  });

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF5F2EB);
    scene.fog = new THREE.FogExp2(0xF5F2EB, 0.035);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 100);
    camera.position.set(0, 1.6, 4.2); // Eye level at 1.6m standing near entrance

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(6, 8, -4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 25;
    scene.add(sunLight);

    const ceilingPendant = new THREE.PointLight(0xffe8c2, 1.2, 10);
    ceilingPendant.position.set(0, 2.9, 0);
    ceilingPendant.castShadow = true;
    scene.add(ceilingPendant);

    // Save lighting ref for toggling
    threeRef.current.lights = { ambientLight, sunLight, ceilingPendant };

    // 5. Materials
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x9e7b57,
      roughness: 0.35,
      metalness: 0.05,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xF3EFE6,
      roughness: 0.85,
    });
    const woodTableMat = new THREE.MeshStandardMaterial({
      color: 0x472d1d,
      roughness: 0.25,
      metalness: 0.1,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.2,
      metalness: 0.8,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.9,
      opacity: 1,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
    });
    const screenMat = new THREE.MeshBasicMaterial({
      color: 0x1F4D3F,
    });
    const plantMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.6,
    });

    // 6. Architecture Construction (Room 9m x 7m x 3.2m)
    const roomWidth = 9;
    const roomLength = 7;
    const roomHeight = 3.2;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor baseboard accents
    const rugGeo = new THREE.PlaneGeometry(4.8, 3.2);
    const rugMat = new THREE.MeshStandardMaterial({ color: 0xded4c5, roughness: 0.95 });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, 0);
    rug.receiveShadow = true;
    scene.add(rug);

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    scene.add(ceiling);

    // Back Wall (Presentation wall)
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    backWall.position.set(0, roomHeight / 2, -roomLength / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    // Front Wall (Entrance door wall)
    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomHeight), wallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, roomHeight / 2, roomLength / 2);
    scene.add(frontWall);

    // Left Wall (Window wall overlooking skyline)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomLength, roomHeight), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-roomWidth / 2, roomHeight / 2, 0);
    scene.add(leftWall);

    // Glass Window Panel
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 5.2), metalMat);
    windowFrame.position.set(-roomWidth / 2 + 0.05, 1.6, 0);
    scene.add(windowFrame);

    const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(5, 2), glassMat);
    windowGlass.rotation.y = Math.PI / 2;
    windowGlass.position.set(-roomWidth / 2 + 0.06, 1.6, 0);
    scene.add(windowGlass);

    // Window Sky Backdrop (City skyline gradient)
    const skyGeo = new THREE.PlaneGeometry(16, 8);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 512;
    skyCanvas.height = 256;
    const sCtx = skyCanvas.getContext('2d');
    const grad = sCtx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#7097BD');
    grad.addColorStop(0.65, '#E5B98A');
    grad.addColorStop(1, '#B3C8D0');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 512, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyMesh = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: skyTex }));
    skyMesh.rotation.y = Math.PI / 2;
    skyMesh.position.set(-roomWidth / 2 - 2, 3, 0);
    scene.add(skyMesh);

    // Right Wall (Acoustic wood paneling & Whiteboard)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomLength, roomHeight), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(roomWidth / 2, roomHeight / 2, 0);
    scene.add(rightWall);

    // Acoustic Wood Slats decoration on right wall
    for (let i = -2.5; i <= 2.5; i += 0.2) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.8, 0.08), woodTableMat);
      slat.position.set(roomWidth / 2 - 0.03, 1.5, i);
      scene.add(slat);
    }

    // 7. Furniture
    // Central Executive Conference Table (3.2m x 1.4m x 0.76m)
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 1.4), woodTableMat);
    tableTop.position.set(0, 0.74, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    scene.add(tableTop);

    // Table Steel Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7), metalMat);
    legL.position.set(-1.2, 0.35, 0);
    legL.castShadow = true;
    scene.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7), metalMat);
    legR.position.set(1.2, 0.35, 0);
    legR.castShadow = true;
    scene.add(legR);

    // Table Base Spreader
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.6), metalMat);
    basePlate.position.set(0, 0.02, 0);
    scene.add(basePlate);

    // Ergonomic Chairs Around Table (6 chairs)
    const chairPositions = [
      { x: -1, z: 0.95, ry: 0 },
      { x: 0, z: 0.95, ry: 0 },
      { x: 1, z: 0.95, ry: 0 },
      { x: -1, z: -0.95, ry: Math.PI },
      { x: 0, z: -0.95, ry: Math.PI },
      { x: 1, z: -0.95, ry: Math.PI },
    ];

    const chairSeatGeo = new THREE.BoxGeometry(0.48, 0.06, 0.46);
    const chairBackGeo = new THREE.BoxGeometry(0.48, 0.52, 0.05);
    const chairPostGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45);
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x2A312E, roughness: 0.4 });

    chairPositions.forEach((pos) => {
      const chairGroup = new THREE.Group();

      const seat = new THREE.Mesh(chairSeatGeo, chairMat);
      seat.position.y = 0.45;
      seat.castShadow = true;
      chairGroup.add(seat);

      const back = new THREE.Mesh(chairBackGeo, chairMat);
      back.position.set(0, 0.72, pos.ry === 0 ? 0.21 : -0.21);
      back.castShadow = true;
      chairGroup.add(back);

      const post = new THREE.Mesh(chairPostGeo, metalMat);
      post.position.y = 0.22;
      chairGroup.add(post);

      chairGroup.position.set(pos.x, 0, pos.z);
      chairGroup.rotation.y = pos.ry;
      scene.add(chairGroup);
    });

    // 8. 4K Wall Presentation Screen
    const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 0.06), metalMat);
    tvFrame.position.set(0, 1.85, -roomLength / 2 + 0.04);
    tvFrame.castShadow = true;
    scene.add(tvFrame);

    // Canvas Texture on Screen showing WORKORA
    const tvCanvas = document.createElement('canvas');
    tvCanvas.width = 1024;
    tvCanvas.height = 576;
    const tvCtx = tvCanvas.getContext('2d');
    tvCtx.fillStyle = '#16382E';
    tvCtx.fillRect(0, 0, 1024, 576);
    // Header pattern
    tvCtx.fillStyle = '#C9803A';
    tvCtx.fillRect(0, 0, 1024, 16);
    // Workora text
    tvCtx.fillStyle = '#FFFFFF';
    tvCtx.font = 'bold 54px sans-serif';
    tvCtx.textAlign = 'center';
    tvCtx.fillText('WORKORA · ووركورا', 512, 220);
    tvCtx.font = '32px sans-serif';
    tvCtx.fillStyle = '#D6CEBE';
    tvCtx.fillText(space?.name?.ar || 'قاعة الاجتماعات الفاخرة', 512, 290);
    tvCtx.font = '24px sans-serif';
    tvCtx.fillStyle = '#C9803A';
    tvCtx.fillText('مساحتك للعمل. بطريقتك. · Your space. Your way.', 512, 360);
    // Status dot
    tvCtx.fillStyle = '#10B981';
    tvCtx.beginPath();
    tvCtx.arc(512, 440, 10, 0, Math.PI * 2);
    tvCtx.fill();
    tvCtx.fillStyle = '#FFFFFF';
    tvCtx.font = '20px sans-serif';
    tvCtx.fillText('متاحة للحجز الفوري', 512, 480);

    const tvTex = new THREE.CanvasTexture(tvCanvas);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.4), new THREE.MeshBasicMaterial({ map: tvTex }));
    tvScreen.position.set(0, 1.85, -roomLength / 2 + 0.08);
    scene.add(tvScreen);

    // 9. Glass Magnetic Whiteboard (on Left back corner)
    const wbFrame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.04), metalMat);
    wbFrame.position.set(2.8, 1.75, -roomLength / 2 + 0.03);
    scene.add(wbFrame);

    const wbBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 1.14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 }));
    wbBoard.position.set(2.8, 1.75, -roomLength / 2 + 0.06);
    scene.add(wbBoard);

    // 10. Plants & Decor
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.6, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    pot.position.set(-3.5, 0.3, -2.6);
    pot.castShadow = true;
    scene.add(pot);

    const plantLeaves = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), plantMat);
    plantLeaves.position.set(-3.5, 0.8, -2.6);
    plantLeaves.scale.set(1, 1.3, 1);
    plantLeaves.castShadow = true;
    scene.add(plantLeaves);

    // Pendant Ceiling Light above Table
    const pendantBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.06), metalMat);
    pendantBar.position.set(0, 2.5, 0);
    scene.add(pendantBar);

    const pendantWire1 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.7), metalMat);
    pendantWire1.position.set(-0.9, 2.85, 0);
    scene.add(pendantWire1);

    const pendantWire2 = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.7), metalMat);
    pendantWire2.position.set(0.9, 2.85, 0);
    scene.add(pendantWire2);

    // Table accessories (laptop, water bottles, notepads)
    const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.015, 0.22), metalMat);
    laptopBase.position.set(0, 0.79, 0.3);
    scene.add(laptopBase);

    const laptopScreen = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.015), metalMat);
    laptopScreen.position.set(0, 0.89, 0.19);
    laptopScreen.rotation.x = -0.3;
    scene.add(laptopScreen);

    // 11. Interactive Hotspots (3D floating icons)
    const hotspotsData = [
      {
        id: 'screen',
        title: { ar: 'شاشة ذكية 4K مدمجة', en: '4K Smart Presentation Screen' },
        desc: { ar: 'تدعم AirPlay وMiracast لعرض شاشة الكمبيوتر والهاتف بلمسة واحدة دون كابلات.', en: 'Wireless streaming via AirPlay & Miracast.' },
        position: new THREE.Vector3(0, 1.85, -roomLength / 2 + 0.3),
      },
      {
        id: 'table',
        title: { ar: 'طاولة اجتماعات من خشب البلوط', en: 'Handcrafted Oak Meeting Table' },
        desc: { ar: 'مجهزة بمقابس كهرباء ومنافذ شحن USB-C سريعة مدمجة مخفية لكل مقعد.', en: 'Hidden power and high-speed USB-C ports per seat.' },
        position: new THREE.Vector3(0, 0.95, 0),
      },
      {
        id: 'whiteboard',
        title: { ar: 'لوح أبيض زجاجي مغناطيسي', en: 'Glass Magnetic Whiteboard' },
        desc: { ar: 'لوح كتابة واسع مع أقلام ملونة وممحاة مجهزة لجلسات العصف الذهني.', en: 'High-contrast glass surface for team brainstorms.' },
        position: new THREE.Vector3(2.8, 1.75, -roomLength / 2 + 0.3),
      },
      {
        id: 'window',
        title: { ar: 'إطلالة بانورامية وإضاءة طبيعية', en: 'Panoramic Daylight View' },
        desc: { ar: 'نوافذ زجاجية عازلة للصوت والحرارة تسمح بمرور أشعة الشمس المريحة.', en: 'Acoustic glass panels ensuring total focus and comfort.' },
        position: new THREE.Vector3(-roomWidth / 2 + 0.4, 1.8, 0),
      },
    ];

    const hotspotMeshes = [];
    hotspotsData.forEach((hs) => {
      const pinGroup = new THREE.Group();

      const innerSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xC9803A })
      );
      pinGroup.add(innerSphere);

      const outerRing = new THREE.Mesh(
        new THREE.RingGeometry(0.12, 0.16, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      pinGroup.add(outerRing);

      pinGroup.position.copy(hs.position);
      pinGroup.userData = hs;
      scene.add(pinGroup);
      hotspotMeshes.push(pinGroup);
    });

    threeRef.current.hotspots = hotspotMeshes;
    threeRef.current.scene = scene;
    threeRef.current.camera = camera;
    threeRef.current.renderer = renderer;

    // 12. Controls and Mouse Look Interaction
    const controls = threeRef.current.controls;

    const onMouseDown = (e) => {
      controls.isDragging = true;
      controls.prevMouseX = e.clientX;
      controls.prevMouseY = e.clientY;
    };

    const onMouseMove = (e) => {
      if (!controls.isDragging) return;
      const dx = e.clientX - controls.prevMouseX;
      const dy = e.clientY - controls.prevMouseY;

      controls.yaw -= dx * 0.0035;
      controls.pitch -= dy * 0.0035;
      // Clamp vertical pitch between -80 deg and +80 deg
      controls.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, controls.pitch));

      controls.prevMouseX = e.clientX;
      controls.prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      controls.isDragging = false;
    };

    // Touch controls for mobile walkthrough
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        controls.isDragging = true;
        controls.prevMouseX = e.touches[0].clientX;
        controls.prevMouseY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e) => {
      if (!controls.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - controls.prevMouseX;
      const dy = e.touches[0].clientY - controls.prevMouseY;

      controls.yaw -= dx * 0.005;
      controls.pitch -= dy * 0.005;
      controls.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, controls.pitch));

      controls.prevMouseX = e.touches[0].clientX;
      controls.prevMouseY = e.touches[0].clientY;
    };

    const onTouchEnd = () => {
      controls.isDragging = false;
    };

    // Keyboard WASD / Arrows
    const onKeyDown = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          controls.moveForward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controls.moveBackward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controls.moveLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controls.moveRight = true;
          break;
      }
    };

    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          controls.moveForward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          controls.moveBackward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          controls.moveLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          controls.moveRight = false;
          break;
      }
    };

    // Raycast on hotspot click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / container.clientWidth) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / container.clientHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(hotspotMeshes, true);
      if (intersects.length > 0) {
        let root = intersects[0].object;
        while (root.parent && !root.userData?.id) {
          root = root.parent;
        }
        if (root.userData?.id) {
          setActiveHotspot(root.userData);
        }
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    container.addEventListener('touchstart', onTouchStart);
    container.addEventListener('touchmove', onTouchMove);
    container.addEventListener('touchend', onTouchEnd);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    container.addEventListener('click', onClick);

    // 13. Render Loop
    let clock = new THREE.Clock();

    const animate = () => {
      threeRef.current.animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Pulse and rotate hotspots
      hotspotMeshes.forEach((hs, idx) => {
        hs.rotation.y = elapsed * 1.5 + idx;
        const scale = 1 + Math.sin(elapsed * 4 + idx) * 0.12;
        hs.scale.set(scale, scale, scale);
      });

      // Update camera orientation from yaw/pitch
      const euler = new THREE.Euler(0, 0, 0, 'YXZ');
      euler.x = controls.pitch;
      euler.y = controls.yaw;
      camera.quaternion.setFromEuler(euler);

      // Walk movement in walk mode
      const speed = 3.2 * delta;
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, controls.yaw, 0));
      const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, controls.yaw, 0));

      if (controls.moveForward) camera.position.addScaledVector(forward, speed);
      if (controls.moveBackward) camera.position.addScaledVector(forward, -speed);
      if (controls.moveRight) camera.position.addScaledVector(right, speed);
      if (controls.moveLeft) camera.position.addScaledVector(right, -speed);

      // Wall boundaries (stay inside room bounds)
      const boundX = roomWidth / 2 - 0.4;
      const boundZ = roomLength / 2 - 0.4;
      camera.position.x = Math.max(-boundX, Math.min(boundX, camera.position.x));
      camera.position.z = Math.max(-boundZ, Math.min(boundZ, camera.position.z));
      if (cameraMode === 'walk') {
        camera.position.y = 1.6; // Maintain standing height
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(threeRef.current.animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('click', onClick);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [isOpen, space, cameraMode]);

  // Handle lighting toggle
  const toggleLighting = () => {
    const next = lightingMode === 'day' ? 'evening' : 'day';
    setLightingMode(next);
    const { lights, scene } = threeRef.current;
    if (!lights || !scene) return;

    if (next === 'evening') {
      scene.background.set(0x1F2421);
      lights.ambientLight.color.set(0xFFB067);
      lights.ambientLight.intensity = 0.55;
      lights.sunLight.intensity = 0.2;
      lights.ceilingPendant.intensity = 1.9;
      lights.ceilingPendant.color.set(0xFFB067);
    } else {
      scene.background.set(0xF5F2EB);
      lights.ambientLight.color.set(0xfff7ed);
      lights.ambientLight.intensity = 0.7;
      lights.sunLight.intensity = 1.4;
      lights.ceilingPendant.intensity = 1.2;
      lights.ceilingPendant.color.set(0xffe8c2);
    }
  };

  // Switch camera presets
  const setPreset = (preset) => {
    setCameraMode(preset);
    const { camera, controls } = threeRef.current;
    if (!camera) return;

    if (preset === 'walk') {
      camera.position.set(0, 1.6, 3.2);
      controls.pitch = 0;
      controls.yaw = 0;
    } else if (preset === 'table') {
      camera.position.set(0, 1.3, 1.6);
      controls.pitch = -0.15;
      controls.yaw = 0;
    } else if (preset === 'screen') {
      camera.position.set(0, 1.6, -1.8);
      controls.pitch = 0.05;
      controls.yaw = 0;
    } else if (preset === 'dollhouse') {
      // Top down 3D cutaway perspective
      camera.position.set(0, 5.8, 5.2);
      controls.pitch = -0.78;
      controls.yaw = 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 backdrop-blur-md p-2 sm:p-6 overflow-hidden">
      {/* 3D Container Window */}
      <div
        className={`relative w-full bg-stone-900 rounded-3xl shadow-2xl border border-stone-800 overflow-hidden flex flex-col transition-all duration-300 ${
          isFullscreen ? 'h-full w-full rounded-none' : 'h-[92vh] max-w-7xl'
        }`}
      >
        {/* Top Floating Glass Bar */}
        <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between pointer-events-none">
          {/* Room Title & Badge */}
          <div className="pointer-events-auto flex items-center gap-3 bg-stone-900/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white shadow-xl">
            <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#C9803A] text-white">
              <Sparkles className="w-4.5 h-4.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-stone-100">
                  {space?.name ? t(space.name) : 'جولة افتراضية ثلاثية الأبعاد'}
                </h3>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  3D LIVE
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                {space?.capacity ? `${space.capacity} ${lang === 'ar' ? 'أفراد' : 'Guests'}` : ''} · {space?.location ? t(space.location.name) : ''}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Lighting Mode Toggle */}
            <button
              type="button"
              onClick={toggleLighting}
              className="p-2.5 rounded-xl bg-stone-900/80 backdrop-blur-md border border-white/10 text-stone-300 hover:text-white hover:bg-stone-800 transition shadow-lg"
              title={lang === 'ar' ? 'تبديل الإضاءة (نهار / مساء دافئ)' : 'Toggle Lighting Mode'}
            >
              {lightingMode === 'day' ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-amber-300" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 rounded-xl bg-stone-900/80 backdrop-blur-md border border-white/10 text-stone-300 hover:text-white hover:bg-stone-800 transition shadow-lg hidden sm:block"
            >
              {isFullscreen ? <Minimize2 className="w-4.5 h-4.5" /> : <Maximize2 className="w-4.5 h-4.5" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-rose-900/60 backdrop-blur-md border border-rose-500/30 text-rose-200 hover:bg-rose-800 transition shadow-lg"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* 3D WebGL Canvas Viewport */}
        <div
          ref={containerRef}
          className="relative w-full flex-1 cursor-grab active:cursor-grabbing select-none"
        />

        {/* Floating Hotspot Detail Modal / Popover */}
        {activeHotspot && (
          <div className="absolute top-20 start-6 z-30 max-w-sm bg-stone-900/95 backdrop-blur-xl border border-white/15 p-4.5 rounded-2xl text-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C9803A] animate-ping" />
                <h4 className="font-bold text-sm text-[#C9803A]">
                  {t(activeHotspot.title)}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveHotspot(null)}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed mb-3">
              {t(activeHotspot.desc)}
            </p>
            <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-[11px] text-stone-400">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'مشمول في الحجز' : 'Included in booking'}
              </span>
              <button
                type="button"
                onClick={() => setActiveHotspot(null)}
                className="text-[#C9803A] hover:underline"
              >
                {lang === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        )}

        {/* Bottom Floating Control Bar */}
        <div className="absolute bottom-4 inset-x-4 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-none">
          {/* Camera Viewpoint Switcher */}
          <div className="pointer-events-auto flex items-center gap-1.5 bg-stone-900/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setPreset('walk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                cameraMode === 'walk' ? 'bg-[#1F4D3F] text-white shadow' : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Navigation className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'تجول حر' : 'Walk'}
            </button>
            <button
              type="button"
              onClick={() => setPreset('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                cameraMode === 'table' ? 'bg-[#1F4D3F] text-white shadow' : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'طاولة الاجتماع' : 'Table View'}
            </button>
            <button
              type="button"
              onClick={() => setPreset('screen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                cameraMode === 'screen' ? 'bg-[#1F4D3F] text-white shadow' : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'شاشة العرض' : 'Screen View'}
            </button>
            <button
              type="button"
              onClick={() => setPreset('dollhouse')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                cameraMode === 'dollhouse' ? 'bg-[#1F4D3F] text-white shadow' : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {lang === 'ar' ? 'مخطط ثلاثي الأبعاد' : '3D Floorplan'}
            </button>
          </div>

          {/* Controls Instruction Helper & Book CTA */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-2 bg-stone-900/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-stone-300 text-xs shadow-xl">
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px] border border-white/10">W</span>
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px] border border-white/10">A</span>
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px] border border-white/10">S</span>
              <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono text-[10px] border border-white/10">D</span>
              <span className="text-stone-400 ms-1">
                {lang === 'ar' ? 'للتحرك + اسحب بالماوس للنظر' : 'to move + Drag to look'}
              </span>
            </div>

            {onBookNow && (
              <Button
                variant="accent"
                size="md"
                onClick={() => {
                  onClose();
                  onBookNow();
                }}
                className="shadow-xl font-bold"
              >
                {lang === 'ar' ? 'احجز هذه المساحة الآن' : 'Book Space Now'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
