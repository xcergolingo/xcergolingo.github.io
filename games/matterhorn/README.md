# Matterhorn — Neon Stream

A complete first-person Three.js r170 ski and language-learning prototype. Learn
your own sentences, words and phrases beneath the Matterhorn, or choose Free Ski
for 42 neon gates on a 2.8 km descent to a Schwarzsee-inspired village.

## Ski & Speak / 05 — Finish the sentence

Public game: https://xcergolingo.github.io/games/matterhorn/
Games gallery: https://xcergolingo.github.io/games/ — choose **Sports**.

Words appear only inside the course rings. There is no word card over the ski
view. Pronunciation repeats from the start of a lesson and switches to the word
in each ring you pass. The compact **Pause Repeat / Resume Repeat** button (or
**V**) controls pronunciation independently of skiing. A manual pause stays in
effect across subsequent rings, including when the next word changes. Pausing
the game suspends speech; resuming restores the latest word. If browser speech
is blocked, the same button becomes **Enable Repeat** for a direct user tap.
Unexpected native speech cancellations and temporary network errors retry the
current word instead of silently ending its loop. Chimes stay quiet during
lessons and ski noise is reduced throughout repeating pronunciation.

The full sentence appears on a large sign above the finish gantry after the
last word ring, then remains at the top of the results panel with its translation.
It plays once at the finish. Result focus uses `preventScroll`, so the bottom
restart button no longer scrolls the sentence out of view on a phone.

The course follows the reference's ski-run logic: banked carving, six marked
kickers, aerial rings, slalom flags and thin cyan/magenta course boundaries.
Fixed safety-net chicanes extend from alternate piste margins with arrows
pointing toward the open side. Floating pickups, crossing ice pillars and
random rails have been removed. Close carves earn bonuses. Net collisions
reduce speed, remove 150 points and reset Stream.

Choose **Alpine** or **Expert** at base camp. Alpine has five wide-open chicanes.
Expert has eight deeper chicanes and narrower slalom gates with a stronger
left/right weave. Flow Assist gently guides the next gate; Sport leaves turning
to the player. Lesson circles keep their wider clearances, and all chicanes
stay away from ring planes, takeoffs and landings.

The gallery passes a saved lesson in `#golingoLesson=`. The game imports it before
the Start Lesson gesture. `learningLanguage` / `primaryLanguage` GoLingo payloads
and the game's `type` / `items` schema are both supported. No fixed language list
is used. Run `node games/tests/gallery.test.mjs` from the main repository root
to check the Sports filter and shared-lesson launch contract.

## Lesson input

Choose **Edit your lesson**, paste text or import a `.json` / `.txt` file, then
press **Save & Ski**. Begin plain text with `sentences` or `phrases`, followed by
one entry per line. Separate its translation with `|` or a tab:

```text
sentences
language: es-ES
translationLanguage: en-US
Me gusta esquiar. | I like skiing.
La montaña es hermosa. | The mountain is beautiful.
```

Sentence mode gives each word a labeled circle, one sentence per descent. Pass
a circle to repeat its word until you reach another circle or pause the voice.
The finish shows the complete sentence and translation and speaks the sentence
once. Use **Next sentence** to continue, or repeat the same sentence. Missed
words remain available as review buttons. Vocabulary mode keeps entire phrases
together, one per circle; long lists use batches of up to 48 items per run.
Learning runs use a paced speed and a finish distance matched to the lesson.
For dense lessons a gentle minimum pace clears uphill ramp lips; Brake still
stops the skis. Free Ski keeps the original full-speed physics.

Use `phrases` (or `words`) for a vocabulary list:

```text
phrases
language: fr-FR
bonjour | hello
s’il vous plaît | please
```

The `examples/` folder includes JSON and text samples. JSON accepts this shape:

```json
{
  "type": "sentences",
  "language": "es-ES",
  "translationLanguage": "en-US",
  "items": [
    {
      "text": "Me gusta esquiar.",
      "translation": "I like skiing.",
      "words": [
        {"text": "Me", "translation": "I / me"},
        {"text": "gusta", "translation": "like"},
        {"text": "esquiar", "translation": "to ski"}
      ]
    }
  ]
}
```

Set `type` to `phrases` for whole phrases per circle. `words` is optional in
sentence items: without it, Unicode word segmentation splits the sentence.
Individual word meanings are shown when supplied; the app does not infer or
generate translations from the full sentence translation. You can import up to
1,000 entries, with up to 240 words per sentence. Prefer short sentences for
clear pronunciation and comfortable ring spacing.

The editor offers installed voices, speech speed, translation visibility,
example downloads and JSON export. It accepts BCP 47 language tags, including
languages not present in a fixed list. Speech uses the browser’s native speech
API and its available system voices; some voices need a connection or an extra
**Enable Repeat** tap. Use **Pause Repeat** to silence repetition, or pause the game to
suspend speech. SFX and pronunciation have separate controls, and ski sounds
quiet down during pronunciation. Lessons/settings are saved in browser storage.

The neon glow now defaults to **35%**, with lower bloom, reduced snow spill and
a dimmer exposure to retain the reference’s blue-hour mood. Adjust Neon Glow in
the lesson editor or pause menu. The warm summit light is retained.

## Play immediately

Open **index.html** in a current desktop browser, or use the hosted game on a
phone. The single HTML includes Three.js, all shaders, terrain data, generated
textures, audio synthesis and the game. There are **no runtime CDN requests,
remote models, fonts, API keys, or installation requirements**. It works offline
in browsers that allow local HTML JavaScript and WebGL 2. iOS Files/Quick Look may
preview the file without running its scripts; use the hosted link in Safari.

- **A / D**, **left / right arrows**, or **drag**: carve left and right.
- **Space / down arrow / S**: brake. Hold to stop.
- **W / up arrow / Shift**: tuck for a little more speed.
- **J**: hop. The six shaped kickers also launch automatically.
- **P / Escape**: pause or resume. **R**: restart. **Enter**: start.
- Touch: drag anywhere, or use the left/right buttons. Hold Brake; tap Hop.
- Cinematic / Performance quality can be set at base camp or in the pause menu.
- The pause menu also includes a calmer camera option. Sound is synthesized
  after a user gesture, and can be switched off from the top bar.

Pass each gate to build Stream (up to 8×). Misses and barrier hits reset it.
Landing airtime earns bonus points. The finish card shows time, gates, top speed,
longest air, score and best Stream. A personal best and settings persist locally.

## Terrain, accurately described

The **distant massif** uses 101,441 samples from 12 real Mapzen / Tilezen
Terrarium elevation tiles around the Matterhorn. Heights are stored at quarter-
meter precision in `assets/matterhorn-dem.json` and embedded in the HTML at build
time. World units are meters. The renderer restores the sampled summit locally
from roughly 4,351 m to 4,478 m using a 145 m Gaussian correction; the remaining
elevation field keeps its sampled heights. Ridge cast shade is baked from the
heightfield, with additional procedural snow and rock surface detail. The altitude gauge reports
the designed ski line's actual world elevation.

The **foreground ski piste, jumps, neon markers and village are designed** to
keep the Matterhorn in view and to make a consistent playable run. This is a
visual skiing prototype, not a geographic route or a recreation of an official
Zermatt piste. Provenance, tile coordinates, sampled height limits and source
links are in `assets/terrain-provenance.json`.

## Source and rebuilding

Node.js 20+ is sufficient. From this directory:

```sh
npm ci
npm run check
npm run build
```

Flow Update / 02 adds an immediate rolling start (~49 km/h), six lime-chevron
boost lanes, six ballistic kickers with floating air rings, broad rolling
snowfields and banked turns, taller crystal outcrops, a compact race HUD,
restored warm summit lighting. Version 03 tones down the neon spill and bloom. The Flow Assist option
gently guides the skis when no steering input is held; Sport is fully manual.
The first kicker is only 185 m into the run.

The build writes `dist/index.html`, a new single-file offline game. The root
`index.html` is a ready-to-play copy of that build.

- `src/main.js`: application entry point, input, HUD, fixed-step loop, composer.
- `src/course.js`: ski line, heights, banks, section names, gates and kickers.
- `src/physics.js`: gravity, edge grip, drag, braking, boosts, ballistic jumps, rings and Flow Assist.
- `src/terrain.js`: real DEM mesh, designed foreground, procedural snow shading and baked ridge shade.
- `src/world.js`: blue-hour sky, neon barriers, slalom flags, air rings, chevrons, crystals, lift and chalets.
- `src/pov.js`: orange/black skis, padded gloves, sleeves and poles.
- `src/particles.js`: snowfall, turning/landing powder, fading twin ski tracks.
- `src/audio.js`: wind, ski edge noise, impacts and gate chimes (Web Audio).
- `src/lessons.js`: text / JSON parsing, Unicode words, lesson formats and batches.
- `src/lesson-run.js`: lesson-aware ring placement, flight prediction and pacing.
- `src/lesson-speech.js`: cancellable repeating pronunciation and finish playback.
- `src/learning-ui.js`: lesson editor, import/export, voices and sentence review.
- `src/challenges.js`: obstacle layouts, swept collision/jump checks and bonuses.
- `src/obstacles.js`: fixed, snow-conforming cyan/magenta safety-net chicanes.
- `src/shell.html` / `src/styles.css`: responsive HTML overlay and menus.
- `build.mjs`: esbuild bundling, data embedding and single-file packaging.
- `tests/physics.test.mjs`: complete Flow/Sport run, ring, boost, barrier and brake checks.
- `tests/scene-check.mjs`: CPU geometry, POV framing, word sprites and restart cleanup.
- `tests/lessons.test.mjs`: input formats, Unicode, batching and complete lesson runs.
- `tests/lesson-speech.test.mjs`: mocked speech repeat, cancellation, pause and finish checks.
- `tests/learning-ui.test.mjs`: controller checks for card-free repetition and pause across rings.
- `tests/challenges.test.mjs`: obstacles, collisions, jumps, bonuses and full recoverable descents.

Optional elevation rebake (requires Python, NumPy and Pillow, and internet):

```sh
python3 -m pip install numpy pillow
python3 scripts/bake_dem.py
npm run build
```

## Rendering and verification

EffectComposer, UnrealBloomPass and OutputPass provide HDR neon bloom and tone
mapping. The scene includes procedural snow grain and groomed piste detail,
soft shadows, altitude-warmed summit color, exponential distance fog, wispy sky,
light snowfall, carving spray and tracks that fade after 44 seconds. Camera roll,
small head bob, speed-based FOV and restrained chromatic separation are confined
to first person. All props and textures are generated in code.

Physics uses a 120 Hz fixed step. A full numerical descent passed, including
six launches and landings, all six boost pads, ring clearance, braking and
barrier collisions. Flow Assist collected all six air rings in a complete
~92-second simulated run. CPU scene construction, finite geometry and portrait
glove framing checks pass. The expanded Three.js terrain shader variants compile
and link in a native OpenGL ES 3 context, and an offscreen composition check
identified and corrected oversized terrain walls and hidden neon tube surfaces.
Production bundling and source syntax checks also passed. Lesson parsing, Unicode, JSON round-trips, complete simulated runs of 1, 3,
30 and 240 word circles and 48 phrase circles pass. Speech lifecycle checks
use an injected mock, not a real voice. Browser rendering, browser interactions,
real speech playback and phone frame-rate measurements remain unverified.
Performance quality uses 1× pixel density, reduced snow and 1,024-pixel shadows
updated every six frames; Cinematic uses up to 1.65× pixel density and
2,048-pixel soft shadows updated every two frames. The target is 60 fps on modern hardware; actual
performance depends on the device and screen resolution.

No account, backend or telemetry is required by the game itself.

## Credits

- Three.js r170, Copyright © 2010–2024 Three.js authors, MIT license (included).
- Elevation: Mapzen / Tilezen and underlying open elevation contributors,
  including SRTM. See `CREDITS.txt` and `assets/terrain-provenance.json`.
- Course, UI, procedural world, physics and synthesized sound: original code.
