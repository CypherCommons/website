import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from "three";

// Shroud app screens, drawn live onto the phone's display. Layout is in
// points on a 390pt-wide screen; colours, type and copy follow the app
// (components/themes.ts light theme, loc/en.json, Clash Grotesk).
const PT = 390;
const NAV = 40; // content offset below the navigation bar
const CLASH = '"Clash Grotesk", "Inter", sans-serif';
const SANS = '"Inter", -apple-system, sans-serif';

const C = {
  bg: "#FFFFFF",
  brand: "#754CE8",
  text: "#000000",
  text2: "#1A1A1A",
  muted: "#8E8E93",
  success: "#55B685",
  surfaceSubtle: "#F6F5FD",
  accentSubtle: "#E6E2FA",
  surfaceBrandSubtle: "#FDFCFE",
  tint: "#EAE4FB",
  field: "#F5F5F7",
  border: "rgba(230, 228, 228, 0.6)",
  borderStrong: "#C7C7CC",
};

/* ---------- icons, from components/icons/*.tsx ---------- */
const ICONS = {
  receive: { vb: [0, 0, 29, 29], w: 1.66607, s: ["M18.2607 10.0138L10.0141 18.2604", "M18.2603 18.2604H10.0137V10.0138"] },
  pay: { vb: [0, 0, 29, 29], w: 1.66607, s: ["M10.0139 10.0138H18.2605V18.2605", "M10.0141 18.2604L18.2607 10.0138"] },
  qr: {
    vb: [0, 0, 24, 24],
    w: 2,
    s: [
      "M7 3H4C3.44772 3 3 3.44772 3 4V7C3 7.55228 3.44772 8 4 8H7C7.55228 8 8 7.55228 8 7V4C8 3.44772 7.55228 3 7 3Z",
      "M19.999 2.99976H16.999C16.4467 2.99976 15.999 3.44747 15.999 3.99976V6.99976C15.999 7.55204 16.4467 7.99976 16.999 7.99976H19.999C20.5513 7.99976 20.999 7.55204 20.999 6.99976V3.99976C20.999 3.44747 20.5513 2.99976 19.999 2.99976Z",
      "M7 15.9988H4C3.44772 15.9988 3 16.4465 3 16.9988V19.9988C3 20.5511 3.44772 20.9988 4 20.9988H7C7.55228 20.9988 8 20.5511 8 19.9988V16.9988C8 16.4465 7.55228 15.9988 7 15.9988Z",
      "M20.999 15.9988H17.999C17.4686 15.9988 16.9599 16.2095 16.5848 16.5846C16.2097 16.9596 15.999 17.4683 15.999 17.9988V20.9988",
      "M20.9985 20.9984V21.0084",
      "M11.9995 6.99951V9.99951C11.9995 10.5299 11.7888 11.0387 11.4137 11.4137C11.0387 11.7888 10.5299 11.9995 9.99951 11.9995H6.99951",
      "M3 11.9991H3.01",
      "M11.999 2.99976H12.009",
      "M11.999 15.9988V16.0088",
      "M15.999 11.9991H16.999",
      "M20.9985 11.9991V12.0091",
      "M11.999 20.9985V19.9985",
    ],
  },
  search: {
    vb: [14, 14, 20, 20],
    w: 1.66607,
    s: [
      "M23.1609 29.8295C26.8415 29.8295 29.8252 26.8457 29.8252 23.1652C29.8252 19.4846 26.8415 16.5009 23.1609 16.5009C19.4803 16.5009 16.4966 19.4846 16.4966 23.1652C16.4966 26.8457 19.4803 29.8295 23.1609 29.8295Z",
      "M31.4912 31.4955L27.9092 27.9135",
    ],
  },
  chevron: { vb: [0, 0, 20, 20], w: 1.66607, s: ["M7.49756 14.9946L12.4958 9.99639L7.49756 4.99817"] },
  back: { vb: [0, 0, 20, 20], w: 1.8, s: ["M12.5 15L7.5 10L12.5 5"] },
  copy: { vb: [0, 0, 24, 24], w: 2, s: ["M11 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"] },
  eye: {
    vb: [0, 0, 20, 20],
    w: 1.4,
    s: [
      "M10 5.83496C12.0776 5.83496 13.9186 6.36337 15.2139 7.17285C16.5209 7.98975 17.165 9.01107 17.165 10C17.165 10.9889 16.5209 12.0103 15.2139 12.8271C13.9186 13.6366 12.0776 14.165 10 14.165C7.92242 14.165 6.08139 13.6366 4.78613 12.8271C3.4791 12.0103 2.83496 10.9889 2.83496 10C2.83496 9.01107 3.4791 7.98975 4.78613 7.17285C6.08139 6.36337 7.92242 5.83496 10 5.83496Z",
      "M12.165 10a2.165 2.165 0 1 1-4.33 0a2.165 2.165 0 1 1 4.33 0z",
    ],
  },
  share: {
    vb: [0, 0, 19, 19],
    w: 1.5,
    s: ["M2.96875 10.0938V14.8438C2.96875 15.1587 3.09386 15.4607 3.31656 15.6834C3.53926 15.9061 3.84131 16.0312 4.15625 16.0312H14.8438C15.1587 16.0312 15.4607 15.9061 15.6834 15.6834C15.9061 15.4607 16.0312 15.1587 16.0312 14.8438V10.0938M9.5 11.875V2.07812M13.0625 5.34375L9.5 1.78125L5.9375 5.34375"],
  },
  info: {
    vb: [0, 0, 20, 20],
    w: 1.66607,
    s: [
      "M9.99639 18.3268C14.5971 18.3268 18.3268 14.5971 18.3268 9.99639C18.3268 5.39565 14.5971 1.66602 9.99639 1.66602C5.39565 1.66602 1.66602 5.39565 1.66602 9.99639C1.66602 14.5971 5.39565 18.3268 9.99639 18.3268Z",
      "M9.99634 13.3286V9.99646",
      "M9.99634 6.66431H10.0047",
    ],
  },
  clock: { vb: [0, 0, 24, 24], w: 1.5, s: ["M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0z", "M12 7 V12 L15.5 14"] },
  check: { vb: [0, 0, 24, 24], f: ["M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"] },
  syncing: {
    vb: [0, 0, 66, 66],
    w: 2.21577,
    s: [
      "M45.728 35.4056V33.3422C45.728 26.5058 40.1719 20.9622 33.3196 20.9622C31.4556 20.9599 29.615 21.3781 27.9349 22.1857C26.2548 22.9932 24.7785 24.1693 23.6159 25.6264M20.948 31.3044V33.3678C20.948 40.2118 26.5013 45.7512 33.3563 45.7512C35.2151 45.7485 37.0498 45.3311 38.7268 44.5295C40.4039 43.7279 41.8809 42.5622 43.0503 41.1175",
      "M17.8459 33.3567L20.8926 30.3101L24.0778 33.3567M48.8668 33.3567L45.8201 36.4034L42.6349 33.3567",
    ],
  },
  synced: { vb: [0, 0, 66, 66], f: ["M29.5344 41.8365L21.2358 33.5379L23.3105 31.4633L29.5344 37.6872L42.8922 24.3294L44.9669 26.4041L29.5344 41.8365Z"] },
  pause: {
    vb: [22.7139, 22.7139, 19.8333, 19.8333],
    f: ["M34.0472 42.5472V22.7139H42.5472V42.5472H34.0472ZM22.7139 42.5472V22.7139H31.2139V42.5472H22.7139ZM36.8805 39.7139H39.7139V25.5472H36.8805V39.7139ZM25.5472 39.7139H28.3805V25.5472H25.5472V39.7139Z"],
  },
  txIn: {
    vb: [12, 17, 44, 44],
    f: [
      "M30.0329 36.7178C30.1225 36.8073 30.179 36.9299 30.179 37.0713L30.179 42.2945L35.4022 42.2945C35.6756 42.2945 35.9019 42.5208 35.9019 42.7942C35.9019 43.0676 35.6756 43.2939 35.4022 43.2939L29.6793 43.2939C29.4059 43.2939 29.1797 43.0676 29.1797 42.7942L29.1797 37.0713C29.1797 36.7979 29.4059 36.5716 29.6793 36.5716C29.8161 36.5669 29.9433 36.6282 30.0329 36.7178Z",
      "M38.0468 34.4267C38.2401 34.62 38.2401 34.9406 38.0468 35.1339L30.1131 43.0676C29.9198 43.2609 29.5992 43.2609 29.406 43.0676C29.2127 42.8743 29.2127 42.5538 29.406 42.3605L37.3397 34.4267C37.533 34.2335 37.8535 34.2335 38.0468 34.4267Z",
    ],
  },
  txOut: {
    vb: [12, 16, 44, 44],
    f: [
      "M37.3397 39.8567C37.2501 39.7671 37.1935 39.6446 37.1935 39.5031L37.1935 34.28L31.9704 34.28C31.6969 34.28 31.4707 34.0537 31.4707 33.7803C31.4707 33.5069 31.6969 33.2806 31.9704 33.2806L37.6932 33.2806C37.9666 33.2806 38.1929 33.5069 38.1929 33.7803L38.1929 39.5031C38.1929 39.7766 37.9666 40.0028 37.6932 40.0028C37.5565 40.0075 37.4292 39.9463 37.3397 39.8567Z",
      "M29.3257 42.1477C29.1325 41.9544 29.1325 41.6339 29.3257 41.4406L37.2595 33.5069C37.4528 33.3136 37.7733 33.3136 37.9666 33.5069C38.1599 33.7001 38.1599 34.0207 37.9666 34.214L30.0329 42.1477C29.8396 42.341 29.519 42.341 29.3257 42.1477Z",
    ],
  },
  split: { vb: [0, 0, 16, 16], w: 1.4, s: ["M8 14V8.6L4 4.6", "M8 8.6L12 4.6", "M4 7.4V4.6H6.8", "M12 7.4V4.6H9.2"] },
};
const pathCache = new Map();
const P = (d) => {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
};

function icon(ctx, name, x, y, size, color) {
  const ic = ICONS[name];
  const [vx, vy, vw] = ic.vb;
  const k = size / vw;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.translate(-vx, -vy);
  if (ic.s) {
    ctx.strokeStyle = color;
    ctx.lineWidth = ic.w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ic.s.forEach((d) => ctx.stroke(P(d)));
  }
  if (ic.f) {
    ctx.fillStyle = color;
    ic.f.forEach((d) => ctx.fill(P(d)));
  }
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

function box(ctx, x, y, w, h, r, fill, stroke, lw = 1) {
  rr(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function text(ctx, str, x, y, { size = 14, weight = 400, color = C.text, align = "left", font = CLASH, spacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  if (spacing && "letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

function measure(ctx, str, size, weight = 400, spacing = 0) {
  ctx.font = `${weight} ${size}px ${CLASH}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(str).width;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  return w;
}

function wrap(ctx, str, x, y, max, lh, opts) {
  ctx.font = `${opts.weight || 400} ${opts.size}px ${CLASH}`;
  const words = str.split(" ");
  let line = "";
  let n = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      text(ctx, line, x, y + n * lh, opts);
      line = word;
      n++;
    } else line = test;
  }
  if (line) text(ctx, line, x, y + n * lh, opts);
  return n + 1;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (x) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const btc = (sats) => (sats / 1e8).toFixed(8);
const group = (n) => Math.round(n).toLocaleString("en-US");
const RATE = 313.23 / 4511; // ₹ per sat, from the home screen reference
const inr = (sats) => "≈ ₹" + (sats * RATE).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- story data, shared with the scene ---------- */
export const WALLET = {
  start: 4511,
  found: [18342, 9127, 14763],
  sent: [29434, 20566, 4511],
  tipFrom: 845102,
  tipTo: 845246,
  sp: "sp1qq2e3...u9k2x7v4",
  reused: "bc1qm4f8...hw7d9f2c",
};
const HISTORY = [
  { dir: 1, amount: "+0.00004511" },
  { dir: -1, amount: "-0.00002100", split: true },
  { dir: 1, amount: "+0.00004511" },
  { dir: -1, amount: "-0.00002100", split: true },
  { dir: 1, amount: "+0.00004511" },
];

/* ---------- the display ---------- */
export class PhoneScreen {
  constructor(aspect, { logo = null, scale = 2 } = {}) {
    this.width = Math.round(PT * scale);
    this.height = Math.round(this.width / aspect);
    this.k = this.width / PT;
    this.h = this.height / this.k;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d");
    this.logo = logo;
    this.qr = makeQr(33);
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.flipY = false; // glTF UV convention
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.key = "";
  }

  /**
   * state: { from, to, p, dir, tap: {id, p}, ...screen data }
   * Repaints only when the quantised state changes.
   */
  update(state) {
    const key = JSON.stringify(state);
    if (key === this.key) return false;
    this.key = key;
    const { ctx } = this;
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    ctx.globalAlpha = 1;
    const p = ease(state.p || 0);
    if (!p || state.from === state.to) {
      this.paint(state.to === undefined || p >= 1 ? state.to : state.from, state);
    } else if (p >= 1) {
      this.paint(state.to, state);
    } else if (state.mode === "fade") {
      // chapter changes: a quick cross-fade, drawn through a second canvas so
      // each screen keeps its own alpha
      this.paint(state.from, state);
      const off = this.layer();
      const main = this.ctx;
      this.ctx = off.ctx;
      off.ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      off.ctx.globalAlpha = 1;
      this.paint(state.to, state);
      this.ctx = main;
      main.save();
      main.setTransform(1, 0, 0, 1, 0, 0);
      main.globalAlpha = p;
      main.drawImage(off.canvas, 0, 0);
      main.restore();
    } else {
      // push: the new screen slides in over the old one; pop: the reverse
      const push = state.dir !== -1;
      const under = push ? state.from : state.to;
      const over = push ? state.to : state.from;
      const q = push ? p : 1 - p;
      ctx.save();
      ctx.translate(-PT * 0.28 * q, 0);
      this.paint(under, state);
      ctx.restore();
      ctx.fillStyle = `rgba(0,0,0,${0.08 * q})`;
      ctx.fillRect(0, 0, PT, this.h);
      ctx.save();
      ctx.translate(PT * (1 - q), 0);
      ctx.shadowColor = "rgba(16,24,40,0.12)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = C.bg;
      ctx.fillRect(0, 0, PT, this.h);
      ctx.shadowColor = "transparent";
      this.paint(over, state);
      ctx.restore();
    }
    this.statusBar();
    this.texture.needsUpdate = true;
    return true;
  }

  layer() {
    if (!this.fadeLayer) {
      const canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;
      this.fadeLayer = { canvas, ctx: canvas.getContext("2d") };
    }
    return this.fadeLayer;
  }

  paint(name, s) {
    const { ctx } = this;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, PT, this.h);
    if (name === "home") this.home(s);
    ctx.save();
    if (name === "send") this.send(s);
    else if (name === "receive") this.receive(s);
    else if (name === "sync") this.sync(s);
    ctx.restore();
  }

  tapAt(s, id, x, y, w, h, r, onDark) {
    const t = s.tap;
    if (!t || t.id !== id || t.p <= 0 || t.p >= 1) return;
    const { ctx } = this;
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = Math.hypot(w, h) * 0.55 * easeOut(t.p * 1.4);
    const a = (1 - clamp01((t.p - 0.35) / 0.65)) * (onDark ? 0.28 : 0.16);
    ctx.fillStyle = onDark ? `rgba(255,255,255,${a})` : `rgba(117,76,232,${a})`;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  press(s, id) {
    const t = s.tap;
    if (!t || t.id !== id) return 1;
    return 1 - 0.035 * Math.sin(Math.PI * clamp01(t.p / 0.6));
  }

  scaled(s, id, x, y, w, h, draw) {
    const k = this.press(s, id);
    const { ctx } = this;
    if (k === 1) return draw();
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    draw();
    ctx.restore();
  }

  statusBar() {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
    text(ctx, "9:41", 51, 38, { size: 16.5, weight: 600, color: C.text, align: "center", font: SANS });
    ctx.fillStyle = C.text;
    for (let i = 0; i < 4; i++) {
      rr(ctx, 304 + i * 5, 34 - (i + 1) * 2.7, 3.2, (i + 1) * 2.7, 1);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(332, 35);
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, i * 3.7, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    box(ctx, 343.5, 25.5, 23, 11.5, 3.5, null, "rgba(0,0,0,0.38)", 1);
    box(ctx, 345.5, 27.5, 19, 7.5, 2, C.text);
    ctx.restore();
  }

  navBar(title) {
    const { ctx } = this;
    // the enclosure's island sits low, so the bar clears it
    icon(ctx, "back", 16, 100, 24, C.text2);
    text(ctx, title, PT / 2, 118, { size: 17, weight: 500, color: C.text, align: "center" });
    ctx.translate(0, NAV);
  }

  /* ---------- Home: screen/wallets/WalletsList.tsx + phone-screen.png ---------- */
  home(s) {
    const { ctx } = this;
    const hs = s.home || {};
    // header: menu button
    ctx.fillStyle = C.field;
    ctx.beginPath();
    ctx.arc(339, 92, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#545454";
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(339, 92 + i * 8, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // balance
    const sats = hs.balance ?? WALLET.start;
    const amount = btc(sats);
    const wa = measure(ctx, amount, 48, 500, -1.2);
    const wu = measure(ctx, "BTC", 22, 400);
    const x0 = PT / 2 - (wa + 10 + wu) / 2;
    text(ctx, amount, x0, 176, { size: 48, weight: 500, color: C.text, spacing: -1.2 });
    text(ctx, "BTC", x0 + wa + 10, 176, { size: 22, weight: 400, color: C.muted });
    text(ctx, inr(sats), PT / 2, 205, { size: 15, color: C.muted, align: "center" });

    // ScanProgressBar
    this.scaled(s, "banner", 23, 228, 344, 50, () => {
      box(ctx, 23, 228, 344, 50, 16, C.surfaceSubtle, C.accentSubtle, 1);
      if (hs.scanning) {
        const pulse = 0.5 + 0.5 * Math.sin((hs.pulse || 0) * Math.PI * 2);
        ctx.fillStyle = `rgba(117,76,232,${0.12 + 0.12 * pulse})`;
        ctx.beginPath();
        ctx.arc(55, 253, 8 + 3 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.brand;
        ctx.beginPath();
        ctx.arc(55, 253, 4, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, "Checking pending payments.....", 75, 258, { size: 14, color: C.text2 });
      } else {
        icon(ctx, "check", 45, 243, 20, C.success);
        text(ctx, `Synced to block ${group(hs.tip ?? WALLET.tipFrom)}`, 75, 258, { size: 14, color: C.text2 });
      }
      icon(ctx, "chevron", 328, 243, 20, C.borderStrong);
    });
    this.tapAt(s, "banner", 23, 228, 344, 50, 16);

    // actions
    this.scaled(s, "request", 24, 305, 130, 59, () => {
      box(ctx, 24, 305, 130, 59, 16, C.tint, "#9F84F0", 1);
      const w = 28 + 4 + measure(ctx, "Request", 15, 500);
      icon(ctx, "receive", 89 - w / 2, 320.5, 28, C.brand);
      text(ctx, "Request", 89 - w / 2 + 32, 340, { size: 15, weight: 500, color: C.brand });
    });
    this.tapAt(s, "request", 24, 305, 130, 59, 16);
    box(ctx, 167, 305, 56, 59, 16, C.bg, C.accentSubtle, 1);
    icon(ctx, "qr", 184, 323.5, 22, C.brand);
    this.scaled(s, "pay", 236, 305, 130, 59, () => {
      box(ctx, 236, 305, 130, 59, 16, C.brand);
      const w = 28 + 4 + measure(ctx, "Pay", 15, 500);
      icon(ctx, "pay", 301 - w / 2, 320.5, 28, "#FFFFFF");
      text(ctx, "Pay", 301 - w / 2 + 32, 340, { size: 15, weight: 500, color: "#FFFFFF" });
    });
    this.tapAt(s, "pay", 236, 305, 130, 59, 16, true);

    // track card
    box(ctx, 23, 390, 344, 79, 16, C.surfaceSubtle, C.accentSubtle, 1);
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(64, 429.5, 24, 0, Math.PI * 2);
    ctx.fill();
    icon(ctx, "search", 52, 417.5, 24, C.brand);
    text(ctx, "Track a Payment", 100, 425, { size: 17, weight: 500, color: C.text });
    text(ctx, "Find it faster with a TXID", 100, 450, { size: 14, color: C.muted });
    icon(ctx, "chevron", 328, 420, 20, C.borderStrong);

    text(ctx, "Transactions", 23, 514, { size: 16, weight: 500, color: C.muted });

    // transaction list; new payments slide in at the top one by one
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 524, PT, this.h - 524);
    ctx.clip();
    const rows = hs.rows || 0;
    const shift = WALLET.found.reduce((acc, _, i) => acc + ease(clamp01(rows - i)) * 86, 0);
    let y = 532 + shift;
    for (const row of HISTORY) {
      if (y > this.h) break;
      this.txRow(23, y, row, 1);
      y += 86;
    }
    WALLET.found.forEach((sats, i) => {
      const a = clamp01(rows - (WALLET.found.length - 1 - i));
      if (a <= 0) return;
      const k = WALLET.found.length - 1 - i;
      const ry = 532 + shift - 86 * (k + 1) + (1 - easeOut(a)) * -14;
      this.txRow(23, ry, { dir: 1, amount: "+" + btc(sats), sub: `Conf: ${i + 1}`, fresh: Math.min(1 - clamp01((rows - k - 1) * 1.2), hs.glow ?? 1) }, easeOut(a));
    });
    ctx.restore();
  }

  txRow(x, y, row, alpha) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha *= alpha;
    box(ctx, x, y, 344, 78, 16, C.surfaceBrandSubtle, "#EBEAEA", 0.75);
    if (row.fresh > 0) {
      ctx.globalAlpha = alpha * row.fresh;
      box(ctx, x, y, 344, 78, 16, "rgba(234,228,251,0.7)", "#C9BBF6", 1);
      ctx.globalAlpha = alpha;
    }
    const cx = x + 34;
    const cy = y + 39;
    ctx.fillStyle = C.bg;
    ctx.strokeStyle = C.accentSubtle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 21.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = row.dir > 0 ? C.surfaceSubtle : C.field;
    ctx.strokeStyle = row.dir > 0 ? C.accentSubtle : "#E6E4E4";
    ctx.beginPath();
    ctx.arc(cx, cy, 13.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    icon(ctx, row.dir > 0 ? "txIn" : "txOut", cx - 21.9, cy - 22, 44, row.dir > 0 ? C.brand : C.text);
    text(ctx, "sp1q...aw3x", x + 67, y + 30, { size: 14.6, weight: 500, color: C.text, spacing: -0.1 });
    text(ctx, row.sub || "Apr 2, 2026", x + 67, y + 57, { size: 13, color: C.muted });
    text(ctx, row.amount, x + 331, y + 30, { size: 14.6, weight: 500, color: row.dir > 0 ? C.brand : C.text, align: "right", spacing: -0.1 });
    if (row.split) {
      box(ctx, x + 149, y + 14, 54, 22, 11, C.surfaceSubtle, "#E8E4FA", 1);
      icon(ctx, "split", x + 156, y + 18, 14, "#6E55E0");
      text(ctx, "Split", x + 174, y + 29.5, { size: 11.5, weight: 500, color: "#6E55E0" });
    }
    ctx.restore();
  }

  /* ---------- Send: screen/send/SendDetails.tsx + AmountHero.tsx ---------- */
  send(s) {
    const { ctx } = this;
    const ss = s.send || {};
    this.navBar("Send");
    const sats = ss.amount ?? WALLET.sent[0];
    const amount = btc(sats);
    const wa = measure(ctx, amount, 48, 500, -1.2);
    const wu = measure(ctx, "BTC", 20, 400);
    const x0 = PT / 2 - (wa + 8 + wu) / 2;
    ctx.save();
    ctx.globalAlpha = ss.fade ?? 1;
    text(ctx, amount, x0, 186, { size: 48, weight: 500, color: C.text, spacing: -1.2 });
    text(ctx, "BTC", x0 + wa + 8, 186, { size: 20, color: C.muted });
    text(ctx, inr(sats), PT / 2, 214, { size: 15, color: C.muted, align: "center" });
    ctx.restore();

    text(ctx, "Address", 24, 282, { size: 14, weight: 500, color: C.text2 });
    box(ctx, 24, 294, 342, 56, 16, C.field);
    text(ctx, WALLET.reused, 40, 328, { size: 15, color: C.text2 });
    text(ctx, "Note", 24, 386, { size: 14, weight: 500, color: C.text2 });
    box(ctx, 24, 398, 342, 56, 16, C.field);
    text(ctx, "Only visible to you", 40, 432, { size: 15, color: C.muted });

    const by = this.h - 34 - 56 - NAV;
    this.scaled(s, "next", 24, by, 342, 56, () => {
      box(ctx, 24, by, 342, 56, 16, C.brand);
      text(ctx, "Next", PT / 2, by + 34, { size: 16, weight: 500, color: "#FFFFFF", align: "center" });
    });
    this.tapAt(s, "next", 24, by, 342, 56, 16, true);
  }

  /* ---------- Receive: screen/receive/ReceiveDetails.tsx, QRCard, AddressCopyCard ---------- */
  receive(s) {
    const { ctx } = this;
    const rs = s.receive || {};
    this.navBar("Receive");
    // PillSegmentedControl
    box(ctx, 24, 100, 342, 44, 16, C.surfaceBrandSubtle, C.accentSubtle, 1);
    ctx.save();
    ctx.shadowColor = "rgba(16,24,40,0.1)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
    box(ctx, 28, 104, 167, 36, 13, C.bg);
    ctx.restore();
    box(ctx, 28, 104, 167, 36, 13, null, C.accentSubtle, 1);
    text(ctx, "Silent Payments", 111.5, 127, { size: 14, weight: 500, color: C.text2, align: "center" });
    text(ctx, "Standard Address", 278.5, 127, { size: 14, color: C.muted, align: "center" });

    // InfoBanner
    box(ctx, 24, 156, 342, 96, 16, C.surfaceSubtle);
    icon(ctx, "info", 43, 173, 20, C.brand);
    ctx.font = `400 15px ${CLASH}`;
    text(ctx, "Silent Payment addresses are reusable.", 73, 187, { size: 15, color: C.text2 });
    text(ctx, "Share one address for multiple", 73, 210, { size: 15, color: C.text2 });
    text(ctx, "payments", 73, 233, { size: 15, color: C.text2 });
    const wp = measure(ctx, "payments ", 15);
    text(ctx, "without compromising privacy.", 73 + wp, 233, { size: 15, weight: 500, color: C.text2 });

    // QRCard
    const qy = 260;
    const qh = Math.min(312, this.h - 34 - 56 - NAV - 16 - 76 - 8 - qy);
    const glow = rs.pulse || 0;
    box(ctx, 24, qy, 342, qh, 16, C.surfaceSubtle);
    if (glow > 0) box(ctx, 24, qy, 342, qh, 16, null, `rgba(117,76,232,${0.55 * glow})`, 1.5);
    const size = Math.min(qh - 44, 260);
    box(ctx, PT / 2 - size / 2 - 8, qy + (qh - size) / 2 - 8, size + 16, size + 16, 14, C.bg);
    this.drawQr(PT / 2 - size / 2, qy + (qh - size) / 2, size);

    // AddressCopyCard
    const ay = qy + qh + 8;
    box(ctx, 24, ay, 342, 70, 16, C.surfaceSubtle);
    if (glow > 0) box(ctx, 24, ay, 342, 70, 16, `rgba(234,228,251,${glow})`);
    text(ctx, WALLET.sp, 182, ay + 30, { size: 16, color: C.text2, align: "center" });
    const label = rs.copied ? "Copied to clipboard." : "Tap to copy";
    const lw = 16 + 6 + measure(ctx, label, 12);
    icon(ctx, "copy", 182 - lw / 2, ay + 42, 15, C.muted);
    text(ctx, label, 182 - lw / 2 + 22, ay + 54, { size: 12, color: C.muted });
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(336, ay + 35, 18, 0, Math.PI * 2);
    ctx.fill();
    icon(ctx, "eye", 326, ay + 25, 20, C.muted);

    // footer
    const by = this.h - 34 - 56 - NAV;
    box(ctx, 24, by, 342, 56, 16, C.brand);
    const w = 19 + 9 + measure(ctx, "Share Address", 16, 500);
    icon(ctx, "share", PT / 2 - w / 2, by + 18, 19, "#FFFFFF");
    text(ctx, "Share Address", PT / 2 - w / 2 + 28, by + 34, { size: 16, weight: 500, color: "#FFFFFF" });
  }

  drawQr(x, y, size) {
    const { ctx, qr } = this;
    const n = qr.length;
    const m = size / n;
    ctx.fillStyle = C.text;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr[r][c]) ctx.fillRect(x + c * m, y + r * m, m + 0.05, m + 0.05);
      }
    }
    const b = size * 0.19;
    const bx = x + size / 2 - b / 2;
    const by = y + size / 2 - b / 2;
    box(ctx, bx - 4, by - 4, b + 8, b + 8, 12, C.bg);
    if (this.logo) ctx.drawImage(this.logo, bx, by, b, b);
  }

  /* ---------- Sync: screen/wallets/SyncScreen.tsx, SyncStatusIcon, ProgressBar ---------- */
  sync(s) {
    const { ctx } = this;
    const ys = s.sync || {};
    const p = clamp01(ys.p || 0);
    const done = !!ys.done;
    this.navBar("Sync");

    // SyncStatusIcon, 66pt
    const cx = PT / 2;
    const cy = 138;
    ctx.strokeStyle = C.accentSubtle;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 32.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = done ? "#EBF5ED" : C.surfaceSubtle;
    ctx.beginPath();
    ctx.arc(cx, cy, 20.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = done ? "#CFE9D9" : C.accentSubtle;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    if (!done) ctx.rotate(ys.spin || 0);
    icon(ctx, done ? "synced" : "syncing", -33, -33, 66, done ? C.success : C.brand);
    ctx.restore();

    text(ctx, done ? "You're all caught up" : "Updating your wallet", cx, 210, { size: 20, weight: 500, color: C.text, align: "center" });

    const pct = String(Math.round(p * 100));
    const wn = measure(ctx, pct, 44, 500, -2);
    const wp = measure(ctx, "%", 20, 500);
    const px = cx - (wn + 2 + wp) / 2;
    text(ctx, pct, px, 270, { size: 44, weight: 500, color: C.text, spacing: -2 });
    text(ctx, "%", px + wn + 2, 270, { size: 20, weight: 500, color: C.muted });

    if (!done) {
      const left = Math.max(1, Math.ceil((1 - p) * 3));
      const eta = `about ${left}m left`;
      const we = 18 + 5 + measure(ctx, eta, 13);
      icon(ctx, "clock", cx - we / 2, 284, 18, C.muted);
      text(ctx, eta, cx - we / 2 + 23, 298, { size: 13, color: C.muted, align: "left" });
    }

    // ProgressBar
    box(ctx, 24, 314, 342, 8, 4, "#EEEDF0");
    if (p > 0.005) box(ctx, 24, 314, Math.max(8, 342 * p), 8, 4, done ? C.success : C.brand);
    text(ctx, done ? "Watching for new payments" : "Checking recent activity for your payments", cx, 346, { size: 14, color: C.muted, align: "center" });

    // progress card
    box(ctx, 24, 366, 342, 92, 16, C.surfaceSubtle, C.accentSubtle, 1);
    text(ctx, "Update Progress", 40, 398, { size: 18, weight: 500, color: C.text });
    text(ctx, "Block", 40, 436, { size: 14, color: C.muted });
    const cur = group(WALLET.tipFrom + (WALLET.tipTo - WALLET.tipFrom) * p);
    const tot = group(WALLET.tipTo);
    const wt = measure(ctx, tot, 14);
    const ws = measure(ctx, " / ", 14);
    text(ctx, tot, 350, 436, { size: 14, color: C.text2, align: "right" });
    text(ctx, " / ", 350 - wt, 436, { size: 14, color: C.muted, align: "right" });
    text(ctx, cur, 350 - wt - ws, 436, { size: 14, weight: 600, color: C.text, align: "right" });

    // found so far
    const found = ys.found || 0;
    WALLET.found.forEach((sats, i) => {
      const a = clamp01(found - i);
      if (a <= 0) return;
      const y = 466 + i * 32;
      ctx.save();
      ctx.globalAlpha = easeOut(a);
      ctx.translate(0, (1 - easeOut(a)) * 8);
      box(ctx, 24, y, 342, 28, 14, "#EBF5ED");
      icon(ctx, "check", 34, y + 4, 20, C.success);
      text(ctx, "Payment detected", 60, y + 19, { size: 13, weight: 500, color: C.text2 });
      text(ctx, "+" + btc(sats), 352, y + 19, { size: 13, weight: 500, color: C.brand, align: "right" });
      ctx.restore();
    });

    // button + privacy note
    const iy = this.h - 34 - 86 - NAV;
    const by = iy - 12 - 56;
    if (done) {
      box(ctx, 24, by, 342, 56, 16, C.accentSubtle, C.brand, 1);
      text(ctx, "Check again", cx, by + 34, { size: 16, weight: 500, color: C.brand, align: "center" });
    } else {
      box(ctx, 24, by, 342, 56, 16, C.brand);
      const w = 13 + 10 + measure(ctx, "Pause", 16, 500);
      icon(ctx, "pause", cx - w / 2, by + 21.5, 13, "#FFFFFF");
      text(ctx, "Pause", cx - w / 2 + 23, by + 34, { size: 16, weight: 500, color: "#FFFFFF" });
    }
    box(ctx, 24, iy, 342, 86, 16, C.surfaceSubtle);
    icon(ctx, "info", 40, iy + 16, 20, C.brand);
    wrap(ctx, "Shroud checks for your payments on your device, so the server never sees your address. Tor hides your connection.", 70, iy + 29, 280, 18, { size: 13, color: C.muted });
  }

  dispose() {
    this.texture.dispose();
  }
}

/* ---------- the story, as the app would be operated ---------- */
const win = (t, a, b) => clamp01((t - a) / (b - a));

/** Screen state for story time t (scroll) and wall time `now` (seconds). */
export function storyScreen(t, now, B) {
  const s = { tap: null, home: {}, send: {}, receive: {}, sync: {} };
  const route = (from, to, a, b, dir = 1, fade = false) => {
    s.from = from;
    s.to = to;
    s.dir = dir;
    if (fade) s.mode = "fade";
    s.p = Math.round(win(t, a, b) * 40) / 40;
  };
  const tap = (id, a) => {
    const p = win(t, a, a + 0.12);
    if (p > 0 && p < 1 && !s.tap) s.tap = { id, p: Math.round(p * 30) / 30 };
  };

  // where we are in the app
  if (t < B.toReceive[0]) route("home", "send", B.sendPush[0], B.sendPush[1]);
  else if (t < B.toReceive[1]) route("send", "home", B.toReceive[0], B.toReceive[0] + 0.12, -1, true);
  else if (t < B.toHome) route("home", "receive", B.toReceive[1], B.toReceive[1] + 0.12);
  else if (t < B.toSync) route("receive", "home", B.toHome, B.toHome + 0.12, -1, true);
  else if (t < B.backHome) route("home", "sync", B.toSync, B.toSync + 0.12);
  else route("sync", "home", B.backHome, B.backHome + 0.12, -1);

  tap("pay", B.payTap);
  B.sends.forEach((f) => tap("next", f - 0.1));
  tap("request", B.toReceive[1] - 0.12);
  tap("banner", B.toSync - 0.12);

  // send: one amount after another, all to the same address
  const swap = B.sends.map((f) => f + 0.06);
  s.send.amount = WALLET.sent[Math.min(2, swap.slice(1).filter((f) => t >= f).length)];
  s.send.fade = Math.round(Math.min(1, ...swap.slice(1).map((f) => Math.abs(t - f) / 0.04)) * 20) / 20;

  // receive: the address card answers each payment that lands
  let pulse = 0;
  B.land.forEach((l) => (pulse = Math.max(pulse, Math.exp(-(((t - l) / 0.05) ** 2)))));
  s.receive.pulse = Math.round(pulse * 20) / 20;

  // home: scanning banner, then results counting in
  s.home.scanning = t >= B.toHome && t < B.backHome;
  s.home.pulse = s.home.scanning ? Math.round(((now * 0.8) % 1) * 24) / 24 : 0;
  const rows = WALLET.found.reduce((n, _, i) => n + win(t, B.rows + i * 0.1, B.rows + i * 0.1 + 0.12), 0);
  s.home.rows = Math.round(rows * 30) / 30;
  const count = ease(win(t, B.rows, B.rows + 0.36));
  const total = WALLET.found.reduce((a, b) => a + b, 0);
  s.home.balance = Math.round(WALLET.start + total * count);
  s.home.tip = t >= B.backHome ? WALLET.tipTo : WALLET.tipFrom;
  s.home.glow = Math.round((1 - win(t, B.rows + 0.4, B.rows + 0.5)) * 20) / 20;

  // sync: progress follows the sweep
  const p = win(t, B.scan[0], B.scan[1]);
  s.sync.p = Math.round(p * 100) / 100;
  s.sync.done = p >= 1;
  s.sync.found = Math.round(B.home.reduce((n, h) => n + win(t, h, h + 0.05), 0) * 10) / 10;
  s.sync.spin = s.to === "sync" || s.from === "sync" ? Math.round(((now * 0.5) % 1) * 48) / 48 * Math.PI * 2 : 0;

  // keep only what the visible screens need, so idle frames don't repaint
  const used = new Set([s.from, s.to]);
  for (const k of ["home", "send", "receive", "sync"]) if (!used.has(k)) delete s[k];
  if (s.p >= 1 || s.p <= 0) {
    const only = s.p >= 1 ? s.to : s.from;
    for (const k of ["home", "send", "receive", "sync"]) if (k !== only) delete s[k];
    s.from = s.to = only;
    s.p = 0;
  }
  return s;
}

/** The download section's phone: a sync that fills, settles, and starts again. */
export function syncLoop(now) {
  const cycle = 16;
  const c = (now % cycle) / cycle;
  const p = Math.min(1, c / 0.78);
  return {
    from: "sync",
    to: "sync",
    p: 0,
    tap: null,
    sync: {
      p: Math.round(ease(p) * 100) / 100,
      done: p >= 1,
      found: 0,
      spin: p >= 1 ? 0 : Math.round(((now * 0.5) % 1) * 36) / 36 * Math.PI * 2,
    },
  };
}

// Deterministic QR-style matrix: finder patterns, timing lines and seeded noise.
function makeQr(n) {
  let seed = 352;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grid = Array.from({ length: n }, () => Array.from({ length: n }, () => rand() > 0.5));
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr2 = r0 + r;
        const cc = c0 + c;
        if (rr2 < 0 || cc < 0 || rr2 >= n || cc >= n) continue;
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rr2][cc] = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (edge || core);
      }
    }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) grid[6][i] = grid[i][6] = i % 2 === 0;
  const mid = Math.floor(n / 2);
  for (let r = mid - 4; r <= mid + 4; r++) for (let c = mid - 4; c <= mid + 4; c++) grid[r][c] = false;
  return grid;
}
