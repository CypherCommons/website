import { STORY_LENGTH, CHAPTERS, HERO_EXIT, SWAP, RISE } from "./timeline.js?v=8f";

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
  const top = bottom + Math.max(24, h * 0.035);
  // the caption gets its own band at the bottom, clear of the phone
  const reserve = Math.max(84, h * 0.12);
  const ph = Math.max(180, Math.min(h - top - reserve, h * 0.5));
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
  const handOff = (out, inc, at) => {
    const w = SWAP;
    const once = { immediateRender: false };
    tl.fromTo(out, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, { autoAlpha: 0, y: -18, filter: "blur(6px)", duration: w * 0.42, ease: "power2.in", stagger: w * 0.04, ...once }, at);
    tl.fromTo(inc, { autoAlpha: 0, y: 18, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: w * 0.46, ease: "power2.out", stagger: w * 0.06, ...once }, at + w * 0.48);
  };

  // The hero leaves the same way: headline out first, then chapter 1 in.
  const push = (outEl, inc, at) => {
    const w = SWAP;
    const once = { immediateRender: false };
    tl.fromTo(outEl, { autoAlpha: 1, y: 0, filter: "blur(0px)" }, { autoAlpha: 0, y: -28, filter: "blur(6px)", duration: w * 0.45, ease: "power2.in", ...once }, at);
    tl.fromTo(inc, { autoAlpha: 0, y: 18, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: w * 0.46, ease: "power2.out", stagger: w * 0.06, ...once }, at + w * 0.5);
  };

  const heroTitle = heroCopy.querySelector(".hero__title");
  const heroItems = Array.from(heroCopy.querySelectorAll("[data-hero-item]"));
  tl.fromTo(heroItems, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -30, duration: CHAPTERS[0].enter - HERO_EXIT, ease: "power1.in" }, HERO_EXIT);
  const strip = story.querySelector("[data-standards]");
  if (strip) tl.fromTo(strip, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 24, duration: CHAPTERS[0].enter - HERO_EXIT, ease: "power1.in" }, HERO_EXIT);

  const blocks = chapters.map((chapter) => Array.from(chapter.querySelectorAll(".chapter__lead, .chapter__aside, .chapter__caption")));
  chapters.forEach((chapter, i) => {
    const { enter, exit } = CHAPTERS[i];
    unsplit(chapter.querySelector(".chapter__title"));
    tl.set(chapter, { autoAlpha: 1 }, enter);
    gsap.set(blocks[i], { autoAlpha: 0 });
    if (exit !== null) tl.set(chapter, { autoAlpha: 0 }, exit + SWAP);
  });
  // chapter 1's caption sits by the phone, so it waits until the phone has
  // finished its turn and faces front
  const firstCaption = chapters[0].querySelector(".chapter__caption");
  push(heroTitle, blocks[0].filter((el) => el !== firstCaption), CHAPTERS[0].enter);
  if (firstCaption) {
    gsap.set(firstCaption, { autoAlpha: 0 });
    tl.fromTo(firstCaption, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.14, ease: "power2.out", immediateRender: false }, RISE[1] + 0.02);
  }
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
  gsap.set(story.querySelectorAll("[data-chapter], .chapter__lead, .chapter__aside, .chapters__progress, .hero__title, [data-hero-item], [data-standards]"), { clearProps: "all" });
  buildStory();
  ScrollTrigger.refresh();
  if (p > 0 && storyTrigger) window.scrollTo(0, storyTrigger.start + p * (storyTrigger.end - storyTrigger.start));
}

/* ============================================================
   3D stage, created after first paint
   ============================================================ */
let stageApi = null;

function initStage(downloadOnly = false) {
  const container = story.querySelector("[data-gl]");
  const frames = {
    hero: story.querySelector('[data-frame="hero"]'),
    chapter: story.querySelector('[data-frame="chapter"]'),
  };
  const labelLayer = story.querySelector("[data-labels]");
  const avoid = Array.from(story.querySelectorAll(".chapter__lead > *, .chapter__aside > *, .chapter__caption, .chapters__progress"));
  const dlEl = document.querySelector("[data-gl-download]");
  const mobile = window.matchMedia("(max-width: 899px), (max-aspect-ratio: 6/5)").matches;
  import("./stage/stage.js?v=8f")
    .then(({ createStage }) =>
      createStage({
        story: { container, stage, frames, avoid, labelLayer, getProgress: () => progress.t },
        download: dlEl ? { container: dlEl } : null,
        mobile,
        downloadOnly,
        reduced: !motion,
        quality: window.__quality,
      })
    )
    .then((api) => {
      stageApi = api;
      window.__shroudStage = api;
      if (!downloadOnly) root.classList.add("is-3d");
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
  gsap.set(story.querySelectorAll(".hero__copy, .hero__title, [data-hero-item], [data-standards], [data-chapter], .chapter__lead, .chapter__aside, .chapter__lead > *, .chapter__aside > *, .chapters__progress"), { clearProps: "all" });
  ScrollTrigger.refresh();
}

// Three.js and the model load only once their section is close to view,
// after the device's quality tier has been settled.
function whenNear(targets, fn) {
  const els = targets.filter(Boolean);
  const go = () => {
    const q = window.__quality && window.__quality.ready;
    (q || Promise.resolve()).then(() => whenIdle(fn));
  };
  if (!els.length || !("IntersectionObserver" in window)) return go();
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      go();
    },
    { rootMargin: "100% 0px" }
  );
  els.forEach((el) => io.observe(el));
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
  const items = story.querySelectorAll("[data-hero-item], [data-standards]");
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
  document.querySelectorAll("[data-magnetic]").forEach((el) => add(el, el, 0.28, 12));
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
   Footer sign-off: the logo mark, lit up as the page runs out
   ============================================================ */
function signoff() {
  const mark = document.querySelector("[data-signoff]");
  if (!mark) return;
  if (!motion || !gsap || !ScrollTrigger) {
    mark.style.setProperty("--r", "1");
    return;
  }
  mark.style.setProperty("--r", "0");
  const set = (self) => mark.style.setProperty("--r", self.progress.toFixed(4));
  ScrollTrigger.create({ trigger: mark, start: "top bottom", end: "bottom bottom", onUpdate: set, onRefresh: set });
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
    // illustration cards are tall on phones: reveal as soon as a slice shows
    watch(el, () => el.classList.add("is-played"), null, el.classList.contains("ill") ? 0.12 : 0.35);
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
}

/* A small scheduler: timers that pause with the card. */
function loop(el, run) {
  let timers = [];
  let on = false;
  const at = (ms, fn) => timers.push(setTimeout(() => on && fn(), ms));
  const start = () => {
    el.classList.add("is-played");
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

/* How it works: each step's illustration keeps playing while on screen */
function howLoops() {
  if (!motion) return;

  const pub = document.querySelector('[data-loop="publish"]');
  if (pub) {
    const l = loop(pub, (at) => {
      pub.dataset.phase = "0";
      at(500, () => (pub.dataset.phase = "1"));
      at(1300, () => (pub.dataset.phase = "2"));
      at(2100, () => (pub.dataset.phase = "3"));
      at(2900, () => (pub.dataset.phase = "4"));
      at(3300, () => (pub.dataset.phase = "5"));
      at(5600, () => l.again());
    });
  }

  const ecdh = document.querySelector('[data-loop="ecdh"]');
  if (ecdh) {
    const addr = ecdh.querySelector("[data-addr]");
    const trail = Array.from(ecdh.querySelectorAll("[data-trail] i"));
    const outs = ["bc1p…48cd", "bc1p…5bf4", "bc1p…dc43", "bc1p…a9f3"];
    let n = 1;
    const l = loop(ecdh, (at) => {
      ecdh.dataset.phase = "0";
      at(300, () => (ecdh.dataset.phase = "1"));
      at(1300, () => (ecdh.dataset.phase = "2"));
      at(2100, () => {
        ecdh.dataset.phase = "3";
        addr.textContent = outs[n % outs.length];
        if (n % trail.length === 0) trail.forEach((p) => p.classList.remove("is-lit"));
        const p = trail[n % trail.length];
        p.classList.add("is-lit", "is-new");
        setTimeout(() => p.classList.remove("is-new"), 600);
        n++;
      });
      at(4600, () => l.again());
    });
  }

  const scan = document.querySelector('[data-loop="lscan"]');
  if (scan) {
    const rows = Array.from(scan.querySelectorAll(".lscan__device .pucks"));
    const sweep = scan.querySelector("[data-sweep]");
    let cycle = 0;
    const l = loop(scan, (at) => {
      rows.forEach((row) => {
        row.classList.remove("is-scan");
        row.querySelectorAll("i").forEach((p) => p.classList.remove("own", "is-hit"));
      });
      // two of the rows hold an output that's yours, somewhere new each time
      const hits = [(cycle * 2 + 1) % rows.length, (cycle * 2 + 3) % rows.length];
      hits.forEach((r, k) => rows[r].querySelectorAll("i")[(cycle * 3 + k * 2 + 1) % 6].classList.add("own"));
      sweep.style.setProperty("--row", "0");
      at(200, () => scan.classList.add("is-sweeping"));
      rows.forEach((row, i) => {
        at(300 + i * 520, () => {
          sweep.style.setProperty("--row", String(i));
          rows.forEach((r) => r.classList.toggle("is-scan", r === row));
          const own = row.querySelector("i.own");
          if (own) setTimeout(() => own.classList.add("is-hit"), 260);
        });
      });
      const end = 300 + rows.length * 520;
      at(end, () => {
        rows.forEach((r) => r.classList.remove("is-scan"));
        scan.classList.remove("is-sweeping");
      });
      at(end + 1800, () => {
        cycle++;
        l.again();
      });
    });
  }

  const land = document.querySelector('[data-loop="land"]');
  if (land) {
    const box = land.querySelector("[data-land]");
    const cells = Array.from(box.querySelectorAll(".land__grid i"));
    const tag = box.querySelector("[data-tag]");
    const fly = box.querySelector("[data-fly]");
    const pubEl = land.querySelector(".nolink__pub");
    const outs = ["bc1p…48cd", "bc1p…5bf4", "bc1p…dc43"];
    const order = [12, 4, 29, 17, 33, 8, 24, 1, 21];
    let n = 0;
    const centre = (el) => {
      const a = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 };
    };
    const l = loop(land, (at) => {
      if (n % 3 === 0) cells.forEach((c) => c.classList.remove("is-own", "is-lit"));
      const cell = cells[order[n % order.length]];
      at(250, () => {
        const a = centre(pubEl);
        const b = centre(cell);
        if (fly.animate) {
          fly.animate(
            [
              { transform: `translate(${a.x}px, ${a.y}px) scale(0.4)`, opacity: 0 },
              { transform: `translate(${a.x}px, ${a.y + 10}px) scale(1)`, opacity: 1, offset: 0.15 },
              { transform: `translate(${b.x}px, ${b.y}px) scale(0.8)`, opacity: 1, offset: 0.9 },
              { transform: `translate(${b.x}px, ${b.y}px) scale(0.3)`, opacity: 0 },
            ],
            { duration: 1000, easing: "cubic-bezier(0.65, 0, 0.35, 1)" }
          );
        }
      });
      at(1200, () => {
        cells.forEach((c) => c.classList.contains("is-lit") && c.classList.replace("is-lit", "is-own"));
        cell.classList.add("is-lit");
        const b = centre(cell);
        tag.textContent = outs[n % outs.length];
        tag.style.setProperty("--tx", `${b.x}px`);
        tag.style.setProperty("--ty", `${b.y}px`);
        tag.classList.add("is-on");
        land.classList.add("is-ping");
      });
      at(2900, () => {
        tag.classList.remove("is-on");
        land.classList.remove("is-ping");
      });
      at(3500, () => {
        n++;
        l.again();
      });
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
    copy.querySelectorAll("a, button").forEach((el) => (el.tabIndex = -1));
    track.appendChild(copy);
  }
  strip.style.setProperty("--dur", `${((gw * per) / speed).toFixed(2)}s`);
  strip.classList.add("is-live");
}

// Strips only animate while on screen.
function idleOffscreen(strip) {
  watch(strip, () => strip.classList.remove("is-off"), () => strip.classList.add("is-off"), 0);
}

function marquees() {
  if (!motion) return;
  const standards = document.querySelector(".standards__marquee");
  if (!standards) return;
  idleOffscreen(standards);
  fillMarquee(standards, 34);
  let lastW = window.innerWidth;
  let timer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (Math.abs(window.innerWidth - lastW) < 2) return;
      lastW = window.innerWidth;
      fillMarquee(standards, 34);
    }, 200);
  });
}

/* The threat model: rows reveal one by one down both columns; a row opens
   its note on hover (pointer) or tap/click, and on keyboard focus. */
function threats() {
  const box = document.querySelector("[data-threats]");
  if (!box) return;
  const cols = Array.from(box.querySelectorAll(".tm__col"));
  // interleave the columns so the reveal runs across and down together
  cols.forEach((col, c) => {
    col.querySelector(".tm__label").style.setProperty("--d", `${c * 0.08}s`);
    col.querySelectorAll(".tm__item").forEach((item, i) => item.style.setProperty("--d", `${0.2 + i * 0.14 + c * 0.07}s`));
  });
  if (!motion) box.classList.add("is-played");
  else watch(box, () => box.classList.add("is-played"), null, 0.15);

  const set = (item, open) => {
    item.classList.toggle("is-open", open);
    item.querySelector(".tm__row").setAttribute("aria-expanded", open ? "true" : "false");
  };
  box.querySelectorAll(".tm__item").forEach((item) => {
    const row = item.querySelector(".tm__row");
    let hovered = false;
    row.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      hovered = true;
      set(item, true);
    });
    item.addEventListener("pointerleave", (e) => {
      if (e.pointerType !== "mouse") return;
      hovered = false;
      set(item, false);
    });
    row.addEventListener("click", () => {
      if (hovered) return;
      set(item, !item.classList.contains("is-open"));
    });
  });
}

/* ============================================================
   Boot
   ============================================================ */
function boot() {
  marquees();
  threats();
  howItWorks();
  illustrations();
  features();
  howLoops();
  glow();
  if (!gsap || !ScrollTrigger) {
    signoff();
    return;
  }
  signoff();
  if (!useStage && !motion && webglAvailable() && document.querySelector("[data-gl-download]")) whenNear([document.querySelector("[data-gl-download]")], () => initStage(true));
  if (useStage) {
    buildStory();
    whenNear([story, document.querySelector("[data-gl-download]")], () => initStage());
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
