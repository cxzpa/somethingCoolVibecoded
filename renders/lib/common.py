"""Shared toolkit for the Angel Line render scenes (Blender 5.x, Cycles).

Everything is procedural: no external assets are needed, so a scene script
runs the same on any machine that has Blender installed.
"""
import argparse
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector, Matrix

# palette, linear-ish values tuned for AgX
INK = (0.004, 0.004, 0.005, 1)
PAPER = (0.84, 0.83, 0.80, 1)
CHROME = (0.92, 0.93, 0.95, 1)
BLOOD = (0.55, 0.004, 0.012, 1)
BLOOD_GLOW = (1.0, 0.035, 0.05, 1)
ICE = (0.45, 0.85, 0.9, 1)

QUALITY = {
    # name: (width, height, samples, volume_step_rate, max_bounces)
    "test": (480, 270, 8, 8.0, 4),
    "preview": (960, 540, 48, 3.0, 6),
    "final": (1920, 1080, 384, 1.0, 10),
    "poster": (2560, 1440, 1024, 0.6, 12),
}


# ------------------------------------------------------------------ args
def parse_args(shots):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--shot", default="all", choices=["all", *shots])
    p.add_argument("--quality", default="preview", choices=list(QUALITY))
    p.add_argument("--device", default="auto", help="auto | cpu | optix | cuda | hip | metal")
    p.add_argument("--out", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "out"))
    p.add_argument("--frames", default=None, help="limit the fly-in, e.g. 1-48 or 60")
    p.add_argument("--no-video", action="store_true", help="write PNG frames instead of an MP4")
    p.add_argument("--seed", type=int, default=7)
    a = p.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    random.seed(a.seed)
    return a


# ------------------------------------------------------------------ scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    return scene


def setup_device(pref="auto"):
    scene = bpy.context.scene
    if pref == "cpu":
        scene.cycles.device = "CPU"
        return "CPU"
    order = ["OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"] if pref == "auto" else [pref.upper()]
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for t in order:
            try:
                prefs.compute_device_type = t
            except (TypeError, ValueError):
                continue
            (getattr(prefs, "refresh_devices", None) or prefs.get_devices)()
            devs = [d for d in prefs.devices if d.type == t]
            if devs:
                for d in prefs.devices:
                    d.use = d.type == t
                scene.cycles.device = "GPU"
                print(f"[render] device: {t} ({', '.join(d.name for d in devs)})")
                return t
    except Exception as e:  # noqa: BLE001
        print("[render] GPU setup failed:", e)
    scene.cycles.device = "CPU"
    print("[render] device: CPU")
    return "CPU"


def setup_render(quality, fps=24):
    scene = bpy.context.scene
    w, h, spp, vstep, bounces = QUALITY[quality]
    r = scene.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.fps = fps
    c = scene.cycles
    c.samples = spp
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02 if quality in ("test", "preview") else 0.008
    c.use_denoising = True
    try:
        c.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    c.max_bounces = bounces
    c.glossy_bounces = bounces
    c.transmission_bounces = bounces
    c.volume_bounces = 1
    c.volume_step_rate = vstep
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.blur_glossy = 0.5
    r.film_transparent = False
    vs = scene.view_settings
    for view in ("AgX", "Filmic"):
        try:
            vs.view_transform = view
            break
        except TypeError:
            continue
    for look in ("AgX - Punchy", "Punchy", "AgX - High Contrast", "High Contrast"):
        try:
            vs.look = look
            break
        except TypeError:
            continue
    vs.exposure = 0.0
    return scene


def set_output_image(path):
    im = bpy.context.scene.render.image_settings
    if hasattr(im, "media_type"):
        im.media_type = "IMAGE"
    im.file_format = "PNG"
    im.color_mode = "RGB"
    im.color_depth = "8"
    bpy.context.scene.render.filepath = path


def set_output_video(path):
    scene = bpy.context.scene
    im = scene.render.image_settings
    if hasattr(im, "media_type"):
        im.media_type = "VIDEO"
    im.file_format = "FFMPEG"
    ff = scene.render.ffmpeg
    ff.format = "MPEG4"
    ff.codec = "H264"
    ff.constant_rate_factor = "HIGH"
    ff.ffmpeg_preset = "GOOD"
    ff.gopsize = 12
    ff.audio_codec = "NONE"
    scene.render.filepath = path


def render_still(path):
    set_output_image(path)
    bpy.ops.render.render(write_still=True)
    print("[render] wrote", path)


def render_animation(path, video=True):
    if video:
        set_output_video(path)
    else:
        set_output_image(path + "_####")
    bpy.ops.render.render(animation=True)
    print("[render] wrote", path)


def save_blend(path):
    bpy.ops.wm.save_as_mainfile(filepath=path, check_existing=False)
    print("[render] saved", path)


# ------------------------------------------------------------------ world
def world_fog(color=(0.0, 0.0, 0.0, 1), density=0.03, anisotropy=0.35, fog_color=(0.8, 0.8, 0.85, 1),
              horizon=None, strength=1.0):
    """World background (seen by reflections) plus a global volumetric fog."""
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    if horizon:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = color
        ramp.color_ramp.elements[1].position = 0.75
        ramp.color_ramp.elements[1].color = horizon
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    else:
        bg.inputs["Color"].default_value = color
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    if density > 0:
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Density"].default_value = density
        vol.inputs["Anisotropy"].default_value = anisotropy
        vol.inputs["Color"].default_value = fog_color
        nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return w


# ------------------------------------------------------------------ materials
def _principled(name):
    m = bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes.get("Principled BSDF")
    return m, nt, p


def mat_metal(name, color=CHROME, rough=0.06, bump=0.0, bump_scale=60.0, aniso=0.0):
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = color
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = rough
    if aniso:
        p.inputs["Anisotropic"].default_value = aniso
    if bump > 0:
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = bump_scale
        tex.inputs["Detail"].default_value = 6
        vor = nt.nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = bump_scale * 0.18
        mix = nt.nodes.new("ShaderNodeMath")
        mix.operation = "ADD"
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump
        b.inputs["Distance"].default_value = 0.02
        nt.links.new(tex.outputs["Fac"], mix.inputs[0])
        nt.links.new(vor.outputs["Distance"], mix.inputs[1])
        nt.links.new(mix.outputs[0], b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
        # roughness breakup so highlights aren't perfectly clean
        rr = nt.nodes.new("ShaderNodeMapRange")
        rr.inputs["To Min"].default_value = rough * 0.6
        rr.inputs["To Max"].default_value = rough * 1.8
        nt.links.new(tex.outputs["Fac"], rr.inputs["Value"])
        nt.links.new(rr.outputs["Result"], p.inputs["Roughness"])
    return m


def mat_lacquer(name, color=BLOOD, rough=0.25, coat=1.0):
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = color
    p.inputs["Metallic"].default_value = 0.0
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.03
    return m


def mat_emit(name, color=BLOOD_GLOW, strength=25.0):
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = (0, 0, 0, 1)
    p.inputs["Emission Color"].default_value = color
    p.inputs["Emission Strength"].default_value = strength
    return m


def mat_rubber(name, color=(0.012, 0.012, 0.014, 1), rough=0.42, coat=0.4):
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.2
    return m


def mat_eye(name, iris=BLOOD):
    """Wet eyeball: white sclera, red iris ring, black pupil, glossy coat. Faces local +Y."""
    m, nt, p = _principled(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    # distance from the forward axis
    ang = nt.nodes.new("ShaderNodeVectorMath")
    ang.operation = "LENGTH"
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(sep.outputs["X"], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    nt.links.new(comb.outputs[0], ang.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.0, 0.0, 0.0, 1)
    els[1].position, els[1].color = 1.0, (0.85, 0.83, 0.8, 1)
    e = els.new(0.16); e.color = (0.0, 0.0, 0.0, 1)
    e = els.new(0.19); e.color = iris
    e = els.new(0.42); e.color = (iris[0] * 0.25, iris[1], iris[2], 1)
    e = els.new(0.45); e.color = (0.8, 0.78, 0.74, 1)
    ramp.color_ramp.interpolation = "LINEAR"
    nt.links.new(ang.outputs["Value"], ramp.inputs["Fac"])
    # only the front hemisphere gets the iris
    front = nt.nodes.new("ShaderNodeMath"); front.operation = "GREATER_THAN"
    front.inputs[1].default_value = 0.0
    nt.links.new(sep.outputs["Y"], front.inputs[0])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (0.85, 0.83, 0.8, 1)
    nt.links.new(front.outputs[0], mix.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.35
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.0
    p.inputs["Subsurface Weight"].default_value = 0.15
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ------------------------------------------------------------------ geometry
def link(obj, collection=None):
    (collection or bpy.context.scene.collection).objects.link(obj)
    return obj


def new_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def mesh_from_bmesh(name, build):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(me)
    bm.free()
    return me


def cone_mesh(name="cone", r=1.0, depth=1.0, segments=10):
    """Cone along +Z with its base at z=0 and tip at z=depth."""
    def b(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=r, radius2=0.0, depth=depth)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, depth / 2))
    return mesh_from_bmesh(name, b)


def sphere_mesh(name="sphere", r=1.0, seg=24, rings=12):
    def b(bm):
        bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
        for f in bm.faces:
            f.smooth = True
    return mesh_from_bmesh(name, b)


def cylinder_mesh(name="cyl", r=1.0, depth=1.0, seg=24):
    def b(bm):
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
        for f in bm.faces:
            f.smooth = True
    return mesh_from_bmesh(name, b)


def blade_mesh(name="blade", length=1.0, width=0.08, thick=0.006):
    """A knife-like feather along +Z: sharp tip, asymmetric belly, slight thickness."""
    def b(bm):
        prof = [(0, 0), (-0.35, 0.22), (-0.55, 0.5), (-0.32, 0.82), (0, 1.0), (0.18, 0.75), (0.28, 0.4), (0.2, 0.12)]
        top, bot = [], []
        for x, z in prof:
            top.append(bm.verts.new((x * width, thick, z * length)))
            bot.append(bm.verts.new((x * width, -thick, z * length)))
        bm.faces.new(top)
        bm.faces.new(list(reversed(bot)))
        n = len(prof)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((top[i], top[j], bot[j], bot[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bmesh(name, b)


def place(mesh, loc, normal=None, scale=1.0, name=None, collection=None, roll=0.0):
    """Instance a mesh (shared data) at loc, with local +Z pointing along normal."""
    o = bpy.data.objects.new(name or mesh.name, mesh)
    o.location = loc
    if normal is not None:
        q = Vector(normal).normalized().to_track_quat("Z", "Y")
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = q @ Matrix.Rotation(roll, 4, "Z").to_quaternion()
    o.scale = (scale, scale, scale) if isinstance(scale, (int, float)) else scale
    link(o, collection)
    return o


def curve_object(name, points, bevel=0.03, resolution=3, collection=None, closed=False, taper=None):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = bevel
    cu.bevel_resolution = resolution
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (p[0], p[1], p[2], 1)
        if taper:
            sp.points[i].radius = taper(i / max(1, len(points) - 1))
    sp.use_cyclic_u = closed
    o = bpy.data.objects.new(name, cu)
    link(o, collection)
    return o


def catenary(a, b, sag, n=40, wobble=0.0):
    a, b = Vector(a), Vector(b)
    pts = []
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.z -= sag * 4 * t * (1 - t)
        if wobble:
            p.x += math.sin(t * math.pi * 3 + a.x) * wobble * t * (1 - t)
        pts.append(p)
    return pts


def barbed_ring(name, radius, twist_turns=46, strand_r=0.035, wire=0.008, collection=None, mat=None, thorn_mesh=None,
                thorns=56, thorn_mat=None, seed=3):
    """Two twisted strands around a circle (XY plane, centred at origin), plus thorns. Returns parent empty."""
    rnd = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    link(root, collection)
    for k in range(2):
        pts = []
        n = 1400
        for i in range(n):
            a = i / n * math.tau
            ph = a * twist_turns + k * math.pi
            rr = radius + math.cos(ph) * strand_r
            pts.append((math.cos(a) * rr, math.sin(a) * rr, math.sin(ph) * strand_r))
        o = curve_object(f"{name}_strand{k}", pts, bevel=wire, resolution=2, collection=collection, closed=True)
        o.parent = root
        if mat:
            o.data.materials.append(mat)
    if thorn_mesh:
        for i in range(thorns):
            a = i / thorns * math.tau + rnd.uniform(-0.04, 0.04)
            base = Vector((math.cos(a) * radius, math.sin(a) * radius, 0))
            out = Vector((math.cos(a), math.sin(a), 0))
            d = (out * rnd.uniform(0.2, 1.0) + Vector((0, 0, rnd.uniform(-1, 1))) + Vector((-math.sin(a), math.cos(a), 0)) * rnd.uniform(-0.6, 0.6)).normalized()
            t = place(thorn_mesh, base, d, scale=rnd.uniform(0.6, 1.4), collection=collection)
            t.parent = root
            if thorn_mat:
                t.active_material = thorn_mat
    return root


# ------------------------------------------------------------------ lights
def area_light(name, loc, target, size=2.0, energy=500.0, color=(1, 1, 1), shape="RECTANGLE", size_y=None,
               visible_glossy=True, collection=None):
    L = bpy.data.lights.new(name, "AREA")
    L.shape = shape
    L.size = size
    if size_y:
        L.size_y = size_y
    L.energy = energy
    L.color = color
    o = bpy.data.objects.new(name, L)
    o.location = loc
    look_at(o, target)
    o.visible_glossy = visible_glossy
    link(o, collection)
    return o


def spot_light(name, loc, target, energy=2000.0, angle=20.0, blend=0.3, color=(1, 1, 1), radius=0.05, collection=None):
    L = bpy.data.lights.new(name, "SPOT")
    L.energy = energy
    L.spot_size = math.radians(angle)
    L.spot_blend = blend
    L.color = color
    L.shadow_soft_size = radius
    o = bpy.data.objects.new(name, L)
    o.location = loc
    look_at(o, target)
    link(o, collection)
    return o


def point_light(name, loc, energy=100.0, color=(1, 1, 1), radius=0.1, collection=None):
    L = bpy.data.lights.new(name, "POINT")
    L.energy = energy
    L.color = color
    L.shadow_soft_size = radius
    o = bpy.data.objects.new(name, L)
    o.location = loc
    link(o, collection)
    return o


def softbox(name, loc, target, w, h, strength=8.0, color=(1, 1, 1, 1), collection=None):
    """Emissive card seen only in reflections: the classic chrome-product trick."""
    me = mesh_from_bmesh(name, lambda bm: bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5))
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.scale = (w, h, 1)
    look_at(o, target, axis="-Z")
    o.visible_camera = False
    o.visible_shadow = False
    o.visible_diffuse = False
    o.visible_volume_scatter = False
    assign(o, mat_emit(name + "_m", color, strength))
    link(o, collection)
    return o


def look_at(obj, target, axis="-Z"):
    d = Vector(target) - Vector(obj.location)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = d.to_track_quat(axis, "Y")


# ------------------------------------------------------------------ camera
def camera(name="Camera", lens=35.0, sensor=36.0):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = sensor
    cd.clip_start = 0.05
    cd.clip_end = 500
    o = bpy.data.objects.new(name, cd)
    link(o)
    bpy.context.scene.camera = o
    return o


def frame_camera(cam, loc, target, lens=None, fstop=None, focus=None):
    cam.location = loc
    look_at(cam, target)
    if lens:
        cam.data.lens = lens
    if fstop:
        cam.data.dof.use_dof = True
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = (Vector(focus or target) - Vector(loc)).length


def ease_in_out(t):
    return 4 * t * t * t if t < 0.5 else 1 - pow(-2 * t + 2, 3) / 2


def keyframe_flight(cam, keys, frames, target_fn, lens_fn=None, fstop_fn=None, focus_fn=None):
    """keys: list of control points; camera moves along a Catmull-Rom spline through them with ease-in-out timing."""
    pts = [Vector(k) for k in keys]
    pts = [pts[0]] + pts + [pts[-1]]

    def cr(t):
        segs = len(pts) - 3
        x = min(segs - 1e-6, t * segs)
        i = int(x)
        u = x - i
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)

    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, frames
    cam.rotation_mode = "QUATERNION"
    for f in range(1, frames + 1):
        t = ease_in_out((f - 1) / (frames - 1))
        loc = cr(t)
        cam.location = loc
        look_at(cam, target_fn(t))
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        if lens_fn:
            cam.data.lens = lens_fn(t)
            cam.data.keyframe_insert("lens", frame=f)
        if fstop_fn:
            cam.data.dof.use_dof = True
            cam.data.dof.aperture_fstop = fstop_fn(t)
            cam.data.dof.keyframe_insert("aperture_fstop", frame=f)
        if focus_fn:
            cam.data.dof.focus_distance = (Vector(focus_fn(t)) - loc).length
            cam.data.dof.keyframe_insert("focus_distance", frame=f)


def parse_frames(spec, total):
    if not spec:
        return 1, total
    if "-" in spec:
        a, b = spec.split("-")
        return int(a), int(b)
    return int(spec), int(spec)


def world_split(camera_color, density=0.02, anisotropy=0.2, fog_color=(0.9, 0.9, 0.9, 1), stops=None, strength=1.0,
                fog_glow=0.0):
    """The camera sees a flat backdrop colour, but reflections and lighting see a studio gradient.

    stops: list of (position 0..1 from straight down to straight up, colour) for the studio.
    This is how chrome stays readable in a white void: it reflects dark floors and bright strips.
    """
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    # importance-sampling the world would bake it without ray context and light everything with the backdrop
    try:
        w.cycles.sampling_method = "NONE"
    except (AttributeError, TypeError):
        pass
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    remap = nt.nodes.new("ShaderNodeMapRange")
    remap.inputs["From Min"].default_value = -1.0
    remap.inputs["From Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], remap.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    stops = stops or [(0.0, (0.01, 0.01, 0.01, 1)), (0.49, (0.03, 0.03, 0.03, 1)), (0.52, (0.9, 0.9, 0.9, 1)),
                      (0.56, (0.08, 0.08, 0.09, 1)), (0.85, (0.12, 0.12, 0.13, 1)), (1.0, (0.7, 0.7, 0.7, 1))]
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0]
    els[1].position, els[1].color = stops[-1]
    for pos, colr in stops[1:-1]:
        e = els.new(pos)
        e.color = colr
    nt.links.new(remap.outputs["Result"], ramp.inputs["Fac"])
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["B"].default_value = camera_color
    # camera rays and fog-scatter rays see the backdrop; reflections and lighting see the studio
    either = nt.nodes.new("ShaderNodeMath")
    either.operation = "MAXIMUM"
    nt.links.new(lp.outputs["Is Camera Ray"], either.inputs[0])
    nt.links.new(lp.outputs["Is Volume Scatter Ray"], either.inputs[1])
    nt.links.new(either.outputs[0], mix.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["A"])
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    nt.links.new(mix.outputs["Result"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    if density > 0:
        vol = nt.nodes.new("ShaderNodeVolumePrincipled")
        vol.inputs["Density"].default_value = density
        vol.inputs["Anisotropy"].default_value = anisotropy
        vol.inputs["Color"].default_value = fog_color
        if fog_glow:
            # self-lit haze: distance always fades to the backdrop colour, whatever the lighting
            vol.inputs["Emission Color"].default_value = fog_color
            vol.inputs["Emission Strength"].default_value = fog_glow
        nt.links.new(vol.outputs[0], out.inputs["Volume"])
    return w
