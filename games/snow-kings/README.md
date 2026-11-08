# Snow Kings — GoLingo Winter Language Adventure

A no-build Three.js (r170) snowball-rolling winter language game. The GitHub Pages version lives in `games/snow-kings/` and imports the site's existing local Three.js file at `../argon-airspace/three.module.js`. No CDN, API key, or backend is required. This version features **five AI snowball rivals**, not online multiplayer.

## Learn with GoLingo

- Roll over the **glowing GoLingo snowflake** to collect the current vocabulary word or sentence, earn bonus points, and advance to the next learning step. The rest of the village is still destructible for mass and score.
- Listen as the learning language repeats until you collect a new word, pause, or disable voice. If an HTTPS `audioURL` is present it is used first; otherwise the game uses the device's text-to-speech voice.
- Use the compact vocabulary ribbon to hide the word, show/hide translation, replay pronunciation, mute repeats, and open the review basket. The ribbon does not cover the main playfield.
- Open **Import lesson** from the title screen or the gear during play. Paste or upload GoLingo JSON, paste `word = translation` lines, or try the included 15-word Spanish winter lesson. Every new game randomizes the order of the words.
- Sentence lessons split into individual spoken words followed by the complete spoken sentence; `sentences` and `phrases` arrays are supported.
- Export the words you actually collected as `golingo-snow-kings-words.json` or copy the GoLingo JSON from your review basket.

Example lesson:

```json
{
  "primaryLanguage":"en",
  "learningLanguage":"ja",
  "words":[
    {"id":"1","word":"雪","translation":"snow","sentence":"雪が降っています。","sentenceTranslation":"It is snowing."},
    {"id":"2","word":"冬","translation":"winter"}
  ]
}
```

The game accepts a URL fragment `#golingoLesson=<URL-encoded JSON>` and the GoLingo gallery's `sessionStorage` key `golingo:active-lesson:v1`. It also exposes `window.GoLingoGame.importWords(payload)`, `window.GoLingoGame.getBasket()` and `window.GoLingoGame.exportWords({download:true})` to a hosting Swift/WKWebView application. Native progress messages are sent through `window.webkit.messageHandlers.golingo` if present.

## Play

- **WASD / Arrow keys:** steer the rolling snowball.
- **Drag on the game:** steer with mouse or touch.
- **Touch joystick:** dedicated drag control on mobile.
- **Space / Flare:** temporary speed boost, followed by a cooldown.
- **P / Help:** pause or resume.

Absorb gifts and snowmen, then larger trees, fences, cottages and ice watchtowers. Outgrow the five AI opponents. Reach 12,250 kg and crash into the Ice Palace to win before dawn. An avalanche event briefly removes village object size restrictions.

## Run locally

Serve the repository's `games/` directory with any static HTTP server, such as `python3 -m http.server 8000 --directory games`, then open `/snow-kings/`. ES module import restrictions mean opening `index.html` as a local `file://` URL is not supported.

The original stand-alone version under the Snow Kings Site's `dist/` folder vendors its own Three.js file; this gallery version reuses the neighboring Argon Airspace module to avoid shipping the same code twice.

## Implementation

- Three.js rendering, dynamic camera, instanced trees/fences/pickups, terrain hills, aurora shader, warm village lights, snow and impact particles.
- Custom momentum-and-slope sphere movement with size-scaled velocity and a spatial collision grid.
- Five AI bots which hunt pickups, avoid bigger rivals, and can absorb smaller snowballs.
- Live leaderboard, mass progression, boost, night countdown, avalanche event, sound/music synthesis, win/lose states.
- A Canvas 2D illustrated fallback shares all gameplay state when WebGL is disabled or unavailable.
- An original GoLingo language overlay, shuffleable word and sentence lessons, proximity learning beacons, browser speech/audio fallback, and a review/export basket.

No personal or player data is transmitted. This first version is solo with AI bots, not internet multiplayer.
