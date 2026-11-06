# GoLingo Koi Garden

**Play:** https://xcergolingo.github.io/games/koi-garden/

**Gallery:** https://xcergolingo.github.io/games/

This GitHub Pages edition includes the smooth movement and zen music update, plus the gallery’s `#golingoLesson=` launch format (version 1.1.1). Both gallery card links open in the current browsing context for GoLingo’s web view.

An original, peaceful browser language game inspired by the swimming and collection loop in Zen Koi 2. The artwork, interface, code, vocabulary system, and progression in this project are original. No reference-game assets are included.

## Play

Tap **Enter the pond**, then tap or drag on the water to guide the large koi. Reaching a glowing word pearl collects that word. **Find a word** steers toward a waiting pearl. Arrow keys and WASD also work.

**Explore** plays captured words, optionally repeating until another word is collected. **Example** shows and speaks an example sentence once. Translations can be hidden. **Practice** asks for a meaning; swim toward the matching word. Incorrect choices allow another attempt. Assisted answers are recorded as discoveries rather than unassisted correct matches.

The **Words** basket replays discoveries and exports the standard GoLingo JSON format. **My koi** unlocks Sanke after four distinct words, Golden Ogon after eight, and a decorative river-dragon form after twelve. **Pond** changes the light and starts a fresh randomized swim while preserving progress.

Progress is saved in browser local storage, separately for each word set. It does not synchronize across devices. Starter vocabulary includes 12 nature concepts with example sentences in 15 languages: English, Japanese, Chinese, Spanish, French, German, Italian, Portuguese, Korean, Vietnamese, Thai, Arabic, Hindi, Russian, and Ukrainian. Both the learning language and translation language can be chosen.

## Own words and sentences

Choose **Words → Add my words**. Paste one entry per line:

```text
水 | water | 水は澄んでいます。 | The water is clear.
魚 | fish | 魚が池で泳いでいます。 | The fish swims in the pond.
```

Or paste/load JSON:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    {
      "id": "101",
      "word": "水",
      "translation": "water",
      "romanization": "mizu",
      "sentence": "水は澄んでいます。",
      "sentenceTranslation": "The water is clear."
    }
  ]
}
```

Optional `audioUrl` and `sentenceAudioUrl` fields are supported. Supplied audio is preferred, with device speech as a fallback. Sentence entries can also be passed in a `sentences` array. Long phrases remain fully readable on the word card and in the basket; pond labels are shortened. Practice requires choices with distinct beginnings and translations, and falls back to Explore when a set cannot offer distinguishable choices.

## GoLingo web-view integration

After the page's modules finish loading, the following browser API is available:

```js
window.GoLingo.load(payload);
window.GoLingo.getDeck();
window.GoLingo.exportBasket();
```

`loadGoLingoData(payload)` and `setGoLingoData(payload)` are aliases. Loading a new deck updates the current game and clears old pearl targets. It does not delete progress for other decks.

The page dispatches `golingo:ready` on `document` when ready. A host can also check that `window.GoLingo` exists after navigation finishes.

Supported message and custom-event forms:

```js
window.postMessage({type: 'golingo:data', payload}, location.origin);
window.dispatchEvent(new CustomEvent('golingo:data', {detail: payload}));
```

URL parameters `data`, `payload`, and `golingo` accept URL-encoded JSON or UTF-8 base64/base64url JSON. `#data=`, `#golingo=`, and the gallery’s `#golingoLesson=` are also accepted. Query parameters `golingoLesson` and `lesson` accept the same lesson data. A gallery launch takes priority over other payload parameters. For large lessons, prefer the JavaScript bridge. Imports accept up to 2,000 entries and files under 2 MB. JSON/line content is normalized and displayed as text.

## Audio and mobile behavior

Zen background music is enabled by default and begins with the **Enter the pond** gesture. The **Zen music** button controls music separately from pronunciation. **Pond** and **Settings** include a music switch and volume slider. The soundtrack is an original, continuously generated pentatonic arrangement with soft plucked notes, warm sustained pads, a low drone, and gentle reverb. It uses local Web Audio synthesis with no streamed music or asset download.

Music lowers its volume while a pronunciation or supplied voice clip is playing, then returns smoothly. It continues through word-list and settings dialogs, fades out for an explicit pause or hidden page, and resumes with play. The music preference and volume are saved alongside the existing settings.

The Start button primes audio from a user gesture. Spoken audio requires a suitable installed device voice or a working supplied audio URL. A speaker button explicitly enables pronunciation. Pause, backgrounding, and dialogs stop repeating speech. Word-list replay is allowed within a dialog. Background audio is optional and synthesized locally.

Pointer capture and `touch-action: none` keep dragging on the pond from scrolling or selecting text. UI buttons are independent of pond input. No pointer-lock, fullscreen, microphone, camera, or orientation permission is required. Portrait and landscape layouts are supported.

## Technical structure

- `index.html`: application shell, metadata, startup fallback.
- `styles.css`: responsive interface and accessible native dialogs.
- `app.js`: gameplay, progression, import/export, local storage, host bridge.
- `pond.js`: Canvas 2D pond, original animated koi, scenery, physical collection, input.
- `learning.js`: vocabulary, payload validation, pronunciation with activity events, procedural ambience.
- `music.js`: original zen music composition, cached instruments, reverb, scheduling, volume and voice ducking.

All runtime code and artwork are local. There are no CDN dependencies, asset downloads, package installation steps, accounts, ads, or backend requirements in the game itself. The optional GoLingo website link opens the main GoLingo site. Audio URLs supplied by the host or player are fetched when played.

Serve this folder through an HTTP(S) static host; opening the HTML directly with `file://` may block ES modules. Run `node --check app.js`, `node --check pond.js`, `node --check learning.js`, and `node --check music.js` for JavaScript syntax verification. No build step is required.

## Scope

This first playable version focuses on language discovery, matching, koi growth, and atmosphere. It includes a dragon appearance unlock, not a separate dragon realm, breeding system, trading, multiplayer, or a native App Store package.

## Verification of the first playable version

Browser checks covered 390×844 portrait, 844×390 landscape, 320×568 compact layouts, physical guided collection, wrong and correct practice answers, assisted-answer bookkeeping, pause behavior, saved-word replay/export, custom Spanish imports, language retention when switching import format, persistence on reload, and the four-word Sanke unlock. Runtime audio was unavailable in the cloud browser; the device-voice fallback message was verified. Actual iPhone/WKWebView audio requires on-device verification.

Module validation covered all 225 starter-language pairs, payload shapes and limits, unsafe audio URL rejection, and 72 navigation simulations across different frame rates and viewports. The source has no third-party JavaScript dependencies.

## Version 1.1 verification

Browser checks verified music startup, independent music switching, saved volume, explicit pause/resume, guided collection, and portrait/landscape resizing, including 390×844 and 700×390. The final startup check produced no application audio errors. Speech voices were unavailable in this cloud browser; actual iPhone/WKWebView playback still needs on-device verification.

Simulation checks covered eased steering and arrival at varied frame rates, pearl spacing after rotation, suspended rendering, and adaptive canvas resolution. Music checks covered bounded scheduling, rapid enable/disable cycles, voice ducking, sample-rate compatibility at 44.1 and 48 kHz, and fallback when reverb is unavailable. These checks do not establish a device-specific frame-rate guarantee.
