# Panda Lingo — Bamboo Garden

Play: https://xcergolingo.github.io/games/panda-lingo/

Gallery: https://xcergolingo.github.io/games/#panda-lingo

A mobile-friendly, buildless Three.js language game for GoLingo. The art direction is inspired by a panda teacher, wooden chalkboard, waterfall, flowers, and bamboo grove.

## Play

Tap **Let’s learn together**. Pip introduces a word, pronunciation hint where available, translation, and example sentence. Listen to the word or sentence, then give Pip bamboo to record your discovery.

- **Learn:** practice one word at a time; 5 bamboo per discovery.
- **Listen:** hear the target-language word and select its meaning.
- **Match:** read/hear a meaning and choose the target-language word.
- Correct quiz answers earn 10 bamboo; streaks of 3 or more add 5.
- Relaxed mode has unlimited retries. Optional Challenge mode has 60 seconds and 3 hearts in Listen/Match. Modal dialogs and background tabs pause the timer.
- Completing a round shows the words explored, earned bamboo, and first-try answers.
- Custom lists run in groups of up to 8. The result screen has a next-group button for longer lists.
- Tap Pip to trigger a greeting. Portrait and landscape layouts are supported.

Keyboard: 1–3 select an answer, Space repeats the cue, Enter feeds/continues. Buttons and fields remain keyboard accessible.

## Vocabulary

Spanish, Japanese, Chinese, French, Korean, German, and English can be selected as target/base languages. Each built-in language has 24 concepts across Nature, Food, and Everyday, with paired short example sentences. Japanese, Chinese, and Korean include reading hints.

Use the language menu to paste GoLingo JSON or choose a JSON file. Imports accept up to 5,000 usable entries, with file-size and individual-text limits. Vocabulary stays in memory; the game stores preferences and the cumulative bamboo total locally on the current device.

```json
{
  "primaryLanguage": "en",
  "learningLanguage": "ja",
  "words": [
    {
      "id": "101",
      "word": "水",
      "translation": "water",
      "sentence": "水を飲みます。",
      "sentenceTranslation": "I drink water."
    }
  ]
}
```

### GoLingo integration

Recommended for large data: call the exposed bridge after the game loads:

```js
window.GoLingo.setData(vocabulary);
// Also available: window.setGoLingoData(vocabulary)
```

A parent/opener can send:

```js
gameWindow.postMessage({ type: 'GOLINGO_DATA', data: vocabulary }, GAME_ORIGIN);
```

The receiver checks for a parent/opener, same-origin sender, or the GoLingo/GitHub game-hub origins. Recognized envelope aliases include `golingo-data`, `golingoData`, `golingo:setVocabulary`, `setWords`, and `GO_LINGO_DATA`. Raw GoLingo objects are accepted. All displayed text is escaped.

Small payloads can use `?data=` / `?words=` / `?payload=` or a hash payload. The parser accepts JSON, URL-encoded JSON, and Unicode base64. Use the bridge or a file for large lists to avoid URL limits.

## Source

- `index.html`: app structure and dialogs.
- `style.css`: responsive chalkboard/garden interface.
- `game.js`: renderer, camera, state machine, speech, sound, controls, integration.
- `panda.js`: procedural, animated plush panda.
- `garden.js`: instanced bamboo, foliage, flowers, pond, waterfall, butterflies, and celebration particles.
- `lessons.js`: curated lesson data and bounded import normalization.
- `assets/three.module.js` / `three.core.js`: local Three.js r181 runtime.

No remote assets, build step, or installation is required. Serve this directory over HTTP(S); ES modules should not be opened with a file URL. GitHub Pages publishes this directory at https://xcergolingo.github.io/games/panda-lingo/.

## Verification and runtime requirements

JavaScript syntax, lesson data, import normalization, complete Learn rounds, rewards, correct/incorrect quiz answers, a nine-word Japanese import, next-batch progression, and 390×844 / 844×390 interface layouts were checked. The inspection browser disables WebGL, so live 3D browser rendering and actual iPhone audio could not be verified there. The panda's actual Three.js geometry was exported and visually checked in front/three-quarter Blender renders; those renders approximate browser lighting/materials.

Three.js uses WebGL2. A text/emoji fallback preserves the language activities if graphics cannot initialize. Speech uses the device's Web Speech voices and can vary by browser and installed languages. Music/feedback use Web Audio, enabled by a user gesture. No microphone or speech-recognition permission is requested.
