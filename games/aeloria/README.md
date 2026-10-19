# Aeloria — GoLingo Sky Lessons

A single self-contained HTML flying game. All mountains, islands, forests, plants, mounts, riders, weather, water, and lesson gates are procedural. The only rendering dependency is Three.js, loaded by import map from jsDelivr. No build step or model/texture downloads.

## Play

Open `index.html` with an internet connection, or use the GitHub Pages game link. Tap **Learn & fly** for the Spanish sample, or **Your lesson / Learn** to import your own vocabulary. The first tap enables pronunciation.

- Fly through glowing gates to collect words. **Hunt** guides the mount to the next word; steering takes control.
- Each collected word is spoken, followed once by its example sentence when supplied. Then the word repeats, with a 2.2-second gap after it finishes, until the next word or **Pause voice**.
- Sentence lessons contain word gates and a larger pink sentence-finish gate. Sentence finishes play once, not in a loop.
- Choose **Words**, **Sentences**, or **No text** for sky labels. Translations and the small current-word caption are optional. There is no large word card blocking the flight view.
- Open **Basket** to listen again and export collected words as GoLingo JSON. **Replay lesson** resets gate progress; **Clear basket** clears the review basket separately.
- Any valid BCP-47 language code is accepted; available speech voices depend on the device. Optional supplied audio URLs take precedence, with device speech as fallback.

## Controls

WASD / arrows steer, Space climbs, Ctrl dives, Shift boosts. L opens learning settings, I pauses/resumes pronunciation, M opens the map, V / 1–6 change the bird, Q changes the avatar, C changes the camera, P / Escape pauses. Touch controls are provided on phones. The original world exploration, map destinations, races, weather, seeds, and bonding remain available.

## Lesson formats

Plain words: one `word | translation` per line. Optional third and fourth columns contain an example sentence and its translation. Plain sentences: select sentence practice and enter `sentence || translation`; the browser segments words, but does not invent word translations.

The existing GoLingo app format is supported:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    {"id":"101","word":"水","translation":"water","sentence":"水を飲みます。","sentenceTranslation":"I drink water."},
    {"id":"102","word":"船","translation":"boat","sentence":"船に乗ります。","sentenceTranslation":"I ride the boat."}
  ]
}
```

The gallery's sentence format is also supported:

```json
{
  "learningLanguage":"es",
  "translationLanguage":"en",
  "sentences":[{
    "text":"Me gusta volar.",
    "translation":"I like to fly.",
    "words":[{"text":"Me","translation":"me"},{"text":"gusta","translation":"like"},{"text":"volar","translation":"to fly"}]
  }]
}
```

Up to 500 word/sentence gates and 200 KB of lesson JSON are supported. Only the next three gates are rendered. Optional per-word fields include `language`, `audioURL` (also `audioUrl`, `audio_url`, or `audio`), `sentenceAudioURL`, and `translationAudioURL`. Audio URLs must be HTTP(S), without embedded credentials.

## iOS / embedding API

The bridge exists before Three.js loads and queues early imports:

```js
window.GoLingoGame.importWords(payload);              // replaces defaults
window.GoLingoGame.importWords(payload, {append:true});
window.GoLingoGame.getState();
window.GoLingoGame.getBasket();
window.GoLingoGame.exportLesson();
window.GoLingoGame.start();
window.GoLingoGame.pause();                           // pronunciation only
window.GoLingoGame.resume();
```

`importLesson` aliases `importWords`. Invalid imports return `{ok:false,error}` without replacing the existing lesson. A user tap is still needed for browser audio permission.

App events are posted through `window.webkit.messageHandlers.golingo`, when present: `ready`, `wordsImported`, `error`, `progressChanged`, `wordAddedToBasket`, `basketExported`, and `basketCleared`. Corresponding DOM events use the `golingo:` prefix. Dispatch `golingo:importWords` with the payload in `event.detail`, or `{payload, options}`. Import replies are emitted as `golingo:importResult`.

Gallery launches use `#golingoLesson=` followed by URI-encoded lesson JSON. `?lesson=`, `?golingoData=`, and `?words=` are also accepted. Imported URL data is removed from the address after import; the lesson stays in local browser storage. Approved same-origin / GoLingo parent windows may send `{type:'golingo:importWords',payload}` with `postMessage`. Replies are sent only to the known importing parent's origin.

User lesson text is treated as data and rendered through text nodes or procedural canvas labels, never HTML. No lesson data is uploaded automatically. A supplied audio URL contacts its host when played; device speech may use the device's configured speech service.

## Verification

Automated checks cover real Three.js geometry and fixed-step flight physics, early and gallery lesson imports, sentence finishing, repetition cancellation, voice pause/resume, basket JSON export, arbitrary language codes, input safety, deterministic worlds, and original rider/bird selection. Renderer, DOM, and speech APIs are mocked in these checks; they do not establish phone FPS or device voice quality.

Three.js is copyright its authors and distributed under the MIT license. The generated game code and procedural art do not include external models or imagery.
