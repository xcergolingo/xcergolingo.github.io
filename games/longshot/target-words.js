import * as THREE from './vendor/three.module.js';

// Word signs belong to their targets, so movement and hit animations stay aligned.
// Text is painted into a canvas rather than interpreted as HTML.
export function createTargetWords() {
  const labels = new Map();
  const worldPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const delta = new THREE.Vector3();
  let disposed = false;
  let segmenter;
  try { segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); } catch {}

  const wordFont = '600 58px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif';
  const translationFont = '400 30px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif';
  const clean = value => (typeof value === 'string' || typeof value === 'number')
    ? String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/gu, ' ').trim().slice(0, 512)
    : '';
  const graphemes = text => segmenter
    ? Array.from(segmenter.segment(text), part => part.segment)
    : Array.from(text);

  function ellipsize(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const chars = graphemes(text);
    while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
    return chars.join('').trimEnd() + '…';
  }

  // Prefer whole words when a language uses spaces; CJK and long tokens can
  // wrap at grapheme boundaries without splitting surrogate pairs or accents.
  function wrapWord(ctx, text, maxWidth) {
    const chars = graphemes(text);
    const lines = [];
    let start = 0;
    while (start < chars.length && lines.length < 2) {
      while (start < chars.length && /^\s+$/u.test(chars[start])) start++;
      if (start >= chars.length) break;
      if (lines.length === 1) {
        lines.push(ellipsize(ctx, chars.slice(start).join(''), maxWidth));
        break;
      }
      let end = start, lastSpace = -1;
      while (end < chars.length) {
        const candidate = chars.slice(start, end + 1).join('');
        if (ctx.measureText(candidate).width > maxWidth && end > start) break;
        if (/^\s+$/u.test(chars[end])) lastSpace = end;
        end++;
      }
      if (end < chars.length && lastSpace > start) end = lastSpace;
      if (end === start) end++;
      lines.push(chars.slice(start, end).join('').trim());
      start = end;
    }
    return lines.length ? lines : ['…'];
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function draw(record, showTranslation) {
    const item = record.target.lessonItem;
    const word = clean(item?.word || item?.sentence || item?.text);
    const translation = showTranslation ? clean(item?.translation || item?.sentenceTranslation) : '';
    const key = word + '\u0000' + translation;
    if (record.key === key) return;

    const { canvas, ctx } = record;
    ctx.font = wordFont;
    const lines = wrapWord(ctx, word, 460);
    let contentWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    ctx.font = translationFont;
    const translated = translation ? ellipsize(ctx, translation, 460) : '';
    if (translated) contentWidth = Math.max(contentWidth, ctx.measureText(translated).width);

    const width = Math.ceil(THREE.MathUtils.clamp(contentWidth + 56, 320, 520) / 2) * 2;
    const height = 38 + lines.length * 64 + (translated ? 44 : 0);
    canvas.width = width; canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    roundedRect(ctx, 2, 2, width - 4, height - 4, 13);
    ctx.fillStyle = 'rgba(13, 34, 37, 0.94)'; ctx.fill();
    ctx.strokeStyle = 'rgba(251, 113, 70, 0.85)'; ctx.lineWidth = 2.5; ctx.stroke();

    // A small warm accent remains visible when the target is viewed from afar.
    roundedRect(ctx, 12, 20, 4, height - 40, 2);
    ctx.fillStyle = '#fb7146'; ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = wordFont;
    ctx.direction = /[\u0590-\u08ff]/u.test(word) ? 'rtl' : 'ltr';
    ctx.fillStyle = '#f6efdf';
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], width / 2, 20 + i * 64 + 32, width - 44);
    if (translated) {
      ctx.font = translationFont;
      ctx.direction = /[\u0590-\u08ff]/u.test(translated) ? 'rtl' : 'ltr';
      ctx.fillStyle = '#f6ad7f';
      ctx.fillText(translated, width / 2, 20 + lines.length * 64 + 22, width - 44);
    }

    record.key = key;
    record.hasTranslation = Boolean(translated);
    record.ratio = width / height;
    record.baseWidth = Math.min(6 + (width - 320) / 100, 2.8 * record.ratio);
    record.texture.needsUpdate = true;
    record.sprite.scale.set(record.baseWidth, record.baseWidth / record.ratio, 1);
  }

  function assign(target, item, { showTranslation = true } = {}) {
    if (disposed || !target?.group?.isObject3D) return null;
    if (!item || !clean(item.word || item.sentence || item.text)) { remove(target); return null; }
    target.lessonItem = { ...item };
    let record = labels.get(target);
    if (!record) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const material = new THREE.SpriteMaterial({
        map: texture, transparent: true, depthTest: true, depthWrite: false,
        alphaTest: .02, toneMapped: false, fog: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.name = 'GoLingo target word';
      sprite.center.set(.5, 0);
      sprite.position.set(0, target.labelHeight ?? 5.05, 0);
      sprite.userData.isTargetWord = true;
      target.group.add(sprite);
      target.wordLabel = sprite;
      record = { target, canvas, ctx, texture, material, sprite, key: null, ratio: 1, baseWidth: 6, hasTranslation: false };
      labels.set(target, record);
    }
    draw(record, showTranslation);
    record.sprite.visible = target.alive !== false && !target.dead && target.group.visible !== false;
    return record.sprite;
  }

  function update(target, { visible = true, showTranslation = true, camera } = {}) {
    const record = labels.get(target);
    if (!record || disposed) return;
    const show = Boolean(visible && target.alive !== false && !target.dead && target.group.visible !== false);
    record.sprite.visible = show;
    if (!show) return;
    draw(record, showTranslation);
    if (!camera?.isCamera) return;

    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    record.sprite.getWorldPosition(worldPosition);
    const depth = delta.copy(worldPosition).sub(cameraPosition).dot(cameraDirection);
    if (depth <= Math.max(camera.near || .025, .025)) { record.sprite.visible = false; return; }

    const viewportHeight = Math.max(1, Number(camera.userData?.viewportHeight) || (typeof window !== 'undefined' ? window.innerHeight : 720) || 720);
    const viewportWidth = Math.max(1, Number(camera.userData?.viewportWidth) || viewportHeight * (camera.aspect || 16 / 9));
    let unitsPerPixel, scoped = false;
    if (camera.isPerspectiveCamera) {
      const fov = camera.getEffectiveFOV();
      scoped = fov < 40;
      unitsPerPixel = 2 * depth * Math.tan(THREE.MathUtils.degToRad(fov) / 2) / viewportHeight;
    } else if (camera.isOrthographicCamera) {
      unitsPerPixel = Math.abs(camera.top - camera.bottom) / Math.max(camera.zoom, .001) / viewportHeight;
    } else return;

    // The ordinary view uses compact signs. Through the scope they can become
    // larger, but never expand into a card that covers the center of the view.
    const maxPixels = scoped ? Math.min(220, viewportWidth * .56) : Math.min(150, viewportWidth * .29);
    const readablePixels = record.hasTranslation
      ? THREE.MathUtils.clamp(record.canvas.width * 8.2 / 30, 78, 124)
      : THREE.MathUtils.clamp(record.canvas.width * 12 / 58, 68, 108);
    const minPixels = Math.min(maxPixels, scoped ? Math.max(100, readablePixels) : readablePixels);
    const basePixels = record.baseWidth / Math.max(unitsPerPixel, .00001);
    const pixelWidth = THREE.MathUtils.clamp(basePixels, minPixels, maxPixels);
    const worldWidth = pixelWidth * unitsPerPixel;
    record.sprite.scale.set(worldWidth, worldWidth / record.ratio, 1);
  }

  function remove(target) {
    const record = labels.get(target);
    if (record) {
      record.sprite.removeFromParent();
      record.texture.dispose(); record.material.dispose();
      // Sprite geometry is shared by Three.js; only our texture/material belong here.
      labels.delete(target);
    }
    if (target) { delete target.wordLabel; delete target.lessonItem; }
  }

  function dispose() {
    for (const target of labels.keys()) remove(target);
    disposed = true;
  }

  return { assign, update, remove, dispose };
}
