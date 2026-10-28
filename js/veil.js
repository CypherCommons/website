/* ============================================================
   Hero background: one address, many outputs. A faint silent
   payment address sits behind the headline; every few seconds it
   decodes into a fresh taproot output, holds, then folds back.
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.querySelector("[data-veil]");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var root = document.documentElement;
  var copy = document.querySelector(".hero__copy");
  var title = copy && copy.querySelector(".hero__title");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var BECH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  var NOISE = BECH + "0123456789abcdef#%*+=<>/";
  var FONT = '"JetBrains Mono", ui-monospace, monospace';
  // the donation address's opening and closing characters, carried through
  var SP_HEAD = "sp1qqw6vgrtdf8jys4z0m";
  var SP_FILL = "q8ks2y7cfa0dhv5xj3nmep4wlg9ru6tz";
  var SP_TAIL = "9k3t";
  var FPS = 24;

  // phase lengths, ms
  var IDLE = 4600;
  var DECODE = 1400;
  var HOLD = 2600;

  var W = 0;
  var H = 0;
  var dpr = 1;
  var line = { x: 0, y: 0, size: 14, cw: 9, len: 44, dim: 1 };
  var sp = "";
  var target = "";
  var shown = [];
  var from = "";
  var to = "";
  var phase = "idle";
  var phaseAt = 0;
  var resolveAt = [];
  var running = false;
  var inView = true;
  var fade = 1;
  var last = 0;
  var raf = 0;

  function pick(set) { return set[(Math.random() * set.length) | 0]; }

  // Both strings share one length and one ellipsis position, so the "…"
  // stays put while everything around it changes.
  function spAddress(len) {
    var head = len - SP_TAIL.length - 1;
    var body = (SP_HEAD + SP_FILL + SP_FILL).slice(0, head);
    return body + "…" + SP_TAIL;
  }
  function taprootOutput(len) {
    var head = len - 5;
    var s = "bc1p";
    while (s.length < head) s += pick(BECH);
    s += "…";
    for (var i = 0; i < 4; i++) s += pick(BECH);
    return s;
  }

  function measure() {
    var c = canvas.getBoundingClientRect();
    var t = (title || copy || canvas).getBoundingClientRect();
    var narrow = W < 700;
    line.len = narrow ? 28 : 44;
    var span = Math.min(W - 32, Math.max(260, t.width * (narrow ? 0.96 : 0.86)));
    var below = W < 900;
    line.size = Math.max(11, Math.min(below ? 16 : 22, span / (line.len * 0.6 * 1.14)));
    // narrower screens: the headline wraps, so the line sits behind it, fainter
    line.dim = below ? 0.6 : 1;
    line.cw = line.size * 0.6 * 1.14;
    line.x = (W - line.cw * line.len) / 2;
    line.y = t.top - c.top + t.height * (below ? 0.5 : 0.52);
    if (!title) line.y = H * 0.34;
    var nextSp = spAddress(line.len);
    if (nextSp !== sp) {
      sp = nextSp;
      shown = sp.split("");
      phase = "idle";
      phaseAt = performance.now();
    }
  }

  function resize() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    measure();
    draw(performance.now(), true);
  }

  function begin(next, now) {
    from = shown.join("");
    to = next;
    phase = to === sp ? "fold" : "decode";
    phaseAt = now;
    resolveAt = [];
    for (var i = 0; i < line.len; i++) {
      // a left-to-right sweep with some jitter, like a cipher settling
      resolveAt.push(160 + (i / line.len) * (DECODE - 520) + Math.random() * 300);
    }
  }

  function step(now) {
    var t = now - phaseAt;
    if (phase === "idle" && t > IDLE) {
      target = taprootOutput(line.len);
      begin(target, now);
    } else if (phase === "hold" && t > HOLD) {
      begin(sp, now);
    } else if (phase === "decode" || phase === "fold") {
      var done = true;
      for (var i = 0; i < line.len; i++) {
        if (to[i] === "…") {
          shown[i] = "…";
          continue;
        }
        if (t >= resolveAt[i]) shown[i] = to[i];
        else {
          done = false;
          if (t > resolveAt[i] * 0.25) shown[i] = pick(NOISE);
        }
      }
      if (done && t > DECODE) {
        phase = phase === "decode" ? "hold" : "idle";
        phaseAt = now;
      }
    }
  }

  // 0..1: how strongly the idle shimmer wave touches character i
  function wave(i, now) {
    if (phase !== "idle") return 0;
    var t = now - phaseAt - 700;
    var travel = 2600;
    if (t < 0 || t > travel) return 0;
    var head = (t / travel) * (line.len + 10) - 5;
    var d = Math.abs(i - head);
    return d < 4 ? 1 - d / 4 : 0;
  }

  function draw(now, force) {
    var t = now - phaseAt;
    var active = phase === "decode" || phase === "fold" || (phase === "idle" && t > 600 && t < 3500);
    if (!active && !force && !line.dirty) return;
    line.dirty = active;

    var top = line.y - line.size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (force) ctx.clearRect(0, 0, W, H);
    else ctx.clearRect(0, top - 4, W, line.size * 2 + 8);
    ctx.font = "400 " + line.size.toFixed(1) + "px " + FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    var output = phase === "hold" || phase === "decode";
    for (var i = 0; i < line.len; i++) {
      var ch = shown[i];
      if (!ch) continue;
      var x = line.x + i * line.cw + line.cw / 2;
      var w = wave(i, now);
      var settling = (phase === "decode" || phase === "fold") && ch !== to[i];
      var alpha;
      var rgb;
      if (settling) {
        alpha = 0.3;
        rgb = "139,108,255";
      } else if (w > 0) {
        if (Math.random() < w * 0.55) ch = pick(NOISE);
        alpha = 0.13 + w * 0.13;
        rgb = "196,181,253";
      } else {
        alpha = output ? 0.22 : 0.13;
        rgb = output ? "196,181,253" : "220,214,245";
      }
      ctx.fillStyle = "rgba(" + rgb + "," + (alpha * line.dim).toFixed(3) + ")";
      ctx.fillText(ch, x, line.y);
    }
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS - 2) return;
    last = now;
    step(now);
    draw(now, false);
  }

  function sync() {
    var go = !reduce.matches && inView && fade > 0.01 && !document.hidden && W > 0;
    if (go === running) return;
    running = go;
    if (go) {
      last = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  // In the pinned story the address belongs to the hero and leaves with it.
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
    resize();
    canvas.classList.add("is-on");
    onScroll();
    sync();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", sync);
    if (reduce.addEventListener) {
      reduce.addEventListener("change", function () {
        shown = sp.split("");
        phase = "idle";
        draw(performance.now(), true);
        sync();
      });
    }

    var timer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(timer);
      timer = setTimeout(resize, 160);
    });
    // the headline settles after the intro and once the story is laid out
    var settle = function () {
      measure();
      draw(performance.now(), true);
    };
    setTimeout(settle, 1800);
    window.addEventListener("load", function () { setTimeout(settle, 300); });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      }).observe(canvas.parentElement);
    }
  }

  var ready = document.fonts && document.fonts.load ? document.fonts.load("14px " + FONT) : Promise.resolve();
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 1200); })]).then(start, start);
})();
