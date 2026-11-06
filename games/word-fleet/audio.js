(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FleetAudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function create(options) {
    options = options || {};
    var host = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
    var synth = host.speechSynthesis || null;
    var context = null;
    var request = null, epoch = 0, cycle = 0;
    var activeAudio = null, activeUtterance = null;
    var repeatTimer = null, loadTimer = null, speechTimer = null, guardTimer = null;
    var effectNodes = new Set();

    function settings() {
      var value = {};
      try { value = options.getSettings ? options.getSettings() || {} : {}; } catch (_) {}
      return {
        audio: value.audio !== false,
        effects: value.effects !== false,
        repeat: value.repeat !== false,
        rate: Number.isFinite(Number(value.rate)) ? Math.min(1.4, Math.max(0.4, Number(value.rate))) : 0.85
      };
    }

    function permitted() {
      if (host.document && host.document.visibilityState === 'hidden') return false;
      try { return typeof options.canPlay !== 'function' || !!options.canPlay(); } catch (_) { return false; }
    }

    function allowed() { return settings().audio && permitted(); }

    function status(message) {
      if (typeof options.onStatus === 'function') {
        try { options.onStatus(message); } catch (_) {}
      }
    }

    function clearTimer(name) {
      if (name === 'repeat' && repeatTimer !== null) { host.clearTimeout(repeatTimer); repeatTimer = null; }
      if (name === 'load' && loadTimer !== null) { host.clearTimeout(loadTimer); loadTimer = null; }
      if (name === 'speech' && speechTimer !== null) { host.clearTimeout(speechTimer); speechTimer = null; }
      if (name === 'guard' && guardTimer !== null) { host.clearInterval(guardTimer); guardTimer = null; }
    }

    function releaseAudio() {
      if (!activeAudio) return;
      var audio = activeAudio; activeAudio = null;
      audio.onended = null; audio.onerror = null; audio.onplaying = null;
      audio.ontimeupdate = null; audio.onstalled = null;
      try { audio.pause(); } catch (_) {}
      try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
    }

    function releaseUtterance(cancel) {
      if (activeUtterance) {
        activeUtterance.onend = null; activeUtterance.onerror = null; activeUtterance.onstart = null;
        activeUtterance = null;
      }
      if (cancel && synth && typeof synth.cancel === 'function') {
        try { synth.cancel(); } catch (_) {}
      }
    }

    function stopPronunciation() {
      ++epoch; ++cycle; request = null;
      clearTimer('repeat'); clearTimer('load'); clearTimer('speech'); clearTimer('guard');
      releaseAudio(); releaseUtterance(true);
    }

    function stopEffects() {
      effectNodes.forEach(function (entry) {
        try { entry.source.stop(); } catch (_) {}
        entry.nodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
      });
      effectNodes.clear();
    }

    function stop() { stopPronunciation(); stopEffects(); }

    function current(token, attempt) {
      return !!request && token === epoch && attempt === cycle;
    }

    function check(token, attempt) {
      if (!current(token, attempt)) return false;
      if (!allowed()) { stopPronunciation(); return false; }
      return true;
    }

    function finish(token, attempt, success, message) {
      if (!current(token, attempt)) return;
      var idleAttempt = ++cycle;
      clearTimer('load'); clearTimer('speech');
      releaseAudio(); releaseUtterance(false);
      if (!allowed()) { stopPronunciation(); return; }
      if (success && request.repeat && settings().repeat) {
        // Only a real ended event can enter this repeat path.
        repeatTimer = host.setTimeout(function () {
          repeatTimer = null;
          if (!check(token, idleAttempt)) return;
          if (settings().repeat) begin(request);
          else stopPronunciation();
        }, 1300);
      } else {
        request = null; clearTimer('guard');
      }
      if (message) status(message);
    }

    function languageTag(value) {
      var tag = String(value || 'en').trim().replace(/_/g, '-');
      try {
        if (host.Intl && host.Intl.getCanonicalLocales) return host.Intl.getCanonicalLocales(tag)[0] || 'en';
      } catch (_) { return 'en'; }
      return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(tag) ? tag : 'en';
    }

    function chooseVoice(lang) {
      if (!synth || typeof synth.getVoices !== 'function') return null;
      var voices;
      try { voices = synth.getVoices() || []; } catch (_) { return null; }
      var wanted = lang.toLowerCase(), base = wanted.split('-')[0];
      var matching = voices.filter(function (voice) {
        return String(voice.lang || '').replace(/_/g, '-').toLowerCase().split('-')[0] === base;
      });
      matching.sort(function (a, b) {
        function score(voice) {
          var exact = String(voice.lang || '').replace(/_/g, '-').toLowerCase() === wanted;
          return (exact ? 8 : 0) + (voice.localService ? 4 : 0) + (voice.default ? 1 : 0);
        }
        return score(b) - score(a);
      });
      return matching[0] || null;
    }

    function speechFailure(error) {
      if (error === 'not-allowed') return 'Tap Listen again to enable pronunciation.';
      if (error === 'language-unavailable' || error === 'voice-unavailable') {
        return 'A voice for this language is unavailable. Add one in your device’s speech settings, then try again.';
      }
      if (error === 'canceled' || error === 'interrupted') return '';
      return 'Pronunciation could not start. Tap Listen again to retry.';
    }

    function speakText(entry, token, attempt) {
      if (!check(token, attempt)) return;
      if (!entry.word || !synth || typeof host.SpeechSynthesisUtterance !== 'function') {
        finish(token, attempt, false, 'Pronunciation is unavailable in this browser. Your words are still ready to practice.');
        return;
      }
      var utterance;
      try { utterance = new host.SpeechSynthesisUtterance(entry.word); }
      catch (_) { finish(token, attempt, false, 'Pronunciation is unavailable in this browser.'); return; }
      activeUtterance = utterance;
      utterance.lang = entry.lang;
      utterance.rate = settings().rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      var voice = chooseVoice(entry.lang);
      if (voice) utterance.voice = voice;
      utterance.onstart = function () {
        if (!check(token, attempt)) return;
        clearTimer('speech');
      };
      utterance.onend = function () {
        if (check(token, attempt)) finish(token, attempt, true);
      };
      utterance.onerror = function (event) {
        if (check(token, attempt)) finish(token, attempt, false, speechFailure(event && event.error));
      };
      // A browser can silently decline queued speech, especially before a user gesture.
      speechTimer = host.setTimeout(function () {
        speechTimer = null;
        if (!check(token, attempt)) return;
        releaseUtterance(true);
        finish(token, attempt, false, 'Tap Listen again to enable pronunciation.');
      }, 8000);
      try {
        if (synth.paused && typeof synth.resume === 'function') synth.resume();
        synth.speak(utterance);
      } catch (_) {
        finish(token, attempt, false, 'Tap Listen again to enable pronunciation.');
      }
    }

    function audioURL(value) {
      var input = typeof value === 'string' ? value.trim() : '';
      if (!input) return '';
      try {
        var base = host.location && host.location.href ? host.location.href : 'https://localhost/';
        var parsed = new host.URL(input, base);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'blob:' ? parsed.href : '';
      } catch (_) { return ''; }
    }

    function playClip(entry, token, attempt) {
      if (!check(token, attempt)) return;
      if (typeof host.Audio !== 'function') { entry.fallback = true; speakText(entry, token, attempt); return; }
      var audio;
      try { audio = new host.Audio(); }
      catch (_) { entry.fallback = true; speakText(entry, token, attempt); return; }
      activeAudio = audio;
      var fallingBack = false;
      function fallback() {
        if (fallingBack || !check(token, attempt)) return;
        fallingBack = true; entry.fallback = true;
        clearTimer('load'); releaseAudio();
        // Keep the request but invalidate all callbacks from the failed clip.
        ++cycle; speakText(entry, token, cycle);
      }
      function awaitProgress() {
        clearTimer('load');
        loadTimer = host.setTimeout(fallback, 12000);
      }
      audio.preload = 'auto'; audio.volume = 1; audio.playsInline = true;
      audio.playbackRate = settings().rate;
      audio.onended = function () {
        if (!fallingBack && check(token, attempt)) finish(token, attempt, true);
      };
      audio.onerror = fallback;
      audio.onplaying = function () {
        if (check(token, attempt)) awaitProgress();
      };
      audio.ontimeupdate = function () {
        if (check(token, attempt) && !audio.paused) awaitProgress();
      };
      audio.onstalled = function () {
        if (check(token, attempt) && loadTimer === null) awaitProgress();
      };
      loadTimer = host.setTimeout(fallback, 8000);
      try {
        audio.src = entry.url;
        var playing = audio.play();
        if (playing && typeof playing.catch === 'function') playing.catch(fallback);
      } catch (_) { fallback(); }
    }

    function begin(entry) {
      if (!entry || entry.token !== epoch || !allowed()) { stopPronunciation(); return; }
      clearTimer('repeat'); clearTimer('load'); clearTimer('speech');
      var attempt = ++cycle;
      if (entry.url && !entry.fallback) playClip(entry, epoch, attempt);
      else speakText(entry, epoch, attempt);
    }

    function speak(item, speechOptions) {
      speechOptions = speechOptions || {};
      // Changing a word should not cut off its brief, independent hit/splash effect.
      stopPronunciation();
      if (!allowed()) return false;
      item = typeof item === 'string' ? { word: item } : (item || {});
      var word = typeof item.word === 'string' ? item.word.trim() : '';
      var url = audioURL(item.audioURL);
      if (!word && !url) return false;
      request = {
        token: epoch, word: word, url: url,
        lang: languageTag(speechOptions.lang || item.language || 'en'),
        repeat: speechOptions.repeat === true, fallback: false
      };
      guardTimer = host.setInterval(function () {
        if (!allowed()) stopPronunciation();
      }, 250);
      begin(request);
      return true;
    }

    function unlock() {
      // Called directly from an intentional pointer/keyboard action by the app.
      if (synth && typeof synth.getVoices === 'function') {
        try { synth.getVoices(); } catch (_) {}
      }
      var AudioContext = host.AudioContext || host.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        if (!context || context.state === 'closed') context = new AudioContext();
        if (context.state === 'suspended' && typeof context.resume === 'function') {
          var resumed = context.resume();
          if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
        }
        // One silent sample unlocks WebAudio on browsers that require a gesture.
        var source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(context.destination);
        source.onended = function () { try { source.disconnect(); } catch (_) {} };
        source.start(0);
        return true;
      } catch (_) { return false; }
    }

    function trackSource(source, nodes) {
      var entry = { source: source, nodes: nodes };
      effectNodes.add(entry);
      source.onended = function () {
        nodes.forEach(function (node) { try { node.disconnect(); } catch (_) {} });
        effectNodes.delete(entry);
      };
    }

    function tone(frequency, endFrequency, delay, duration, volume, type) {
      var start = context.currentTime + delay;
      var oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = type || 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain); gain.connect(context.destination);
      trackSource(oscillator, [oscillator, gain]);
      oscillator.start(start); oscillator.stop(start + duration + 0.02);
    }

    function splash(duration, volume, cutoff) {
      var count = Math.max(1, Math.floor(context.sampleRate * duration));
      var buffer = context.createBuffer(1, count, context.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
      var source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
      gain.gain.setValueAtTime(volume, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      source.connect(filter); filter.connect(gain); gain.connect(context.destination);
      trackSource(source, [source, filter, gain]);
      source.start(); source.stop(context.currentTime + duration + 0.02);
    }

    function effect(type) {
      if (!settings().effects || !permitted() || !context || context.state !== 'running') return false;
      try {
        if (type === 'hit') {
          tone(180, 55, 0, 0.22, 0.14); tone(740, 350, 0, 0.1, 0.035, 'triangle'); splash(0.14, 0.11, 1100);
        } else if (type === 'miss') {
          splash(0.24, 0.09, 950); tone(220, 110, 0, 0.15, 0.035);
        } else if (type === 'sunk') {
          [220, 174.61, 130.81].forEach(function (note, i) { tone(note, note * 0.7, i * 0.13, 0.3, 0.07, 'triangle'); });
          splash(0.5, 0.1, 600);
        } else if (type === 'win') {
          [523.25, 659.25, 783.99, 1046.5].forEach(function (note, i) { tone(note, note, i * 0.12, 0.28, 0.065, 'triangle'); });
        } else if (type === 'loss') {
          [329.63, 293.66, 261.63].forEach(function (note, i) { tone(note, note, i * 0.17, 0.3, 0.055); });
        } else if (type === 'sonar') {
          tone(830, 700, 0, 0.24, 0.055); tone(830, 700, 0.2, 0.3, 0.03);
        } else return false;
        return true;
      } catch (_) { return false; }
    }

    return Object.freeze({ unlock: unlock, speak: speak, stop: stop, effect: effect });
  }

  return Object.freeze({ create: create });
});
