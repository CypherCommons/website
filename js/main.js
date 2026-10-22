(function () {
  "use strict";

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Accordions (roadmap + FAQ) ---------- */
  document.querySelectorAll("[data-accordion] .acc__btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var item = btn.closest(".acc__item");
      var open = item.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ---------- Copy donate address ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    var original = btn.textContent;
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || "";
      var done = function () {
        btn.textContent = "COPIED";
        setTimeout(function () { btn.textContent = original; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        done();
      }
    });
  });

  /* ---------- Disabled links (stores not live yet) ---------- */
  document.querySelectorAll("[data-noop]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
    });
  });

  /* ---------- Motion helpers ---------- */
  var mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var mqDesktop = window.matchMedia("(min-width: 881px)");
  var mqTall = window.matchMedia("(min-height: 700px)");
  function motionOK() { return !mqReduce.matches; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function onMqChange(mq, fn) {
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  /* ---------- Reveal on scroll (+ stagger groups) ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && motionOK()) {
    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i * 70, 350) + "ms";
      });
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var el = entry.target;
            el.classList.add("is-in");
            if (el.style.transitionDelay) {
              /* drop the stagger delay once revealed so it can't slow later transitions */
              setTimeout(function () { el.style.transitionDelay = ""; }, 1200);
            }
            io.unobserve(el);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Shared rAF scroll loop ---------- */
  var scrubFns = [];
  var scrubQueued = false;
  var scrubListening = false;
  function runScrubs() {
    scrubQueued = false;
    var y = window.scrollY || window.pageYOffset || 0;
    for (var i = 0; i < scrubFns.length; i++) scrubFns[i](y);
  }
  function queueScrub() {
    if (!scrubQueued) {
      scrubQueued = true;
      requestAnimationFrame(runScrubs);
    }
  }
  function addScrub(fn) {
    if (scrubFns.indexOf(fn) === -1) scrubFns.push(fn);
    if (!scrubListening) {
      scrubListening = true;
      window.addEventListener("scroll", queueScrub, { passive: true });
      window.addEventListener("resize", queueScrub, { passive: true });
    }
    queueScrub();
  }
  function removeScrub(fn) {
    var i = scrubFns.indexOf(fn);
    if (i !== -1) scrubFns.splice(i, 1);
  }

  /* ---------- Ambient loops: run only while visible ---------- */
  var loopRecs = [];
  var loopIO = "IntersectionObserver" in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          loopRecs.forEach(function (rec) {
            if (rec.el === entry.target) {
              rec.inView = entry.isIntersecting;
              syncLoop(rec);
            }
          });
        });
      }, { threshold: 0.15 })
    : null;
  function syncLoop(rec) {
    var shouldRun = rec.enabled && rec.inView && !document.hidden;
    if (shouldRun && !rec.running) {
      rec.running = true;
      rec.start();
    } else if (!shouldRun && rec.running) {
      rec.running = false;
      rec.stop();
    }
  }
  document.addEventListener("visibilitychange", function () {
    loopRecs.forEach(syncLoop);
  });
  function makeLoop(el, start, stop) {
    var rec = { el: el, start: start, stop: stop, enabled: false, inView: false, running: false };
    loopRecs.push(rec);
    return {
      enable: function () {
        if (rec.enabled) return;
        rec.enabled = true;
        if (loopIO) loopIO.observe(el);
        else rec.inView = true;
        syncLoop(rec);
      },
      disable: function () {
        if (!rec.enabled) return;
        rec.enabled = false;
        if (loopIO) loopIO.unobserve(el);
        rec.inView = false;
        syncLoop(rec);
      }
    };
  }

  /* ---------- Showcase: scroll-linked disperse ---------- */
  function initHeroDisperse() {
    var stage = document.querySelector(".showcase__stage");
    var phone = document.querySelector(".showcase .phone");
    var cards = document.querySelectorAll(".hero-card");
    if (!stage || !phone || cards.length !== 4) return null;
    /* out-vectors mirror each card's entrance side */
    var OUT = [[-260, -50], [260, -60], [-290, 60], [280, 80]];
    var last = -1;
    var active = false;
    function update() {
      if (!active) return;
      var rect = stage.getBoundingClientRect();
      if (rect.bottom < -80 && last === 1) return; /* long past the showcase — idle */
      /* converged while the stage sits in view; disperses only as it exits the top */
      var p = clamp((60 - rect.top) / Math.max(240, window.innerHeight * 0.7), 0, 1);
      if (p === last) return;
      last = p;
      var fade = (1 - 0.85 * p * p).toFixed(3);
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.setProperty("--dx", OUT[i][0] * p + "px");
        cards[i].style.setProperty("--dy", OUT[i][1] * p + "px");
        cards[i].style.opacity = p === 0 ? "" : fade;
      }
      phone.style.setProperty("--py", (48 * p).toFixed(1) + "px");
    }
    return {
      enable: function () {
        if (active) return;
        active = true;
        last = -1;
        addScrub(update);
      },
      disable: function () {
        if (!active) return;
        active = false;
        removeScrub(update);
        last = -1;
        for (var i = 0; i < cards.length; i++) {
          cards[i].style.removeProperty("--dx");
          cards[i].style.removeProperty("--dy");
          cards[i].style.opacity = "";
        }
        phone.style.removeProperty("--py");
      }
    };
  }

  /* ---------- Diagram: reuse-vs-silent-payments looping sequence ---------- */
  function initDiagram() {
    var diagram = document.querySelector(".diagram");
    if (!diagram) return null;
    var panels = diagram.querySelectorAll(".diagram__panel");
    if (panels.length !== 2) return null;
    var pays = panels[0].querySelectorAll(".d-box--sm");
    var linesL = panels[0].querySelectorAll(".diagram__lines path");
    var addr = panels[0].querySelector(".d-box--addr");
    var sp = panels[1].querySelector(".d-box--sp");
    var linesR = panels[1].querySelectorAll(".diagram__lines path");
    var outs = panels[1].querySelectorAll(".d-box--sm");
    if (pays.length !== 3 || linesL.length !== 3 || !addr || !sp || linesR.length !== 3 || outs.length !== 3) return null;
    var timers = [];
    function on(el, cls) { return function () { el.classList.add(cls || "is-on"); }; }
    function clearStates() {
      diagram.querySelectorAll(".is-on, .is-hot, .is-hot2").forEach(function (el) {
        el.classList.remove("is-on", "is-hot", "is-hot2");
      });
    }
    var TIMELINE = [
      [0, on(pays[0])], [350, on(linesL[0])], [900, on(addr)],
      [1600, on(pays[1])], [1950, on(linesL[1])], [2500, on(addr, "is-hot")],
      [3200, on(pays[2])], [3550, on(linesL[2])], [4100, on(addr, "is-hot2")],
      [5200, on(sp)],
      [5800, on(linesR[0])], [6300, on(outs[0])],
      [7000, on(linesR[1])], [7500, on(outs[1])],
      [8200, on(linesR[2])], [8700, on(outs[2])],
      [11400, clearStates],
      [12600, runCycle]
    ];
    function runCycle() {
      stopCycle();
      TIMELINE.forEach(function (step) {
        timers.push(setTimeout(step[1], step[0]));
      });
    }
    function stopCycle() {
      timers.forEach(clearTimeout);
      timers = [];
    }
    var loop = makeLoop(diagram, runCycle, function () {
      stopCycle();
      clearStates();
    });
    return {
      enable: function () {
        diagram.classList.add("diagram--seq");
        loop.enable();
      },
      disable: function () {
        loop.disable();
        diagram.classList.remove("diagram--seq");
        clearStates();
      }
    };
  }

  /* ---------- Bento: on-device scan ticker ---------- */
  function initScanfeed() {
    var visual = document.querySelector(".bento__visual--scan");
    var feed = document.querySelector(".scanfeed");
    var list = document.querySelector(".scanfeed__list");
    if (!visual || !feed || !list) return null;
    var block = 903152;
    var untilFound = 4;
    var timers = [];
    var seeded = false;
    function schedule(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function makeRow(num, label, cls) {
      var row = document.createElement("div");
      row.className = "scanrow" + (cls ? " " + cls : "");
      var a = document.createElement("em");
      a.textContent = "block " + num.toLocaleString("en-US");
      var b = document.createElement("em");
      b.textContent = label;
      row.appendChild(a);
      row.appendChild(b);
      return row;
    }
    function seed() {
      seeded = true;
      list.innerHTML = "";
      for (var i = 0; i < 6; i++) {
        list.appendChild(makeRow(block, i === 2 ? "✓ payment found" : "scanned · 0 hits", i === 2 ? "scanrow--active" : ""));
        block++;
      }
    }
    function resetShift() {
      list.style.transition = "none";
      list.style.transform = "";
      void list.offsetHeight;
      list.style.transition = "";
    }
    function tick() {
      var row = makeRow(block, "scanning…", "");
      block++;
      list.appendChild(row);
      var delta = list.children[1].offsetTop - list.children[0].offsetTop;
      requestAnimationFrame(function () {
        list.style.transition = "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)";
        list.style.transform = "translateY(" + -delta + "px)";
      });
      schedule(function () {
        if (list.children.length > 6) list.removeChild(list.children[0]);
        resetShift();
      }, 500);
      schedule(function () {
        untilFound--;
        if (untilFound <= 0) {
          row.className = "scanrow scanrow--active";
          row.children[1].textContent = "✓ payment found";
          untilFound = 5 + Math.floor(Math.random() * 4);
        } else {
          row.children[1].textContent = "scanned · 0 hits";
        }
      }, 750);
      schedule(tick, 1500);
    }
    var loop = makeLoop(visual, function () {
      if (!seeded) seed();
      schedule(tick, 400);
    }, function () {
      timers.forEach(clearTimeout);
      timers = [];
      resetShift();
    });
    return {
      enable: function () {
        feed.classList.add("scanfeed--live");
        loop.enable();
      },
      disable: function () {
        loop.disable();
        feed.classList.remove("scanfeed--live");
      }
    };
  }

  /* ---------- Bento: contacts rotator ---------- */
  function initContacts() {
    var visual = document.querySelector(".bento__visual--contacts");
    if (!visual) return null;
    var rows = visual.querySelectorAll(".contact");
    if (rows.length < 2) return null;
    var counts = [];
    var current = 0;
    var timer = null;
    rows.forEach(function (row, i) {
      counts[i] = parseInt(row.getAttribute("data-count"), 10) || 0;
      if (row.classList.contains("contact--active")) current = i;
    });
    function rotate() {
      var prevPill = rows[current].querySelector(".contact__pill");
      counts[current]++;
      rows[current].classList.remove("contact--active");
      prevPill.classList.remove("contact__pill--bright");
      prevPill.textContent = counts[current] + " payments";
      var next;
      do { next = Math.floor(Math.random() * rows.length); } while (next === current);
      current = next;
      var pill = rows[current].querySelector(".contact__pill");
      rows[current].classList.add("contact--active");
      pill.classList.add("contact__pill--bright");
      pill.textContent = "✓ paid just now";
      timer = setTimeout(rotate, 3600);
    }
    var loop = makeLoop(visual, function () {
      timer = setTimeout(rotate, 1800);
    }, function () {
      clearTimeout(timer);
    });
    return { enable: loop.enable, disable: loop.disable };
  }

  /* ---------- Bento: payment split merge/divide loop ---------- */
  function initSplit() {
    var visual = document.querySelector(".bento__visual--split");
    var split = document.querySelector(".split");
    if (!visual || !split) return null;
    var timer = null;
    var merged = false;
    function setState() {
      split.classList.toggle("split--merged", merged);
      split.classList.toggle("split--apart", !merged);
      timer = setTimeout(function () {
        merged = !merged;
        setState();
      }, merged ? 2400 : 3400);
    }
    var loop = makeLoop(visual, function () {
      merged = true; /* each pass retells the story: one payment, then it divides */
      setState();
    }, function () {
      clearTimeout(timer);
    });
    return {
      enable: loop.enable,
      disable: function () {
        loop.disable();
        split.classList.remove("split--merged", "split--apart");
      }
    };
  }

  /* ---------- How it works: pinned-canvas scrollytelling ---------- */
  function initHowPinned() {
    var section = document.querySelector(".how");
    var track = document.querySelector(".how__track");
    var stage = document.querySelector(".how__stage");
    if (!section || !track || !stage) return null;
    var steps = stage.querySelectorAll(".step");
    if (steps.length !== 4) return null;
    var visuals = [];
    var texts = [];
    for (var i = 0; i < 4; i++) {
      visuals.push(steps[i].querySelector(".step__visual"));
      texts.push(steps[i].querySelector(".step__text"));
      if (!visuals[i] || !texts[i]) return null;
    }
    /* Discrete states: scroll position only SELECTS state 0-3 (or -1 = approaching, all
       parked); the CSS transitions on .step__visual/.step__text animate to it, so a stopped
       scroll always rests in a fully-settled composition — states snap, never freeze mid-move. */
    var SEG = [0, 0.26, 0.5, 0.74]; /* p thresholds where states 1-4 take over */
    /* fan biases left so the front card sits clean inside the stage clip edge */
    var FAN = [
      { x: -66, y: 20, r: -3, s: 0.955 },
      { x: -44, y: 7, r: -2, s: 0.97 },
      { x: -22, y: -6, r: -1, s: 0.985 },
      { x: 0, y: -19, r: 0, s: 1 }
    ];
    var seg = -2;
    var appliedH = 0;
    var active = false;
    function apply(k) {
      seg = k;
      appliedH = stage.offsetHeight;
      var focus = Math.max(k, 0);
      for (var i = 0; i < 4; i++) {
        if (i <= k) {
          visuals[i].style.transform =
            "translate(" + FAN[i].x + "px, " + FAN[i].y + "px) rotate(" + FAN[i].r + "deg) scale(" + FAN[i].s + ")";
          visuals[i].style.opacity = (1 - 0.08 * (k - i)).toFixed(2);
        } else {
          /* parked below the stage (clipped), ready to rise in */
          visuals[i].style.transform = "translate(40px, " + appliedH + "px) rotate(4deg) scale(1.04)";
          visuals[i].style.opacity = "1";
        }
        texts[i].style.opacity = i === focus ? "1" : "0";
        texts[i].style.transform = "translateY(" + (i === focus ? 0 : i < focus ? -14 : 14) + "px)";
      }
    }
    function update() {
      if (!active) return;
      var rect = track.getBoundingClientRect();
      var vh = window.innerHeight;
      if (rect.bottom < -40 || rect.top > vh + 40) return;
      var k;
      if (rect.top > vh * 0.55) {
        k = -1; /* section still approaching — card 1 rises in as it arrives */
      } else {
        var total = Math.max(1, rect.height - stage.offsetHeight);
        var p = clamp(-rect.top / total, 0, 1);
        k = 0;
        for (var i = 1; i < 4; i++) {
          if (p >= SEG[i]) k = i;
        }
      }
      if (k !== seg || Math.abs(stage.offsetHeight - appliedH) > 1) apply(k);
    }
    return {
      enable: function () {
        if (active) return;
        active = true;
        seg = -2;
        section.classList.add("how--pinned");
        addScrub(update);
      },
      disable: function () {
        if (!active) return;
        active = false;
        removeScrub(update);
        section.classList.remove("how--pinned");
        seg = -2;
        for (var i = 0; i < 4; i++) {
          visuals[i].style.transform = "";
          visuals[i].style.opacity = "";
          texts[i].style.opacity = "";
          texts[i].style.transform = "";
        }
      }
    };
  }

  /* ---------- Feature gating ---------- */
  var features = [
    { mod: initDiagram(), when: function () { return motionOK(); } },
    { mod: initScanfeed(), when: function () { return motionOK(); } },
    { mod: initContacts(), when: function () { return motionOK(); } },
    { mod: initSplit(), when: function () { return motionOK(); } },
    { mod: initHeroDisperse(), when: function () { return motionOK() && mqDesktop.matches; } },
    { mod: initHowPinned(), when: function () { return motionOK() && mqDesktop.matches && mqTall.matches; } }
  ];
  function syncFeatures() {
    features.forEach(function (f) {
      if (!f.mod) return;
      if (f.when()) f.mod.enable();
      else f.mod.disable();
    });
  }
  onMqChange(mqReduce, syncFeatures);
  onMqChange(mqDesktop, syncFeatures);
  onMqChange(mqTall, syncFeatures);
  syncFeatures();
})();
