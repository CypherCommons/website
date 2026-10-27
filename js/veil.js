/* ============================================================
   Hero veil: address fragments drifting through the dark that
   break up into grain around the headline and the pointer.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.querySelector("[data-veil]");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var root = document.documentElement;
  var copy = document.querySelector(".hero__copy");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  var BECH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  var HEX = "0123456789abcdef";
  var GREY = "245,245,247";
  var LAV = "196,181,253";
  var FONT = '"JetBrains Mono", ui-monospace, monospace';
  var FPS = 30;

  var W = 0;
  var H = 0;
  var scale = 1;
  var frags = [];
  var zone = { x: 0, y: 0, rx: 1, ry: 1 };
  var pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, k: 0, on: false };
  var widths = {};
  var running = false;
  var inView = true;
  var fade = 1;
  var last = 0;
  var raf = 0;
  var flashAt = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(set, n) {
    var s = "";
    for (var i = 0; i < n; i++) s += set[(Math.random() * set.length) | 0];
    return s;
  }

  // Shapes of things that show up on-chain: addresses, txids, raw bytes.
  function phrase() {
    var r = Math.random();
    if (r < 0.26) return { text: "bc1p" + pick(BECH, 6 + ((Math.random() * 5) | 0)) + "…" + pick(BECH, 4), set: BECH, lock: 4 };
    if (r < 0.44) return { text: "sp1qq" + pick(BECH, 6 + ((Math.random() * 4) | 0)) + "…" + pick(BECH, 4), set: BECH, lock: 5 };
    if (r < 0.58) return { text: "bc1q" + pick(BECH, 8) + "…" + pick(BECH, 4), set: BECH, lock: 4 };
    if (r < 0.8) return { text: pick(HEX, 8) + " " + pick(HEX, 8), set: HEX, lock: 0 };
    var groups = 3 + ((Math.random() * 3) | 0);
    var out = [];
    for (var i = 0; i < groups; i++) out.push(pick(HEX, 2));
    return { text: out.join(" "), set: HEX, lock: 0 };
  }

  function charWidth(size) {
    if (!widths[size]) {
      ctx.font = size + "px " + FONT;
      widths[size] = ctx.measureText("0").width;
    }
    return widths[size];
  }

  function make(x, row) {
    var depth = Math.random();
    var size = depth < 0.45 ? 10 : depth < 0.8 ? 11 : 12.5;
    var p = phrase();
    var tint = Math.random() < 0.3;
    return {
      x: x,
      y: row,
      size: size,
      v: -(5 + depth * 11),
      a: (tint ? rnd(0.3, 0.46) : rnd(0.18, 0.34) * (0.7 + depth * 0.5)) * (W < 600 ? 0.8 : 1),
      tint: tint,
      chars: p.text.split(""),
      set: p.set,
      lock: p.lock,
      cw: charWidth(size),
      bob: rnd(0, Math.PI * 2),
      flash: 0,
    };
  }

  function measureZone() {
    var c = canvas.getBoundingClientRect();
    if (!copy) {
      zone = { x: W / 2, y: H * 0.36, rx: W * 0.32, ry: H * 0.24 };
      return;
    }
    var r = copy.getBoundingClientRect();
    var title = copy.querySelector(".hero__title");
    var t = title ? title.getBoundingClientRect() : r;
    var top = Math.min(t.top, r.top) - c.top;
    var bottom = r.bottom - c.top;
    var width = Math.max(t.width, Math.min(r.width, W));
    zone = {
      x: r.left - c.left + r.width / 2,
      y: (top + bottom) / 2,
      rx: Math.max(160, width * 0.54),
      ry: Math.max(120, (bottom - top) * 0.58),
    };
  }

  function seed() {
    frags = [];
    var gap = W < 600 ? 24 : 28;
    var rows = Math.floor((H - 70) / gap);
    var density = Math.max(1.1, Math.min(2.4, W / 640));
    for (var i = 0; i < rows; i++) {
      var y = 74 + i * gap + rnd(-4, 4);
      var count = Math.max(1, Math.round(density + rnd(-0.4, 0.4)));
      for (var j = 0; j < count; j++) {
        frags.push(make(((j + Math.random() * 0.8) / count) * (W + 160) - 80, y));
      }
    }
  }

  function resize() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (!w || !h) return;
    W = w;
    H = h;
    // a low-res buffer: the fragments are meant to read as soft, not crisp
    scale = Math.min(1, window.devicePixelRatio || 1, 1600 / W);
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    widths = {};
    measureZone();
    seed();
    draw(0, performance.now());
  }

  // 0 (clear) .. 1 (fully dissolved into grain)
  function dissolve(x, y) {
    var dx = (x - zone.x) / zone.rx;
    var dy = (y - zone.y) / zone.ry;
    // a squarish ellipse, so the corners of the copy block are covered too
    var e = Math.sqrt(dx * dx * dx * dx + dy * dy * dy * dy);
    var d = Math.min(1, Math.max(0, (1.3 - e) / 0.8));
    if (pointer.k > 0.01) {
      var px = x - pointer.x;
      var py = y - pointer.y;
      var r = Math.sqrt(px * px + py * py);
      var R = 130;
      if (r < R) d = Math.max(d, Math.pow(1 - r / R, 0.7) * pointer.k);
    }
    return d;
  }

  // softens fragments toward the nav and the bottom edge
  function edge(y) {
    var top = Math.min(1, Math.max(0, (y - 78) / 70));
    var bottom = Math.min(1, Math.max(0, (H - y) / (H * 0.22)));
    return top * bottom;
  }

  function grainCloud(cx, cy, rx, ry, count, alpha) {
    for (var i = 0; i < count; i++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = Math.sqrt(Math.random());
      var x = cx + Math.cos(ang) * rad * rx;
      var y = cy + Math.sin(ang) * rad * ry;
      ctx.globalAlpha = alpha * (1 - rad) * Math.random();
      ctx.fillStyle = Math.random() < 0.35 ? "rgb(" + LAV + ")" : "rgb(" + GREY + ")";
      ctx.fillRect(x, y, 1.1, 1.1);
    }
  }

  function draw(dt, now) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = "middle";

    if (dt && now - flashAt > 2600) {
      flashAt = now;
      var lit = frags[(Math.random() * frags.length) | 0];
      if (lit && dissolve(lit.x + lit.chars.length * lit.cw * 0.5, lit.y) < 0.05) lit.flash = 1;
    }

    var font = 0;
    for (var i = 0; i < frags.length; i++) {
      var f = frags[i];
      var len = f.chars.length;
      var width = len * f.cw;
      f.x += f.v * dt;
      if (f.x + width < -20) {
        var p = phrase();
        f.x = W + rnd(10, 120);
        f.chars = p.text.split("");
        f.set = p.set;
        f.lock = p.lock;
        len = f.chars.length;
        width = len * f.cw;
      }
      if (f.x > W + 140) continue;
      if (dt && Math.random() < dt * 1.6) {
        var at = f.lock + ((Math.random() * (len - f.lock)) | 0);
        if (f.chars[at] !== " " && f.chars[at] !== "…") f.chars[at] = f.set[(Math.random() * f.set.length) | 0];
      }
      if (f.flash > 0) f.flash = Math.max(0, f.flash - dt * 0.45);

      var y = f.y + Math.sin(now * 0.0004 + f.bob) * 2.5;
      var e = edge(y);
      if (e <= 0) continue;
      if (font !== f.size) {
        ctx.font = f.size + "px " + FONT;
        font = f.size;
      }
      var glow = f.flash > 0 ? Math.sin(f.flash * Math.PI) : 0;
      var rgb = f.tint || glow > 0 ? LAV : GREY;
      var base = (f.a + glow * 0.45) * e;
      ctx.fillStyle = "rgb(" + rgb + ")";

      var d0 = dissolve(f.x, y);
      var d1 = dissolve(f.x + width / 2, y);
      var d2 = dissolve(f.x + width, y);
      if (d0 < 0.02 && d1 < 0.02 && d2 < 0.02) {
        ctx.globalAlpha = base;
        ctx.fillText(f.chars.join(""), f.x, y);
        continue;
      }
      for (var c = 0; c < len; c++) {
        var ch = f.chars[c];
        if (ch === " ") continue;
        var cx = f.x + c * f.cw;
        var d = dissolve(cx + f.cw / 2, y);
        var a = base * Math.pow(1 - d, 1.6);
        if (a > 0.008) {
          ctx.globalAlpha = a;
          ctx.fillText(ch, cx, y);
        }
        // characters on the way out shed a few specks of grain
        if (d > 0.08 && d < 0.92 && Math.random() < d * 1.4) {
          var spread = 0.6 + d * 2.2;
          ctx.globalAlpha = base * (0.35 + Math.random() * 0.4) * (1 - d * 0.5);
          ctx.fillRect(cx + f.cw / 2 + (Math.random() - 0.5) * f.cw * spread, y + (Math.random() - 0.5) * f.size * spread, 1, 1);
        }
      }
    }

    // the dissolved remains: a faint field of grain behind the headline
    grainCloud(zone.x, zone.y, zone.rx * 1.05, zone.ry, W < 600 ? 110 : 240, 0.14);
    if (pointer.k > 0.01) grainCloud(pointer.x, pointer.y, 120, 120, 60, 0.32 * pointer.k);
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return;
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    pointer.k += ((pointer.on ? 1 : 0) - pointer.k) * Math.min(1, dt * 4);
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 9);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 9);
    draw(dt, now);
  }

  function sync() {
    var go = !reduce.matches && inView && fade > 0.01 && !document.hidden && W > 0;
    if (go === running) return;
    running = go;
    if (go) {
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  // In the pinned story the veil belongs to the hero: it thins out as the
  // headline leaves and is gone before the chapters settle in.
  function onScroll() {
    var next = 1;
    if (root.classList.contains("has-stage")) {
      var vh = window.innerHeight;
      var t = (window.scrollY - vh * 0.02) / (vh * 0.22);
      next = 1 - Math.min(1, Math.max(0, t));
    }
    if (Math.abs(next - fade) > 0.004 || (next === 0) !== (fade === 0)) {
      fade = next;
      canvas.style.opacity = fade.toFixed(3);
      sync();
    }
  }

  function start() {
    if (reduce.matches) return;
    resize();
    canvas.classList.add("is-on");
    onScroll();
    sync();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", sync);
    if (reduce.addEventListener) reduce.addEventListener("change", sync);

    var timer = 0;
    var lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        // mobile toolbars change the height on scroll; only reseed on real changes
        if (Math.abs(window.innerWidth - lastW) < 2 && Math.abs(canvas.clientHeight - H) < 120) {
          measureZone();
          return;
        }
        lastW = window.innerWidth;
        resize();
      }, 160);
    });
    // the headline settles after the intro and once the story is laid out
    setTimeout(measureZone, 1800);
    window.addEventListener("load", function () { setTimeout(measureZone, 300); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(canvas.parentElement);
    }

    if (fine.matches) {
      window.addEventListener("pointermove", function (e) {
        var r = canvas.getBoundingClientRect();
        pointer.tx = e.clientX - r.left;
        pointer.ty = e.clientY - r.top;
        if (!pointer.on) {
          pointer.x = pointer.tx;
          pointer.y = pointer.ty;
        }
        pointer.on = true;
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", function () { pointer.on = false; });
    }
  }

  var ready = document.fonts && document.fonts.load ? document.fonts.load("12px " + FONT) : Promise.resolve();
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(start, start);
})();
