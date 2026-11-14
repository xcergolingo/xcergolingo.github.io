# GoLingo integration

This game uses the same `primaryLanguage`, `learningLanguage`, and `words` lesson shape as the other GoLingo games. Imported lists replace the default lesson unless the caller explicitly requests append. Imports work before the 3D renderer starts.

## Canonical lesson

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
      "word": "空",
      "translation": "sky"
    }
  ]
}
```

Optional per-entry fields include `learningLanguage`, `primaryLanguage`, `audioUrl`, `sentenceAudioUrl`, `translationAudioUrl`, and `sentenceTranslationAudioUrl`. Supplied IDs and additional JSON fields are preserved in collected-word exports. Language names and common language-code aliases normalize to BCP 47 codes. Nested `lesson`, `payload`, `data`, or `content` envelopes and `sentences`, `phrases`, `items`, and `entries` lists are accepted.

Words with identical language, text, translation, and sentence are deduplicated. Invalid empty entries are skipped with an import notice. A list above 50,000 entries or text above 32 MB is rejected explicitly; there is no silent size truncation. Browser storage can fill before those limits, in which case the lesson remains available in memory for that tab.

## Direct bridge and WKWebView

`bridge.js` runs before the module graph. The following calls are safe even before module initialization; an early result is `{ok: true, queued: true, ready: false}`.

```js
window.GoLingoGame.importWords(lesson);
window.GoLingoBridge.load(lesson);
window.setGoLingoData(lesson);
window.receiveGoLingoData(lesson);
```

After readiness, a successful import returns:

```js
{ ok: true, count: 2, primaryLanguage: 'en', learningLanguage: 'ja' }
```

Invalid direct imports throw an explanatory error and retain the current lesson. Append is explicit and requires matching languages:

```js
window.GoLingoGame.importWords(moreWords, { append: true });
```

Other available methods:

```js
window.GoLingoGame.getLesson();     // Complete normalized lesson copy
window.GoLingoGame.getBasket();     // Collected words in canonical shape
window.GoLingoGame.getState();      // Settings, statistics and current question
window.GoLingoGame.setMode('listen'); // learn | listen | meaning
window.GoLingoGame.exportBasket();  // User-triggered native / downloaded export
```

`window.GoLingoBridge` also provides `importWords`, `getLesson`, and `getBasket`. Use `GoLingoGame.ready` or readiness events instead of polling the renderer.

When installed, `window.webkit.messageHandlers.golingo.postMessage(...)` receives `{type: 'ready', game: 'sky-reach', count, ...}`, `{type: 'wordsImported', ok: true, count, ...}`, and `{type: 'error', ok: false, error, ...}`. Ready reflects any queued early imports. These automatic messages contain status and counts, not the lesson content.

An explicit **Export to GoLingo** action sends the canonical basket object to `window.webkit.messageHandlers.golingoExport.postMessage(payload)`. Without that handler it downloads `sky-reach-golingo-words.json`. Export never happens automatically. GoLingo links use `_self` to remain in the current webview.

## Parent page / iframe messages

The game announces `{type: 'GOLINGO_GAME_READY', game: 'sky-reach', count, supportsPostMessage: true, supportsImportWords: true}` to its parent or opener. It also emits the compatibility `GAME_READY` event.

```js
const origin = 'https://xcergolingo.github.io';
window.addEventListener('message', event => {
  if (event.origin !== origin || event.source !== gameFrame.contentWindow) return;
  if (event.data?.type === 'GOLINGO_GAME_READY') {
    gameFrame.contentWindow.postMessage({type: 'GOLINGO_DATA', payload: lesson}, origin);
  }
});
```

Accepted typed envelopes include `GOLINGO_DATA`, `GOLINGO_LESSON`, `golingo.lesson`, `golingo-content`, and `loadSentences`. Only the current window, its parent, or opener can submit messages. Replies go back to the sending window with its observed origin:

- `GOLINGO_WORDS_LOADED` with success count and languages.
- `GOLINGO_IMPORT_ERROR` with a readable error.

For large lessons, use a direct bridge or postMessage rather than a URL.

## Custom events

```js
window.dispatchEvent(new CustomEvent('golingo:lesson', {detail: lesson}));
window.dispatchEvent(new CustomEvent('golingo:importWords', {detail: lesson}));
window.addEventListener('golingo:importResult', event => console.log(event.detail));
window.addEventListener('golingo:ready', event => console.log(event.detail));
```

The early script queues custom imports too.

## Gallery / link handoff

The game reads these query or hash payload keys: `golingoLesson`, `lesson`, `data`, `payload`, `golingo`, `golingoData`, `words`, and `sentences`. JSON, URL-encoded JSON, and supported base64 JSON are accepted. List-only keys may also provide `primaryLanguage` and `learningLanguage` parameters.

For a small lesson:

```js
const url = new URL('https://xcergolingo.github.io/games/sky-reach-walker-assault/');
url.hash = 'golingoLesson=' + encodeURIComponent(JSON.stringify(lesson));
location.href = url.href;
```

Without an explicit link payload, same-tab gallery handoffs are read from sessionStorage keys `golingoLesson` and `golingo:active-lesson:v1`. Hash payloads take priority over query payloads; explicit link payloads take priority over session handoffs and saved defaults. Queued direct native imports are applied after startup hydration.

## Persistence and audio

Local keys use the `sky-reach-golingo-v1` prefix. Game crystals and warp cores continue using the base game's `sky-reach-progress-v1` key. Replacing a lesson starts a new basket; append retains collected words. Export a basket before replacing a lesson if you want to keep it elsewhere.

Audio starts after a user gesture. One pronunciation or example plays at a time; pause cancels automatic speech. Supplied audio falls back to device speech after errors. Listen mode keeps its answer out of the HUD; Meaning uses the primary-language text and voice. Installed device voices determine supported pronunciation. Manual review/replay works even when automatic word audio is switched off.
