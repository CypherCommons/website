import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  PMREMGenerator,
  DirectionalLight,
  Group,
  Object3D,
  Mesh,
  Vector3,
  Fog,
  Color,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  MathUtils,
  MeshPhysicalMaterial,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  Line,
  LineBasicMaterial,
  AdditiveBlending,
  CanvasTexture,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadPhone } from "./phone.js?v=8k";
import { storyScreen, syncLoop, WALLET } from "./screens.js?v=8k";
import { createField, createFloorRing, glowSprite, shadowPlane, puckGeometry, LAVENDER, ACCENT, GREEN } from "./objects.js?v=8k";
import { RISE, BEATS, CHAPTERS } from "../timeline.js?v=8k";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ss = (a, b, t) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const win = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = MathUtils.lerp;
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/* ---------- world layout ---------- */
const PHONE_H = 2.6;
const FLOOR = -1.66;
const GRID = { cols: 27, rows: 13, gap: 0.44, x0: -5.72, z0: 2.6 };
const CLEAR = 0.9; // open floor under the phone
const SWAY = { amp: 0.05, period: 10.5 }; // a faint idle drift; scrolling does the real turning

// Scroll-driven turning. Rising into the story the phone makes one full turn,
// scrubbed to the scroll. After that it swings between "front" moments, and
// each screen change happens at one of them, while it faces the reader.
const SPIN = [RISE[0] + 0.04, RISE[1]];
const SWING = 0.47; // ~27 degrees
const FRONTS = [
  RISE[1],
  BEATS.sendPush[0] + 0.07,
  BEATS.toReceive[0] + 0.06,
  BEATS.toReceive[1] + 0.06,
  CHAPTERS[2].enter + 0.06,
  BEATS.toHome + 0.06,
  BEATS.toSync + 0.06,
  BEATS.backHome + 0.06,
  6.4,
];
const MAX_TURN_SPEED = 9; // rad/s, so a fast flick can't whip the phone round
function scrollYaw(t) {
  if (t < SPIN[1]) return ss(SPIN[0], SPIN[1], t) * Math.PI * 2;
  for (let i = 0; i < FRONTS.length - 1; i++) {
    const a = FRONTS[i];
    const b = FRONTS[i + 1];
    if (t < b) {
      // short gaps get a smaller swing, so quick screen changes stay calm
      const amp = SWING * Math.min(1, (b - a) / 0.7);
      // after the full turn, so the angle carries on without a jump
      return Math.PI * 2 + Math.sin(((t - a) / (b - a)) * Math.PI) * amp * (i % 2 ? -1 : 1);
    }
  }
  return Math.PI * 2;
}

// where each beat lands, per layout (nearest open slot is used)
const TARGETS = {
  desktop: { reuse: [1.6, 1.25], own: [[-2.2, 0.85], [2.0, 0.15], [-0.95, 1.85]] },
  // on phones every landing stays in the band between the phone and the caption
  mobile: { reuse: [0.95, 1.0], own: [[-1.2, 0.8], [1.2, 0.55], [0.1, 1.25]] },
};

// gentle chapter poses: [t, yaw, pitch]
const POSES = [
  [0.0, 0.0, 0.08],
  [0.8, -0.08, 0.04],
  [2.1, 0.1, 0.04],
  [3.1, -0.08, 0.05],
  [4.2, 0.06, 0.05],
  [6.4, 0.0, 0.04],
];
function samplePose(t, out) {
  for (let i = 0; i < POSES.length - 1; i++) {
    const a = POSES[i];
    const b = POSES[i + 1];
    if (t <= b[0] || i === POSES.length - 2) {
      const f = ss(a[0], b[0], t);
      out[0] = lerp(a[1], b[1], f);
      out[1] = lerp(a[2], b[2], f);
      return out;
    }
  }
  return out;
}

function pointTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.5)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function studio(scene) {
  const key = new DirectionalLight(0xffffff, 1.5);
  key.position.set(-3, 5, 5);
  const rim = new DirectionalLight(LAVENDER, 2.2);
  rim.position.set(4, 2, -5);
  const fill = new DirectionalLight(0xdcdcff, 0.7);
  fill.position.set(-5, 1, -3);
  scene.add(key, rim, fill);
}

/** Positions a camera so a phone-sized box fills `ph` px, centred at (W/2, cy). */
function framePhone(camera, W, H, cy, ph, elev, target) {
  camera.aspect = W / H;
  const tan = Math.tan(MathUtils.degToRad(camera.fov / 2));
  const d = (PHONE_H * H) / (2 * tan * ph);
  camera.position.set(target.x, target.y + Math.sin(elev) * d, target.z + Math.cos(elev) * d);
  camera.lookAt(target);
  camera.setViewOffset(W, H, 0, H / 2 - cy, W, H);
  camera.updateProjectionMatrix();
  return d;
}

// What each quality tier spends. The phone is never one of the savings: every
// tier renders at the screen's own pixel ratio (up to 2) with a full-size
// screen texture. rows/segments: floor pucks and their roundness. simple: no
// clearcoat on the floor. idle/dlIdle: ms between redraws when only the slow
// idle motion is changing.
const TIERS = {
  high: { rows: 13, segments: 32, simple: false, idle: 42, dlIdle: 33, dlTurn: true },
  mid: { rows: 12, segments: 20, simple: false, idle: 66, dlIdle: 50, dlTurn: true },
  low: { rows: 10, segments: 14, simple: true, idle: 250, dlIdle: 250, dlTurn: false },
};
const SCREEN_SCALE = 2;
// The phone is always drawn at the screen's own density (up to 2x); slow
// frames are answered with lighter background work, never a softer phone.
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);
const NATIVE_DPR = pixelRatio();

export async function createStage({ story, download, mobile, downloadOnly = false, reduced = false, quality = null }) {
  let tierName = (quality && quality.tier) || "high";
  const Q = { ...TIERS[tierName] };
  // at 1.5x and above the extra pixels already smooth edges; multisampling on
  // top of that costs a lot for little
  const renderer = new WebGLRenderer({ antialias: NATIVE_DPR < 1.5, alpha: true, powerPreference: "high-performance" });
  // the error log calls force the GPU to finish each shader on the spot,
  // which stalls the first frame anything new is drawn
  renderer.debug.checkShaderErrors = false;
  renderer.setPixelRatio(NATIVE_DPR);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  story.container.appendChild(canvas);

  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();

  if (document.fonts) {
    try {
      await Promise.all(["400", "500", "600"].map((w) => document.fonts.load(`${w} 20px "Clash Grotesk"`)).concat(document.fonts.load('600 16px "Inter"')));
    } catch (e) {
      /* system faces */
    }
  }
  const kit = await loadPhone({
    modelUrl: new URL("../../assets/models/phone.glb", import.meta.url).href,
    logoUrl: new URL("../../assets/img/logo.png", import.meta.url).href,
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  });

  /* =========================================================
     Story scene
     ========================================================= */
  const scene = new Scene();
  scene.environment = envMap;
  scene.environmentIntensity = 0.8;
  scene.fog = new Fog(new Color(0x050506), 10, 20);
  studio(scene);
  const camera = new PerspectiveCamera(24, 1, 0.1, 100);
  const world = new Group();
  scene.add(world);

  const phone = kit.instance(SCREEN_SCALE);
  const phoneRig = new Group();
  phoneRig.add(phone.group);
  world.add(phoneRig);
  const phoneGlow = glowSprite(ACCENT, 4.4, 0.18);
  phoneGlow.position.z = -1.3;
  phoneRig.add(phoneGlow);
  const emitter = new Object3D();
  emitter.position.set(0, -0.32, 0.16);
  phoneRig.add(emitter);

  // the field of identical outputs, with open floor under the phone
  const field = createField({ ...GRID, rows: Q.rows, segments: Q.segments, simple: Q.simple, skip: (x, z) => Math.hypot(x, z * 1.15) < CLEAR });
  const fieldGroup = new Group();
  fieldGroup.position.y = FLOOR;
  fieldGroup.add(field.mesh);
  world.add(fieldGroup);
  const N = field.slots.length;
  field.slots.forEach((s) => (s.dist = Math.hypot(s.x, s.z)));

  const shadow = shadowPlane(2.1, 0.8);
  shadow.position.set(0, FLOOR + 0.045, 0.02);
  world.add(shadow);
  const pad = createFloorRing(2.2, LAVENDER);
  pad.position.set(0, FLOOR + 0.03, 0);
  pad.material.uniforms.uR.value = 0.62;
  pad.material.uniforms.uW.value = 0.018;
  world.add(pad);
  const ring = createFloorRing(14, ACCENT);
  ring.position.set(0, FLOOR + 0.035, 0);
  world.add(ring);

  /* ---------- payments ---------- */
  const moverMat = new MeshPhysicalMaterial({
    color: 0xc4b5fd,
    metalness: 0.55,
    roughness: 0.3,
    clearcoat: 0.6,
    emissive: 0x8b6cff,
    emissiveIntensity: 0.7,
  });
  const foundMat = moverMat.clone();
  foundMat.color.set(0xbbf7d0);
  foundMat.emissive.set(0x22c55e);
  const moverGeo = puckGeometry(0.15, 0.07, 0.022, Q.segments);
  const movers = [0, 1, 2].map(() => {
    const m = new Mesh(moverGeo, moverMat);
    const halo = glowSprite(ACCENT, 0.9, 0.5);
    m.add(halo);
    m.userData.halo = halo;
    m.visible = false;
    world.add(m);
    return m;
  });

  // comet trails and faint full paths
  const TR = 22;
  const SEG = 48;
  const trailGeo = new BufferGeometry();
  const trailPos = new Float32Array(3 * TR * 3);
  const trailCol = new Float32Array(3 * TR * 3);
  trailGeo.setAttribute("position", new BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("color", new BufferAttribute(trailCol, 3));
  const trailMat = new PointsMaterial({ size: 0.13, map: pointTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false });
  trailMat.toneMapped = false;
  const trails = new Points(trailGeo, trailMat);
  trails.frustumCulled = false;
  world.add(trails);
  const paths = [0, 1, 2].map(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
    const m = new LineBasicMaterial({ color: LAVENDER, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: false });
    m.toneMapped = false;
    const l = new Line(g, m);
    l.frustumCulled = false;
    l.visible = false;
    world.add(l);
    return l;
  });

  const P0 = new Vector3();
  const P1 = new Vector3();
  const P2 = new Vector3();
  const tmp = new Vector3();
  function bez(u, out) {
    const a = (1 - u) * (1 - u);
    const b = 2 * (1 - u) * u;
    const c = u * u;
    return out.set(a * P0.x + b * P1.x + c * P2.x, a * P0.y + b * P1.y + c * P2.y, a * P0.z + b * P1.z + c * P2.z);
  }
  function arc(from, to, lift) {
    P0.copy(from);
    P2.copy(to);
    P1.copy(from).lerp(to, 0.5);
    P1.y = Math.max(from.y, to.y) + lift;
    P1.z += 0.7;
  }
  // draws mover i along the current arc at u, with its trail and path
  function fly(i, u, { scale = 1, path = 1, green = false } = {}) {
    const m = movers[i];
    m.visible = true;
    m.material = green ? foundMat : moverMat;
    m.userData.halo.material.color.copy(green ? GREEN : ACCENT);
    bez(u, m.position);
    m.scale.setScalar(Math.max(0.0001, scale));
    m.rotation.set(0.5 * Math.sin(u * Math.PI), u * 2.2, 0);
    const col = green ? GREEN : LAVENDER;
    for (let k = 0; k < TR; k++) {
      const uk = u - k * 0.02;
      const o = (i * TR + k) * 3;
      if (uk <= 0) {
        trailCol[o] = trailCol[o + 1] = trailCol[o + 2] = 0;
        continue;
      }
      bez(uk, tmp);
      trailPos[o] = tmp.x;
      trailPos[o + 1] = tmp.y;
      trailPos[o + 2] = tmp.z;
      const a = Math.pow(1 - k / TR, 1.7) * 0.9 * Math.min(1, scale * 1.5);
      trailCol[o] = col.r * a;
      trailCol[o + 1] = col.g * a;
      trailCol[o + 2] = col.b * a;
    }
    const line = paths[i];
    const pos = line.geometry.attributes.position.array;
    for (let k = 0; k <= SEG; k++) {
      bez(k / SEG, tmp);
      pos[k * 3] = tmp.x;
      pos[k * 3 + 1] = tmp.y;
      pos[k * 3 + 2] = tmp.z;
    }
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.setDrawRange(0, Math.max(2, Math.round(u * SEG) + 1));
    line.material.color.copy(col);
    line.material.opacity = 0.32 * path;
    line.visible = path > 0.01;
  }
  function rest(i) {
    movers[i].visible = false;
    paths[i].visible = false;
    for (let k = 0; k < TR; k++) {
      const o = (i * TR + k) * 3;
      trailCol[o] = trailCol[o + 1] = trailCol[o + 2] = 0;
    }
  }

  /* ---------- labels: HTML, projected onto the scene ---------- */
  const labels = [];
  function makeLabel(lines, tone = "") {
    const el = document.createElement("div");
    el.className = "glabel" + (tone ? ` glabel--${tone}` : "");
    const inner = document.createElement("div");
    inner.className = "glabel__in";
    lines.forEach((t, i) => {
      const s = document.createElement("span");
      s.className = i ? "glabel__s" : "glabel__t";
      s.textContent = t;
      inner.appendChild(s);
    });
    el.appendChild(inner);
    story.labelLayer.appendChild(el);
    const l = { el, pos: new Vector3(), opacity: 0, tone, x: -1, y: -1, o: -1, t: tone, half: 0 };
    labels.push(l);
    return l;
  }
  const reuseLabel = makeLabel(["bc1q…9f2c", "one shared address"], "warn");
  const linkedLabel = makeLabel(["all linkable"], "chip");
  const spLabel = makeLabel(["sp1q…one address", "your one reusable address"], "accent");
  const ownAddr = ["bc1p…a9f3", "bc1p…2k7d", "bc1p…x0q1"];
  const ownLabels = ownAddr.map((a) => makeLabel([a], "accent"));
  const foundLabels = WALLET.found.map((sats, i) => makeLabel([ownAddr[i], "+" + (sats / 1e8).toFixed(8)], "found"));

  const ndc = new Vector3();
  let W = 1;
  let H = 1;
  function placeLabels() {
    for (const l of labels) {
      const o = Math.round(l.opacity * 100) / 100;
      if (o <= 0) {
        if (l.o !== 0) {
          l.el.style.opacity = "0";
          l.el.style.visibility = "hidden";
          l.o = 0;
        }
        continue;
      }
      ndc.copy(l.pos).project(camera);
      if (!l.half) l.half = l.el.firstChild.offsetWidth / 2 || 1;
      const sx = Math.min(W - l.half - 8, Math.max(l.half + 8, ((ndc.x + 1) / 2) * W));
      const x = Math.round(sx * 2) / 2;
      const y = Math.round(((1 - ndc.y) / 2) * H * 2) / 2;
      if (x !== l.x || y !== l.y) {
        l.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        l.x = x;
        l.y = y;
      }
      if (o !== l.o) {
        if (l.o <= 0) l.el.style.visibility = "visible";
        l.el.style.opacity = String(o);
        l.o = o;
      }
    }
  }

  /* ---------- framing ---------- */
  const frames = { hero: { cy: 0, h: 1 }, story: { cy: 0, h: 1 } };
  const layout = TARGETS[mobile ? "mobile" : "desktop"];
  const ELEV = mobile ? { hero: 0.06, story: 0.34 } : { hero: 0.06, story: 0.3 };
  const origin = new Vector3(0, 0, 0);
  let picks = null;
  const beats = { ...BEATS };

  function boxIn(el) {
    let x = 0;
    let y = 0;
    let node = el;
    while (node && node !== story.stage) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function frameStory(t) {
    const f = ss(RISE[0], RISE[1], t);
    const cy = lerp(frames.hero.cy, frames.story.cy, f);
    const ph = lerp(frames.hero.h, frames.story.h, f);
    const d = framePhone(camera, W, H, cy, ph, lerp(ELEV.hero, ELEV.story, f), origin);
    scene.fog.near = d + 1.2;
    scene.fog.far = d + 8;
  }

  function measure() {
    // layout size, unaffected by any transform on the way in
    W = Math.max(1, story.container.clientWidth);
    H = Math.max(1, story.container.clientHeight);
    const hero = boxIn(story.frames.hero);
    const chap = boxIn(story.frames.chapter);
    frames.hero = { cy: hero.y + hero.h / 2, h: hero.h || 1 };
    frames.story = { cy: chap.y + chap.h / 2, h: chap.h || 1 };

    // outputs that would sit under the copy step aside
    frameStory(RISE[1]);
    camera.updateMatrixWorld();
    const avoid = story.avoid.map((el) => boxIn(el)).filter((b) => b.w > 0 && b.h > 0);
    field.slots.forEach((s) => {
      ndc.set(s.x, FLOOR + 0.04, s.z).project(camera);
      const x = ((ndc.x + 1) / 2) * W;
      const y = ((1 - ndc.y) / 2) * H;
      let m = 1;
      for (const b of avoid) {
        const dx = Math.max(b.x - 18 - x, 0, x - (b.x + b.w + 18));
        const dy = Math.max(b.y - 18 - y, 0, y - (b.y + b.h + 18));
        m = Math.min(m, ss(0, 46, Math.hypot(dx, dy)));
      }
      const offscreen = ndc.z > 1 || x < -60 || x > W + 60 || y > H + 40;
      s.mask = offscreen ? 0 : m;
    });

    // pick the beats' outputs among open, visible slots
    const nearest = (x, z, taken) => {
      let best = -1;
      let bd = Infinity;
      field.slots.forEach((s, i) => {
        if (s.mask < 1 || taken.includes(i)) return;
        const d = (s.x - x) ** 2 + (s.z - z) ** 2;
        if (d < bd) (bd = d), (best = i);
      });
      return best;
    };
    const reuse = nearest(layout.reuse[0], layout.reuse[1], []);
    const own = [];
    layout.own.forEach(([x, z]) => own.push(nearest(x, z, [reuse, ...own])));
    picks = { reuse, own };
    const rMax = Math.max(...own.map((i) => field.slots[i].dist)) * 1.18;
    picks.rMax = rMax;
    beats.home = own.map((i) => lerp(BEATS.scan[0], BEATS.scan[1], field.slots[i].dist / rMax) + BEATS.returnFlight);
    labels.forEach((l) => (l.half = 0));
    dirty = true;
  }

  const top = (i, out, h = 0) => out.set(field.slots[i].x, FLOOR + 0.035 + h, field.slots[i].z);

  /* ---------- pointer: a few degrees, heavily damped ---------- */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!mobile) window.addEventListener("pointermove", onPointer, { passive: true });

  /* ---------- per-frame story state ---------- */
  const pose = [0, 0];
  const turned = { yaw: 0, tilt: 0, at: 0 };
  const v = new Vector3();
  const lift = new Float32Array(N);

  function updateStory(t, time, intro) {
    // phone: calm poses with a slow sway; always centred
    samplePose(t, pose);
    const sway = Math.sin((time * Math.PI * 2) / SWAY.period) * SWAY.amp * lerp(0.55, 1, ss(RISE[0], RISE[1], t));
    phoneRig.position.set(0, Math.sin(time * 0.55) * 0.02 - (1 - intro) * 0.5, 0);
    const yaw = pose[0] + scrollYaw(t);
    const tilt = pose[1];
    // smoothed toward the scroll target, with a speed cap, independent of frame rate
    const dt = Math.min(0.1, Math.max(0, time - turned.at));
    turned.at = time;
    const k = 1 - Math.exp(-dt * 12);
    const step = (yaw - turned.yaw) * k;
    const cap = MAX_TURN_SPEED * dt;
    turned.yaw += Math.max(-cap, Math.min(cap, step));
    turned.tilt += (tilt - turned.tilt) * k;
    phoneRig.rotation.set(turned.tilt + Math.sin(time * 0.37) * 0.012 + pointer.sy * 0.03, turned.yaw + sway + pointer.sx * 0.04, 0);
    phoneRig.updateMatrixWorld();
    const emit = emitter.getWorldPosition(new Vector3());

    // phone screen
    phone.screen.update(storyScreen(t, time, beats));

    const fieldOn = ss(RISE[0] + 0.2, RISE[1], t);
    fieldGroup.visible = fieldOn > 0;
    shadow.material.opacity = 0.75 * fieldOn;
    pad.material.uniforms.uA.value = 0.5 * fieldOn;

    // floor ring: broadcast in chapter 2, the scan sweep in chapter 4
    const bc = win(t, beats.broadcast[0], beats.broadcast[1]);
    const sc = win(t, beats.scan[0], beats.scan[1]);
    const R = picks.rMax;
    let ringR = 0;
    let ringA = 0;
    let ringColor = ACCENT;
    if (bc > 0 && bc < 1) {
      ringR = lerp(CLEAR * 0.7, R * 1.1, easeOut(bc));
      ringA = Math.sin(Math.PI * bc) * 0.9;
      ringColor = LAVENDER;
    } else if (sc > 0 && t < beats.scan[1] + 0.12) {
      ringR = lerp(CLEAR * 0.7, R, sc);
      ringA = Math.min(1, sc * 8) * (1 - win(t, beats.scan[1], beats.scan[1] + 0.12));
    }
    ring.visible = ringA > 0.005;
    ring.material.uniforms.uR.value = ringR;
    ring.material.uniforms.uA.value = ringA;
    ring.material.uniforms.uW.value = 0.1;
    ring.material.uniforms.uColor.value.copy(ringColor);

    // chapter 1: three payments, one shared address
    const reuseOut = ss(beats.reuseOut[0], beats.reuseOut[1], t);
    const linked = ss(beats.linked - 0.08, beats.linked + 0.04, t) * (1 - reuseOut);
    const ri = picks.reuse;
    let stack = 0;
    let usedMovers = 0;
    beats.sends.forEach((f, i) => {
      const u = win(t, f, f + beats.flight);
      if (u <= 0 || reuseOut >= 1) return rest(i);
      stack += u >= 1 ? 1 : 0;
      arc(emit, top(ri, v, 0.035 + i * 0.072), 0.55);
      fly(i, easeInOut(u), { scale: lerp(0.55, 1, easeOut(u * 1.6)) * (1 - reuseOut), path: (1 - win(t, f + beats.flight, f + beats.flight + 0.16)) * (1 - reuseOut) });
      const m = movers[i];
      if (u >= 1) {
        m.rotation.set(0, i * 0.7, 0);
        m.position.y -= reuseOut * 0.25;
        m.userData.halo.material.opacity = 0.25 + linked * 0.4;
      } else m.userData.halo.material.opacity = 0.5;
      usedMovers = 3;
    });
    reuseLabel.opacity = ss(beats.sends[0] + beats.flight - 0.02, beats.sends[0] + beats.flight + 0.08, t) * (1 - reuseOut);
    reuseLabel.pos.copy(top(ri, v, 0.42 + Math.min(stack, 3) * 0.07));
    linkedLabel.opacity = linked;
    linkedLabel.pos.copy(top(ri, v, -0.06)).add(tmp.set(0, 0, 0.32));

    // chapter 2: the one reusable address
    spLabel.opacity = ss(beats.broadcast[0] - 0.1, beats.broadcast[0] + 0.06, t) * (1 - ss(beats.land[0] - beats.landFlight - 0.1, beats.land[0] - beats.landFlight, t));
    spLabel.pos.set(0, FLOOR - 0.02, mobile ? 0.7 : 1.0);

    // chapter 3: each payment leaves the phone and lands somewhere new
    if (!usedMovers) {
      beats.land.forEach((l, i) => {
        const u = win(t, l - beats.landFlight, l);
        if (u <= 0 || u >= 1) return rest(i);
        arc(emit, top(picks.own[i], v, 0.04), 0.5);
        fly(i, easeInOut(u), { scale: lerp(0.55, 1, easeOut(u * 1.6)) * (1 - win(u, 0.9, 1) * 0.4), path: 1 });
        movers[i].userData.halo.material.opacity = 0.5;
        usedMovers++;
      });
    }
    beats.land.forEach((l, i) => {
      const shown = ss(l - 0.01, l + 0.04, t) * (1 - ss(l + 0.2, l + 0.34, t));
      ownLabels[i].opacity = shown;
      ownLabels[i].pos.copy(top(picks.own[i], v, 0.28));
    });

    // chapter 4: the sweep finds only yours, and they come home
    if (!usedMovers) {
      beats.home.forEach((h, i) => {
        const u = win(t, h - beats.returnFlight, h);
        if (u <= 0 || u >= 1) return rest(i);
        arc(top(picks.own[i], v, 0.04), emit, 0.6);
        fly(i, easeInOut(u), { scale: lerp(1, 0.3, win(u, 0.7, 1)), path: 1 - win(u, 0.85, 1), green: true });
        movers[i].userData.halo.material.opacity = 0.55;
        usedMovers++;
      });
    }
    if (!usedMovers) [0, 1, 2].forEach(rest);
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
    beats.home.forEach((h, i) => {
      const found = ss(h - beats.returnFlight - 0.03, h - beats.returnFlight + 0.03, t);
      foundLabels[i].opacity = found;
      foundLabels[i].pos.copy(top(picks.own[i], v, 0.3 + found * 0.04));
    });

    // the field
    if (fieldGroup.visible) {
      const color = field.glowColor;
      const ownIndex = picks.own;
      for (let i = 0; i < N; i++) {
        const s = field.slots[i];
        const rise = ss(0.22 + s.rnd * 0.3, 0.5 + s.rnd * 0.3, t);
        let glow = 0;
        let c = ACCENT;
        let up = 0;
        if (ringA > 0.01) {
          const near = Math.exp(-(((s.dist - ringR) / 0.32) ** 2)) * ringA;
          glow = near * 0.22;
          up = near * 0.02;
        }
        if (i === ri) {
          const g = Math.max(Math.min(stack, 1) * 0.7, linked * 1.4) * (1 - reuseOut);
          if (g > glow) (glow = g), (c = LAVENDER);
          up = Math.max(up, linked * 0.04);
        }
        const k = ownIndex.indexOf(i);
        if (k >= 0) {
          const l = beats.land[k];
          const flash = ss(l - 0.015, l + 0.02, t) * (1 - ss(l + 0.06, l + 0.32, t));
          if (flash * 1.5 > glow) (glow = flash * 1.5), (c = LAVENDER);
          up = Math.max(up, flash * 0.06);
          const found = ss(beats.home[k] - beats.returnFlight - 0.03, beats.home[k] - beats.returnFlight + 0.03, t);
          if (found > 0) (glow = Math.max(glow, found * 1.35)), (c = GREEN), (up = Math.max(up, found * 0.05));
        }
        lift[i] = up;
        field.glow[i] = glow;
        color[i * 3] = c.r;
        color[i * 3 + 1] = c.g;
        color[i * 3 + 2] = c.b;
        const bob = Math.sin(time * 0.7 + s.rnd * 6.28) * 0.006;
        field.dummy.position.set(s.x, lerp(-0.5, 0, rise) + bob + up, s.z);
        field.dummy.scale.setScalar(Math.max(0.0001, rise * s.mask));
        field.dummy.updateMatrix();
        field.mesh.setMatrixAt(i, field.dummy.matrix);
      }
      field.mesh.instanceMatrix.needsUpdate = true;
      field.mesh.geometry.attributes.aGlow.needsUpdate = true;
      field.mesh.geometry.attributes.aGlowColor.needsUpdate = true;
    }
  }

  /* =========================================================
     Download scene: the same phone, syncing
     ========================================================= */
  let dl = null;
  if (download) {
    const dscene = new Scene();
    dscene.environment = envMap;
    dscene.environmentIntensity = 0.8;
    studio(dscene);
    const dcam = new PerspectiveCamera(24, 1, 0.1, 100);
    const dphone = kit.instance(SCREEN_SCALE);
    const rig = new Group();
    rig.add(dphone.group);
    const glow = glowSprite(ACCENT, 4.6, 0.22);
    glow.position.z = -1.4;
    rig.add(glow);
    dscene.add(rig);
    dl = { scene: dscene, camera: dcam, phone: dphone, rig, W: 1, H: 1 };
  }
  function measureDownload() {
    if (!dl) return;
    dl.W = Math.max(1, download.container.clientWidth);
    dl.H = Math.max(1, download.container.clientHeight);
  }
  /* ---------- download phone: idles on its own, turns by hand ---------- */
  const spin = { yaw: 0, pitch: 0, vy: 0, vp: 0, drag: false, idle: 1, lastX: 0, lastY: 0, lastT: 0, at: 0, moving: false };
  const TAU = Math.PI * 2;
  if (dl) {
    const el = download.container;
    let pid = null;
    let startX = 0;
    let startY = 0;
    let decided = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      pid = e.pointerId;
      startX = spin.lastX = e.clientX;
      startY = spin.lastY = e.clientY;
      spin.lastT = performance.now();
      // touch waits to see a horizontal swipe; vertical stays a page scroll
      decided = e.pointerType === "mouse";
      if (decided) {
        spin.drag = true;
        el.setPointerCapture(pid);
        el.classList.add("is-dragging");
      }
      spin.vy = spin.vp = 0;
      kickDownload();
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      if (!decided) {
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        decided = true;
        if (dx <= dy) {
          pid = null;
          return;
        }
        spin.drag = true;
        el.setPointerCapture(pid);
      }
      if (!spin.drag) return;
      const now = performance.now();
      const dt = Math.max(1, now - spin.lastT) / 1000;
      const ry = (e.clientX - spin.lastX) * 0.011;
      const rp = (e.clientY - spin.lastY) * 0.006;
      spin.yaw += ry;
      spin.pitch = Math.max(-0.45, Math.min(0.45, spin.pitch + rp));
      // velocity, lightly smoothed, for the throw on release
      spin.vy = spin.vy * 0.4 + (ry / dt) * 0.6;
      spin.vp = spin.vp * 0.4 + (rp / dt) * 0.6;
      spin.lastX = e.clientX;
      spin.lastY = e.clientY;
      spin.lastT = now;
      kickDownload();
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      el.classList.remove("is-dragging");
      if (!spin.drag) return;
      spin.drag = false;
      // a pause before letting go means no throw
      if (performance.now() - spin.lastT > 90) spin.vy = spin.vp = 0;
      spin.vy = Math.max(-14, Math.min(14, spin.vy));
      kickDownload();
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("lostpointercapture", end);
  }

  function updateDownload(time) {
    const { rig, camera: cam, W: w, H: h } = dl;
    const ph = Math.min(h * 0.8, w * 1.25);
    framePhone(cam, w, h, h / 2, ph, 0.04, origin);
    const dt = Math.min(0.05, Math.max(0, time - spin.at));
    spin.at = time;
    let moving = false;
    if (spin.drag) {
      spin.idle = 0;
      moving = true;
    } else if (Math.abs(spin.vy) > 0.05 || Math.abs(spin.vp) > 0.05) {
      // the throw: spins on, slowing down
      spin.yaw += spin.vy * dt;
      spin.pitch = Math.max(-0.45, Math.min(0.45, spin.pitch + spin.vp * dt));
      const f = Math.exp(-dt * 2.6);
      spin.vy *= f;
      spin.vp *= f;
      moving = true;
    } else {
      // then eases back to the nearest front-facing turn and picks up the idle
      spin.vy = spin.vp = 0;
      const front = Math.round(spin.yaw / TAU) * TAU;
      const k = 1 - Math.exp(-dt * 3.2);
      spin.yaw += (front - spin.yaw) * k;
      spin.pitch += (0 - spin.pitch) * k;
      if (Math.abs(front - spin.yaw) < 0.002 && Math.abs(spin.pitch) < 0.002) {
        spin.yaw = 0;
        spin.pitch = 0;
      } else moving = true;
      spin.idle = Math.min(1, spin.idle + dt * 0.5);
    }
    spin.moving = moving;
    // idle: a slow turn either side of front, faded in after a drag
    const still = reduced || !Q.dlTurn;
    const idleYaw = still ? 0 : Math.sin((time * TAU) / 9) * 0.55 * spin.idle;
    const idleBob = still ? 0 : Math.sin(time * 0.6) * 0.02;
    rig.rotation.set(0.02 + spin.pitch, spin.yaw + idleYaw, 0);
    rig.position.y = idleBob;
    dl.phone.screen.update(syncLoop(time));
  }

  /* =========================================================
     One renderer, moved to whichever view is on screen
     ========================================================= */
  let active = null;
  let storyIn = !downloadOnly;
  let downloadIn = false;
  let raf = 0;
  let running = false;
  let lost = false;
  let dirty = true;
  let last = performance.now();
  let lastRender = 0;
  let smoothT = story.getProgress();
  const startTime = performance.now();
  let introDone = false;

  function use(view) {
    if (active === view) return;
    active = view;
    const host = view === "story" ? story.container : download.container;
    if (canvas.parentNode !== host) host.appendChild(canvas);
    if (view === "download") measureDownload();
    const w = view === "story" ? W : dl.W;
    const h = view === "story" ? H : dl.H;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    // never show the other view's last frame, even for one composite
    renderer.clear();
    dirty = true;
    // a moved canvas can drop its first frame (WebKit), so draw a few
    settle = 8;
  }

  let settle = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const view = storyIn ? "story" : downloadIn && dl ? "download" : null;
    if (!view) return;
    use(view);
    const time = now / 1000;

    if (view === "story") {
      const goal = story.getProgress();
      const delta = goal - smoothT;
      let moving = Math.abs(delta) > 0.0004;
      smoothT = moving ? smoothT + delta * Math.min(1, dt * 7) : goal;
      const intro = easeOut((now - startTime) / 1800);
      if (!introDone) moving = true;
      if (intro >= 1) introDone = true;
      const px = pointer.sx;
      const py = pointer.sy;
      pointer.sx += (pointer.x - pointer.sx) * Math.min(1, dt * 1.2);
      pointer.sy += (pointer.y - pointer.sy) * Math.min(1, dt * 1.2);
      if (Math.abs(pointer.sx - px) + Math.abs(pointer.sy - py) > 0.0005) moving = true;
      // the idle sway needs few frames; scroll and transitions get every one
      if (settle > 0) (settle--, (dirty = true));
      if (!moving && !dirty && now - lastRender < Q.idle) return;
      watchPace(now, moving);
      dirty = false;
      lastRender = now;
      updateStory(smoothT, time, intro);
      frameStory(smoothT);
      renderer.render(scene, camera);
      placeLabels();
    } else {
      // every frame while it's being turned; ~30fps while idling
      if (settle > 0) (settle--, (dirty = true));
      const turning = spin.drag || spin.moving;
      if (!dirty && !turning && (reduced || now - lastRender < Q.dlIdle)) return;
      watchPace(now, turning);
      dirty = false;
      lastRender = now;
      updateDownload(time);
      renderer.render(dl.scene, dl.camera);
    }
  }

  /* ---------- if frames drop while moving, render less ---------- */
  const pace = { last: 0, ema: 16, n: 0, cool: 0, active: false };
  function watchPace(now, active) {
    const gap = now - pace.last;
    const was = pace.active;
    pace.last = now;
    pace.active = active;
    // only judge back-to-back frames while something is actually moving
    if (!active || !was || gap > 2000) {
      pace.n = 0;
      return;
    }
    pace.ema = pace.n ? pace.ema + (gap - pace.ema) * 0.08 : gap;
    pace.n++;
    // a long run of slightly slow frames, or a few very slow ones
    const slow = (pace.n >= 45 && pace.ema > 30) || (pace.n >= 6 && pace.ema > 120);
    if (!slow || now < pace.cool) return;
    pace.n = 0;
    pace.cool = now + 2500;
    stepDown();
  }
  function stepDown() {
    if (quality && quality.tier !== "low") quality.down();
  }
  if (quality && quality.on) {
    quality.on((t) => {
      tierName = t;
      // the slower idle pacing of a lower tier applies right away
      Q.idle = Math.max(Q.idle, TIERS[t].idle);
      Q.dlIdle = Math.max(Q.dlIdle, TIERS[t].dlIdle);
      if (!TIERS[t].dlTurn) Q.dlTurn = false;
    });
  }

  function start() {
    if (running || lost) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  const sync = () => (!document.hidden && (storyIn || (downloadIn && dl)) ? start() : stop());
  function kickDownload() {
    dirty = true;
    if (downloadIn) start();
  }

  measure();
  measureDownload();
  const ro = new ResizeObserver(() => {
    measure();
    measureDownload();
    const a = active;
    active = null;
    if (a) use(a);
  });
  ro.observe(story.container);
  if (dl) ro.observe(download.container);

  // compile both scenes up front so scrolling never hitches on a shader
  use("story");
  updateStory(smoothT, performance.now() / 1000, 0);
  frameStory(smoothT);
  fieldGroup.visible = true;
  movers.forEach((m) => (m.visible = true));
  // compiled up front (in parallel where the browser allows), so scrolling
  // never waits on a shader
  const parallel = renderer.compileAsync && renderer.extensions.has("KHR_parallel_shader_compile");
  // drawing once as well makes the driver finish linking now, not on the
  // first frame each object appears
  const warm = (sc, cam) => (parallel ? renderer.compileAsync(sc, cam) : Promise.resolve(renderer.compile(sc, cam))).then(() => renderer.render(sc, cam));
  await warm(scene, camera);
  if (dl) {
    updateDownload(0);
    await warm(dl.scene, dl.camera);
  }
  movers.forEach((m) => (m.visible = false));
  updateStory(smoothT, performance.now() / 1000, 0);
  renderer.render(scene, camera);

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.target === story.stage) storyIn = e.isIntersecting;
        else downloadIn = e.isIntersecting;
      });
      sync();
    },
    { rootMargin: "120px 0px" }
  );
  if (!downloadOnly) io.observe(story.stage);
  if (dl) io.observe(download.container);
  document.addEventListener("visibilitychange", sync);

  const onLost = (e) => {
    e.preventDefault();
    lost = true;
    stop();
    story.container.dispatchEvent(new CustomEvent("stage:lost", { bubbles: true }));
  };
  canvas.addEventListener("webglcontextlost", onLost);

  function destroy() {
    stop();
    io.disconnect();
    ro.disconnect();
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", sync);
    canvas.removeEventListener("webglcontextlost", onLost);
    const textures = new Set();
    [scene, dl && dl.scene].filter(Boolean).forEach((sc) =>
      sc.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
        mats.forEach((m) => {
          for (const k in m) if (m[k] && m[k].isTexture) textures.add(m[k]);
          m.dispose();
        });
      })
    );
    textures.forEach((tex) => tex.dispose());
    phone.screen.dispose();
    if (dl) dl.phone.screen.dispose();
    envMap.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    labels.forEach((l) => l.el.remove());
  }

  return {
    start: sync,
    stop,
    destroy,
    canvas,
    refresh: () => {
      measure();
      measureDownload();
    },
    // for checks: the phone's screen position in the story view
    probe: () => {
      const p = phoneRig.getWorldPosition(new Vector3()).project(camera);
      return { x: ((p.x + 1) / 2) * W, y: ((1 - p.y) / 2) * H, w: W, h: H };
    },
  };
}
