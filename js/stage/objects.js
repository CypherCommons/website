import {
  Mesh,
  InstancedMesh,
  InstancedBufferAttribute,
  LatheGeometry,
  PlaneGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Vector2,
  Object3D,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshBasicMaterial,
  SpriteMaterial,
  Sprite,
  CanvasTexture,
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
} from "three";

export const LAVENDER = new Color(0xc4b5fd);
export const ACCENT = new Color(0x8b6cff);
export const GREEN = new Color(0x4ade80);
export const WHITE = new Color(0xf5f5f7);

/* ---------- shared bits ---------- */

export function glowMaterial(color, opacity = 1) {
  const m = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  m.toneMapped = false;
  return m;
}

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

let glowTexture = null;
export function glowSprite(color, scale, opacity = 1) {
  glowTexture ||= radialTexture([
    [0, "rgba(255,255,255,1)"],
    [0.22, "rgba(255,255,255,0.42)"],
    [0.6, "rgba(255,255,255,0.08)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  const mat = new SpriteMaterial({
    map: glowTexture,
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  mat.toneMapped = false;
  const s = new Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

/** Soft baked contact shadow, laid flat. */
export function shadowPlane(w, h = w) {
  const tex = radialTexture([
    [0, "rgba(0,0,0,0.9)"],
    [0.45, "rgba(0,0,0,0.4)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

/* ---------- the puck: one output on-chain ---------- */

export const PUCK = { r: 0.15, h: 0.07 };

/** A flat round puck with a soft rounded edge, lying on its face (+Y up). */
export function puckGeometry(r = PUCK.r, h = PUCK.h, bevel = 0.022, segments = 32) {
  const pts = [new Vector2(0, -h / 2)];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push(new Vector2(r - bevel + Math.cos(a) * bevel, -h / 2 + bevel + Math.sin(a) * bevel));
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push(new Vector2(r - bevel + Math.cos(a) * bevel, h / 2 - bevel + Math.sin(a) * bevel));
  }
  // a shallow dish on the face catches the key light
  pts.push(new Vector2(r * 0.72, h / 2 - 0.004));
  pts.push(new Vector2(0, h / 2 - 0.008));
  return new LatheGeometry(pts, segments);
}

/** Satin dark metal shared by the field and the moving payments. */
export function puckMaterial(simple = false) {
  // lighter tiers drop the clearcoat layer, the costliest part per pixel
  if (simple) return new MeshStandardMaterial({ color: 0x24242b, metalness: 0.7, roughness: 0.42, envMapIntensity: 0.42 });
  return new MeshPhysicalMaterial({
    color: 0x202026,
    metalness: 0.7,
    roughness: 0.44,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.38,
  });
}

/* ---------- the field of identical outputs ---------- */

export function createField({ cols, rows, gap, x0, z0, skip, segments = 32, simple = false }) {
  const geo = puckGeometry(undefined, undefined, undefined, segments);
  const slots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
      const rnd = seed - Math.floor(seed);
      // a touch of irregularity so it reads as a crowd, not a chart
      const x = x0 + c * gap + (rnd - 0.5) * gap * 0.12;
      const z = z0 - r * gap + (((rnd * 7.13) % 1) - 0.5) * gap * 0.12;
      if (skip && skip(x, z)) continue;
      slots.push({ x, z, c, r, rnd });
    }
  }
  const count = slots.length;
  const glow = new Float32Array(count);
  const glowColor = new Float32Array(count * 3);
  geo.setAttribute("aGlow", new InstancedBufferAttribute(glow, 1));
  geo.setAttribute("aGlowColor", new InstancedBufferAttribute(glowColor, 3));

  const mat = puckMaterial(simple);
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow;\nattribute vec3 aGlowColor;\nvarying float vGlow;\nvarying vec3 vGlowColor;\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = aGlow;\nvGlowColor = aGlowColor;\nvLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;\nvarying vec3 vGlowColor;\nvarying vec3 vLocal;")
      .replace(
        "#include <emissivemap_fragment>",
        // the rim lights up more than the face, so a lit puck keeps its shape
        "#include <emissivemap_fragment>\nfloat rim = smoothstep(0.11, 0.15, length(vLocal.xz));\nfloat top = step(0.0, vLocal.y);\ntotalEmissiveRadiance += vGlowColor * vGlow * (0.35 + top * 0.25 + rim * 1.4);"
      );
  };
  mat.customProgramCacheKey = () => (simple ? "shroud-field-simple" : "shroud-field");

  const mesh = new InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  return { mesh, slots, glow, glowColor, dummy: new Object3D() };
}

/* ---------- paths ---------- */

const SEGS = 80;

export function createLink(points, radius, material) {
  const curve = new CatmullRomCurve3(points);
  const geo = new TubeGeometry(curve, SEGS, radius, 6, false);
  const mesh = new Mesh(geo, material);
  mesh.userData.curve = curve;
  mesh.userData.count = geo.index.count;
  mesh.userData.p = -1;
  geo.setDrawRange(0, 0);
  mesh.visible = false;
  return mesh;
}

/** Draw the tube from `from` to `to` (0..1 along the curve). */
export function setLinkRange(mesh, from, to) {
  const per = mesh.userData.count / SEGS;
  const a = Math.round(Math.min(1, Math.max(0, from)) * SEGS);
  const b = Math.round(Math.min(1, Math.max(0, to)) * SEGS);
  mesh.geometry.setDrawRange(a * per, Math.max(0, b - a) * per);
  mesh.visible = b > a;
}

/* ---------- scan sweep ---------- */

export function createScanSheet(depth, height) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  const mat = glowMaterial(ACCENT, 0.3);
  mat.map = new CanvasTexture(c);
  mat.side = DoubleSide;
  const sheet = new Mesh(new PlaneGeometry(depth, height), mat);
  sheet.rotation.y = Math.PI / 2;
  sheet.position.y = height / 2;
  const line = new Mesh(new PlaneGeometry(depth, 0.016), glowMaterial(LAVENDER, 1));
  line.material.side = DoubleSide;
  line.position.y = -height / 2 + 0.008;
  sheet.add(line);
  return sheet;
}

/* ---------- a soft ring on the floor, for broadcasts and the scan ---------- */

export function createFloorRing(size, color) {
  const mat = new ShaderMaterial({
    uniforms: { uR: { value: 0 }, uW: { value: 0.12 }, uA: { value: 0 }, uColor: { value: new Color(color) }, uFade: { value: size * 0.5 } },
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader:
      "uniform float uR; uniform float uW; uniform float uA; uniform vec3 uColor; uniform float uFade; varying vec2 vP;" +
      "void main(){ float d = length(vP); float edge = d - uR;" +
      " float ring = exp(-pow(edge / uW, 2.0));" +
      " float wake = smoothstep(0.0, -uW * 9.0, edge) * step(edge, 0.0) * 0.16;" +
      " float a = (ring + wake) * uA * (1.0 - smoothstep(uFade * 0.7, uFade, d));" +
      " gl_FragColor = vec4(uColor * a, a); }",
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  mat.toneMapped = false;
  const mesh = new Mesh(new PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}
