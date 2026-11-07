# Longshot — Word Marksman

A language-learning Three.js r170 sniper game for desktop and touch browsers. All city architecture, targets, rifle parts, textures, lighting, and sound effects are generated in code. The Three.js distribution and license are included locally, so the game has no runtime CDN dependency.

## Play

Serve `dist/` with an HTTP static server. Opening `index.html` as a `file://` URL does not support its JavaScript modules. The hosted version uses the static directory declared in `.openai/hosting.json`.

Hit orange training targets across three rounds: 6 stationary targets, 8 moving targets, then 10 mixed-distance moving targets. Small bright centers and head plates award precision bonuses. Relaxed practice has no time limit by default. Enable Timed challenge for a countdown and remaining-time bonuses. The rifle holds 5 rounds, uses a 2.1-second reload, and cycles its bolt between shots. A new supply box becomes available when reserves are depleted. Best score and preferences are saved locally.

### Controls

| Action | Desktop | Touch |
|---|---|---|
| Aim | Drag the view | Drag the view |
| Move | WASD or arrow keys | Left thumbstick |
| Fire | Click or F | Fire button |
| Scope | Space, Q, or right click | Scope button |
| Magnification | Z, mouse wheel in scope, or zoom button | 2×/4×/8× button |
| Steady aim | Hold Shift | Hold Steady |
| Reload | R | Reload button |
| Find a target | H | Find button |
| Pause | Escape | Pause button |

Both portrait and landscape layouts are supported. Drag controls never trigger a pause overlay. The game pauses when its page becomes hidden.

## Language learning

**Learn & Play** is selected by default. Each rooftop target carries a word and optional translation. Hitting it records and pronounces that exact item, and pronunciation repeats until another word is selected or the game is paused. The starting vocabulary rotates on each run. The compact word card can be hidden with **Aa**, and tapped to replay. Settings independently hide target labels or translations. The sentence button opens and speaks the selected word’s example sentence. Repeat can be switched off. The collection button lists reviewed words and exports GoLingo-compatible JSON. Sixteen Spanish/English examples are included. Selecting a voice language does not translate the loaded words; load matching content for other languages.

The game recognizes the gallery’s `#golingoLesson=` payload and `golingo:active-lesson:v1` tab storage, including `translationLanguage` and `words`, `sentences`, `phrases`, `items`, or `entries` arrays. Explicit URL lessons take priority. Settings accepts lines such as `cielo = sky`, tab-separated pairs, or JSON:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    { "id": "1", "word": "空", "translation": "sky", "sentence": "空は青いです。", "sentenceTranslation": "The sky is blue." }
  ]
}
```

`audioUrl`, `audioURL`, or `wordAudioUrl` takes priority over browser speech synthesis. Otherwise TTS selects a voice matching the learning language when available. Audio begins after a player action. Available TTS voices depend on the device.

Native/web integrations may call `window.setGoLingoData(payload)` or `window.receiveGoLingoData(payload)`, or send `postMessage({type:'GOLINGO_DATA',payload}, targetOrigin)`. The game also reads JSON from `golingoLesson`, `lesson`, `data`, `payload`, `golingo`, or `golingoData` query/hash parameters. Successful imports enable learning mode. The module only consumes the supplied vocabulary; it exposes no account or private application data.

## Files

- `dist/index.html` — interface and dialogs
- `dist/style.css` — desktop, portrait, and landscape layouts
- `dist/game.js` — input, targets, raycast scoring, rounds, audio, and UI
- `dist/world.js` — procedural skyline, harbor, rooftops, and lighting
- `dist/weapon.js` — camera-attached rifle and animation
- `dist/learning.js` — content, repeating speech, import/export, native hooks
- `dist/target-words.js` — cached canvas-text word labels above targets
- `dist/vendor/` — Three.js r170 and license

## Publication

The public game is hosted at `https://xcergolingo.github.io/games/longshot/` and appears in the GoLingo gallery under Shooting, Action, FPS, Language Learning, Words, and Sentences. All game links navigate in the same browser view.

## Verification

JavaScript syntax checks pass. A Node harness using real Three.js geometry, camera transforms, and raycasts, with mocked browser DOM/audio/renderer, completed all 24 hits across three rounds and checked scoring, precision hits, reloading, cooldown, scope state, pause, timeout, restart, and Japanese payload learning/export. Independent geometry checks passed 1,500 target sightlines and 270 target-mesh intersections from multiple rooftop positions. Responsive interface layouts were inspected separately.

The available preview browser reported its WebGL renderer as disabled. GPU rendering, visual scene quality, device performance, and actual mobile audio playback could not be verified in that environment.
