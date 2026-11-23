# Angel Line — 天使回線

*A network for things with too many wings.*

An interactive angelpunk / metalheart transmission, built as a single static page. No build step, no dependencies: every image, shape and sound is generated in code.

## Rooms

- **Structure** (`index.html`) — the main menu: a massive abstract chrome megastructure. Every room is docked at a far edge; choosing one flies the camera across the structure to it. Arrow keys, scroll, swipe or click.
- **Halo** (`halo.html`) — the first transmission: boot sequence, the raymarched chrome thorn halo (Chrome / ASCII / Ink), the ink seraph, the cardiac cable puzzle, ANGEL_OS, and the hold-to-be-named ID card.
- **Vessel** (`vessel.html`) — a porcelain cyborg doll asleep in a water chamber, cabled at the spine. Tap the glass and she looks at you; hold to drain the chamber.
- **Signal** (`signal.html`) — a white void of hanging monitors, each running its own transmission. Click a screen to listen and reply.
- **Flash** (`flash.html`) — a gothic ink symmetry table. Draw with Ink, Thorn, Chain or Blood; "Bless it" draws an ornament for you. Downloadable.
- **Press** (`press.html`) — a flyer machine printing one-of-a-kind posters in the moodboard's print language. Downloadable.

The art direction is written up in [`docs/aesthetics.md`](docs/aesthetics.md). The `renders/` folder holds optional procedural Blender scenes.

## Run locally

Any static server works, for example:

```bash
python3 -m http.server 8000
```

then open http://localhost:8000.

## Publish on GitHub Pages

Repo **Settings → Pages → Build and deployment → Deploy from a branch**, pick the branch and `/ (root)`, save. The site appears at `https://<user>.github.io/<repo>/`.

## Files

- `index.html`, `halo.html`, `vessel.html`, `signal.html`, `flash.html`, `press.html` — the rooms
- `css/style.css` — the Halo page; `css/system.css` — shared system for the other rooms, plus one stylesheet per room
- `js/shared.js` — HUD, cursor, sound toggle and page transitions shared by the rooms
- `js/structure.js`, `js/vessel.js`, `js/signal.js` — Three.js rooms; `js/flash.js`, `js/press.js` — canvas rooms
- `js/halo.js`, `js/wings.js`, `js/wires.js`, `js/os.js`, `js/card.js`, `js/main.js` — the Halo page
- `js/audio.js` — synthesized sound (Web Audio), shared everywhere
- `vendor/three/` — Three.js 0.170 (MIT), bundled so the site has no CDN dependency
