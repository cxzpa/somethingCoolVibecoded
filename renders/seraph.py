"""THE RELIQUARY — a chrome six-winged seraph suspended in a white liminal void.

Run (from the repo root):
    blender -b -P renders/seraph.py -- --shot all --quality preview
Shots:
    wide   the seraph tiny in an endless white gallery of scaffolding
    close  the core eye and thorned halo (hand-off frame to the live web scene)
    eye    extreme close-up of one wing eye looking straight at you
    flyin  the camera move from wide to close (MP4, 6 s @ 24 fps)
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import bpy  # noqa: E402
from mathutils import Vector, Matrix, Quaternion  # noqa: E402

import common as C  # noqa: E402

SHOTS = ["wide", "close", "eye", "flyin"]
POS = Vector((0.0, 0.0, 8.0))
CEILING = 32.0
FLY_FRAMES = 144

# pair: root (x, z) on the body, size, bone angles (radians, in the wing plane), sweep back (deg), feather count
PAIRS = [
    dict(root=(0.12, 0.85), size=1.0, bones=(-0.62, 0.36, 0.34), sweep=10, n=30),
    dict(root=(0.14, 0.15), size=1.18, bones=(-0.08, 0.22, 0.3), sweep=18, n=36),
    dict(root=(0.12, -0.55), size=0.82, bones=(0.48, 0.26, 0.34), sweep=26, n=26),
]
BONES = (1.15, 1.3, 1.05)


def materials():
    return {
        "chrome": C.mat_metal("chrome", rough=0.04),
        "chrome_soft": C.mat_metal("chrome_soft", rough=0.16, bump=0.03, bump_scale=30),
        "steel": C.mat_metal("black_steel", color=(0.035, 0.035, 0.04, 1), rough=0.22),
        "blood": C.mat_lacquer("blood", rough=0.18),
        "eye": C.mat_eye("eye"),
        "glow": C.mat_emit("core_glow", strength=14),
        "cable": C.mat_rubber("cable", color=(0.02, 0.02, 0.022, 1)),
        "scaffold": C.mat_metal("scaffold", color=(0.7, 0.7, 0.72, 1), rough=0.45),
        "floor": C.mat_lacquer("floor", color=(0.32, 0.32, 0.31, 1), rough=0.18, coat=0.5),
    }


# ------------------------------------------------------------------ body
def build_body(col, mats, parts):
    mb = bpy.data.metaballs.new("spine_mb")
    mb.resolution = 0.05
    mb.render_resolution = 0.02
    for i in range(14):
        t = i / 13
        z = 1.55 - t * 3.6
        w = 0.22 * math.sin(math.pi * (0.15 + 0.8 * t)) + 0.05
        e = mb.elements.new()
        e.type = "ELLIPSOID"
        e.co = (0, 0, z)
        e.radius = 0.8
        e.size_x, e.size_y, e.size_z = w * 1.3, w * 0.9, 0.5
    tmp = bpy.data.objects.new("spine_mb", mb)
    C.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    me.shade_smooth()
    body = bpy.data.objects.new("spine", me)
    C.link(body, col)
    C.assign(body, mats["chrome_soft"])
    parts.append(body)

    # vertebra rings
    ring = C.cylinder_mesh("vertebra", r=1.0, depth=1.0, seg=32)
    for i in range(16):
        z = 1.3 - i * 0.2
        t = i / 15
        r = (0.22 * math.sin(math.pi * (0.15 + 0.8 * t)) + 0.05) * 1.25 + 0.03
        o = C.place(ring, (0, 0, z), (0, 0, 1), scale=(r, r * 0.75, 0.018), collection=col)
        o.active_material = mats["steel"]
        parts.append(o)

    # the thread to infinity below
    C.curve_object("thread", [(0, 0, -2.05), (0.05, 0, -6), (0.0, 0, -POS.z + 0.02)], bevel=0.006, collection=col)\
        .data.materials.append(mats["steel"])

    # core eye at the chest, with a red glow behind the iris
    eye = C.sphere_mesh("core_eye", r=0.2, seg=48, rings=24)
    o = C.place(eye, (0, -0.16, 0.45), None, collection=col)
    o.active_material = mats["eye"]
    parts.append(o)
    lid = C.cylinder_mesh("eyelid", r=1, depth=1, seg=48)
    lo = C.place(lid, (0, -0.12, 0.45), (0, -1, 0), scale=(0.26, 0.15, 0.02), collection=col)
    lo.active_material = mats["chrome"]
    parts.append(lo)
    return o


def build_halo(col, mats, parts):
    thorn = C.cone_mesh("halo_thorn", r=0.02, depth=0.22, segments=8)
    h = C.barbed_ring("halo", radius=0.78, strand_r=0.035, wire=0.012, twist_turns=38, collection=col,
                      mat=mats["chrome"], thorn_mesh=thorn, thorns=44, thorn_mat=mats["chrome"], seed=4)
    h.location = (0, 0, 2.25)
    h.rotation_euler = (math.radians(12), 0, 0)
    parts.append(h)
    # a solid band inside the barbed wire
    band = C.curve_object("halo_band", [(math.cos(a) * 0.78, math.sin(a) * 0.78, 0) for a in
                                        [i / 160 * math.tau for i in range(160)]], bevel=0.03, closed=True, collection=col)
    band.data.materials.append(mats["chrome"])
    band.parent = h
    return h


# ------------------------------------------------------------------ wings
def wing_chain(pair):
    pts = [Vector((pair["root"][0], 0, pair["root"][1]))]
    angs, a = [], 0.0
    for i, rel in enumerate(pair["bones"]):
        a = rel if i == 0 else a + rel
        angs.append(a)
        L = BONES[i] * pair["size"]
        # angle measured in the x/z plane: 0 = +x, negative = upward (matches the 2D page)
        pts.append(pts[-1] + Vector((math.cos(a) * L, 0, -math.sin(a) * L)))
    return pts, angs


def along(pts, angs, pair, f):
    lens = [b * pair["size"] for b in BONES]
    d = f * sum(lens)
    for i in range(3):
        if d <= lens[i] or i == 2:
            t = min(1.0, d / lens[i])
            return pts[i].lerp(pts[i + 1], t), angs[i]
        d -= lens[i]


def build_wings(col, mats, parts, cam_hint):
    rnd = random.Random(31)
    bone_mesh = C.cylinder_mesh("bone", r=1, depth=1, seg=16)
    eye_mesh = C.sphere_mesh("wing_eye", r=1, seg=40, rings=20)
    blades = {}
    eyes = []
    for pi, pair in enumerate(PAIRS):
        pts, angs = wing_chain(pair)
        for side in (1, -1):
            sweep = Matrix.Rotation(math.radians(pair["sweep"]) * side, 4, "Z")

            def W(v):
                v = Vector((v.x * side, v.y, v.z))
                return sweep @ v

            # bones
            for i in range(3):
                a, b = W(pts[i]), W(pts[i + 1])
                mid, d = (a + b) / 2, (b - a)
                o = C.place(bone_mesh, mid, d, scale=(0.028 * pair["size"], 0.028 * pair["size"], d.length), collection=col)
                o.active_material = mats["steel"]
                parts.append(o)
            # blades
            for k in range(pair["n"]):
                f = (k + 0.5) / pair["n"]
                p, ba = along(pts, angs, pair, f)
                rest = 1.05 + (0.22 - 1.05) * f + rnd.uniform(-0.1, 0.1)
                fa = ba + rest
                d = Vector((math.cos(fa), 0, -math.sin(fa)))
                L = (0.5 + 1.75 * f ** 1.35) * pair["size"] * rnd.uniform(0.82, 1.15)
                wdt = (0.15 + 0.1 * rnd.random()) * pair["size"]
                key = (round(L, 2), round(wdt, 3))
                me = blades.get(key) or C.blade_mesh("blade", length=1.0, width=wdt / L, thick=0.004 / L)
                blades[key] = me
                wp, wd = W(p), W(d).normalized()
                # blade's flat face roughly facing the camera, with a little flutter so they catch light
                o = C.place(me, wp + Vector((0, rnd.uniform(-0.03, 0.03) - k * 0.004, 0)), wd, scale=L, collection=col,
                            roll=rnd.uniform(-0.5, 0.5))
                style = rnd.random()
                o.active_material = mats["blood"] if (f > 0.62 and style < 0.18) else (mats["steel"] if style < 0.62 else mats["chrome"])
                parts.append(o)
            # eye at the first joint
            ep = W(pts[1]) + Vector((0, -0.06, 0))
            r = 0.085 * pair["size"]
            o = C.place(eye_mesh, ep, None, scale=r, collection=col)
            o.active_material = mats["eye"]
            eyes.append(o)
            parts.append(o)
            lid = C.place(C.cylinder_mesh("lid", r=1, depth=1, seg=32), ep + Vector((0, 0.02, 0)), (0, -1, 0),
                          scale=(r * 1.35, r * 0.75, r * 0.12), collection=col)
            lid.active_material = mats["chrome"]
            parts.append(lid)
    return eyes


def aim_eyes(eyes, target):
    """All eyes look at the camera: local +Y (the iris) toward target."""
    for e in eyes:
        wpos = e.matrix_world.translation
        q = (Vector(target) - wpos).to_track_quat("Y", "Z")
        e.rotation_mode = "QUATERNION"
        # eyes are parented: convert to the parent's space
        if e.parent:
            q = e.parent.matrix_world.to_quaternion().inverted() @ q
        e.rotation_quaternion = q


# ------------------------------------------------------------------ environment
def build_gallery(col, mats):
    import bmesh
    rnd = random.Random(5)
    fl = bpy.data.objects.new("floor", C.mesh_from_bmesh("floor", lambda bm: bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=200)))
    C.link(fl, col)
    C.assign(fl, mats["floor"])
    pole = C.cylinder_mesh("pole", r=1, depth=1, seg=10)

    def beam(a, b, r=0.05):
        a, b = Vector(a), Vector(b)
        o = C.place(pole, (a + b) / 2, b - a, scale=(r, r, (b - a).length), collection=col)
        o.active_material = mats["scaffold"]

    # scaffolding towers receding into the white
    for row in range(7):
        y = 8 + row * 9
        for side in (-1, 1):
            for colx in range(3):
                x = side * (7 + colx * 6 + rnd.uniform(-1, 1))
                h = rnd.uniform(10, 24)
                for dx in (0, 2.2):
                    for dy in (0, 2.2):
                        beam((x + dx, y + dy, 0), (x + dx, y + dy, h))
                for z in range(0, int(h), 3):
                    beam((x, y, z), (x + 2.2, y, z), 0.03)
                    beam((x, y + 2.2, z), (x + 2.2, y + 2.2, z), 0.03)
                    beam((x, y, z), (x + 2.2, y + 2.2, z + 3), 0.025)
    # hanging cables from the unseen ceiling, a few low loops
    for i in range(90):
        a = Vector((rnd.uniform(-30, 30), rnd.uniform(-5, 70), CEILING))
        if abs(a.x) < 4 and a.y < 4:
            continue
        if rnd.random() < 0.55:
            b = a + Vector((rnd.uniform(-6, 6), rnd.uniform(-6, 6), 0))
            pts = C.catenary(a, b, rnd.uniform(6, 24), n=40)
        else:
            pts = C.catenary(a, a + Vector((0, 0, -rnd.uniform(10, 28))), 0, n=12)
        if min(p.z for p in pts) < 0.5:
            continue
        o = C.curve_object(f"cable_{i}", pts, bevel=rnd.uniform(0.015, 0.04), resolution=2, collection=col)
        o.data.materials.append(mats["cable"])


def build_suspension(col, mats, anchors):
    for i, p in enumerate(anchors):
        top = Vector((p.x * 1.6, p.y + 1.5, CEILING))
        o = C.curve_object(f"susp_{i}", [p, top], bevel=0.006, collection=col)
        o.data.materials.append(mats["steel"])


def build_lights(col):
    sky = C.area_light("sky", POS + Vector((0, -2, 12)), POS, size=14, energy=14000, color=(1, 1, 1), collection=col)
    key = C.area_light("key", POS + Vector((-6, -7, 3)), POS, size=4, energy=6500, color=(1.0, 0.98, 0.96), collection=col)
    for o in (sky, key):
        o.visible_volume_scatter = False  # light the seraph, not the air in front of it
    rim = C.area_light("rim_red", POS + Vector((3.5, 6, 1.5)), POS, size=2, energy=2500, color=(1, 0.08, 0.1), collection=col)
    rim.visible_volume_scatter = False
    C.softbox("sb_top", POS + Vector((0, -5, 6)), POS, 10, 1.2, strength=6, collection=col)
    C.softbox("sb_side", POS + Vector((-6, -3, 0)), POS, 0.8, 8, strength=5, collection=col)
    C.softbox("sb_dark", POS + Vector((0, -7, -1.5)), POS, 12, 2.5, strength=0.0, color=(0, 0, 0, 1), collection=col)


# ------------------------------------------------------------------ shots
WIDE = dict(loc=(0.0, -21.0, 3.0), target=(0.0, 0.0, 8.9), lens=32, fstop=8.0)
CLOSE = dict(loc=(1.2, -8.2, 9.6), target=(0.0, 0.0, 9.1), lens=55, fstop=2.4)
EYE = dict(loc=None, target=None, lens=120, fstop=1.4)


def main():
    a = C.parse_args(SHOTS)
    C.reset()
    C.setup_render(a.quality)
    dev = C.setup_device(a.device)
    # white void: a bright world and a pale fog that swallows the distance
    C.world_split(camera_color=(1.6, 1.6, 1.56, 1), density=0.011, anisotropy=0.25, fog_color=(0.95, 0.95, 0.93, 1), fog_glow=0.004)
    bpy.context.scene.view_settings.exposure = 0.6
    mats = materials()
    col_s = C.new_collection("Seraph")
    col_g = C.new_collection("Gallery")
    root = bpy.data.objects.new("SERAPH_ROOT", None)
    C.link(root, col_s)
    parts = []
    build_body(col_s, mats, parts)
    halo = build_halo(col_s, mats, parts)
    eyes = build_wings(col_s, mats, parts, WIDE["loc"])
    for o in parts:
        if o.parent is None:
            o.parent = root
    root.location = POS
    bpy.context.view_layer.update()

    # suspension wires to the halo and the wing joints
    anchors = [Vector(halo.matrix_world.translation) + Vector((x, 0, 0)) for x in (-0.7, 0.7)]
    anchors += [e.matrix_world.translation.copy() + Vector((0, 0, 0.1)) for e in eyes[::2]]
    build_suspension(col_s, mats, anchors)
    build_gallery(col_g, mats)
    build_lights(col_g)

    cam = C.camera(lens=32)
    front = POS + Vector((0, -0.3, 0.45))
    shots = SHOTS if a.shot == "all" else [a.shot]

    C.frame_camera(cam, WIDE["loc"], WIDE["target"], lens=WIDE["lens"], fstop=WIDE["fstop"], focus=front)
    aim_eyes(eyes, cam.location)
    C.save_blend(os.path.join(a.out, "seraph.blend"))

    for s in shots:
        if s == "flyin":
            aim_eyes(eyes, CLOSE["loc"])  # by the end of the move, every eye is on you
            C.keyframe_flight(
                cam,
                keys=[WIDE["loc"], (-2.5, -18.0, 5.0), (-1.0, -10.0, 8.0), CLOSE["loc"]],
                frames=FLY_FRAMES,
                target_fn=lambda t: Vector(WIDE["target"]).lerp(Vector(CLOSE["target"]), C.ease_in_out(t)),
                lens_fn=lambda t: WIDE["lens"] + (CLOSE["lens"] - WIDE["lens"]) * t * t,
                fstop_fn=lambda t: WIDE["fstop"] + (CLOSE["fstop"] - WIDE["fstop"]) * t,
                focus_fn=lambda t: front,
            )
            sc = bpy.context.scene
            sc.render.use_motion_blur = True
            f0, f1 = C.parse_frames(a.frames, FLY_FRAMES)
            sc.frame_start, sc.frame_end = f0, f1
            C.render_animation(os.path.join(a.out, f"seraph_flyin_{a.quality}" + ("" if a.no_video else ".mp4")),
                               video=not a.no_video)
            cam.animation_data_clear()
            cam.data.animation_data_clear()
            sc.render.use_motion_blur = False
        elif s == "eye":
            target = eyes[2].matrix_world.translation.copy()  # middle pair, right wing
            loc = target + Vector((-0.25, -1.5, 0.12))
            C.frame_camera(cam, loc, target, lens=EYE["lens"], fstop=EYE["fstop"], focus=target)
            aim_eyes(eyes, loc)
            C.render_still(os.path.join(a.out, f"seraph_eye_{a.quality}.png"))
        else:
            sh = WIDE if s == "wide" else CLOSE
            C.frame_camera(cam, sh["loc"], sh["target"], lens=sh["lens"], fstop=sh["fstop"], focus=front)
            aim_eyes(eyes, sh["loc"])
            C.render_still(os.path.join(a.out, f"seraph_{s}_{a.quality}.png"))
    print(f"[seraph] done on {dev}")


if __name__ == "__main__":
    main()
