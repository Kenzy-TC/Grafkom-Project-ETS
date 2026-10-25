import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.querySelector('#scene');
const loadingScreen = document.querySelector('#loading-screen');
const startScreen = document.querySelector('#start-screen');
const endScreen = document.querySelector('#end-screen');
const startButton = document.querySelector('#start-button');
const restartButton = document.querySelector('#restart-button');
const gateLabels = {
  fire: { color: 0xff7947, hex: '#ff7947', label: 'FIRE', glyph: '✦', name: 'FIREKIN' },
  water: { color: 0x58cce8, hex: '#58cce8', label: 'WATER', glyph: '≈', name: 'TIDEBORN' },
  electric: { color: 0x6cdeef, hex: '#6cdeef', label: 'ELECTRIC', glyph: 'ϟ', name: 'STORMKIN' },
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08131f);
scene.fog = new THREE.FogExp2(0x08131f, 0.0085);
const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 240);
camera.position.set(0, 8.8, 13.3);
const clock = new THREE.Clock();

const hemiLight = new THREE.HemisphereLight(0x9cd4e1, 0x121522, 1.1);
scene.add(hemiLight);
const keyLight = new THREE.DirectionalLight(0xffe5ce, 3.1);
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
const warmFill = new THREE.PointLight(0xff7044, 22, 20, 2);
warmFill.position.set(4, 4, 2);
scene.add(warmFill);
const coolFill = new THREE.PointLight(0x4cbbd6, 26, 25, 2);
coolFill.position.set(-5, 5, -19);
scene.add(coolFill);

const world = new THREE.Group();
scene.add(world);
const roadWidth = 11.5;
const roadLength = 148;
const roadMid = -68;
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
  playerZ: 2.4,
  playerX: 0,
  targetX: 0,
  count: 12,
  element: 'fire',
  power: 0,
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
  previousZ: 2.4,
  defeatedWave: false,
  defeatedBoss: false,
};
world.add(game.enemyRoot);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dummy = new THREE.Object3D();
const unitCountHud = document.querySelector('#unit-count');
const elementNameHud = document.querySelector('#element-name');
const elementEmblem = document.querySelector('#element-emblem');
const elementGlyph = document.querySelector('#element-glyph');
const progressFill = document.querySelector('#progress-fill');
const progressDot = document.querySelector('#progress-dot');
const progressPercent = document.querySelector('#progress-percent');
const routeStep = document.querySelector('#route-step');
const feedbackEl = document.querySelector('#feedback');
const battleBanner = document.querySelector('#battle-banner');
const battleKicker = document.querySelector('#battle-kicker');
const battleTitle = document.querySelector('#battle-title');
const battleSubtitle = document.querySelector('#battle-subtitle');
const enemyHealth = document.querySelector('#enemy-health');

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

function createRiftTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  const wash = ctx.createLinearGradient(0, 0, 128, 0);
  wash.addColorStop(0, 'rgba(46,161,187,.02)');
  wash.addColorStop(.5, 'rgba(90,218,226,.72)');
  wash.addColorStop(1, 'rgba(46,161,187,.02)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 128, 256);
  for (let y = -8; y < 270; y += 17) {
    ctx.beginPath();
    ctx.moveTo(5, y);
    for (let x = 0; x <= 128; x += 8) ctx.lineTo(x, y + Math.sin(x * .1 + y * .045) * 5);
    ctx.strokeStyle = `rgba(190,252,255,${.1 + Math.random() * .22})`;
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

function seedWorld() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 250),
    new THREE.MeshStandardMaterial({ color: 0x121a24, roughness: .96, metalness: .04 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -.48, -65);
  floor.receiveShadow = true;
  world.add(floor);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x18232d, roughness: .84, metalness: .22 });
  const road = addMesh(world, new THREE.BoxGeometry(roadWidth, .38, roadLength), roadMat, [0, -.22, roadMid], null, false, true);
  road.receiveShadow = true;
  const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x263641, roughness: .68, metalness: .32 });
  const shoulderGeo = new THREE.BoxGeometry(.42, .24, roadLength);
  addMesh(world, shoulderGeo, shoulderMat, [-roadWidth / 2 - .2, -.17, roadMid], null, false, true);
  addMesh(world, shoulderGeo, shoulderMat, [roadWidth / 2 + .2, -.17, roadMid], null, false, true);

  const seamMat = new THREE.MeshStandardMaterial({ color: 0x54717a, emissive: 0x1a6877, emissiveIntensity: .32, roughness: .46, metalness: .5 });
  const seamGeo = new THREE.BoxGeometry(.045, .026, roadLength - 2);
  addMesh(world, seamGeo, seamMat, [-roadWidth / 2 + .28, -.018, roadMid], null, false, false);
  addMesh(world, seamGeo, seamMat, [roadWidth / 2 - .28, -.018, roadMid], null, false, false);
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x81999c, emissive: 0x316879, emissiveIntensity: .22, roughness: .55 });
  const laneGeo = new THREE.BoxGeometry(.035, .02, 1.15);
  for (let z = 7; z > -142; z -= 3.1) {
    for (const x of [-1.9, 1.9]) addMesh(world, laneGeo, laneMat, [x, -.012, z], null, false, false);
  }

  const edgeGlowMat = new THREE.MeshBasicMaterial({ color: 0x49b7c6, transparent: true, opacity: .64 });
  const edgeGeo = new THREE.BoxGeometry(.075, .04, roadLength);
  addMesh(world, edgeGeo, edgeGlowMat, [-roadWidth / 2, -.035, roadMid], null, false, false);
  addMesh(world, edgeGeo, edgeGlowMat, [roadWidth / 2, -.035, roadMid], null, false, false);

  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x18343c, emissive: 0x115665, emissiveIntensity: .76, roughness: .34, metalness: .48 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x18232a, roughness: .9, metalness: .08 });
  const crystalGeo = new THREE.ConeGeometry(.55, 2.8, 5, 1);
  const ruinGeo = new THREE.BoxGeometry(1.2, 2.4, 1.1);
  let rand = 91237;
  const random = () => { rand = (rand * 16807) % 2147483647; return (rand - 1) / 2147483646; };
  for (let i = 0; i < 39; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = 10 - Math.floor(i / 2) * 7.2;
    const x = side * (7.5 + random() * 9.5);
    if (i % 3 === 0) {
      const crystal = addMesh(world, crystalGeo, crystalMat, [x, .55, z], [.65 + random() * .65, .8 + random(), .65 + random() * .6]);
      crystal.rotation.z = (random() - .5) * .22;
      crystal.rotation.y = random() * Math.PI;
      trackObjects.push({ object: crystal, crystal: true, phase: random() * 6 });
    } else {
      const ruin = addMesh(world, ruinGeo, stoneMat, [x, .58, z], [.8 + random() * 1.2, .45 + random() * 1.2, .7 + random()]);
      ruin.rotation.y = random() * Math.PI;
      trackObjects.push({ object: ruin, ruin: true, phase: random() * 6 });
    }
  }
  const stars = new Float32Array(360 * 3);
  for (let i = 0; i < 360; i++) {
    stars[i * 3] = (random() - .5) * 210;
    stars[i * 3 + 1] = 10 + random() * 60;
    stars[i * 3 + 2] = 20 - random() * 195;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
  world.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0x83aebb, size: .15, transparent: true, opacity: .52, sizeAttenuation: true, depthWrite: false })));
}

function makeGateTexture(title, subtitle, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(4,14,22,.94)'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.lineWidth = 3; ctx.strokeRect(8, 8, 496, 240);
  ctx.strokeStyle = 'rgba(205,240,240,.25)'; ctx.lineWidth = 1; ctx.strokeRect(16, 16, 480, 224);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.font = '500 27px monospace'; ctx.fillText('R I F T   G A T E', 256, 57);
  ctx.fillStyle = '#eef9f8'; ctx.font = '700 72px sans-serif'; ctx.fillText(title, 256, 138);
  ctx.fillStyle = '#a9c0c5'; ctx.font = '500 23px monospace'; ctx.fillText(subtitle, 256, 204);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGate(config) {
  const color = new THREE.Color(config.color);
  const group = new THREE.Group();
  group.position.set(config.side * 2.45, 0, config.z);
  world.add(group);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x203540, metalness: .8, roughness: .26, emissive: color, emissiveIntensity: .9 });
  const postGeo = new THREE.BoxGeometry(.14, 3.25, .2);
  addMesh(group, postGeo, frameMat, [-1.08, 1.62, 0]);
  addMesh(group, postGeo, frameMat, [1.08, 1.62, 0]);
  const top = addMesh(group, new THREE.BoxGeometry(2.3, .16, .24), frameMat, [0, 3.22, 0]);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x263c46, metalness: .78, roughness: .34, emissive: color, emissiveIntensity: .28 });
  const footGeo = new THREE.BoxGeometry(.48, .22, .48);
  addMesh(group, footGeo, footMat, [-1.08, .1, 0]);
  addMesh(group, footGeo, footMat, [1.08, .1, 0]);
  const portalMat = new THREE.MeshStandardMaterial({ color: 0xa5f7fc, map: riftTexture, emissive: color, emissiveMap: riftTexture, emissiveIntensity: .72, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, roughness: .22, metalness: .12 });
  const portal = addMesh(group, new THREE.PlaneGeometry(2.02, 2.75), portalMat, [0, 1.72, -.015], null, false, false);
  const ringMat = new THREE.MeshStandardMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), .26), emissive: color, emissiveIntensity: 2.2, metalness: .46, roughness: .2 });
  const ring = addMesh(group, new THREE.TorusGeometry(.6, .045, 8, 42), ringMat, [0, 1.72, .11], null, false, false);
  ring.scale.set(1.62, 2.35, 1);
  const labelTexture = makeGateTexture(config.title, config.subtitle, config.color);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.1), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: false, side: THREE.DoubleSide }));
  sign.position.set(0, 3.86, .015);
  sign.castShadow = false;
  group.add(sign);
  const targetMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: .001, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
  const target = new THREE.Mesh(new THREE.PlaneGeometry(2.12, 2.95), targetMaterial);
  target.position.set(0, 1.72, .2);
  target.userData.gate = config;
  group.add(target);
  gateTargets.push(target);
  const pad = addMesh(group, new THREE.BoxGeometry(2.55, .06, 1.85), new THREE.MeshStandardMaterial({ color: 0x182a32, metalness: .75, roughness: .38, emissive: color, emissiveIntensity: .24 }), [0, -.04, 0]);
  const record = { ...config, group, ring, ringMat, portal, portalMat, frameMat, pad, resolved: false, phase: Math.random() * 6 };
  gateRecords.push(record);
  return record;
}

const gateConfig = [
  { id: 'g1l', z: -14, side: -1, type: 'fireRecruit', title: '+5', subtitle: 'FIRE RECRUITS', color: gateLabels.fire.color, route: 'gate-1' },
  { id: 'g1r', z: -14, side: 1, type: 'multiply', title: '×2', subtitle: 'CLONE THE ARMY', color: 0xf3b967, route: 'gate-1' },
  { id: 'g2l', z: -32, side: -1, type: 'convertWater', title: 'WATER', subtitle: 'CONVERT FORMATION', color: gateLabels.water.color, route: 'gate-2' },
  { id: 'g2r', z: -32, side: 1, type: 'electricRecruit', title: '+5', subtitle: 'ELECTRIC RECRUITS', color: gateLabels.electric.color, route: 'gate-2' },
  { id: 'g3l', z: -50, side: -1, type: 'multiply', title: '×2', subtitle: 'CLONE THE ARMY', color: 0xf3b967, route: 'gate-3' },
  { id: 'g3r', z: -50, side: 1, type: 'convertElectric', title: 'STORM', subtitle: 'CONVERT FORMATION', color: gateLabels.electric.color, route: 'gate-3' },
];

function createObstacle(config) {
  const group = new THREE.Group();
  group.position.set(config.x, 0, config.z);
  world.add(group);
  const hazard = new THREE.MeshStandardMaterial({ color: 0x45242b, roughness: .52, metalness: .5, emissive: 0xff3d4e, emissiveIntensity: 1.7 });
  const frame = addMesh(group, new THREE.BoxGeometry(1.55, .78, .65), hazard, [0, .57, 0]);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffac74 });
  addMesh(group, new THREE.BoxGeometry(.94, .11, .7), coreMat, [0, .58, 0], null, false, false);
  const capMat = new THREE.MeshStandardMaterial({ color: 0x29343d, metalness: .88, roughness: .24, emissive: 0x732433, emissiveIntensity: .6 });
  addMesh(group, new THREE.CylinderGeometry(.22, .35, .28, 8), capMat, [-.77, .18, 0]);
  addMesh(group, new THREE.CylinderGeometry(.22, .35, .28, 8), capMat, [.77, .18, 0]);
  const ring = addMesh(group, new THREE.TorusGeometry(1.24, .045, 6, 32), hazard, [0, .18, 0], [1, 1, .55], false, false);
  ring.rotation.x = Math.PI / 2;
  obstacles.push({ ...config, group, frame, ring, resolved: false, phase: Math.random() * 6 });
}

function makePedestal(x, z, size = 8) {
  const base = addMesh(world, new THREE.CylinderGeometry(size * .46, size * .52, .38, 12), new THREE.MeshStandardMaterial({ color: 0x202d38, roughness: .66, metalness: .44, emissive: 0x162e3a, emissiveIntensity: .6 }), [x, -.12, z]);
  const halo = addMesh(world, new THREE.TorusGeometry(size * .44, .08, 10, 64), new THREE.MeshStandardMaterial({ color: 0x75dce2, emissive: 0x31bacd, emissiveIntensity: 1.5, metalness: .52, roughness: .24 }), [x, .1, z], null, false, false);
  halo.rotation.x = -Math.PI / 2;
  const center = addMesh(world, new THREE.CylinderGeometry(size * .32, size * .4, .055, 48), new THREE.MeshBasicMaterial({ color: 0x19434e, transparent: true, opacity: .42 }), [x, .1, z], null, false, false);
  return { base, halo, center, z };
}
const waveArena = makePedestal(0, -67, 8.8);
const bossArena = makePedestal(0, -107, 11.4);
for (const [x, z, color] of [[-5.7, -66, 0x65c9d5], [5.7, -66, 0x65c9d5], [-7.1, -107, 0xff865a], [7.1, -107, 0xff865a]]) {
  const beacon = addMesh(world, new THREE.CylinderGeometry(.17, .34, 4.8, 8), new THREE.MeshStandardMaterial({ color: 0x263843, emissive: color, emissiveIntensity: .55, roughness: .3, metalness: .7 }), [x, 2.2, z]);
  const light = addMesh(world, new THREE.SphereGeometry(.29, 16, 12), new THREE.MeshBasicMaterial({ color }), [x, 4.65, z], null, false, false);
  trackObjects.push({ object: beacon, light, beacon: true, phase: Math.random() * 6 });
}

seedWorld();
gateConfig.forEach(createGate);
createObstacle({ id: 'o1', z: -24, x: 0 });
createObstacle({ id: 'o2', z: -41, x: -2.55 });
createObstacle({ id: 'o3', z: -58, x: 2.55 });

function elementMaterial(element, transparent = false) {
  const palette = gateLabels[element];
  const color = new THREE.Color(palette.color);
  return new THREE.MeshStandardMaterial({
    color: element === 'fire' ? 0xffa26b : element === 'water' ? 0x4bb8df : 0x66d8f0,
    emissive: color,
    emissiveIntensity: element === 'fire' ? .34 : element === 'water' ? .22 : .6,
    metalness: .42,
    roughness: element === 'water' ? .23 : .39,
    transparent,
    opacity: transparent ? .78 : 1,
  });
}

function createFallbackWarrior() {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xffa26b, metalness: .4, roughness: .38 });
  addMesh(group, new THREE.CapsuleGeometry(.28, .66, 3, 6), baseMat, [0, .97, 0]);
  addMesh(group, new THREE.SphereGeometry(.24, 8, 6), baseMat, [0, 1.65, 0]);
  addMesh(group, new THREE.ConeGeometry(.19, .38, 5), baseMat, [0, 1.96, -.02]);
  const armL = addMesh(group, new THREE.BoxGeometry(.15, .6, .16), baseMat, [-.42, 1.02, 0]);
  const armR = addMesh(group, new THREE.BoxGeometry(.15, .6, .16), baseMat, [.42, 1.02, 0]);
  const legL = addMesh(group, new THREE.BoxGeometry(.18, .54, .2), baseMat, [-.17, .35, 0]);
  const legR = addMesh(group, new THREE.BoxGeometry(.18, .54, .2), baseMat, [.17, .35, 0]);
  return { group, armL, armR, legL, legR };
}

function recolorWarrior(model, element) {
  const oldMaterials = [];
  model.traverse((child) => {
    if (!child.isMesh) return;
    if (!oldMaterials.includes(child.material)) oldMaterials.push(child.material);
    child.material = elementMaterial(element, element === 'water');
    child.castShadow = true;
    child.receiveShadow = true;
  });
  oldMaterials.forEach((material) => material.dispose());
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
  boss.position.set(0, 0, -111.5);
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x271c2c, roughness: .28, metalness: .78, emissive: 0x5a1d35, emissiveIntensity: .48 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x4c2635, roughness: .35, metalness: .62, emissive: 0x9a3040, emissiveIntensity: .62 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffa073, emissive: 0xff472e, emissiveIntensity: 4.4, roughness: .18 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x8a3651, emissive: 0xff3654, emissiveIntensity: 2.5, roughness: .22, metalness: .5 });
  addMesh(boss, new THREE.CylinderGeometry(.7, 1.12, 2.15, 8), darkMetal, [0, 1.52, 0]);
  addMesh(boss, new THREE.SphereGeometry(.76, 10, 8), shellMat, [0, 2.92, 0]);
  addMesh(boss, new THREE.TorusGeometry(.5, .16, 7, 9), shellMat, [0, 3.72, 0]);
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
    unit.group.traverse((child) => { if (child.isMesh) { child.material.color.set(0x3c2c4a); child.material.emissive.set(0x801b43); child.material.emissiveIntensity = .58; } });
    const anchor = new THREE.Group();
    anchor.userData.soldier = true;
    anchor.add(unit.group);
    anchor.position.set((i % 3 - 1) * 1.15, 0, Math.floor(i / 3) * -1.02 - 2.8);
    unit.group.scale.setScalar(.8);
    game.enemyRoot.add(anchor);
    game.enemyUnits.push({ ...unit, anchor, phase: i * .65 });
  }
}

function setElement(nextElement) {
  game.element = nextElement;
  const palette = gateLabels[nextElement];
  for (const unit of game.visualUnits) recolorWarrior(unit.group, nextElement);
  createElementParticles();
  elementNameHud.textContent = palette.label;
  elementNameHud.style.color = palette.hex;
  elementEmblem.style.color = palette.hex;
  elementEmblem.style.borderColor = `${palette.hex}88`;
  elementEmblem.style.background = `radial-gradient(circle, ${palette.hex}33, transparent 72%)`;
  elementGlyph.textContent = palette.glyph;
}

function updateHud() {
  unitCountHud.textContent = String(game.count).padStart(2, '0');
  const palette = gateLabels[game.element];
  elementNameHud.textContent = palette.label;
  elementNameHud.style.color = palette.hex;
  elementEmblem.style.color = palette.hex;
  elementEmblem.style.borderColor = `${palette.hex}88`;
  elementEmblem.style.background = `radial-gradient(circle, ${palette.hex}33, transparent 72%)`;
  elementGlyph.textContent = palette.glyph;
  const progress = THREE.MathUtils.clamp(-game.playerZ / 112, 0, 1);
  progressFill.style.width = `${progress * 100}%`;
  progressDot.style.left = `${progress * 100}%`;
  progressPercent.textContent = `${Math.round(progress * 100)}%`;
  routeStep.textContent = String(Math.min(3, Math.max(1, Math.floor(progress * 3) + 1))).padStart(2, '0');
}

function setFeedback(message, color = '#b7edf0') {
  feedbackEl.textContent = message;
  feedbackEl.style.color = color;
  feedbackEl.classList.add('show');
  game.feedbackTimer = 1.45;
}

function selectGate(config) {
  if (game.phase !== 'running' || config.resolved || game.playerZ < config.z) return;
  game.selectedGate = config.id;
  game.targetX = config.side * 2.45;
  setFeedback(`ROUTE LOCKED // ${config.title} ${config.subtitle}`, gateLabels[config.type.includes('Water') ? 'water' : config.type.includes('Electric') ? 'electric' : 'fire'].hex);
}

function applyGate(config) {
  for (const sibling of gateRecords) if (sibling.route === config.route) sibling.resolved = true;
  game.selectedGate = null;
  if (config.type === 'fireRecruit') {
    game.count = Math.min(99, game.count + 5);
    game.power += 1;
    setElement('fire');
    setFeedback('+5 FIRE RECRUITS // ELEMENTAL SHIFT', gateLabels.fire.hex);
  } else if (config.type === 'multiply') {
    game.count = Math.min(99, game.count * 2);
    setFeedback('FORMATION DOUBLED // ×2', '#f7d38f');
  } else if (config.type === 'convertWater') {
    game.power += 2;
    setElement('water');
    setFeedback('FORMATION REFORGED // WATER', gateLabels.water.hex);
  } else if (config.type === 'electricRecruit') {
    game.count = Math.min(99, game.count + 5);
    game.power += 2;
    setElement('electric');
    setFeedback('+5 ELECTRIC RECRUITS // STORM POWER +2', gateLabels.electric.hex);
  } else if (config.type === 'convertElectric') {
    game.power += 3;
    setElement('electric');
    setFeedback('FORMATION REFORGED // STORM POWER +3', gateLabels.electric.hex);
  }
  rebuildFormation();
  updateHud();
  spawnImpact(new THREE.Vector3(game.playerX, .7, config.z), new THREE.Color(config.color), 1.1);
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

function updateFx(dt) {
  for (let i = activeFx.length - 1; i >= 0; i--) {
    const effect = activeFx[i];
    effect.age += dt;
    const progress = Math.min(1, effect.age / effect.lifetime);
    if (effect.isPoints) {
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
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
      activeFx.splice(i, 1);
    }
  }
}

function chooseGate(routeId) {
  const pair = gateRecords.filter((gate) => gate.route === routeId && !gate.resolved);
  if (game.selectedGate) {
    const selected = pair.find((gate) => gate.id === game.selectedGate);
    if (selected) return selected;
  }
  return pair.reduce((nearest, gate) => Math.abs(game.playerX - gate.side * 2.45) < Math.abs(game.playerX - nearest.side * 2.45) ? gate : nearest, pair[0]);
}

function startEncounter(kind) {
  game.phase = kind === 'boss' ? 'boss' : 'battle';
  game.encounter = { kind, elapsed: 0, pulseTimer: 0, duration: kind === 'boss' ? 4.3 : 3.35, resolved: false };
  game.targetX = 0;
  game.enemyRoot.visible = kind !== 'boss';
  game.enemyRoot.position.set(0, 0, kind === 'boss' ? -102 : -63.8);
  if (kind === 'boss' && game.enemyBoss) game.enemyBoss.visible = true;
  battleBanner.classList.add('visible');
  battleKicker.textContent = kind === 'boss' ? 'FINAL ENCOUNTER' : 'CONTACT // SHADOW GUARD';
  battleTitle.textContent = kind === 'boss' ? 'RIFT WARDEN' : 'SHADOW GUARD';
  battleSubtitle.textContent = kind === 'boss' ? 'RIFT CORE INTEGRITY' : 'ENEMY FORMATION';
  enemyHealth.style.width = '100%';
  setFeedback(kind === 'boss' ? 'THE RIFT WARDEN // BREAK ITS CORE' : 'SHADOW GUARD // HOLD YOUR FORMATION', '#ff9c7f');
}

function finishGame(won, copy) {
  game.phase = won ? 'won' : 'lost';
  game.encounter = null;
  game.enemyRoot.visible = false;
  if (game.enemyBoss) game.enemyBoss.visible = false;
  battleBanner.classList.remove('visible');
  document.querySelector('#end-kicker').textContent = won ? 'MISSION COMPLETE // 01:32' : 'FORMATION LOST // 00:00';
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
  const elementalBonus = game.element === 'electric' ? 1.18 : game.element === 'water' ? 1.12 : 1.06;
  const strength = game.count * elementalBonus + game.power;
  const threat = isBoss ? 22 : 15;
  if (strength < threat) {
    finishGame(false, isBoss ? 'The Warden overwhelmed the formation before the core could break.' : 'The Shadow Guard scattered the formation. The Rift is still ahead.');
    return;
  }
  if (isBoss) {
    game.defeatedBoss = true;
    game.count = Math.max(1, game.count - Math.max(1, Math.round(5 - game.power * .35)));
    updateHud();
    spawnImpact(new THREE.Vector3(0, 2.1, -111.5), new THREE.Color(gateLabels[game.element].color), 3.2);
    finishGame(true, `The Warden fell to your ${gateLabels[game.element].label.toLowerCase()} formation. ${game.count} units made it out.`);
    return;
  }
  game.defeatedWave = true;
  const losses = Math.max(2, Math.round(8 - game.power * .5));
  game.count = Math.max(1, game.count - losses);
  rebuildFormation();
  updateHud();
  game.phase = 'running';
  game.encounter = null;
  game.enemyRoot.visible = false;
  battleBanner.classList.remove('visible');
  game.targetX = 0;
  setFeedback(`SHADOW GUARD CLEARED // −${losses} UNITS`, '#9ee5d4');
}

function handleWorldEvents(previousZ, currentZ) {
  riftTexture.offset.y = (time * .11) % 1;
  for (const gate of gateRecords) {
    if (gate.resolved || !(previousZ > gate.z && currentZ <= gate.z)) continue;
    applyGate(chooseGate(gate.route));
  }
  for (const obstacle of obstacles) {
    if (obstacle.resolved || !(previousZ > obstacle.z && currentZ <= obstacle.z)) continue;
    obstacle.resolved = true;
    const dx = Math.abs(game.playerX - obstacle.x);
    if (dx < 1.38) {
      const loss = Math.min(3, Math.max(1, game.count - 1));
      game.count -= loss;
      rebuildFormation();
      updateHud();
      setFeedback(`SHOCK PYLON // −${loss} UNITS`, '#ff927f');
      spawnImpact(new THREE.Vector3(obstacle.x, .7, obstacle.z), new THREE.Color(0xff4d58), 1.5);
    } else {
      setFeedback('HAZARD CLEARED // FORMATION INTACT', '#8fe9d9');
    }
  }
  if (!game.defeatedWave && previousZ > -67 && currentZ <= -67) startEncounter('wave');
  if (game.defeatedWave && !game.defeatedBoss && previousZ > -107 && currentZ <= -107) startEncounter('boss');
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
    if (item.crystal) {
      item.object.rotation.y += .0025;
      item.object.rotation.z = Math.sin(time * .8 + item.phase) * .025;
    }
    if (item.beacon) item.light.material.color.setHSL(.52 + .04 * Math.sin(time * 1.7 + item.phase), .62, .68);
  }
  for (const gate of gateRecords) {
    const pulse = .84 + .27 * Math.sin(time * 2.8 + gate.phase);
    gate.ring.rotation.z += .006;
    gate.ringMat.emissiveIntensity = gate.id === game.selectedGate ? 3.6 : pulse * 2.2;
    gate.portalMat.opacity = .09 + .07 * (Math.sin(time * 2 + gate.phase) * .5 + .5);
    gate.group.scale.y = gate.resolved ? .35 : 1;
    gate.group.visible = !gate.resolved;
  }
  for (const obstacle of obstacles) {
    obstacle.ring.rotation.z += .01;
    obstacle.frame.material.emissiveIntensity = .92 + .54 * Math.sin(time * 3.3 + obstacle.phase);
    obstacle.group.visible = !obstacle.resolved;
  }
  waveArena.halo.rotation.z += .002;
  bossArena.halo.rotation.z -= .0026;
  if (game.enemyBoss) {
    game.enemyBoss.userData.core.rotation.y += .03;
    game.enemyBoss.userData.halo.rotation.z += .012;
    game.enemyBoss.position.y = game.enemyBoss.visible ? .12 + Math.sin(time * 2.2) * .12 : 0;
  }
}

function updateEncounter(dt) {
  if (!game.encounter) return;
  const encounter = game.encounter;
  encounter.elapsed += dt;
  encounter.pulseTimer += dt;
  if (encounter.pulseTimer >= .64) {
    encounter.pulseTimer = 0;
    const origin = encounter.kind === 'boss' ? new THREE.Vector3(0, 2.4, -106.2) : new THREE.Vector3((Math.random() - .5) * 3, 1, -64.5);
    spawnImpact(origin, new THREE.Color(gateLabels[game.element].color), encounter.kind === 'boss' ? 1.15 : .8);
    const remaining = Math.max(0, 1 - encounter.elapsed / encounter.duration);
    enemyHealth.style.width = `${remaining * 100}%`;
    game.enemyUnits.forEach((unit, index) => { unit.anchor.position.y = Math.sin(game.clockTime * 5 + index) * .09; });
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
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') steer(-1);
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') steer(1);
  if ((event.key === 'Enter' || event.key === ' ') && game.phase === 'menu') startRun();
  if (event.key.toLowerCase() === 'r' && ['won', 'lost'].includes(game.phase)) resetRun();
});

function startRun() {
  if (!game.modelReady || game.phase !== 'menu') return;
  game.phase = 'running';
  startScreen.classList.add('is-hidden');
  document.querySelector('#hint-text').textContent = 'DODGE THE SHOCK PYLONS';
  document.querySelector('#mission-title').textContent = 'REACH THE RIFT';
  document.querySelector('#mission-copy').textContent = 'Build your formation. Lead them through.';
  setFeedback('FORMATION DEPLOYED // CHOOSE A GATE', '#b4eff0');
}

function resetRun() {
  game.phase = 'menu';
  game.playerZ = 2.4;
  game.previousZ = 2.4;
  game.playerX = 0;
  game.targetX = 0;
  game.count = 12;
  game.element = 'fire';
  game.power = 0;
  game.selectedGate = null;
  game.routeStep = 1;
  game.defeatedWave = false;
  game.defeatedBoss = false;
  game.encounter = null;
  for (const gate of gateRecords) gate.resolved = false;
  for (const obstacle of obstacles) obstacle.resolved = false;
  for (const effect of activeFx) { world.remove(effect.mesh); effect.mesh.geometry.dispose(); effect.mesh.material.dispose(); }
  activeFx.length = 0;
  if (game.enemyBoss) game.enemyBoss.visible = false;
  game.enemyRoot.visible = false;
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

startButton.addEventListener('click', startRun);
restartButton.addEventListener('click', resetRun);

function update(dt) {
  game.clockTime += dt;
  game.elapsed += dt;
  updateWorldObjects(game.clockTime);
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
  const desiredCamera = new THREE.Vector3(cameraX, 8.7, game.playerZ + 12.7);
  camera.position.lerp(desiredCamera, Math.min(1, dt * 2.6));
  camera.lookAt(game.playerX * .45, 1.25, game.playerZ - 8.6);
  warmFill.position.set(game.playerX + 4, 3.7, game.playerZ + 1.3);
  coolFill.position.set(game.playerX - 5, 5, game.playerZ - 18);
  updateHud();
}

function render() {
  requestAnimationFrame(render);
  const dt = Math.min(.035, clock.getDelta());
  update(dt);
  renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

new GLTFLoader().load('./assets/ember-captain.gltf', (gltf) => {
  game.modelTemplate = gltf.scene;
  game.modelTemplate.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  game.modelReady = true;
  createBoss();
  createEnemyFormation();
  rebuildFormation();
  createElementParticles();
  updateHud();
  loadingScreen.classList.add('done');
}, undefined, () => {
  game.modelTemplate = null;
  game.modelReady = true;
  createBoss();
  createEnemyFormation();
  rebuildFormation();
  createElementParticles();
  updateHud();
  loadingScreen.classList.add('done');
  setFeedback('GLTF FALLBACK // PROCEDURAL SENTINEL', '#9cdbe0');
});

render();
