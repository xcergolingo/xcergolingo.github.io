# Skyfield RC · GoLingo Flight Club

An original Three.js browser game inspired by the model-flying experience of [PicaSim](https://www.rowlhouse.co.uk/PicaSim/). Fly small radio-controlled aircraft over a countryside flying field, practice takeoffs and landings, complete a ring course, or collect vocabulary with GoLingo.

## Play

Open the deployed game in a browser with WebGL enabled. On a phone, hold the device in landscape while flying. The hangar and settings also work in portrait.

The default is **Scout / Word flight / Easy mode / Start in the air / Ground controller camera / Calm wind**. Word flight is selected each time the game opens, including for returning players; Free flight and Ring run remain selectable from the hangar. Swipe the aircraft row or use its arrows to choose among nine aircraft. Use the visible **Camera** selector in the hangar header to choose your flight view before starting. Choose **Runway** or **In air** directly above **Start flight**, then start. All nine aircraft support both choices. The Start button is fixed inside the visible screen in both orientations. Audio starts after this gesture; installed browser and device voices determine speech availability.

The full game is in `dist/`. Three.js r160.1 is bundled locally, so gameplay does not depend on a third-party CDN. Aircraft, scenery, textures, sky, lake, clouds and sound are generated in code. No external models or image files are loaded. User-provided audio URLs are the exception.

For local development, serve the `dist` directory with a static HTTP server. For example:

```sh
python3 -m http.server 8080 --directory dist
```

Then visit `http://localhost:8080`. ES modules require an HTTP server; opening `index.html` directly as a `file://` URL is not supported by all browsers.

## Aircraft and modes

| Aircraft | Intended feel |
| --- | --- |
| Scout | Stable high-wing trainer; a good first aircraft. |
| Swift | Faster low-wing sport aircraft; responsive banking and manual aerobatics. |
| Drift | Long-span sailplane with a small recovery motor. |
| Silver Jet | The supplied silver twin-tail jet, with its detailed cockpit and pilot; smooth turbine response and fixed tricycle gear. |
| F-16 Viper | Red, white and blue Viper Demo model; fast cruise and crisp rolls. |
| Yak-130 | Gray twin-seat trainer with red-star markings; gentler jet handling. |
| Rare Bear 77 | Purple racing jet with sunset stripes; lively rolls and the quickest turbine response. |
| F-15 Eagle | Gray twin-tail, twin-engine model; strong climb power and a heavier control response. |
| Falcon | Black and fluorescent yellow sport jet; quick, precise handling. |

The five Atelier aircraft use the supplied revision 2 procedural models, preserving their three separate wheels, folding struts, flush gear doors, cockpit details and liveries. Their original +Z orientation is adapted to the game's −Z nose direction and RC scale. The aircraft study projects remain unchanged.

- **Free flight:** explore, take off, land and practice.
- **Ring run:** fly the 12-gate circuit; best times are kept locally by aircraft, assistance and wind setting.
- **Word flight:** a word appears at each active ring. Hear it, fly through to collect it, then move to the next word. The route repeats for longer lists. Words shuffle on a new flight.

The default **Ground controller** camera stays beside the runway at eye level, pans to watch the model, and keeps the horizon upright. Its Auto zoom / Wide view choice lives inside the camera chooser.

A separate **small onboard camera** appears above the right steering control, while the large view stays with the ground controller. Both show the same live flight. Tap the small window's **‹ / ›** arrows to change its camera during flight, or use its **Small camera** selector for Cockpit, Nose, Left wing, Right wing or Tail. Its selection is independent of the main camera. Tap **×** to hide it; use **Camera → Small camera** to show it again. **Flight settings → Small onboard camera** offers the same choices plus Off. The window stays visible with Info off; when it is shown, it takes the minimap's space. Its camera and visibility are saved across flights and reloads.

Use **Camera** in the hangar header or during flight to choose **Ground controller**, **Chase**, **Cockpit**, **Nose**, **Left wing**, **Right wing**, or **Tail**. The flight button always says Camera, with the current view beneath it. Cockpit is the pilot's view; Nose, Left wing, Right wing and Tail are cameras mounted on the aircraft. Press **C** to cycle through them. Chase follows behind the aircraft with an upright horizon. The five onboard cameras follow its position, pitch, yaw and bank. Each detailed jet supplies its own cockpit eye position and original instrument panel; obstructing head/helmet parts and canopy glazing hide only in cockpit view. Simpler aircraft use a canopy-level forward view. Jet chase and onboard cameras widen gently as speed increases. Camera changes keep the flight and word audio running; they do not release held controls. The selected view and ground zoom are saved locally and retained through restarts. The same choice remains available in **Flight settings → Main camera view**.

Tap **← Back** on the flight screen to return directly to aircraft selection. This works with Info off without opening Pause. Returning clears held controls, stops flight audio, exits browser fullscreen and restores any cockpit-hidden model parts; the selected aircraft, camera and launch choice remain selected.

Flights start with **Info off**: the transmitter controls, edge action buttons and optional small onboard camera remain over the scenery. The HUD word card, instruments, map and messages are hidden. Words stay inside the physical course rings, and word audio remains active. Tap **Info** (or press **H**) to show or hide the compact word strip and instruments at the edges. This choice is remembered on the device.

**Full screen** is a separate button (keyboard **F**) that requests actual browser fullscreen for the entire game, including the controls. The canvas and HUD fill the available landscape viewport and resize with it. If an embedding app blocks fullscreen, a nonmodal message offers **Open game** in its own window. Unsupported top-level browsers show iPhone Home Screen guidance instead of opening a duplicate page. The web app manifest requests fullscreen and landscape for installed launches, with Apple standalone metadata; browsers may use their supported display-mode fallback. An installed standalone session is recognized as already filling its app window. The page cannot remove controls owned by an embedding app or force a browser to grant fullscreen.

Tap **Easy / Acro** beside the throttle (keyboard **M**) to change flying style immediately, without pausing, resetting the aircraft, releasing held controls or interrupting word audio. **Easy** automatically levels the wings and limits bank and pitch. **Acro** permits full 360° rolls and loops in either direction, inverted flight, and combined maneuvers. With enough speed and height, hold left/right for a roll or pull down for an inside loop; ease off to stop rotating. Pitch and rudder act around the aircraft's own axes, so a pull while banked turns toward its roof. Switching back to Easy recovers smoothly. Flying style is saved. The flight model includes lift, drag, thrust, gravity, wind, stalls and ground contact, but remains a simplified game model. Wind choices are calm, 2 m/s and 5 m/s. This version does not simulate PicaSim's detailed thermals or slope-lift airflow.

## Controls

| Control | Action |
| --- | --- |
| Left throttle lever | Set motor power; it stays where released. |
| Right touch stick | Pull down to raise the nose; push up to lower it. Left/right banks. |
| S / Down; W / Up | Raise the nose; lower the nose. Follows the pitch setting. |
| A / D or Left / Right | Bank; steer when on the ground. |
| Q / E | Rudder. |
| + / − | Increase / decrease throttle. |
| Hold Brake / Space | Wheel brakes while on the ground. The touch button sits beside the throttle. |
| Gear / G | Extend or retract the five Atelier jets' landing gear while airborne. The button replaces Brake in the same location. |
| Camera button | Choose the main view or turn the separate small onboard camera on/off. Ground view also offers Auto zoom / Wide view. |
| Small camera ‹ / ›, dropdown, or [ / ] | Change the small camera's mount during flight. × hides it. |
| Easy / Acro or M | Toggle assisted flying and full body-axis aerobatics without pausing. |
| Full screen or F | Request or exit browser fullscreen. |
| ← Back | Return directly to aircraft selection and Start. |
| C | Cycle to the next camera. |
| H or Info | Show or hide compact flight information; words in rings remain visible. |
| R or Reset | Restart the selected flight. |
| Escape or Pause | Pause / resume. Escape first closes an open camera chooser. |

Touch sticks use separate pointer capture so the throttle and steering can be operated together. Pointer release, cancellation and window blur clear controls; they do not open the pause screen. The game pauses when the document becomes hidden. Portrait orientation temporarily stops flight and displays the rotate prompt.

In **Flight settings → Pitch control**, choose **Pull down to climb** (the default) or **Push up to climb**. The choice applies to the right touch stick and the Up/W / Down/S keys, is saved locally, and is reflected in the stick labels and Controls help. Throttle and left/right banking keep their directions. During Full view, use **Pause → Restart flight** to restart without bringing back the instruments.

The opening screen fits the current viewport; Start and settings remain in a separate bottom dock, so neither is pushed below the screen by the setup choices.

To take off from the runway, select **Runway** above Start. The aircraft starts stationary with zero throttle. Increase throttle, keep it straight, and gently pull down to raise the nose once it has built speed. A small prompt beside the throttle tells you when to rotate. If you reversed pitch in settings, push up instead. Drift uses its motor assist for runway launches. Reset, Retry and Fly again honor your selected launch mode.

To land, align with the white centerline, reduce power, and descend gently. Hold **Brake** or **Space** after touchdown to stop; release it and add power for another takeoff. Safe touchdowns remain playable; hard impacts, buildings, trees and water trigger a recoverable crash. The Find runway button gives distance and turning guidance.

### Flying the jets

The throttle is a command to the turbine. The **ENGINE** percentage beside it shows the actual engine response, which builds and winds down gradually. The six jets take approximately 2.5–4 seconds to reach 90% power from idle. Thrust follows this response through a nonlinear curve, so cutting the throttle leaves a brief period of residual thrust. The propeller aircraft retain their immediate motor response.

Jets carry more momentum, lose energy during tight turns and climbs, and need more room to slow down. Each airframe has its own mass, wing loading, thrust, roll/pitch response and spool times. These profiles are tuned for the existing RC airfield and twelve-gate course. Typical jet cruise speeds are 97–119 km/h; the configured approach targets are approximately 58–65 km/h, depending on the airframe.

The five new jets start **gear up** for an air launch and **gear down** on the runway. Tap **Gear** or press **G** once to change it. The wheels and doors animate through the source model's full mechanism over 2.0–2.8 seconds. Extended gear adds drag; allow it to finish extending before touchdown. An incomplete or gear-up touchdown triggers a recoverable crash. Gear retraction is disabled while grounded. Silver Jet retains its fixed gear.

For a jet runway departure, you can hold Brake while the turbine builds power, then release it and accelerate. Apply a gentle pull at flying speed. On approach, reduce power early, lower the gear, and leave room for the landing roll. The small cue near the throttle reminds you to lower the gear during a low descent.

Synthesized turbine rush, whine and exhaust intensity follow actual engine power. The ground camera also uses distance attenuation and an approach/recede pitch shift for flybys. Wind sound and a small increase in the onboard field of view convey speed. Continuous sounds mute with Pause, sound-off, portrait pause and the hangar; they play more quietly in Word flight to keep speech clear.

## Language practice

Built-in packs: Spanish, Japanese, Chinese, French and English. Translations default to English. An imported list can use another primary or learning language and a regional locale such as `pt-PT` or `zh-TW`.

Flight settings allow translation visibility, repeated speech, and one example sentence at each gate. Source audio is used when supplied; otherwise the browser's text-to-speech engine reads the learning language. Collected words can be exported as GoLingo JSON.

In **Word flight**, the current word and next two words appear at the centers of their rings as cream text with dark outlines and a transparent background. Optional translations sit below the words. These world labels stay visible with Info off in both camera views; collecting a ring advances the labels with the learning list, and the end of a short list does not show repeated future words. Text wraps to fit inside the ring; exceptionally long imported sentences are shortened visually with an ellipsis while their full audio remains available. **Info** displays the current word, translation and progress in a compact edge strip. Collection feedback stays at the edge. **Ring run** uses numbered gates and **Free flight** hides the course.

Paste pairs, one per line:

```text
el avión | the airplane
el cielo | the sky
aterrizar | to land
```

Or paste a GoLingo payload:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "es",
  "words": [
    {
      "id": "101",
      "word": "avión",
      "translation": "airplane",
      "sentence": "El avión está volando.",
      "sentenceTranslation": "The airplane is flying."
    }
  ]
}
```

Optional fields include `audio` / `audioUrl` for the word and `sentenceAudio` / `sentenceAudioUrl` for the example. A top-level `sentences` array is also accepted. Lists are bounded to 100 KB and 400 entries, and strings are inserted as text rather than HTML.

## GoLingo integration

After navigation has finished, a host web view can invoke:

```js
window.loadGoLingoData(payload);
```

Or a parent page can send one of these messages to the game window:

```js
gameWindow.postMessage({ type: 'golingo-data', payload }, gameOrigin);
gameWindow.postMessage({ type: 'GOLINGO_DATA', data: payload }, gameOrigin);
```

The `data` URL query parameter or hash accepts JSON, URL-encoded JSON or UTF-8 Base64. For example, construct a URL with `url.searchParams.set('data', JSON.stringify(payload))`. The GoLingo game gallery also supplies its active lesson through `#golingoLesson=` with URL-encoded JSON; this is accepted and automatically selects Word flight. Prefer the native function/message route for longer lists. URL-supplied data opens Word flight, and newly supplied native lists reset word-course progress. Settings, word lists and best times use local browser storage when available; the game has no account or server database.

## Source map

- `dist/index.html`, `dist/style.css`: responsive hangar, instruments, controls and settings.
- `dist/app.js`: rendering, input, course, score, sound and integration.
- `dist/cameras.js`: the ground, chase and aircraft-mounted camera rig, plus a small procedural reflection environment.
- `dist/gate-labels.js`: transparent, wrapped, camera-facing vocabulary at ring centers.
- `dist/manifest.webmanifest`: fullscreen landscape preferences for Home Screen launches.
- `dist/flight.js`: independent numerical flight model.
- `dist/world.js`: procedural scenery, aircraft and collision geometry.
- `dist/silver-jet-source.js`: exact procedural aircraft source copied from the user's Silver Jet Study project.
- `dist/silver-jet.js`: RC-scale jet adapter, static mesh batching, tricycle gear, camera mounts and animation hooks.
- `dist/atelier-models/`: the four unmodified revision 2 source modules for the five Atelier aircraft.
- `dist/atelier-jets.js`: orientation/scale adapter, safe static batching, cockpit cameras, gear animation and turbine hooks for those five jets.
- `dist/learning.js`: packs, importing, speech sequencing and GoLingo export.
- `dist/vendor/three.module.js`: Three.js r160.1; license in `LICENSE-three.txt`.
- `flight-check.mjs`: numerical and course integration checks.
- `aerobatic-check.mjs`: full rotations, body-axis controls, inverted flight and Easy recovery for all nine aircraft.
- `gallery-lesson-check.mjs`: checks lessons delivered from the GoLingo gallery's hash and both legacy `data` URL formats.

## Verification

Run:

```sh
node --check dist/app.js
node --check dist/cameras.js
node --check dist/gate-labels.js
node --check dist/world.js
node --check dist/silver-jet.js
node --check dist/silver-jet-source.js
node --check dist/atelier-jets.js
node --check dist/learning.js
node flight-check.mjs
node aerobatic-check.mjs
node gallery-lesson-check.mjs
```

Checks cover steady flight, takeoff, turning, wind, stalls, gentle landings, braking, crashes, obstacle contact, frame-rate consistency, manual rolls, and two laps of the actual course with all nine aircraft in calm and windy conditions. Each aircraft remains stationary at idle and reaches 10 m altitude before the end of the runway. Jet checks cover delayed spool and actual thrust, residual thrust after a cut, stationary full-power brake holding, smooth gear travel and ground protection, gear drag, gear-up/partial-gear and overspeed landings, turn/climb energy, and finite braking distances. Geometry checks verify finite vertices, face winding, runway clearance and lake collision. Language checks exercise import, export, native messages, locale handling, repeated speech sequencing and cancellation.

The aerobatic checks exercise full rolls and loops in both directions, knife-edge body-axis pitch, inverted attitude retention, continuity through vertical poses, smooth Easy recovery, and 30/60 FPS agreement. All nine aircraft completed an initial roll and inside loop from the 26 m air start at full throttle. Focused actual-app checks verify the in-flight flying-style toggle, both small-camera arrows, saved preferences, held controls and active speech continuity, fullscreen success/rejection/vendor fallback/installed modes, and ring-label progression through an imported three-word list. Browser UI checks cover the controls at 568×320, 844×300, 1108×378 and 1440×900; the camera menu and fullscreen fallback remain between the transmitter controls. Actual Canvas word textures were visually checked for Latin, Chinese, Japanese and Arabic text in a temporary ring-sized fixture. Native fullscreen and GPU-rendered flight could not be verified in this cloud browser; its rejected fullscreen request correctly displayed the optional Open game fallback.

The creation environment's preview browser could not create a WebGL context. A temporary fixture ran the actual application UI with a no-op 3D renderer. Full view and compact information were checked at landscape sizes from 568×320 and 844×300 to 1440×900: the word strip stayed at the upper edge, hidden panels stayed hidden, and the flight buttons remained at least 44px tall and inside the viewport. The nine-aircraft rail, launch selector and Start fit without overlapping at six landscape and three portrait sizes, including 320×568, 375×568 and 390×664, with no page scrolling. Every aircraft can be reached with the arrows and its selected card stays fully visible. At 568×320, the camera chooser, engine readout, Brake/Gear, takeoff prompt and stick fit in the viewport in both Full view and Show info. Browser interactions verify a ground-start F-16 with zero power, an airborne start with gear up, the gear button and G shortcut, and the changing gear label without a pause. Earlier interactions verified all seven camera buttons, C cycling, camera/launch/pitch persistence after reload, updated stick labels and Restart flight from Full view. Temporary fixture files are excluded from deployment.

Focused control checks run the actual app handlers and frame loop with the numerical flight model. All nine aircraft support runway start/reset, and the selected model persists through the complete Next/Previous cycle. Engine response remains gradual through the actual app frame. The displayed model receives the physical gear position. Gear and camera actions preserve held controls, active learning speech and its repetition timer. Earlier checks passed all 24 touch/keyboard direction combinations across both pitch settings and flying styles; Enter/Space brake release works after focus changes while preserving an independent touch brake. Numerical camera checks cover all nine aircraft: a fixed ground eye, correctly transformed onboard positions and up vectors, finite chase motion with terrain clearance, and restored cockpit-hidden parts. A focused mock AudioContext check confirms finite parameters, actual-spool-driven sound, ground-only flyby effects and silent continuous channels in mute/pause/menu states. Real 3D rendering, synthesized sound quality, touch-flight performance and iPhone speech playback still require device verification; these checks do not claim to cover those behaviors.

## Reference and licensing

The inspiration was PicaSim's RC flying, viewpoints and checkpoint activities, described on its [official information page](https://www.rowlhouse.co.uk/PicaSim/information.html). No PicaSim assets were copied.

Silver Jet comes from the user's [Silver Jet — Aircraft Study](https://xin-silver-jet-study.ppscreator822922.chatgpt.site), source project `appgprj_6aeeda605d4c8191b7754ba5da8feb0e`, commit `c53fed62e96222937e75973f5e1330b49b0c7ddf`. Its original source is copied without changes; its adapter supplies RC scale, fixed gear, cameras and batching.

The F-16, Yak-130, Rare Bear 77, F-15 and Falcon come from the user's [Flightline Atelier](https://xin-rc-jet-atelier.ppscreator822922.chatgpt.site), source project `appgprj_6aef878a097c8191857e1515a78632ee`, commit `e606e7787e9ce84416775b299b089e4e9d24d145`. `core.js`, `f16.js`, `military.js` and `sport.js` are copied verbatim. Their adapter preserves the revision 2 landing gear and source geometry/textures while supplying game coordinates, scale, cameras and batching. The study projects are unchanged.

The remaining game geometry, visual identity and UI are original. Three.js is included under its MIT license.
