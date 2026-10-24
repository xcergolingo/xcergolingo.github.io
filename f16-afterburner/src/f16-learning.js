/* GoLingo F-16 — lesson parsing, speech sequencing, and portable exports.
 * No network request is needed unless a lesson explicitly supplies an audio URL.
 */
(function (global) {
  'use strict';

  var MAX_BYTES = 1048576;
  var MAX_WORDS = 300;
  var LIMITS = { word: 500, translation: 1000, sentence: 3000, sentenceTranslation: 3000 };

  function copyFields(value) {
    var result = {};
    if (!value || typeof value !== 'object') return result;
    Object.keys(value).forEach(function (key) {
      if (key !== '__proto__' && key !== 'prototype' && key !== 'constructor') result[key] = value[key];
    });
    return result;
  }

  function byteLength(text) {
    if (typeof global.TextEncoder === 'function') return new global.TextEncoder().encode(text).length;
    return unescape(encodeURIComponent(text)).length;
  }

  function normalizeLanguage(value) {
    var tag = String(value == null ? '' : value).trim().replace(/_/g, '-');
    if (!tag || tag.length > 80) throw new Error('Enter a language code, for example es, en-US, ja, or zh-CN.');
    try {
      if (global.Intl && typeof global.Intl.getCanonicalLocales === 'function') {
        return global.Intl.getCanonicalLocales(tag)[0];
      }
      if (!/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(tag)) throw new Error('Invalid code');
      return tag;
    } catch (_) {
      throw new Error('“' + tag + '” is not a valid language code. Try es, en-US, ja, or zh-CN.');
    }
  }

  function textField(value, key, index) {
    if (value == null) return '';
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('Item ' + (index + 1) + ': ' + key + ' must be text.');
    }
    var text = String(value).trim();
    if (text.length > LIMITS[key]) {
      throw new Error('Item ' + (index + 1) + ': ' + key + ' is too long (maximum ' + LIMITS[key] + ' characters).');
    }
    return text;
  }

  function audioURL(value, label, index) {
    if (value == null || value === '') return '';
    if (value && typeof value === 'object') value = value.url || value.src || '';
    if (typeof value !== 'string') throw new Error('Item ' + (index + 1) + ': ' + label + ' must be an audio URL.');
    var result = value.trim();
    if (!result) return '';
    if (result.length > 8192) throw new Error('Item ' + (index + 1) + ': audio URL is too long.');
    try {
      var url = new global.URL(result);
      if (!/^(https?:|blob:)$/.test(url.protocol)) throw new Error('Unsupported protocol');
    } catch (_) {
      throw new Error('Item ' + (index + 1) + ': ' + label + ' must begin with https://, http://, or blob:.');
    }
    return result;
  }

  function firstField(source, keys) {
    for (var i = 0; i < keys.length; i++) {
      var value = source[keys[i]];
      if (value != null && value !== '') return value;
    }
    return '';
  }

  function splitLine(line) {
    // A tab takes precedence so an ordinary | can remain inside a TSV sentence.
    var delimiter = line.indexOf('\t') >= 0 ? '\t' : '|';
    var cells = [], current = '', quoted = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"' && (quoted || !current.trim())) {
        if (quoted && line[i + 1] === '"') { current += '"'; i++; }
        else quoted = !quoted;
      } else if (c === delimiter && !quoted) { cells.push(current.trim()); current = ''; }
      else current += c;
    }
    cells.push(current.trim());
    if (quoted) throw new Error('A pasted line has an unclosed quotation mark.');
    return cells;
  }

  function looksLikeCSV(text) {
    var firstLine = text.split(/\r\n?|\n/, 1)[0];
    // Detect an actual header, leaving ordinary words/sentences containing commas alone.
    return /(?:^|,)\s*"?word"?\s*(?:,|$)/i.test(firstLine);
  }

  function parseCSV(text) {
    var rows = [], row = [], field = '', quoted = false, closed = false;
    function endField() { row.push(field); field = ''; closed = false; }
    function endRow() {
      endField();
      if (row.some(function (value) { return value.trim(); })) rows.push(row);
      row = [];
    }
    // RFC-style quoted fields can contain commas, doubled quotes, and literal newlines.
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else { quoted = false; closed = true; }
        } else field += c;
      } else if (c === ',') endField();
      else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        endRow();
      } else if (c === '"' && !closed && !field.trim()) {
        field = ''; quoted = true;
      } else if (closed) {
        if (!/\s/.test(c)) throw new Error('CSV row ' + (rows.length + 1) + ': unexpected text after a closing quotation mark.');
      } else field += c;
    }
    if (quoted) throw new Error('The CSV has an unclosed quoted field. Close the quotation mark around the word or sentence.');
    if (field || row.length || closed) endRow();
    if (!rows.length) throw new Error('The CSV is empty. Include a word column and at least one word.');
    var knownHeaders = ['id', 'word', 'translation', 'sentence', 'sentenceTranslation', 'learningLanguage', 'primaryLanguage',
      'audioUrl', 'wordAudioUrl', 'sentenceAudioUrl', 'translationAudioUrl', 'sentenceTranslationAudioUrl'];
    var headerMap = Object.create(null);
    knownHeaders.forEach(function (name) { headerMap[name.toLowerCase()] = name; });
    var seen = Object.create(null);
    var headers = rows.shift().map(function (value) {
      var header = value.replace(/^\uFEFF/, '').trim();
      if (!header) throw new Error('The CSV has an empty column header. Name each column or remove the empty column.');
      if (header === '__proto__' || header === 'constructor' || header === 'prototype') throw new Error('The CSV contains an unsupported column header.');
      header = headerMap[header.toLowerCase()] || header;
      if (seen[header]) throw new Error('The CSV repeats the “' + header + '” column. Keep each header only once.');
      seen[header] = true;
      return header;
    });
    if (headers.indexOf('word') < 0) throw new Error('The CSV needs a word column. Other columns can include translation, sentence, and sentenceTranslation.');

    var result = { words: [] }, languages = { learningLanguage: '', primaryLanguage: '' };
    rows.forEach(function (cells, index) {
      if (cells.length > headers.length) throw new Error('CSV row ' + (index + 2) + ' has too many values. Put text containing commas inside quotation marks.');
      var item = {};
      headers.forEach(function (key, column) {
        var value = cells[column] == null ? '' : cells[column];
        // Reverse the explicit spreadsheet-safe prefix used by our CSV exporter.
        if (/^'(?:'|[\s\uFEFF]*[=+@-]|[\t\r])/.test(value)) value = value.slice(1);
        item[key] = value;
      });
      ['learningLanguage', 'primaryLanguage'].forEach(function (key) {
        if (!item[key] || !item[key].trim()) { delete item[key]; return; }
        var tag = normalizeLanguage(item[key]);
        if (languages[key] && languages[key] !== tag) {
          throw new Error('The CSV mixes ' + key + ' values (' + languages[key] + ' and ' + tag + '). Use one language pair per CSV flight.');
        }
        languages[key] = tag;
        item[key] = tag;
      });
      result.words.push(item);
    });
    if (languages.learningLanguage) result.learningLanguage = languages.learningLanguage;
    if (languages.primaryLanguage) result.primaryLanguage = languages.primaryLanguage;
    return result;
  }

  function parseInput(input, opts) {
    opts = opts || {};
    var payload = input;
    if (typeof payload === 'string') {
      if (byteLength(payload) > MAX_BYTES) throw new Error('This lesson is too large. Use a file smaller than 1 MB.');
      payload = payload.replace(/^\uFEFF/, '').trim();
      if (!payload) throw new Error('Paste at least one word and its translation.');
      if (/^[\[{]/.test(payload)) {
        try { payload = JSON.parse(payload); }
        catch (_) { throw new Error('The JSON is incomplete or invalid. Check its brackets, commas, and quotation marks.'); }
      } else if (looksLikeCSV(payload)) {
        payload = parseCSV(payload);
      } else {
        payload = {
          words: payload.split(/\r\n?|\n/).filter(function (line) { return line.trim(); }).map(function (line, index) {
            var cells = splitLine(line);
            if (cells.length > 4) throw new Error('Line ' + (index + 1) + ': use word | translation | sentence | sentence translation.');
            return { word: cells[0], translation: cells[1] || '', sentence: cells[2] || '', sentenceTranslation: cells[3] || '' };
          })
        };
      }
    } else {
      var serialized;
      try { serialized = JSON.stringify(payload); }
      catch (_) { throw new Error('The lesson must be ordinary JSON without circular references.'); }
      if (!serialized || byteLength(serialized) > MAX_BYTES) throw new Error('Use a valid lesson smaller than 1 MB.');
    }

    if (Array.isArray(payload)) payload = { words: payload };
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.words)) {
      throw new Error('Use a words array or a GoLingo lesson containing {learningLanguage, primaryLanguage, words}.');
    }
    if (!payload.words.length) throw new Error('This lesson has no words. Add at least one word before applying it.');
    if (payload.words.length > MAX_WORDS) throw new Error('A flight can contain at most ' + MAX_WORDS + ' words. Split this lesson into smaller flights.');

    var result = copyFields(payload);
    result.primaryLanguage = normalizeLanguage(payload.primaryLanguage || opts.primaryLanguage || 'en');
    result.learningLanguage = normalizeLanguage(payload.learningLanguage || opts.learningLanguage || 'es');
    result.words = payload.words.map(function (item, index) {
      if (typeof item === 'string' || typeof item === 'number') item = { word: String(item) };
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Item ' + (index + 1) + ' must be a word or a word object.');
      var word = copyFields(item);
      word.word = textField(firstField(item, ['word', 'text']), 'word', index);
      if (!word.word) throw new Error('Item ' + (index + 1) + ' has no word. Remove the blank item or enter a word.');
      word.translation = textField(item.translation, 'translation', index);
      word.sentence = textField(item.sentence, 'sentence', index);
      word.sentenceTranslation = textField(item.sentenceTranslation, 'sentenceTranslation', index);
      if (item.id == null || item.id === '') word.id = 'f16-' + (index + 1);
      else if (typeof item.id === 'string' || typeof item.id === 'number') word.id = item.id;
      else throw new Error('Item ' + (index + 1) + ': id must be text or a number.');

      var audioAliases = {
        audioUrl: ['audioUrl', 'wordAudioUrl', 'audioURL', 'audio_url', 'wordAudio', 'audio'],
        sentenceAudioUrl: ['sentenceAudioUrl', 'sentenceAudioURL', 'sentence_audio_url', 'exampleAudioUrl', 'sentenceAudio'],
        translationAudioUrl: ['translationAudioUrl', 'translationAudioURL', 'translation_audio_url', 'translationAudio'],
        sentenceTranslationAudioUrl: ['sentenceTranslationAudioUrl', 'sentence_translation_audio_url']
      };
      Object.keys(audioAliases).forEach(function (key) {
        var url = audioURL(firstField(item, audioAliases[key]), key, index);
        if (url) word[key] = url;
        else delete word[key];
      });
      if (item.learningLanguage) word.learningLanguage = normalizeLanguage(item.learningLanguage);
      if (item.primaryLanguage) word.primaryLanguage = normalizeLanguage(item.primaryLanguage);
      return word;
    });
    return result;
  }

  function defaultLesson() {
    return {
      primaryLanguage: 'en', learningLanguage: 'es', title: 'First flight',
      words: [
        { id: 'flight-airplane', word: 'el avión', translation: 'airplane', sentence: 'El avión vuela sobre el mar.', sentenceTranslation: 'The airplane flies over the sea.' },
        { id: 'flight-sky', word: 'el cielo', translation: 'sky', sentence: 'El cielo está despejado.', sentenceTranslation: 'The sky is clear.' },
        { id: 'flight-mountain', word: 'la montaña', translation: 'mountain', sentence: 'Veo una montaña muy alta.', sentenceTranslation: 'I see a very tall mountain.' },
        { id: 'flight-water', word: 'el agua', translation: 'water', sentence: 'El agua es azul y transparente.', sentenceTranslation: 'The water is blue and clear.' },
        { id: 'flight-cloud', word: 'la nube', translation: 'cloud', sentence: 'Pasamos cerca de una nube.', sentenceTranslation: 'We pass near a cloud.' },
        { id: 'flight-island', word: 'la isla', translation: 'island', sentence: 'Hay una isla frente a nosotros.', sentenceTranslation: 'There is an island in front of us.' },
        { id: 'flight-fly', word: 'volar', translation: 'to fly', sentence: 'Me gusta volar.', sentenceTranslation: 'I like to fly.' },
        { id: 'flight-airport', word: 'el aeropuerto', translation: 'airport', sentence: 'Vamos al aeropuerto.', sentenceTranslation: 'We are going to the airport.' }
      ]
    };
  }

  function createSpeech(options) {
    options = options || {};
    var synth = global.speechSynthesis || null;
    var current = null, currentOptions = {}, loopEntry = null, loopOptions = {}, generation = 0;
    var timer = null, startTimer = null, activeUtterance = null, media = null;
    var paused = !!options.paused, suspended = false, unlocked = false, speaking = false, blocked = false;
    var forceOnce = false, status = 'ready', message = 'Fly through a ring to hear its word.';
    var language = normalizeLanguage(options.language || options.learningLanguage || 'es');
    var primaryLanguage = normalizeLanguage(options.primaryLanguage || 'en');
    var voiceURI = String(options.voiceURI || ''), rate = Math.max(0.55, Math.min(1.4, Number(options.rate) || 0.88));
    var gap = Math.max(0.6, Math.min(8, Number(options.gap) || 1.2)), sentenceEnabled = !!options.sentenceEnabled;
    // A valid, short PCM recording primes the same audio element used by lessons.
    var silentAudio = 'data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

    function state() {
      return { status: status, message: message, paused: paused, suspended: suspended,
        unlocked: unlocked, speaking: speaking, blocked: blocked, current: current,
        language: language, primaryLanguage: primaryLanguage, voiceURI: voiceURI,
        rate: rate, gap: gap, sentenceEnabled: sentenceEnabled, once: !!currentOptions.once };
    }
    function report(next, text) {
      status = next;
      message = text || '';
      if (typeof options.onStatus === 'function') {
        try { options.onStatus(state()); } catch (_) { /* A view must not break playback. */ }
      }
    }
    function clearTimers() {
      if (timer != null) global.clearTimeout(timer);
      if (startTimer != null) global.clearTimeout(startTimer);
      timer = startTimer = null;
    }
    function halt() {
      generation++;
      clearTimers();
      if (media) {
        media.onended = media.onerror = media.onplaying = null;
        try { media.pause(); } catch (_) {}
      }
      if (activeUtterance) activeUtterance.onstart = activeUtterance.onend = activeUtterance.onerror = null;
      activeUtterance = null;
      if (synth) { try { synth.cancel(); } catch (_) {} }
      speaking = false;
      return generation;
    }
    function allowed(token) {
      return token === generation && !suspended && (!paused || forceOnce) && !!current;
    }
    function fail(token, text) {
      if (token !== generation) return;
      halt();
      forceOnce = false;
      blocked = true;
      report('blocked', text || 'Audio could not start. Tap Resume voice to try again.');
    }
    function voices() {
      if (!synth) return [];
      try { return synth.getVoices() || []; } catch (_) { return []; }
    }
    function sameBase(a, b) {
      return String(a || '').replace(/_/g, '-').split('-')[0].toLowerCase() === String(b || '').split('-')[0].toLowerCase();
    }
    function selectVoice(lang) {
      var list = voices(), matches = list.filter(function (v) { return sameBase(v.lang, lang); });
      var selected = matches.filter(function (v) { return v.voiceURI === voiceURI; })[0];
      if (selected) return selected;
      matches.sort(function (a, b) {
        function score(v) { return (String(v.lang).toLowerCase() === lang.toLowerCase() ? 8 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0); }
        return score(b) - score(a);
      });
      return matches[0] || null;
    }
    function sequence() {
      var entry = current, spec = currentOptions;
      var learnLang = entry.learningLanguage || language;
      var primary = entry.primaryLanguage || primaryLanguage;
      if (spec.translation) {
        return [{ text: spec.sentence ? entry.sentenceTranslation : entry.translation,
          url: spec.sentence ? entry.sentenceTranslationAudioUrl : entry.translationAudioUrl, lang: primary }];
      }
      if (spec.sentence) return [{ text: entry.sentence, url: entry.sentenceAudioUrl, lang: learnLang }];
      var segments = [{ text: entry.word, url: entry.audioUrl || entry.wordAudioUrl, lang: learnLang }];
      if (sentenceEnabled && entry.sentence) segments.push({ text: entry.sentence, url: entry.sentenceAudioUrl, lang: learnLang });
      return segments;
    }
    function speakText(segment, token, done) {
      if (!allowed(token)) return;
      if (!synth || typeof global.SpeechSynthesisUtterance !== 'function') {
        fail(token, 'This browser has no speech voice. Supply an audioUrl for your words or use a browser with speech support.');
        return;
      }
      var voice = selectVoice(segment.lang);
      // Never silently pronounce Japanese, Arabic, etc. with an unrelated default voice.
      if (voices().length && !voice) {
        fail(token, 'No ' + segment.lang + ' voice is installed. Add that voice to your device, or provide an audio URL.');
        return;
      }
      var utterance = new global.SpeechSynthesisUtterance(segment.text);
      activeUtterance = utterance; // Keep a strong reference until the native event arrives.
      utterance.lang = segment.lang;
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      if (voice) utterance.voice = voice;
      utterance.onstart = function () {
        if (!allowed(token)) return;
        if (startTimer != null) global.clearTimeout(startTimer);
        startTimer = null;
        speaking = true;
        report('speaking', segment.text);
      };
      utterance.onend = function () {
        if (!allowed(token)) return;
        if (startTimer != null) global.clearTimeout(startTimer);
        startTimer = null;
        activeUtterance = null;
        speaking = false;
        done();
      };
      utterance.onerror = function (event) {
        if (!allowed(token)) return;
        var reason = event && event.error;
        if (reason === 'not-allowed') fail(token, 'Tap Resume voice to allow speech on this device.');
        else fail(token, 'The voice could not play' + (reason ? ' (' + reason + ')' : '') + '. Choose another voice or tap Resume voice.');
      };
      // This only detects a voice that never starts; it never cuts off a spoken word.
      startTimer = global.setTimeout(function () {
        if (allowed(token) && activeUtterance === utterance && !speaking) {
          fail(token, 'The selected voice did not start. Tap Resume voice or choose another voice.');
        }
      }, 10000);
      try {
        if (synth.paused && typeof synth.resume === 'function') synth.resume();
        synth.speak(utterance);
      } catch (_) { fail(token, 'Speech could not start. Tap Resume voice to try again.'); }
    }
    function playSegment(segment, token, done) {
      if (!allowed(token)) return;
      if (!segment.text && !segment.url) { done(); return; }
      if (!segment.url || typeof global.Audio !== 'function') { speakText(segment, token, done); return; }
      try { audioURL(segment.url, 'audioUrl', 0); }
      catch (_) { speakText(segment, token, done); return; }
      if (!media) media = new global.Audio();
      var settled = false;
      function fallback() {
        if (settled || !allowed(token)) return;
        settled = true;
        if (startTimer != null) global.clearTimeout(startTimer);
        startTimer = null;
        media.onended = media.onerror = media.onplaying = null;
        try { media.pause(); } catch (_) {}
        speaking = false;
        if (segment.text) speakText(segment, token, done);
        else fail(token, 'This audio file could not play. Check the URL and tap Resume voice.');
      }
      media.onplaying = function () {
        if (settled || !allowed(token)) return;
        if (startTimer != null) global.clearTimeout(startTimer);
        startTimer = null;
        speaking = true;
        report('speaking', segment.text || 'Playing lesson audio');
      };
      media.onended = function () {
        if (settled || !allowed(token)) return;
        settled = true;
        if (startTimer != null) global.clearTimeout(startTimer);
        startTimer = null;
        speaking = false;
        done();
      };
      media.onerror = fallback;
      try {
        media.src = segment.url;
        media.preload = 'auto';
        media.playbackRate = rate;
        startTimer = global.setTimeout(fallback, 10000);
        var pending = media.play();
        if (pending && typeof pending.catch === 'function') pending.catch(fallback);
      } catch (_) { fallback(); }
    }
    function begin() {
      var token = halt();
      blocked = false;
      if (!current) { report('ready', 'Fly through a ring to hear its word.'); return; }
      if (suspended) { report('suspended', 'Voice waits while the flight is paused.'); return; }
      if (paused && !forceOnce) { report('paused', 'Voice paused. Tap Resume voice to listen.'); return; }
      var segments = sequence();
      if (!segments.some(function (segment) { return segment.text || segment.url; })) {
        forceOnce = false;
        report('empty', currentOptions.translation ? 'This word has no translation yet.' : 'This word has no example sentence yet.');
        return;
      }
      function next(index) {
        if (!allowed(token)) return;
        if (index >= segments.length) {
          if (currentOptions.once) {
            forceOnce = false;
            if (loopEntry) {
              current = loopEntry;
              currentOptions = copyFields(loopOptions);
              if (!paused && !suspended) {
                report('waiting', 'Replay complete. Returning to the flight word.');
                timer = global.setTimeout(function () { timer = null; if (allowed(token)) begin(); }, gap * 1000);
              } else report('paused', 'Voice remains paused.');
            } else report(paused ? 'paused' : 'ready', paused ? 'Voice remains paused.' : 'Replay complete.');
            return;
          }
          report('waiting', 'Repeating after a ' + gap.toFixed(1) + ' second pause.');
          timer = global.setTimeout(function () { timer = null; next(0); }, gap * 1000);
          return;
        }
        playSegment(segments[index], token, function () {
          if (!allowed(token)) return;
          if (index + 1 < segments.length) {
            timer = global.setTimeout(function () { timer = null; next(index + 1); }, 450);
          } else next(index + 1);
        });
      }
      report('starting', 'Starting voice…');
      next(0);
    }
    function unlock() {
      if (!unlocked) {
        unlocked = true;
        // Reuse this media element for supplied recordings on browsers requiring a gesture.
        if (typeof global.Audio === 'function') {
          if (!media) media = new global.Audio();
          if (!speaking) {
            try {
              media.src = silentAudio;
              var quiet = media.play();
              if (quiet && typeof quiet.catch === 'function') quiet.catch(function () {});
            } catch (_) {}
          }
        }
        if (synth && typeof global.SpeechSynthesisUtterance === 'function' && !speaking) {
          try {
            var prime = new global.SpeechSynthesisUtterance('a');
            prime.volume = 0;
            prime.lang = language;
            synth.speak(prime);
          } catch (_) {}
        }
      }
      if (synth && synth.paused && typeof synth.resume === 'function') { try { synth.resume(); } catch (_) {} }
      return state();
    }
    function restartIfPlaying() {
      if (current && !suspended && (!paused || forceOnce) && (speaking || status === 'waiting' || status === 'starting')) begin();
      else report(status, message);
    }
    var api = {
      unlock: unlock,
      setLanguage: function (code) { language = normalizeLanguage(code); restartIfPlaying(); return language; },
      setPrimaryLanguage: function (code) { primaryLanguage = normalizeLanguage(code); restartIfPlaying(); return primaryLanguage; },
      setVoice: function (uri) { voiceURI = String(uri || ''); restartIfPlaying(); },
      setRate: function (value) { rate = Math.max(0.55, Math.min(1.4, Number(value) || 0.88)); restartIfPlaying(); },
      setGap: function (seconds) { gap = Math.max(0.6, Math.min(8, Number(seconds) || 1.2)); restartIfPlaying(); },
      setSentenceEnabled: function (enabled) { sentenceEnabled = !!enabled; restartIfPlaying(); },
      play: function (entry, spec) {
        if (!entry || typeof entry !== 'object') return;
        current = copyFields(entry);
        currentOptions = copyFields(spec || {});
        forceOnce = !!currentOptions.once;
        if (!forceOnce) { loopEntry = current; loopOptions = copyFields(currentOptions); }
        begin();
      },
      pause: function () {
        paused = true;
        forceOnce = false;
        halt();
        if (loopEntry) { current = loopEntry; currentOptions = copyFields(loopOptions); }
        report('paused', 'Voice paused. Tap Resume voice to listen.');
      },
      resume: function () {
        unlock();
        paused = false;
        forceOnce = false;
        if (loopEntry) { current = loopEntry; currentOptions = copyFields(loopOptions); }
        else { currentOptions = {}; loopEntry = current; loopOptions = {}; }
        begin();
      },
      stop: function () {
        halt();
        current = null;
        currentOptions = {};
        loopEntry = null;
        loopOptions = {};
        forceOnce = false;
        blocked = false;
        report(paused ? 'paused' : 'ready', paused ? 'Voice remains paused.' : 'Fly through a ring to hear its word.');
      },
      setSuspended: function (value) {
        value = !!value;
        if (value === suspended) return;
        suspended = value;
        if (suspended) {
          halt();
          forceOnce = false;
          if (loopEntry) { current = loopEntry; currentOptions = copyFields(loopOptions); }
          report('suspended', 'Voice waits while the flight is paused.');
        } else if (!paused && current && !currentOptions.once) begin();
        else report(paused ? 'paused' : 'ready', paused ? 'Voice remains paused.' : 'Voice ready.');
      },
      getState: state,
      getVoices: voices
    };
    return api;
  }

  function downloadBlob(text, type, filename) {
    if (!global.document || !global.URL || !global.Blob) throw new Error('Downloads are unavailable in this browser.');
    var blob = new global.Blob([text], { type: type });
    var url = global.URL.createObjectURL(blob);
    var link = global.document.createElement('a');
    link.href = url;
    link.download = String(filename || 'GoLingo-F16-Words.json').replace(/[\\/:*?"<>|]/g, '-');
    link.style.display = 'none';
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    global.setTimeout(function () { global.URL.revokeObjectURL(url); }, 10000);
    return { filename: link.download, size: blob.size };
  }
  function downloadJSON(payload, filename) {
    return downloadBlob(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', filename || 'GoLingo-F16-Words.json');
  }
  function downloadCSV(payload, filename) {
    var words = Array.isArray(payload) ? payload : payload.words || [];
    var columns = ['id', 'word', 'translation', 'sentence', 'sentenceTranslation', 'learningLanguage', 'primaryLanguage'];
    function cell(value) {
      var text = String(value == null ? '' : value);
      // Keep spreadsheet imports from treating vocabulary as executable formulas.
      if (/^'/.test(text) || /^[\s\uFEFF]*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    var rows = [columns.map(cell).join(',')];
    words.forEach(function (word) {
      rows.push(columns.map(function (key) { return cell(word[key] != null ? word[key] : payload[key]); }).join(','));
    });
    return downloadBlob('\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8', filename || 'GoLingo-F16-Words.csv');
  }

  global.F16Learning = {
    parseInput: parseInput, createSpeech: createSpeech, normalizeLanguage: normalizeLanguage,
    defaultLesson: defaultLesson, downloadJSON: downloadJSON, downloadCSV: downloadCSV
  };
})(typeof window !== 'undefined' ? window : globalThis);
