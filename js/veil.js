/* ============================================================
   Hero background: silent payment addresses hidden in the empty
   space either side of the hero. They stay invisible; now and then
   one patch shimmers in, scrambles and fades again. On a mouse, a
   soft light follows the pointer and decodes what's near it.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.querySelector("[data-veil]");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var root = document.documentElement;
  var stage = canvas.parentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  var quality = window.__quality;
  var tier = function () { return (quality && quality.tier) || "high"; };
  // the pointer light is for mice on the upper tiers; shimmers run everywhere
  var lightOn = function () { return fine.matches && tier() !== "low"; };

  var BECH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  var NOISE = BECH + "0123456789abcdef";
  var FONT = '"JetBrains Mono", ui-monospace, monospace';
  // everything the text has to stay clear of
  var KEEP_CLEAR = ".hero__title, .hero__sub, .hero__actions, [data-frame=\"hero\"], [data-standards]";

  var W = 0;
  var H = 0;
  var dpr = 1;
  var size = 12;
  var cw = 7.2;
  var lines = [];
  var light = { x: -999, y: -999, tx: -999, ty: -999, on: 0, target: 0 };
  var R = 170;
  var shimmers = [];
  var nextShimmer = 0;
  var running = false;
  var inView = true;
  var fade = 1;
  var last = 0;
  var raf = 0;
  var timer = 0;
  var lastMove = 0;

  function pick(set) { return set[(Math.random() * set.length) | 0]; }

  function address(len) {
    if (len < 12) {
      var s = "sp1qq";
      while (s.length < len) s += pick(BECH);
      return s;
    }
    var out = "sp1qq";
    while (out.length < len - 5) out += pick(BECH);
    out += "…";
    for (var i = 0; i < 4; i++) out += pick(BECH);
    return out;
  }

  function blocked() {
    var c = canvas.getBoundingClientRect();
    var pad = W < 700 ? 12 : 22;
    var rects = [];
    document.querySelectorAll(KEEP_CLEAR).forEach(function (el) {
      if (!stage.contains(el)) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rects.push({ l: r.left - c.left - pad, r: r.right - c.left + pad, t: r.top - c.top - pad, b: r.bottom - c.top + pad });
    });
    // the header, wherever it sits
    var nav = document.querySelector(".nav-wrap");
    var navBottom = nav ? nav.getBoundingClientRect().bottom - c.top + 16 : 90;
    rects.push({ l: -1, r: W + 1, t: -1, b: Math.max(90, navBottom) });
    return rects;
  }

  function layout() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    size = W < 700 ? 10.5 : 12;
    cw = size * 0.6;
    R = W < 700 ? 120 : 170;
    var rects = blocked();
    var row = size * 2.3;
    var minChars = W < 700 ? 6 : 14;
    var margin = W < 700 ? 10 : 28;
    lines = [];
    shimmers = [];
    for (var y = row / 2, k = 0; y < H - 24; y += row, k++) {
      var free = [[margin, W - margin]];
      rects.forEach(function (b) {
        if (y < b.t - size || y > b.b + size) return;
        var next = [];
        free.forEach(function (f) {
          if (b.r <= f[0] || b.l >= f[1]) next.push(f);
          else {
            if (b.l > f[0]) next.push([f[0], b.l]);
            if (b.r < f[1]) next.push([b.r, f[1]]);
          }
        });
        free = next;
      });
      free.forEach(function (f) {
        var room = Math.floor((f[1] - f[0]) / cw);
        if (room < minChars) return;
        if ((k + (f[0] < W / 2 ? 0 : 1)) % 2) return;
        var len = Math.min(room - 2, minChars + ((Math.random() * 12) | 0));
        var span = len * cw;
        var x = f[0] + Math.random() * Math.max(0, f[1] - f[0] - span);
        var real = address(len);
        var shown = [];
        var reveal = [];
        var glint = [];
        for (var i = 0; i < len; i++) {
          shown.push(real[i] === "…" ? "…" : pick(NOISE));
          reveal.push(0);
          glint.push(0);
        }
        lines.push({ x: x, y: y, real: real, shown: shown, reveal: reveal, glint: glint });
      });
    }
    clear();
  }

  function clear() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
  }

  /* ---------- the occasional shimmer ---------- */
  function scheduleShimmer(now) {
    // irregular: sometimes two close together, sometimes a long quiet
    var gap = tier() === "low" ? 3200 + Math.random() * 5200 : 1600 + Math.random() * 3800;
    nextShimmer = now + gap;
  }

  function startShimmer(now) {
    if (!lines.length) return;
    var L = lines[(Math.random() * lines.length) | 0];
    var len = L.real.length;
    var span = Math.min(len, 8 + ((Math.random() * 10) | 0));
    var from = (Math.random() * (len - span + 1)) | 0;
    shimmers.push({ line: L, from: from, to: from + span, start: now, dur: 2200 + Math.random() * 900 });
  }

  // 0..1 over a shimmer's life: a quick rise, a short hold, a slow fade
  function envelope(u) {
    if (u < 0.22) return u / 0.22;
    if (u < 0.45) return 1;
    return Math.max(0, 1 - (u - 0.45) / 0.55);
  }

  function step(now, dt) {
    var active = false;

    if (now >= nextShimmer) {
      startShimmer(now);
      scheduleShimmer(now);
    }

    // shimmers light a stretch of characters, travelling slightly along it
    lines.forEach(function (L) { for (var i = 0; i < L.glint.length; i++) L.glint[i] = 0; });
    shimmers = shimmers.filter(function (sh) {
      var u = (now - sh.start) / sh.dur;
      if (u >= 1) return false;
      var e = envelope(u);
      var mid = (sh.from + sh.to) / 2 + (u - 0.5) * 4;
      var half = (sh.to - sh.from) / 2 + 0.5;
      for (var i = sh.from; i < sh.to; i++) {
        var d = Math.abs(i - mid) / half;
        sh.line.glint[i] = Math.max(sh.line.glint[i], e * Math.max(0, 1 - d * d));
      }
      active = true;
      return true;
    });

    // the pointer light
    if (!lightOn()) light.target = 0;
    else if (now - lastMove > 2600) light.target = 0;
    var k = 1 - Math.exp(-dt * 9);
    light.x += (light.tx - light.x) * k;
    light.y += (light.ty - light.y) * k;
    light.on += (light.target - light.on) * (1 - Math.exp(-dt * 3));
    if (light.on > 0.01 || light.target > 0) active = true;

    for (var n = 0; n < lines.length; n++) {
      var L = lines[n];
      var dy = L.y - light.y;
      var near = light.on > 0.01 && Math.abs(dy) < R;
      for (var i = 0; i < L.shown.length; i++) {
        var want = 0;
        if (near) {
          var dx = L.x + i * cw - light.x;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < R) want = Math.min(1, (1 - dist / R) * 1.6) * light.on;
        }
        var r = L.reveal[i];
        // decode quickly, scramble back slowly
        r += (want - r) * (want > r ? Math.min(1, dt * 8) : Math.min(1, dt * 1.6));
        L.reveal[i] = r < 0.003 ? 0 : r;
        if (L.reveal[i] > 0) active = true;
        // anything visible and not decoded keeps shuffling
        var lit = L.glint[i] > 0.02 || L.reveal[i] > 0.02;
        if (lit && L.real[i] !== "…" && L.reveal[i] < 0.6 && Math.random() < dt * 9) L.shown[i] = pick(NOISE);
      }
    }
    return active;
  }

  function draw() {
    clear();
    if (light.on > 0.01) {
      var g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, R * 1.6);
      g.addColorStop(0, "rgba(139,108,255," + (0.16 * light.on).toFixed(3) + ")");
      g.addColorStop(0.45, "rgba(124,58,237," + (0.06 * light.on).toFixed(3) + ")");
      g.addColorStop(1, "rgba(124,58,237,0)");
      ctx.fillStyle = g;
      ctx.fillRect(light.x - R * 1.6, light.y - R * 1.6, R * 3.2, R * 3.2);
    }
    ctx.font = "400 " + size + "px " + FONT;
    ctx.textBaseline = "middle";
    for (var n = 0; n < lines.length; n++) {
      var L = lines[n];
      for (var i = 0; i < L.shown.length; i++) {
        var r = L.reveal[i];
        var gl = L.glint[i];
        // invisible unless a shimmer or the light touches it
        var a = Math.max(gl * 0.44, r * 0.6);
        if (a < 0.01) continue;
        var ch = r > 0.6 ? L.real[i] : L.shown[i];
        ctx.fillStyle = (r > 0.6 ? "rgba(214,204,255," : "rgba(196,181,253,") + a.toFixed(3) + ")";
        ctx.fillText(ch, L.x + i * cw, L.y);
      }
    }
  }

  // Frames only while something is lit; otherwise wait for the next shimmer.
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.1, (now - last) / 1000);
    if (dt < 1 / 32) {
      raf = requestAnimationFrame(frame);
      return;
    }
    last = now;
    var active = step(now, dt);
    draw();
    if (active) raf = requestAnimationFrame(frame);
    else idleUntil(nextShimmer);
  }

  function idleUntil(t) {
    clearTimeout(timer);
    timer = setTimeout(wake, Math.max(16, t - performance.now()));
  }

  function wake() {
    if (!running || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    var go = !reduce.matches && inView && fade > 0.01 && !document.hidden && W > 0;
    if (go === running) return;
    running = go;
    clearTimeout(timer);
    if (go) {
      scheduleShimmer(performance.now() - 1200);
      wake();
    } else {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      shimmers = [];
      light.on = light.target = 0;
      clear();
    }
  }

  // In the pinned story the field belongs to the hero and leaves with it.
  function onScroll() {
    var next = 1;
    if (root.classList.contains("has-stage")) {
      var vh = window.innerHeight;
      var t = (window.scrollY - vh * 0.02) / (vh * 0.16);
      next = 1 - Math.min(1, Math.max(0, t));
    }
    if (Math.abs(next - fade) > 0.004 || (next === 0) !== (fade === 0)) {
      fade = next;
      canvas.style.opacity = fade.toFixed(3);
      sync();
    }
  }

  function start() {
    layout();
    canvas.classList.add("is-on");
    onScroll();
    sync();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", sync);
    if (reduce.addEventListener) reduce.addEventListener("change", sync);
    window.addEventListener("pointermove", function (e) {
      if (!lightOn() || reduce.matches || !running) return;
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left;
      var y = e.clientY - r.top;
      if (y < 0 || y > r.height) {
        light.target = 0;
        return;
      }
      if (light.on < 0.02) {
        light.x = x;
        light.y = y;
      }
      light.tx = x;
      light.ty = y;
      light.target = 1;
      lastMove = performance.now();
      wake();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { light.target = 0; });

    var resizeTimer = 0;
    var lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // mobile toolbars change the height on scroll; only relayout on real changes
        if (Math.abs(window.innerWidth - lastW) < 2 && Math.abs(canvas.clientHeight - H) < 120) return;
        lastW = window.innerWidth;
        layout();
      }, 160);
    });
    // the hero settles after its intro and once the story is laid out
    setTimeout(layout, 1800);
    window.addEventListener("load", function () { setTimeout(layout, 300); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(stage);
    }
  }

  var ready = document.fonts && document.fonts.load ? document.fonts.load("12px " + FONT) : Promise.resolve();
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(start, start);
})();
