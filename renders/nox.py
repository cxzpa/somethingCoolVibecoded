"""NOX-07 — the Vessel's sleeper, built procedurally and exported as a rigged, game-ready GLB.

Run (from the repo root):
    blender -b -P renders/nox.py -- --out assets/nox.glb [--preview renders/out]

How she's made:
  body    shaped primitives (ellipsoids, tapered capsules, a sculpted anime head) fused with a voxel
          remesh, smoothed and decimated into one seamless surface; skin and bodysuit by region
  armor   white and black lacquer plates grown from the body surface in segmented bands
  hands   separate gloves with claws; boots; chrome joint rings; neck ring; spine ports; a red core
  hair    ~130 tapered silver locks; a second shape key ("float") spreads them out as if underwater
  face    a projected patch with clean UVs; the web page paints the anime face onto it live
  rig     17 bones, distance-based skin weights, and an action with two poses:
          frame 1 = curled up floating, frame 25 = slumped (drained)
"""
import argparse
import math
import os
import random
import sys

import bpy  # noqa: I001  (bpy must load before bmesh outside Blender)
import bmesh
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", default="assets/nox.glb")
ap.add_argument("--preview", default=None, help="folder for preview renders")
ap.add_argument("--voxel", type=float, default=0.0028)
ap.add_argument("--faces", type=int, default=30000, help="target triangles for the body")
A = ap.parse_args(argv)
rnd = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
V = Vector

# ------------------------------------------------------------------ skeleton (rest pose, metres, Z up, front = -Y)
BONES = [
    ("hips", (0, 0, 0.92), (0, 0, 1.03), None),
    ("spine", (0, 0, 1.03), (0, 0, 1.19), "hips"),
    ("chest", (0, 0, 1.19), (0, 0, 1.37), "spine"),
    ("neck", (0, 0, 1.37), (0, 0, 1.47), "chest"),
    ("head", (0, 0, 1.47), (0, 0, 1.70), "neck"),
]
for s, sx in (("L", 1), ("R", -1)):
    BONES += [
        (f"shoulder.{s}", (0.02 * sx, 0, 1.335), (0.136 * sx, 0, 1.335), "chest"),
        (f"upper_arm.{s}", (0.145 * sx, 0, 1.33), (0.19 * sx, 0.005, 1.085), f"shoulder.{s}"),
        (f"forearm.{s}", (0.19 * sx, 0.005, 1.085), (0.232 * sx, -0.012, 0.865), f"upper_arm.{s}"),
        (f"hand.{s}", (0.232 * sx, -0.012, 0.865), (0.245 * sx, -0.02, 0.765), f"forearm.{s}"),
        (f"thigh.{s}", (0.096 * sx, 0, 0.9), (0.092 * sx, -0.006, 0.49), "hips"),
        (f"shin.{s}", (0.095 * sx, -0.006, 0.49), (0.1 * sx, 0.012, 0.09), f"thigh.{s}"),
        (f"foot.{s}", (0.1 * sx, 0.012, 0.09), (0.1 * sx, -0.11, 0.02), f"shin.{s}"),
    ]
BMAP = {b[0]: b for b in BONES}
H0 = V((0, 0, 1.562))  # head centre
HS = 0.93  # head scale: a touch smaller than a chibi-leaning anime head, for more realistic proportions


def seg(name):
    b = BMAP[name]
    return V(b[1]), V(b[2])


# ------------------------------------------------------------------ primitive helpers (all into one bmesh)
def ellipsoid(bm, c, r, rot=(0, 0, 0), seg_u=32, seg_v=20):
    M = Matrix.Translation(V(c)) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X") \
        @ Matrix.Diagonal((r[0], r[1], r[2], 1))
    return bmesh.ops.create_uvsphere(bm, u_segments=seg_u, v_segments=seg_v, radius=1.0, matrix=M)["verts"]


def capsule(bm, a, b, ra, rb, segs=28):
    a, b = V(a), V(b)
    d = b - a
    M = Matrix.Translation((a + b) / 2) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=ra, radius2=rb, depth=d.length, matrix=M)
    ellipsoid(bm, a, (ra, ra, ra), seg_u=segs, seg_v=14)
    ellipsoid(bm, b, (rb, rb, rb), seg_u=segs, seg_v=14)


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def anime_head(bm):
    """A deformed sphere: big cranium, narrow jaw and small chin, flat face front, a hint of a nose."""
    verts = ellipsoid(bm, (0, 0, 0), (1, 1, 1), seg_u=64, seg_v=44)
    for v in verts:
        x, y, z = v.co
        X, Y, Z = x * 0.084, y * 0.094, z * 0.104
        if Z < 0:  # jaw: narrow towards a small chin
            t = min(1.0, -Z / 0.104)
            X *= 1 - 0.5 * t ** 1.5
            if Y < 0:
                Y = Y * (1 - 0.18 * t) - 0.01 * t
                Z -= 0.014 * t * t
            else:
                Y *= 1 - 0.45 * t
        if Y < 0:
            Y *= 0.9  # flatten the face plane
            Y -= 0.006 * math.exp(-((X / 0.009) ** 2 + ((Z + 0.036) / 0.016) ** 2))  # nose
            for sx in (-1, 1):  # soft eye sockets
                Y += 0.0035 * math.exp(-(((X - sx * 0.035) / 0.017) ** 2 + ((Z + 0.004) / 0.012) ** 2))
        if Y > 0 and Z > -0.03:
            Y *= 1.06  # fuller back of the skull
        v.co = H0 + V((X, Y, Z)) * HS


def build_body():
    bm = bmesh.new()
    anime_head(bm)
    capsule(bm, (0, 0.008, 1.36), (0, 0.006, 1.5), 0.034, 0.03)  # a slimmer neck into the head
    # collarbones, upper chest, shoulder blades, a hint of abdomen
    for sx in (-1, 1):
        capsule(bm, (0.018 * sx, -0.05, 1.352), (0.118 * sx, -0.022, 1.348), 0.01, 0.011, segs=14)
        ellipsoid(bm, (0.062 * sx, 0.062, 1.27), (0.05, 0.022, 0.065), rot=(0.1, 0, 0.15 * sx))
    ellipsoid(bm, (0, -0.046, 1.08), (0.062, 0.03, 0.075))
    # torso: ribcage, waist, pelvis, bust, glutes, shoulders
    ellipsoid(bm, (0, 0.004, 1.24), (0.101, 0.074, 0.122))
    ellipsoid(bm, (0, 0.002, 1.09), (0.07, 0.055, 0.09))
    ellipsoid(bm, (0, 0.0, 0.94), (0.146, 0.092, 0.092))
    for sx in (-1, 1):
        ellipsoid(bm, (0.052 * sx, -0.052, 1.215), (0.05, 0.042, 0.048), rot=(0, 0, 0.2 * sx))
        ellipsoid(bm, (0.066 * sx, 0.038, 0.9), (0.073, 0.067, 0.075))
        ellipsoid(bm, (0.112 * sx, 0.0, 0.905), (0.058, 0.058, 0.08))  # hip flare
        ellipsoid(bm, (0.126 * sx, 0.004, 1.322), (0.044, 0.04, 0.036))
        ellipsoid(bm, (0.144 * sx, 0.0, 1.305), (0.037, 0.038, 0.056), rot=(0, 0.25 * sx, 0))   # deltoid
        ua0, ua1 = seg("upper_arm." + ("L" if sx > 0 else "R"))
        ellipsoid(bm, ua0.lerp(ua1, 0.45) + V((0, -0.006, 0)), (0.034, 0.034, 0.075), rot=(0, 0.17 * sx, 0))  # biceps
        kn = seg("shin." + ("L" if sx > 0 else "R"))[0]
        ellipsoid(bm, kn + V((0, -0.036, 0.004)), (0.034, 0.024, 0.036))   # kneecap
        # arm
        a0, a1 = seg("upper_arm." + ("L" if sx > 0 else "R"))
        capsule(bm, a0, a1, 0.037, 0.029)
        f0, f1 = seg("forearm." + ("L" if sx > 0 else "R"))
        capsule(bm, f0, f1, 0.031, 0.022)
        ellipsoid(bm, f0.lerp(f1, 0.3), (0.034, 0.032, 0.06), rot=(0, 0.15 * sx, 0))
        # leg
        t0, t1 = seg("thigh." + ("L" if sx > 0 else "R"))
        capsule(bm, t0 + V((0.006 * sx, 0, 0)), t1, 0.076, 0.047)
        ellipsoid(bm, t0.lerp(t1, 0.28), (0.081, 0.073, 0.13))
        s0, s1 = seg("shin." + ("L" if sx > 0 else "R"))
        capsule(bm, s0, s1, 0.046, 0.028)
        ellipsoid(bm, s0.lerp(s1, 0.3) + V((0, 0.012, 0)), (0.046, 0.047, 0.095))
    me = bpy.data.meshes.new("body_raw")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("Body", me)
    scene.collection.objects.link(ob)
    r = ob.modifiers.new("remesh", "REMESH")
    r.mode = "VOXEL"
    r.voxel_size = A.voxel
    r.adaptivity = 0.0
    sm = ob.modifiers.new("smooth", "SMOOTH")
    sm.factor = 0.7
    sm.iterations = 10
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = me2
    bpy.data.meshes.remove(old)
    n = len(me2.polygons)
    tris = sum(len(p.vertices) - 2 for p in me2.polygons)
    if tris > A.faces:
        d = ob.modifiers.new("decimate", "DECIMATE")
        d.ratio = A.faces / tris
        dg = bpy.context.evaluated_depsgraph_get()
        me3 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        ob.modifiers.clear()
        ob.data = me3
        bpy.data.meshes.remove(me2)
    ob.data.shade_smooth()
    print(f"[nox] body faces: {len(ob.data.polygons)}")
    return ob


# ------------------------------------------------------------------ materials (the web page restyles them by name)
def mat(name, color, rough=0.4, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = emit
        p.inputs["Emission Strength"].default_value = 6.0
    return m


MAT = {
    "Skin": mat("Skin", (0.93, 0.86, 0.82, 1), 0.45),
    "Suit": mat("Suit", (0.012, 0.012, 0.015, 1), 0.25),
    "ArmorWhite": mat("ArmorWhite", (0.9, 0.9, 0.9, 1), 0.18),
    "ArmorBlack": mat("ArmorBlack", (0.02, 0.02, 0.025, 1), 0.15),
    "Chrome": mat("Chrome", (0.9, 0.9, 0.92, 1), 0.1, 1.0),
    "Glow": mat("Glow", (0.05, 0, 0, 1), 0.3, 0.0, emit=(1, 0.05, 0.06, 1)),
    "Hair": mat("Hair", (0.78, 0.8, 0.84, 1), 0.35),
    "Face": mat("Face", (1, 1, 1, 1), 0.5),
}


def dist_seg(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length, t


def assign_body_materials(ob):
    me = ob.data
    me.materials.append(MAT["Suit"])
    me.materials.append(MAT["Skin"])
    for poly in me.polygons:
        c = poly.center
        skin = c.z > 1.385  # neck and head
        for s in ("L", "R"):
            d, t = dist_seg(c, *seg("upper_arm." + s))
            if d < 0.06 and t < 0.82:
                skin = True  # bare upper arms
            d, t = dist_seg(c, *seg("thigh." + s))
            if d < 0.1 and 0.2 < t < 0.62:
                skin = True  # the gap above thigh-high boots
        poly.material_index = 1 if skin else 0


# ------------------------------------------------------------------ armor: plates grown from the body surface
BODY_BVH = None


def finish_plate(name, bm, thick, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    so = ob.modifiers.new("solid", "SOLIDIFY")
    so.thickness = thick
    so.offset = 1.0
    so.use_even_offset = True
    bv = ob.modifiers.new("bevel", "BEVEL")
    bv.width = 0.0014
    bv.segments = 2
    bv.limit_method = "ANGLE"
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = me2
    bpy.data.meshes.remove(me)
    me2.shade_smooth()
    me2.materials.append(MAT[material])
    return ob


def shell(name, a, b, t0, t1, ang0, ang1, ref, offset=0.0045, thick=0.0034, material="ArmorWhite", reach=0.12, nt=12, na=16):
    """A clean curved plate fitted to the body: rays cast inward from around a bone axis."""
    a, b = V(a), V(b)
    axis = (b - a).normalized()
    ref = V(ref)
    u = (ref - axis * ref.dot(axis)).normalized()
    w = axis.cross(u)
    bm = bmesh.new()
    grid = []
    for i in range(nt + 1):
        t = t0 + (t1 - t0) * i / nt
        c = a.lerp(b, t)
        row = []
        for j in range(na + 1):
            ang = ang0 + (ang1 - ang0) * j / na
            d = u * math.cos(ang) + w * math.sin(ang)
            hit = BODY_BVH.ray_cast(c + d * reach, -d, reach)
            p = (hit[0] + d * offset) if hit[0] is not None else (c + d * reach * 0.5)
            row.append(bm.verts.new(p))
        grid.append(row)
    for i in range(nt):
        for j in range(na):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # make sure normals point away from the body
    f = bm.faces[len(bm.faces) // 2]
    if f.normal.dot(f.calc_center_median() - a.lerp(b, (t0 + t1) / 2)) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return finish_plate(name, bm, thick, material)


def build_armor(body):
    global BODY_BVH
    BODY_BVH = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    out = []
    for s, sx in (("L", 1), ("R", -1)):
        a, b = seg("shin." + s)
        for i, (t0, t1) in enumerate([(0.1, 0.37), (0.4, 0.66), (0.69, 0.93)]):
            out.append(shell(f"shin_plate_{s}{i}", a, b, t0, t1, -1.35, 1.35, (0, -1, 0), reach=0.1))
        a, b = seg("thigh." + s)
        out.append(shell(f"knee_plate_{s}", a, b, 0.86, 1.0, -1.1, 1.1, (0, -1, 0), reach=0.1, offset=0.006))
        out.append(shell(f"thigh_plate_{s}", a, b, 0.04, 0.26, -0.75, 0.75, (sx, 0, 0), reach=0.12, material="ArmorBlack"))
        a, b = seg("forearm." + s)
        for i, (t0, t1) in enumerate([(0.14, 0.5), (0.54, 0.93)]):
            out.append(shell(f"forearm_plate_{s}{i}", a, b, t0, t1, -1.5, 1.5, (sx, 0.25, 0), reach=0.08))
        out.append(shell(f"pauldron_{s}", (0.137 * sx, 0, 1.25), (0.145 * sx, 0, 1.39), 0.3, 0.9, -1.5, 1.5, (sx, 0, 0), reach=0.08, offset=0.005, thick=0.004))
        out.append(shell(f"hip_plate_{s}", (0, 0, 0.85), (0, 0, 1.0), 0.05, 0.95, -0.6, 0.6, (sx, 0, 0), reach=0.18, material="ArmorBlack"))
    out.append(shell("chest_plate", (0, 0, 1.13), (0, 0, 1.33), 0.0, 1.0, -1.05, 1.05, (0, -1, 0), reach=0.16))
    for i, (t0, t1) in enumerate([(0.0, 0.3), (0.35, 0.64), (0.69, 1.0)]):
        out.append(shell(f"back_plate_{i}", (0, 0, 1.03), (0, 0, 1.34), t0, t1, -0.95, 0.95, (0, 1, 0), reach=0.15, material="ArmorBlack"))
    out.append(shell("belt", (0, 0, 0.985), (0, 0, 1.02), 0.0, 1.0, -math.pi, math.pi, (0, -1, 0), reach=0.18, thick=0.006, material="ArmorBlack", nt=3, na=48))
    return [o for o in out if o]


def ring(name, center, axis, r, tube, material="Chrome"):
    bm = bmesh.new()
    segs, tsegs = 40, 10
    q = V(axis).normalized().to_track_quat("Z", "Y")
    grid = []
    for i in range(segs):
        a = i / segs * math.tau
        row = []
        for j in range(tsegs):
            b = j / tsegs * math.tau
            p = V(((r + tube * math.cos(b)) * math.cos(a), (r + tube * math.cos(b)) * math.sin(a), tube * math.sin(b)))
            row.append(bm.verts.new(V(center) + q @ p))
        grid.append(row)
    for i in range(segs):
        for j in range(tsegs):
            bm.faces.new((grid[i][j], grid[(i + 1) % segs][j], grid[(i + 1) % segs][(j + 1) % tsegs], grid[i][(j + 1) % tsegs]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(MAT[material])
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def build_details():
    out = []
    for s, sx in (("L", 1), ("R", -1)):
        a, b = seg("forearm." + s)
        out.append(ring(f"elbow_ring_{s}", a, b - a, 0.033, 0.006))
        a, b = seg("shin." + s)
        out.append(ring(f"knee_ring_{s}", a + V((0, -0.01, 0)), b - a, 0.05, 0.007))
        out.append(build_glove(s, sx))
        out.append(build_boot(s, sx))
    out.append(ring("neck_ring", (0, 0.007, 1.405), (0, 0.15, 1), 0.037, 0.005))
    out.append(ring("neck_ring_red", (0, 0.007, 1.39), (0, 0.15, 1), 0.038, 0.002, "Glow"))
    # sternum core: a small red diamond
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.016, matrix=Matrix.Translation((0, -0.098, 1.255)) @ Matrix.Diagonal((0.8, 0.5, 1.3, 1)))
    me = bpy.data.meshes.new("core")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT["Glow"])
    core = bpy.data.objects.new("core", me)
    scene.collection.objects.link(core)
    out.append(core)
    return out


def build_glove(s, sx):
    a, b = seg("hand." + s)
    bm = bmesh.new()
    d = (b - a).normalized()
    palm_c = a + d * 0.045
    ellipsoid(bm, palm_c, (0.03, 0.013, 0.042), rot=(0, 0, 0))
    for k in range(4):
        base = palm_c + V(((k - 1.5) * 0.013 * sx, -0.002, -0.035))
        tip = base + V((sx * (k - 1.5) * 0.004, -0.02, -0.07 + abs(k - 1.5) * 0.012))
        capsule(bm, base, tip, 0.0065, 0.004, segs=10)
        # claw
        bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.004, radius2=0.0, depth=0.03,
                              matrix=Matrix.Translation(tip + (tip - base).normalized() * 0.014) @ (tip - base).to_track_quat("Z", "Y").to_matrix().to_4x4())
    thumb0 = palm_c + V((0.022 * -sx, -0.012, 0.0))
    capsule(bm, thumb0, thumb0 + V((-0.012 * sx, -0.028, -0.035)), 0.007, 0.0045, segs=10)
    me = bpy.data.meshes.new(f"glove_{s}")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(MAT["ArmorBlack"])
    ob = bpy.data.objects.new(f"glove_{s}", me)
    scene.collection.objects.link(ob)
    return ob


def build_boot(s, sx):
    a, b = seg("foot." + s)
    bm = bmesh.new()
    capsule(bm, a + V((0, 0.012, 0.0)), b + V((0, 0, 0.002)), 0.034, 0.024, segs=20)
    ellipsoid(bm, a.lerp(b, 0.25) + V((0, 0.02, -0.03)), (0.034, 0.05, 0.03))
    # a heel spike, very on-board
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.012, radius2=0.004, depth=0.07,
                          matrix=Matrix.Translation(a + V((0, 0.045, -0.06))) @ Matrix.Rotation(0.2, 4, "X"))
    me = bpy.data.meshes.new(f"boot_{s}")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(MAT["ArmorWhite"])
    ob = bpy.data.objects.new(f"boot_{s}", me)
    scene.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------ face patch (UVs for the painted face)
FACE_X = (-0.08, 0.08)
FACE_Z = (H0.z - 0.108, H0.z + 0.042)


def build_face(body):
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    nx, nz = 48, 46
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = {}
    for i in range(nx + 1):
        for j in range(nz + 1):
            u, v = i / nx, j / nz
            x = FACE_X[0] + (FACE_X[1] - FACE_X[0]) * u
            z = FACE_Z[0] + (FACE_Z[1] - FACE_Z[0]) * v
            hit = bvh.ray_cast(V((x, -0.4, z)), V((0, 1, 0)))
            if hit[0] is not None and hit[0].y < -0.02:
                grid[(i, j)] = (bm.verts.new(hit[0] + hit[1] * 0.0012), (u, v))
    for i in range(nx):
        for j in range(nz):
            q = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            if all(k in grid for k in q):
                f = bm.faces.new([grid[k][0] for k in q])
                for loop, k in zip(f.loops, q):
                    loop[uv].uv = grid[k][1]
    me = bpy.data.meshes.new("face")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(MAT["Face"])
    ob = bpy.data.objects.new("face", me)
    scene.collection.objects.link(ob)
    return ob


# ------------------------------------------------------------------ hair: tapered locks, with a "float" shape key
def build_hair(body):
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    SEG, RING = 14, 4
    ER = V((0.092, 0.102, 0.114)) * HS  # ellipsoid around the head, for strand collision

    def surface(d):
        hit = bvh.ray_cast(H0 + d * 0.3, -d)
        return (hit[0], hit[1]) if hit[0] is not None else (H0 + d * 0.1, d)

    def ell(p):
        rel = p - H0
        return V((rel.x / ER.x, rel.y / ER.y, rel.z / ER.z))

    def ell_normal(p):
        rel = p - H0
        return V((rel.x / ER.x ** 2, rel.y / ER.y ** 2, rel.z / ER.z ** 2)).normalized()

    def collide(p, margin=0.06):
        e = ell(p)
        if e.length < 1 + margin:
            p = H0 + V((e.x * ER.x, e.y * ER.y, e.z * ER.z)) * ((1 + margin) / max(e.length, 1e-4))
        # the face window: nothing crosses the eyes, nose or mouth
        if p.y < -0.025 and p.z < H0.z + 0.01 * HS and p.z > H0.z - 0.14 * HS and abs(p.x) < 0.088 * HS:
            p = V((math.copysign(0.088 * HS, p.x if abs(p.x) > 1e-4 else 1), p.y, p.z))
        if 0.95 < p.z < 1.42 and p.y > -0.02:  # keep long hair off the back and shoulders
            r = math.hypot(p.x / 1.15, p.y)
            if r < 0.12:
                k = 0.12 / max(r, 1e-4)
                p = V((p.x * k, p.y * k, p.z))
        return p

    def grow(root, nrm, L, kind, floating, rs):
        pts = [root.copy()]
        p = root.copy()
        g = V((0, 0, -1))
        sway = V((rs.uniform(-1, 1), rs.uniform(-1, 1), 0)) * 0.12
        stopped = False
        for k in range(1, SEG + 1):
            t = k / SEG
            step = L / SEG
            if floating:
                d = (nrm * 0.85 + V((0, 0, 0.3)) + sway * 2.5 * t + V((rs.uniform(-1, 1), rs.uniform(-1, 1), rs.uniform(-0.2, 0.5))) * 0.2 * t).normalized()
                step *= 0.85
            else:
                n = ell_normal(p)
                near = ell(p).length < 1.12
                rel = p - H0
                outward = V((rel.x, rel.y, 0))
                outward = outward.normalized() if outward.length > 1e-4 else V((0, 1, 0))
                if kind == "bang":
                    want = (V((0, -0.55, -1)) + nrm * (0.5 - t * 0.4)).normalized()
                else:
                    # flow out from the crown along the skull first, then fall
                    want = (g + outward * max(0.0, 1.3 - t * 2.6) + V((0, 0.06 if kind == "back" else -0.03, 0)) + sway * t).normalized()
                if near:  # slide along the skull instead of through it
                    want = (want - n * want.dot(n)).normalized() * 0.9 + n * 0.12
                d = want.normalized()
            if stopped:
                pts.append(p.copy())  # this bang already reached the brows: the tail collapses to a point
                continue
            p = collide(p + d * step)
            if kind == "bang" and not floating and abs(p.x) < 0.075 * HS and p.y < 0 and p.z < H0.z + 0.016 * HS:
                p = V((p.x, p.y, H0.z + 0.016 * HS))  # bangs stop at the brows
                stopped = True
            pts.append(p.copy())
        return pts

    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    float_co = []
    locks = []
    rs = random.Random(11)
    for n_lock in range(380):
        a = rs.uniform(0, math.tau)
        el = rs.uniform(-0.05, 1.0) if n_lock < 300 else rs.uniform(1.0, 1.5)  # the last 80 cover the crown
        d = V((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el) + 0.35)).normalized()
        if d.y < -0.3 and d.z < 0.62:
            continue  # no roots on the face
        frontal = d.y < -0.15
        kind = "bang" if frontal and abs(d.x) < 0.5 else ("side" if (abs(d.x) > 0.55 and d.y < 0.25) or frontal else "back")
        L = {"bang": rs.uniform(0.07, 0.115), "side": rs.uniform(0.3, 0.46), "back": rs.uniform(0.42, 0.66)}[kind]
        fine = rs.random() < 0.22  # flyaway strands
        locks.append((d, kind, L * (rs.uniform(0.6, 1.05) if fine else 1), rs.uniform(0.0035, 0.006) if fine else (rs.uniform(0.008, 0.015) if kind != "bang" else rs.uniform(0.01, 0.017))))
    for d, kind, L, w in locks:
        root, nrm = surface(d)
        root = root + nrm * 0.0025
        seed = rs.random()
        hang = grow(root, nrm, L, kind, False, random.Random(seed))
        flt = grow(root, nrm, L, kind, True, random.Random(seed))
        side = nrm.cross(V((0, 0, 1)))
        side = side.normalized() if side.length > 1e-3 else V((1, 0, 0))
        rings = []
        for k in range(SEG + 1):
            t = k / SEG
            width = w * (1 - t) ** 0.7 + 0.0008
            thick = min(0.0024, width * 0.35) * (1 - t) + 0.0005
            row = []
            for pts, store in ((hang, None), (flt, float_co)):
                nxt = pts[min(k + 1, SEG)] - pts[max(k - 1, 0)]
                tan = nxt.normalized() if nxt.length > 1e-6 else V((0, 0, -1))
                sd = (side - tan * side.dot(tan)).normalized()
                nr = sd.cross(tan).normalized()
                ring_pts = [pts[k] + sd * math.cos(r / RING * math.tau) * width + nr * math.sin(r / RING * math.tau) * thick for r in range(RING)]
                if store is None:
                    row = [bm.verts.new(p) for p in ring_pts]
                else:
                    store.extend(ring_pts)
            rings.append(row)
        for k in range(SEG):
            for r in range(RING):
                r2 = (r + 1) % RING
                f = bm.faces.new((rings[k][r], rings[k][r2], rings[k + 1][r2], rings[k + 1][r]))
                for loop, (kk, rr) in zip(f.loops, [(k, r), (k, r2), (k + 1, r2), (k + 1, r)]):
                    loop[uv].uv = (rr / RING, kk / SEG)
    # scalp cap hugging the head, cut along a hairline; its float copy is identical
    cap = {}
    nu, nv = 40, 22
    for i in range(nu):
        for j in range(nv + 1):
            a = i / nu * math.tau
            el = -0.35 + (math.pi / 2 + 0.35) * j / nv
            d = V((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
            hair_line = -0.05 if d.y > 0.2 else (0.32 if d.y < -0.35 else 0.0)
            if math.sin(el) < hair_line and j < nv:
                continue
            p, n = surface(d)
            cap[(i, j)] = bm.verts.new(p + n * 0.003)
            float_co.append(p + n * 0.003)
    for i in range(nu):
        for j in range(nv):
            q = [(i, j), ((i + 1) % nu, j), ((i + 1) % nu, j + 1), (i, j + 1)]
            if all(k in cap for k in q):
                try:
                    f = bm.faces.new([cap[k] for k in q])
                    for loop in f.loops:
                        loop[uv].uv = (0.5, 0.0)
                except ValueError:
                    pass
    me = bpy.data.meshes.new("hair")
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(MAT["Hair"])
    ob = bpy.data.objects.new("hair", me)
    scene.collection.objects.link(ob)
    ob.shape_key_add(name="Basis")
    sk = ob.shape_key_add(name="float")
    sk.value = 0.0  # Blender 5 turns new keys fully on; the page drives this
    for i, co in enumerate(float_co[:len(sk.data)]):
        sk.data[i].co = co
    print(f"[nox] hair verts: {len(me.vertices)} (float {len(float_co)})")
    return ob


# ------------------------------------------------------------------ rig
def build_armature():
    arm_data = bpy.data.armatures.new("NoxRig")
    arm = bpy.data.objects.new("NoxRig", arm_data)
    scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for name, h, t, parent in BONES:
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = V(h), V(t)
        b.align_roll(V((0, -1, 0)) if abs((V(t) - V(h)).normalized().y) < 0.7 else V((0, 0, 1)))
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        eb[name] = b
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def side_ok(bone, x):
    if bone.endswith(".L"):
        return x > -0.01
    if bone.endswith(".R"):
        return x < 0.01
    return True


def skin(ob, arm, rigid=None, allowed=None):
    for name, *_ in BONES:
        ob.vertex_groups.new(name=name)
    segs = {name: (V(h), V(t)) for name, h, t, _ in BONES}
    for v in ob.data.vertices:
        if rigid:
            ob.vertex_groups[rigid].add([v.index], 1.0, "REPLACE")
            continue
        p = v.co
        cands = []
        for name, (a, b) in segs.items():
            if allowed and name not in allowed:
                continue
            if not side_ok(name, p.x):
                continue
            d, _ = dist_seg(p, a, b)
            cands.append((d, name))
        cands.sort()
        best = cands[:3]
        ws = [1.0 / (max(d, 0.004) ** 4) for d, _ in best]
        tot = sum(ws)
        for (d, name), w in zip(best, ws):
            if w / tot > 0.02:
                ob.vertex_groups[name].add([v.index], w / tot, "REPLACE")
    ob.parent = arm
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def skin_like(ob, src, arm):
    """Copy skin weights from the nearest vertex of `src`, so a layer (the face) moves exactly with the skin under it."""
    from mathutils.kdtree import KDTree
    kd = KDTree(len(src.data.vertices))
    for v in src.data.vertices:
        kd.insert(v.co, v.index)
    kd.balance()
    for name, *_ in BONES:
        ob.vertex_groups.new(name=name)
    names = {g.index: g.name for g in src.vertex_groups}
    for v in ob.data.vertices:
        hits = kd.find_n(v.co, 3)
        acc = {}
        for co, idx, d in hits:
            w = 1.0 / max(d, 1e-5)
            for g in src.data.vertices[idx].groups:
                acc[names[g.group]] = acc.get(names[g.group], 0) + g.weight * w
        tot = sum(acc.values()) or 1
        for n, w in acc.items():
            ob.vertex_groups[n].add([v.index], w / tot, "REPLACE")
    ob.parent = arm
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = arm


def nearest_bone(ob):
    c = sum((v.co for v in ob.data.vertices), V()) / max(1, len(ob.data.vertices))
    best = min(BONES, key=lambda b: dist_seg(c, V(b[1]), V(b[2]))[0] if side_ok(b[0], c.x) else 9)
    return best[0]


# poses: rotations about world axes, expressed in each bone's rest frame (children inherit parents)
POSES = {
    "float": {"spine": [("X", 0.34)], "chest": [("X", 0.14)], "neck": [("X", -0.12)], "head": [("X", -0.05), ("Z", 0.12)],
              "thigh.L": [("X", -2.05), ("Y", 0.12)], "thigh.R": [("X", -1.95), ("Y", -0.08)], "shin.L": [("X", 2.5)], "shin.R": [("X", 2.45)],
              "foot.L": [("X", 0.6)], "foot.R": [("X", 0.55)],
              "upper_arm.L": [("X", -0.55), ("Y", 0.5)], "upper_arm.R": [("X", -0.5), ("Y", -0.5)],
              "forearm.L": [("X", -1.05), ("Y", 0.75)], "forearm.R": [("X", -1.1), ("Y", -0.75)],
              "hand.L": [("X", -0.2), ("Y", 0.3)], "hand.R": [("X", -0.2), ("Y", -0.3)]},
    "slump": {"spine": [("X", 0.72)], "chest": [("X", 0.35)], "neck": [("X", 0.5)], "head": [("X", 0.6), ("Z", 0.35)],
              "thigh.L": [("X", -1.1), ("Y", 0.28)], "thigh.R": [("X", -1.0), ("Y", -0.25)], "shin.L": [("X", 1.35)], "shin.R": [("X", 1.2)],
              "foot.L": [("X", 0.2)], "foot.R": [("X", 0.2)],
              "upper_arm.L": [("X", -0.25), ("Y", 0.08)], "upper_arm.R": [("X", -0.2), ("Y", -0.1)],
              "forearm.L": [("X", -0.35)], "forearm.R": [("X", -0.3)], "hand.L": [], "hand.R": []},
}
AX = {"X": V((1, 0, 0)), "Y": V((0, 1, 0)), "Z": V((0, 0, 1))}


def set_pose(arm, pose):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        q = Quaternion()
        rest = arm.data.bones[pb.name].matrix_local.to_3x3().inverted()
        for axis, ang in pose.get(pb.name, []):
            q = Quaternion((rest @ AX[axis]).normalized(), ang) @ q
        pb.rotation_quaternion = q


def keyframe_poses(arm):
    arm.animation_data_create()
    act = bpy.data.actions.new("poses")
    arm.animation_data.action = act
    for frame, name in ((1, "float"), (25, "slump")):
        set_pose(arm, POSES[name])
        for pb in arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=frame)
    scene.frame_start, scene.frame_end = 1, 25


def add_ports(arm):
    ports = []
    for i in range(4):
        e = bpy.data.objects.new(f"port_{i}", None)
        scene.collection.objects.link(e)
        e.parent = arm
        e.parent_type = "BONE"
        e.parent_bone = "chest" if i > 1 else "spine"
        bpy.context.view_layer.update()
        e.matrix_world = Matrix.Translation((0, 0.105, 1.08 + i * 0.075))
        ports.append(e)
        # a chrome socket with a red light at each port
        r = ring(f"port_ring_{i}", (0, 0.098, 1.08 + i * 0.075), (0, 1, 0), 0.016, 0.004)
        g = ring(f"port_led_{i}", (0, 0.1, 1.08 + i * 0.075), (0, 1, 0), 0.008, 0.003, "Glow")
        ports.extend([r, g])
    return ports


# ------------------------------------------------------------------ preview renders (optional)
def preview(folder, objs):
    os.makedirs(folder, exist_ok=True)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 560, 760
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        pass
    w = bpy.data.worlds.new("w")
    scene.world = w
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.06, 0.07, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    for name, loc, energy in (("key", (-1.2, -2.0, 2.2), 260), ("rim", (1.4, 1.6, 1.8), 220), ("fill", (1.8, -1.5, 0.8), 90)):
        L = bpy.data.lights.new(name, "AREA")
        L.size = 1.2
        L.energy = energy
        o = bpy.data.objects.new(name, L)
        o.location = loc
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = (V((0, 0, 1.1)) - V(loc)).to_track_quat("-Z", "Y")
        scene.collection.objects.link(o)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shot(name, frame, loc, target, lens=50):
        scene.frame_set(frame)
        cam.data.lens = lens
        cam.location = loc
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = (V(target) - V(loc)).to_track_quat("-Z", "Y")
        scene.render.filepath = os.path.join(folder, f"nox_{name}.png")
        bpy.ops.render.render(write_still=True)
        print("[nox] preview", scene.render.filepath)

    arm = bpy.data.objects["NoxRig"]
    saved = arm.animation_data.action
    arm.animation_data.action = None
    set_pose(arm, {})
    shot("rest_front", 1, (0.0, -3.4, 1.0), (0, 0, 0.92), 38)
    shot("face", 1, (0.12, -0.75, 1.58), (0, 0, 1.56), 85)
    arm.animation_data.action = saved
    shot("float", 1, (1.6, -2.2, 1.3), (0, 0, 1.0), 45)
    shot("slump", 25, (1.6, -2.2, 1.1), (0, 0, 0.9), 45)


# ------------------------------------------------------------------ build
body = build_body()
assign_body_materials(body)
face = build_face(body)
armor = build_armor(body)
details = build_details()
hair = build_hair(body)
arm = build_armature()

skin(body, arm)
skin_like(face, body, arm)
skin(hair, arm, rigid="head")
for o in armor + details:
    skin(o, arm, rigid=nearest_bone(o))
ports = add_ports(arm)
for o in ports:
    if o.type == "MESH":
        skin(o, arm, rigid="chest" if "1" > o.name[-1] else "chest")
keyframe_poses(arm)
scene.frame_set(1)

if A.preview:
    preview(A.preview, None)

os.makedirs(os.path.dirname(os.path.abspath(A.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(A.out), export_format="GLB", export_skins=True, export_morph=True,
                          export_animations=True, export_apply=False, export_yup=True)
print("[nox] exported", A.out, os.path.getsize(A.out) // 1024, "KB")
