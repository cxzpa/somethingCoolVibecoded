# Angel Line — renders

Procedural Blender scenes for the two cinematic set pieces. Pure Python, no external assets: each script builds the whole scene, renders the shots you ask for, and saves a `.blend` you can open and explore.

| Scene | Script | Look |
|---|---|---|
| **The Metalheart** | `heart.py` | A chrome sacred heart in a barbed crown of thorns, ribbed vessels rising into a fog-filled cathedral of hanging cables. One god-ray from above, red light from below. |
| **The Reliquary** | `seraph.py` | A six-winged chrome seraph of blades and eyes, suspended on wires in a pale liminal gallery of scaffolding. Every eye turns to the camera. |

| **Nox** | `nox.py` | The Vessel's sleeper as a rigged, game-ready GLB: a seamless sculpted body, fitted armor plates, silver hair locks, a face patch the page paints live, and two baked poses. Writes `assets/nox.glb`. |

## Shots

| Shot | Heart | Seraph | What it is for |
|---|---|---|---|
| `wide` | ✓ | ✓ | establishing frame shown before you click |
| `close` | ✓ | ✓ | end of the fly-in; the hand-off to the live web scene |
| `macro` / `eye` | ✓ | ✓ | extreme close-up poster frame |
| `flyin` | ✓ | ✓ | 6 s camera move, wide → close (MP4) |

## Run (Windows, PowerShell, from the repo folder)

Find your Blender folder (for example `C:\Program Files\Blender Foundation\Blender 5.3\`) and run:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b -P renders\heart.py -- --shot all --quality preview
```

Options after the `--`:

- `--shot all|wide|close|macro|flyin` (seraph: `eye` instead of `macro`)
- `--quality test|preview|final|poster` — `preview` is fast for checking, `final` is 1080p for the site
- `--frames 1-48` render part of the fly-in
- `--device auto|optix|cuda|cpu` (auto picks OptiX on RTX cards)
- `--no-video` write PNG frames instead of an MP4
- `--out <folder>` (default `renders/out`)

Output lands in `renders/out/` (ignored by git). Open `renders/out/heart.blend` in Blender to look around the scene.

## Rough timings on an RTX 3080 Ti

Estimates, to be confirmed by a first run: `preview` stills take seconds, the `preview` fly-in a few minutes, `final` stills under a minute each, and the `final` fly-in roughly 1–2 hours (144 frames). Render the preview fly-in first.

## Rebuilding Nox

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.3\blender.exe" -b -P renders\nox.py -- --out assets\nox.glb --preview renders\out
```

`--preview` also renders four check images (front, face, floating, slumped). The web page restyles her materials by name, paints her face, blends the two poses, floats her hair and turns her head toward you.
