# Starry Nightrider — GoLingo

An original, free-roaming Three.js r170 bicycle game inspired by the public-domain painting *The Starry Night* (1889). It opens with an eight-second original animated painting video; **tap Ride Now** to begin with sound. Explore an interconnected painterly region, collect luminous vocabulary orbs, find stardust speed rings, and return to the church's golden beam to bank points. The 3D world, buildings, cypresses, bike and rider are procedural, with custom painted material textures. The swirling sky uses an original panoramic illustration.

**Version 13 / GitHub release:** `https://xcergolingo.github.io/games/starry-nightrider/`. Text selection, tap highlighting and long-press callouts are disabled throughout the game UI, including labels, words, menus and controls. Text-entry fields and keyboard focus indicators remain usable, and the Copy Words button still works. This focused interaction update preserves v12's smooth landscape, paving, fields and cyclist, plus all existing audio and gameplay features.

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

Mobile has a forgiving, one-thumb **analogue joystick** to steer. Version 10 increases its diameter to 142px on common phones (118px on very narrow phones; 110px in short landscape) and stacks the cruise and brake buttons beside it. Drag the joystick up for a speed boost, down to brake, or use the separate brake button. Auto-pedal starts ON; tap **Cruise On** to toggle it. Jump and trick buttons are on the right. The fullscreen button attempts landscape rotation when the browser permits it.

The steering touch target explicitly receives pointer events in iPhone Safari/WKWebView, captures your thumb for the duration of a drag, and releases safely when interrupted. Hold and slide your thumb **left to turn left** or **right to turn right**. The cyclist has a painted cobalt coat texture, articulated sleeves, animated flapping coat tails, speed-sensitive shoulder posture, dark trousers, realistic pedal timing, reddish hair and beard, a detailed straw hat, a leather satchel, and a wind-animated scarf. The mobile chase camera sits closer so these details are visible.

The top **Audio On / Audio Off** control manages original quiet riding ambience, wheel/wind sounds and bells. **Voice On / Voice Off** independently manages vocabulary speech. Play and Resume explicitly resume the audio context inside the user's tap; the first word is spoken immediately from Play, without waiting for a pickup or timer. The muted intro no longer starts the game without a gesture. In Pause, **Test sound** plays a two-note bell and **Test word voice** tries the current learning word. A blocked audio/voice state is reported instead of silently claiming playback. Check phone media volume and Silent Mode if the sound test remains inaudible.

Pause settings also offer 1.2, 2.2 (default), 3.2, or 4.8 seconds between pronunciations. A muted word can still be spoken manually by tapping it. Preferences are saved locally. Audio pauses when the game is paused or the tab is hidden. Sound uses a bounded pool of reusable audio nodes, not a new oscillator per frame. The soundscape is original and does not reuse the reference video's soundtrack.

## Mobile performance and painterly detail

The village retains its connected lanes and seven explorable districts, with glowing street-lamp pools, golden hanging lanterns and wildflower meadows. Version 12 uses seamless, lower-contrast paving and meadow textures to reduce visual grain and shimmer. All roads and the central square use the same stone size, orientation, height and material. Soft road shoulders replace raised curb lines at intersections. Field colors blend continuously with feathered borders rather than random triangular color changes. UV-mapped gables, half-timbered facades, instanced shutters and window frames give the village a more colorful, lived-in look.

Repeated buildings, roofs, window frames, lamp posts, cypress trees, meadows, orchard trunks/canopies and most chapel sparkles use GPU instancing. Three smooth, connected hill surfaces replace the 44 low-sided spheres. The road network uses one paving mesh and one feathered-shoulder mesh. Stars use one point-cloud draw instead of dozens of individual glow sprites. **All glowing vocabulary orbs share just three GPU-instanced meshes** (sphere, halo and ring) instead of requiring three separate draw objects per orb. Distant word labels are generated only when needed. Static architecture is grouped by geometry/material and spatial block, allowing off-camera blocks to be culled. Sunflower heads, stalks and leaves are also instanced by field block.

The cyclist has a narrow tapered coat, smaller head and boater hat, a slim leather satchel, long thin articulated limbs, speed-linked pedal rotation, fixed handlebar hands and a thin vintage bicycle. V12 adds smoothly interpolated body/head contours, connected rounded sleeves and trousers, softer satchel corners and damped body/steering motion. Five house variants provide separate wall-colored gables, steep red/clay/slate roof slopes, multi-storey windows, shutters, sills, chimneys, occasional dormers and café awnings. Native model renders and structural tests are useful checks, but are not a measured frame rate or visual test on a physical iPhone.

The scene uses two static point lights plus the bicycle spotlight, moonlight and hemispherical ambient light; costly dynamic shadow maps are disabled. Mobile stone and roof surfaces use lightweight unlit paint materials. Native edge antialiasing is enabled. The 3D frame is only drawn occasionally while the cinematic or pause menu covers the scene. During active rides an automatic resolution scaler adjusts pixel ratio (mobile 0.85–1.12) from sustained frame timing. The v12 mobile source test contains 402 meshes / 277,190 triangles versus 449 meshes / 305,064 triangles in v11; these are scene totals, not measured FPS. On browsers without WebGL 2, the illustrated 2D fallback uses the new paving texture, caches the still background and draws paving in one clipped image pass. Performance depends on the device; the exact frame rate has not been measured on a physical iPhone.

## Game loop

1. Tap Ride Now during or after the cinematic opening to activate sound. Explore the winding central village, sunflower fields, market, vineyard, windmill ridge, orchard, lantern-lined lanes, and moonlit canal; use the circular minimap to navigate.
2. Collect the glowing orbs. Each speaks its assigned learning-language word and repeats until the next word is collected.
3. Ride into the church's golden beam to deposit orbs and score 10 points each. An example sentence is spoken at delivery when available.
4. Ride through magical stardust rings for speed boosts and bonus points. Look for **13 glowing turquoise moonlight circles** along the roads: biking through one launches the cyclist skyward and awards +8 points. Visit new districts for exploration points and earn style points for mid-air tricks.
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
- `dist/interaction-guard.js` — shared selection/long-press protection for both renderers.
- `dist/styles.css` — adaptive HUD and mobile layout.
- `dist/game-3d.js` — fully commented Three.js world, bicycle, collectibles, camera, physics, language audio and UI.
- `dist/rider-model.js` — reusable slim cyclist/bicycle model and pedal animation.
- `dist/village-models.js` — five reusable, batchable detailed house models.
- `dist/countryside.js` — painted cultivated fields and instanced tall sunflowers.
- `dist/landscape-model.js` — three continuous, smoothly shaded mountain/foothill layers.
- `dist/road-model.js` — consistent world-space paving and soft open-junction shoulders.
- `dist/audio-engine.js` — mobile-gesture-aware original riding soundscape.
- `dist/fallback.js` — previous canvas game for devices without WebGL 2.
- `dist/assets/starry-sky.webp` — generated original painterly panorama.
- `dist/assets/starry-intro.mp4` — original eight-second cinematic (muted autoplay with skip).
- `dist/assets/starry-intro.webp` — matching poster for mobile autoplay fallback.
- `dist/assets/paving-smooth-v12.webp` — seamless, low-contrast rounded paving stones (current).
- `dist/assets/meadow-smooth-v12.webp` — seamless broad meadow color and soft strokes (current).
- `dist/assets/cobbles-v9.webp` / `meadow-v9.webp` — previous textures retained for rollback.
- `dist/assets/cobblestones-refined.webp` — previous paving texture retained for rollback.
- `dist/assets/stonewall-refined.webp` — refined pale stone wall texture (current).
- `dist/assets/roof-refined.webp` — refined muted terracotta roof texture (current).
- `dist/assets/painted-*.webp` — previous-generation paint textures retained for comparison/rollback.
- `dist/assets/three.module.js` — bundled Three.js r170 (MIT license in `three-LICENSE.txt`).

This is an original game adaptation, not a copy of the reference site's source or assets.

## Verification

`node tests/game-smoke.mjs` and `node tests/game-smoke.mjs --desktop` exercise 40 source-level gameplay/audio checks with real Three.js models and a mocked browser renderer. `node tests/interaction-guard-smoke.mjs` verifies selection prevention without blocking native editing or gameplay input. `node tests/landscape-smoke.mjs` and `node tests/road-smoke.mjs` verify geometry and surface consistency. `tests/chase-preview.mjs` produces a native CPU geometry preview; it is not a browser screenshot or performance test. `node tests/bake-ground-textures.mjs` deterministically regenerates the two v12 ground assets offline.
