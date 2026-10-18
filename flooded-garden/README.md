# The Flooded Garden

[Play The Flooded Garden](https://xcergolingo.github.io/flooded-garden/)

A self-contained Three.js garden with controllable rowing and language learning.

Choose **Row & learn**, then use the touch joystick or W/A/S/D / arrow keys to steer to floating words. Collected words show translations and are pronounced repeatedly until the next word or Pause voice. Use Your words to paste vocabulary or GoLingo JSON; the basket supports review and JSON export.

The single `index.html` includes Three.js, all geometry, textures, and ambient sound generation. It runs without a CDN or external assets. Pronunciation uses available browser voices.

Editable sources and the Python build script are in [source/](source/). Run `python3 build.py` there to regenerate `dist/index.html`.

Atmospheres: Morning, Day, Rain, Golden, Night. Camera presets, Auto Tour, and free navigation remain available in Scenery mode.
