'use strict';
(() => {
  const FALLBACK_URL = 'https://apps.apple.com/app/id1194977025';
  const games = {
    lagoon: { name: 'Lagoon', description: 'Explore a tropical world, discover vocabulary, and collect words for review.', demo: 'https://xcergolingo.github.io/far-cry-lagoon/' },
    'word-folio': { name: 'Word Folio', description: 'Open your pop-up word book. Hear a word, reveal its meaning, and turn the page.', demo: 'https://xcergolingo.github.io/word-folio/' },
    'super-flying-man': { name: 'Super Flying Man', description: 'Fly through word circles and revisit what you learn in your flight basket.', demo: 'https://xcergolingo.github.io/super-flying-man/' }
  };
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
