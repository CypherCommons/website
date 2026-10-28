# Shroud — marketing website

Static marketing site for Shroud, a privacy-first Bitcoin wallet built on silent payments (BIP-352). Implemented from the Figma design ("Shroud" frame), fully responsive and mobile friendly.

## Stack

Plain HTML + CSS + vanilla JS (ES modules) — no build step. Everything is self-hosted; there are no CDNs.

```
index.html          # single-page site (all sections), importmap for three.js
privacy/index.html  # privacy policy, served at /privacy/
support/index.html  # support page, served at /support/
css/styles.css      # design tokens + components + responsive rules (shared by all pages)
js/main.js          # nav (scroll states, active section, mobile menu), accordions, copy button
js/site.js          # homepage motion: Lenis, GSAP ScrollTrigger, pinned story, how-it-works rail, feature loops, reveals
js/timeline.js      # story timing shared by the copy and the 3D scene
js/stage/           # three.js scene: stage.js (camera, story choreography, render loop), phone.js (GLB loader + materials),
                    # screens.js (live app screens drawn on the phone), objects.js (output pucks, glow, floor rings)
assets/models/      # phone.glb (quantised, KHR_mesh_quantization)
assets/fonts/       # self-hosted Clash Grotesk (display), Inter (body), JetBrains Mono (mono), variable woff2
assets/icons/       # Lucide icons (ISC) and official brand marks from Simple Icons (CC0) — the homepage inlines them as an SVG sprite
assets/vendor/      # gsap, ScrollTrigger, lenis, three (MIT; addons: GLTFLoader, RoomEnvironment, BufferGeometryUtils, SkeletonUtils)
assets/img/         # logo, screenshots, static phone and download fallbacks
```

### Homepage story

The centred hero and the four "how silent payments work" chapters share one pinned stage. The 3D phone starts below the hero copy, rises into the centre of the viewport and stays horizontally centred for the whole story with a slow sway; each chapter's copy is balanced on both sides of it (above it on narrow screens). Around the phone is a field of identical output pucks (one `InstancedMesh`). Payments leave the phone along curved paths: to a reused address they all stack on one output that lights up as linkable; to the silent payment address each lands on a new output and blends back into the crowd. The scan sweeps out across the field from under the phone, lights up only the wallet's own outputs and brings them back into it. Scene labels are HTML, projected onto 3D positions.

The phone's display is a 2D canvas (`js/stage/screens.js`) used as a texture and repainted only when its state changes. It redraws the app's own screens (home, send, receive, sync), using the app's light theme colours, Clash Grotesk, its icons and its `loc/en.json` copy. The app is operated as you scroll, with tap ripples, push/pop transitions, the sync progress filling, the balance counting up and new transactions sliding in.

`js/timeline.js` defines when each chapter's copy, scene beat and screen change happen. One WebGL renderer (pixel ratio capped at 1.5) draws both the story and the phone in the download section: the canvas moves to whichever of the two is on screen. It renders only while something moves, holds idle motion at ~30 fps, and pauses when neither view is visible or the tab is hidden. The scene loads after first paint.

Below the story, "How it works" is a vertical timeline whose rail fills as you scroll, with an illustration card per step. The feature, trust and how-it-works illustrations are HTML/CSS/SVG in the same output-puck language as the 3D scene, and they only animate while on screen.

Without WebGL, with JavaScript off, or with `prefers-reduced-motion`, the story renders as stacked sections with static SVG figures, the phone image and the download image; nothing is pinned, scrubbed or looped.

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(The 3D scene uses ES modules, so serve the folder over HTTP; opened via `file://` the page falls back to the static layout.)

## Deploy

Hosted on GitHub Pages at the canonical domain **https://shroudwallet.com** (`CNAME` is committed; enable Pages on `main` / root in repo settings and point DNS apex `A` records at GitHub Pages IPs, `www` CNAME at `cyphercommons.github.io`). `shroudwallet.xyz` should 301-redirect to the `.com` at the DNS/registrar level.

## Notes

- The download / app-store links (Direct APK, F-Droid, App Store, Play Store) and the project links in the footer (GitHub, Documentation, …) are intentionally inert — the app isn't published yet. They're marked with `data-noop` in `index.html`; remove that attribute and set real `href`s when ready.
- Nav links map to on-page sections (`#features`, `#how-it-works`, `#security`, `#compare`, `#faq`); "Get Started" and "Download Shroud" scroll to the download section.
- `privacy/index.html` is a static copy of the privacy policy ("Shroud Privacy Policy"). When the policy changes, update the HTML, the "Effective" date, and the `lastmod` in `sitemap.xml`. Keep the homepage's privacy claims consistent with it.
- Animations respect `prefers-reduced-motion`: no smooth scrolling, no pinning or scrubbing, no entrance animations, and no 3D scene.
