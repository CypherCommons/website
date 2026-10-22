# Shroud — marketing website

Static marketing site for Shroud, a privacy-first Bitcoin wallet built on silent payments (BIP-352). Implemented from the Figma design ("Shroud" frame), fully responsive and mobile friendly.

## Stack

Plain HTML + CSS + a little vanilla JS — no build step, no dependencies.

```
index.html        # single-page site (all sections)
privacy/index.html # privacy policy, served at /privacy/
css/styles.css    # design tokens + components + responsive rules
js/main.js        # mobile nav, accordions, copy button, scroll reveals, scroll-driven motion (hero, diagram, bento, how-it-works)
assets/fonts/     # self-hosted Clash Grotesk, Inter, JetBrains Mono (variable woff2)
assets/img/       # images exported from the Figma design
```

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` also works; fonts and images are all local.)

## Deploy

Hosted on GitHub Pages at the canonical domain **https://shroudwallet.com** (`CNAME` is committed; enable Pages on `main` / root in repo settings and point DNS apex `A` records at GitHub Pages IPs, `www` CNAME at `cyphercommons.github.io`). `shroudwallet.xyz` should 301-redirect to the `.com` at the DNS/registrar level.

## Notes

- The download / app-store links (Direct APK, F-Droid, App Store, Play Store) and the project links in the footer (GitHub, Documentation, …) are intentionally inert — the app isn't published yet. They're marked with `data-noop` in `index.html`; remove that attribute and set real `href`s when ready.
- Nav links map to on-page sections (`#features`, `#how-it-works`, `#security`, `#compare`, `#faq`); "Get Started" and "Download Shroud" scroll to the download section.
- `privacy/index.html` is a static copy of the privacy policy written in Claude Docs ("Shroud Privacy Policy"). When the policy changes, update the HTML, the "Effective" date, and the `lastmod` in `sitemap.xml`. Keep the homepage's privacy claims consistent with it.
- Animations (scroll reveals, marquee, scan line, floating cards, hero/diagram/bento loops, the pinned "How a silent payment finds you" section) respect `prefers-reduced-motion`; with JS off, or at ≤880px / <700px viewport height, the pinned and scroll-linked effects fall back to the static layout. Timing constants live at the top of each module in `js/main.js`.
- `body` uses `overflow-x: clip` (with an `overflow-x: hidden` fallback) — `hidden` on `body` silently breaks `position: sticky`, which the pinned how-it-works section depends on.
