# Word Fleet — GoLingo

A mobile-friendly naval battle and language-learning game. Word Fleet v2 combines a classic 10×10 tactical board with an original animated fleet and a vocabulary collection. The browser app uses plain HTML, CSS, and JavaScript, with no build step, external fonts, game libraries, or image dependencies.

**Play:** https://xcergolingo.github.io/games/word-fleet/

**Games gallery:** https://xcergolingo.github.io/games/

## Play

Open `index.html` in a modern browser, or serve this directory with any static host. Each captain commands five ships occupying seventeen squares on a 10×10 board:

| Ship | Squares |
| --- | ---: |
| Carrier | 5 |
| Battleship | 4 |
| Cruiser | 3 |
| Submarine | 3 |
| Patrol boat | 2 |

During deployment, select a ship and click or tap its new starting square, drag it to move, or use **Rotate** to change direction. **Shuffle** supplies a fresh legal formation. Ships stay inside the board and leave a square between them, including diagonally. Select **Battle stations**, then choose coordinates in Enemy waters. Hit every section of an opposing ship to sink it; sink all five to win.

Learning happens on successful hits by default: a hit discovers a word and plays its pronunciation when audio is enabled. Sinking a ship reveals an example sentence when the learning pack supplies one. Enable **Quiz before firing** in Settings for a question before each shot. Incorrect answers provide feedback and allow another try without spending a shot. XP and captain ranks add progression alongside the wordbook.

Choose a firing rule for each new battle:

| Rule | Turn behavior |
| --- | --- |
| One Shot | Captains alternate after each shot. |
| Hitting Streak | A hit earns another shot; a miss hands over the turn. |
| Salvo | Each captain takes three shots in sequence before handing over the turn. The battle ends immediately if the last ship is sunk. |

Play solo against the computer, or use **Pass & play** for two captains sharing one device. Pass-and-play uses a full-screen privacy handoff between captains so the next fleet is revealed only after the receiving player is ready. The default computer is relaxed; Tactical difficulty follows visible hits without reading hidden ship positions. Opponent difficulty changes apply to the next battle. New battles shuffle the fleet and learning deck.

Six starter packs each contain twenty beginner words, complete example sentences, and English translations: Spanish, Japanese, French, Chinese, German, and Korean. Japanese, Chinese, and Korean include romanization. Custom imports support 32 language selections and other valid language codes supplied in JSON; this does not provide automatic translation.

Every practiced word is saved to a wordbook on this browser/device. Sinking a ship unlocks a supplied example sentence, spoken once. The wordbook can export the current language pair as GoLingo JSON. Settings and the current learning pack also persist locally. **An in-progress battle does not persist after a page reload**; pausing keeps the current battle only while the page remains open.

## Fleet presentation

The ocean scene uses original procedural ship meshes projected through Canvas2D. It does not require WebGL, downloaded models, or third-party game artwork. The five vessel types include shaped hulls, turrets, bridge windows, radar masts, carrier aircraft, submarine details, wakes, and distant islands. Matching top-down SVG ships appear on the tactical board.

Settings offer Atlantic steel, Arctic white, and Burnished copper paint schemes. **Ocean view / Blueprint** changes the presentation, and **Action camera** adds close views of hits and sinking ships. The animation respects reduced-motion preferences and pauses when the page is hidden. These presentation controls do not alter the fleet positions or battle rules.

## Scope

This version provides solo computer battles and local pass-and-play. Online matchmaking, remote multiplayer, player accounts, and cloud battle saves are not implemented. Browser/device storage keeps the wordbook and preferences; exported GoLingo JSON is the portable copy of the learning collection.

## Learning content

Use **My words** to paste pipe-, tab-, or semicolon-separated entries, or import a JSON/text file:

```text
barco | ship
mar | sea
Buenos días. | Good morning.
```

GoLingo JSON example:

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

`sentences` and `phrases` arrays preserve full sentences and phrases as learning entries. The gallery’s `items` and `entries` arrays are also accepted. `translationLanguage` is an alias for `primaryLanguage`; an explicit `primaryLanguage` takes precedence. Optional `audioURL` and `sentenceAudioURL` play supplied recordings before falling back to browser text-to-speech. Use HTTPS URLs for hosted clips. An import must contain translations; the app does not send text to a translation service. Limits: 1 MB input and 1,000 entries.

## GoLingo / WKWebView bridge

After the page is loaded, invoke one of these equivalent functions with the JSON object or JSON string:

```js
window.GoLingoGame.load(payload);
window.loadGoLingoData(payload);
window.receiveGoLingoData(payload);
window.setLearningContent(payload);
```

The return value is `{ok, count, primaryLanguage, learningLanguage}`, or `{ok:false, error}`. Loading content starts a fresh battle. Encode JSON with `encodeURIComponent` for a `?data=` URL, or supply UTF-8 base64/base64url data. `?content=`, `?lesson=`, `#data=`, `#content=`, `#lesson=`, and the gallery’s `#golingoLesson=` are also supported. `?lang=es` selects a built-in starter pack.

Known GoLingo hub origins and same-origin pages can send:

```js
gameWindow.postMessage({type: 'GOLINGO_DATA', payload}, gameOrigin);
```

Allowed cross-origin hubs are `https://xcergolingo.github.io`, `https://www.golingoapp.com`, and `https://golingoapp.com`. Supported types are `GOLINGO_DATA`, `golingo-data`, `golingo:content`, and `loadWords`. The game acknowledges with `golingo:loaded` to the sender's specific origin. A sandboxed parent with an opaque origin is also accepted. Other origins are ignored.

Optional native message handlers:

- `golingoReady` receives `{game:'word-fleet', ready:true}` after startup.
- `golingoExport` receives the wordbook JSON when the user taps Export, alongside the browser download path.

`window.GoLingoGame.exportWords()` returns the currently selected language pair's practiced entries for a native caller.

## Audio and accessibility

Pronunciation uses supplied recordings or the device/browser speech service, with a matching installed voice when available. Voice availability and media policies vary by device. The game needs no microphone permission. The first intentional shot or Listen action unlocks audio. Word repeats stop on a new word, mute, pause, relevant modal, page hiding, or playback error. Sink sentences play once, including the winning sentence.

Native buttons support keyboard activation; arrow keys navigate the attack board and number keys 1–4 answer a challenge. Dialogs provide modal focus handling, visible focus indicators, named controls, and status feedback. Reduced motion is respected. Imported text is displayed as text, never injected as markup.

## Files and checks

- `engine.js`: placement, turn rules, hits, sinking, and computer targeting.
- `learning.js`: starter packs, import normalization, quiz choices, export.
- `audio.js`: guarded pronunciation lifecycle and procedural sound effects.
- `naval-scene.js`: original projected 3D Canvas fleet, ocean animation, action effects, and SVG ship artwork.
- `app.js`: game UI, pass-and-play handoffs, XP, local wordbook, preferences, and GoLingo bridge.
- `index.html` and `styles.css`: accessible responsive interface.

Run `node checks/engine-check.mjs` and `node checks/learning-check.mjs`. Engine checks cover legal placements, turn and victory rules, targeting visibility, and completed games. Learning checks cover Unicode content, tiny packs, distinct choices, import/export, sentence audio, unsafe audio URLs, and deck immutability.
