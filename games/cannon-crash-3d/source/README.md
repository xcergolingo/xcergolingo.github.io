# Cannon Crash 3D

A mobile-first GoLingo language-learning 3D knockdown game built with **Three.js**, **Cannon-es**, and Vite. All scenery and models are generated in code; there are no required external 3D models.

## Play

1. Open the game in a browser that supports WebGL (portrait orientation recommended).
2. Tap a target to hear its word and line up the cannon automatically, or drag left/right and up/down to aim manually (including at the elevated shelves).
3. Tap **FIRE** for one chain of **19 small white balls**, or **hold FIRE** to continuously launch new volleys.
4. **Ammo is unlimited.** There is no game-over for running out of shots: keep firing until every target falls off its shelf. Time shots around moving arrow bumpers, earn coins, collect vocabulary, and advance.

The bottom-left HUD displays **∞ UNLIMITED AMMO**. The number of volleys you use only affects your optional star rating; it never blocks a level clear. Mobile autofire automatically cleans up older physics balls so long sessions stay responsive.

Desktop controls: arrow keys or WASD to aim, **Space** to fire, **Esc** to pause.

## Worlds and progression

| Levels | Theme | Structures |
| --- | --- | --- |
| 1–5 | Dusty Frontier | Western wooden decks and elevated shelves, barrels, metal cans, crates, moving chevrons, mesas and cacti |
| 6–8 | Neon Afterdark | Multiple cyberpunk shelves, moving neon obstacles, glowing cubes and skyline |
| 9–10 | Frozen Kingdom | Ice-block towers, stacked ice decks, animated blockers, castle towers and snowfall |

The `LEVELS` array in [`src/levels.js`](src/levels.js) defines all 10 layouts, shot budgets, shelf locations, and moving bumper paths. Target mesh, independent shelf physics, and kinematic obstacles live in [`src/world.js`](src/world.js). Game input, state, projectiles, scoring, progress, and overlays are in [`src/main.js`](src/main.js). Particle effects are pooled in [`src/effects.js`](src/effects.js), with comic-book impact splashes in [`src/impact.css`](src/impact.css).

## GoLingo language learning

- Each target carries a word label. The current target's word is highlighted, pronounced and repeated until the next focus word. Tap any target to pronounce and save it.
- Toggle target labels, translations, the compact learning strip, and pronunciation in **Language Settings**. These display choices persist across levels.
- Target impacts pronounce the words, while knocks collect them in a **Word Basket**. On level clear the last collected example sentence is spoken once if available.
- Export the collected list as GoLingo JSON, or send it to the native iOS bridge handler (`window.webkit.messageHandlers.golingo`) if it exists.
- 29 language/voice selections. The game ships with a Japanese/English demo set; other language content comes from GoLingo or user-imported JSON, not automatic translation.

### Passing JSON from the GoLingo hub or SwiftUI

The standard structure works directly:

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [{
    "id": "101", "word": "水", "translation": "water",
    "sentence": "水を飲みます。", "sentenceTranslation": "I drink water."
  }]
}
```

Choose one integration route:

1. Open the game URL with `?data=` or `#data=` followed by `encodeURIComponent(JSON.stringify(payload))`. The GitHub games gallery uses the `#data=` form to pass the chosen lesson. Separate `?words=<JSON array>&primaryLanguage=en&learningLanguage=ja` parameters also work.
2. In an embedded webpage, call `window.GoLingoGame.loadData(payload)` or `window.receiveGoLingoData(payload)`.
3. From a parent game hub, `iframe.contentWindow.postMessage({type:'golingo:data',payload},gameOrigin)`.

`window.GoLingoGame.getBasket()` returns collected words, and `window.GoLingoGame.getData()` returns the currently loaded content. The hub may also send `{type:'golingo:requestBasket'}` and receive `{type:'golingo:basket',payload:...}`. Sentence-only JSON with a `sentences` array is also supported.

Optional `audioUrl` on a word is played before trying Web Speech TTS. Spoken repetition starts only after a user interaction to respect mobile autoplay rules.

High scores are not sent to a server. Unlocked stages and coins persist in the player's local browser storage.

## Development

```sh
npm install
npm run dev
```

Run the headless physics smoke tests and production build:

```sh
npm test
npm run build
```

## Gameplay tuning

- Projectile salvo: `fire()` and `spawnBall()` in `src/main.js`.
- Unlimited-ammo rule and hold-to-fire: `shotsUsed`, the FIRE pointer handlers, and the hold-fire branch of `animate()` in `src/main.js`. The old per-level `shots` values are **par targets for star ratings only**.
- Ballistic aiming: `calculateShot()`; the trajectory dots use this same calculation.
- Falling target detection: `updateBodies()` checks each target against its own shelf, including the case where it falls onto a lower deck.
- Gravity and friction: Cannon world setup in `src/main.js`, materials in `src/world.js`.
- Level content: `src/levels.js`. Tower targets share `x`/`z` coordinates and specify a `tier`; `shelf:1` and `shelf:2` place them on elevated platforms, and `hazards` defines moving chevron bumpers.
- Language parsing, data validation and JSON export: `src/learning.js`; spoken repetition: `src/audio-guide.js`; label textures: `src/labels.js`.

The game uses original procedural artwork and audio synthesis. It is designed to remain fully usable without a sound permission dialog.
