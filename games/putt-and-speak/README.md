# GoLingo — Putt & Speak

A browser-based language learning mini-golf game. Three.js renders a garden putting course, with an automatic Canvas 2D fallback for WebGL-disabled browsers. No external runtime requests are required.

## Play

1. Pick a language and start in **Word Challenge** (default) or **Putt & Learn** practice mode.
2. Listen to the clue and read/listen to the words floating above the golf cups.
3. Press the golf ball, drag **backward** to set direction and power, then release to putt.
4. A correct cup plays the target word and displays the example sentence. Continue through up to nine holes.

Each hole adds new obstacles such as rocks, sand, wood barriers, a windmill, and water hazards. The **Hint** button highlights the target cup. **Re-tee** costs one stroke. The learned word basket exports as GoLingo JSON.

## Supported vocabulary format

The **Settings → GoLingo vocabulary** panel accepts a `.json` file or pasted JSON:

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
    {"id": "102", "word": "木", "translation": "tree"},
    {"id": "103", "word": "花", "translation": "flower"}
  ]
}
```

One or two entries work too: a single item automatically uses one-cup practice mode, while two distinct items can provide a two-cup challenge. Three or more entries provide the full three-cup challenge. Up to nine pairs are used per game. Imported lists are remembered in this browser's local storage until the user selects **Use Demo**. Sentence-only lists and phrases are accepted, and optional `audioURL`/`audioUrl`/`audio_url` recordings are played before falling back to speech synthesis.

To integrate with the GoLingo game hub, the preferred launch format is `#golingoLesson=` followed by `encodeURIComponent(JSON.stringify(lesson))`. The game also reads the gallery's same-tab `sessionStorage` key `golingo:active-lesson:v1`. A JSON string (or URI-encoded/base64url JSON) works in `lesson`, `data`, `golingo`, `golingoData`, `vocabulary`, or `words` URL query parameters as well. A parent page or iOS webview may send the parsed object with `postMessage`:

```js
gameIframe.contentWindow.postMessage({
  primaryLanguage: 'en',
  learningLanguage: 'ja',
  words: [
    { word: '水', translation: 'water' },
    { word: '木', translation: 'tree' },
    { word: '花', translation: 'flower' }
  ]
}, new URL(gameIframe.src).origin);
```

The `sentence`, `sentenceTranslation`, and `id` fields are optional. Speech uses the browser's speech synthesis voices; 3D rendering uses a locally bundled MIT-licensed Three.js module.

A direct integration can also call `window.GoLingoGame.importWords(lesson)`, then read `window.GoLingoGame.getCollectedWords()` or `window.GoLingoGame.getStatus()`.

## Local development

Serve the `dist` folder over HTTP, for example `python3 -m http.server 8080 --directory dist`. Visit `http://localhost:8080` in a browser.

Files in `dist/` are the complete static deployment. The Site hosting manifest is in `.openai/hosting.json`.
