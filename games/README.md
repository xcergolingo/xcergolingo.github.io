# GoLingo Games

A responsive gallery for GoLingo language games, with category filters and shared lesson data.

## Find games, save favorites, and track your plays

- Search titles, descriptions, and tags. Search ignores case and accents; multiple search terms must all match a card.
- Use **My favorites** together with search and a category. A heart on each game adds or removes that game without changing its Like.
- Sort by **Most played (this device)**, **Recently played (this device)**, **Most liked (on this device)**, name, or original card order.
- A **play** is an explicit launch from a game cover, a card's game link, or a preview dialog's game link. It is not a verified successful load, completed session, or unique visitor. Preview videos, App Store links, likes, favorites, and gallery reloads do not count. Rapid duplicate taps on one game are counted once.
- Counts begin when this feature is first used. There are no recovered historical counts or seeded popularity numbers.
- Favorites, likes, and play history are personal to this browser/app's website storage. They are not totals across all visitors and do not synchronize between devices. Clearing website data removes them. No user vocabulary is sent to an analytics service.
- Search, category, favorites-only mode, and sort are kept for this tab so returning from a game preserves the selection. If persistent storage is unavailable, the gallery stays usable and explicitly explains that changes are temporary.

The static GitHub Pages site does not have a shared counter backend. A public all-user popularity ranking would require an authenticated, rate-limited service; do not expose a GitHub write token or API secret in browser code to implement one.

Personal storage keys are `golingo:liked-games:v1` (preserved), `golingo:favorite-games:v1`, and `golingo:game-plays:v1`. The tab-only view key is `golingo:gallery-view:v1`. Stable card IDs keep data attached to games when their positions, labels, or versioned links change.

Run the DOM regression checks from the repository root:

```sh
npm install --prefix /tmp/golingo-gallery-dom-tests linkedom@0.18.12 --ignore-scripts
GALLERY_TEST_DEPENDENCIES=/tmp/golingo-gallery-dom-tests node --test games/tests/gallery.test.mjs
```

These checks execute the gallery script against its actual HTML, without a browser or network. For rendering and real navigation checks, install Playwright and a compatible Chromium browser, then run `node games/tests/gallery.browser.test.mjs`. The browser suite uses an isolated local server and intercepts game navigation; neither suite changes production counters.

**Website:** https://xcergolingo.github.io/games/

**Aonami — Coastal Fishing:** https://xcergolingo.github.io/games/aonami-fishing/ is a first-person pier-fishing language game with a red lighthouse, turquoise ocean, lure and float methods, catch and reel controls, real recorded pronunciation for 30 Japanese coastal words, word translation revealed after catching fish, and a GoLingo-compatible basket. Its new gallery card is tagged Fishing, Scenery, Water, 3D Game, Explore, Language Learning, and Words. Both Play links pass the gallery's `word-pack` lesson as `?data=` to its standalone HTML. Source is included as a downloadable ZIP in `aonami-fishing/`.

**Download GoLingo:** https://apps.apple.com/app/id1194977025

The verified App Store listing is **Learn Lingo With GoLingo & AI**, by **xin wang**. The unrelated golingo Ltd app is not this app.

## Games

| Game | Browser demo | Preview |
| --- | --- | --- |
| Yokohama City Flight | https://xcergolingo.github.io/yokohama-city-flight/ | Original vector illustration + playable game |
| 御剑飞仙 — Sword Riding Immortal | https://xcergolingo.github.io/games/sword-riding-immortal/ | Illustrated card + playable game |
| Lagoon | https://xcergolingo.github.io/far-cry-lagoon/ | media/lagoon.mp4 |
| Word Folio | https://xcergolingo.github.io/word-folio/ | media/word-folio.mp4 |
| Super Flying Man | https://xcergolingo.github.io/super-flying-man/ | media/super-flying-man.mp4 |
| Dolphin Pursuit | https://xcergolingo.github.io/dolphin-pursuit/ | Playable demo |
| The Flooded Garden | https://xcergolingo.github.io/flooded-garden/ | Illustrated card + playable demo |
| Matterhorn — Ski & Speak | https://xcergolingo.github.io/games/matterhorn/ | Illustrated card + playable game |

The approximately 12-second previews are silent recordings of the actual public games using demonstration vocabulary. They are not concept animations. Recording uses software rendering; performance varies by device. Recording-only presentation adjustments hide Word Folio's missing-voice notification and Lagoon's persistent start overlay after its start action succeeds. No deployed game source is modified. Lagoon uses the game's Low graphics preset.

## Sports and shared lessons

The Sports filter includes Matterhorn — Ski & Speak. Cards may have multiple tags; the count reflects the current filter. The ski game supports the gallery's `#golingoLesson=` launch payload for word, phrase and sentence lessons, including the `learningLanguage` / `primaryLanguage` GoLingo schema. Saving a lesson does not upload it; it remains in tab storage and is passed through a URL hash on explicit launch. Clearing a lesson removes stale launch data from links.

The complete ski source lives in `matterhorn/`. Its built `index.html` is self-contained, with no CDN dependency. See its README for building and checks.

## Visitor journey

Watch a preview, download GoLingo, choose or create a vocabulary list, and launch a game from the app. Browser demos remain available as a secondary action. The download buttons and QR code point directly to the verified App Store ID. No unverified app URL scheme is used.

## Files

- `index.html`: page content, game cards, guide, FAQ, and accessible video dialog.
- `style.css`: responsive desktop, tablet, and phone layouts.
- `app.js`: video controls, reduced-motion/data-saver behavior, and validated download metadata.
- `media/`: locally hosted MP4 previews, posters, official app icon, App Store metadata, and QR code.

No build process, external font, analytics, or third-party video player is required. Serve this folder with a static server. GitHub Pages publishes it under `/games/`.

## Maintenance and verification

Edit the HTML for wording and the JavaScript game map when adding a game. Download links work without JavaScript. `media/app.json` can refresh their destination, restricted to approved GoLingo/Apple hosts.

The **GoLingo gallery gameplay previews** workflow commits only gallery media. Its current script, `tools/capture-golingo-gallery.cjs`, refreshes Lagoon while preserving the completed Word Folio and Super Flying Man recordings. The original three-game recorder is available in the repository history.

The **Verify GoLingo gallery release** workflow checks the live page, images, App Store buttons, MP4 playback, FAQ behavior, and horizontal layout at 1280, 768, 390, and 320 CSS pixels. It uses full Google Chrome when installed on the runner for H.264 support. A README change or manual workflow run triggers it. Its release archive includes this folder, screenshots, and a diagnostic report.

The gallery links five existing browser games and hosts Matterhorn in `matterhorn/`. This update does not modify the root home page, SwiftUI application code, or the App Store binary.


## Sword Riding Immortal

The new sword-flight game and its editable source are in `sword-riding-immortal/`. Its illustrated card appears in Flying, Scenery, Explore, Avatar, Language Learning, Words, and Sentences filters. Both card links pass the shared lesson using the existing `#golingoLesson=` launch handler.

## Yokohama City Flight

Yokohama City Flight is the 22nd gallery card. Its built game is hosted at the repository-root `yokohama-city-flight/` path. The card appears in Flying, Airplane, Scenery, Explore, Language Learning, Words, and Sentences filters. Both links use the existing `#golingoLesson=` launch handler and remain in the current tab.

`media/yokohama-city-flight.svg` is an original vector illustration of a cockpit, dense city, and vocabulary gate. It is not a recorded gameplay preview or a navigation map. The existing preview-video map, lesson persistence, filters, app download links, and all previous cards are unchanged.
