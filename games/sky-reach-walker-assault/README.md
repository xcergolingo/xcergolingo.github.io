# Sky Reach — Walker Assault

Standalone GitHub Pages copy of the rebuilt game.

- Play: https://xcergolingo.github.io/games/sky-reach-walker-assault/
- Original hosted build: https://sky-reach-walker-assault-xin.ppscreator822922.chatgpt.site
- Original source snapshot: `8f78a2bffcf7e7113b65fb8bedf71ec90d9f3a1d`

The ten runtime files in this directory are an unchanged copy of that snapshot. All assets, Three.js, procedural models, shaders and synthesized audio are included locally. There is no build step or account/backend dependency.

Serve this directory with a static HTTP server to play locally; for example `python3 -m http.server 8080` from this directory. Direct file URLs are not recommended because browsers restrict ES module imports.

## Controls

WASD / arrows fly; click fires; Shift boosts; F attaches a tow cable; H climbs to the fleet; M opens the map; T changes target; J pulses to the selected target; L lands or takes off; E exits/enters, or hold E to mine; Space climbs or uses the jetpack. Touch controls are built in, including LAND, FIRE, BOOST, TOW and a steering stick.

Crystals and warp cores are saved per browser and site origin.

## Verification at creation

Gameplay simulations passed three walker takedowns, eight hostile fighter kills, dreadnought defeat, keyboard/touch travel, landing, mining, core recovery and saved progress restoration. The available cloud browser had WebGL disabled, so GPU graphics and real-device performance were not verified there.

Three.js is distributed under the MIT license in `vendor/LICENSE-THREE.txt`.
