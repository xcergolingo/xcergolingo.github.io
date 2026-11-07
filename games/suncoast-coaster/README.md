# Suncoast — GoLingo Word Coaster

A playable Three.js r160 language-learning roller coaster in a sunny island amusement park. The train follows the rails while the player hears, repeats, and collects words or sentences at eight learning gates per lap. All scenery, train geometry, track, textures, and ride sound are created procedurally. Three.js and its license are bundled locally; the game does not depend on a CDN.

## Play

Press **RIDE & LEARN**. The default **Learn & ride** mode continues around the circuit and brings another batch of lesson entries each lap. **Thrill run** adds an optional speed challenge. The coaster follows the track automatically. Drag the scene to look around, and choose front-seat, chase, or park cameras.

The learning card displays the current word or sentence and its translation. Tap it to replay pronunciation; tap **Example** to hear a word’s example sentence. Open **Lesson** to choose word or sentence practice, import vocabulary, and change translation, repeat, and speech settings. Show translation and repeat-until-next-word start enabled and stay saved when changing lessons.

The vocabulary basket collects discoveries for replay, JSON export, and copying, with separate collections for each language pair. Starter lessons are available in Spanish, Japanese, Chinese, and French with English translations. Import other language pairs using the selectors; selecting a language does not silently relabel the currently loaded lesson.

| Action | Touch | Keyboard |
| --- | --- | --- |
| Boost | Hold BOOST | W or Up arrow |
| Brake | Hold BRAKE | Space or Down arrow |
| Look around | Drag the scene | Drag with mouse |
| Camera | Camera buttons | C |
| Pause/resume | Pause / resume buttons | P or Escape |
| Restart | Start again | R |
| Ride sounds | Top speaker button | — |
| Pronunciation | Tap the current word or a basket entry | — |
| Lesson and vocabulary | Lesson / basket buttons | — |

The 905-meter course includes a 62-meter chain lift, a steep drop, banked turns, and raised crossings. The first lift automatically pulls the train uphill. Boost recharges when released; braking and boosting have no effect on the train's path. Low-speed assistance keeps the train moving up later hills.

In **Thrill run**, pass all eight learning gates. Each awards 100 points, or 300 if your speed is within its displayed range. Results include perfect gates, top speed, ride time, and a local personal best. **Learn & ride** continues around the circuit without a results interruption; new lesson entries arrive each lap.

Pronunciation starts after the user starts a ride. Supplied audio recordings are tried first, with browser text-to-speech as fallback. Tap a word if the browser blocks automatic pronunciation. The available voices depend on the device. Ride ambience is separately off initially; tap the top speaker to enable wind, wheel rumble, chain-lift clicks, achievement chimes, and ambient tones. Pausing, opening a learning panel, or hiding the page stops automatic pronunciation. Releasing a touch or dragging over a control never opens the pause overlay.

## Bring a GoLingo lesson

The gallery forwards its shared lesson through a same-tab game link. Suncoast reads `#golingoLesson=<URL-encoded JSON>`, `?lesson=<JSON>`, and the gallery’s `sessionStorage` key `golingo:active-lesson:v1`. Native integrations can call these equivalent methods after the game has loaded:

```js
const lesson = {
  primaryLanguage: 'en',
  learningLanguage: 'ja',
  words: [{
    id: '101', word: '水', translation: 'water',
    sentence: '水を飲みます。', sentenceTranslation: 'I drink water.'
  }],
  sentences: [{
    id: 's101', sentence: '海が見えます。', sentenceTranslation: 'I can see the sea.'
  }]
};
window.GoLingo.load(lesson);
// Equivalent aliases:
window.loadGoLingoData(lesson);
window.setGoLingoData(lesson);
```

Words may include `audioUrl` and `sentenceAudioUrl`. Trusted `postMessage` payloads and common aliases such as `translationLanguage`, `phrases`, `items`, and `entries` are accepted. Imported text is rendered as text, never as HTML. Lessons and vocabulary are stored locally; the game does not upload them to a server.

You can also paste one entry per line in Lesson:

```text
agua = water | Quiero agua. | I want water.
cielo = sky | El cielo está azul. | The sky is blue.
```

See `sample-lesson.json` for a complete Japanese example. The export format uses `primaryLanguage`, `learningLanguage`, `words`, and `sentences` so collected vocabulary can be reused in GoLingo.

## Local development

Serve this game directory with a static HTTP server, for example:

```sh
python3 -m http.server 8000 --directory .
```

Open `http://localhost:8000` in a current browser with WebGL enabled. Direct `file://` opening is not supported by browser module security.

No build or package installation is required. `npm run check` validates the main JavaScript modules.

## Source layout

- `index.html` and `style.css`: responsive game interface.
- `main.js`: train, cameras, arcade physics, challenge gates, controls, and game state.
- `learning.js` and `learning.css`: imports, pronunciation, lesson controls, vocabulary collection, and export.
- `track.js`: arc-length track frames, rails, supports, lift, and station.
- `park.js`: island, ocean shader, Ferris wheel, carousel, landscaping, and park props.
- `audio.js`: procedural Web Audio.
- `vendor/three.module.js`: bundled Three.js r160.
- `vendor/LICENSE-three.txt`: Three.js license.

## Verification limits

JavaScript syntax, scene construction, track geometry, full-lap physics, and learning-state logic are checked separately from graphics. The available cloud preview browser reports WebGL disabled, so GPU rendering, frame rate, actual touch behavior, and audible pronunciation could not be visually verified there.
