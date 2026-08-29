# Shroud — marketing website

Static marketing site for Shroud, a privacy-first Bitcoin wallet built on silent payments (BIP-352). Implemented from the Figma design ("Shroud" frame), fully responsive and mobile friendly.

## Stack

Plain HTML + CSS + a little vanilla JS — no build step, no dependencies.

```
index.html        # single-page site (all sections)
css/styles.css    # design tokens + components + responsive rules
js/main.js        # mobile nav, accordions, copy button, scroll reveals
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

## Notes

- The download / app-store links (Direct APK, F-Droid, App Store, Play Store) and the project links in the footer (GitHub, Documentation, …) are intentionally inert — the app isn't published yet. They're marked with `data-noop` in `index.html`; remove that attribute and set real `href`s when ready.
- Nav links map to on-page sections (`#features`, `#how-it-works`, `#security`, `#compare`, `#faq`); "Get Started" and "Download Shroud" scroll to the download section.
- Animations (scroll reveals, marquee, scan line, floating cards) respect `prefers-reduced-motion`.
