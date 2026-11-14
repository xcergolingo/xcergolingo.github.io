# GoLingo Sky Reach — Word Flight

A language-learning conversion of **Sky Reach — Walker Assault**. Learn vocabulary while flying through word signals, bringing down siege walkers, defending the Halcyon fleet, and exploring four worlds.

**Play:** https://xcergolingo.github.io/games/sky-reach-walker-assault/

The original game is preserved at [the pre-learning backup commit](https://github.com/xcergolingo/xcergolingo.github.io/tree/e27a7f526c7c72128cc78cad4ad516c41cdcfd74/games/sky-reach-walker-assault). This release builds on that exact copy.

## Play and learn

Launch starts in **Learn** mode with an English-to-Spanish demo unless you have a saved or supplied lesson. Open **WORDS** (or press **G**) before or during play to change modes, import a lesson, adjust speech, or review collected words. Opening the lesson panel pauses the game.

| Mode | Prompt | What to do |
| --- | --- | --- |
| Learn | Word and optional meaning | Fly through or shoot a signal, topple a walker, defeat a fighter, or mine a crystal. The collected word and its pronunciation stay with you until the next collection. |
| Listen | Spoken learning-language word; answer hidden in the HUD | Choose the matching word in the world. Replay the prompt whenever needed. |
| Meaning | Primary-language translation | Choose the learning-language word that matches it. |

In challenge modes, a wrong signal, walker, fighter, or crystal gives feedback without advancing the lesson. Correct actions collect the word and move to the next question. Completed lessons cycle for practice; the collected-word basket remains deduplicated. Signals grant two crystals as well as vocabulary.

Learning can be switched off to play the underlying adventure. The war never locks travel: leave a battle whenever you want.

### Your words and speech

- Import GoLingo JSON, JSON arrays, CSV, tab-separated lists, sentence lists, or one `word = meaning` pair per line.
- Imports replace the demo and start a new review basket. Select **Append** explicitly to extend a lesson with the same language pair and retain the basket.
- Built-in Spanish, Japanese, Chinese, French, and German lessons include example sentences. Loading a demo is an explicit action.
- Words, phrases, or example sentences can be practiced. Display, translation, and world-label visibility are independent settings.
- Pronunciation uses supplied word/sentence audio when present, otherwise the device's speech synthesis. Voice availability depends on the browser and installed languages.
- Word audio has its own on/off switch, separate from engine and battle sounds. Adjust voice, speed, repeat pause, sentence playback, and whether Learn reads the meaning.
- Replay works in the paused review panel. Automatic speech pauses with the game and resumes when play continues.
- Collected words keep their incoming IDs, language pair, example sentences, audio fields, and other JSON metadata. Export uses the GoLingo native bridge when available, or a JSON download; Copy JSON is also available.
- Lesson, settings, collected words, and game resources persist in browser storage when storage is available. Private browsing, quota limits, or clearing site data can prevent persistence; a valid import remains usable in the current tab.

See [GOLINGO-IMPORT.md](GOLINGO-IMPORT.md) for native, iframe, URL, and gallery integration.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Steer | WASD / arrows; mouse aim | Left stick; pull down to climb |
| Fire | Click / hold | Hold FIRE |
| Boost / tighten cable | Shift | Hold BOOST |
| Tow cable | F near a walker | TOW |
| Climb / descend | Space / C | Up / down |
| Orbit / fleet | H | ORBIT |
| Select destination | M map / T cycle | MAP |
| Pulse to destination | J | Context PULSE |
| Land / take off | L | LAND / LAUNCH |
| Exit / enter ship | E | EXIT / ENTER |
| Mine | Hold E near a deposit | Hold MINE |
| Jetpack | Space on foot | Up / JETPACK |
| Lesson and collected words | G | WORDS |
| Pause | Esc / P | Pause button |

The game uses a landscape stage on phones, including a rotated stage when a portrait-only webview cannot rotate the screen. Pointer lock is optional; Esc releases it.

## Runtime

Buildless vanilla Three.js with bundled Three.js r160. Serve this folder over HTTP(S); there is no install or build step. Open `index.html` from a static server. Direct `file:` URLs may block ES modules.

All geometry, terrain, effects, game sounds, and the starfield are generated locally. The game requires WebGL. No server, login, external model pack, or API key is needed. Optional imported pronunciation URLs are the only lesson-driven network audio requests; device speech services follow the browser's own behavior.

### Source layout

- `main.js`: flight, combat, walking, collection, and input integration.
- `lesson.js` / `bridge.js`: lesson normalization, challenge state, speech, review, and early GoLingo handoff.
- `learning-ui.js` / `learning.css`: compact HUD, lessons, imports, and collected-word review.
- `word-signals.js`: pooled world-space word gates and swept flight/projectile collection.
- `models.js`, `worlds.js`, `sky.js`, `effects.js`, `audio.js`: the original procedural world and audiovisual systems.
- `vendor/`: bundled Three.js and its MIT license.

## Verification

The release is checked with real-module CPU simulations of input, flight, cable tension, combat, travel, landing, mining, vocabulary collection, and import/bridge behavior. These simulations replace the GPU renderer only; they do not establish visual quality or frame rate.

Lesson tests cover large imports (10,000 entries), original metadata and IDs, language pairs, wrong/correct/stale answers, persistence, early bridge calls, and speech sequencing/error fallback. Browser UI checks cover the compact phone HUD, lesson modal, Japanese import, answer hiding, and display collapse.

The available cloud browser disables WebGL, so GPU rendering and real-device performance are not verified there. Audible speech and iOS/WKWebView behavior should be checked on the intended device.
