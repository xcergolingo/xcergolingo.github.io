# GoLingo Word Archer — Human archer v7

A Three.js archery range for learning vocabulary. Aim, draw the bow, and release a physical arrow toward one of three word targets. The current character is the textured, skinned **Microsoft Rocketbox Female_Adult_17** human model, posed continuously for archery.

Published from [the original Word Archer Site](https://golingo-word-archer-xin-1111.ppscreator822922.chatgpt.site), version 7, source commit `0c43b367093c0bf9756cf902ab28a85ef1b52c61`. The GitHub edition preserves that game's visuals and mechanics and adds a fragment-import compatibility fix for the GoLingo gallery. Some runtime filenames retain their `-v6` names; the current character and visible build identifier are v7.

- [Play Word Archer](https://xcergolingo.github.io/games/word-archer/)
- [GoLingo game gallery](https://xcergolingo.github.io/games/#word-archer)

## Run locally

From this directory, serve the files over HTTP:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`, wait for the range and character to load, and press **ENTER THE RANGE**. No npm install or build is required. The runtime scripts, Three.js r181, loaders, model, and textures are bundled locally. Use a current browser with WebGL 2 and serve over HTTP/HTTPS so that ES modules and the GLB can load.

## Controls and modes

| Action | Phone / tablet | Desktop |
| --- | --- | --- |
| Aim | Drag the left thumb pad or the 3D view | WASD, arrow keys, or drag the view |
| Shoot | Hold DRAW, then release | Hold Space, then release; DRAW also works |
| Change view | Camera button | Camera button |
| Pause / settings | Pause button | Pause button or Escape |

The draw percentage shows shot strength. A green sight indicates that the predicted flight intersects a target. The camera switches between shoulder and side views. Settings control the flight guide, target words, and repeated pronunciation. The collected-word card can be hidden and restored.

- **Learn:** Hit a target to collect and hear its word.
- **Listen:** Hear the learning-language word and hit its written target.
- **Meaning:** Read and hear the primary-language meaning and hit the matching learning-language word.

The game starts with a Japanese/English sample lesson. Pronunciation repeats with a 1.5-second pause after each completed playback. Use **Pause → REVIEW WORDS** to replay collected words or copy them as JSON. Audio starts after a user interaction and depends on a playable supplied audio URL or an available browser voice.

## Load your GoLingo lesson

Use **Pause → LOAD WORDS**, or send this structure through the gallery or app bridge:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    {
      "id": "101",
      "word": "水",
      "translation": "water",
      "sentence": "水を飲みます。",
      "sentenceTranslation": "I drink water."
    }
  ]
}
```

An optional `audioUrl` is played first; playback failure or an absent URL falls back to speech synthesis. Missing translations remain empty. A new lesson resets the current score and review list.

### Gallery launch

The gallery launches this game in the same tab using an encoded fragment:

```js
const url = new URL('https://xcergolingo.github.io/games/word-archer/');
url.hash = 'data=' + encodeURIComponent(JSON.stringify(lesson));
location.href = url.href;
```

`#golingoLesson=` is also accepted. Fragment values are decoded after parameter parsing so punctuation such as `&`, `+`, and `%` remains intact. Fragments are not sent as HTTP query strings. Both gallery links use `data-lesson-key="data"` and `data-lesson-format="word-pack"`; the gallery adapter carries words and sentence/phrase entries into this game's word list.

### Native WebView or same-origin JavaScript

Once the game's script has loaded, inject or call:

```js
window.GoLingoWordArcher.loadWords(lesson);
// Compatibility alias:
window.receiveGoLingoData(lesson);
```

The bridge also exposes `setMode('learn' | 'listen' | 'meaning')`, `setCamera('shoulder' | 'side')`, `getStats()`, `pause()`, `resume()`, and `exportWords()`.

### Parent frame or opener

The game sends `GOLINGO_GAME_READY` and `GAME_READY` when its lesson listener is installed. Register the parent listener before navigating the frame, check its source and origin, then send `{type:'GOLINGO_DATA', payload:lesson}` with `postMessage` to the game's actual origin. Successful import returns `GOLINGO_WORDS_LOADED` with the word count. Script readiness is separate from the Start button's 3D-loading state.

Use the JavaScript bridge or `postMessage` for large native-app payloads. Legacy query parameters such as `data`, `words`, and `sentences` remain supported for small lessons.

## Tests

From this directory, using a current Node.js version:

```bash
node --test tests/*.test.mjs
```

The suites cover physical trajectories and collisions, aim/draw input, scoring, lesson normalization, skeletal attachment and posing, embedded character assets, and gallery fragment handoff. The fragment regressions include punctuation, Unicode, translations, audio URLs, and a 500-entry lesson. These checks do not render WebGL or validate real-device audio.

## Source and credits

Runtime files are at this directory's root. `assets/` contains the embedded-texture character GLB and its attribution; `vendor/` contains Three.js and loader utilities; `tests/` contains the Node checks.

- Character: [Microsoft Rocketbox Female_Adult_17](https://github.com/microsoft/Microsoft-Rocketbox/tree/master/Assets/Avatars/Adults/Female_Adult_17), under the [Microsoft Rocketbox MIT license](https://github.com/microsoft/Microsoft-Rocketbox/blob/master/LICENSE.md). Preserve [the bundled character attribution and license](assets/archer-ATTRIBUTION.txt).
- Engine and loaders: Three.js r181, under [the bundled Three.js MIT license](vendor/LICENSE-three.txt).
- Character conversion: [`tools/convert-rocketbox-archer.py`](tools/convert-rocketbox-archer.py), requiring Blender 4.3+ and ImageMagick with the original model source. Its command-line usage is documented at the top of the script.

The bow, arrows, archery posing, range geometry, and procedural scenery are part of the game code. The GLB keeps its human skeleton and original facial/body geometry, with embedded texture maps and rendering adjustments documented in the attribution file.
