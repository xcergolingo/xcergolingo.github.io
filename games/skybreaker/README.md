# Skybreaker — Language Flight

Play: https://xcergolingo.github.io/games/skybreaker/

A 2D vertical arcade playfield rendered with Three.js: shoot word aircraft,
survive the sentence boss, and practice your own vocabulary.

- Each wave teaches one sentence; each small aircraft represents one word.
- Destroying a word plane repeats its word until the next kill or Voice pause.
- Defeating the boss reads the complete sentence once.
- Text starts hidden. Cycle Aa / W / S for Hidden / Word / Sentence, or choose
  **Your Sentences → Text while flying**. Sentence mode replaces the boss title
  above the health bar with the current sentence.
- Keyboard: WASD/arrows, Space to fire, B/X to bomb, P/Escape to pause.
- Touch: drag the aircraft; use the Bomb and Voice buttons.
- Normal, Hard, and Ace combat difficulty. Hard is the default.

## Hosting and source

`index.html` is the complete game, with Three.js r180 embedded and its MIT
license preserved. No build step or external art/model files are required.
Browser/device speech voices provide pronunciation; offline speech needs an
installed voice. Real-device audio and frame rate vary by browser and device.

## Passing lessons from GoLingo

The gallery at https://xcergolingo.github.io/games/ passes its active lesson in
`#golingoLesson=` as URL-encoded JSON, without sending it to the web server.
The game imports this lesson instead of its examples. Both sentence arrays and
GoLingo word entries are accepted. If a word entry includes a sentence, that
sentence is used; a bare word becomes a one-word wave.

Canonical input, after the page's `skybreaker.ready` message:

```js
window.skybreaker.loadLesson({
  language: 'es-ES',
  sentences: ['El cielo es azul.', 'Me gusta volar.']
});
```

The existing `?lesson=`, `?sentences=...&lang=...`, and `skybreaker.lesson`
postMessage imports remain supported. A real Start tap activates the speech
engine. The Voice button can pause or replay without showing a text card.

Gallery categories: **2D Game**, **Action**, **Airplane**, Flying, Words, Sentences.
