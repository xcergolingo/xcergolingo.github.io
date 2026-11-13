# Starry Nightrider — GoLingo

An original, free-roaming Three.js r170 bicycle game inspired by the public-domain painting *The Starry Night* (1889). It opens with an eight-second original animated painting video; **tap Ride Now** to begin with sound. Explore an interconnected painterly region, collect luminous vocabulary orbs, find stardust speed rings, and return to the church's golden beam to bank points. The 3D world, buildings, cypresses, bike and rider are procedural, with custom painted material textures. The swirling sky uses an original panoramic illustration.

**Version 11 / GitHub release:** `https://xcergolingo.github.io/games/starry-nightrider/`. This update replaces the cyclist and house models, composes close-set village streets beside broad curved golden/green fields, adds tall recognizable sunflowers, and fixes tap-to-start audio. It keeps the large steering wheel, jump/trick controls, GoLingo data bridge, collection, and delivery game loop.

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

The village retains its connected lanes and seven explorable districts, with glowing street-lamp pools, golden hanging lanterns and wildflower meadows. The v9 compressed WebP textures use **fine hand-painted pink-lilac cobbles** with visible strokes, warm olive-colored meadow grass, more neutral irregular limestone walls and muted red tiled roofing. UV-mapped gables, half-timbered facades, instanced shutters and window frames give the village a more colorful, lived-in look. Version 10 adds detailed cottages near the spawn point and a warm outdoor café with parasols and tables.

Repeated buildings, roofs, window frames, lamp posts, cypress trees, meadows, distant hills, orchard trunks/canopies and most chapel sparkles use GPU instancing. Stars use one point-cloud draw instead of dozens of individual glow sprites. **All glowing vocabulary orbs share just three GPU-instanced meshes** (sphere, halo and ring) instead of requiring three separate draw objects per orb. Distant word labels are generated only when needed. The v11 village uses fewer, more carefully placed detailed homes rather than scattered identical boxes. Static architecture is grouped by geometry/material and spatial block, allowing off-camera blocks to be culled. Sunflower heads, stalks and leaves are also instanced by field block.

The replacement cyclist has a narrow tapered coat, smaller head and boater hat, a slim leather satchel, long thin articulated limbs, speed-linked pedal rotation, fixed handlebar hands and a thin vintage bicycle. Five house variants provide separate wall-colored gables, steep red/clay/slate roof slopes, multi-storey windows, shutters, sills, chimneys, occasional dormers and café awnings. Native model renders and structural tests are useful checks, but are not a measured frame rate or visual test on a physical iPhone.

The scene uses two static point lights plus the bicycle spotlight, moonlight and hemispherical ambient light; costly dynamic shadow maps are disabled. Mobile stone and roof surfaces use lightweight unlit paint materials. The 3D frame is only drawn occasionally while the cinematic or pause menu covers the scene. During active rides an automatic resolution scaler reduces pixel ratio if the frame rate drops. On browsers without WebGL 2, the illustrated 2D fallback now uses the refined street, house and roof textures, caches the still background, draws paving in one clipped image pass, and uses a reduced mobile pixel ratio and paced redraws. Performance depends on the device; the exact frame rate has not been measured on a physical iPhone.

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
- `dist/styles.css` — adaptive HUD and mobile layout.
- `dist/game-3d.js` — fully commented Three.js world, bicycle, collectibles, camera, physics, language audio and UI.
- `dist/rider-model.js` — reusable slim cyclist/bicycle model and pedal animation.
- `dist/village-models.js` — five reusable, batchable detailed house models.
- `dist/countryside.js` — painted cultivated fields and instanced tall sunflowers.
- `dist/audio-engine.js` — mobile-gesture-aware original riding soundscape.
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
