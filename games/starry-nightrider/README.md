# Starry Nightrider — GoLingo

An original, free-roaming Three.js r170 bicycle game inspired by the public-domain painting *The Starry Night* (1889). It opens with an eight-second original animated painting video and automatically becomes a ride (or tap **Ride Now** to skip). Explore an interconnected 600 m painterly region, collect luminous vocabulary orbs, find stardust speed rings, and return to the church's golden beam to bank points. The 3D world, buildings, cypresses, bike and rider are procedural, with custom painted material textures. The swirling sky uses an original panoramic illustration.

**Version 9 / GitHub comparison build:** `https://xcergolingo.github.io/games/starry-nightrider/`. This version has new brush-painted cobbles and meadow textures, more closely spaced multicolored homes, extra window frames/shutters/chimneys, and spatially culled detail batches. It is intentionally separate from the existing hosted version while performance and appearance are compared.

## Run it

No build step is needed. Serve the `dist` directory with a local HTTP server and open `index.html`:

```sh
cd dist
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`. Browsers require a local server for JavaScript ES modules; double-clicking an HTML file directly may not allow module imports. Three.js is bundled at `dist/assets/three.module.js`, so no third-party CDN is needed. If WebGL 2 is unavailable, the page loads the earlier canvas riding game.

## Controls

| Keyboard | Action |
|---|---|
| W / Up | Pedal faster |
| S / Down | Brake |
| A/D or Left/Right | Steer |
| Space | Jump; press again in the air to boost (up to three times) |
| E | Aerial barrel roll / style move |
| Enter | Finish ride and see score |
| Esc / P | Pause or resume |
| R | Repeat the current word |
| M | Turn automatic word pronunciation on/off |

Mobile has a forgiving, one-thumb **analogue joystick** to steer. Drag the joystick up for a speed boost, down to brake, or use the separate brake button. Auto-pedal starts ON; tap **Cruise On** to toggle it. Jump and trick buttons are on the right. The fullscreen button attempts landscape rotation when the browser permits it.

The steering touch target now explicitly receives pointer events in iPhone Safari/WKWebView, captures your thumb for the duration of a drag, and releases safely when interrupted. Hold and slide your thumb **left to turn left** or **right to turn right**. The cyclist has a modeled tapered cobalt coat, articulated sleeves, dark trousers, reddish hair and beard, a smaller straw hat, a square leather satchel, and a flexible wind-animated scarf, based on the visual reference.

The top **Voice On / Voice Off** switch mutes automatic vocabulary speech without muting collectible sound effects. In Pause settings, turn off repeat, toggle the word voice, or choose 1.2, 2.2 (default), 3.2, or 4.8 seconds between pronunciations. A muted word can still be spoken manually by tapping it. Preferences are saved locally.

## Mobile performance and painterly detail

The village retains its connected lanes and seven explorable districts, with glowing street-lamp pools, golden hanging lanterns and wildflower meadows. The v9 compressed WebP textures use **fine hand-painted pink-lilac cobbles** with visible strokes, warm olive-colored meadow grass, more neutral irregular limestone walls and muted red tiled roofing. UV-mapped gables, half-timbered facades, instanced shutters and window frames give the village a more colorful, lived-in look.

Repeated buildings, roofs, window frames, lamp posts, cypress trees, meadows, distant hills, orchard trunks/canopies and most chapel sparkles use GPU instancing. Stars use one point-cloud draw instead of dozens of individual glow sprites. **All glowing vocabulary orbs share just three GPU-instanced meshes** (sphere, halo and ring) instead of requiring three separate draw objects per orb. Distant word labels are generated only when needed. Version 9 spreads denser homes across all road districts (196 on mobile vs 100 before; 292 on desktop vs 174 before). It groups static buildings into spatial GPU batches, so those outside the camera can be culled. The automated mobile scene inspection finds 412 mesh batches / 246,346 indexed triangles in total, but 260 batches are visible at the start view. These are scene-structure measurements, not measured iPhone frame rates.

The scene uses two static point lights plus the bicycle spotlight, moonlight and hemispherical ambient light; costly dynamic shadow maps are disabled. Mobile stone and roof surfaces use lightweight unlit paint materials. The 3D frame is only drawn occasionally while the cinematic or pause menu covers the scene. During active rides an automatic resolution scaler reduces pixel ratio if the frame rate drops. On browsers without WebGL 2, the illustrated 2D fallback now uses the refined street, house and roof textures, caches the still background, draws paving in one clipped image pass, and uses a reduced mobile pixel ratio and paced redraws. Performance depends on the device; the exact frame rate has not been measured on a physical iPhone.

## Game loop

1. Watch or skip the cinematic opening. Explore the winding central village, market, vineyard, windmill ridge, orchard, lantern-lined lanes, and moonlit canal; use the circular minimap to navigate.
2. Collect the glowing orbs. Each speaks its assigned learning-language word and repeats until the next word is collected.
3. Ride into the church's golden beam to deposit orbs and score 10 points each. An example sentence is spoken at delivery when available.
4. Ride through magical stardust rings for short speed boosts and bonus points; visit new districts for exploration points and earn style points for mid-air tricks.
5. Keep riding indefinitely; or press Enter to see the final score. The best score is saved locally in the browser.

## Import GoLingo data

The game accepts the same JSON schema as other GoLingo games:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    {"id":"101", "word":"水", "translation":"water", "sentence":"水を飲みます。", "sentenceTranslation":"I drink water."}
  ]
}
```

For short data, pass it as URL-encoded `?data=...`. For large datasets, **use postMessage**, avoiding URI-too-long errors:

```js
gameIframe.contentWindow.postMessage({ type: 'golingoWords', payload: myData }, '*');
```

In WKWebView you may also call `window.loadGoLingoWords(myData)` with properly JSON-serialized data via `evaluateJavaScript`. The game exposes `window.receiveGoLingoData` and `window.receiveGoLingoWords` aliases. If an entry provides `audioURL` or `audioUrl`, that file is used; otherwise the game uses speech synthesis. Collection and delivery events are posted to the parent window as `GOLINGO_GAME_EVENT`.

## Project files

- `dist/index.html` — markup, controls and WebGL fallback loader.
- `dist/styles.css` — adaptive HUD and mobile layout.
- `dist/game-3d.js` — fully commented Three.js world, bicycle, collectibles, camera, physics, language audio and UI.
- `dist/fallback.js` — previous canvas game for devices without WebGL 2.
- `dist/assets/starry-sky.webp` — generated original painterly panorama.
- `dist/assets/starry-intro.mp4` — original eight-second cinematic (muted autoplay with skip).
- `dist/assets/starry-intro.webp` — matching poster for mobile autoplay fallback.
- `dist/assets/cobbles-v9.webp` — hand-painted fine pink-lilac village paving (current).
- `dist/assets/meadow-v9.webp` — hand-painted olive-green grass and soft impasto strokes (current).
- `dist/assets/cobblestones-refined.webp` — previous paving texture retained for rollback.
- `dist/assets/stonewall-refined.webp` — refined pale stone wall texture (current).
- `dist/assets/roof-refined.webp` — refined muted terracotta roof texture (current).
- `dist/assets/painted-*.webp` — previous-generation paint textures retained for comparison/rollback.
- `dist/assets/three.module.js` — bundled Three.js r170 (MIT license in `three-LICENSE.txt`).

This is an original game adaptation, not a copy of the reference site's source or assets.
