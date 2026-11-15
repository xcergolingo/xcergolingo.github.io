# Cannon Crash 3D — GoLingo Word Blast

[Play Cannon Crash 3D](https://xcergolingo.github.io/games/cannon-crash-3d/) · [Open the GoLingo games gallery](https://xcergolingo.github.io/games/)

A mobile-first physics knockdown game built with Three.js and Cannon-es. Fire unlimited 19-ball volleys into destructible word targets across 10 levels in three themes. Tap targets to hear and aim, import GoLingo JSON word or sentence lessons, toggle labels and translations, and export collected vocabulary.

The production-ready GitHub Pages game is served from `index.html` and `assets/`; the editable Vite project and automated tests are in [`source/`](source/). To rebuild locally:

```sh
cd source
npm ci
npm test
npm run build -- --base=./
```

Copy the built `source/dist/` output to this directory when publishing a new version. A supplied GoLingo lesson is accepted through `#data=<URL-encoded JSON>`, `?data=<URL-encoded JSON>`, or `window.GoLingoGame.loadData(payload)`.
