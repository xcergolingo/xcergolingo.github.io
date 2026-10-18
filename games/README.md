# GoLingo Games

A responsive gallery for six GoLingo language games, with category filters and shared lesson data.

**Website:** https://xcergolingo.github.io/games/

**Download GoLingo:** https://apps.apple.com/app/id1194977025

The verified App Store listing is **Learn Lingo With GoLingo & AI**, by **xin wang**. The unrelated golingo Ltd app is not this app.

## Games

| Game | Browser demo | Preview |
| --- | --- | --- |
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
