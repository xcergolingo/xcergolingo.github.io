# The Flooded Garden

A procedural Three.js diorama of turquoise water, old stone, cherry blossoms,
and a saffron-canopied rowboat. Row around the lake to collect vocabulary.

Open `dist/index.html` in a modern browser. The file contains its entire runtime,
textures, geometry, and synthesized audio. It works without a CDN, external
assets, or a web server. Ambient audio begins when Sound is enabled. Word
pronunciation uses the browser's speech voices after the Row & learn gesture.

## Row & learn

Choose **Row & learn** to start with Spanish example words, or **Your words**
to paste your own vocabulary. Drag the on-screen joystick up to row, left/right
to steer, and down to reverse. W/A/S/D and arrow keys also control the boat.
The boat camera follows; drag to look around and use Follow boat to recenter.
Stop boat brakes and clears held input. Scenery returns to the original garden.

Golden word markers are spread over reachable water. Bring the boat within
2.45 meters to collect a word, show its translation, and pronounce it repeatedly
with a pause between repetitions. Pause voice stops the loop. Listen replays a
word directly, which also helps browsers that restrict automatic speech.

Paste one `word | translation` pair per line, tab-separated pairs, or JSON:

```json
{"learningLanguage":"ja","primaryLanguage":"en","words":[{"id":"101","word":"水","translation":"water","sentence":"水を飲みます。"}]}
```

Language codes are unrestricted valid BCP-47 tags. Up to 500 entries are
accepted; no more than 12 markers appear at once. Collected markers disappear
and further words replenish them. Word lists stay on the device. The basket
supports replay, a GoLingo JSON export, and Clear & explore again with fresh
positions. Translation display is optional. Opening settings or the basket
stops movement; typing in word fields never steers the boat.

- Atmospheres: Morning, Day, Rain, Golden, Night.
- Cameras: Boat, Waterline, Garden, Bridge, Mountains, Aerial.
- Drag to orbit, scroll or pinch to zoom, and use two fingers or right-drag to pan.
- Outside rowing mode, W A S D or arrows move the free camera; Q/E lower/raise it.
- H hides or shows the controls. M toggles sound.
- Auto Tour visits each camera. Manual navigation stops the tour.

The water uses a second scene render from a mirrored camera, with animated
procedural normal maps and Fresnel reflection. Shadows, HDR bloom, fog, light
shafts, drifting mist, petals, fireflies, birds, and rain are generated in code.
Mobile devices use fewer foliage instances and a smaller reflection map.

## Source

`src/garden.js` contains the complete scene. `src/shell.html` contains its UI.
`python3 build.py` fetches the pinned Three.js 0.170.0 modules once, then embeds
them with the application into `dist/index.html`. Python's standard library is
the only build dependency. Keep the generated HTML when distributing the scene.

Construction and interaction checks passed for desktop and mobile. These check
finite geometry and transforms, reflection setup, environment and camera state
transitions, tour controls, keyboard movement, UI visibility, keyboard/touch boat
steering, collision boundaries, collection, basket reset, and multilingual JSON
parsing. Speech scheduling is checked with a stub, not a real device voice. An in-browser
visual/performance check was unavailable in the creation environment.

Three.js and its addons are Copyright 2010-2024 Three.js Authors, MIT License.
