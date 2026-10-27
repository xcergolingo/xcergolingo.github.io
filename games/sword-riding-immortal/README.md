# 御剑飞仙 — Sword Riding Immortal

A serene, procedural Three.js flight and language-learning demo.

**Play:** https://xcergolingo.github.io/games/sword-riding-immortal/

**Game hub:** https://xcergolingo.github.io/games/

 Open `index.html` directly in a WebGL 2 capable browser. The engine, scenery, shaders, UI and synthesized ambient audio are embedded: no network connection or asset downloads are required.

## Controls

- WASD or arrow keys: fly relative to the camera.
- Mouse drag: look around. Double-click: optional mouse lock; Escape releases it.
- Space: rise or take off.
- Shift / Control: descend. Lower gently onto a courtyard or bridge to land.
- E: faster flight. P: pause. R: return to arrival. M: cloud atlas. H: hide the HUD.
- Touch: left movement wheel, drag the open right side to look, hold altitude / boost buttons.
- The sound button enables the optional quiet pentatonic soundtrack after a user gesture.

Five sanctuaries can be discovered by approaching their courtyards. The atlas offers quick travel. Flight is bounded by a generous 2.3 km diameter; the cloud and mountain scenery extends farther.

## Source

- `src/game.js`: commented procedural world, flight, collision, clouds, music and effects.
- `src/template.html`: responsive interface.
- `src/engine.js`: Three.js and postprocessing imports.
- `build.mjs`: embeds the engine and readable game source into one HTML file.

To rebuild, install the versions in `package.json` using npm, then run `npm run build`. Three.js is MIT licensed; its notices are retained in the embedded engine.

High mode enables shadows, bloom, vignette and subtle depth of field. Soft mode reduces render resolution and disables depth of field and shadows. A conservative one-time performance check can choose Soft automatically; an explicit user choice takes precedence.

## Verification

Syntax and offline dependency checks passed. CPU-side scene construction and gameplay checks cover finite geometry, flight, braking, boost, platform landing, takeoff, bridge height, palace collision, pause/resume, touch wheel release, and animated geometry. GPU rendering could not be visually verified in the development preview because its browser reports WebGL disabled. This is a desktop-first demo with touch controls; physical mobile-device performance is not yet verified.

## Reference character update

The current reference uses long black hair, a gold floral hairpin, delicate face details, embroidered ivory robes, wider bell sleeves, layered pale-blue sashes and a slender cyan sword with gold filigree. The hair, skirt panels and chiffon streamers move with flight. Open **? → View immortal** to orbit the actual model, then select **Return to flight**. Geometry was inspected with a CPU projection; GPU/mobile rendering remains unverified in this environment. Popup-card visibility remains independent of the words in the world.

## GoLingo game hub

The hub launches this game with a `#golingoLesson=` URL fragment containing an encoded JSON lesson. Both `primaryLanguage` and `translationLanguage` are accepted for the translation language, along with `learningLanguage`. The importer accepts words, sentences, phrases, items, or entries (up to 500). A valid launch lesson replaces the locally saved lesson; invalid data preserves it. Nothing is uploaded.

Visit a pavilion for its word and the central palace for the related sentence. The **Show card / Hide card** control affects only the popup: in-world labels stay visible and audio continues. Open **Learn 学习** to paste a lesson directly.

`npm install && npm run build` rebuilds the self-contained `index.html` beside this README. The GitHub Pages site serves this file without a build step.
