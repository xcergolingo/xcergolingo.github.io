# GoLingo Goal Club

**Play:** https://xcergolingo.github.io/games/goal-club/

**Gallery:** https://xcergolingo.github.io/games/#goal-club

A mobile-friendly soccer vocabulary game inspired by the curved-shot puzzles in Cool Goal. Aim through word targets, bend the ball around defenders, and collect words by scoring. The players, scene, interface, and game code are original to this project.

## Skill Shot Edition (version 4)

Version 4 adds hold-and-release power, slow-motion shot replays, and a challenge board with saved personal-best stars. It refines the players' preparation, jersey/boot details, keeper movement, and ball shading while keeping the established view and shot physics.

- **Tap or hold Kick:** a quick tap uses the selected power. After a brief hold, the meter sweeps between 35% and 100%; release at the power you want. Cancelling a pointer, pausing, changing rounds, or timing out cancels the hold safely. The slider remains available.
- **Replay Shot:** after a goal or miss, watch the recorded shot at 0.45× speed. Replay cannot add points, lose balls, or collect a word twice. Normal language audio resumes when the replay ends, and automatic progression still waits for the sentence to finish.
- **Challenge board:** open it from the start screen, settings, or the puzzle title. All 24 puzzles remain selectable. A first-attempt goal earns three stars, the second earns two, and later attempts earn one. Personal bests are saved on this device separately for each difficulty and learning mode.

The game now uses proportionate athletic players, a planted-foot kicking motion, natural turf and lighting, detailed stadium/city/forest scenery, a smaller ball, goalkeeper reactions, and net impact animation. Both WebGL and Canvas compatibility renderers support these changes.

| Shot | Best use | Power tradeoff |
| --- | --- | --- |
| Drive | A low, quick route through a gap | More power speeds up the ball and slightly raises its finish. |
| Curl | Bend around a defender wall | Medium flight height; choose curve and endpoint carefully. |
| Chip | Clear a low obstacle or log pile | A high arc; excessive power can strike the crossbar or sail over it. |

Select the shot type beside **Kick**. Open **Aim & power** to adjust power and curve. Gold rings award **150 bonus points**. In quiz modes every lane gets the same precision target, so the bonus never reveals the correct answer. Consecutive goals build a scoring streak.

Choose **Practice** for unlimited balls and slower guards, **Challenge** for three balls and a complete trajectory guide, or **Pro** for faster guards, narrower goals, an 18-second shot clock, and a guide showing only the early part of the flight. Settings and the opening menu both offer this choice. Pausing freezes the shot clock.

## Play

Choose a language and mode, then tap **Play**. Draw a curved route from the ball toward the goal and release to kick. You can also tap a word target, open **Aim & power**, and use **Kick**. Three successful shots complete a level. You have three balls: each miss uses one; losing all three restarts the current level while keeping your learned-word collection. Automatic progression waits for the example sentence to finish.

Words do not float over the goal or goalkeeper. Learn mode shows the word in the bottom card. Listen and Match keep their answer buttons in that card, labeled left, center, and right; these choices remain available when the word card is hidden.

The game has **24 distinct shot puzzles** across stadium, forest, and city environments. They combine defender walls, crossing runners, moving keepers, cones, log piles, and sliding barricades. Goals and starting positions vary. Shots can go wide or hit a post. Later tours increase movement speed and narrow the goals slightly. **Practice mode** offers unlimited retries and slower movement.

| Mode | Learning activity |
| --- | --- |
| Learn & Play | See and hear one word and its meaning. Score to collect it. |
| Listen & Score | Hear the target word and shoot through the matching written word. |
| Match the Meaning | See and hear a meaning, then shoot through its matching word. |

Starter packs contain 20 words and example sentences each in **Spanish, Japanese, Mandarin Chinese, French, Korean, and German**, with English meanings. Imported lists can use other language pairs.

| Control | Action |
| --- | --- |
| Swipe from the ball, then release | Draw the route and kick |
| Drag elsewhere on the pitch | Adjust aim and curve without kicking |
| Aim & power controls | Adjust shot power and fine-tune the curve around defenders |
| Kick / Next / Retry / Restart | Shoot, continue, retry, or restart the current level |
| Hold Kick, then release | Choose power with the live meter and kick |
| Replay Shot / Back | Watch the previous shot in slow motion or return to its result |
| Puzzle title / Choose a Challenge | Open the challenge board and saved stars |
| Left / right arrow | Aim with a keyboard |
| A / D | Adjust bend with a keyboard |
| 1 / 2 / 3 | Select Drive / Curl / Chip |
| Space / Enter | Shoot or continue |
| P / Escape | Pause or resume |

Settings include word repetition, translation visibility, practice mode, automatic progression, and a puzzle selector. The word card can be hidden to clear the view. The collection lets players replay learned words and export them as GoLingo JSON. Preferences, imported vocabulary, review counts, and puzzle records are stored locally in the browser.

## Import vocabulary

Use **Your words** to choose a JSON file or paste a list. The standard format is:

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
      "sentenceTranslation": "I drink water.",
      "audioUrl": "https://example.com/audio/water.mp3",
      "sentenceAudioUrl": "https://example.com/audio/drink-water.mp3"
    }
  ]
}
```

Only `word` is required per entry; include translations for meaningful matching practice. Audio URLs are optional—omit the example URLs when using speech synthesis. The importer also accepts `audioURL`, `wordAudioUrl`, `wordAudioURL`, and common text/translation aliases. Limits are 10,000 words and a 12 MB JSON file. For three-choice practice, supply at least three distinct words; smaller lists display fewer choices.

## GoLingo host integration

Send the vocabulary object after the game signals readiness. Use **postMessage**, a native JavaScript bridge, or file import for large lists; do not build giant query-string URLs.

### Parent page or game hub

Set `gameUrl` to the deployed game's exact URL. Register the readiness handler before loading the iframe:

```js
const frame = document.querySelector('#soccer-game');
const gameUrl = 'https://YOUR-DEPLOYED-GAME-URL/';
const gameOrigin = new URL(gameUrl).origin;
const payload = {
  primaryLanguage: 'en',
  learningLanguage: 'ja',
  words: [{ id: '101', word: '水', translation: 'water' }]
};

window.addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== gameOrigin) return;
  if (event.data?.type === 'GOLINGO_READY') {
    frame.contentWindow.postMessage(
      { type: 'GOLINGO_DATA', data: payload },
      gameOrigin
    );
  }
});
frame.src = gameUrl;
```

The game accepts messages from its own origin, `golingoapp.com` and its subdomains, `xcergolingo.github.io`, and `*.chatgpt.site`. Add a new trusted hub origin to `allowedMessage()` in `learning.js` when needed. A popup host can receive readiness through `window.opener` and use the same message format.

### Native GoLingo webview

After the game's module has initialized, invoke:

```js
window.receiveGoLingoData(payload);
```

`window.setGoLingoData(payload)` is an alias. Pass a JSON object or JSON string, serialized safely by the native host. When a WKWebView message handler named `golingo` or `gameReady` is registered, it receives:

```json
{"type":"GOLINGO_READY","game":"golingo-goal-club","accepts":"words","version":1}
```

The host can use this event to inject vocabulary. Imported content is treated as text and data, never as executable code. Small legacy URL/hash payloads are supported, but the message and bridge APIs avoid URL-length limits.

## Run and deploy

The complete buildless application is in this directory. Serve that directory over HTTP(S), for example during development:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. ES modules require a web server; opening `index.html` directly as a `file:` URL is not supported. Static hosting should publish the entire `dist/` directory, including the local Three.js vendor files. No package installation or CDN connection is required to load the game.

The preferred renderer is Three.js/WebGL, with a Canvas fallback for devices without a usable WebGL context. Both use the same gameplay and vocabulary engine. Three.js r170 is included under the MIT license; its notice is preserved in `vendor/LICENSE-three.txt`.

## Audio and device checks

Provided audio is preferred, with browser speech synthesis as fallback. Voice availability and pronunciation depend on installed device voices. Tap **Play** or **Listen** to activate sound; repeat playback stops when paused or muted. Imported audio needs a reachable URL. Test speech, audio URLs, touch input, and viewport behavior on the intended iPhone/WKWebView before wider release; desktop browser checks cannot confirm those device-specific behaviors.

## Release verification

- JavaScript syntax checks passed for the game, Three.js scene, Canvas renderer, and vocabulary engine.
- Browser checks passed for a straight-shot collision, a curved goal, example-sentence reveal, automatic progression, swipe-to-release shooting, three-miss failure, and level restart.
- Matching mode correctly rejected a wrong word and accepted the right word after retry; listening mode concealed the prompt text and displayed three answers.
- Portrait (390 × 844) and landscape (844 × 390) interfaces were checked. Word target spacing was corrected in both orientations.
- Empty word lists were rejected with a clear message. A standard Japanese GoLingo payload loaded all three sample words and their language metadata.
- Pause/resume and sound settings were checked.
- The QA browser did not provide WebGL or speech playback. Interactive checks used the Canvas compatibility renderer. Native WebGL visuals and device voices still require an actual compatible device; neither is claimed as browser-verified.

- All 72 quiz-lane solutions across the 24 puzzles pass swept-collision checks at both 10 Hz and 60 Hz outer frame rates, with zero result mismatches. Partial curved swipes retain the fitted target and bend.
- Obstacle extents and player collision heights were checked against the rendered geometry; flight collisions account for ball height.
- Playback-completion tests cover long imported audio, cancellation, pause, mute, repeats, failure, and audio-to-speech fallback. Real device audio is still required to validate pronunciation.

### Version 3 checks

- Browser checks confirmed a straight Curl hits the wall, a 4.5-bend Curl scores and reveals the example sentence, and a full-power Chip goes over the bar and costs a ball.
- Pro's 18-second clock remained unchanged while paused, resumed with play, and produced a timeout with one ball deducted. Match mode displays three word targets with equivalent precision rings. Portrait and landscape layouts were inspected.
- Three shot profiles use consistent flight duration and vertical trajectories; excessive chip power can go over the bar.
- Every quiz lane has a clear route in Challenge and Pro, including the maximum later-tour settings.
- The kicking boot reaches the ball at the simulation's strike time; player geometry has no nonfinite vertices.
- The compatibility renderer exercises all three environments, raised-ball shadows, goalkeeper reaches, net pulses, precision rings, and the shortened Pro guide.
- Native WebGL rendering and physical iPhone audio/touch behavior still require an actual compatible device. The available browser uses the Canvas compatibility view.

### Version 4 checks

- Browser checks confirmed a quick tap used 72% power and scored once, a 900 ms hold released at 80% and scored once, and slow-motion replay preserved the score, balls, and word collection. The challenge board correctly displayed the saved first-attempt three-star result.
- Focused tests exercise the actual input and replay functions: cancelled pointers restore power, release after timeout never triggers Retry, held keyboard keys do not repeat actions, replay restores poses and hit flags, and replay restarts the goal lesson without scoring again.
- Progress tests cover monotonic personal bests, difficulty/mode separation, reload, corrupt storage, denied storage, numeric bounds, and defensive copies.
- Player charging keeps boots planted. Native strike geometry matches version 3 exactly; keeper animations preserve patrol coordinates. Canvas checks cover all themes/styles, portrait/landscape, charge, pause, and replay clock rewind with finite drawing coordinates.
- The cloud browser verified the Canvas compatibility view. Native WebGL rendering and iPhone-specific audio/touch behavior are not claimed as device-verified.

## GitHub Pages release

This folder contains the latest Goal Club game, including the cleared goalkeeper view. Both gallery links adapt shared words, phrases, and sentences into a GoLingo word pack and send it through `#data=`. Links stay in the current tab for WKWebView compatibility. `preview.jpg` is an actual gameplay screenshot, not concept artwork.
