# Longshot — Word Marksman

A language-learning Three.js r170 sniper game for desktop and touch browsers. All city architecture, targets, rifle parts, textures, lighting, and sound effects are generated in code. The Three.js distribution and license are included locally, so the game has no runtime CDN dependency.

## Play

Serve `dist/` with an HTTP static server. Opening `index.html` as a `file://` URL does not support its JavaScript modules. The hosted version uses the static directory declared in `.openai/hosting.json`.

Choose a difficulty on the start screen:

- **Relaxed:** orange training targets across three rounds of 6, 8, and 10 targets. There is no time limit by default. The optional Timed challenge setting adds a countdown and remaining-time bonuses. Small bright centers and head plates award precision bonuses.
- **Hard — Walking patrols:** stylized people walk around the rooftops with moving arms and legs, natural turns, brief pauses, and changes in direction. Solid rooftop cover blocks shots until a character steps into view. Three rounds have 8, 10, and 12 characters with faster patrols and limits of 85, 95, and 110 seconds. Hard always uses a timer and disables aim slowdown; Find still helps locate a patrol. Head hits award precision bonuses.

Both difficulties support **Learn & Play**, **Listen & Find**, and Classic mode. **Listen & Find** now has two listening levels. **Easy** keeps an assisted Find button that centers the correct target and repeats the prompt. **Challenge** is the default: Find becomes Hear, which only repeats the prompt and never moves the camera or points to the answer. Tapping/clicking a visible target plays that target's word for comparison; the orange Fire button or F key is the deliberate shot. Shooting the matching word advances to a new random prompt. Shooting any different word ends the run immediately and the player must restart. Easy and Challenge keep separate best scores for Relaxed and Hard.

Both difficulties support language learning and Classic mode. Word labels stay attached to the characters, and a hit teaches the word carried by that target. The rifle holds 5 rounds, uses a 2.1-second reload, and cycles its bolt between shots. A new supply box becomes available when reserves are depleted. Best scores are saved separately for each difficulty. Difficulty changes during a run apply on the next restart, and the selected difficulty is remembered locally. Aim assist and optional timed challenge preferences apply to Relaxed mode.

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
- `dist/patrols.js` — articulated walking characters, bounded patrol routes, and solid rooftop cover
- `dist/world.js` — procedural skyline, harbor, rooftops, and lighting
- `dist/weapon.js` — camera-attached rifle and animation
- `dist/learning.js` — content, repeating speech, import/export, native hooks
- `dist/target-words.js` — cached canvas-text word labels above targets
- `dist/vendor/` — Three.js r170 and license

## Publication

The public game is hosted at `https://xcergolingo.github.io/games/longshot/` and appears in the GoLingo gallery under Shooting, Action, FPS, Language Learning, Words, and Sentences. All game links navigate in the same browser view.

## Verification

JavaScript syntax checks pass. A Node harness using real Three.js geometry, camera transforms, and raycasts, with mocked browser DOM/audio/renderer, completed all 24 hits across three rounds and checked scoring, precision hits, reloading, cooldown, scope state, pause, timeout, restart, and Japanese payload learning/export. Independent geometry checks passed 1,500 target sightlines and 270 target-mesh intersections from multiple rooftop positions. Responsive interface layouts were inspected separately.

The Hard-mode harness completed all 30 walking targets and an intentionally blocked cover shot, and verified that each successful hit collected the corresponding lesson word. It checked pause/resume, the timer, difficulty changes on restart, separate score histories, and removal of old cover. A 40-second simulation of all 12 rooftops at all three speed tiers checked bounded routes, articulated gait, pauses, turns, and both covered and exposed shooting windows. The updated difficulty selector and Start control were checked at 320×568, 390×844, 844×390, and 1280×800.

The available preview browser reported its WebGL renderer as disabled. GPU rendering, visual scene quality, device performance, and actual mobile audio playback could not be verified in that environment.
