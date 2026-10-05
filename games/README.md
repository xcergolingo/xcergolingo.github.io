# GoLingo Games

A responsive landing page for the three current GoLingo language games.

**Website:** https://xcergolingo.github.io/games/

**Download GoLingo:** https://apps.apple.com/app/id1194977025

The verified App Store listing is **Learn Lingo With GoLingo & AI**, by **xin wang**. The other app named golingo by golingo Ltd is not this app.

## Games

| Game | Browser demo | Preview |
| --- | --- | --- |
| Lagoon | https://xcergolingo.github.io/far-cry-lagoon/ | media/lagoon.mp4 |
| Word Folio | https://xcergolingo.github.io/word-folio/ | media/word-folio.mp4 |
| Super Flying Man | https://xcergolingo.github.io/super-flying-man/ | media/super-flying-man.mp4 |

The 12-second previews are silent recordings of the actual public games using demonstration vocabulary. They are not concept animations. The recorder uses a software-rendered browser; game performance varies by device. The recording-only Word Folio speech-voice notification is hidden because no speech voice is installed on the recording machine. Game sources are unchanged.

## Visitor journey

Watch a preview, download GoLingo, choose or create a vocabulary list, and launch a game from the app. Browser demos remain available as a secondary action. App download links and the QR code point directly to the verified App Store ID. No unverified app URL scheme is used.

## Files

- `index.html`: page content, game cards, guide, FAQ, and accessible video dialog.
- `style.css`: responsive desktop, tablet, and phone layouts.
- `app.js`: video controls, reduced-motion/data-saver behavior, and validated download-link metadata.
- `media/`: locally hosted MP4 previews, posters, official app icon, App Store metadata, and QR code.

No build process, external font, analytics, or third-party video player is required. Serve this folder with a static server. GitHub Pages publishes it under `/games/`.

## Maintenance

Edit the HTML for wording and the JavaScript game map when adding a game. The download destination is embedded in HTML so it works without JavaScript. `media/app.json` can refresh the destination, restricted to approved GoLingo/Apple hosts.

The **GoLingo gallery gameplay previews** workflow records previews and commits only gallery media. Its capture script is `tools/capture-golingo-gallery.cjs`.

The **Verify GoLingo gallery release** workflow checks the live page, images, App Store buttons, video playback, FAQ behavior, and horizontal layout at 1280, 768, 390, and 320 CSS pixels. A README change or manual workflow run triggers it. The workflow uploads a release archive containing this folder, screenshots, and its test report.

This website does not modify the three games, the root home page, SwiftUI application code, or the App Store binary. It promotes the existing GoLingo game-launch integration.
