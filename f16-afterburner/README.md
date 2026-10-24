# GoLingo F-16 Afterburner

**[Play online](https://xcergolingo.github.io/f16-afterburner/)** · **[Download the complete game and source ZIP](https://xcergolingo.github.io/f16-afterburner/GoLingo-F16-Afterburner.zip)**

A Three.js flying game with a procedural F-16, a coastal island world, optional combat, and flight gates that turn your own vocabulary into a language lesson.

## Play

1. Extract the ZIP and open **index.html** in a modern browser with WebGL enabled.
2. Choose **Language flight**, **Combat + words**, or **Free flight**.
3. Select **Your lesson** to change words, languages, voice, or display settings, then press **Apply lesson**.
4. Press **Launch flight**. Fly through the gold gate to collect and hear its word. **Autopilot** can follow the gates for you.

The finished `index.html` includes Three.js, the game code, and its procedural visuals. It needs no CDN, external models, fonts, build tools, or downloads to run the flight. Speech depends on your device's available voices; supplied recording URLs may need an internet connection. A mobile file preview may not execute an interactive HTML game; open it in a browser or load it inside GoLingo's WKWebView.

If your browser restricts opening local HTML, you can serve the extracted folder locally with `python3 -m http.server 8000`, then open `http://localhost:8000`.

### Flight modes

| Mode | What happens |
| --- | --- |
| Language flight | Follow word gates without enemies. |
| Combat + words | Fly the same learning route while fighting jets and ships. Word gates collect vocabulary; destroying enemies earns combat points. Every fourth collected gate replenishes ammunition and flares. |
| Free flight | Explore the coast without word gates or enemies. |

Missed words return to the route for another attempt. Completing a lesson keeps the flight going so you can practice again. Restarting a route resets that flight's progress while keeping the review basket.

## Controls

| Action | Desktop |
| --- | --- |
| Climb / descend | W / S or ↑ / ↓ |
| Turn left / right | A / D or ← / → |
| Mouse steering | Click and drag in the flight view; release to center |
| Decrease / increase throttle | Q / E, or the throttle slider |
| Afterburner | Hold Shift or the Afterburner button |
| Change camera | V or Camera: chase, wide chase, cockpit |
| Pause flight | P / Esc or Menu |
| Pause / resume repeating speech | M or Pause voice |
| Missile / cannon / flares | Space / C / F, in combat mode |

On touch devices, drag the flight stick, adjust the throttle slider, and use the action buttons. **Autopilot** is available in both word-gate modes. Steering manually disengages it. Opening a menu or switching away from the game pauses the flight; use **Resume flight** to continue.

## Add your lesson

Open **Your lesson**, paste content or choose **Import file**, and confirm the learning and translation language fields. The suggestions are examples: any valid language code works, such as `es`, `ja`, `fr`, `pt-BR`, `zh-CN`, or `uk`.

An import replaces the current lesson with exactly its supplied entries. Applying a lesson during flight starts a fresh route for that lesson. Each lesson supports up to **300 entries** and an input smaller than **1 MB**. Translation and example fields are optional.

### Text or TSV

Use one entry per line, with either pipes or tabs separating up to four fields:

```text
word | translation | example sentence | example translation
```

Paste the actual entries without the explanatory header:

```text
cielo | sky | El cielo es azul. | The sky is blue.
volar | to fly | Me gusta volar. | I like to fly.
```

### CSV

Use a header row containing `word`. Supported columns include `id`, `word`, `translation`, `sentence`, `sentenceTranslation`, `learningLanguage`, and `primaryLanguage`:

```csv
id,word,translation,sentence,sentenceTranslation,learningLanguage,primaryLanguage
101,水,water,水を飲みます。,I drink water.,ja,en
102,船,boat,船に乗ります。,I ride the boat.,ja,en
```

Quoted commas, doubled quotation marks, multiline quoted fields, and Excel's UTF-8 BOM are supported. Keep one learning/translation language pair per CSV lesson. A CSV exported from a basket containing several language pairs must be split by pair before lesson import.

### JSON and the included example

`sample-lesson.json` contains this GoLingo payload:

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
    },
    {
      "id": "102",
      "word": "船",
      "translation": "boat",
      "sentence": "船に乗ります。",
      "sentenceTranslation": "I ride the boat."
    }
  ]
}
```

A direct array of word objects is also accepted. Optional recording fields are `audioUrl`, `sentenceAudioUrl`, `translationAudioUrl`, and `sentenceTranslationAudioUrl`. `wordAudioUrl` is accepted as an alias for `audioUrl`. Use an `https://`, `http://`, or valid `blob:` URL.

## Speech, word display, and review

Passing a gate speaks its learning word repeatedly until you reach another word or choose **Pause voice**. Repetition waits for playback to finish, then uses the selected repeat gap. Enable **Say word, then example** for a word-and-sentence sequence. Voice speed, repeat gap, voice choice, and engine sounds are adjustable.

**Pause voice** works independently of flight controls. Collecting another word preserves an explicit voice pause. The lesson's recordings take priority; if a recording fails, the game attempts a device voice for the selected language. Use **Test voice** to check your device. Add a matching voice in device settings or provide a recording URL if that language is unavailable. This package does not contain generated recordings for every language.

Words are hidden during flight by default. **Show words** reveals gate vocabulary and a compact replay strip. **Show translations** and the example setting control the corresponding text. These preferences are remembered.

The **Basket** records collected vocabulary, practice counts, examples, and language pairs. Replay a word or its translation, mark an entry learned, or export:

- **Export to GoLingo** sends the collection to the native `golingoExport` handler when available; otherwise it downloads JSON.
- **Download CSV** exports the basket for spreadsheets or another lesson.
- JSON export includes a `lessons` array grouped by language pair. Its top-level `words` contains the current language pair, or the first available pair, for compatibility with simpler importers.

Lessons, settings, and the basket are kept in this browser when local storage is available. Export your basket to move it to another device. **Clear basket** requires a second tap.

## GoLingo / WKWebView integration

The game exposes `window.GoLingoGame`. After the game reports readiness, pass the same payload used in `sample-lesson.json` directly from your app:

```js
const result = window.GoLingoGame.importWords({
  primaryLanguage: "en",
  learningLanguage: "ja",
  words: [
    {
      id: "101", word: "水", translation: "water",
      sentence: "水を飲みます。", sentenceTranslation: "I drink water."
    },
    {
      id: "102", word: "船", translation: "boat",
      sentence: "船に乗ります。", sentenceTranslation: "I ride the boat."
    }
  ]
});
// { success: true, count: 2, learningLanguage: "ja", primaryLanguage: "en" }
```

Use JSON serialization or WKWebView's JavaScript arguments when transferring app data; avoid concatenating unescaped word text into JavaScript. Imports made after the HTML's early bridge is installed, but before initialization finishes, are queued. Waiting for `ready` is the clearest integration point.

| JavaScript method | Behavior |
| --- | --- |
| `importWords(payload)` | Replace the lesson; return the imported count and language pair. Invalid data throws an error. |
| `importWords(payload, {append: true})` | Append entries when both language codes match the existing lesson. |
| `getLesson()` | Read the active lesson. |
| `getReview()` | Read the complete basket as an array. |
| `exportWords()` | Send/download the export and return its payload. |
| `getImportDiagnostics()` | Read import time, source, count, and the last import error. |
| `getState()` | Read flight, current-word, progress, voice, and control state. |

Register these **WKScriptMessageHandler names** before loading the game:

| Handler | Messages from the game |
| --- | --- |
| `golingo` | Objects with `type`: `ready`, `wordsImported`, `wordCollected`, `lessonComplete`, or `error`. Each includes `game: "f16-afterburner"` and `version: 2`. |
| `golingoExport` | The complete exported collection when the user exports or your app calls `exportWords()`. |

`importWords` is a JavaScript method. Native import confirmation arrives as `type: "wordsImported"` through `golingo`. Browser integrations can also listen for the `golingo:ready` custom event on `window`.

### Parent page / game gallery messaging

The game accepts messages from its parent, opener, or its own window with type `golingo:importWords` or `golingo:loadLesson`:

```js
frame.contentWindow.postMessage({
  type: "golingo:importWords",
  requestId: "lesson-1",
  payload: lessonPayload
}, gameOrigin);
```

The reply uses `type: "golingo:importResult"`, the same `requestId`, and either the success/count fields or `{success: false, error: "…"}`. Use the game's exact origin as `gameOrigin`, and validate both the reply's origin and source.

Allowed sender origins are the game's own origin, `https://golingoapp.com`, `https://www.golingoapp.com`, and `https://xcergolingo.github.io`. An embedding integration can add explicit origins through `window.GoLingoAllowedOrigins` in the game page. `append: true` may be included in the message when the language pair matches.

## Edit and rebuild

The ZIP contains the playable `index.html`, this README, the sample lesson, and editable files under `src/`:

| File | Purpose |
| --- | --- |
| `src/index.template.html` | Interface, layout, and styles |
| `src/f16-game.js` | Flight, combat, gates, review, and GoLingo bridge |
| `src/f16-visuals.js` | Procedural aircraft, terrain, water, clouds, and ships |
| `src/f16-learning.js` | Lesson parsing, speech, and JSON/CSV export |
| `src/three.min.js` | Bundled Three.js engine with its original license header |
| `src/build.py` | Assembles the finished single HTML file |

After editing, run this from the extracted ZIP's root folder:

```sh
python3 src/build.py index.html
```

Only Python 3 is needed to rebuild. The build makes no downloads and embeds the local engine and all source scripts into `index.html`.
