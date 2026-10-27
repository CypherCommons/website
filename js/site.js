import { STORY_LENGTH, CHAPTERS, HERO_EXIT, SWAP } from "./timeline.js";

const root = document.documentElement;
const { gsap, ScrollTrigger, Lenis } = window;
const motion = root.classList.contains("motion");

const story = document.querySelector("[data-story]");
const stage = document.querySelector("[data-stage]");

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) {
    return false;
  }
}

const useStage = motion && !!gsap && !!ScrollTrigger && !!story && webglAvailable() && window.matchMedia("(min-height: 500px)").matches;
if (useStage) root.classList.add("has-stage");

/* ============================================================
   Line splitting for masked text reveals
   ============================================================ */
const splits = new Map();

function splitLines(el) {
  if (splits.has(el)) return splits.get(el).lines;
  const html = el.innerHTML;
  const words = [];
  const walk = (node, cls) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === 3) {
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) words.push(" ");
          else words.push({ text: part, cls });
        });
      } else if (child.nodeType === 1) {
        walk(child, [cls, child.className].filter(Boolean).join(" "));
      }
    });
  };
  walk(el, "");
  el.innerHTML = "";
  const spans = [];
  words.forEach((w) => {
    if (w === " ") {
      el.appendChild(document.createTextNode(" "));
      return;
    }
    const s = document.createElement("span");
    s.textContent = w.text;
    s.style.display = "inline-block";
    if (w.cls) s.className = w.cls;
    el.appendChild(s);
    spans.push(s);
  });
  const rows = [];
  let top = null;
  spans.forEach((s) => {
    const y = s.offsetTop;
    if (top === null || Math.abs(y - top) > 4) {
      rows.push([]);
      top = y;
    }
    rows[rows.length - 1].push(s);
  });
  el.innerHTML = "";
  const lines = rows.map((row) => {
    const line = document.createElement("span");
    line.className = "line";
    const inner = document.createElement("span");
    inner.className = "line__inner";
    row.forEach((s, i) => {
      s.style.display = "";
      inner.appendChild(s);
      if (i < row.length - 1) inner.appendChild(document.createTextNode(" "));
    });
    line.appendChild(inner);
    el.appendChild(line);
    return inner;
  });
  splits.set(el, { html, lines });
  return lines;
}

function unsplit(el) {
  const s = splits.get(el);
  if (!s) return;
  el.innerHTML = s.html;
  splits.delete(el);
}

/* ============================================================
   Smooth scrolling
   ============================================================ */
let lenis = null;
if (gsap && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  if (motion && Lenis) {
    lenis = new Lenis({ lerp: 0.095, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* ============================================================
   Story (pinned hero + chapters)
   ============================================================ */
const progress = { t: 0 };
let storyTrigger = null;
let storyTimeline = null;

function chapterParts(chapter) {
  return {
    copy: chapter.querySelectorAll(".chapter__lead, .chapter__aside"),
    eyebrow: chapter.querySelector(".eyebrow"),
    title: chapter.querySelector(".chapter__title"),
    rest: chapter.querySelectorAll(".chapter__body, .chip"),
  };
}

// Portrait: the phone takes whatever room the tallest chapter leaves below it.
function fitPhone() {
  const narrow = window.matchMedia("(max-width: 899px), (max-aspect-ratio: 6/5)").matches;
  stage.style.removeProperty("--phone-top");
  stage.style.removeProperty("--phone-h");
  if (!narrow) return;
  let bottom = 0;
  story.querySelectorAll("[data-chapter]").forEach((c) => {
    const aside = c.querySelector(".chapter__aside");
    if (aside) bottom = Math.max(bottom, aside.offsetTop + aside.offsetHeight);
  });
  const h = stage.offsetHeight;
  const top = bottom + Math.max(28, h * 0.04);
  const ph = Math.max(200, Math.min(h - top - h * 0.12, h * 0.5));
  stage.style.setProperty("--phone-top", `${Math.round(top)}px`);
  stage.style.setProperty("--phone-h", `${Math.round(ph)}px`);
}

function buildStory() {
  fitPhone();
  const chapters = Array.from(story.querySelectorAll("[data-chapter]"));
  const heroCopy = story.querySelector(".hero__copy");
  const progressEl = story.querySelector(".chapters__progress");
  const indexEl = story.querySelector("[data-chapter-index]");
  const fillEl = story.querySelector("[data-chapter-fill]");

  const tl = gsap.timeline({ defaults: { ease: "none" } });
  tl.to(progress, { t: STORY_LENGTH, duration: STORY_LENGTH }, 0);

  // One chapter hands over to the next as a clean crossfade: the outgoing
  // copy dissolves upward and is gone before the incoming copy settles in,
  // so two headings never share the screen.
  const handOff = ([outLead, outAside], [inLead, inAside], at) => {
    const w = SWAP;
    const once = { immediateRender: false };
    const out = [outLead, outAside].filter(Boolean);
    const inc = [inLead, inAside].filter(Boolean);
    tl.fromTo(out, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, { autoAlpha: 0, y: -18, filter: "blur(6px)", duration: w * 0.42, ease: "power2.in", stagger: w * 0.04, ...once }, at);
    tl.fromTo(inc, { autoAlpha: 0, y: 18, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: w * 0.46, ease: "power2.out", stagger: w * 0.06, ...once }, at + w * 0.48);
  };

  // The hero leaves the same way: headline out first, then chapter 1 in.
  const push = (outEl, [inLead, inAside], at) => {
    const w = SWAP;
    const once = { immediateRender: false };
    tl.fromTo(outEl, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, { autoAlpha: 0, y: -28, filter: "blur(6px)", duration: w * 0.45, ease: "power2.in", ...once }, at);
    tl.fromTo([inLead, inAside].filter(Boolean), { autoAlpha: 0, y: 18, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: w * 0.46, ease: "power2.out", stagger: w * 0.06, ...once }, at + w * 0.5);
  };

  const heroTitle = heroCopy.querySelector(".hero__title");
  const heroItems = Array.from(heroCopy.querySelectorAll("[data-hero-item]"));
  tl.fromTo(heroItems, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30, duration: CHAPTERS[0].enter - HERO_EXIT, ease: "power1.in" }, HERO_EXIT);

  const blocks = chapters.map((chapter) => Array.from(chapter.querySelectorAll(".chapter__lead, .chapter__aside")));
  chapters.forEach((chapter, i) => {
    const { enter, exit } = CHAPTERS[i];
    unsplit(chapter.querySelector(".chapter__title"));
    tl.set(chapter, { autoAlpha: 1 }, enter);
    gsap.set(blocks[i], { autoAlpha: 0 });
    if (exit !== null) tl.set(chapter, { autoAlpha: 0 }, exit + SWAP);
  });
  push(heroTitle, blocks[0], CHAPTERS[0].enter);
  chapters.forEach((_, i) => {
    if (CHAPTERS[i].exit !== null) handOff(blocks[i], blocks[i + 1], CHAPTERS[i].exit);
  });

  if (progressEl) tl.fromTo(progressEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15 }, CHAPTERS[0].enter);

  storyTimeline = tl;
  storyTrigger = ScrollTrigger.create({
    trigger: story,
    start: "top top",
    end: () => "+=" + Math.round(window.innerHeight * STORY_LENGTH * 0.9),
    pin: stage,
    pinSpacing: true,
    refreshPriority: 10,
    scrub: true,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: () => {
      let active = -1;
      CHAPTERS.forEach((c, i) => {
        if (progress.t >= c.enter - 0.05 && (c.exit === null || progress.t < c.exit + 0.1)) active = i;
      });
      chapters.forEach((c, i) => c.classList.toggle("is-active", i === active));
      const ch = CHAPTERS[active];
      const span = ch ? (ch.exit === null ? STORY_LENGTH - 0.3 : ch.exit) - ch.enter : 1;
      const within = ch ? Math.min(1, Math.max(0, (progress.t - ch.enter) / span)) : 0;
      document.dispatchEvent(new CustomEvent("story:chapter", { detail: { index: active, progress: within } }));
      if (indexEl && active >= 0) indexEl.textContent = String(active + 1).padStart(2, "0");
      if (fillEl) {
        const f = (progress.t - CHAPTERS[0].enter) / (STORY_LENGTH - 0.3 - CHAPTERS[0].enter);
        fillEl.style.transform = `scaleX(${Math.min(1, Math.max(0, f))})`;
      }
    },
  });
}

function rebuildStory() {
  const p = storyTrigger ? storyTrigger.progress : 0;
  if (storyTrigger) storyTrigger.kill(true);
  if (storyTimeline) storyTimeline.kill();
  gsap.set(story.querySelectorAll("[data-chapter], .chapter__lead, .chapter__aside, .chapters__progress, .hero__title, [data-hero-item]"), { clearProps: "all" });
  buildStory();
  ScrollTrigger.refresh();
  if (p > 0 && storyTrigger) window.scrollTo(0, storyTrigger.start + p * (storyTrigger.end - storyTrigger.start));
}

/* ============================================================
   3D stage, created after first paint
   ============================================================ */
let stageApi = null;

function initStage() {
  const container = story.querySelector("[data-gl]");
  const frames = {
    hero: story.querySelector('[data-frame="hero"]'),
    chapter: story.querySelector('[data-frame="chapter"]'),
  };
  const labelLayer = story.querySelector("[data-labels]");
  const avoid = Array.from(story.querySelectorAll(".chapter__lead > *, .chapter__aside > *, .chapters__progress"));
  const dlEl = document.querySelector("[data-gl-download]");
  const mobile = window.matchMedia("(max-width: 899px), (max-aspect-ratio: 6/5)").matches;
  import("./stage/stage.js")
    .then(({ createStage }) =>
      createStage({
        story: { container, stage, frames, avoid, labelLayer, getProgress: () => progress.t },
        download: dlEl ? { container: dlEl } : null,
        mobile,
      })
    )
    .then((api) => {
      stageApi = api;
      window.__shroudStage = api;
      root.classList.add("is-3d");
      if (dlEl) root.classList.add("has-dl3d");
      api.start();
      container.addEventListener("stage:lost", dropStage, { once: true });
    })
    .catch(dropStage);
}

// Without WebGL the story falls back to static sections with the poster image.
function dropStage() {
  if (stageApi) {
    stageApi.destroy();
    stageApi = null;
  }
  root.classList.remove("is-3d", "has-stage", "has-dl3d");
  if (storyTrigger) storyTrigger.kill(true);
  if (storyTimeline) storyTimeline.kill();
  storyTrigger = null;
  storyTimeline = null;
  story.querySelectorAll("[data-chapter]").forEach((c) => {
    const title = c.querySelector(".chapter__title");
    if (title) unsplit(title);
  });
  gsap.set(story.querySelectorAll(".hero__copy, .hero__title, [data-hero-item], [data-chapter], .chapter__lead, .chapter__aside, .chapter__lead > *, .chapter__aside > *, .chapters__progress"), { clearProps: "all" });
  ScrollTrigger.refresh();
}

function whenIdle(fn) {
  const go = () => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}

window.addEventListener("pagehide", (e) => {
  if (!e.persisted && stageApi) {
    stageApi.destroy();
    stageApi = null;
  }
});

/* ============================================================
   Intro
   ============================================================ */
function intro() {
  const lines = story.querySelectorAll("[data-hero-line] .line__inner");
  const items = story.querySelectorAll("[data-hero-item]");
  const poster = story.querySelector("[data-poster] .poster__device");
  root.classList.remove("intro");
  const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.from(lines, { yPercent: 115, duration: 1.4, stagger: 0.12 }, 0.15)
    .from(items, { autoAlpha: 0, y: 22, duration: 1.2, stagger: 0.08 }, 0.4);
  if (poster) tl.from(poster, { autoAlpha: 0, y: 60, duration: 1.6 }, 0.3);
}

/* ============================================================
   Section reveals
   ============================================================ */
function reveals() {
  document.querySelectorAll(".section__head").forEach((head) => {
    const title = head.querySelector("[data-lines]");
    const others = Array.from(head.children).filter((c) => c !== title);
    const lines = title ? splitLines(title) : [];
    const tl = gsap.timeline({
      scrollTrigger: { trigger: head, start: "top 85%", once: true },
      onComplete: () => title && unsplit(title),
    });
    if (lines.length) tl.from(lines, { yPercent: 110, duration: 1.2, stagger: 0.08, ease: "expo.out" }, 0.08);
    tl.from(others, { autoAlpha: 0, y: 18, duration: 1, stagger: 0.08, ease: "expo.out" }, 0);
  });

  document.querySelectorAll("[data-reveal]:not(.section__head)").forEach((el) => {
    gsap.from(el, {
      autoAlpha: 0,
      y: 48,
      duration: 1.3,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  document.querySelectorAll("[data-stagger]").forEach((group) => {
    gsap.from(group.children, {
      autoAlpha: 0,
      y: 36,
      duration: 1.2,
      stagger: 0.07,
      ease: "expo.out",
      scrollTrigger: { trigger: group, start: "top 88%", once: true },
    });
  });

  const finale = document.querySelector(".finale__link");
  if (finale) {
    gsap.from(finale, { autoAlpha: 0, y: 80, duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: ".finale", start: "top 80%", once: true } });
    gsap.fromTo(".finale__mark", { rotate: -8, scale: 0.9 }, {
      rotate: 8,
      scale: 1.05,
      ease: "none",
      scrollTrigger: { trigger: ".finale", start: "top bottom", end: "bottom top", scrub: true },
    });
  }
}

/* ============================================================
   Micro-interactions
   ============================================================ */
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

// Magnetic pull, on the independent `translate` property so it composes
// with any hover transform the element already has.
function magnets() {
  const items = [];
  let raf = 0;
  const tick = () => {
    raf = 0;
    let moving = false;
    items.forEach((m) => {
      m.x += (m.tx - m.x) * 0.2;
      m.y += (m.ty - m.y) * 0.2;
      if (Math.abs(m.tx - m.x) < 0.05 && Math.abs(m.ty - m.y) < 0.05) {
        m.x = m.tx;
        m.y = m.ty;
      } else moving = true;
      m.el.style.translate = m.x || m.y ? `${m.x.toFixed(2)}px ${m.y.toFixed(2)}px` : "";
    });
    if (moving) raf = requestAnimationFrame(tick);
  };
  const kick = () => raf || (raf = requestAnimationFrame(tick));
  const add = (trigger, el, strength, max) => {
    if (!trigger || !el) return;
    const m = { el, x: 0, y: 0, tx: 0, ty: 0 };
    items.push(m);
    let rect = null;
    const clamp = (v) => Math.max(-max, Math.min(max, v));
    trigger.addEventListener("pointerenter", () => (rect = el.getBoundingClientRect()));
    trigger.addEventListener("pointermove", (e) => {
      if (!rect) rect = el.getBoundingClientRect();
      m.tx = clamp((e.clientX - (rect.left + rect.width / 2)) * strength);
      m.ty = clamp((e.clientY - (rect.top + rect.height / 2)) * strength);
      kick();
    });
    trigger.addEventListener("pointerleave", () => {
      rect = null;
      m.tx = 0;
      m.ty = 0;
      kick();
    });
  };
  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const big = el.classList.contains("finale__link");
    add(el, el, big ? 0.12 : 0.28, big ? 28 : 12);
  });
  document.querySelectorAll(".dl-row").forEach((row) => add(row, row.querySelector(".dl-row__arrow"), 0.14, 7));
  document.querySelectorAll(".acc__btn").forEach((btn) => add(btn, btn.querySelector(".acc__icon"), 0.1, 5));
}

function interactions() {
  if (!finePointer.matches) return;
  magnets();

  document.querySelectorAll("[data-tilt]").forEach((el) => {
    gsap.set(el, { transformPerspective: 1200 });
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.8, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.8, ease: "power3.out" });
    let rect = null;
    el.addEventListener("pointerenter", () => (rect = el.getBoundingClientRect()));
    el.addEventListener("pointermove", (e) => {
      if (!rect) rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      rx(-py * 3);
      ry(px * 4);
    });
    el.addEventListener("pointerleave", () => {
      rect = null;
      rx(0);
      ry(0);
    });
  });
}

/* ============================================================
   Footer wordmark: rises out of the page edge, lit by the pointer
   ============================================================ */
function wordmark() {
  const mark = document.querySelector("[data-wordmark]");
  if (!mark) return;
  const inner = mark.querySelector(".wordmark__inner");
  const fills = Array.from(mark.querySelectorAll(".wordmark__fill"));
  watch(mark, () => mark.classList.add("is-in"), () => mark.classList.remove("is-in"), 0.1);

  if (motion && gsap && ScrollTrigger) {
    inner.style.setProperty("--r", "0");
    ScrollTrigger.create({
      trigger: mark,
      start: "top bottom",
      end: "bottom bottom",
      onUpdate: (self) => inner.style.setProperty("--r", self.progress.toFixed(4)),
      onRefresh: (self) => inner.style.setProperty("--r", self.progress.toFixed(4)),
    });
  }

  if (!finePointer.matches) return;
  const footer = mark.closest("footer") || mark;
  let level = 0;
  let target = 0;
  let px = 0;
  let py = 0;
  let raf = 0;
  const paint = () => {
    raf = 0;
    level += (target - level) * 0.12;
    fills.forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${(px - r.left).toFixed(1)}px`);
      el.style.setProperty("--gy", `${(py - r.top).toFixed(1)}px`);
      el.style.setProperty("--ga", level.toFixed(3));
    });
    if (Math.abs(target - level) > 0.004) raf = requestAnimationFrame(paint);
  };
  const kick = () => raf || (raf = requestAnimationFrame(paint));
  footer.addEventListener("pointermove", (e) => {
    px = e.clientX;
    py = e.clientY;
    const r = inner.getBoundingClientRect();
    const dy = Math.max(0, r.top - py, py - r.bottom);
    target = Math.max(0, 1 - dy / 260);
    kick();
  });
  footer.addEventListener("pointerleave", () => {
    target = 0;
    kick();
  });
}

/* ============================================================
   Anchor links through Lenis (and into the pinned story)
   ============================================================ */
function anchors() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-noop")) return;
    const id = a.getAttribute("href");
    if (id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    let y;
    if (storyTrigger && story.contains(target)) {
      const chapter = target.closest("[data-chapter]");
      const i = chapter ? Array.from(story.querySelectorAll("[data-chapter]")).indexOf(chapter) : -1;
      const t = i >= 0 ? CHAPTERS[i].enter + 0.35 : 0;
      y = storyTrigger.start + (t / STORY_LENGTH) * (storyTrigger.end - storyTrigger.start);
    } else {
      y = target.getBoundingClientRect().top + window.scrollY - (id === "#top" ? 0 : 20);
    }
    if (id === "#top") y = 0;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: motion ? "smooth" : "auto" });
    history.replaceState(null, "", id);
  });
}

/* ============================================================
   How it works: a vertical timeline, the rail fills as you read
   ============================================================ */
function howItWorks() {
  const list = document.querySelector("[data-steps]");
  if (!list) return;
  const rail = list.querySelector(".steps__rail");
  const steps = Array.from(list.querySelectorAll("[data-step]"));
  if (!motion || !gsap || !ScrollTrigger) {
    steps.forEach((s) => s.classList.add("is-reached"));
    return;
  }
  rail.style.setProperty("--fill", "0");
  ScrollTrigger.create({
    trigger: list,
    start: "top 62%",
    end: "bottom 62%",
    onUpdate: (self) => rail.style.setProperty("--fill", self.progress.toFixed(4)),
  });
  steps.forEach((step) => {
    ScrollTrigger.create({
      trigger: step.querySelector(".step__node"),
      start: "center 62%",
      onEnter: () => step.classList.add("is-reached"),
      onLeaveBack: () => step.classList.remove("is-reached"),
    });
    gsap.from(step.querySelector(".step__text"), {
      autoAlpha: 0,
      y: 36,
      duration: 1.2,
      ease: "expo.out",
      scrollTrigger: { trigger: step, start: "top 82%", once: true },
    });
    gsap.from(step.querySelector(".step__visual"), {
      autoAlpha: 0,
      y: 48,
      scale: 0.97,
      duration: 1.4,
      ease: "expo.out",
      scrollTrigger: { trigger: step, start: "top 82%", once: true },
    });
  });
}

/* ============================================================
   In-view helpers: one-shot entrances and loops that only run on screen
   ============================================================ */
function watch(el, onIn, onOut, threshold = 0.3) {
  if (!("IntersectionObserver" in window)) return onIn();
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (e.isIntersecting ? onIn() : onOut && onOut())),
    { threshold }
  );
  io.observe(el);
}

function illustrations() {
  document.querySelectorAll('[data-anim="once"], [data-anim="compare"]').forEach((el) => {
    if (!motion) return el.classList.add("is-played");
    watch(el, () => el.classList.add("is-played"), null, 0.35);
    if (el.matches('[data-anim="compare"]')) {
      el.querySelectorAll("li, tbody tr").forEach((row, i) => {
        row.style.transitionDelay = `${0.12 + i * 0.07}s`;
        const mark = row.querySelector("td.ctable__shroud .icon");
        if (mark) mark.style.transitionDelay = `${0.3 + i * 0.07}s`;
      });
    }
  });
  document.querySelectorAll('[data-anim="loop"]').forEach((el) => {
    if (!motion) return el.classList.add("is-played");
    watch(
      el,
      () => el.classList.add("is-running", "is-played"),
      () => el.classList.remove("is-running"),
      0.2
    );
  });
  const finale = document.querySelector(".finale");
  if (finale) watch(finale, () => finale.classList.add("is-in"), () => finale.classList.remove("is-in"), 0.1);
}

/* A small scheduler: timers that pause with the card. */
function loop(el, run) {
  let timers = [];
  let on = false;
  const at = (ms, fn) => timers.push(setTimeout(() => on && fn(), ms));
  const start = () => {
    if (on) return;
    on = true;
    el.classList.add("is-running");
    run(at);
  };
  const stop = () => {
    on = false;
    el.classList.remove("is-running");
    timers.forEach(clearTimeout);
    timers = [];
  };
  let inview = false;
  watch(
    el,
    () => {
      inview = true;
      if (!document.hidden) start();
    },
    () => {
      inview = false;
      stop();
    },
    0.25
  );
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : inview && start()));
  return { again: () => on && run(at) };
}

function features() {
  if (!motion) return;

  /* Fast on-device scanning: blocks checked row by row */
  const scan = document.querySelector('[data-anim="scan"]');
  if (scan) {
    const rows = Array.from(scan.querySelectorAll("[data-row]"));
    const sweep = scan.querySelector(".scanfeed__sweep");
    const patterns = [[1, 4], [2, 5], [0, 3]];
    let base = 903146;
    let cycle = 0;
    const l = loop(scan, (at) => {
      const hits = patterns[cycle % patterns.length];
      rows.forEach((row, i) => {
        row.classList.remove("is-done", "is-hit", "is-scanning", "is-out");
        row.querySelector("[data-blk]").textContent = (base + i).toLocaleString("en-US");
        const pucks = row.querySelectorAll(".pucks i");
        pucks.forEach((p) => p.classList.remove("own"));
        if (hits.includes(i)) pucks[(i * 3 + cycle) % 4].classList.add("own");
      });
      sweep.style.setProperty("--row", "0");
      const STEP = 640;
      rows.forEach((row, i) => {
        at(300 + i * STEP, () => {
          sweep.style.setProperty("--row", String(i));
          row.classList.add("is-scanning");
        });
        at(300 + i * STEP + 460, () => {
          row.classList.remove("is-scanning");
          row.classList.add(hits.includes(i) ? "is-hit" : "is-done");
        });
      });
      const end = 300 + rows.length * STEP;
      at(end, () => scan.classList.add("is-holding"));
      at(end + 2800, () => rows.forEach((row, i) => setTimeout(() => row.classList.add("is-out"), i * 50)));
      at(end + 3600, () => {
        scan.classList.remove("is-holding");
        base += rows.length;
        cycle++;
        l.again();
      });
    });
  }

  /* Silent payment contacts: same contact, a new output every time */
  const contacts = document.querySelector('[data-anim="contacts"]');
  if (contacts) {
    const payee = contacts.querySelector("[data-payee]");
    const avatar = payee.querySelector(".contact__avatar");
    const paid = contacts.querySelector("[data-paid]");
    const chain = contacts.querySelector("[data-chain]");
    const slots = Array.from(chain.querySelectorAll("i"));
    const tag = contacts.querySelector("[data-tag]");
    const fly = contacts.querySelector("[data-fly]");
    const order = [6, 2, 4, 0, 7, 3, 8, 1, 5];
    const addrs = ["bc1p…48cd", "bc1p…5bf4", "bc1p…dc43"];
    let n = 0;
    const offset = (el) => {
      let x = 0;
      let y = 0;
      let node = el;
      while (node && node !== contacts) {
        x += node.offsetLeft;
        y += node.offsetTop;
        node = node.offsetParent;
      }
      return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 };
    };
    const l = loop(contacts, (at) => {
      const slot = slots[order[n % order.length]];
      at(200, () => payee.classList.add("is-pressed"));
      at(520, () => {
        payee.classList.remove("is-pressed");
        const a = offset(avatar);
        const b = offset(slot);
        const mx = (a.x + b.x) / 2 + 40;
        const my = Math.min(a.y, b.y) - 10;
        if (fly.animate) {
          fly.animate(
            [
              { transform: `translate(${a.x}px, ${a.y}px) scale(0.4)`, opacity: 0 },
              { transform: `translate(${a.x + 8}px, ${a.y}px) scale(1)`, opacity: 1, offset: 0.12 },
              { transform: `translate(${mx}px, ${my + (b.y - my) * 0.35}px) scale(1.1)`, opacity: 1, offset: 0.55 },
              { transform: `translate(${b.x}px, ${b.y}px) scale(0.7)`, opacity: 0.9, offset: 0.94 },
              { transform: `translate(${b.x}px, ${b.y}px) scale(0.3)`, opacity: 0 },
            ],
            { duration: 1100, easing: "cubic-bezier(0.65, 0, 0.35, 1)" }
          );
        }
      });
      at(1560, () => {
        slot.classList.add("is-lit");
        tag.textContent = addrs[n % addrs.length];
        tag.style.setProperty("--tx", `${slot.offsetLeft + slot.offsetWidth / 2}px`);
        tag.classList.add("is-on");
        paid.classList.add("is-on");
      });
      at(3300, () => {
        slot.classList.remove("is-lit");
        tag.classList.remove("is-on");
      });
      at(3700, () => paid.classList.remove("is-on"));
      at(4300, () => {
        n++;
        l.again();
      });
    });
  }

  /* Payment splitting: one bar, then two outputs */
  const split = document.querySelector('[data-anim="split"]');
  if (split) {
    const box = split.querySelector(".split");
    box.dataset.phase = "0";
    const l = loop(split, (at) => {
      box.dataset.phase = "0";
      at(500, () => (box.dataset.phase = "1"));
      at(1600, () => (box.dataset.phase = "2"));
      at(2300, () => (box.dataset.phase = "3"));
      at(3000, () => (box.dataset.phase = "4"));
      at(6200, () => l.again());
    });
  }
}

/* Light that follows the pointer along a card's edge, and inside controls. */
function glow() {
  if (!finePointer.matches) return;
  document.querySelectorAll("[data-glow], .btn, .nav__cta, .acc__btn").forEach((el) => {
    let rect = null;
    el.addEventListener("pointerenter", () => (rect = el.getBoundingClientRect()));
    el.addEventListener("pointermove", (e) => {
      if (!rect) rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    });
    el.addEventListener("pointerleave", () => (rect = null));
  });
}

/* ============================================================
   Marquees: the group repeats until it covers the strip, then the
   whole run is doubled so the loop wraps at exactly half its width
   ============================================================ */
function fillMarquee(strip, speed) {
  const track = strip.querySelector(".marquee__track");
  const group = track.querySelector(".marquee__group");
  track.querySelectorAll("[data-clone]").forEach((n) => n.remove());
  const gw = group.getBoundingClientRect().width;
  if (!gw) return;
  const per = Math.max(1, Math.ceil(strip.clientWidth / gw));
  for (let i = 1; i < per * 2; i++) {
    const copy = group.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    copy.setAttribute("data-clone", "");
    track.appendChild(copy);
  }
  strip.style.setProperty("--dur", `${((gw * per) / speed).toFixed(2)}s`);
  strip.classList.add("is-live");
}

// Strips only animate while on screen.
function idleOffscreen(strip) {
  watch(strip, () => strip.classList.remove("is-off"), () => strip.classList.add("is-off"), 0);
}

// The threat model: one capsule per item, spread over drifting rows.
const THREAT_ROWS = {
  wide: [["y0", "n0", "y1", "n1"], ["n2", "y2", "n3"], ["y3", "n4", "y4"], ["n3", "y1", "n2", "y0"]],
  narrow: [["y0", "n0", "y1", "n1"], ["n2", "y2", "n3", "y3"], ["n4", "y4", "n0", "y2"]],
};
const ROW_SPEED = [26, 32, 24, 30];

function marquees() {
  if (!motion) return;
  const standards = document.querySelector(".standards__marquee");
  const box = document.querySelector("[data-threats]");
  const rowsEl = box && box.querySelector("[data-threat-rows]");
  const yes = box ? Array.from(box.querySelectorAll(".threats__grid .tcap--yes")) : [];
  const no = box ? Array.from(box.querySelectorAll(".threats__grid .tcap--no")) : [];
  const narrow = window.matchMedia("(max-width: 640px)");

  const buildThreats = () => {
    if (!rowsEl || !yes.length) return;
    rowsEl.innerHTML = "";
    box.classList.add("is-live");
    const plan = narrow.matches ? THREAT_ROWS.narrow : THREAT_ROWS.wide;
    plan.forEach((keys, r) => {
      const strip = document.createElement("div");
      strip.className = "marquee" + (r % 2 ? " is-reverse" : "");
      const track = document.createElement("div");
      track.className = "marquee__track";
      const group = document.createElement("ul");
      group.className = "marquee__group";
      keys.forEach((k) => {
        const src = (k[0] === "y" ? yes : no)[Number(k.slice(1))];
        if (src) group.appendChild(src.cloneNode(true));
      });
      track.appendChild(group);
      strip.appendChild(track);
      rowsEl.appendChild(strip);
      fillMarquee(strip, ROW_SPEED[r % ROW_SPEED.length]);
      idleOffscreen(strip);
    });
  };

  if (standards) {
    fillMarquee(standards, 34);
    idleOffscreen(standards);
  }
  buildThreats();

  let lastW = window.innerWidth;
  let timer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastW) < 2) return;
      lastW = window.innerWidth;
      if (standards) fillMarquee(standards, 34);
      buildThreats();
    }, 200);
  });
}

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  marquees();
  howItWorks();
  illustrations();
  features();
  glow();
  if (!gsap || !ScrollTrigger) {
    wordmark();
    return;
  }
  wordmark();
  if (useStage) {
    buildStory();
    whenIdle(initStage);
    let lastW = window.innerWidth;
    let timer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (Math.abs(window.innerWidth - lastW) < 2 || !root.classList.contains("has-stage")) return;
        lastW = window.innerWidth;
        rebuildStory();
        if (stageApi) stageApi.refresh();
      }, 220);
    });
  }
  if (motion) {
    intro();
    reveals();
    interactions();
  }
  anchors();
  ScrollTrigger.refresh();
}

if (document.fonts && document.fonts.status !== "loaded") {
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]).then(boot);
} else {
  boot();
}
