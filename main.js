import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const canvas = document.querySelector('#scene');
const loadingScreen = document.querySelector('#loading-screen');
const startScreen = document.querySelector('#start-screen');
const endScreen = document.querySelector('#end-screen');
const startButton = document.querySelector('#start-button');
const restartButton = document.querySelector('#restart-button');
const pauseButton = document.querySelector('#pause-button');
const pauseScreen = document.querySelector('#pause-screen');
const ELEMENT_COUNTER = { fire: 'water', water: 'electric', electric: 'fire' };
const gateLabels = {
  fire: { color: 0xff5a36, hex: '#ff5a36', label: 'FIRE', glyph: '✦', name: 'FIREKIN' },
  water: { color: 0x2e9bff, hex: '#2e9bff', label: 'WATER', glyph: '≈', name: 'TIDEBORN' },
  electric: { color: 0xfcee0a, hex: '#fcee0a', label: 'ELECTRIC', glyph: 'ϟ', name: 'STORMKIN' },
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14052e);
scene.fog = new THREE.FogExp2(0x1c0a36, 0.0105);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 440);
camera.position.set(0, 8.8, 13.3);
const clock = new THREE.Clock();

const hemiLight = new THREE.HemisphereLight(0x6a5bff, 0x1a0630, .6);
scene.add(hemiLight);
const keyLight = new THREE.DirectionalLight(0xb88cff, 1.4);
keyLight.position.set(-8, 18, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -22;
keyLight.shadow.camera.right = 22;
keyLight.shadow.camera.top = 26;
keyLight.shadow.camera.bottom = -20;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 58;
keyLight.shadow.bias = -0.00045;
keyLight.shadow.normalBias = 0.035;
scene.add(keyLight);
scene.add(keyLight.target);
const magentaFill = new THREE.PointLight(0xff2bd6, 28, 24, 2);
magentaFill.position.set(-4, 4, 2);
scene.add(magentaFill);
const cyanFill = new THREE.PointLight(0x00f0ff, 32, 30, 2);
cyanFill.position.set(5, 5, -14);
scene.add(cyanFill);

// Bloom makes every emissive surface above the threshold glow like a neon tube.
let composer = null;
try {
  const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .56, .45, .7));
  composer.addPass(new OutputPass());
} catch (error) {
  console.warn('Bloom disabled, falling back to direct rendering.', error);
  composer = null;
}

const world = new THREE.Group();
scene.add(world);
const roadWidth = 11.5;
const FINAL_BOSS_Z = -258;
const SECOND_WAVE_Z = -157;
const roadLength = 300;
const roadMid = -138;
const trackObjects = [];
const gateTargets = [];
const gateRecords = [];
const obstacles = [];
const activeFx = [];
const troopRoot = new THREE.Group();
const vfxRoot = new THREE.Group();
world.add(troopRoot, vfxRoot);

const game = {
  phase: 'menu',
  pausedFrom: null,
  playerZ: 2.4,
  playerX: 0,
  targetX: 0,
  count: 12,
  element: 'fire',
  power: 0,
  waterShields: 0,
  speed: 7.25,
  elapsed: 0,
  selectedGate: null,
  hoveredGate: null,
  routeStep: 1,
  encounter: null,
  modelReady: false,
  modelTemplate: null,
  visualUnits: [],
  enemyUnits: [],
  enemyRoot: new THREE.Group(),
  enemyBoss: null,
  particleSystem: null,
  electricVfx: null,
  electricRefresh: 0,
  feedbackTimer: 0,
  clockTime: 0,
  cameraShake: 0,
  damageFlash: 0,
  previousZ: 2.4,
  defeatedWave: false,
  defeatedSecondWave: false,
  defeatedBoss: false,
};
world.add(game.enemyRoot);
game.enemyRoot.visible = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dummy = new THREE.Object3D();
const unitCountHud = document.querySelector('#unit-count');
const elementNameHud = document.querySelector('#element-name');
const elementAbilityHud = document.querySelector('#element-ability');
const elementEmblem = document.querySelector('#element-emblem');
const elementGlyph = document.querySelector('#element-glyph');
const progressFill = document.querySelector('#progress-fill');
const progressDot = document.querySelector('#progress-dot');
const progressPercent = document.querySelector('#progress-percent');
const routeStep = document.querySelector('#route-step');
const stageLabel = document.querySelector('#stage-label');
const feedbackEl = document.querySelector('#feedback');
const battleBanner = document.querySelector('#battle-banner');
const battleKicker = document.querySelector('#battle-kicker');
const battleTitle = document.querySelector('#battle-title');
const battleSubtitle = document.querySelector('#battle-subtitle');
const enemyHealth = document.querySelector('#enemy-health');
const impactFlash = document.querySelector('#impact-flash');

function addMesh(parent, geometry, material, position, scale, cast = true, receive = true) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function createGlowTexture() {
  const size = 64;
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = size;
  const context = glowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.16, 'rgba(255,255,255,.86)');
  gradient.addColorStop(.42, 'rgba(255,255,255,.3)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(glowCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const glowTexture = createGlowTexture();

// Canvas textures that contain text are repainted once the web fonts have loaded.
const redrawables = [];
function makeCanvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const paint = () => {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
    ctx.restore();
    texture.needsUpdate = true;
  };
  paint();
  redrawables.push(paint);
  return texture;
}
if (document.fonts) {
  const repaint = () => redrawables.forEach((paint) => paint());
  Promise.all([document.fonts.load('900 48px Orbitron'), document.fonts.load('700 24px "Chakra Petch"')]).then(repaint, repaint);
  document.fonts.ready.then(repaint);
}

function createRiftTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const wash = ctx.createLinearGradient(0, 0, 128, 0);
  wash.addColorStop(0, 'rgba(255,43,214,.02)');
  wash.addColorStop(.5, 'rgba(0,240,255,.72)');
  wash.addColorStop(1, 'rgba(255,43,214,.02)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 128, 256);
  for (let y = -8; y < 270; y += 17) {
    ctx.beginPath();
    ctx.moveTo(5, y);
    for (let x = 0; x <= 128; x += 8) ctx.lineTo(x, y + Math.sin(x * .1 + y * .045) * 5);
    ctx.strokeStyle = `rgba(220,200,255,${.1 + Math.random() * .22})`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
const riftTexture = createRiftTexture();

// ===== Cyberpunk city ======================================================
const NEON = { cyan: 0x00f0ff, pink: 0xff2bd6, yellow: 0xfcee0a, violet: 0x8a3dff, red: 0xff2a52, orange: 0xff5a36 };
const hdr = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

let rngState = 91237;
function random() {
  rngState = (rngState * 16807) % 2147483647;
  return (rngState - 1) / 2147483646;
}

const cityAnim = { signs: [], cars: null, rain: null };
const cityDummy = new THREE.Object3D();
const cityColor = new THREE.Color();

const signDefs = [
  { text: 'ネオン', sub: 'NEON DISTRICT', css: '#ff2bd6', hex: NEON.pink, vertical: true },
  { text: 'RAMEN', sub: '24H', css: '#00f0ff', hex: NEON.cyan, vertical: true },
  { text: 'CYBERWARE', sub: 'IMPLANTS // INSTALL TODAY', css: '#fcee0a', hex: NEON.yellow, vertical: false },
  { text: '電脳街', sub: 'DATA ALLEY', css: '#8a3dff', hex: NEON.violet, vertical: true },
  { text: 'HYPERNET', sub: 'UPLINK ONLINE', css: '#00f0ff', hex: NEON.cyan, vertical: false },
  { text: 'SYNTH BAR', sub: 'OPEN ALL NIGHT', css: '#ff2bd6', hex: NEON.pink, vertical: false },
  { text: 'NOODLE', sub: 'HOT // FAST', css: '#ff5a36', hex: NEON.orange, vertical: true },
  { text: '未来', sub: 'FUTURE CORP', css: '#fcee0a', hex: NEON.yellow, vertical: true },
];

function makeNeonSignTexture(def) {
  const W = def.vertical ? 256 : 512;
  const H = def.vertical ? 640 : 256;
  const family = 'Orbitron, "Noto Sans JP", "Yu Gothic", "Hiragino Sans", Meiryo, sans-serif';
  return makeCanvasTexture(W, H, (ctx) => {
    ctx.fillStyle = 'rgba(6, 2, 20, .88)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, .035)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.shadowColor = def.css; ctx.shadowBlur = 20; ctx.strokeStyle = def.css; ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.shadowBlur = 0; ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255, 255, 255, .3)';
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = def.css; ctx.shadowBlur = 26; ctx.fillStyle = '#ffffff';
    if (def.vertical) {
      const chars = [...def.text];
      const step = (H - 170) / chars.length;
      ctx.font = `900 ${Math.min(W * .46, step * .86)}px ${family}`;
      chars.forEach((ch, i) => ctx.fillText(ch, W / 2, 70 + step * (i + .5)));
      ctx.shadowBlur = 10; ctx.fillStyle = def.css; ctx.font = '700 22px "Chakra Petch", sans-serif';
      ctx.fillText(def.sub, W / 2, H - 56);
    } else {
      let size = 92;
      ctx.font = `900 ${size}px ${family}`;
      while (ctx.measureText(def.text).width > W - 80 && size > 28) { size -= 4; ctx.font = `900 ${size}px ${family}`; }
      ctx.fillText(def.text, W / 2, H * .43);
      ctx.shadowBlur = 10; ctx.fillStyle = def.css; ctx.font = '700 24px "Chakra Petch", sans-serif';
      ctx.fillText(def.sub, W / 2, H - 52);
    }
  });
}

function createSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04010c');
  g.addColorStop(.22, '#14052e');
  g.addColorStop(.5, '#2a0a46');
  g.addColorStop(1, '#4a0f5e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Small studio of coloured light panels baked into an environment map so every
// metallic surface (road, gates, units) picks up pink / cyan neon reflections.
let neonEnvTexture = null;
function buildNeonEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x06020f);
  const panel = (hex, k, w, h, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hdr(hex, k), side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    envScene.add(mesh);
  };
  panel(NEON.pink, 5, 16, 9, -14, 7, -4);
  panel(NEON.cyan, 5, 16, 9, 14, 7, -8);
  panel(NEON.violet, 2.4, 26, 8, 0, 16, -2);
  panel(NEON.yellow, 2.2, 8, 3, 0, 5, 16);
  panel(NEON.pink, 3, 12, 4, 0, 4, -18);
  neonEnvTexture = pmrem.fromScene(envScene, .035).texture;
  scene.environment = neonEnvTexture;
  scene.environmentIntensity = .55;
  pmrem.dispose();
}

function buildGroundAndRoad() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 600),
    new THREE.MeshStandardMaterial({ color: 0x090618, roughness: .8, metalness: .35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -.48, -138);
  floor.receiveShadow = true;
  world.add(floor);

  // Wet asphalt: low roughness so the neon point lights leave long highlights on it.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x0f0c1f, roughness: .34, metalness: .55 });
  addMesh(world, new THREE.BoxGeometry(roadWidth, .38, roadLength), roadMat, [0, -.22, roadMid], null, false, true);

  const walkMat = new THREE.MeshStandardMaterial({ color: 0x17112e, roughness: .55, metalness: .45 });
  const walkGeo = new THREE.BoxGeometry(5.4, .36, roadLength);
  addMesh(world, walkGeo, walkMat, [-roadWidth / 2 - 2.7, -.08, roadMid], null, false, true);
  addMesh(world, walkGeo, walkMat, [roadWidth / 2 + 2.7, -.08, roadMid], null, false, true);

  // Curb neon: magenta on the left, cyan on the right.
  const edgeGeo = new THREE.BoxGeometry(.1, .05, roadLength);
  addMesh(world, edgeGeo, new THREE.MeshBasicMaterial({ color: hdr(NEON.pink, 2.4), toneMapped: false }), [-roadWidth / 2, -.02, roadMid], null, false, false);
  addMesh(world, edgeGeo, new THREE.MeshBasicMaterial({ color: hdr(NEON.cyan, 2.4), toneMapped: false }), [roadWidth / 2, -.02, roadMid], null, false, false);

  const seamGeo = new THREE.BoxGeometry(.05, .02, roadLength - 2);
  const seamMat = new THREE.MeshBasicMaterial({ color: hdr(NEON.violet, 1.6), toneMapped: false });
  addMesh(world, seamGeo, seamMat, [-roadWidth / 2 + .45, -.012, roadMid], null, false, false);
  addMesh(world, seamGeo, seamMat, [roadWidth / 2 - .45, -.012, roadMid], null, false, false);

  // Lane dividers sit between the three lanes (x = -2.45, 0, 2.45).
  const dashGeo = new THREE.BoxGeometry(.07, .02, 1.2);
  const dashMat = new THREE.MeshBasicMaterial({ color: hdr(NEON.cyan, 1.5), toneMapped: false });
  for (let z = 7; z > -292; z -= 3.4) {
    for (const x of [-1.225, 1.225]) addMesh(world, dashGeo, dashMat, [x, -.012, z], null, false, false);
  }


}

function placeBladeSign(def, spec, faceX, normalSign) {
  const sw = def.vertical ? 1.5 : 3.8;
  const sh = def.vertical ? 4.8 : 1.9;
  const y = 4 + random() * Math.max(1, Math.min(8, spec.h - sh - 7));
  const x = faceX + normalSign * (sw / 2 + .05);
  const z = spec.z + (random() - .5) * spec.d * .5;
  const mat = new THREE.MeshBasicMaterial({ map: def.texture, transparent: true, side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color().setScalar(1.7) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
  sign.position.set(x, y, z);
  const haloMat = new THREE.MeshBasicMaterial({ map: glowTexture, color: hdr(def.hex, 1.3), transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.9, sh * 1.55), haloMat);
  halo.position.set(x, y, z - .05);
  world.add(sign, halo);
  cityAnim.signs.push({ mat, halo: haloMat, base: 1.7, phase: random() * 6, flicker: random() < .3 });
}

function buildCity() {
  const bodyPalette = [0x14102c, 0x0f1534, 0x1d1038, 0x0c1f33, 0x180d2e].map((hex) => new THREE.Color(hex));
  const themes = [NEON.cyan, NEON.pink, NEON.yellow, NEON.violet, NEON.cyan, NEON.pink];
  const accents = [NEON.cyan, NEON.pink, NEON.yellow, NEON.violet, NEON.orange];
  signDefs.forEach((def) => { def.texture = makeNeonSignTexture(def); });

  const specs = [];
  for (const side of [-1, 1]) {
    // Near row: street-level towers hugging the sidewalk.
    let z = 26;
    while (z > -278) {
      const d = 5 + random() * 4, w = 6 + random() * 5, h = 12 + random() * 26;
      specs.push({ side, row: 0, x: side * (12.4 + w / 2), z: z - d / 2, w, d, h });
      z -= d + .5 + random() * 1.6;
    }
    // Far row: mega-towers that fill the skyline behind.
    z = 30;
    while (z > -286) {
      const d = 8 + random() * 6, w = 9 + random() * 8, h = 32 + random() * 46;
      specs.push({ side, row: 1, x: side * (25 + random() * 3 + w / 2), z: z - d / 2, w, d, h });
      z -= d + random() * 3;
    }
  }

  const WINDOW_CAP = 18000, STRIP_CAP = 700;
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: .65 }), specs.length);
  const windows = new THREE.InstancedMesh(new THREE.PlaneGeometry(.46, .64), new THREE.MeshBasicMaterial({ toneMapped: false }), WINDOW_CAP);
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), STRIP_CAP);
  let wi = 0, si = 0, signIndex = 0;

  const pushWindow = (x, y, z, rotY, hex) => {
    if (wi >= WINDOW_CAP) return;
    cityDummy.position.set(x, y, z);
    cityDummy.rotation.set(0, rotY, 0);
    cityDummy.scale.set(1, 1, 1);
    cityDummy.updateMatrix();
    windows.setMatrixAt(wi, cityDummy.matrix);
    windows.setColorAt(wi, cityColor.setHex(hex).multiplyScalar(1.3 + random() * 1.4));
    wi++;
  };
  const pushStrip = (x, y, z, sx, sy, sz, hex, k) => {
    if (si >= STRIP_CAP) return;
    cityDummy.position.set(x, y, z);
    cityDummy.rotation.set(0, 0, 0);
    cityDummy.scale.set(sx, sy, sz);
    cityDummy.updateMatrix();
    strips.setMatrixAt(si, cityDummy.matrix);
    strips.setColorAt(si, cityColor.setHex(hex).multiplyScalar(k));
    si++;
  };

  specs.forEach((s, i) => {
    cityDummy.position.set(s.x, s.h / 2 - .5, s.z);
    cityDummy.rotation.set(0, 0, 0);
    cityDummy.scale.set(s.w, s.h, s.d);
    cityDummy.updateMatrix();
    bodies.setMatrixAt(i, cityDummy.matrix);
    bodies.setColorAt(i, bodyPalette[Math.floor(random() * bodyPalette.length)]);

    const theme = themes[Math.floor(random() * themes.length)];
    const accent = accents[Math.floor(random() * accents.length)];
    const faceX = s.x - s.side * s.w / 2;   // wall that faces the road
    const normalSign = -s.side;             // +1 for left-hand buildings, -1 for right-hand ones

    const cols = Math.max(2, Math.floor((s.d - .9) / .95));
    const rows = Math.max(3, Math.floor((s.h - 2) / 1.35));
    for (let r = 0; r < rows; r++) {
      const darkFloor = random() < .2;
      for (let c = 0; c < cols; c++) {
        if (random() < (darkFloor ? .85 : .3)) continue;
        const hex = random() < .72 ? theme : accents[Math.floor(random() * accents.length)];
        pushWindow(faceX + normalSign * .03, .7 + r * 1.35, s.z - (cols - 1) * .475 + c * .95, normalSign * Math.PI / 2, hex);
      }
    }
    if (s.row === 0) {
      const frontCols = Math.max(2, Math.floor((s.w - .9) / .95));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < frontCols; c++) {
          if (random() < .35) continue;
          const hex = random() < .72 ? theme : accent;
          pushWindow(s.x - (frontCols - 1) * .475 + c * .95, .7 + r * 1.35, s.z + s.d / 2 + .03, 0, hex);
        }
      }
    }

    pushStrip(faceX + normalSign * .07, s.h / 2 - .5, s.z + s.d / 2 - .06, .14, s.h, .14, theme, 2.4);
    pushStrip(faceX + normalSign * .07, s.h - .5, s.z, .16, .16, s.d, theme, 2.0);
    if (random() < .55) pushStrip(faceX + normalSign * .06, 4 + random() * 12, s.z, .1, .1, s.d, accent, 1.8);
    if (s.h > 40 && random() < .7) pushStrip(s.x, s.h + .2, s.z, .35, .35, .35, NEON.red, 3.2);

    if (s.row === 0 && s.h > 14 && random() < .5) {
      placeBladeSign(signDefs[signIndex++ % signDefs.length], s, faceX, normalSign);
    }
  });

  windows.count = wi;
  strips.count = si;
  for (const mesh of [bodies, windows, strips]) mesh.frustumCulled = false;
  world.add(bodies, windows, strips);
}

function buildStreetLights() {
  const zs = [];
  for (let z = 4; z > -280; z -= 12) zs.push(z);
  const n = zs.length * 2;
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a1432, roughness: .4, metalness: .85 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .11, 7.6, 8), metal, n);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, .1, .1), metal, n);
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, .12, .34), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), n);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .045, side: THREE.DoubleSide, blending: THREE.NormalBlending, depthWrite: false, toneMapped: true });
  const beams = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 7.2, 32, 1, true), beamMat, n);
  let k = 0;
  zs.forEach((z, zi) => {
    for (const side of [-1, 1]) {
      const hex = (zi + (side < 0 ? 0 : 1)) % 2 === 0 ? NEON.cyan : NEON.pink;
      const col = hdr(hex, 1.55);
      const px = side * 6.7;
      const place = (mesh, x, y, zz, rx = 0, sx = 1, sy = 1) => {
        cityDummy.position.set(x, y, zz);
        cityDummy.rotation.set(rx, 0, 0);
        cityDummy.scale.set(sx, sy, 1);
        cityDummy.updateMatrix();
        mesh.setMatrixAt(k, cityDummy.matrix);
      };
      place(poles, px, 3.9, z);
      place(arms, px - side * 1.1, 7.55, z);
      place(heads, px - side * 2.1, 7.45, z);
      place(beams, px - side * 2.1, 3.85, z);
      place(pools, px - side * 3.0, .04, z, -Math.PI / 2, 7, 9);
      heads.setColorAt(k, col);
      beams.setColorAt(k, cityColor.copy(col).multiplyScalar(.14));
      pools.setColorAt(k, cityColor.copy(col).multiplyScalar(.22));
      k++;
    }
  });
  for (const mesh of [poles, arms, heads, pools, beams]) { mesh.frustumCulled = false; world.add(mesh); }

}

// A huge neon ring at the end of the road: the Rift itself.
function buildRiftMegastructure() {
  const rift = new THREE.Group();
  rift.position.set(0, 0, -282);
  world.add(rift);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x1a0f33, emissive: NEON.pink, emissiveIntensity: 3.2, metalness: .6, roughness: .3 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x0f1a33, emissive: NEON.cyan, emissiveIntensity: 2.6, metalness: .6, roughness: .3 });
  const outer = addMesh(rift, new THREE.TorusGeometry(12.5, .6, 12, 80), ringMat, [0, 13, 0], null, false, false);
  const inner = addMesh(rift, new THREE.TorusGeometry(10, .28, 10, 80), innerMat, [0, 13, 0], null, false, false);
  const discMat = new THREE.MeshBasicMaterial({ map: riftTexture, color: hdr(NEON.violet, 1.5), transparent: true, opacity: .42, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  addMesh(rift, new THREE.CircleGeometry(12.2, 64), discMat, [0, 13, -.1], null, false, false);
  trackObjects.push({ object: outer, riftRing: true, spin: .0022 }, { object: inner, riftRing: true, spin: -.0035 });

  const towerMat = new THREE.MeshStandardMaterial({ color: 0x100a24, roughness: .45, metalness: .7 });
  const stripMat = new THREE.MeshBasicMaterial({ color: hdr(NEON.cyan, 2.4), toneMapped: false });
  for (const side of [-1, 1]) {
    addMesh(rift, new THREE.BoxGeometry(7, 64, 7), towerMat, [side * 19, 31.5, 2], null, false, false);
    for (const dx of [-3.2, 0, 3.2]) addMesh(rift, new THREE.BoxGeometry(.18, 64, .18), stripMat, [side * 19 + dx, 31.5, 5.6], null, false, false);
  }
}

function buildTraffic() {
  const count = 30;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), count);
  mesh.frustumCulled = false;
  const palette = [NEON.pink, NEON.cyan, NEON.yellow, NEON.red, 0xdff6ff];
  const data = [];
  for (let i = 0; i < count; i++) {
    const side = random() < .5 ? -1 : 1;
    data.push({ x: side * (7 + random() * 16), y: 8 + random() * 14, z: -310 + random() * 350, speed: (random() < .5 ? 1 : -1) * (14 + random() * 22), w: .32 + random() * .2, h: .16 + random() * .1, len: 2.2 + random() * 5 });
    mesh.setColorAt(i, cityColor.setHex(palette[i % palette.length]).multiplyScalar(2.6));
  }
  world.add(mesh);
  cityAnim.cars = { mesh, data };
}

function buildRain() {
  const count = 1100;
  const positions = new Float32Array(count * 6);
  const drops = [];
  for (let i = 0; i < count; i++) drops.push({ x: (random() - .5) * 52, y: random() * 30, z: 12 - random() * 78, speed: 24 + random() * 14, len: .7 + random() * .8 });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .32, depthWrite: false, blending: THREE.AdditiveBlending }));
  lines.frustumCulled = false;
  world.add(lines);
  cityAnim.rain = { lines, drops, positions };
}

function seedWorld() {
  buildNeonEnvironment();
  scene.background = createSkyTexture();
  buildGroundAndRoad();
  buildCity();
  buildStreetLights();
  buildRiftMegastructure();
  buildTraffic();
  buildRain();
}

function updateCity(time, dt) {
  for (const sign of cityAnim.signs) {
    let k = sign.base * (1 + .07 * Math.sin(time * 2.1 + sign.phase));
    if (sign.flicker && Math.sin(time * 23 + sign.phase * 7) * Math.sin(time * 5.3 + sign.phase) > .86) k *= .2;
    sign.mat.color.setScalar(k);
    sign.halo.opacity = .45 * (k / sign.base);
  }
  const cars = cityAnim.cars;
  if (cars) {
    cars.data.forEach((car, i) => {
      car.z += car.speed * dt;
      if (car.speed > 0 && car.z > 40) car.z = -310;
      else if (car.speed < 0 && car.z < -310) car.z = 40;
      cityDummy.position.set(car.x, car.y, car.z);
      cityDummy.rotation.set(0, 0, 0);
      cityDummy.scale.set(car.w, car.h, car.len);
      cityDummy.updateMatrix();
      cars.mesh.setMatrixAt(i, cityDummy.matrix);
    });
    cars.mesh.instanceMatrix.needsUpdate = true;
  }
}

function updateRain(dt) {
  const rain = cityAnim.rain;
  if (!rain) return;
  const cx = camera.position.x, cz = camera.position.z;
  const { drops, positions } = rain;
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    d.y -= d.speed * dt;
    if (d.y < 0) d.y += 30;
    if (d.z > cz + 8) d.z -= 74; else if (d.z < cz - 66) d.z += 74;
    if (d.x > cx + 26) d.x -= 52; else if (d.x < cx - 26) d.x += 52;
    const o = i * 6;
    positions[o] = d.x; positions[o + 1] = d.y; positions[o + 2] = d.z;
    positions[o + 3] = d.x + d.len * .09; positions[o + 4] = d.y + d.len; positions[o + 5] = d.z;
  }
  rain.lines.geometry.attributes.position.needsUpdate = true;
}

function makeGateTexture(title, subtitle, color) {
  const css = `#${color.toString(16).padStart(6, '0')}`;
  return makeCanvasTexture(512, 256, (ctx, W, H) => {
    ctx.fillStyle = 'rgba(6, 2, 20, .94)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, .04)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
    ctx.strokeStyle = css; ctx.lineWidth = 4; ctx.shadowColor = css; ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(28, 8); ctx.lineTo(W - 8, 8); ctx.lineTo(W - 8, H - 28);
    ctx.lineTo(W - 28, H - 8); ctx.lineTo(8, H - 8); ctx.lineTo(8, 28);
    ctx.closePath(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255, 255, 255, .22)'; ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, W - 40, H - 40);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = css; ctx.font = '700 25px "Chakra Petch", monospace';
    ctx.fillText('R I F T   G A T E', W / 2, 55);
    ctx.shadowColor = css; ctx.shadowBlur = 22; ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px Orbitron, "Chakra Petch", sans-serif';
    ctx.fillText(title, W / 2, 136);
    ctx.shadowBlur = 0; ctx.fillStyle = '#d9d0ff'; ctx.font = '600 23px "Chakra Petch", monospace';
    ctx.fillText(subtitle, W / 2, 205);
  });
}

// Lane centres are +-GATE_LANE_X. A gate only counts when the army's centre is inside its own
// opening (the frame's posts sit at +-1.08, so the clear opening is roughly +-1.0). The zones of
// the two gates never overlap, and the centre lane touches neither.
const GATE_LANE_X = 2.45;
const GATE_HIT_HALF_WIDTH = 1.0;

function createGate(config) {
  const color = new THREE.Color(config.color);
  const group = new THREE.Group();
  group.position.set(config.side * 2.45, 0, config.z);
  world.add(group);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x160f2e, metalness: .85, roughness: .3, emissive: color, emissiveIntensity: 1.9 });
  const postGeo = new THREE.BoxGeometry(.14, 3.25, .2);
  addMesh(group, postGeo, frameMat, [-1.08, 1.62, 0]);
  addMesh(group, postGeo, frameMat, [1.08, 1.62, 0]);
  const top = addMesh(group, new THREE.BoxGeometry(2.3, .16, .24), frameMat, [0, 3.22, 0]);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x1c1438, metalness: .8, roughness: .34, emissive: color, emissiveIntensity: .8 });
  const footGeo = new THREE.BoxGeometry(.48, .22, .48);
  addMesh(group, footGeo, footMat, [-1.08, .1, 0]);
  addMesh(group, footGeo, footMat, [1.08, .1, 0]);
  const portalMat = new THREE.MeshStandardMaterial({ color: 0xa5f7fc, map: riftTexture, emissive: color, emissiveMap: riftTexture, emissiveIntensity: .72, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, roughness: .22, metalness: .12 });
  const portal = addMesh(group, new THREE.PlaneGeometry(2.02, 2.75), portalMat, [0, 1.72, -.015], null, false, false);
  const ringMat = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), .26), emissive: color, emissiveIntensity: 2.2, metalness: .46, roughness: .2 });
  const ring = addMesh(group, new THREE.TorusGeometry(.6, .045, 8, 42), ringMat, [0, 1.72, .11], null, false, false);
  ring.scale.set(1.62, 2.35, 1);
  const labelTexture = makeGateTexture(config.title, config.subtitle, config.color);
  const signMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, opacity: 1, side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.1), signMat);
  sign.position.set(0, 3.86, .015);
  sign.castShadow = false;
  group.add(sign);
  const targetMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .001, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
  const target = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 2.95), targetMaterial);
  target.position.set(0, 1.72, .2);
  target.userData.gate = null;
  group.add(target);
  gateTargets.push(target);
  const pad = addMesh(group, new THREE.BoxGeometry(2.55, .06, 1.85), new THREE.MeshStandardMaterial({ color: 0x120c26, metalness: .75, roughness: .38, emissive: color, emissiveIntensity: .8 }), [0, -.04, 0]);
  // Floor glow that shows the real pickup zone: the army must be inside it (|dx| <= GATE_HIT_HALF_WIDTH).
  const hitZoneMaterial = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.4), transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const hitZone = new THREE.Mesh(new THREE.PlaneGeometry(GATE_HIT_HALF_WIDTH * 2, 1.85), hitZoneMaterial);
  hitZone.rotation.x = -Math.PI / 2;
  hitZone.position.set(0, .03, 0);
  group.add(hitZone);
  const record = { ...config, group, ring, ringMat, portal, portalMat, frameMat, pad, signMat, hitZoneMaterial, target, resolved: false, phase: Math.random() * 6, flashUntil: 0 };
  target.userData.gate = record;
  gateRecords.push(record);
  return record;
}

const gatePairs = [
  ['fireRecruit', 'multiply'],
  ['convertWater', 'riftTax'],
  ['electricRecruit', 'bloodPact'],
  ['multiply', 'unstableClone'],
  ['convertElectric', 'waterBargain'],
  ['riftTax', 'fireRecruit'],
  ['bloodPact', 'convertWater'],
  ['electricRecruit', 'unstableClone'],
  ['divideArmy', 'multiply'],
];
const gateColors = {
  multiply: 0xff39d7,
  riftTax: 0xff315c,
  bloodPact: 0xff8243,
  unstableClone: 0xb754ff,
  waterBargain: 0x32c7ff,
  divideArmy: 0xff315c,
};
const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const shuffled = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

function makeGateOffer(type) {
  const units = randomInt(4, 7);
  if (type === 'fireRecruit') return { type, amount: units, powerGain: 1, title: `+${units}`, subtitle: 'FIRE RECRUITS // POWER +1', color: gateLabels.fire.color };
  if (type === 'electricRecruit') {
    const powerGain = randomInt(1, 3);
    return { type, amount: units, powerGain, title: `+${units}`, subtitle: `ELECTRIC // POWER +${powerGain}`, color: gateLabels.electric.color };
  }
  if (type === 'convertWater') {
    const wards = randomInt(1, 3);
    return { type, wards, powerGain: 1, title: 'WATER', subtitle: `CONVERT // WARD +${wards} // POWER +1`, color: gateLabels.water.color };
  }
  if (type === 'convertElectric') {
    const powerGain = randomInt(2, 4);
    return { type, powerGain, title: 'STORM', subtitle: `CONVERT // POWER +${powerGain}`, color: gateLabels.electric.color };
  }
  if (type === 'divideArmy') return { type, divisor: 2, title: '÷2', subtitle: 'SPLIT FORMATION // HALF UNITS', color: gateColors.divideArmy };
  if (type === 'multiply') return { type, multiplier: 2, title: '×2', subtitle: 'CLONE THE ARMY', color: gateColors.multiply };
  if (type === 'riftTax') {
    const loss = randomInt(3, 6);
    return { type, loss, title: `-${loss}`, subtitle: 'RIFT TAX // UNITS LOST', color: gateColors.riftTax };
  }
  if (type === 'bloodPact') {
    const loss = randomInt(2, 4);
    const powerGain = randomInt(4, 7);
    return { type, loss, powerGain, title: `-${loss} / +${powerGain}`, subtitle: 'BLOOD PACT // CONVERT FIRE', color: gateColors.bloodPact };
  }
  if (type === 'unstableClone') {
    const recoil = randomInt(28, 42);
    return { type, multiplier: 3, recoil, title: '×3!', subtitle: `UNSTABLE // RECOIL -${recoil}%`, color: gateColors.unstableClone };
  }
  const loss = randomInt(2, 4);
  const wards = randomInt(2, 3);
  const powerGain = randomInt(2, 4);
  return { type: 'waterBargain', loss, wards, powerGain, title: `-${loss}`, subtitle: `WATER // WARD +${wards} // POWER +${powerGain}`, color: gateColors.waterBargain };
}

function rerollGateOffers(updateScene = true) {
  const pairDeck = shuffled(gatePairs);
  for (let routeIndex = 0; routeIndex < pairDeck.length; routeIndex++) {
    const routeId = `gate-${routeIndex + 1}`;
    const sides = shuffled([-1, 1]);
    const offers = shuffled(pairDeck[routeIndex]).map(makeGateOffer);
    sides.forEach((side, sideIndex) => {
      const id = `g${routeIndex + 1}${side < 0 ? 'l' : 'r'}`;
      const config = gateConfig.find((gate) => gate.route === routeId && gate.side === side);
      if (!config) return;
      Object.assign(config, offers[sideIndex], { id, route: routeId, z: config.z, side });
      if (!updateScene) return;
      const record = gateRecords.find((gate) => gate.id === config.id);
      if (!record) return;
      Object.assign(record, config, { resolved: false, phase: Math.random() * 6 });
      record.frameMat.emissive.setHex(record.color);
      record.ringMat.color.setHex(record.color).lerp(new THREE.Color(0xffffff), .26);
      record.ringMat.emissive.setHex(record.color);
      record.portalMat.emissive.setHex(record.color);
      record.pad.material.emissive.setHex(record.color);
      record.hitZoneMaterial.color.setHex(record.color).multiplyScalar(1.4);
      record.signMat.map.dispose();
      record.signMat.map = makeGateTexture(record.title, record.subtitle, record.color);
      record.signMat.needsUpdate = true;
      record.target.userData.gate = record;
    });
  }
}

const gateConfig = [
  { id: 'g1l', z: -14, side: -1, type: 'fireRecruit', title: '+5', subtitle: 'FIRE RECRUITS', color: gateLabels.fire.color, route: 'gate-1' },
  { id: 'g1r', z: -14, side: 1, type: 'multiply', title: '×2', subtitle: 'CLONE THE ARMY', color: 0xff2bd6, route: 'gate-1' },
  { id: 'g2l', z: -32, side: -1, type: 'convertWater', title: 'WATER', subtitle: 'CONVERT FORMATION', color: gateLabels.water.color, route: 'gate-2' },
  { id: 'g2r', z: -32, side: 1, type: 'electricRecruit', title: '+5', subtitle: 'ELECTRIC RECRUITS', color: gateLabels.electric.color, route: 'gate-2' },
  { id: 'g3l', z: -50, side: -1, type: 'multiply', title: '×2', subtitle: 'CLONE THE ARMY', color: 0xff2bd6, route: 'gate-3' },
  { id: 'g3r', z: -50, side: 1, type: 'convertElectric', title: 'STORM', subtitle: 'CONVERT FORMATION', color: gateLabels.electric.color, route: 'gate-3' },
];

const extendedGateRoutes = [
  { z: -90, left: 'fireRecruit', right: 'electricRecruit' },
  { z: -113, left: 'convertWater', right: 'multiply' },
  { z: -136, left: 'multiply', right: 'convertElectric' },
  { z: -179, left: 'fireRecruit', right: 'electricRecruit' },
  { z: -202, left: 'convertWater', right: 'multiply' },
  { z: -225, left: 'multiply', right: 'convertElectric' },
];
const gatePresentation = {
  fireRecruit: { title: '+5', subtitle: 'FIRE RECRUITS', color: gateLabels.fire.color },
  electricRecruit: { title: '+5', subtitle: 'ELECTRIC RECRUITS', color: gateLabels.electric.color },
  convertWater: { title: 'WATER', subtitle: 'WARD +2 // CONVERT', color: gateLabels.water.color },
  convertElectric: { title: 'STORM', subtitle: 'DISABLE SHOCK PYLONS', color: gateLabels.electric.color },
  multiply: { title: '\u00D72', subtitle: 'CLONE THE ARMY', color: 0xff2bd6 },
};
extendedGateRoutes.forEach((route, index) => {
  for (const [side, type] of [[-1, route.left], [1, route.right]]) {
    const view = gatePresentation[type];
    gateConfig.push({ id: `g${index + 4}${side < 0 ? 'l' : 'r'}`, z: route.z, side, type, ...view, route: `gate-${index + 4}` });
  }
});
rerollGateOffers(false);

function createObstacle(config) {
  const group = new THREE.Group();
  group.position.set(config.x, 0, config.z);
  world.add(group);
  const hazard = new THREE.MeshStandardMaterial({ color: 0x1a0a18, roughness: .4, metalness: .6, emissive: 0xff2a52, emissiveIntensity: 2.2 });
  const frame = addMesh(group, new THREE.BoxGeometry(1.55, .78, .65), hazard, [0, .57, 0]);
  const coreMat = new THREE.MeshBasicMaterial({ color: hdr(NEON.yellow, 2.2), toneMapped: false });
  addMesh(group, new THREE.BoxGeometry(.94, .11, .7), coreMat, [0, .58, 0], null, false, false);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1430, metalness: .88, roughness: .24, emissive: 0xff2bd6, emissiveIntensity: .8 });
  addMesh(group, new THREE.CylinderGeometry(.22, .35, .28, 8), capMat, [-.77, .18, 0]);
  addMesh(group, new THREE.CylinderGeometry(.22, .35, .28, 8), capMat, [.77, .18, 0]);
  const ring = addMesh(group, new THREE.TorusGeometry(1.24, .045, 6, 32), hazard, [0, .18, 0], [1, 1, .55], false, false);
  ring.rotation.x = Math.PI / 2;
  obstacles.push({ ...config, group, frame, ring, core: group.children[1], coreBase: group.children[1].material.color.clone(), resolved: false, phase: Math.random() * 6 });
}

function makePedestal(x, z, size = 8, accent = NEON.cyan) {
  const base = addMesh(world, new THREE.CylinderGeometry(size * .46, size * .52, .38, 12), new THREE.MeshStandardMaterial({ color: 0x140f28, roughness: .5, metalness: .6, emissive: 0x2a0a4a, emissiveIntensity: .8 }), [x, -.12, z]);
  const halo = addMesh(world, new THREE.TorusGeometry(size * .44, .08, 10, 64), new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: accent, emissiveIntensity: 3, metalness: .5, roughness: .24 }), [x, .1, z], null, false, false);
  halo.rotation.x = -Math.PI / 2;
  const center = addMesh(world, new THREE.CylinderGeometry(size * .32, size * .4, .055, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(accent).multiplyScalar(.5), transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending }), [x, .1, z], null, false, false);
  return { base, halo, center, z };
}
const waveArena = makePedestal(0, -67, 8.8, NEON.cyan);
const secondWaveArena = makePedestal(0, SECOND_WAVE_Z, 9.6, NEON.yellow);
const bossArena = makePedestal(0, FINAL_BOSS_Z, 11.4, NEON.pink);
for (const [x, z, color] of [[-5.7, -66, NEON.cyan], [5.7, -66, NEON.pink], [-6.1, SECOND_WAVE_Z + 1, NEON.yellow], [6.1, SECOND_WAVE_Z + 1, NEON.cyan], [-7.1, FINAL_BOSS_Z, NEON.pink], [7.1, FINAL_BOSS_Z, NEON.red]]) {
  const beacon = addMesh(world, new THREE.CylinderGeometry(.17, .34, 4.8, 8), new THREE.MeshStandardMaterial({ color: 0x1a1430, emissive: color, emissiveIntensity: 1.2, roughness: .3, metalness: .7 }), [x, 2.2, z]);
  const light = addMesh(world, new THREE.SphereGeometry(.29, 16, 12), new THREE.MeshBasicMaterial({ color: hdr(color, 2.2), toneMapped: false }), [x, 4.65, z], null, false, false);
  trackObjects.push({ object: beacon, light, beacon: true, tint: new THREE.Color(color), phase: Math.random() * 6 });
}

seedWorld();
gateConfig.forEach(createGate);
createObstacle({ id: 'o1', z: -24, x: 0 });
createObstacle({ id: 'o2', z: -41, x: -2.55 });
createObstacle({ id: 'o3', z: -58, x: 2.55 });
createObstacle({ id: 'o4', z: -80, x: -2.55 });
createObstacle({ id: 'o5', z: -101, x: 2.55 });
createObstacle({ id: 'o6', z: -123, x: 0 });
createObstacle({ id: 'o7', z: -145, x: -2.55 });
createObstacle({ id: 'o8', z: -169, x: 2.55 });
createObstacle({ id: 'o9', z: -191, x: 0 });
createObstacle({ id: 'o10', z: -213, x: -2.55 });
createObstacle({ id: 'o11', z: -235, x: 2.55 });

function elementMaterial(element, transparent = false) {
  const palette = gateLabels[element];
  const color = new THREE.Color(palette.color);
  return new THREE.MeshStandardMaterial({
    color: element === 'fire' ? 0xff8a5c : element === 'water' ? 0x5aa8ff : 0xfff27a,
    emissive: color,
    emissiveIntensity: element === 'fire' ? .55 : element === 'water' ? .45 : .75,
    metalness: .42,
    roughness: element === 'water' ? .23 : .39,
    transparent,
    opacity: transparent ? .78 : 1,
  });
}

function createFallbackWarrior() {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xffa26b, metalness: .4, roughness: .38 });
  const armorMat = new THREE.MeshStandardMaterial({ color: 0x291c3c, metalness: .72, roughness: .24, emissive: 0x552044, emissiveIntensity: .42 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd67a, toneMapped: false });
  addMesh(group, new THREE.CapsuleGeometry(.28, .66, 3, 6), baseMat, [0, .97, 0]);
  addMesh(group, new THREE.BoxGeometry(.49, .42, .34), armorMat, [0, 1.13, .22]);
  addMesh(group, new THREE.BoxGeometry(.58, .14, .4), armorMat, [0, 1.42, 0]);
  addMesh(group, new THREE.SphereGeometry(.24, 8, 6), baseMat, [0, 1.65, 0]);
  addMesh(group, new THREE.ConeGeometry(.19, .38, 5), baseMat, [0, 1.96, -.02]);
  addMesh(group, new THREE.BoxGeometry(.25, .065, .04), glowMat, [0, 1.68, .225]);
  addMesh(group, new THREE.BoxGeometry(.12, .38, .1), glowMat, [0, 1.15, .405], null, false, false);
  addMesh(group, new THREE.IcosahedronGeometry(.16, 1), glowMat, [0, 2.17, -.02], null, false, false);
  addMesh(group, new THREE.SphereGeometry(.29, 8, 6), armorMat, [-.43, 1.31, 0]);
  addMesh(group, new THREE.SphereGeometry(.29, 8, 6), armorMat, [.43, 1.31, 0]);
  const armL = addMesh(group, new THREE.BoxGeometry(.15, .6, .16), baseMat, [-.42, 1.02, 0]);
  const armR = addMesh(group, new THREE.BoxGeometry(.15, .6, .16), baseMat, [.42, 1.02, 0]);
  const legL = addMesh(group, new THREE.BoxGeometry(.18, .54, .2), baseMat, [-.17, .35, 0]);
  const legR = addMesh(group, new THREE.BoxGeometry(.18, .54, .2), baseMat, [.17, .35, 0]);
  return { group, armL, armR, legL, legR };
}

function recolorWarrior(model, element) {
  const oldMaterials = [];
  model.traverse((child) => {
    if (!child.isMesh || child.userData.preserveMaterial) return;
    if (!oldMaterials.includes(child.material)) oldMaterials.push(child.material);
    child.material = elementMaterial(element, element === 'water');
    child.castShadow = true;
    child.receiveShadow = true;
  });
  oldMaterials.forEach((material) => material.dispose());
}

function addCyberpunkArmor(model, variant, glowColor) {
  const armor = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: .9, roughness: .22, emissive: 0x07111e, emissiveIntensity: .55 });
  const plate = new THREE.MeshStandardMaterial({ color: 0x263447, metalness: .84, roughness: .26, emissive: glowColor, emissiveIntensity: .16 });
  const neon = new THREE.MeshBasicMaterial({ color: glowColor, toneMapped: false });
  const detail = (geometry, material, position, scale, rotation) => {
    const mesh = addMesh(model, geometry, material, position, scale, material !== neon, false);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.userData.preserveMaterial = true;
    return mesh;
  };

  // Rebuild the read of the body with layered, angular plates and an illuminated visor.
  detail(new THREE.IcosahedronGeometry(.36, 0), plate, [0, 1.17, .235], [.95, .94, .5]);
  detail(new THREE.BoxGeometry(.46, .095, .045), neon, [0, 1.72, .24], [1, 1, 1]);
  detail(new THREE.BoxGeometry(.3, .055, .05), armor, [0, 1.61, .255]);
  detail(new THREE.BoxGeometry(.18, .055, .05), neon, [0, .78, .215]);
  detail(new THREE.BoxGeometry(.34, .32, .2), armor, [0, 1.05, -.29]);
  detail(new THREE.BoxGeometry(.38, .045, .12), neon, [0, 1.22, -.405]);
  for (const side of [-1, 1]) {
    detail(new THREE.DodecahedronGeometry(.25, 0), plate, [side * .48, 1.42, .015], [.95, .72, .8]);
    detail(new THREE.BoxGeometry(.2, .22, .24), armor, [side * .44, .94, .08], [1, 1, 1], [0, 0, side * -.12]);
    detail(new THREE.BoxGeometry(.22, .12, .25), plate, [side * .17, .35, .025]);
    detail(new THREE.BoxGeometry(.055, .34, .045), neon, [side * .22, 1.15, .29], [1, 1, 1], [0, 0, side * .34]);
  }
  if (variant % 3 === 0) {
    detail(new THREE.ConeGeometry(.13, .42, 4), plate, [-.24, 1.95, 0], [1, 1, 1], [0, 0, .35]);
    detail(new THREE.ConeGeometry(.13, .42, 4), plate, [.24, 1.95, 0], [1, 1, 1], [0, 0, -.35]);
  } else if (variant % 3 === 1) {
    detail(new THREE.CylinderGeometry(.035, .055, .42, 6), neon, [.19, 2.03, -.05], null, [0, 0, -.12]);
    detail(new THREE.SphereGeometry(.09, 8, 6), neon, [.19, 2.25, -.05]);
  } else {
    detail(new THREE.BoxGeometry(.12, .4, .13), plate, [0, 2.02, -.02], [1.2, 1, 1]);
    detail(new THREE.BoxGeometry(.28, .045, .045), neon, [0, 1.91, .08]);
  }
}

function cloneWarrior() {
  if (!game.modelTemplate) return createFallbackWarrior();
  const root = game.modelTemplate.clone(true);
  root.traverse((child) => {
    if (child.isMesh) {
      if (Array.isArray(child.material)) child.material = child.material.map((material) => material.clone());
      else child.material = child.material.clone();
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  const model = { group: root, armL: root.getObjectByName('Arm.L'), armR: root.getObjectByName('Arm.R'), legL: root.getObjectByName('Leg.L'), legR: root.getObjectByName('Leg.R') };
  recolorWarrior(root, game.element);
  return model;
}

function makeUnit() {
  const unit = cloneWarrior();
  const anchor = new THREE.Group();
  anchor.add(unit.group);
  const unitIndex = game.visualUnits.length;
  const armorGlow = [0x00f0ff, 0xff2bd6, 0xfcee0a, 0x8a3dff][unitIndex % 4];
  addCyberpunkArmor(unit.group, unitIndex, armorGlow);
  // Small, readable silhouette changes keep the formation from looking cloned.
  const accentColors = [0x00f0ff, 0xff2bd6, 0xfcee0a, 0x8a3dff];
  const accent = new THREE.MeshStandardMaterial({ color: accentColors[game.visualUnits.length % accentColors.length], emissive: accentColors[game.visualUnits.length % accentColors.length], emissiveIntensity: 1.35, metalness: .55, roughness: .24 });
  const variant = game.visualUnits.length % 4;
  if (variant === 0) {
    addMesh(unit.group, new THREE.ConeGeometry(.12, .42, 5), accent, [-.3, 1.48, -.02]).rotation.z = .42;
    addMesh(unit.group, new THREE.ConeGeometry(.12, .42, 5), accent, [.3, 1.48, -.02]).rotation.z = -.42;
  } else if (variant === 1) {
    const crest = addMesh(unit.group, new THREE.TorusGeometry(.22, .055, 6, 12, Math.PI), accent, [0, 1.88, -.02]);
    crest.rotation.z = Math.PI;
    addMesh(unit.group, new THREE.BoxGeometry(.48, .1, .42), accent, [0, .48, .02]);
  } else if (variant === 2) {
    addMesh(unit.group, new THREE.IcosahedronGeometry(.17, 0), accent, [-.47, 1.36, .02]);
    addMesh(unit.group, new THREE.IcosahedronGeometry(.17, 0), accent, [.47, 1.36, .02]);
  } else {
    addMesh(unit.group, new THREE.ConeGeometry(.2, .48, 4), accent, [0, 2.16, -.02]);
    addMesh(unit.group, new THREE.BoxGeometry(.12, .5, .12), accent, [0, 1.14, .44]);
  }
  unit.group.traverse((child) => { if (child.isMesh && child.material === accent) child.userData.preserveMaterial = true; });
  troopRoot.add(anchor);
  unit.anchor = anchor;
  unit.group.scale.setScalar(1);
  unit.phase = Math.random() * Math.PI * 2;
  game.visualUnits.push(unit);
  return unit;
}

function rebuildFormation() {
  const wanted = Math.min(24, game.count);
  while (game.visualUnits.length < wanted) makeUnit();
  for (let index = 0; index < game.visualUnits.length; index++) {
    const unit = game.visualUnits[index];
    const active = index < wanted;
    unit.anchor.visible = active;
    if (!active) continue;
    const columnCount = 6;
    const row = Math.floor(Math.max(0, index - 1) / columnCount);
    const col = (Math.max(0, index - 1) % columnCount) - (columnCount - 1) / 2;
    const leader = index === 0;
    const scale = leader ? 1.04 : .78;
    unit.group.scale.setScalar(scale);
    unit.anchor.position.set(game.playerX + (leader ? 0 : col * .68), 0, game.playerZ + (leader ? 0 : 1.1 + row * .82));
  }
}

function createElementParticles() {
  if (game.particleSystem) {
    vfxRoot.remove(game.particleSystem.points);
    game.particleSystem.points.geometry.dispose();
    game.particleSystem.points.material.dispose();
  }
  if (game.electricVfx) {
    vfxRoot.remove(game.electricVfx.group);
    game.electricVfx.bolts.forEach((bolt) => { bolt.geometry.dispose(); bolt.material.dispose(); });
  }
  const palette = gateLabels[game.element];
  const count = 84;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = [];
  const ages = [];
  const lifetimes = [];
  const baseColor = new THREE.Color(palette.color);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * 1.7;
    positions[i * 3 + 1] = Math.random() * 2.5;
    positions[i * 3 + 2] = Math.random() * 3.3;
    const brightness = .58 + Math.random() * .42;
    colors[i * 3] = baseColor.r * brightness;
    colors[i * 3 + 1] = baseColor.g * brightness;
    colors[i * 3 + 2] = baseColor.b * brightness;
    velocities.push(new THREE.Vector3((Math.random() - .5) * .7, .28 + Math.random() * .8, (Math.random() - .5) * .4));
    ages.push(Math.random() * 1.8);
    lifetimes.push(1.1 + Math.random() * 1.25);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ map: glowTexture, size: game.element === 'water' ? .21 : .24, vertexColors: true, transparent: true, opacity: .93, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  vfxRoot.add(points);
  game.particleSystem = { points, positions, velocities, ages, lifetimes, count };
  if (game.element === 'electric') createElectricArcs();
}

function createElectricArcs() {
  const group = new THREE.Group();
  vfxRoot.add(group);
  const bolts = [];
  for (let i = 0; i < 5; i++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15), 3));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x9ef7ff, transparent: true, opacity: .8, blending: THREE.AdditiveBlending }));
    group.add(line);
    bolts.push(line);
  }
  game.electricVfx = { group, bolts };
}

function refreshElectricArcs() {
  if (!game.electricVfx) return;
  for (const line of game.electricVfx.bolts) {
    const attr = line.geometry.getAttribute('position');
    const startX = (Math.random() - .5) * 1.8;
    const startZ = Math.random() * 2.8;
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      attr.setXYZ(i, startX + (Math.random() - .5) * .5, .15 + t * 1.85, startZ + (Math.random() - .5) * .5);
    }
    attr.needsUpdate = true;
    line.geometry.computeBoundingSphere();
  }
}

function createBoss() {
  const boss = new THREE.Group();
  boss.position.set(0, 0, FINAL_BOSS_Z - 4.5);
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x271c2c, roughness: .28, metalness: .78, emissive: 0x5a1d35, emissiveIntensity: .48 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x4c2635, roughness: .35, metalness: .62, emissive: 0x9a3040, emissiveIntensity: .62 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffa073, emissive: 0xff472e, emissiveIntensity: 4.4, roughness: .18 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x8a3651, emissive: 0xff3654, emissiveIntensity: 2.5, roughness: .22, metalness: .5 });
  addMesh(boss, new THREE.CylinderGeometry(.7, 1.12, 2.15, 8), darkMetal, [0, 1.52, 0]);
  addMesh(boss, new THREE.SphereGeometry(.76, 10, 8), shellMat, [0, 2.92, 0]);
  addMesh(boss, new THREE.TorusGeometry(.5, .16, 7, 9), shellMat, [0, 3.72, 0]);
  // Crown blades and a layered chest plate give the Warden a stronger boss silhouette.
  for (let i = 0; i < 5; i++) {
    const angle = (i / 4 - .5) * 1.3;
    const blade = addMesh(boss, new THREE.ConeGeometry(.2, .85, 5), shellMat, [Math.sin(angle) * .72, 3.26 + Math.cos(angle) * .1, -.02]);
    blade.rotation.z = -angle;
  }
  addMesh(boss, new THREE.OctahedronGeometry(.48, 0), coreMat, [0, 2.03, .94]);
  const core = addMesh(boss, new THREE.IcosahedronGeometry(.29, 1), coreMat, [0, 1.85, .68]);
  core.rotation.z = .2;
  addMesh(boss, new THREE.SphereGeometry(.13, 12, 10), eyeMat, [-.31, 2.98, .58]);
  addMesh(boss, new THREE.SphereGeometry(.13, 12, 10), eyeMat, [.31, 2.98, .58]);
  const armGeo = new THREE.BoxGeometry(.48, 1.9, .54);
  const armL = addMesh(boss, armGeo, darkMetal, [-1.17, 1.82, 0]);
  const armR = addMesh(boss, armGeo, darkMetal, [1.17, 1.82, 0]);
  armL.rotation.z = .16; armR.rotation.z = -.16;
  const shoulderGeo = new THREE.IcosahedronGeometry(.69, 0);
  addMesh(boss, shoulderGeo, shellMat, [-1.25, 2.59, 0]);
  addMesh(boss, shoulderGeo, shellMat, [1.25, 2.59, 0]);
  const halo = addMesh(boss, new THREE.TorusGeometry(1.85, .045, 8, 56), new THREE.MeshStandardMaterial({ color: 0xf06477, emissive: 0xff3656, emissiveIntensity: 2.6, metalness: .3, roughness: .23 }), [0, 2.62, 0], null, false, false);
  halo.rotation.x = Math.PI / 2;
  boss.userData.core = core;
  boss.userData.halo = halo;
  boss.userData.baseCoreColor = core.material.color.clone();
  boss.userData.baseCoreEmissive = core.material.emissive.clone();
  boss.userData.baseCoreIntensity = core.material.emissiveIntensity;
  boss.userData.baseHaloEmissive = halo.material.emissive.clone();
  boss.userData.baseHaloIntensity = halo.material.emissiveIntensity;
  boss.visible = false;
  world.add(boss);
  game.enemyBoss = boss;
}

function createEnemyFormation() {
  for (const unit of game.enemyUnits) game.enemyRoot.remove(unit.anchor);
  game.enemyUnits = [];
  const old = game.enemyRoot.children.filter((child) => child.userData.soldier !== true);
  old.forEach((child) => game.enemyRoot.remove(child));
  for (let i = 0; i < 9; i++) {
    const unit = cloneWarrior();
    recolorWarrior(unit.group, 'electric');
    unit.group.traverse((child) => { if (child.isMesh) { child.material.color.set(0x24152f); child.material.emissive.set(0xff2a52); child.material.emissiveIntensity = .72; child.material.metalness = .78; child.material.roughness = .24; } });
    addCyberpunkArmor(unit.group, i + 1, i % 2 ? 0xff315c : 0xff8a36);
    const armor = new THREE.MeshStandardMaterial({ color: 0x35152d, metalness: .82, roughness: .2, emissive: 0xff164f, emissiveIntensity: .95 });
    const trim = new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff4b86 : 0xffa343, toneMapped: false });
    // Alternate raider helmets, shoulder spikes, and shields across the ranks.
    if (i % 3 === 0) {
      const helm = addMesh(unit.group, new THREE.ConeGeometry(.3, .62, 5), armor, [0, 1.98, 0]);
      helm.rotation.x = -.18;
      addMesh(unit.group, new THREE.BoxGeometry(.5, .08, .08), trim, [0, 1.67, .25], null, false, false);
    } else if (i % 3 === 1) {
      addMesh(unit.group, new THREE.ConeGeometry(.16, .58, 4), armor, [-.5, 1.49, 0]).rotation.z = .55;
      addMesh(unit.group, new THREE.ConeGeometry(.16, .58, 4), armor, [.5, 1.49, 0]).rotation.z = -.55;
      addMesh(unit.group, new THREE.CylinderGeometry(.32, .38, .12, 6), trim, [.48, 1.02, .3]).rotation.x = Math.PI / 2;
    } else {
      const crest = addMesh(unit.group, new THREE.TorusGeometry(.25, .075, 6, 12, Math.PI), trim, [0, 1.9, -.02]);
      crest.rotation.z = Math.PI;
      addMesh(unit.group, new THREE.BoxGeometry(.62, .22, .18), armor, [0, 1.42, .25]);
    }
    unit.group.traverse((child) => { if (child.isMesh && (child.material === armor || child.material === trim)) child.userData.preserveMaterial = true; });
    const anchor = new THREE.Group();
    anchor.userData.soldier = true;
    anchor.add(unit.group);
    anchor.position.set((i % 3 - 1) * 1.15, 0, Math.floor(i / 3) * -1.02 - 2.8);
    unit.group.scale.setScalar(.8);
    game.enemyRoot.add(anchor);
    game.enemyUnits.push({ ...unit, anchor, phase: i * .65 });
  }
}

function setEnemyFormationElement(element) {
  for (const unit of game.enemyUnits) {
    recolorWarrior(unit.group, element);
    unit.group.traverse((child) => {
      if (!child.isMesh) return;
      child.material.color.multiplyScalar(.43);
      child.material.emissiveIntensity = element === 'electric' ? 1.05 : .82;
    });
  }
}

function setElement(nextElement) {
  const previousElement = game.element;
  game.element = nextElement;
  const palette = gateLabels[nextElement];
  for (const unit of game.visualUnits) recolorWarrior(unit.group, nextElement);
  createElementParticles();
  elementNameHud.textContent = palette.label;
  elementNameHud.style.color = palette.hex;
  elementAbilityHud.textContent = getElementAbility(nextElement);
  elementAbilityHud.style.color = nextElement === 'water' ? '#8dcfff' : nextElement === 'electric' ? '#c8fbff' : '#ffd0a8';
  elementEmblem.style.color = palette.hex;
  elementEmblem.style.borderColor = `${palette.hex}88`;
  elementEmblem.style.background = `radial-gradient(circle, ${palette.hex}33, transparent 72%)`;
  elementGlyph.textContent = palette.glyph;
  if (previousElement !== nextElement && ['running', 'battle', 'boss'].includes(game.phase)) spawnElementShift(nextElement);
}

function updateHud() {
  unitCountHud.textContent = String(game.count).padStart(2, '0');
  const palette = gateLabels[game.element];
  elementNameHud.textContent = palette.label;
  elementNameHud.style.color = palette.hex;
  elementAbilityHud.textContent = getElementAbility(game.element);
  elementAbilityHud.style.color = game.element === 'water' ? '#8dcfff' : game.element === 'electric' ? '#c8fbff' : '#ffd0a8';
  elementEmblem.style.color = palette.hex;
  elementEmblem.style.borderColor = `${palette.hex}88`;
  elementEmblem.style.background = `radial-gradient(circle, ${palette.hex}33, transparent 72%)`;
  elementGlyph.textContent = palette.glyph;
  const progress = THREE.MathUtils.clamp(-game.playerZ / Math.abs(FINAL_BOSS_Z), 0, 1);
  progressFill.style.width = `${progress * 100}%`;
  progressDot.style.left = `${progress * 100}%`;
  progressPercent.textContent = `${Math.round(progress * 100)}%`;
  routeStep.textContent = String(game.routeStep).padStart(2, '0');
  stageLabel.textContent = game.phase === 'boss'
    ? 'FINAL BATTLE // THE RIFT CORE'
    : progress < .28 ? 'SECTOR 01 // ASHEN CAUSEWAY'
      : progress < .67 ? 'SECTOR 02 // SENTINEL FRONT'
        : 'SECTOR 03 // RIFT APPROACH';
}

function getElementAbility(element) {
  if (element === 'water') return `WARD ${game.waterShields} // BLOCK HITS`;
  if (element === 'electric') return 'ARC // DISABLE PYLONS';
  return 'BURN // +25% BATTLE';
}

function setFeedback(message, color = '#53f6ff') {
  feedbackEl.textContent = message;
  feedbackEl.style.color = color;
  feedbackEl.classList.add('show');
  game.feedbackTimer = 1.45;
}

function selectGate(config) {
  if (game.phase !== 'running' || config.resolved || game.playerZ < config.z) return;
  game.selectedGate = config.id;
  game.targetX = config.side * 2.45;
  const color = `#${config.color.toString(16).padStart(6, '0')}`;
  setFeedback(`ROUTE LOCKED // ${config.title} ${config.subtitle}`, color);
}

function applyGate(config) {
  if (config.resolved || gateRecords.some((gate) => gate.route === config.route && gate.resolved)) return;
  for (const sibling of gateRecords) if (sibling.route === config.route) sibling.resolved = true;
  game.routeStep = Math.min(9, game.routeStep + 1);
  game.selectedGate = null;
  const previousCount = game.count;
  if (config.type === 'fireRecruit') {
    game.count = Math.min(99, game.count + config.amount);
    game.power += config.powerGain;
    setElement('fire');
    setFeedback(`+${game.count - previousCount} FIRE // POWER +${config.powerGain}`, gateLabels.fire.hex);
  } else if (config.type === 'multiply') {
    game.count = Math.min(99, game.count * config.multiplier);
    setFeedback(`FORMATION MULTIPLIED // \u00D7${config.multiplier}`, '#ff5be0');
  } else if (config.type === 'divideArmy') {
    game.count = Math.max(1, Math.floor(game.count / config.divisor));
    setFeedback(`FORMATION DIVIDED // \u00F7${config.divisor} // -${previousCount - game.count} UNITS`, '#ff5574');
  } else if (config.type === 'convertWater') {
    game.power += config.powerGain;
    game.waterShields = Math.min(12, game.waterShields + config.wards);
    setElement('water');
    setFeedback(`WATER CONVERSION // WARD +${config.wards} // POWER +${config.powerGain}`, gateLabels.water.hex);
  } else if (config.type === 'electricRecruit') {
    game.count = Math.min(99, game.count + config.amount);
    game.power += config.powerGain;
    setElement('electric');
    setFeedback(`+${game.count - previousCount} ELECTRIC // POWER +${config.powerGain}`, gateLabels.electric.hex);
  } else if (config.type === 'convertElectric') {
    game.power += config.powerGain;
    setElement('electric');
    setFeedback(`ELECTRIC CONVERSION // POWER +${config.powerGain} // PYLONS DISABLED`, gateLabels.electric.hex);
  } else if (config.type === 'riftTax') {
    const loss = Math.min(config.loss, Math.max(0, game.count - 1));
    game.count -= loss;
    setFeedback(`RIFT TAX // -${loss} UNITS`, '#ff5574');
  } else if (config.type === 'bloodPact') {
    const loss = Math.min(config.loss, Math.max(0, game.count - 1));
    game.count -= loss;
    game.power += config.powerGain;
    setElement('fire');
    setFeedback(`BLOOD PACT // -${loss} UNITS // POWER +${config.powerGain}`, '#ff8243');
  } else if (config.type === 'unstableClone') {
    const cloned = Math.min(99, game.count * config.multiplier);
    game.count = Math.max(1, Math.floor(cloned * (1 - config.recoil / 100)));
    setFeedback(`UNSTABLE CLONE // \u00D7${config.multiplier}, THEN -${config.recoil}%`, '#d58aff');
  } else if (config.type === 'waterBargain') {
    const loss = Math.min(config.loss, Math.max(0, game.count - 1));
    game.count -= loss;
    game.power += config.powerGain;
    game.waterShields = Math.min(12, game.waterShields + config.wards);
    setElement('water');
    setFeedback(`WATER BARGAIN // -${loss} // WARD +${config.wards} // POWER +${config.powerGain}`, gateLabels.water.hex);
  }
  rebuildFormation();
  updateHud();
  const enteredGate = gateRecords.find((gate) => gate.id === config.id);
  if (enteredGate) enteredGate.flashUntil = game.clockTime + .42;
  spawnCharacterSparks(new THREE.Color(gateLabels[game.element].color));
  spawnImpact(new THREE.Vector3(game.playerX, .7, config.z), new THREE.Color(config.color), 1.1);
}

function spawnCharacterSparks(color) {
  const activeUnits = game.visualUnits.filter((unit) => unit.anchor.visible);
  if (!activeUnits.length) return;
  const sparksPerUnit = 5;
  const count = activeUnits.length * sparksPerUnit;
  const positions = new Float32Array(count * 3);
  const velocity = [];
  let sparkIndex = 0;
  for (const unit of activeUnits) {
    for (let spark = 0; spark < sparksPerUnit; spark++, sparkIndex++) {
      const angle = (spark / sparksPerUnit) * Math.PI * 2 + Math.random() * .35;
      const radius = .16 + Math.random() * .18;
      positions[sparkIndex * 3] = unit.anchor.position.x + Math.cos(angle) * radius;
      positions[sparkIndex * 3 + 1] = .65 + Math.random() * 1.05;
      positions[sparkIndex * 3 + 2] = unit.anchor.position.z + Math.sin(angle) * radius;
      velocity.push(new THREE.Vector3(Math.cos(angle) * (1.1 + Math.random() * 1.1), .45 + Math.random() * 1.3, Math.sin(angle) * (1.1 + Math.random() * 1.1)));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: glowTexture, color, size: .27, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  world.add(points);
  activeFx.push({ mesh: points, positions, velocity, age: 0, lifetime: .62, isPoints: true });
}

function spawnImpact(origin, color, scale = 1) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.5, .055, 8, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.copy(origin);
  ring.rotation.x = Math.PI / 2;
  ring.scale.setScalar(.12 * scale);
  world.add(ring);
  activeFx.push({ mesh: ring, age: 0, lifetime: .68, startScale: .12 * scale });
  const sparksCount = 18;
  const positions = new Float32Array(sparksCount * 3);
  const velocity = [];
  for (let i = 0; i < sparksCount; i++) {
    positions[i * 3] = origin.x;
    positions[i * 3 + 1] = origin.y;
    positions[i * 3 + 2] = origin.z;
    const angle = Math.random() * Math.PI * 2;
    velocity.push(new THREE.Vector3(Math.cos(angle) * (1 + Math.random() * 2), .3 + Math.random() * 2, Math.sin(angle) * (1 + Math.random() * 2)));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture, color, size: .32, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending }));
  world.add(pts);
  activeFx.push({ mesh: pts, positions, velocity, age: 0, lifetime: .65, isPoints: true });
}

function spawnElementShift(element) {
  const color = new THREE.Color(gateLabels[element].color);
  const group = new THREE.Group();
  group.position.set(game.playerX, .92, game.playerZ + .25);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending });
  const horizontal = new THREE.Mesh(new THREE.TorusGeometry(.85, .055, 8, 48), material);
  horizontal.rotation.x = Math.PI / 2;
  const vertical = new THREE.Mesh(new THREE.TorusGeometry(.65, .04, 8, 40), material.clone());
  vertical.rotation.y = Math.PI / 2;
  group.add(horizontal, vertical);
  world.add(group);
  activeFx.push({ mesh: group, age: 0, lifetime: .9, isShift: true });
  spawnImpact(new THREE.Vector3(game.playerX, .72, game.playerZ), color, 1.8);
}

function spawnBattleStrike(source, target, color, isEnemyAttack = false) {
  const mid = source.clone().lerp(target, .5);
  mid.x += (Math.random() - .5) * .7;
  mid.y += .45 + Math.random() * .55;
  const curve = new THREE.CatmullRomCurve3([source.clone(), mid, target.clone()]);
  const geometry = new THREE.TubeGeometry(curve, 8, isEnemyAttack ? .065 : .045, 5, false);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity: .96,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const beam = new THREE.Mesh(geometry, material);
  world.add(beam);
  activeFx.push({ mesh: beam, age: 0, lifetime: isEnemyAttack ? .34 : .27, isBeam: true });
  spawnImpact(target, new THREE.Color(color), isEnemyAttack ? .55 : .72);
}

function updateFx(dt) {
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const effect = activeFx[i];
    effect.age += dt;
    const progress = Math.min(1, effect.age / effect.lifetime);
    if (effect.isPortal) {
      const opening = Math.min(1, progress / .18);
      const closing = progress < .78 ? 1 : Math.max(.035, 1 - (progress - .78) / .22);
      const fade = progress < .78 ? 1 : Math.max(0, (1 - progress) / .22);
      const pulse = 1 + Math.sin(effect.age * 13) * .025;
      effect.mesh.scale.setScalar(.035 + opening * closing * 1.08 * pulse);
      effect.mesh.rotation.y += dt * 1.8;
      const glow = Math.min(1, progress * 7) * fade;
      effect.mesh.children.forEach((child) => {
        if (child.material && child.userData.portalBaseOpacity !== undefined) {
          child.material.opacity = child.userData.portalBaseOpacity * glow;
        }
      });
      if (effect.portalLight) effect.portalLight.intensity = effect.portalLight.userData.baseIntensity * glow;
      if (effect.portalFill) effect.portalFill.intensity = effect.portalFill.userData.baseIntensity * glow;
    } else if (effect.isShift) {
      const pulse = Math.sin(progress * Math.PI);
      effect.mesh.scale.setScalar(.3 + pulse * 1.05);
      effect.mesh.rotation.y += dt * 2.5;
      effect.mesh.children.forEach((child) => { child.material.opacity = (1 - progress) * .95; });
    } else if (effect.isBeam) {
      effect.mesh.material.opacity = (1 - progress) * .96;
      effect.mesh.scale.set(1, 1 + Math.sin(progress * Math.PI) * .2, 1);
    } else if (effect.isPoints) {
      const attr = effect.mesh.geometry.getAttribute('position');
      for (let j = 0; j < effect.velocity.length; j++) {
        attr.array[j * 3] += effect.velocity[j].x * dt;
        attr.array[j * 3 + 1] += effect.velocity[j].y * dt;
        attr.array[j * 3 + 2] += effect.velocity[j].z * dt;
        effect.velocity[j].y -= 1.8 * dt;
      }
      attr.needsUpdate = true;
      effect.mesh.material.opacity = 1 - progress;
    } else {
      effect.mesh.scale.setScalar(effect.startScale * (1 + progress * 10));
      effect.mesh.material.opacity = 1 - progress;
    }
    if (progress >= 1) {
      world.remove(effect.mesh);
      if (effect.mesh.isGroup) {
        effect.mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      } else {
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
      }
      activeFx.splice(i, 1);
    }
  }
}

// A gate is only collected when the army's centre is inside that gate's own opening.
// Previously this fell back to "nearest gate" (and honoured a clicked lock even if the army was
// in another lane), so a player in the middle lane, or still sliding between lanes, could grab a
// power-up from the lane next door.
function chooseGate(routeId) {
  return gateRecords.find((gate) => gate.route === routeId && !gate.resolved && Math.abs(game.playerX - gate.side * GATE_LANE_X) <= GATE_HIT_HALF_WIDTH) || null;
}

function missGate(routeId) {
  for (const gate of gateRecords) if (gate.route === routeId) gate.resolved = true;
  game.routeStep = Math.min(9, game.routeStep + 1);
  game.selectedGate = null;
  setFeedback('GATE MISSED // NO BONUS', '#ff4d6d');
}

function openEnemyPortal(z, radius, color, isBoss = false) {
  const portal = new THREE.Group();
  portal.position.set(0, .12, z);

  const discMat = new THREE.MeshBasicMaterial({
    map: riftTexture, color: hdr(color, 1.35), transparent: true, opacity: .7,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.userData.portalBaseOpacity = .7;
  portal.add(disc);

  // A second luminous layer and a compact core create the impression of a deep opening.
  const innerMat = new THREE.MeshBasicMaterial({
    map: riftTexture, color: hdr(NEON.violet, 1.8), transparent: true, opacity: .48,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const innerDisc = new THREE.Mesh(new THREE.CircleGeometry(radius * .64, 48), innerMat);
  innerDisc.rotation.x = -Math.PI / 2;
  innerDisc.position.y = .025;
  innerDisc.userData.portalBaseOpacity = .48;
  portal.add(innerDisc);

  const coreMat = new THREE.MeshBasicMaterial({
    map: glowTexture, color: hdr(NEON.pink, 2.4), transparent: true, opacity: .76,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const coreGlow = new THREE.Mesh(new THREE.CircleGeometry(radius * .42, 48), coreMat);
  coreGlow.rotation.x = -Math.PI / 2;
  coreGlow.position.y = .045;
  coreGlow.userData.portalBaseOpacity = .76;
  portal.add(coreGlow);

  const ringMat = new THREE.MeshBasicMaterial({
    color: hdr(color, 1.8), transparent: true, opacity: .98,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(radius * .9, .13, 10, 80), ringMat);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.userData.portalBaseOpacity = .98;
  portal.add(outerRing);

  const innerRingMat = ringMat.clone();
  innerRingMat.color.set(hdr(0xffc36b, 2.1));
  innerRingMat.opacity = .82;
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(radius * .59, .065, 8, 64), innerRingMat);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.userData.portalBaseOpacity = .82;
  portal.add(innerRing);

  if (isBoss) {
    const wellMat = new THREE.MeshBasicMaterial({
      map: riftTexture, color: hdr(NEON.violet, 2.2), transparent: true, opacity: .62,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const well = new THREE.Mesh(new THREE.CircleGeometry(radius * .34, 48), wellMat);
    well.rotation.x = -Math.PI / 2;
    well.position.y = .065;
    well.userData.portalBaseOpacity = .62;
    portal.add(well);

    const coreRingMat = ringMat.clone();
    coreRingMat.color.set(hdr(NEON.cyan, 2.2));
    coreRingMat.opacity = .78;
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(radius * .33, .09, 10, 64), coreRingMat);
    coreRing.rotation.x = Math.PI / 2;
    coreRing.userData.portalBaseOpacity = .78;
    portal.add(coreRing);
  }

  const portalLight = new THREE.PointLight(NEON.orange, isBoss ? 66 : 42, radius * (isBoss ? 5.2 : 4.2), 2);
  portalLight.position.set(0, 1.2, 0);
  portalLight.userData.baseIntensity = isBoss ? 66 : 42;
  portal.add(portalLight);
  let portalFill = null;
  if (isBoss) {
    portalFill = new THREE.PointLight(NEON.violet, 34, radius * 4.5, 2);
    portalFill.position.set(0, .8, 0);
    portalFill.userData.baseIntensity = 34;
    portal.add(portalFill);
  }

  portal.scale.setScalar(.035);
  world.add(portal);
  activeFx.push({ mesh: portal, age: 0, lifetime: 1.5, isPortal: true, portalLight, portalFill });
  spawnPortalSparks(z, radius * .9, color);
}

function spawnPortalSparks(z, radius, color) {
  const count = 132;
  const positions = new Float32Array(count * 3);
  const velocity = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = radius * (.82 + Math.random() * .3);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = .12 + Math.random() * .48;
    positions[i * 3 + 2] = z + Math.sin(angle) * r;
    const speed = .8 + Math.random() * 2.1;
    velocity.push(new THREE.Vector3(Math.cos(angle) * speed, 1.8 + Math.random() * 4.2, Math.sin(angle) * speed));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    map: glowTexture, color: hdr(NEON.orange, 2.8), size: .46, transparent: true,
    opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  world.add(points);
  activeFx.push({ mesh: points, positions, velocity, age: 0, lifetime: 1.65, isPoints: true });
}

function startEncounter(kind) {
  const isBoss = kind === 'boss';
  const isSecondWave = kind === 'secondWave';
  const enemyElement = isBoss ? 'water' : isSecondWave ? 'fire' : 'electric';
  const weakness = Object.keys(ELEMENT_COUNTER).find((element) => ELEMENT_COUNTER[element] === enemyElement);
  const baseDuration = isBoss ? 6.4 : isSecondWave ? 4.8 : 4.2;
  game.phase = isBoss ? 'boss' : 'battle';
  game.encounter = {
    kind, elapsed: 0, pulseTimer: 0,
    duration: baseDuration * (game.element === 'electric' ? .9 : 1),
    resolved: false, spawnProgress: 0, enemyElement, weakness,
    phase: 1, attackTurn: 0,
  };
  game.targetX = 0;
  game.enemyRoot.visible = !isBoss;
  if (!isBoss) setEnemyFormationElement(enemyElement);
  const spawnZ = isBoss ? FINAL_BOSS_Z - 4.5 : isSecondWave ? SECOND_WAVE_Z + 3.2 : -63.8;
  game.enemyRoot.position.set(0, -2.7, isBoss ? FINAL_BOSS_Z + 5.5 : spawnZ);
  game.enemyRoot.scale.setScalar(.42);
  if (isBoss && game.enemyBoss) {
    const core = game.enemyBoss.userData.core;
    const halo = game.enemyBoss.userData.halo;
    core.material.color.copy(game.enemyBoss.userData.baseCoreColor);
    core.material.emissive.copy(game.enemyBoss.userData.baseCoreEmissive);
    core.material.emissiveIntensity = game.enemyBoss.userData.baseCoreIntensity;
    halo.material.emissive.copy(game.enemyBoss.userData.baseHaloEmissive);
    halo.material.emissiveIntensity = game.enemyBoss.userData.baseHaloIntensity;
    game.enemyBoss.visible = true;
    game.enemyBoss.position.set(0, -3.2, spawnZ);
    game.enemyBoss.scale.setScalar(.34);
    game.cameraShake = 1.05;
  }
  const portalCenterZ = isBoss ? spawnZ : spawnZ - 3.82;
  const enemyColor = gateLabels[enemyElement].color;
  openEnemyPortal(portalCenterZ, isBoss ? 5.6 : 5.15, enemyColor, isBoss);
  battleBanner.classList.add('visible');
  battleBanner.classList.remove('phase-two');
  battleKicker.textContent = `WEAK TO ${gateLabels[weakness].label}`;
  battleTitle.textContent = isBoss ? 'RIFT WARDEN' : isSecondWave ? 'RIFT SENTRIES' : 'SHADOW GUARD';
  battleSubtitle.textContent = `${gateLabels[enemyElement].label} ENEMY // ${gateLabels[weakness].label} COUNTERS`;
  enemyHealth.style.width = '100%';
  document.querySelector('#mission-title').textContent = isBoss ? 'BREAK THE RIFT WARDEN' : isSecondWave ? 'DEFEAT THE RIFT SENTRIES' : 'DEFEAT THE SHADOW GUARD';
  setFeedback(`${battleTitle.textContent} // WEAK TO ${gateLabels[weakness].label}`, '#ff4d6d');
}

function finishGame(won, copy) {
  game.phase = won ? 'won' : 'lost';
  pauseButton.classList.add('is-hidden');
  game.encounter = null;
  game.enemyRoot.visible = false;
  if (game.enemyBoss) game.enemyBoss.visible = false;
  battleBanner.classList.remove('visible');
  const minutes = String(Math.floor(game.elapsed / 60)).padStart(2, '0');
  const seconds = String(Math.floor(game.elapsed % 60)).padStart(2, '0');
  document.querySelector('#end-kicker').textContent = `${won ? 'MISSION COMPLETE' : 'FORMATION LOST'} // ${minutes}:${seconds}`;
  document.querySelector('#end-title').innerHTML = won ? 'THE RIFT<br /><em>IS SEALED.</em>' : 'THE FRONTIER<br /><em>FELL.</em>';
  document.querySelector('#end-copy').textContent = copy;
  document.querySelector('#end-units').textContent = String(game.count).padStart(2, '0');
  document.querySelector('#end-element').textContent = gateLabels[game.element].label;
  endScreen.classList.remove('is-hidden');
  document.querySelector('#hint-text').textContent = won ? 'FRONTIER STATUS // SECURE' : 'RIFTWAY STATUS // OVERRUN';
  updateHud();
}

function resolveEncounter() {
  if (!game.encounter || game.encounter.resolved) return;
  game.encounter.resolved = true;
  const isBoss = game.encounter.kind === 'boss';
  const isSecondWave = game.encounter.kind === 'secondWave';
  const waterWard = game.element === 'water' && game.waterShields > 0;
  const enemyElement = game.encounter.enemyElement;
  const hasCounter = ELEMENT_COUNTER[game.element] === enemyElement;
  const isCountered = ELEMENT_COUNTER[enemyElement] === game.element;
  const matchupBonus = hasCounter ? 1.4 : isCountered ? .72 : 1;
  const exposedCoreBonus = isBoss && game.encounter.phase === 2 && hasCounter ? 1.2 : 1;
  const elementalBonus = game.element === 'fire' ? 1.25 : game.element === 'electric' ? 1.12 : 1;
  const strength = game.count * elementalBonus * matchupBonus * exposedCoreBonus + game.power + (waterWard ? 3 : 0);
  const threat = isBoss ? 28 : isSecondWave ? 22 : 17;
  if (strength < threat) {
    finishGame(false, isBoss ? 'The Warden overwhelmed the formation before the core could break.' : isSecondWave ? 'The Rift Sentries scattered the formation before the Warden.' : 'The Shadow Guard scattered the formation. The Rift is still ahead.');
    return;
  }
  if (isBoss) {
    game.defeatedBoss = true;
    if (waterWard) game.waterShields--;
    game.count = Math.max(1, game.count - Math.max(1, Math.round(9 - game.power * .2 - (waterWard ? 2 : 0) - (game.element === 'electric' ? 1 : 0) - (hasCounter ? 3 : isCountered ? -2 : 0))));
    updateHud();
    spawnImpact(new THREE.Vector3(0, 2.1, FINAL_BOSS_Z - 4.5), new THREE.Color(gateLabels[game.element].color), 3.2);
    finishGame(true, `The Warden fell to your ${gateLabels[game.element].label.toLowerCase()} formation. ${game.count} units made it out.`);
    return;
  }
  if (waterWard) game.waterShields--;
  if (isSecondWave) game.defeatedSecondWave = true;
  else game.defeatedWave = true;
  const baseLosses = isSecondWave ? 7 : 6;
  const losses = Math.max(2, Math.round(baseLosses - game.power * .25 - (waterWard ? 2 : 0) - (game.element === 'electric' ? 2 : 0)));
  game.count = Math.max(1, game.count - losses);
  rebuildFormation();
  updateHud();
  game.phase = 'running';
  game.encounter = null;
  game.enemyRoot.visible = false;
  battleBanner.classList.remove('visible');
  game.targetX = 0;
  document.querySelector('#mission-title').textContent = isSecondWave ? 'REACH THE RIFT WARDEN' : 'REACH THE RIFT SENTRIES';
  document.querySelector('#mission-copy').textContent = isSecondWave ? 'Last stretch. Choose your final gates.' : 'First guard defeated. Keep building your army.';
  setFeedback(`${isSecondWave ? 'RIFT SENTRIES' : 'SHADOW GUARD'} CLEARED // -${losses} UNITS`, '#53f6ff');
}

function handleWorldEvents(previousZ, currentZ) {
  riftTexture.offset.y = (game.clockTime * .11) % 1;
  for (const gate of gateRecords) {
    if (gate.resolved || !(previousZ > gate.z && currentZ <= gate.z)) continue;
    const hitGate = chooseGate(gate.route);
    if (hitGate) applyGate(hitGate); else missGate(gate.route);
  }
  for (const obstacle of obstacles) {
    if (obstacle.resolved || !(previousZ > obstacle.z && currentZ <= obstacle.z)) continue;
    obstacle.resolved = true;
    const dx = Math.abs(game.playerX - obstacle.x);
    if (dx < 1.38) {
      if (game.element === 'electric') {
        setFeedback('ELECTRIC ARC // SHOCK PYLON DISABLED', gateLabels.electric.hex);
        spawnImpact(new THREE.Vector3(obstacle.x, 1, obstacle.z), new THREE.Color(gateLabels.electric.color), 1.8);
        continue;
      }
      if (game.element === 'water' && game.waterShields > 0) {
        game.waterShields--;
        updateHud();
        setFeedback(`WATER WARD ABSORBED THE HIT // ${game.waterShields} LEFT`, gateLabels.water.hex);
        spawnImpact(new THREE.Vector3(game.playerX, 1.2, game.playerZ), new THREE.Color(gateLabels.water.color), 1.8);
        continue;
      }
      const loss = Math.min(3, Math.max(1, game.count - 1));
      game.count -= loss;
      game.cameraShake = Math.max(game.cameraShake, .78);
      game.damageFlash = Math.max(game.damageFlash, .92);
      rebuildFormation();
      updateHud();
      setFeedback(`SHOCK PYLON // −${loss} UNITS`, '#ff4d6d');
      spawnImpact(new THREE.Vector3(obstacle.x, .7, obstacle.z), new THREE.Color(0xff4d58), 1.5);
    } else {
      setFeedback('HAZARD CLEARED // FORMATION INTACT', '#53f6ff');
    }
  }
  if (!game.defeatedWave && previousZ > -67 && currentZ <= -67) startEncounter('wave');
  if (game.defeatedWave && !game.defeatedSecondWave && previousZ > SECOND_WAVE_Z && currentZ <= SECOND_WAVE_Z) startEncounter('secondWave');
  if (game.defeatedSecondWave && !game.defeatedBoss && previousZ > FINAL_BOSS_Z && currentZ <= FINAL_BOSS_Z) startEncounter('boss');
}

function updateFormation(time) {
  for (let i = 0; i < game.visualUnits.length; i++) {
    const unit = game.visualUnits[i];
    if (!unit.anchor.visible) continue;
    const columnCount = 6;
    const row = Math.floor(Math.max(0, i - 1) / columnCount);
    const col = (Math.max(0, i - 1) % columnCount) - (columnCount - 1) / 2;
    const leader = i === 0;
    const lateral = leader ? 0 : col * .68;
    const depth = leader ? 0 : 1.1 + row * .82;
    unit.anchor.position.x += (game.playerX + lateral - unit.anchor.position.x) * .25;
    unit.anchor.position.z += (game.playerZ + depth - unit.anchor.position.z) * .25;
    const stride = game.phase === 'running' ? 1 : .22;
    const run = Math.sin(time * 9 + unit.phase);
    unit.group.position.y = .04 + Math.abs(run) * .06 * stride;
    if (unit.armL) unit.armL.rotation.z = run * .3 * stride;
    if (unit.armR) unit.armR.rotation.z = -run * .3 * stride;
    if (unit.legL) unit.legL.rotation.x = run * .26 * stride;
    if (unit.legR) unit.legR.rotation.x = -run * .26 * stride;
  }
  vfxRoot.position.set(game.playerX, 0, game.playerZ + .15);
}

function animateParticles(dt) {
  if (!game.particleSystem) return;
  const { points, positions, velocities, ages, lifetimes, count } = game.particleSystem;
  const on = game.phase === 'running' || game.phase === 'battle' || game.phase === 'boss';
  points.visible = on;
  for (let i = 0; i < count; i++) {
    ages[i] += dt;
    if (ages[i] > lifetimes[i]) {
      ages[i] = 0;
      positions[i * 3] = (Math.random() - .5) * 1.9;
      positions[i * 3 + 1] = .05;
      positions[i * 3 + 2] = Math.random() * 3.5;
      velocities[i].set((Math.random() - .5) * .7, .35 + Math.random() * .75, (Math.random() - .5) * .45);
    } else {
      positions[i * 3] += velocities[i].x * dt;
      positions[i * 3 + 1] += velocities[i].y * dt;
      positions[i * 3 + 2] += velocities[i].z * dt;
      velocities[i].y += (game.element === 'water' ? .08 : -.25) * dt;
    }
  }
  points.geometry.attributes.position.needsUpdate = true;
  if (game.element === 'electric') {
    game.electricRefresh -= dt;
    if (game.electricRefresh <= 0) { refreshElectricArcs(); game.electricRefresh = .075; }
    game.electricVfx.group.position.set(game.playerX, 0, game.playerZ + .15);
    game.electricVfx.group.visible = on;
  }
}

function updateWorldObjects(time) {
  for (const item of trackObjects) {
    if (item.riftRing) item.object.rotation.z += item.spin;
    if (item.beacon) item.light.material.color.copy(item.tint).multiplyScalar(1.6 + .9 * Math.sin(time * 2.4 + item.phase));
  }
  for (const gate of gateRecords) {
    const pulse = .84 + .27 * Math.sin(time * 2.8 + gate.phase);
    const dimmed = gate.resolved;
    const flash = Math.max(0, Math.min(1, (gate.flashUntil - time) / .42));
    gate.ring.rotation.z += .006;
    gate.ringMat.emissiveIntensity = Math.max(dimmed ? .12 : gate.id === game.selectedGate ? 3.6 : pulse * 2.2, flash * 7);
    gate.portalMat.opacity = Math.max(dimmed ? .025 : .09 + .07 * (Math.sin(time * 2 + gate.phase) * .5 + .5), flash * .88);
    gate.portalMat.emissiveIntensity = .72 + flash * 4.5;
    gate.frameMat.emissiveIntensity = Math.max(dimmed ? .18 : 1.9, flash * 4.8);
    gate.pad.material.emissiveIntensity = dimmed ? .12 : .8;
    gate.signMat.opacity = dimmed ? .42 : 1;
    gate.hitZoneMaterial.opacity = dimmed ? .025 : .2;
    gate.group.scale.y = 1;
    gate.group.visible = true;
  }
  for (const obstacle of obstacles) {
    obstacle.ring.rotation.z += .01;
    obstacle.frame.material.emissiveIntensity = obstacle.resolved ? .14 : .92 + .54 * Math.sin(time * 3.3 + obstacle.phase);
    obstacle.core.material.transparent = true;
    obstacle.core.material.opacity = obstacle.resolved ? .24 : 1;
    obstacle.core.material.color.copy(obstacle.coreBase).multiplyScalar(obstacle.resolved ? .28 : 1);
    obstacle.group.scale.setScalar(obstacle.resolved ? .58 : 1);
    obstacle.group.visible = true;
  }
  waveArena.halo.rotation.z += .002;
  secondWaveArena.halo.rotation.z -= .0023;
  bossArena.halo.rotation.z -= .0026;
  if (game.enemyBoss) {
    game.enemyBoss.userData.core.rotation.y += .03;
    game.enemyBoss.userData.halo.rotation.z += .012;
    game.enemyBoss.position.y = game.enemyBoss.visible ? .12 + Math.sin(time * 2.2) * .12 : 0;
  }
}

function applyPortalIllumination(root, strength) {
  if (!root) return;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || !material.emissive) continue;
      if (!material.userData.portalBaseEmissive) {
        material.userData.portalBaseEmissive = material.emissive.clone();
        material.userData.portalBaseEmissiveIntensity = material.emissiveIntensity || 0;
      }
      material.emissive.copy(material.userData.portalBaseEmissive)
        .lerp(new THREE.Color(NEON.orange), strength * .62);
      material.emissiveIntensity = material.userData.portalBaseEmissiveIntensity + strength * 1.35;
    }
  });
}

function updateEncounter(dt) {
  if (!game.encounter) return;
  const encounter = game.encounter;
  encounter.elapsed += dt;
  encounter.pulseTimer += dt;
  encounter.spawnProgress = Math.min(1, encounter.spawnProgress + dt / 1.15);
  const emerge = encounter.spawnProgress * encounter.spawnProgress * (3 - 2 * encounter.spawnProgress);
  const illuminationFade = Math.max(0, 1 - Math.max(0, encounter.elapsed - 1.05) / 2.15);
  const portalIllumination = Math.min(1, encounter.spawnProgress / .3) * illuminationFade;
  const isBoss = encounter.kind === 'boss';

  if (isBoss && game.enemyBoss) {
    if (encounter.phase === 1) applyPortalIllumination(game.enemyBoss, portalIllumination);
    game.enemyBoss.position.y = -3.2 * (1 - emerge) + Math.sin(game.clockTime * 2.2) * .12 * emerge;
    game.enemyBoss.scale.setScalar(.34 + .66 * emerge);
  } else {
    game.enemyUnits.forEach((unit, index) => {
      applyPortalIllumination(unit.anchor, portalIllumination);
      const swing = Math.sin(game.clockTime * 7 + unit.phase);
      if (unit.armL) unit.armL.rotation.z = swing * .52;
      if (unit.armR) unit.armR.rotation.z = -swing * .52;
      if (unit.legL) unit.legL.rotation.x = -swing * .28;
      if (unit.legR) unit.legR.rotation.x = swing * .28;
      unit.anchor.position.y = Math.sin(game.clockTime * 5 + index) * .08;
    });
    game.enemyRoot.position.y = -2.7 * (1 - emerge);
    game.enemyRoot.scale.setScalar(.42 + .58 * emerge);
  }

  const progress = Math.min(1, encounter.elapsed / encounter.duration);
  if (isBoss && encounter.phase === 1 && progress >= .46) {
    encounter.phase = 2;
    const core = game.enemyBoss.userData.core;
    const halo = game.enemyBoss.userData.halo;
    core.material.color.set(0x50d7ff);
    core.material.emissive.set(0x24cfff);
    core.material.emissiveIntensity = 4.8;
    halo.material.emissive.set(0x24cfff);
    halo.material.emissiveIntensity = 4.2;
    game.cameraShake = Math.max(game.cameraShake, .7);
    battleBanner.classList.add('phase-two');
    battleKicker.textContent = 'PHASE 02 // CORE EXPOSED';
    battleSubtitle.textContent = 'WATER CORE // FIRE ADVANTAGE AMPLIFIED';
    setFeedback('WARDEN SHIELD BROKEN // CORE EXPOSED', '#53e8ff');
    spawnImpact(new THREE.Vector3(0, 2.05, FINAL_BOSS_Z - 4.5), new THREE.Color(0x34d8ff), 3.4);
  }

  const firstPhase = isBoss && progress < .46;
  const health = isBoss
    ? firstPhase ? 1 - (progress / .46) * .42 : .58 * (1 - ((progress - .46) / .54))
    : 1 - progress;
  enemyHealth.style.width = `${Math.max(0, health) * 100}%`;

  const attackInterval = isBoss && encounter.phase === 2 ? .42 : .68;
  if (encounter.pulseTimer >= attackInterval) {
    encounter.pulseTimer = 0;
    const playerPosition = new THREE.Vector3(game.playerX, 1.05, game.playerZ + .15);
    const enemyPosition = isBoss
      ? new THREE.Vector3(game.enemyBoss.position.x, 2.15, game.enemyBoss.position.z + .75)
      : new THREE.Vector3((Math.random() - .5) * 2.4, 1.25, encounter.kind === 'secondWave' ? SECOND_WAVE_Z + 1.5 : -64.8);
    const playerStrikes = encounter.attackTurn % 2 === 0;
    if (playerStrikes) {
      const hitColor = gateLabels[game.element].color;
      spawnBattleStrike(playerPosition, enemyPosition, hitColor);
      if (isBoss) game.enemyBoss.userData.core.material.emissiveIntensity = encounter.phase === 2 ? 6.2 : 3.3;
    } else {
      spawnBattleStrike(enemyPosition, playerPosition, 0xff315c, true);
      game.cameraShake = Math.max(game.cameraShake, isBoss && encounter.phase === 2 ? .34 : .18);
    }
    encounter.attackTurn++;
  }
  if (encounter.elapsed >= encounter.duration) resolveEncounter();
}

function pickGate(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(gateTargets, false);
  const hit = intersections.find((item) => item.object.userData.gate && !item.object.userData.gate.resolved);
  return hit?.object.userData.gate || null;
}

canvas.addEventListener('pointermove', (event) => {
  const gate = pickGate(event);
  game.hoveredGate = gate?.id || null;
  canvas.style.cursor = gate && game.phase === 'running' ? 'pointer' : 'default';
});
canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  const gate = pickGate(event);
  if (gate && game.phase === 'running') {
    canvas.dataset.pointerX = '';
    selectGate(gate);
  } else {
    canvas.dataset.pointerX = String(event.clientX);
  }
});
canvas.addEventListener('pointerup', (event) => {
  const startX = Number(canvas.dataset.pointerX);
  if (Number.isFinite(startX) && startX > 0 && Math.abs(event.clientX - startX) > 42) steer(event.clientX > startX ? 1 : -1);
  canvas.dataset.pointerX = '';
});

function steer(direction) {
  if (game.phase !== 'running') return;
  const lane = game.targetX < -1 ? -1 : game.targetX > 1 ? 1 : 0;
  const next = THREE.MathUtils.clamp(lane + direction, -1, 1);
  game.targetX = next * 2.45;
  if (game.selectedGate) game.selectedGate = null;
}
document.querySelector('#steer-left').addEventListener('click', () => steer(-1));
document.querySelector('#steer-right').addEventListener('click', () => steer(1));

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
    if (game.phase === 'paused') resumeGame();
    else pauseGame();
    return;
  }
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') steer(-1);
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') steer(1);
  if ((event.key === 'Enter' || event.key === ' ') && game.phase === 'menu') startRun();
  if (event.key.toLowerCase() === 'r' && ['won', 'lost'].includes(game.phase)) resetRun();
});

function startRun() {
  if (!game.modelReady || game.phase !== 'menu') return;
  game.phase = 'running';
  game.elapsed = 0;
  pauseButton.classList.remove('is-hidden');
  startScreen.classList.add('is-hidden');
  document.querySelector('#hint-text').textContent = 'DODGE THE SHOCK PYLONS';
  document.querySelector('#mission-title').textContent = 'REACH THE RIFT';
  document.querySelector('#mission-copy').textContent = 'Random gates can trade units for power. Counter enemy elements to reduce losses.';
  setFeedback('FORMATION DEPLOYED // CHOOSE A GATE', '#53f6ff');
}

function resetRun() {
  game.phase = 'menu';
  game.pausedFrom = null;
  game.cameraShake = 0;
  pauseScreen.classList.add('is-hidden');
  pauseButton.classList.add('is-hidden');
  game.playerZ = 2.4;
  game.previousZ = 2.4;
  game.playerX = 0;
  game.targetX = 0;
  game.count = 12;
  game.element = 'fire';
  game.power = 0;
  game.waterShields = 0;
  game.selectedGate = null;
  game.routeStep = 1;
  game.defeatedWave = false;
  game.defeatedSecondWave = false;
  game.defeatedBoss = false;
  game.elapsed = 0;
  game.encounter = null;
  for (const gate of gateRecords) gate.resolved = false;
  rerollGateOffers();
  for (const obstacle of obstacles) obstacle.resolved = false;
  for (const effect of activeFx) {
    world.remove(effect.mesh);
    if (effect.mesh.isGroup) {
      effect.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
        }
      });
    } else {
      effect.mesh.geometry?.dispose();
      for (const material of Array.isArray(effect.mesh.material) ? effect.mesh.material : [effect.mesh.material]) material?.dispose();
    }
  }
  activeFx.length = 0;
  if (game.enemyBoss) {
    game.enemyBoss.visible = false;
    const core = game.enemyBoss.userData.core;
    const halo = game.enemyBoss.userData.halo;
    core.material.color.copy(game.enemyBoss.userData.baseCoreColor);
    core.material.emissive.copy(game.enemyBoss.userData.baseCoreEmissive);
    core.material.emissiveIntensity = game.enemyBoss.userData.baseCoreIntensity;
    halo.material.emissive.copy(game.enemyBoss.userData.baseHaloEmissive);
    halo.material.emissiveIntensity = game.enemyBoss.userData.baseHaloIntensity;
  }
  game.enemyRoot.visible = false;
  battleBanner.classList.remove('phase-two');
  battleBanner.classList.remove('visible');
  endScreen.classList.add('is-hidden');
  startScreen.classList.remove('is-hidden');
  document.querySelector('#mission-title').textContent = 'REACH THE RIFT';
  document.querySelector('#mission-copy').textContent = 'Build your formation. Lead them through.';
  document.querySelector('#hint-text').textContent = 'DODGE THE SHOCK PYLONS';
  if (game.particleSystem) game.particleSystem.ages.fill(0);
  setElement('fire');
  rebuildFormation();
  updateHud();
}

function pauseGame() {
  if (!['running', 'battle', 'boss'].includes(game.phase)) return;
  game.pausedFrom = game.phase;
  game.phase = 'paused';
  pauseScreen.classList.remove('is-hidden');
}
function resumeGame() {
  if (game.phase !== 'paused') return;
  game.phase = game.pausedFrom || 'running';
  game.pausedFrom = null;
  pauseScreen.classList.add('is-hidden');
}
startButton.addEventListener('click', startRun);
restartButton.addEventListener('click', resetRun);
pauseButton.addEventListener('click', pauseGame);
document.querySelector('#resume-button').addEventListener('click', resumeGame);

function update(dt) {
  if (game.phase === 'paused') return;
  game.clockTime += dt;
  game.damageFlash = Math.max(0, game.damageFlash - dt * 3.5);
  impactFlash.style.opacity = String(game.damageFlash);
  if (['running', 'battle', 'boss'].includes(game.phase)) game.elapsed += dt;
  updateWorldObjects(game.clockTime);
  updateCity(game.clockTime, dt);
  updateFx(dt);
  animateParticles(dt);

  if (game.phase === 'running') {
    game.previousZ = game.playerZ;
    game.playerX += (game.targetX - game.playerX) * Math.min(1, dt * 6.5);
    game.playerZ -= game.speed * dt;
    rebuildFormation();
    handleWorldEvents(game.previousZ, game.playerZ);
  } else if (game.phase === 'battle' || game.phase === 'boss') {
    game.playerX += (0 - game.playerX) * Math.min(1, dt * 1.8);
    rebuildFormation();
    updateEncounter(dt);
  } else {
    game.playerX += (game.targetX - game.playerX) * Math.min(1, dt * 2);
    if (game.phase === 'menu') game.playerZ = 2.4;
  }
  updateFormation(game.clockTime);

  if (game.feedbackTimer > 0) {
    game.feedbackTimer -= dt;
    if (game.feedbackTimer <= 0) feedbackEl.classList.remove('show');
  }

  const cameraX = game.playerX * .33;
  keyLight.position.set(game.playerX - 8, 18, game.playerZ + 8);
  keyLight.target.position.set(game.playerX, 0, game.playerZ - 4);
  keyLight.target.updateMatrixWorld();
  const desiredCamera = new THREE.Vector3(cameraX, 8.7, game.playerZ + 12.7);
  camera.position.lerp(desiredCamera, Math.min(1, dt * 2.6));
  if (game.cameraShake > 0) {
    game.cameraShake = Math.max(0, game.cameraShake - dt);
    const fade = game.cameraShake / 1.05;
    const strength = .24 * fade;
    camera.position.x += Math.sin(game.clockTime * 52) * strength;
    camera.position.y += Math.cos(game.clockTime * 43) * strength * .55;
  }
  camera.lookAt(game.playerX * .45, 2.2, game.playerZ - 13);
  magentaFill.position.set(game.playerX - 4.5, 3.8, game.playerZ + 1.3);
  cyanFill.position.set(game.playerX + 5, 5, game.playerZ - 14);
  updateRain(dt);
  updateHud();
}

function render() {
  requestAnimationFrame(render);
  const dt = Math.min(.035, clock.getDelta());
  update(dt);
  if (composer) composer.render(); else renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(width, height);
  }
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

let gameInitialized = false;
function initializeGame(modelTemplate) {
  if (gameInitialized) return;
  gameInitialized = true;
  game.modelTemplate = modelTemplate || null;
  if (game.modelTemplate) {
    game.modelTemplate.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
  try {
    game.modelReady = true;
    createBoss();
    createEnemyFormation();
    rebuildFormation();
    createElementParticles();
    updateHud();
  } catch (error) {
    console.error('Game initialization failed; using procedural fallback.', error);
    game.modelTemplate = null;
    try {
      if (!game.enemyBoss) createBoss();
      if (game.enemyUnits.length === 0) createEnemyFormation();
      rebuildFormation();
      if (!game.particleSystem) createElementParticles();
      updateHud();
    } catch (fallbackError) {
      console.error('Procedural fallback initialization failed.', fallbackError);
    }
  } finally {
    loadingScreen.classList.add('done');
  }
}

const modelLoadTimeout = window.setTimeout(() => {
  if (gameInitialized) return;
  console.warn('Character model load timed out; starting with procedural characters.');
  initializeGame(null);
}, 10000);

new GLTFLoader().load('./assets/ember-captain.gltf', (gltf) => {
  window.clearTimeout(modelLoadTimeout);
  initializeGame(gltf.scene);
}, undefined, (error) => {
  window.clearTimeout(modelLoadTimeout);
  console.warn('Character model could not be loaded; using procedural characters.', error);
  initializeGame(null);
});

render();
