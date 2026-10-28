(function () {
  "use strict";

  var root = document.documentElement;
  var navWrap = document.querySelector(".nav-wrap");
  var toggle = document.querySelector(".nav__toggle");
  var menu = document.getElementById("nav-menu");
  var mobileNav = window.matchMedia("(max-width: 899px)");

  /* ---------- Mobile menu ---------- */
  function setMenu(open, returnFocus) {
    if (!toggle || !menu) return;
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (mobileNav.matches) {
      if (open) menu.removeAttribute("inert");
      else menu.setAttribute("inert", "");
    }
    if (open) {
      var first = menu.querySelector("a");
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    } else if (returnFocus) {
      toggle.focus({ preventScroll: true });
    }
  }

  function syncMenuMode() {
    if (!menu) return;
    if (mobileNav.matches && !menu.classList.contains("is-open")) menu.setAttribute("inert", "");
    else menu.removeAttribute("inert");
  }

  if (toggle && menu) {
    syncMenuMode();
    if (mobileNav.addEventListener) mobileNav.addEventListener("change", function () { setMenu(false); syncMenuMode(); });
    toggle.addEventListener("click", function () {
      setMenu(!menu.classList.contains("is-open"));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("click", function (e) {
      if (menu.classList.contains("is-open") && !e.target.closest(".nav")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false, true);
    });
  }

  /* ---------- Nav: a full bar at the top, a glass pill once scrolled, and
     inside a section the wordmark rolls over to that section's name ---------- */
  var nav = navWrap && navWrap.querySelector(".nav");
  var bar = document.querySelector("[data-progress]");
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
  var indicator = document.querySelector(".nav__indicator");
  var word = document.querySelector(".nav__word");
  var ctxEl = document.querySelector("[data-ctx]");
  var story = document.querySelector("[data-story]");
  var endEl = document.querySelector(".finale") || document.querySelector("footer");
  var current = null;
  var maxScroll = 1;
  var geo = null;
  var slotW = 0;
  var labelW = {};
  var contexts = [];
  var chapter = { index: -1, progress: 0, labels: [] };
  var ctxLabel;

  if (story) {
    chapter.labels = Array.prototype.map.call(story.querySelectorAll("[data-chapter] .eyebrow"), function (eb) {
      var clone = eb.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll(".eyebrow__index, svg"), function (n) { n.remove(); });
      return clone.textContent.trim();
    });
  }

  var moveTimer = 0;
  function placeIndicator() {
    if (!indicator) return;
    if (!current || mobileNav.matches) {
      indicator.classList.remove("is-on");
      return;
    }
    var x = current.offsetLeft;
    var w = current.offsetWidth;
    var wasOn = indicator.classList.contains("is-on");
    var fromX = parseFloat(indicator.style.getPropertyValue("--x")) || 0;
    var fromW = parseFloat(indicator.style.getPropertyValue("--w")) || 0;
    clearTimeout(moveTimer);
    if (wasOn && fromW && Math.abs(fromX - x) > 1) {
      // stretch across both links first, then settle on the new one
      var left = Math.min(fromX, x);
      var right = Math.max(fromX + fromW, x + w);
      indicator.classList.add("is-moving");
      indicator.style.setProperty("--x", left + "px");
      indicator.style.setProperty("--w", right - left + "px");
      moveTimer = setTimeout(function () {
        indicator.classList.remove("is-moving");
        indicator.style.setProperty("--x", x + "px");
        indicator.style.setProperty("--w", w + "px");
      }, 240);
    } else {
      indicator.style.setProperty("--x", x + "px");
      indicator.style.setProperty("--w", w + "px");
    }
    indicator.classList.add("is-on");
  }

  function textWidth(text) {
    if (!ctxEl) return 0;
    if (labelW[text] == null) {
      var probe = ctxEl.cloneNode(false);
      probe.textContent = text;
      probe.style.cssText = "position:absolute;visibility:hidden;width:max-content;transform:none;filter:none";
      word.appendChild(probe);
      labelW[text] = Math.ceil(probe.getBoundingClientRect().width) + 2;
      probe.remove();
    }
    return labelW[text];
  }

  // Pill geometry for a given wordmark slot width (desktop only).
  function layoutPill() {
    if (!nav || !geo) return;
    var target = ctxLabel ? Math.min(textWidth(ctxLabel), geo.maxSlot) : geo.nameW;
    if (target === slotW) return;
    slotW = target;
    nav.style.setProperty("--slot", slotW + "px");
    // the links stay centred, so the pill grows evenly on both sides
    var side = Math.max(geo.padL + geo.markW + slotW + geo.gap, geo.gap + geo.ctaW + geo.padR);
    var pw = geo.rowW + side * 2;
    var left = (geo.navW - pw) / 2;
    nav.style.setProperty("--pw", pw + "px");
    nav.style.setProperty("--bx", Math.max(0, left + geo.padL - geo.brandL) + "px");
    nav.style.setProperty("--ex", Math.min(0, left + pw - geo.padR - geo.endR) + "px");
  }

  function measureContexts() {
    var sy = window.scrollY;
    var stage = document.documentElement.classList.contains("has-stage");
    contexts = [];
    var list = Array.prototype.slice.call(document.querySelectorAll("[data-nav-label]"));
    if (!stage && story) list = Array.prototype.slice.call(story.querySelectorAll("[data-chapter]")).concat(list);
    var roadmapCol = document.querySelector(".roadmap__col");
    list.forEach(function (el, i) {
      var r = el.getBoundingClientRect();
      var label = el.getAttribute("data-nav-label");
      if (!label && el.hasAttribute("data-chapter")) label = chapter.labels[Array.prototype.indexOf.call(story.querySelectorAll("[data-chapter]"), el)];
      // side by side with the roadmap, the FAQ is part of the same read
      if (el.id === "faq" && roadmapCol && roadmapCol !== el && Math.abs(roadmapCol.getBoundingClientRect().top - r.top) < 40) return;
      contexts.push({ el: el, top: r.top + sy, label: label });
    });
    contexts.sort(function (a, b) { return a.top - b.top; });
    if (story) {
      var sr = story.parentElement && story.parentElement.classList.contains("pin-spacer") ? story.parentElement : story;
      var b = sr.getBoundingClientRect();
      chapter.top = b.top + sy;
      chapter.bottom = b.bottom + sy;
      chapter.stage = stage;
    }
  }

  // Nav geometry is measured here only (load, resize, fonts), never while scrolling.
  function measureNav() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    labelW = {};
    if (nav && navWrap.hasAttribute("data-nav")) {
      var brand = nav.querySelector(".nav__brand");
      var row = nav.querySelector(".nav__links");
      var end = nav.querySelector(".nav__end");
      var cta = end && end.querySelector(".nav__cta--bar");
      var name = nav.querySelector(".nav__name");
      nav.style.removeProperty("--slot");
      slotW = -1;
      if (mobileNav.matches || !brand || !row || !cta || !name) {
        geo = null;
        nav.style.setProperty("--pw", nav.offsetWidth + "px");
        nav.style.setProperty("--bx", "0px");
        nav.style.setProperty("--ex", "0px");
      } else {
        var navW = nav.offsetWidth;
        var nameW = Math.ceil(name.getBoundingClientRect().width) + 1;
        var rowW = row.offsetWidth;
        var ctaW = cta.offsetWidth;
        geo = {
          navW: navW,
          padL: 18,
          padR: 7,
          gap: 26,
          markW: 36,
          nameW: nameW,
          rowW: rowW,
          ctaW: ctaW,
          brandL: brand.offsetLeft,
          endR: end.offsetLeft + end.offsetWidth,
          maxSlot: Math.max(nameW, Math.min(170, (navW - rowW) / 2 - 12 - 18 - 36 - 26)),
        };
      }
    }
    measureContexts();
    placeIndicator();
  }

  function setContext(label, progress) {
    if (label !== ctxLabel) {
      ctxLabel = label;
      if (label && ctxEl) {
        ctxEl.textContent = label;
        if (ctxEl.animate && navWrap.classList.contains("has-ctx")) {
          ctxEl.animate(
            [{ transform: "translateY(90%)", opacity: 0, filter: "blur(4px)" }, { transform: "none", opacity: 1, filter: "blur(0)" }],
            { duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
          );
        }
      }
      navWrap.classList.toggle("has-ctx", !!label);
      layoutPill();
    }
    if (nav) nav.style.setProperty("--p", (label ? progress : 0).toFixed(3));
  }

  // Sections are read live here (a handful of rects per frame), so opened
  // accordions or late layout shifts can never leave a stale label behind.
  function findContext(y) {
    var vh = window.innerHeight;
    var probe = vh * 0.4;
    if (story && chapter.stage && y + probe < chapter.bottom) {
      if (chapter.index < 0) return null;
      return { label: chapter.labels[chapter.index], progress: chapter.progress };
    }
    // once the sign-off takes over most of the screen, the wordmark returns
    if (endEl && endEl.getBoundingClientRect().top < vh * 0.7) return null;
    for (var i = contexts.length - 1; i >= 0; i--) {
      var r = contexts[i].el.getBoundingClientRect();
      if (probe >= r.top && probe < r.bottom) return { label: contexts[i].label, progress: Math.min(1, (probe - r.top) / r.height) };
    }
    return null;
  }

  if (navWrap) {
    var ticking = false;
    var scrolled = null;
    var update = function () {
      ticking = false;
      var y = window.scrollY;
      var on = y > 24;
      if (on !== scrolled) {
        scrolled = on;
        navWrap.classList.toggle("is-scrolled", on);
      }
      var c = on ? findContext(y) : null;
      setContext(c ? c.label : null, c ? c.progress : 0);
      if (bar) bar.style.transform = "scaleX(" + Math.min(1, y / maxScroll).toFixed(4) + ")";
    };
    var schedule = function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", schedule, { passive: true });
    document.addEventListener("story:chapter", function (e) {
      chapter.index = e.detail.index;
      chapter.progress = e.detail.progress;
      schedule();
    });
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { measureNav(); ctxLabel = undefined; update(); }, 120);
    });
    var remeasure = function () { measureNav(); ctxLabel = undefined; update(); };
    window.addEventListener("load", remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    if ("ResizeObserver" in window) {
      var roTimer = 0;
      new ResizeObserver(function () {
        maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        clearTimeout(roTimer);
        roTimer = setTimeout(function () { measureContexts(); schedule(); }, 150);
      }).observe(document.body);
    }
    measureNav();
    update();
  }

  /* ---------- Active section indicator ---------- */
  if (links.length && indicator && "IntersectionObserver" in window) {
    var targets = links
      .map(function (a) { return { link: a, el: document.querySelector(a.getAttribute("href")) }; })
      .filter(function (t) { return t.el; });
    var visible = new Set();

    var pick = function () {
      var next = null;
      targets.forEach(function (t) { if (visible.has(t.el)) next = t.link; });
      if (next === current) return;
      if (current) current.removeAttribute("aria-current");
      current = next;
      if (current) current.setAttribute("aria-current", "true");
      placeIndicator();
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      pick();
    }, { rootMargin: "-38% 0px -58% 0px" });
    targets.forEach(function (t) { io.observe(t.el); });
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
    var label = btn.querySelector("[data-copy-label]") || btn;
    var original = label.textContent;
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || "";
      var done = function () {
        label.textContent = "Copied";
        btn.classList.add("is-done");
        setTimeout(function () {
          label.textContent = original;
          btn.classList.remove("is-done");
        }, 1600);
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

  root.classList.add("is-ready");
})();
