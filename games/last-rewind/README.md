# LAST REWIND — GoLingo Language Survival

A first-person language-learning survival game inside a late-night video rental store. Defend the shop, hear a new word with each defeated enemy, and complete a sentence with each cleared wave.

**Game:** https://xcergolingo.github.io/games/last-rewind/  
**Gallery:** https://xcergolingo.github.io/games/

## Run locally

From this directory—the one containing `index.html`—start a local HTTP server:

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080/** in a modern browser. On Windows, use `python` if that is the installed command. Stop the server with Ctrl+C.

The files have a flat root: `index.html`, the JavaScript modules, and the stylesheets sit together; `vendor/` contains Three.js and PointerLockControls. Serve this directory directly. No build step, npm installation, API key, or game server is required. Opening `index.html` directly with `file://` will block ES-module loading in most browsers.

For GitHub Pages, place this directory's contents in `games/last-rewind/`, keeping `vendor/` intact. All game imports and bundled assets use relative paths. The generated standalone HTML and source ZIP are intentionally excluded from this publication folder.

## Learn while playing

Open **Your Lesson** to choose languages, paste word/translation pairs or lesson JSON, or import a `.json`/`.txt` file. Built-in examples are included. Imported text is not automatically translated.

- Defeating an enemy discovers and pronounces the next word. **Repeat** repeats the word until the next discovery or a pause.
- A sentence wave speaks its complete sentence when cleared. Vocabulary-only lessons remain vocabulary practice.
- Choose **Word**, **Sentence**, or **Hidden** display, toggle **Meaning**, and replay pronunciation from the learning panel.
- Open **Lesson & Review Basket** while paused to review collected words and export GoLingo-compatible JSON.
- Preferences and baskets are saved locally. Each language pair has its own basket, which survives retries and lesson changes.

**Relaxed practice** is the default: slower enemies, lower damage, an 18-second break between waves, and automatic reloading. Choose **Original survival** for the original pace. Lessons shuffle each new shift by default; shuffle, speech speed, and repetition are adjustable.

Pronunciation uses supplied audio URLs or a matching device speech voice. Voice availability depends on the device; imported audio clips may require a network connection. Gameplay assets, procedural graphics, and synthesized sound effects are bundled locally.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | WASD / arrow keys | Left joystick |
| Look | Mouse | Drag the right side |
| Shoot | Left click; hold for repeated shots | Hold the target button |
| Reload | R | Reload button |
| Run | Shift + movement | Push the joystick fully |
| Focus aim | Hold right mouse button | Gentle aim assistance |
| Counter supplies | E when nearby | USE when nearby |
| Pause | Esc / P | Pause button |

If pointer lock is unavailable, drag to look and click to shoot; F or Space also fires. Start/Resume unlocks audio. A hidden browser tab pauses the shift. Landscape provides more room on a phone.

## Survive the shift

Start with **40 health**, **100% store integrity**, **6 loaded shells**, and **30 reserve shells**. Reloading inserts shells individually, and firing can interrupt it. Shelves and walls block pellets; enemies navigate through the door and around the shelves.

Enemy contact damages your health, while intruders gradually damage the shop. Collect dropped ammunition and medical supplies. During a break, use the **STAFF SUPPLIES** box beside the checkout counter once to restore health, integrity, and ammunition.

The baseline campaign has five increasingly difficult waves, followed by optional Endless Mode. Longer sentences add encounters so their words are covered; lessons with more rounds extend the campaign. Losing all health or store integrity ends the shift.

## GoLingo / WKWebView integration

The gallery passes a lesson in the same tab through `#golingoLesson=<encoded JSON>`. Native hosts can call `window.GoLingo.load(lesson)` after loading, or use a trusted `postMessage` handoff. `window.GoLingo.exportWords()` returns the current review basket.

See [GoLingo-Integration.md](GoLingo-Integration.md) for payloads, language codes, supported fields, audio URLs, message origins, and native export handling. No ChatGPT login is needed.

## Source layout

| Files | Responsibility |
| --- | --- |
| `index.html`, `style.css`, `learning.css`, `favicon.svg` | Menus, HUD, responsive controls, lesson interface |
| `game.js`, `environment.js` | Renderer, movement, shooting, game lifecycle, procedural store |
| `weapon.js`, `enemies.js`, `nav.js`, `rules.js` | Shotgun, pooled enemies, navigation, survival rules |
| `effects.js`, `audio.js` | Pooled effects/pickups and synthesized game audio |
| `learning.js`, `lesson-audio.js`, `learning-ui.js` | Lesson parsing, progression, pronunciation, handoff, review |
| `vendor/` | Three.js r170, PointerLockControls, MIT license |

Edit a module or stylesheet and refresh the local server page. WebGL 2 is required. The game uses instancing, pooled actors/effects, and capped rendering resolution; quality and look sensitivity are adjustable from the pause menu. Actual frame rate depends on the device and browser.

## Licenses and credits

Three.js r170 and PointerLockControls are MIT licensed; their license is included at [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt). See [LICENSES.md](LICENSES.md) for dependency and asset credits. The environment, posters, weapon, characters, and game sound effects are generated by the project's code.
