# Last Rewind — GoLingo integration

The public game route is `https://xcergolingo.github.io/games/last-rewind/`. Open it in the same WKWebView used for the gallery. It has no ChatGPT sign-in dependency. All game assets, including Three.js, are served locally with the game.

## Standard word payload

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

Optional word fields: `audioUrl` and `sentenceAudioUrl`. Audio uses the supplied URL first, then falls back to a matching speech-synthesis voice if the clip fails. The game never chooses a voice from a different language just to make sound.

## Explicit sentence payload

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "es",
  "sentences": [
    {
      "id": "s1",
      "sentence": "La tienda está abierta.",
      "translation": "The store is open.",
      "words": [
        { "word": "tienda", "translation": "store" },
        { "word": "abierta", "translation": "open" }
      ]
    }
  ]
}
```

Supply individual word translations when you have them. If a sentence has no word list, the game segments it using the learning language. It does not treat a full sentence translation as the translation of each token. Chinese/Japanese/Thai segmentation uses `Intl.Segmenter` where available.

`phrases`, `items`, `entries`, and `data`/`payload` wrappers are supported for compatibility. Imports are limited to 500 entries and 200,000 characters. HTTPS audio URLs are recommended; the validator rejects executable schemes and URLs with embedded credentials. Parsing never fetches remote lesson URLs.

## Gallery handoff

The existing GoLingo gallery saves the lesson, appends an encoded JSON fragment when a game is selected, and navigates in the same tab:

```js
const url = new URL('https://xcergolingo.github.io/games/last-rewind/');
url.hash = 'golingoLesson=' + encodeURIComponent(JSON.stringify(lesson));
location.href = url.toString();
```

Last Rewind accepts `golingoLesson`, `lesson`, `data`, `payload`, or `golingoData` in the hash or query string. Hashes keep lesson content out of the server's HTTP request. Prefer direct JavaScript injection for large native lessons.

## Direct WKWebView injection

After the page finishes loading, invoke its explicit API with a JSON-serialized object:

```js
window.GoLingo.load(lesson);
```

The result is `{ok: true, words: number, lessons: number}`, or `{ok: false, error: string}`. Invalid input does not replace the active lesson.

Compatibility aliases are `window.GoLingo.receive`, `window.GoLingo.setLesson`, `window.loadGoLingoLesson`, `window.receiveGoLingoData`, and `window.setGoLingoData`.

Serialize the payload as JSON when constructing a Swift `evaluateJavaScript` call. Do not interpolate unescaped words directly into executable JavaScript. Receiving a new lesson during a shift starts that lesson in a fresh shift without asking for pointer lock from a non-user gesture.

## postMessage

```js
gameWindow.postMessage(
  { type: 'golingo:lesson', payload: lesson },
  'https://xcergolingo.github.io'
);
```

Only recognized lesson message types from the page, its trusted parent, the same origin, or the GoLingo web origins are accepted. Native applications can use the direct API when their custom URL scheme has a different origin.

## Review export

```js
const reviewed = window.GoLingo.exportWords();
```

The return value uses the standard `{primaryLanguage, learningLanguage, words}` shape. Collected words retain their translations, sentence examples and audio URLs.

The **Export JSON** button downloads `Last-Rewind-GoLingo-Words.json` and also reveals copyable JSON. If the host defines `window.webkit.messageHandlers.golingo`, that explicit button sends:

```js
{
  type: 'golingo:export',
  game: 'last-rewind',
  payload: { primaryLanguage, learningLanguage, words }
}
```

No review data is automatically sent to a parent or external service. Local preferences, lesson content, and review baskets stay in the current browser's local storage. The gallery handoff remains tab-local through its existing session-storage key.

## Playback behavior

Start, Resume, and Replay unlock audio from a user gesture. Each new word cancels the preceding word's utterance and repeat timer. A completed sentence cancels word repetition and plays once. Pause, mute, lesson replacement, and a new shift cancel obsolete callbacks, so an old clip cannot restart itself during a later word.

The game lowers effect/ambient levels while retaining shotgun and attack feedback. Speech speed is adjustable. A missing language voice produces a small status message and the replay control remains available.
