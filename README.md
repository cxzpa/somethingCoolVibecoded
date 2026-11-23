# Angel Line — 天使回線

*A network for things with too many wings.*

An interactive angelpunk / metalheart transmission, built as a single static page. No build step, no dependencies: every image, shape and sound is generated in code.

## Scenes

1. **Boot** — an ASCII BIOS boot; descend with or without sound.
2. **Halo** — a raymarched chrome crown of thorns (WebGL) that follows the cursor. Render it as **Chrome**, **ASCII** or **Ink**. Click for a shockwave.
3. **Seraph** — a six-winged angel drawn in ink. Scroll to unfurl it, its eyes follow you, click to make it molt.
4. **Cardiac link** — drag four hanging cables (verlet physics) into the sockets of a metal heart until it beats.
5. **ANGEL_OS** — a Y2K desktop: draggable windows, a working terminal (`help`), a spinning ASCII relic, and a warning you should not click OK on.
6. **Be named** — hold the button to receive a procedurally drawn angel ID card. Same name, same angel. Downloadable as PNG.

## Run locally

Any static server works, for example:

```bash
python3 -m http.server 8000
```

then open http://localhost:8000.

## Publish on GitHub Pages

Repo **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch and `/ (root)`, save. The site appears at `https://<user>.github.io/<repo>/`.

## Files

- `index.html` — structure and copy
- `css/style.css` — the whole visual system
- `js/halo.js` — WebGL raymarcher + Chrome/ASCII/Ink post pass
- `js/wings.js` — the seraph (canvas 2D)
- `js/wires.js` — cable physics and the heart
- `js/os.js` — desktop windows, terminal, ASCII relic
- `js/card.js` — hold-to-name and the ID card renderer
- `js/audio.js` — synthesized sound (Web Audio)
- `js/main.js` — boot, HUD, cursor, wiring
