'use strict';
(() => {
  const FALLBACK_URL = 'https://apps.apple.com/app/id1194977025';
  const games = {
    lagoon: { name: 'Lagoon', description: 'Explore a tropical world, discover vocabulary, and collect words for review.', demo: 'https://xcergolingo.github.io/far-cry-lagoon/' },
    'word-folio': { name: 'Word Folio', description: 'Open your pop-up word book. Hear a word, reveal its meaning, and turn the page.', demo: 'https://xcergolingo.github.io/word-folio/' },
    'super-flying-man': { name: 'Super Flying Man', description: 'Fly through word circles and revisit what you learn in your flight basket.', demo: 'https://xcergolingo.github.io/super-flying-man/' }
  };

  // Shared lesson hub. Session storage is tab-scoped; nothing is uploaded.
  const lessonInput = document.getElementById('lesson-input');
  const lessonStatus = document.getElementById('lesson-status');
  const lessonKey = 'golingo:active-lesson:v1';
  let activeLesson = null;
  function validateLesson(raw) {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Use a JSON object.');
    const count = ['words', 'sentences', 'phrases', 'items', 'entries'].reduce((total, key) => total + (Array.isArray(value[key]) ? value[key].length : 0), 0);
    if (count === 0) throw Error('Include a nonempty words, sentences, phrases, items or entries array.');
    if (count > 500) throw Error('Limit a lesson to 500 entries.');
    if (raw.length > 100000) throw Error('Lesson is too large.');
    return value;
  }
  function saveLesson(raw) {
    const parsed = validateLesson(raw);
    sessionStorage.setItem(lessonKey, JSON.stringify(parsed));
    activeLesson = parsed;
    lessonInput.value = JSON.stringify(parsed, null, 2);
    const count = ['words', 'sentences', 'phrases', 'items', 'entries'].reduce((total, key) => total + (Array.isArray(parsed[key]) ? parsed[key].length : 0), 0);
    lessonStatus.textContent = 'Lesson saved · ' + count + (count === 1 ? ' item' : ' items');
  }
  try {
    const params = new URLSearchParams(location.search);
    const incoming = params.get('lesson');
    if (incoming) {
      saveLesson(incoming);
      history.replaceState(null, '', location.pathname + location.hash);
    } else {
      const saved = sessionStorage.getItem(lessonKey);
      if (saved) saveLesson(saved);
    }
  } catch (error) { lessonStatus.textContent = 'Lesson error: ' + error.message; }
  document.getElementById('lesson-save').addEventListener('click', () => {
    try { saveLesson(lessonInput.value); } catch (error) { lessonStatus.textContent = error.message; }
  });
  document.getElementById('lesson-clear').addEventListener('click', () => {
    sessionStorage.removeItem(lessonKey); activeLesson = null; lessonInput.value = '';
    lessonStatus.textContent = 'No lesson loaded';
  });
  // Some games use a words-only schema; adapt only cards that opt in.
  function launchLessonPayload(lesson, format) {
    if (format !== 'word-pack') return lesson;
    const words = ['words', 'sentences', 'phrases', 'items', 'entries'].flatMap(key =>
      (Array.isArray(lesson[key]) ? lesson[key] : []).map((entry, i) => {
        if (typeof entry === 'string') return {id: key + '-' + i, word: entry, translation: '', sentence: key === 'sentences' ? entry : ''};
        if (!entry || typeof entry !== 'object') return null;
        const word = entry.word ?? entry.text ?? entry.sentence ?? entry.phrase ?? '';
        return {...entry, id: entry.id ?? key + '-' + i, word,
          translation: entry.translation ?? entry.meaning ?? entry.sentenceTranslation ?? entry.phraseTranslation ?? '',
          sentence: entry.sentence ?? (key === 'sentences' ? word : '')};
      }).filter(entry => entry && typeof entry.word === 'string' && entry.word.trim())
    );
    return {...lesson, primaryLanguage: lesson.primaryLanguage || lesson.translationLanguage || 'en', words};
  }
  // Send the payload only on explicit launch. A URL hash is not sent to servers.
  document.querySelectorAll('.game-card .demo-link, .game-card a.game-cover').forEach(link => {
    link.addEventListener('click', () => {
      const url = new URL(link.href);
      const lessonKey = link.dataset.lessonKey === 'data' ? 'data' : 'golingoLesson';
      if (activeLesson) url.hash = lessonKey + '=' + encodeURIComponent(JSON.stringify(launchLessonPayload(activeLesson, link.dataset.lessonFormat)));
      else if (url.hash.startsWith('#' + lessonKey + '=')) url.hash = '';
      link.href = url.toString();
      link.target = '_self'; // WKWebView: reuse the existing page, never create an unhandled new tab.
    });
  });
  const cards = [...document.querySelectorAll('.game-card')];
  document.getElementById('hub-count').textContent = cards.length + ' games';
  // Browser-local reactions. No server-wide vote count is implied.
  const likesKey = 'golingo:liked-games:v1';
  let liked = {};
  try { liked = JSON.parse(localStorage.getItem(likesKey) || '{}') || {}; } catch { liked = {}; }
  const grid = document.querySelector('.game-grid');
  const sortControl = document.getElementById('game-sort');
  const originalOrder = new Map(cards.map((card, i) => [card, i]));
  function renderLike(card) {
    const button = card.querySelector('.game-like');
    const isLiked = !!liked[card.id];
    button.setAttribute('aria-pressed', String(isLiked));
    button.setAttribute('aria-label', (isLiked ? 'Unlike ' : 'Like ') + (card.querySelector('h3')?.textContent || card.id));
    button.innerHTML = (isLiked ? '👍 Liked' : '👍 Like') + ' <span aria-hidden="true">' + (isLiked ? '1' : '0') + '</span>';
  }
  function sortGames() {
    const mode = sortControl?.value || 'default';
    const sorted = cards.slice().sort((a,b) => mode === 'likes'
      ? Number(!!liked[b.id]) - Number(!!liked[a.id]) || originalOrder.get(a)-originalOrder.get(b)
      : mode === 'name'
      ? (a.querySelector('h3')?.textContent || '').localeCompare(b.querySelector('h3')?.textContent || '')
      : originalOrder.get(a)-originalOrder.get(b));
    sorted.forEach(card => grid.appendChild(card));
  }
  cards.forEach(card => {
    if (!card.id) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'game-like';
    const copy = card.querySelector('.game-copy');
    const tags = copy?.querySelector('.tags');
    if (tags) tags.insertAdjacentElement('afterend', button);
    else copy?.appendChild(button);
    button.addEventListener('click', () => {
      if (liked[card.id]) delete liked[card.id]; else liked[card.id] = true;
      try { localStorage.setItem(likesKey, JSON.stringify(liked)); } catch {}
      renderLike(card);
      sortGames();
    });
    renderLike(card);
  });
  sortControl?.addEventListener('change', sortGames);

  document.querySelectorAll('[data-filter]').forEach(chip => chip.addEventListener('click', () => {
    const tag = chip.dataset.filter;
    let count = 0;
    cards.forEach(card => {
      const show = tag === 'all' || (card.dataset.tags || '').split(' ').includes(tag);
      card.hidden = !show; if (show) count++;
    });
    document.querySelectorAll('[data-filter]').forEach(other => {
      const on = other === chip; other.classList.toggle('active', on); other.setAttribute('aria-pressed', String(on));
    });
    document.getElementById('hub-count').textContent = count + (count === 1 ? ' game' : ' games');
  }));

  const dialog = document.getElementById('preview-dialog');
  const video = document.getElementById('preview-video');
  const hero = document.getElementById('hero-video');
  const motionButton = document.getElementById('motion-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = !!navigator.connection?.saveData;
  let heroAllowed = !reducedMotion.matches && !saveData;
  let heroInView = false, returnFocus = null, dialogWasPlaying = false;
  function applyDownload(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !['apps.apple.com', 'itunes.apple.com', 'www.golingoapp.com', 'golingoapp.com'].includes(parsed.hostname)) return;
      document.querySelectorAll('.download-link').forEach(link => { link.href = parsed.href; });
      if (parsed.hostname === 'apps.apple.com') document.getElementById('platform-note').textContent = 'Download on the App Store. Play inside GoLingo.';
    } catch { /* Static download links remain usable without metadata. */ }
  }
  applyDownload(document.querySelector('.download-link')?.href || FALLBACK_URL);
  if (location.protocol !== 'file:') fetch('media/app.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(data => {
    if (data?.verified && data.downloadUrl) applyDownload(data.downloadUrl);
  }).catch(() => {});
  document.getElementById('year').textContent = String(new Date().getFullYear());
  function syncMotionLabel() {
    motionButton.textContent = hero.paused ? 'Play preview' : 'Pause preview';
    motionButton.setAttribute('aria-label', hero.paused ? 'Play the decorative Lagoon preview' : 'Pause the decorative Lagoon preview');
  }
  function playHero() {
    if (!hero.src) hero.src = hero.dataset.src;
    hero.muted = true;
    hero.play().then(syncMotionLabel).catch(syncMotionLabel);
  }
  function syncHero() {
    if (heroAllowed && heroInView && !document.hidden && !dialog.open) playHero();
    else { hero.pause(); syncMotionLabel(); }
  }
  hero.addEventListener('play', syncMotionLabel);
  hero.addEventListener('pause', syncMotionLabel);
  hero.addEventListener('error', () => { motionButton.hidden = true; });
  motionButton.addEventListener('click', () => {
    heroAllowed = hero.paused;
    if (heroAllowed) playHero(); else { hero.pause(); syncMotionLabel(); }
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    heroInView = entries[0].isIntersecting; syncHero();
  }, { threshold: .15 }).observe(hero);
  reducedMotion.addEventListener?.('change', event => { heroAllowed = !event.matches && !saveData; syncHero(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { dialogWasPlaying = !video.paused; video.pause(); }
    else if (dialog.open && dialogWasPlaying) video.play().catch(() => {});
    syncHero();
  });
  function openPreview(id, trigger) {
    const game = games[id]; if (!game) return;
    returnFocus = trigger; hero.pause();
    document.getElementById('preview-title').textContent = game.name;
    document.getElementById('preview-description').textContent = game.description;
    document.getElementById('dialog-demo').href = game.demo;
    document.getElementById('dialog-demo').target = '_self';
    document.getElementById('video-error').hidden = true;
    video.poster = `media/${id}.jpg`; video.src = `media/${id}.mp4`;
    video.setAttribute('aria-label', `${game.name} silent gameplay preview`);
    video.muted = true;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    video.play().catch(() => { /* The native play control remains available on iOS. */ });
  }
  document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => openPreview(button.dataset.preview, button)));
  function cleanupPreview() {
    video.pause(); video.removeAttribute('src'); video.load();
    document.body.style.overflow = '';
    returnFocus?.focus({ preventScroll: true }); syncHero();
  }
  document.getElementById('close-preview').addEventListener('click', () => {
    if (typeof dialog.close === 'function') dialog.close(); else { dialog.removeAttribute('open'); cleanupPreview(); }
  });
  dialog.addEventListener('close', cleanupPreview);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const b = dialog.getBoundingClientRect();
    if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close();
  });
  video.addEventListener('error', () => { if (video.getAttribute('src')) document.getElementById('video-error').hidden = false; });
  document.querySelectorAll('img').forEach(image => image.addEventListener('error', () => image.classList.add('image-unavailable')));
})();



