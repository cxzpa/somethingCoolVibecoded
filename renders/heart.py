"""THE METALHEART — a chrome sacred heart hanging in a cathedral of cables.

Run (from the repo root):
    blender -b -P renders/heart.py -- --shot all --quality preview
Shots:
    wide   establishing shot, the heart tiny in the fog
    close  hero close-up of the sockets (the hand-off frame to the live web scene)
    macro  extreme close-up, one socket and thorns, very shallow focus
    flyin  the camera move from wide to close (MP4, 6 s @ 24 fps)
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import bpy  # noqa: E402
from mathutils import Vector, Matrix  # noqa: E402

import common as C  # noqa: E402

SHOTS = ["wide", "close", "macro", "flyin"]
HEART_POS = Vector((0.0, 0.0, 9.0))
CEILING = 27.0
FLY_FRAMES = 144


# ------------------------------------------------------------------ heart body
def build_heart_mesh():
    mb = bpy.data.metaballs.new("heart_mb")
    mb.resolution = 0.06
    mb.render_resolution = 0.025
    mb.threshold = 0.6

    def el(kind, co, r, sx=1.0, sy=1.0, sz=1.0):
        e = mb.elements.new()
        e.type = kind
        e.co = co
        e.radius = r
        if kind == "ELLIPSOID":
            e.size_x, e.size_y, e.size_z = sx, sy, sz

    el("ELLIPSOID", (-0.5, 0.0, 0.32), 1.0, 0.82, 0.62, 0.78)
    el("ELLIPSOID", (0.5, 0.0, 0.3), 1.0, 0.8, 0.6, 0.76)
    el("ELLIPSOID", (0.0, 0.0, -0.18), 1.0, 0.9, 0.58, 0.75)
    el("BALL", (0.0, 0.0, -0.72), 0.62)
    el("BALL", (0.02, 0.0, -1.02), 0.42)
    el("BALL", (0.04, 0.0, -1.26), 0.24)
    # vessel stubs on top, like a sacred heart's flame
    el("BALL", (0.1, 0.06, 0.98), 0.4)
    el("BALL", (-0.32, -0.06, 0.92), 0.3)

    tmp = bpy.data.objects.new("heart_mb", mb)
    C.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    me.name = "heart"
    me.shade_smooth()
    heart = bpy.data.objects.new("heart", me)
    C.link(heart)

    # hammered-metal displacement, baked into the mesh so ray casts see it
    tex = bpy.data.textures.new("hammer", "VORONOI")
    tex.noise_scale = 0.09
    mod = heart.modifiers.new("hammer", "DISPLACE")
    mod.texture = tex
    mod.strength = -0.018
    mod.mid_level = 0.5
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(heart.evaluated_get(dg))
    heart.modifiers.clear()
    old = heart.data
    heart.data = me2
    bpy.data.meshes.remove(old)
    me2.shade_smooth()
    return heart


def surf(obj, origin, direction):
    """Ray-cast onto obj (object space). Returns (point, normal) or None."""
    hit, loc, nor, _ = obj.ray_cast(Vector(origin), Vector(direction).normalized())
    return (loc, nor) if hit else None


def build_heart(col, mats):
    root = bpy.data.objects.new("HEART_ROOT", None)
    C.link(root, col)
    heart = build_heart_mesh()
    C.assign(heart, mats["heart"])
    rnd = random.Random(11)
    parts = [heart]

    # --- sockets: four on the front plate
    bezel = C.cylinder_mesh("socket_bezel", r=0.11, depth=0.06, seg=40)
    hole = C.cylinder_mesh("socket_hole", r=0.075, depth=0.065, seg=32)
    glow = C.cylinder_mesh("socket_glow", r=0.045, depth=0.068, seg=24)
    sockets = []
    for x, z in [(-0.5, 0.36), (0.5, 0.34), (-0.3, -0.28), (0.3, -0.3)]:
        s = surf(heart, (x, -5, z), (0, 1, 0))
        if not s:
            continue
        p, n = s
        for me, mat, inset in [(bezel, mats["chrome"], 0.0), (hole, mats["black"], 0.004), (glow, mats["glow"], 0.006)]:
            o = C.place(me, p + n * inset, n, collection=col)
            o.active_material = mat
            parts.append(o)
        sockets.append((p.copy(), n.copy()))

    # --- rivets: the centre seam and an oval plate around the sockets
    rivet = C.sphere_mesh("rivet", r=0.026, seg=12, rings=6)
    for i in range(34):
        z = -1.15 + i * 0.062
        for side in (-5, 5):
            s = surf(heart, (0.0, side, z), (0, -side, 0))
            if s:
                o = C.place(rivet, s[0], s[1], scale=(1, 1, 0.55), collection=col)
                o.active_material = mats["chrome"]
                parts.append(o)
    for i in range(46):
        a = i / 46 * math.tau
        x, z = math.cos(a) * 0.82, 0.03 + math.sin(a) * 0.62
        s = surf(heart, (x, -5, z), (0, 1, 0))
        if s:
            o = C.place(rivet, s[0], s[1], scale=(0.8, 0.8, 0.45), collection=col)
            o.active_material = mats["chrome"]
            parts.append(o)

    # --- spikes: chrome-heart jewelry thorns, mostly on the back and shoulders
    spike = C.cone_mesh("spike", r=1.0, depth=1.0, segments=12)
    for i in range(54):
        th = rnd.uniform(0, math.tau)
        ph = rnd.uniform(-0.9, 1.1)
        d = Vector((math.cos(th) * math.cos(ph), math.sin(th) * math.cos(ph), math.sin(ph)))
        if d.y < -0.35 and abs(d.x) < 0.6 and d.z < 0.6:
            continue  # keep the front plate clean
        s = surf(heart, d * 5, -d)
        if not s:
            continue
        p, n = s
        L = rnd.uniform(0.14, 0.42)
        o = C.place(spike, p - n * 0.02, (n + Vector((rnd.uniform(-.25, .25), rnd.uniform(-.25, .25), rnd.uniform(0, .3)))).normalized(),
                    scale=(rnd.uniform(0.03, 0.055), rnd.uniform(0.03, 0.055), L), collection=col)
        o.active_material = mats["blood"] if rnd.random() < 0.14 else (mats["chrome"] if rnd.random() < 0.6 else mats["steel"])
        parts.append(o)

    # --- crown of thorns wrapped around the heart
    thorn = C.cone_mesh("thorn", r=0.018, depth=0.16, segments=8)
    ring = C.barbed_ring("thorn_crown", radius=1.12, strand_r=0.04, wire=0.011, collection=col,
                         mat=mats["steel"], thorn_mesh=thorn, thorns=64, thorn_mat=mats["steel"], seed=5)
    ring.rotation_euler = (math.radians(74), math.radians(9), math.radians(-6))
    ring.location = (0, 0, 0.05)
    ring.scale = (1.0, 0.86, 1.0)
    parts.append(ring)
    ring2 = C.barbed_ring("thorn_crown_b", radius=1.2, strand_r=0.03, wire=0.008, collection=col,
                          mat=mats["chrome"], thorn_mesh=thorn, thorns=40, thorn_mat=mats["chrome"], seed=9)
    ring2.rotation_euler = (math.radians(98), math.radians(-14), math.radians(20))
    ring2.location = (0, 0, -0.1)
    ring2.scale = (0.95, 0.8, 1.0)
    parts.append(ring2)

    # --- vessels: ribbed hoses rising from the top into the dark (the heart hangs on them)
    vessels = []
    for k, (x, y, r) in enumerate([(-0.34, -0.05, 0.12), (0.12, 0.08, 0.15), (0.45, -0.02, 0.1), (-0.05, 0.25, 0.09)]):
        s = surf(heart, (x, y, 5), (0, 0, -1))
        if not s:
            continue
        p = s[0]
        top = Vector((x * 6 + rnd.uniform(-2, 2), y * 6 + rnd.uniform(0, 4), CEILING - HEART_POS.z))
        pts = []
        n = 220
        for i in range(n + 1):
            t = i / n
            q = p.lerp(top, t)
            q.x += math.sin(t * math.pi * 1.4 + k) * 0.9 * t
            q.y += math.cos(t * math.pi * 1.1 + k) * 0.6 * t
            pts.append(q)
        o = C.curve_object(f"vessel_{k}", pts, bevel=r, resolution=4, collection=col,
                           taper=lambda t: (1.0 + 0.11 * math.sin(t * 900)) * (1.25 - 0.25 * min(1, t * 6)))
        o.data.materials.append(mats["hose"] if k % 2 else mats["chrome_dark"])
        parts.append(o)
        vessels.append(o)

    for o in parts:
        o.parent = root
    root.location = HEART_POS
    root.rotation_euler = (math.radians(-6), math.radians(9), math.radians(-4))
    return root, heart, sockets


# ------------------------------------------------------------------ the cathedral of cables
def corridor_clear(points, margin=1.6):
    """Keep the camera's flight path (along -Y towards the heart) free of cables."""
    for p in points:
        if p.y < -1.0 and abs(p.x) < margin + 0.8 and 2.5 < p.z < 13.0:
            return False
        if (p - HEART_POS).length < 2.1:
            return False
    return True


def build_cables(col, mats):
    rnd = random.Random(23)
    plug = C.cylinder_mesh("plug", r=0.05, depth=0.18, seg=16)
    count = 0
    for i in range(240):
        kind = rnd.random()
        a = rnd.uniform(0, math.tau)
        rad = rnd.uniform(2.5, 22)
        A = Vector((math.cos(a) * rad, math.sin(a) * rad + 4, CEILING + rnd.uniform(-1, 2)))
        if kind < 0.62:
            b = a + rnd.uniform(-0.5, 0.5)
            r2 = rad + rnd.uniform(-5, 5)
            B = Vector((math.cos(b) * r2, math.sin(b) * r2 + 4, CEILING + rnd.uniform(-1, 2)))
            pts = C.catenary(A, B, sag=rnd.uniform(5, 22), n=48, wobble=rnd.uniform(0, 0.6))
        else:
            end = A + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), -rnd.uniform(8, 25)))
            pts = C.catenary(A, end, sag=rnd.uniform(0, 1.5), n=30)
        if min(p.z for p in pts) < 0.3 or not corridor_clear(pts):
            continue
        o = C.curve_object(f"cable_{i}", pts, bevel=rnd.uniform(0.018, 0.06), resolution=2, collection=col)
        o.data.materials.append(mats["cable_red"] if rnd.random() < 0.07 else mats["cable"])
        if kind >= 0.62:
            p = C.place(plug, pts[-1], pts[-1] - pts[-2], collection=col)
            p.active_material = mats["chrome"]
            if rnd.random() < 0.18:  # a few plugs glow like warning lamps
                C.point_light(f"lamp_{i}", pts[-1] + Vector((0, 0, -0.12)), energy=rnd.uniform(4, 14),
                              color=(1, 0.06, 0.06), radius=0.03, collection=col)
        count += 1
    print(f"[heart] cables: {count}")


def build_floor(col):
    me = C.mesh_from_bmesh("floor", lambda bm: __import__("bmesh").ops.create_grid(bm, x_segments=1, y_segments=1, size=120))
    o = bpy.data.objects.new("floor", me)
    C.link(o, col)
    m, nt, p = C._principled("wet_floor")
    p.inputs["Base Color"].default_value = (0.006, 0.006, 0.007, 1)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.35
    noise.inputs["Detail"].default_value = 8
    rr = nt.nodes.new("ShaderNodeMapRange")
    rr.inputs["From Min"].default_value = 0.45
    rr.inputs["From Max"].default_value = 0.6
    rr.inputs["To Min"].default_value = 0.03
    rr.inputs["To Max"].default_value = 0.5
    nt.links.new(noise.outputs["Fac"], rr.inputs["Value"])
    nt.links.new(rr.outputs["Result"], p.inputs["Roughness"])
    C.assign(o, m)


def build_lights(col):
    C.spot_light("god_ray", (1.5, 3.5, CEILING - 1), HEART_POS, energy=170000, angle=6.5, blend=0.3,
                 color=(0.9, 0.94, 1.0), radius=0.25, collection=col)
    C.area_light("under_red", (0.2, -1.0, 0.6), HEART_POS, size=2.5, energy=2600, color=(1, 0.05, 0.06), collection=col)
    rim = C.area_light("rim_ice", (6.0, 7.0, 13.5), HEART_POS, size=2.0, energy=6000, color=(0.55, 0.88, 0.95), collection=col)
    fill = C.area_light("fill", (-3, -6, 10), HEART_POS, size=3, energy=260, color=(0.8, 0.82, 0.9), collection=col)
    for o in (rim, fill):
        o.visible_volume_scatter = False  # light the metal, not the fog
    # reflection-only cards that draw the highlights across the chrome
    C.softbox("sb_top", HEART_POS + Vector((0, -3.5, 4.5)), HEART_POS, 7, 1.0, strength=10, collection=col)
    C.softbox("sb_left", HEART_POS + Vector((-4.0, -2.5, 0.5)), HEART_POS, 0.7, 6, strength=7, collection=col)
    C.softbox("sb_right", HEART_POS + Vector((4.2, -1.0, 1.0)), HEART_POS, 0.5, 4, strength=5, collection=col)
    C.softbox("sb_red", HEART_POS + Vector((0.0, -3.0, -3.5)), HEART_POS, 5, 0.6, strength=9,
              color=(1, 0.06, 0.07, 1), collection=col)


def materials():
    return {
        "heart": C.mat_metal("heart_chrome", rough=0.07, bump=0.06, bump_scale=40),
        "chrome": C.mat_metal("chrome", rough=0.05),
        "chrome_dark": C.mat_metal("chrome_dark", color=(0.5, 0.5, 0.53, 1), rough=0.12, aniso=0.6),
        "steel": C.mat_metal("black_steel", color=(0.06, 0.06, 0.065, 1), rough=0.3),
        "blood": C.mat_lacquer("blood_enamel"),
        "black": C.mat_rubber("socket_black", rough=0.8, coat=0.0),
        "glow": C.mat_emit("socket_glow", strength=30),
        "hose": C.mat_rubber("hose", color=(0.02, 0.02, 0.022, 1), rough=0.3, coat=0.8),
        "cable": C.mat_rubber("cable"),
        "cable_red": C.mat_lacquer("cable_red", color=(0.35, 0.003, 0.008, 1), rough=0.35, coat=0.6),
    }


# ------------------------------------------------------------------ shots
WIDE = dict(loc=(0.0, -23.0, 4.6), target=(0.0, 0.0, 10.6), lens=30, fstop=5.6)
CLOSE = dict(loc=(1.4, -6.8, 8.9), target=(0.05, 0.0, 9.15), lens=55, fstop=2.4)
MACRO = dict(loc=(-0.95, -1.75, 9.7), target=(-0.48, -0.55, 9.34), lens=105, fstop=1.4)


def set_shot(cam, s, focus):
    C.frame_camera(cam, s["loc"], s["target"], lens=s["lens"], fstop=s["fstop"], focus=focus)


def main():
    a = C.parse_args(SHOTS)
    C.reset()
    C.setup_render(a.quality)
    dev = C.setup_device(a.device)
    C.world_fog(color=(0.0, 0.0, 0.0, 1), horizon=(0.012, 0.012, 0.016, 1), density=0.011, anisotropy=0.6,
                fog_color=(0.7, 0.72, 0.78, 1))
    mats = materials()
    col_h = C.new_collection("Heart")
    col_c = C.new_collection("Cables")
    col_e = C.new_collection("Environment")
    root, heart, sockets = build_heart(col_h, mats)
    build_cables(col_c, mats)
    build_floor(col_e)
    build_lights(col_e)
    cam = C.camera(lens=30)
    bpy.context.view_layer.update()

    front_focus = HEART_POS + Vector((0, -0.7, 0.05))
    macro_focus = Vector(MACRO["target"])
    shots = SHOTS if a.shot == "all" else [a.shot]

    # always save the scene so it can be opened and explored in Blender
    set_shot(cam, WIDE, front_focus)
    C.save_blend(os.path.join(a.out, "heart.blend"))

    for s in shots:
        if s == "flyin":
            C.keyframe_flight(
                cam,
                keys=[WIDE["loc"], (2.0, -15.0, 6.8), (1.6, -9.5, 8.6), CLOSE["loc"]],
                frames=FLY_FRAMES,
                target_fn=lambda t: Vector(WIDE["target"]).lerp(Vector(CLOSE["target"]), C.ease_in_out(t)),
                lens_fn=lambda t: WIDE["lens"] + (CLOSE["lens"] - WIDE["lens"]) * t * t,
                fstop_fn=lambda t: WIDE["fstop"] + (CLOSE["fstop"] - WIDE["fstop"]) * t,
                focus_fn=lambda t: front_focus,
            )
            sc = bpy.context.scene
            sc.render.use_motion_blur = True
            sc.render.motion_blur_shutter = 0.5
            f0, f1 = C.parse_frames(a.frames, FLY_FRAMES)
            sc.frame_start, sc.frame_end = f0, f1
            C.render_animation(os.path.join(a.out, f"heart_flyin_{a.quality}" + ("" if a.no_video else ".mp4")),
                               video=not a.no_video)
            cam.animation_data_clear()
            cam.data.animation_data_clear()
            sc.render.use_motion_blur = False
        else:
            set_shot(cam, {"wide": WIDE, "close": CLOSE, "macro": MACRO}[s], macro_focus if s == "macro" else front_focus)
            C.render_still(os.path.join(a.out, f"heart_{s}_{a.quality}.png"))
    print(f"[heart] done on {dev}")


if __name__ == "__main__":
    main()
