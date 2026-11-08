# Argon Airspace — GoLingo Flight School

A self-contained, 1950s-style air-traffic-control arcade game with procedurally built 3D aircraft, runways, Web Audio swing, and vocabulary landing drills. Three.js is vendored locally; no API key or paid assets are needed.

## Play

Open `index.html` from a local HTTP server, or play at `https://xcergolingo.github.io/games/argon-airspace/`. Drag from each incoming aircraft to a runway outlined in the same color. Green helicopters use the H pads. Keep aircraft safely separated; a collision or a missed approach ends the shift. Use ×2 for faster simulation or Pause to hold your position.

## Learn languages

Every aircraft carries a GoLingo word or sentence. On landing, it is collected, displayed in the compact bottom radio, and spoken using the learning language voice. Enable **Repeat until next landing** for continuous listening, or turn off **Show words** / **Show translation** to challenge your memory. The controls do not stop normal flight-path gestures.

Use **Lesson → Load lesson** to paste a GoLingo JSON payload, or pass one from the games gallery in `#golingoLesson=`. If no lesson is supplied, a 16-word Spanish aviation lesson is available. Each shift shuffles the lesson order. The basket can be exported as GoLingo-compatible JSON; only successfully landed words count.

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    {"id": "101", "word": "水", "translation": "water", "sentence": "水を飲みます。", "sentenceTranslation": "I drink water."},
    {"id": "102", "word": "船", "translation": "boat", "sentence": "船に乗ります。", "sentenceTranslation": "I ride the boat."}
  ]
}
```

The importer accepts `words`, `sentences`, `phrases`, `items`, or `entries` arrays. `audioUrl` can override the browser's speech synthesis if it is an HTTPS address.

For a native app hosting the game inside `WKWebView`, navigate in the same web view with the lesson in the fragment; no external Safari launch is required. Example:

```js
const lesson = {primaryLanguage:'en',learningLanguage:'ja',words:[{word:'水',translation:'water'}]};
location.href = 'https://xcergolingo.github.io/games/argon-airspace/#golingoLesson=' +
  encodeURIComponent(JSON.stringify(lesson));
```

The page additionally supports a `postMessage` payload of `{type:'golingoLesson',payload:lesson}` from a parent frame.

## Files

- `index.html` — responsive 1958 controls and lesson modal
- `app.js` — Three.js airfield, splines, flight physics, scoring, collisions, audio
- `lesson.js` — lesson parsing, shuffle, TTS looping, preferences, export
- `three.module.js` — local copy of Three.js r170

Original artwork, procedural sound, and code. No external font, image, or music dependencies.
