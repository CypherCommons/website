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
import { loadPhone } from "./phone.js";
import { storyScreen, syncLoop, WALLET } from "./screens.js";
import { createField, createFloorRing, glowSprite, shadowPlane, puckGeometry, LAVENDER, ACCENT, GREEN } from "./objects.js";
import { RISE, BEATS } from "../timeline.js";

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
const SWAY = { amp: 0.3, period: 10.5 }; // about 17 degrees each way

// where each beat lands, per layout (nearest open slot is used)
const TARGETS = {
  desktop: { reuse: [1.6, 1.25], own: [[-2.2, 0.85], [2.0, 0.15], [-0.95, 1.85]] },
  mobile: { reuse: [0.95, 1.75], own: [[-1.25, 1.45], [1.25, 1.15], [0.15, 2.3]] },
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

export async function createStage({ story, download, mobile }) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
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

  const phone = kit.instance(2);
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
  const field = createField({ ...GRID, skip: (x, z) => Math.hypot(x, z * 1.15) < CLEAR });
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
  const moverGeo = puckGeometry(0.15, 0.07, 0.022);
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
    const r = story.container.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
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
  const v = new Vector3();
  const lift = new Float32Array(N);

  function updateStory(t, time, intro) {
    // phone: calm poses with a slow sway; always centred
    samplePose(t, pose);
    const sway = Math.sin((time * Math.PI * 2) / SWAY.period) * SWAY.amp * lerp(0.55, 1, ss(RISE[0], RISE[1], t));
    phoneRig.position.set(0, Math.sin(time * 0.55) * 0.02 - (1 - intro) * 0.5, 0);
    phoneRig.rotation.set(pose[1] + Math.sin(time * 0.37) * 0.012 + pointer.sy * 0.03, pose[0] + sway + pointer.sx * 0.04, 0);
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
    spLabel.pos.set(0, FLOOR - 0.02, mobile ? 1.1 : 1.0);

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
    const dphone = kit.instance(1.6);
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
    const r = download.container.getBoundingClientRect();
    dl.W = Math.max(1, r.width);
    dl.H = Math.max(1, r.height);
  }
  function updateDownload(time) {
    const { rig, camera: cam, W: w, H: h } = dl;
    // upright, fully inside the card, turned a few degrees with a gentle sway
    const ph = Math.min(h * 0.8, w * 1.25);
    framePhone(cam, w, h, h / 2, ph, 0.04, origin);
    rig.rotation.set(0.02 + Math.sin(time * 0.4) * 0.01, -0.2 + Math.sin((time * Math.PI * 2) / 12) * 0.07, 0);
    rig.position.y = Math.sin(time * 0.6) * 0.02;
    dl.phone.screen.update(syncLoop(time));
  }

  /* =========================================================
     One renderer, moved to whichever view is on screen
     ========================================================= */
  let active = null;
  let storyIn = true;
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
    const w = view === "story" ? W : dl.W;
    const h = view === "story" ? H : dl.H;
    renderer.setSize(w, h, false);
    dirty = true;
  }

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
      // the sway only needs ~30fps; scroll and transitions get every frame
      if (!moving && !dirty && now - lastRender < 32) return;
      dirty = false;
      lastRender = now;
      updateStory(smoothT, time, intro);
      frameStory(smoothT);
      renderer.render(scene, camera);
      placeLabels();
    } else {
      if (!dirty && now - lastRender < 32) return;
      dirty = false;
      lastRender = now;
      updateDownload(time);
      renderer.render(dl.scene, dl.camera);
    }
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
  renderer.compile(scene, camera);
  if (dl) {
    updateDownload(0);
    renderer.compile(dl.scene, dl.camera);
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
  io.observe(story.stage);
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
