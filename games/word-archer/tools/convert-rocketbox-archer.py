"""Convert Microsoft's MIT-licensed Female_Adult_17 FBX to a web-ready GLB.

Requires Blender 4.3+ and ImageMagick. Command:
  blender -b --python tools/convert-rocketbox-archer.py -- \
    --source-dir /path/to/Female_Adult_17 --output /path/to/archer-realistic.glb

source-dir contains Export/Female_Adult_17.fbx and the original Textures/*.tga.
No bone rest matrices, skin weights, face geometry or proportions are edited.
Faulty imported custom normals are replaced with smooth mesh normals, fixing a
black shading wedge behind the ear without changing any vertex positions/UVs.
Optional --render-dir writes neutral-light body and face QA renders.
"""
import argparse
import bpy
import json
import math
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--source-dir', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--render-dir')
parser.add_argument('--render-views', default='body,face,profile')
parser.add_argument('--render-unlit', action='store_true')
parser.add_argument('--render-no-normal', action='store_true')
parser.add_argument('--render-hair-no-shadow', action='store_true')
parser.add_argument('--keep-source-normals', action='store_true', help='Diagnostic only: retain the original faulty FBX custom normals.')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
source_dir = os.path.abspath(args.source_dir)
output = os.path.abspath(args.output)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(
    filepath=os.path.join(source_dir, 'Export', 'Female_Adult_17.fbx'),
    automatic_bone_orientation=False,
    use_image_search=False,
    use_custom_normals=args.keep_source_normals,
)
armature = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

# Fix stale original 3ds Max texture paths. Source color/normal maps retain their
# full 2048x2048 resolution; the original opacity atlas is 1024x1024 RGBA.
image_cache = {}
texture_cache_dir = tempfile.TemporaryDirectory(prefix='rocketbox-textures-')
image_converter = shutil.which('magick') or shutil.which('convert')
if not image_converter:
    raise RuntimeError('ImageMagick is required for exact JPEG quality and 4:4:4 chroma encoding.')
def image_file(name, non_color=False):
    key = (name, non_color)
    if key not in image_cache:
        image = bpy.data.images.load(os.path.join(source_dir, 'Textures', name), check_existing=False)
        if non_color:
            image.colorspace_settings.name = 'Non-Color'
        if not name.startswith('f006_opacity_'):
            # Keep original 2K resolution; only use perceptual compression for
            # opaque images. High-quality normals retain fine surface detail;
            # the opacity atlas remains lossless RGBA PNG in the GLB.
            encoded_path = os.path.join(texture_cache_dir.name, name.removesuffix('.tga') + '.jpg')
            subprocess.run([
                image_converter, os.path.join(source_dir, 'Textures', name),
                '-sampling-factor', '4:4:4', '-quality', '94' if non_color else '92',
                encoded_path,
            ], check=True)
            image = bpy.data.images.load(encoded_path, check_existing=False)
            if non_color:
                image.colorspace_settings.name = 'Non-Color'
        image_cache[key] = image
    return image_cache[key]

for material in bpy.data.materials:
    if not material.name.startswith('f006_'):
        continue
    kind = material.name.removeprefix('f006_')
    material.use_nodes = True
    material.use_backface_culling = kind != 'opacity'
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    shader = nodes.new('ShaderNodeBsdfPrincipled')
    output_node = nodes.new('ShaderNodeOutputMaterial')
    links.new(shader.outputs['BSDF'], output_node.inputs['Surface'])
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Roughness'].default_value = {'body': .78, 'head': .56, 'opacity': .68}[kind]
    shader.inputs['Specular IOR Level'].default_value = .3
    shader.inputs['IOR'].default_value = 1.45
    material.diffuse_color = (1, 1, 1, 1)
    color = nodes.new('ShaderNodeTexImage')
    color.image = image_file('f006_' + kind + '_color.tga')
    links.new(color.outputs['Color'], shader.inputs['Base Color'])
    if kind == 'opacity':
        links.new(color.outputs['Alpha'], shader.inputs['Alpha'])
        material.surface_render_method = 'DITHERED'
        material.use_backface_culling = False
    else:
        normal_texture = nodes.new('ShaderNodeTexImage')
        normal_texture.image = image_file('f006_' + kind + '_normal.tga', True)
        normal = nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .6 if kind == 'head' else .45
        links.new(normal_texture.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], shader.inputs['Normal'])

# A parent translation centers the existing rest skeleton between its ankles and
# raises the sole to y=0 after glTF axis conversion. Individual bone transforms,
# object scale, inverse bind matrices and A-pose remain intact.
feet = [armature.matrix_world @ armature.data.bones['Bip01 ' + side + ' Foot'].head_local for side in ['L', 'R']]
feet_center = (feet[0] + feet[1]) * .5
min_height = min((o.matrix_world @ Vector(c)).z for o in meshes for c in o.bound_box)
basis = bpy.data.objects.new('RocketboxArcherBasis', None)
bpy.context.collection.objects.link(basis)
basis.location = (-feet_center.x, -feet_center.y, -min_height)
armature.parent = basis
basis['source'] = 'Microsoft Rocketbox / Female_Adult_17'
basis['license'] = 'MIT; Copyright (c) 2020 Microsoft'
basis['source_url'] = 'https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_17'
for o in bpy.context.scene.objects:
    o.select_set(False)
basis.select_set(True)
armature.select_set(True)
for o in meshes:
    o.select_set(True)
    for polygon in o.data.polygons:
        polygon.use_smooth = True
bpy.context.view_layer.update()
os.makedirs(os.path.dirname(output), exist_ok=True)
staging_output = output + '.pending.glb'
bpy.ops.export_scene.gltf(
    filepath=staging_output,
    export_format='GLB',
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_skins=True,
    export_influence_nb=4,
    export_all_influences=False,
    export_animations=False,
    export_leaf_bone=False,
    export_def_bones=False,
    export_rest_position_armature=True,
    export_materials='EXPORT',
    export_image_format='AUTO',
    export_keep_originals=False,
    export_tangents=True,
    export_extras=True,
    export_copyright='Copyright (c) 2020 Microsoft. MIT License; see archer-ATTRIBUTION.txt.',
)

# Blender 4.3 replaces its old alpha-clip material control with dithered alpha.
# glTF MASK gives hair cards stable depth/shadows in Three.js; it does not alter
# geometry or UVs. Replace only the four opaque image views with our original
# JPEG encodings: Blender's glTF exporter otherwise silently re-encodes at its
# default quality 75. All mesh/accessor/skin binary data is copied byte for byte.
with open(staging_output, 'rb') as f:
    blob = f.read()
json_length = struct.unpack_from('<I', blob, 12)[0]
gltf = json.loads(blob[20:20 + json_length])
original_binary = blob[28 + json_length:]
image_replacements = {}
for image in gltf.get('images', []):
    encoded_path = os.path.join(texture_cache_dir.name, image.get('name', '') + '.jpg')
    if os.path.exists(encoded_path):
        with open(encoded_path, 'rb') as f:
            image_replacements[image['bufferView']] = f.read()
        image['mimeType'] = 'image/jpeg'
binary_data = bytearray()
for index, view in enumerate(gltf['bufferViews']):
    offset = view.get('byteOffset', 0)
    data = image_replacements.get(index, original_binary[offset:offset + view['byteLength']])
    binary_data.extend(b'\x00' * (-len(binary_data) % 4))
    view['byteOffset'] = len(binary_data)
    view['byteLength'] = len(data)
    binary_data.extend(data)
gltf['buffers'][0]['byteLength'] = len(binary_data)
binary_data.extend(b'\x00' * (-len(binary_data) % 4))
for material in gltf.get('materials', []):
    if material.get('name') == 'f006_opacity':
        material['alphaMode'] = 'MASK'
        material['alphaCutoff'] = .35
        material['doubleSided'] = True
    else:
        material['alphaMode'] = 'OPAQUE'
        material['doubleSided'] = False
encoded = json.dumps(gltf, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
encoded += b' ' * (-len(encoded) % 4)
binary_chunks = struct.pack('<II', len(binary_data), 0x004E4942) + binary_data
rebuilt = struct.pack('<III', 0x46546C67, 2, 20 + len(encoded) + len(binary_chunks))
rebuilt += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded + binary_chunks
with open(staging_output, 'wb') as f:
    f.write(rebuilt)
os.replace(staging_output, output)
print('EXPORTED', output, len(rebuilt), 'bytes')
print('BONES', len(armature.data.bones), [b.name for b in armature.data.bones])
print('BASIS_TRANSLATION', list(basis.location), 'BLENDER_Z_UP_TO_GLTF_Y_UP=True; front=-Y -> +Z')

if args.render_dir:
    render_dir = os.path.abspath(args.render_dir)
    os.makedirs(render_dir, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = False
    # Hair cards need enough transparent ray bounces; insufficient bounces
    # produce false black wedges that do not occur with WebGL alpha testing.
    scene.cycles.transparent_max_bounces = 32
    # Match the exported glTF alphaMode=MASK in the offline reference render.
    hair_material = bpy.data.materials.get('f006_opacity')
    if hair_material:
        nodes = hair_material.node_tree.nodes
        links = hair_material.node_tree.links
        shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        alpha_source = shader.inputs['Alpha'].links[0].from_socket
        for link in list(shader.inputs['Alpha'].links):
            links.remove(link)
        clip = nodes.new('ShaderNodeMath')
        clip.operation = 'GREATER_THAN'
        clip.inputs[1].default_value = .35
        links.new(alpha_source, clip.inputs[0])
        links.new(clip.outputs[0], shader.inputs['Alpha'])
        if args.render_hair_no_shadow:
            output_node = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
            original_shader = output_node.inputs['Surface'].links[0].from_socket
            for link in list(output_node.inputs['Surface'].links):
                links.remove(link)
            light_path = nodes.new('ShaderNodeLightPath')
            transparent = nodes.new('ShaderNodeBsdfTransparent')
            mix = nodes.new('ShaderNodeMixShader')
            links.new(light_path.outputs['Is Shadow Ray'], mix.inputs[0])
            links.new(original_shader, mix.inputs[1])
            links.new(transparent.outputs[0], mix.inputs[2])
            links.new(mix.outputs[0], output_node.inputs['Surface'])
    if args.render_unlit:
        scene.cycles.samples = 4
        for material in bpy.data.materials:
            if not material.name.startswith('f006_'):
                continue
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
            color_source = shader.inputs['Base Color'].links[0].from_socket
            shader.inputs['Base Color'].default_value = (0, 0, 0, 1)
            for link in list(shader.inputs['Base Color'].links):
                links.remove(link)
            shader.inputs['Specular IOR Level'].default_value = 0
            links.new(color_source, shader.inputs['Emission Color'])
            shader.inputs['Emission Strength'].default_value = 1
    if args.render_no_normal:
        for material in bpy.data.materials:
            if not material.use_nodes:
                continue
            for node in material.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    for link in list(node.inputs['Normal'].links):
                        material.node_tree.links.remove(link)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('Neutral studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.35, .40, .48, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    for location, energy, size in [((-3, -4, 5), 550, 4), ((3, -2, 3), 350, 3), ((0, 3, 4), 600, 3)]:
        bpy.ops.object.light_add(type='AREA', location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.shape = 'DISK'
        light.data.size = size
        light.rotation_euler = (Vector((0, 0, 1.25)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 0, -.002))
    ground = bpy.context.object
    ground_material = bpy.data.materials.new('Ground')
    ground_material.diffuse_color = (.22, .25, .29, 1)
    ground.data.materials.append(ground_material)
    for name, position, look_at, focal, resolution in [
        ('body', (2.1, -4.1, 1.85), (0, -.02, .92), 62, (900, 1100)),
        ('face', (.30, -1.1, 1.67), (0, -.09, 1.59), 85, (1000, 1000)),
        ('profile', (1.15, -.22, 1.68), (0, -.03, 1.58), 85, (1000, 1000)),
    ]:
        if name not in args.render_views.split(','):
            continue
        bpy.ops.object.camera_add(location=position)
        camera = bpy.context.object
        camera.data.lens = focal
        camera.rotation_euler = (Vector(look_at) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        scene.camera = camera
        scene.render.resolution_x, scene.render.resolution_y = resolution
        scene.render.filepath = os.path.join(render_dir, 'rocketbox17-' + name + '.png')
        bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(camera, do_unlink=True)
