# INK & IRON — GoLingo Word Patrol

A language-learning patrol through an original cartoon-noir FPS: hear a word, find its wind-up robot, and collect it for review. The rubber-hose characters, ink outlines, sunset street, effects, and game audio are generated in code.

[Play Word Patrol](https://xcergolingo.github.io/games/ink-and-iron/) · [GoLingo games gallery](https://xcergolingo.github.io/games/) · [GoLingo](https://www.golingoapp.com/)

## Start a patrol

Open the game in a recent browser with WebGL2 enabled and press **START WORD PATROL**. Spanish with English translations is the starter lesson. On phones, landscape gives the most room.

1. Listen to the current target. Its robot has a gold selection ring and a word label.
2. Press **H** or **HUNT** to turn toward that target; press **L** or **LISTEN** to hear it again.
3. Defeat a robot to collect its entry. Matching the selected target earns a learning bonus; other defeated robots also add their entries. The card keeps the collected entry briefly before selecting another target.
4. Open **BASKET** to replay collected words and example sentences, inspect collection/listen counts, and **EXPORT TO GOLINGO**. Export offers a JSON download and copyable JSON; a compatible native app can receive it directly.

**Relaxed learning mode is on by default:** no incoming damage, slower robots, replenished reserve ammunition, and automatic reload when empty. Turn it off in **LESSON** for the original combat challenge. A patrol has three rounds of 5, 8, and 11 robots; larger lessons take multiple patrols to explore.

Every new patrol shuffles the lesson, and an exhausted deck is shuffled again. Your lesson's review basket survives new patrols when browser storage is available. **Show words**, **Show translations**, and **Repeat until next word** are independent settings. Between rounds, a supplied example sentence can play once.

## Controls

| Action | Desktop | Phone / tablet |
| --- | --- | --- |
| Move | WASD or arrow keys | Left thumbstick |
| Aim | Mouse; drag when pointer lock is unavailable | Drag the right aim area |
| Fire | Left mouse button; hold to repeat | Hold FIRE |
| Dash | Shift | DASH |
| Jump / double-jump | Space; press again in the air | Tap JUMP twice |
| Knuckle Sandwich | F or E | PUNCH |
| Reload | R | RELOAD |
| Face the learning target | H | HUNT on the word card |
| Replay the current word | L | LISTEN or tap the word |
| Review collected entries | B | BASKET in the header |
| Lesson and learning settings | LESSON in the header | LESSON in the header |
| Pause | Esc or P; pause icon | Pause icon |

Lesson and basket panels pause a running patrol. The pause menu contains look sensitivity and gentle aim assist; the speaker button controls both game sound and pronunciation. A close-range melee finishing blow restores health in combat mode.

## Import words and sentences

Open **LESSON**, choose the learning and translation languages, then paste your data and select **LOAD LESSON**. Language choices apply to the next import or **USE STARTER WORDS**; they do not translate existing text. Built-in starters contain 10 words with examples for English, Spanish, Chinese, Japanese, French, German, Italian, Portuguese, Korean, Vietnamese, Russian, Arabic, Hindi, Thai, and Ukrainian, in any pairing.

This complete mixed lesson creates two playable entries: one word and one standalone sentence.

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "es",
  "words": [
    {
      "id": "agua",
      "word": "agua",
      "translation": "water",
      "sentence": "Quiero agua.",
      "sentenceTranslation": "I want water."
    }
  ],
  "sentences": [
    {
      "id": "estacion",
      "sentence": "¿Dónde está la estación?",
      "sentenceTranslation": "Where is the station?"
    }
  ]
}
```

Standalone sentences stay intact and enter the deck even when `words` is also supplied. A word's example sentence stays attached to that word and does not become an extra target. Sentence-only lessons work without splitting sentences into tokens or inventing translations.

Plain lines also work, with `|` or tab separators and up to four columns:

```text
hola | hello | Hola, amigo. | Hello, friend.
agua | water | Quiero agua. | I want water.
```

| Accepted input | Compatibility aliases |
| --- | --- |
| Translation language | `primaryLanguage` or `translationLanguage` |
| Word collections | `words`, `items`, `entries`, or a top-level array |
| Sentence collections | `sentences` or `phrases` |
| Learning text | `word`, `term`, `text`, `learningText`, `targetText`, `phrase` |
| Word translation | `translation`, `meaning`, `translatedText`, `primaryText`, `definition` |
| Example text / translation | `sentence`, `exampleSentence`, `example` / `sentenceTranslation`, `exampleTranslation`, `phraseTranslation` |
| Entry identity | `id`, `wordId`, `sentenceId`; omitted IDs are generated |

Rows may be strings, objects, or arrays of up to four values. Wrappers such as `{"type":"golingoLesson","payload":{...}}` and `{"lesson":{...}}` are accepted. Language names and codes are normalized, including `CN → zh`, `jp → ja`, `kr → ko`, `vn → vi`, and `ua → uk`; regional tags such as `en-US` and `zh-Hant` are supported.

Imports are limited to **500 total word/sentence entries and 100,000 UTF-8 bytes**. Text is displayed as text, never interpreted as HTML. Translations come from the supplied lesson or starter dictionary; there is no translation service. Export contains only collected entries as `{ "primaryLanguage": "…", "learningLanguage": "…", "words": [...] }`, preserving full sentences, example translations, IDs, and recording URLs.

## Gallery and host-app integration

The gallery handoff uses the JSON lesson in a URL fragment and a same-origin session fallback:

```js
const serialized = JSON.stringify(lesson);
sessionStorage.setItem('golingo:active-lesson:v1', serialized);
location.href = 'https://xcergolingo.github.io/games/ink-and-iron/#golingoLesson='
  + encodeURIComponent(serialized);
```

Session storage is scoped to its origin and browser tab; the fragment carries the lesson when that storage cannot be shared. Large lessons are better pasted or injected directly than put in a long URL.

Startup checks the fragment `golingoLesson` or query aliases `lesson`, `data`, `payload`; then globals `GoLingoData`, `golingoData`, `lessonData`; then session storage; then this game's saved lesson; finally the Spanish/English starter. Invalid sources show an error and allow the next available source. URI-encoded and Base64/Base64URL JSON transport strings are accepted.

After initialization, hosts can call any of these equivalent entry points with an object or JSON string:

- `window.setGoLingoData(payload)`, `window.receiveGoLingoData(payload)`, `window.loadGoLingoLesson(payload)`.
- `window.GoLingo.receiveWords(payload)`, `window.GoLingo.onPayload(payload)`, `window.GoLingo.loadLesson(payload)`.

They return `{ ok: true, count, learningLanguage, primaryLanguage }` or `{ ok: false, error }`. Loading a lesson ends the current patrol and returns to the title so its next run uses the new deck.

`postMessage` accepts lesson objects or wrappers with `payload`, `lesson`, or `data`. Recognized types are `golingo-data`, `GOLINGO_DATA`, `golingo:lesson`, `golingoLesson`, `GOLINGO_LESSON`, `loadLesson`, `GoLingoData`, and `GOLINGO_PAYLOAD`. Messages must come from the same origin, `https://xcergolingo.github.io`, or a `null`-origin native/file context whose source is this window or its parent.

For native export, the game uses the first available handler at `window.webkit.messageHandlers.golingoExport`, `GoLingoExport`, or `exportWords` and calls its `postMessage(payload)`. Without a working native handler it offers the normal JSON download; copyable JSON is available in either case.

## Pronunciation, storage, and privacy

Add `audioUrl` to a word and `sentenceAudioUrl` to its example to use your own recordings. Word aliases are `audioURL`, `audio`, `wordAudioUrl`, and `pronunciationAudioUrl`; sentence aliases are `sentenceAudioURL` and `sentenceAudio`. Audio values may also be `{ "url": "…" }` or `{ "src": "…" }`. Only HTTP(S) URLs are played; use HTTPS on the hosted game. Recording URLs are references, not embedded audio or microphone recordings.

Recordings play first. If unavailable, the game tries browser speech synthesis with a matching learning-language voice. Voices are supplied by the browser/OS, can appear after startup, and vary by device. If no matching voice exists, the UI says so; install one or provide recordings. Press Start or Listen to satisfy browser audio restrictions. Listen counts measure playback starts, not pronunciation accuracy or mastery.

Lessons, settings, and per-lesson review baskets are stored locally in browser storage when permitted. There is no account sync or game backend receiving your basket. Clearing site data, using another origin/device, or private browsing can remove or isolate progress. Export JSON to keep a portable copy.

“Local storage” does not mean every audio path is offline: recording playback requests its supplied URL, and some browser/OS speech voices use online services. Native export hands data to the host app; downloaded/copied JSON contains your lesson text and recording URLs. The game does not record your microphone or assess your speech.

## Develop and build the offline edition

In the GitHub `games/ink-and-iron/` folder, `index.html`, modules, styles, and `vendor/` are adjacent. The Sites development checkout keeps those same web files under `dist/`. Run a static server **from the folder containing `index.html`**:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/`. For the Sites checkout, enter `dist/` before running the server. No package installation or CDN is required; Three.js r170 and PointerLockControls are included locally with the Three.js MIT license.

Run `node build-single.mjs` from the project/game folder after source changes. It supports both layouts and writes `Ink-and-Iron.html` beside `index.html`. Open that generated file directly for the standalone edition; it bundles game modules, styles, and Three.js. External recordings and online speech voices still require their own network access.

| Source | Purpose |
| --- | --- |
| `index.html`, `style.css`, `learning.css` | Menus, HUD, touch controls, lesson and basket UI |
| `lesson-data.js` | Normalization, starters, stable IDs, shuffle, lesson fingerprint, canonical export |
| `learning.js` | Speech/recordings, import transport, settings, review basket, native/browser export |
| `main.js`, `input.js`, `word-tags.js` | Patrol state, controls, learning targets, labels, combat |
| `world.js`, `actors.js`, `art.js`, `effects.js` | Procedural arena, robots, weapon, materials, comic feedback |
| `audio.js`, `navigation.js` | Procedural game sound and robot pathfinding |
| `build-single.mjs` | Standalone HTML builder using Node.js built-ins |

## Validation and scope

The available cloud browser reports its WebGL renderer/vendor as **Disabled**, so it cannot verify the rendered arena. Graphics, touch performance, speech voices, recording playback, and mobile export need checking on the intended device; static/data checks do not establish those results.

This is one small single-player arena, without multiplayer, automatic translation, or pronunciation scoring. It uses original procedural designs and audio, with no assets, characters, or music taken from Iron Curtain Call or vintage cartoons.
