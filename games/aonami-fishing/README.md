# Aonami — Coastal Fishing

**Play:** https://xcergolingo.github.io/games/aonami-fishing/

A first-person Three.js fishing and GoLingo vocabulary game set on a sunny Japanese coast. Fish from a weathered wooden pier toward a red lighthouse on a stone breakwater. The sea has layered waves, specular sunlight, shoreline foam, and rocky underwater habitat; distant islands, seabirds, and a clear daytime sky complete the harbor.

## Fish and learn

1. Hold and release **CAST** to fish with a lure or a float.
2. Tap the speaker above the float or lure to hear the current word.
3. On **ヒット！**, tap **HOOK**. Tap or hold **REEL** while fighting to speak the word again, and release when line tension turns red.
4. Catch a fish to reveal the Japanese word and English translation. It is added to the local review basket.

The built-in Japanese deck contains 30 words and actual prerecorded speech embedded into the HTML. **Test voice** on the opening screen checks pronunciation before fishing. When launched from the GoLingo game gallery, Aonami automatically reads the active lesson carried in its `#data=` URL fragment, including its learning language and every word–translation pair, before the first cast. It also accepts `#golingoLesson=`, `#golingo=`, and legacy `?data=` handoffs. An imported word's `audioUrl` or `audioURL` is played directly where supplied; otherwise the game uses device text-to-speech. Ambient ocean audio is independent from word audio.

## Files

- [`index.html`](./index.html) — standalone playable game, identical to the download edition.
- [`aonami-fishing.html`](./aonami-fishing.html) — downloadable standalone game, including Three.js and all Japanese audio.
- [`aonami-source.zip`](./aonami-source.zip) — modular source (JS, CSS, tests, and the original voice clips).
- [`cover.svg`](./cover.svg) — original illustrated game card for the GoLingo gallery.

No remote audio files, external assets, or JavaScript CDN are needed for the default game. Bring your own GoLingo vocabulary through the shared gallery lesson or the game's import panel.
