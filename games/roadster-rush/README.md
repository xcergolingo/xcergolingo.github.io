# Roadster Rush — GoLingo Learning Drive

This restored edition combines the supplied smooth Roadster model from
`Roadster-Procedural-Source.zip` with the original sunset-highway game and
GoLingo language lessons. The built HTML includes Three.js r170, every model,
texture, style and game sound. No CDN, model download, web server or npm install
is needed to play the built file in a browser that supports WebGL 2.

## Play

**Play online:** https://xcergolingo.github.io/games/roadster-rush/

Open the live game and tap **Start**. You can also open a downloaded `index.html` as a web page. Start the Spanish
demo, or choose **Change lesson** to paste your own words or sentences.
A document or attachment preview may display HTML without running its scripts;
in that case open the actual web page in a browser or GoLingo's game view.

**Inspect the Roadster** opens an orbit viewer. Drag to orbit, scroll or pinch
to zoom, or choose Front, Rear or Side.

| Action | Desktop | Touch |
| --- | --- | --- |
| Steer on the road | Turn the wheel, or A / D / arrow keys | Turn the steering wheel |
| Flip in the air | Turn the wheel, or A / D / arrow keys | Turn the wheel left or right |
| Fly | Hold Space, W or Up | Hold THRUST |
| Barrel roll | Shift or R | FLIP |
| Pause driving | P or pause button | Pause button |
| Pause word repetition | Voice button | Voice button |
| Hear a word again | Click the current word | Tap the current word |
| Review vocabulary | Basket | Basket |

Turn the steering wheel to move smoothly left or right across the road. Release
it to center the wheel and hold your chosen road position. While airborne, a
deliberate left or right turn triggers a full flip in that direction. Holding
the wheel does not restart the flip; center or release it before turning again.
You can hold THRUST with one finger while turning the wheel with another.

Practice mode uses forgiving traffic and gentler acceleration. Rush mode uses
faster traffic and ends a run on impact. Both modes keep ramps, flight, flips,
lightning pickups and language gates.

## Language lessons

Choose any valid BCP47 language code, such as `ja`, `en`, `zh-CN`, `es`, `fr`,
or `pt-BR`. The language suggestions are not a fixed set of supported languages.

Paste one row per item:

```text
水 | water | 水を飲みます。 | I drink water.
船 | boat | 船に乗ります。 | I ride the boat.
```

The third and fourth columns are optional context and its translation.
Tab-separated text and JSON also work. Word mode keeps vocabulary phrases
whole. Sentence mode creates one gate per word and then a finish gate for the
whole sentence. Explicit per-word translations can be supplied in sentence JSON.
Automatically segmented words do not receive invented translations.

Collect a turquoise gate by driving or flying through its lane. A missed gate
returns with the same word. Collected words repeat until the next word or until
you pause the voice, with a 1.5-second rest after each completed playback. A
sentence finish gate reads the full sentence once. The basket preserves words,
translations, context, language codes and practice counts across runs.

Recordings supplied with a lesson take priority. If playback fails, the game
uses an installed speech voice matching the item's language. It does not
substitute an unrelated language. External recordings require a connection;
the game itself does not. Voice availability depends on your device. Tap Start
first to activate audio, and tap the current word to retry if your browser
blocks pronunciation.

## GoLingo integration

Canonical payload:

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

Optional item fields include `wordAudioUrl` (or `audioUrl`),
`translationAudioUrl`, `sentenceAudioUrl` and `sentenceTranslationAudioUrl`.
Per-item language codes are retained.

```js
window.GoLingoGame.importWords(lesson);
window.GoLingoGame.importWords(moreWords, { append: true });
window.GoLingoGame.getLesson();
window.GoLingoGame.getReview();
window.GoLingoGame.exportToGoLingo();

// Compatibility aliases:
window.RoadsterRushLanguage.load(lesson);
window.RoadsterRushLanguage.setLanguages({
  learningLanguage: 'ja', primaryLanguage: 'en'
});
```

The early bridge is installed synchronously before the 3D scene starts. Calls
made while the game opens are queued and applied when the lesson controller is
ready. This supports WKWebView hosts that inject a lesson in `didFinish`.

A gallery can launch with `#golingoLesson=` followed by an encoded JSON lesson.
The game also accepts `?lesson=`, `?data=`, `?golingoLesson=` and the same-origin
session-storage key `golingo:active-lesson:v1`. URL-safe UTF-8 base64 payloads
are accepted. URL data takes precedence over the saved gallery lesson.

Native `window.webkit.messageHandlers.golingo` receives metadata events
`ready`, `wordsImported`, `error` and `lessonComplete`. Each event has a bare
`type` and `event`, a prefixed `bridgeType`, and `game: "roadster-rush"`.
Exports use `golingoExport` when present, otherwise a JSON download.

Browser parents can send `golingo:importWords` messages from the game's own
HTTP(S) origin, `https://golingoapp.com`, `https://www.golingoapp.com`, or
`https://xcergolingo.github.io`. Additional exact HTTP(S) origins can be
configured in `window.GoLingoAllowedOrigins` before initialization. The sender
must be the current window, parent or opener. Opaque file/native hosts should
use the direct JavaScript API.

## Startup and recovery

The small startup script is separate from the main bundle so it can report
main-script parse errors and blocked scripts. Loading yields between the
renderer, reflections, model, highway and lesson stages. After a slow stage,
it offers an explicit retry. It never reloads automatically or clears lessons.

**Try lighter graphics**, or `?graphics=low`, keeps the full supplied model and
all language features while reducing optional graphics work. It skips the
reflection bake, clearcoat and realtime shadows and lowers pixel ratio.
The same lesson URL and other query parameters are preserved on retry.

## Build and edit

Node.js 18 or later is sufficient. No npm packages are required to build.

```sh
node build.mjs
npm test
```

The builder creates `dist/index.html` and `dist/roadster_rush_game.html`.
Use the built `index.html` for static hosting. The source modules remain
readable; the built file embeds them in a classic script for offline loading.

- `src/createRoadster.js`: the actual supplied model, with its import adapted.
- `src/model-integration.js`: coordinate transform, batching and animation.
- `src/lighting-environment.js`: procedural sunset and reflection environment.
- `src/palm-replacement.js`: connected curved palms.
- `src/game.js`: original road game with the integrated model and input fixes.
- `src/steering-wheel.js`: mouse/touch wheel, pointer ownership and input reset.
- `src/lesson-engine.js`: lesson data, speech lifecycle and review state.
- `src/word-gates.js`, `src/learning-app.js`: gates and language interface.
- `src/boot-bridge.js`, `src/game-bridge.js`: early and active app handoff.
- `src/boot.js`: startup reporting and recovery.
- `src/index.template.html`, `src/style.css`, `learning.css`: responsive UI.
- `src/vendor/`: pinned Three.js r170 and its MIT license.

The source Roadster is an independent concept, not official Tesla CAD.
Its smooth body, continuous canopy, LED details, wheels, mirrors, diffuser,
and four rear nozzles are retained. Rigid batching preserves all 167,474
source triangles while reducing its physical draw objects from 281 to 63.

This is a rebuilt edition recovered from the original game and supplied model,
not a byte-for-byte recovery of the expired October 19 download.
