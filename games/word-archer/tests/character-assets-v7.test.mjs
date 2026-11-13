import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const dist = new URL('../', import.meta.url);
const bytes = readFileSync(new URL('assets/archer-realistic.glb', dist));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());

test('realistic character is a compact, self-contained GLB with embedded textures', () => {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert(bytes.length < 8 * 1024 * 1024, 'Keep the mobile character download below 8 MiB');
  assert(gltf.skins.length >= 1);
  assert(gltf.skins[0].joints.length >= 60, 'Use an actual articulated human skeleton');
  assert(gltf.meshes.some(mesh => mesh.primitives.some(p => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined)));
  assert(gltf.images.length >= 3, 'Face, clothes and hair need their original texture maps');
  for (const buffer of gltf.buffers) assert.equal(buffer.uri, undefined);
  for (const image of gltf.images) {
    assert.equal(image.uri, undefined, 'Do not depend on an external texture URL');
    assert(['image/png', 'image/jpeg'].includes(image.mimeType));
    const view = gltf.bufferViews[image.bufferView];
    assert(view && view.byteLength > 100);
    assert((view.byteOffset || 0) + view.byteLength <= gltf.buffers[view.buffer || 0].byteLength);
  }
});

test('face keeps detailed shading while hair has stable alpha-cutout rendering', () => {
  const head = gltf.materials.find(m => /head/i.test(m.name));
  const body = gltf.materials.find(m => /body/i.test(m.name));
  const hair = gltf.materials.find(m => /opacity/i.test(m.name));
  assert(head?.pbrMetallicRoughness.baseColorTexture);
  assert(head.normalTexture, 'Preserve the facial surface normal map');
  assert(body?.pbrMetallicRoughness.baseColorTexture);
  assert.equal(head.pbrMetallicRoughness.metallicFactor, 0);
  assert.equal(hair?.alphaMode, 'MASK');
  assert(hair.alphaCutoff > 0 && hair.alphaCutoff < 1);
  assert.equal(hair.doubleSided, true);
});

test('new character and engine version cannot reuse the old cached character build', () => {
  const index = readFileSync(new URL('index.html', dist), 'utf8');
  const main = readFileSync(new URL('main-v6.js', dist), 'utf8');
  const rig = readFileSync(new URL('archer-rig-v6.js', dist), 'utf8');
  assert(index.includes('main-v6.js?v=7'));
  assert(index.includes('Human archer · v7'));
  assert(main.includes('archer-rig-v6.js?v=7'));
  assert(rig.includes('archer-realistic.glb'));
  assert(!rig.includes('archer-michelle.glb'));
});
