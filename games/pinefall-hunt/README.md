# Pinefall — GoLingo Word Hunt

A complete static Three.js r170 game, built for touch devices and desktop browsers. All scenery, deer, rifle geometry, textures, and sound are generated in code. Three.js is bundled locally, so gameplay does not rely on a third-party CDN.

## Playing

Choose **Word hunt** to complete a shuffled language lesson at your own pace, or **Timed word trail** for a four-minute challenge. Listen to the current word or phrase, find the deer carrying it, and land a clear shot to collect it. Other words are distractors; hitting one does not collect or down it. Correct hits award points. The results show points, words collected, accuracy, and longest shot. **Keep practicing** continues with replenished ammunition. Words, settings, and personal bests are saved on the current device when local storage is available.

On a phone or tablet, drag the left wheel to move and drag the forest to look. The right controls provide Scope, Fire, Reload, and Steady. Crouch allows a quieter approach. Track turns toward a live deer carrying the current learning word. Tap the zoom indicator while scoped to cycle 4×, 8×, and 2× magnification. Landscape provides a wider view; portrait is also supported.

Desktop controls:

| Action | Input |
| --- | --- |
| Walk | WASD or arrow keys |
| Look | Drag the forest; optional mouse lock in settings |
| Fire | Click without dragging, or Fire button |
| Scope | F or right-click |
| Reload | R |
| Crouch | C |
| Steady aim | Hold Space while scoped |
| Move faster | Hold Shift |
| Track current word | T or Track button |
| Pause | Escape or Pause button |

The scope has a four-second breath reserve. Deer react to nearby movement and gunshots. Tree trunks, terrain, rocks, and fallen logs block shots. Successful hits use a brief nongraphic fall animation.

## Language lessons

The default forest lesson has eight nature words. The lesson editor supports English, Spanish, Japanese, Chinese, French, German, Korean, Vietnamese, Portuguese, Italian, Russian, Arabic, Hindi, Thai, and Ukrainian starter lessons. Custom lesson language codes are also preserved. Changing the language of a custom lesson changes pronunciation metadata; it does not translate the supplied text.

Open **Lesson** to choose languages, paste JSON or `word = translation` lines, load a JSON/TXT file, and control the word card, translations, labels over deer, and repeating speech. **Words** opens the review basket with word and example-sentence playback and GoLingo JSON export.

The review basket retains words across lessons. Export and Copy include the currently selected language pair so the exported GoLingo metadata remains correct; entries from other language pairs remain available in the basket.

Audio URLs are preferred when supplied; browser speech is the fallback. Speech repeats the current word while searching, pauses with gameplay, confirms collected words and example sentences, and continues to the next word. The speaker button can replay a word after a browser audio restriction.

The gallery forwards its active lesson as `#golingoLesson=<encoded JSON>` in the same tab. Pinefall also accepts `lesson`, `payload`, `data`, `words`, and `sentences` URL parameters, and the shared `sessionStorage` key `golingo:active-lesson:v1`. Direct app imports replace the current lesson unless `{append:true}` is supplied. The early bridge queues lessons until the game is ready.

```js
window.GoLingoGame.importWords({
  primaryLanguage: "en",
  learningLanguage: "ja",
  words: [
    { id: "101", word: "水", translation: "water",
      sentence: "水を飲みます。", sentenceTranslation: "I drink water." }
  ]
});
```

Compatible aliases include `GoLingoBridge.loadLesson`, `loadGoLingoData`, and `receiveGoLingoData`. Native `webkit.messageHandlers.golingo` receives ready, import, progress, basket, and error messages. Original GoLingo IDs remain intact. Call `GoLingoGame.getImportDiagnostic()` to inspect import readiness.

## Project structure

- `dist/index.html` — accessible HUD, controls, menus, and result screen.
- `dist/style.css` — responsive desktop, portrait, and landscape layouts.
- `dist/game.js` — game state, input, AI, collision, hit detection, score, and rendering.
- `dist/environment.js` — terrain, trees, lake, mountains, lighting, and environmental animation.
- `dist/models.js` — procedural articulated deer and first-person rifle.
- `dist/audio.js` — gesture-activated synthesized forest and game audio.
- `dist/bridge.js` — early GoLingo native and message bridge.
- `dist/learning.js` — import, normalization, lesson order, preferences, and review basket.
- `dist/lesson-audio.js` — serialized audio clips and pronunciation.
- `dist/learning-ui.js`, `dist/learning.css` — compact word card, lesson editor, and review UI.
- `dist/sample-lesson.json` — example GoLingo input.
- `dist/vendor/three.module.js` — Three.js r170 and adjacent license.
- `.openai/hosting.json` — static hosting configuration.

Serve `dist/` over HTTP(S). No package installation or build step is needed. Run `npm run check` for JavaScript syntax checks. A browser with WebGL2 is required. On-screen settings provide adaptive, high, and battery-saving graphics, sensitivity, inverted look, aim assistance, volume, optional fullscreen, and optional mouse lock.

## Implementation notes

Touch movement uses pointer capture with separate look and movement pointer IDs. Wheel interaction does not pause the game. Pointer-lock loss releases held movement without opening the pause menu. A hidden document pauses the hunt. Audio failure never blocks play.

The app is a single-player game. It does not collect personal data, require an application account, make purchases, or connect to third-party game services. Hosting access is managed separately by the site host.
