/* ============================================================
   Hero background: faint, scrambled silent payment addresses in the
   empty space either side of the hero. A soft light follows the
   pointer; where it passes, nearby addresses decode, then scramble
   again once it has moved on.
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
  var quality = window.__quality;
  // below the top tier the addresses stay as still, faint text
  var lite = function () { return !!quality && quality.tier !== "high"; };
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

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
  var running = false;
  var inView = true;
  var fade = 1;
  var last = 0;
  var raf = 0;
  var lastMove = 0;

  function pick(set) { return set[(Math.random() * set.length) | 0]; }

  function address(len) {
    // sp1qq + body … tail, at whatever length the gap allows
    if (len < 12) {
      var s = "sp1qq";
      while (s.length < len) s += pick(BECH);
      return s;
    }
    var tail = 4;
    var head = len - tail - 1;
    var out = "sp1qq";
    while (out.length < head) out += pick(BECH);
    out += "…";
    for (var i = 0; i < tail; i++) out += pick(BECH);
    return out;
  }

  function blocked() {
    var c = canvas.getBoundingClientRect();
    var pad = 22;
    var rects = [];
    document.querySelectorAll(KEEP_CLEAR).forEach(function (el) {
      if (!stage.contains(el)) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rects.push({ l: r.left - c.left - pad, r: r.right - c.left + pad, t: r.top - c.top - pad, b: r.bottom - c.top + pad });
    });
    // the nav, and the hero phone column when the 3D phone draws there
    rects.push({ l: 0, r: W, t: 0, b: 84 });
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
    var minChars = W < 700 ? 9 : 14;
    var margin = W < 700 ? 10 : 28;
    lines = [];
    for (var y = 100 + row / 2, k = 0; y < H - 24; y += row, k++) {
      // free stretches along this row
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
        // a little air, and not every row, so it reads as scattered
        if ((k + (f[0] < W / 2 ? 0 : 1)) % 2) return;
        var len = Math.min(room - 2, minChars + ((Math.random() * 12) | 0));
        var span = len * cw;
        var x = f[0] + Math.random() * Math.max(0, f[1] - f[0] - span);
        var real = address(len);
        var shown = [];
        var reveal = [];
        for (var i = 0; i < len; i++) {
          shown.push(real[i] === "…" ? "…" : pick(NOISE));
          reveal.push(0);
        }
        lines.push({ x: x, y: y, real: real, shown: shown, reveal: reveal });
      });
    }
    draw(performance.now());
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
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
        var ch = r > 0.6 ? L.real[i] : L.shown[i];
        var a = 0.09 + r * 0.5;
        ctx.fillStyle = r > 0.6 ? "rgba(214,204,255," + a.toFixed(3) + ")" : "rgba(220,214,245," + a.toFixed(3) + ")";
        ctx.fillText(ch, L.x + i * cw, L.y);
      }
    }
  }

  function step(now, dt) {
    // the light: follows the pointer, or drifts on its own on touch screens
    if (!fine.matches) {
      var t = now / 1000;
      var side = Math.sin(t * 0.09) > 0 ? 1 : 0;
      light.tx = W * (side ? 0.86 : 0.14) + Math.sin(t * 0.21) * W * 0.06;
      light.ty = H * 0.5 + Math.sin(t * 0.13) * H * 0.32;
      light.target = 0.75;
    } else if (now - lastMove > 2600) {
      light.target = 0;
    }
    var k = 1 - Math.exp(-dt * (fine.matches ? 9 : 1.2));
    light.x += (light.tx - light.x) * k;
    light.y += (light.ty - light.y) * k;
    light.on += (light.target - light.on) * (1 - Math.exp(-dt * 3));

    var busy = light.on > 0.01;
    for (var n = 0; n < lines.length; n++) {
      var L = lines[n];
      var dy = L.y - light.y;
      var near = Math.abs(dy) < R;
      for (var i = 0; i < L.shown.length; i++) {
        var want = 0;
        if (near && light.on > 0.01) {
          var dx = L.x + i * cw - light.x;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < R) want = Math.min(1, (1 - d / R) * 1.6) * light.on;
        }
        var r = L.reveal[i];
        // decode quickly, scramble back slowly
        r += (want - r) * (want > r ? Math.min(1, dt * 8) : Math.min(1, dt * 1.6));
        L.reveal[i] = r;
        if (r > 0.004) busy = true;
        // characters that are still scrambled keep shuffling, a few at a time
        if (L.real[i] !== "…" && r < 0.6 && Math.random() < dt * (0.6 + r * 10)) L.shown[i] = pick(NOISE);
      }
    }
    return busy;
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var dt = (now - last) / 1000;
    // full rate while the light is about, a slow shuffle otherwise
    var busy = light.on > 0.01 || light.target > 0;
    if (dt < (busy ? 1 / 30 : 1 / 8)) return;
    last = now;
    step(now, Math.min(0.1, dt));
    draw(now);
  }

  function sync() {
    var go = !reduce.matches && !lite() && inView && fade > 0.01 && !document.hidden && W > 0;
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

  // In the pinned story the text belongs to the hero and leaves with it.
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
    if (reduce.addEventListener) {
      reduce.addEventListener("change", function () {
        light.on = light.target = 0;
        layout();
        sync();
      });
    }
    if (quality && quality.on) {
      quality.on(function () {
        if (!lite()) return;
        light.on = light.target = 0;
        draw(performance.now());
        sync();
      });
    }
    window.addEventListener("pointermove", function (e) {
      if (!fine.matches || reduce.matches || lite()) return;
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
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", function () { light.target = 0; });

    var timer = 0;
    var lastW = window.innerWidth;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
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
