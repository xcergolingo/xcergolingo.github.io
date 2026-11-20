'use strict';
(() => {
  const FALLBACK_URL = 'https://apps.apple.com/us/app/learn-lingo-with-golingo-ai/id1194977025';
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
  const cards = [...document.querySelectorAll('.game-card')];
  const cardById = new Map(cards.filter(card => card.id).map(card => [card.id, card]));
  const grid = document.querySelector('.game-grid');
  const sortControl = document.getElementById('game-sort');
  const searchControl = document.getElementById('game-search');
  const clearSearch = document.getElementById('search-clear');
  const tagSearch=document.getElementById('tag-search');
  const tagEmpty=document.getElementById('tag-empty');
  const selectedCount=document.getElementById('tag-selected-count');
  const favoritesToggle = document.getElementById('favorites-toggle');
  const filterChips = [...document.querySelectorAll('[data-filter]')];
  const originalOrder = new Map(cards.map((card, i) => [card, i]));
  const cardNames = new Map(cards.map(card => [card, card.querySelector('h3')?.textContent?.trim() || card.id]));
  const sortModes = new Set(['default', 'plays', 'recent', 'likes', 'name']);
  const categories = new Set(filterChips.map(chip => chip.dataset.filter));

  // Device-local collections, never a claim about all visitors' activity.
  // Keep the original likes key so existing reactions are preserved.
  const likesKey = 'golingo:liked-games:v1';
  const favoritesKey = 'golingo:favorite-games:v1';
  const playsKey = 'golingo:game-plays:v1';
  const viewKey = 'golingo:gallery-view:v1';
  let localAvailable = true, sessionAvailable = true;

  function objectFromJSON(raw) {
    try {
      const value = JSON.parse(raw || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }
  function readLocal(key) {
    try { return objectFromJSON(localStorage.getItem(key)); }
    catch { localAvailable = false; return null; }
  }
  function booleanCollection(value) {
    const safe = Object.create(null);
    for (const id of cardById.keys()) {
      if (value && Object.prototype.hasOwnProperty.call(value, id) && value[id] === true) safe[id] = true;
    }
    return safe;
  }
  function playCollection(value) {
    const safe = Object.create(null);
    for (const id of cardById.keys()) {
      if (!value || !Object.prototype.hasOwnProperty.call(value, id)) continue;
      const entry = value[id];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Number.isSafeInteger(entry.count) || entry.count < 1) continue;
      safe[id] = {
        count: entry.count,
        lastPlayed: Number.isSafeInteger(entry.lastPlayed) && entry.lastPlayed >= 0 ? entry.lastPlayed : 0
      };
    }
    return safe;
  }
  let liked = booleanCollection(readLocal(likesKey));
  let favorites = booleanCollection(readLocal(favoritesKey));
  let plays = playCollection(readLocal(playsKey));

  function updateStorageStatus() {
    const note = document.getElementById('hub-storage-status');
    if (!note) return;
    note.textContent = socialLoaded
      ? 'Play and like totals reflect activity recorded across GoLingo users. Favorites are private to the signed-in account. Historical device-only counts are not included.'
      : 'Loading shared play and like totals. Global counts require the game-social-schema.sql database setup; older device-only counts are not combined.';
  }
  function writeLocal(key, value) {
    if (localAvailable) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch { localAvailable = false; }
    }
    updateStorageStatus();
  }

  let view = { search: '', categories: [], favoritesOnly: false, sort: 'default' };
  try {
    const saved = objectFromJSON(sessionStorage.getItem(viewKey));
    view = {
      search: typeof saved.search === 'string' ? saved.search.slice(0, 200) : '',
      categories: Array.isArray(saved.categories)
        ? [...new Set(saved.categories.filter(tag => categories.has(tag) && tag !== 'all'))]
        : (categories.has(saved.category) && saved.category !== 'all' ? [saved.category] : []),
      favoritesOnly: saved.favoritesOnly === true,
      sort: sortModes.has(saved.sort) ? saved.sort : 'default'
    };
  } catch { sessionAvailable = false; }
  function rememberView() {
    if (sessionAvailable) {
      try { sessionStorage.setItem(viewKey, JSON.stringify(view)); }
      catch { sessionAvailable = false; }
    }
    updateStorageStatus();
  }

  // Index original game content, not changing like/count/button text.
  function normalizeSearch(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-–—]/g, ' ');
  }
  const searchIndex = new Map(cards.map(card => [card, normalizeSearch([
    cardNames.get(card), card.querySelector('.game-copy > p')?.textContent || '',
    [...card.querySelectorAll('.tags span')].map(tag => tag.textContent).join(' '), card.dataset.tags || ''
  ].join(' '))]));
  // Public cloud counts and private Cognito account reactions are supplied by social.js.
  let socialLoaded = false, socialSignedIn = false;
  let socialTotals = Object.create(null);
  const playCount = card => socialLoaded ? (socialTotals[card.id]?.plays || 0) : (plays[card.id]?.count || 0);
  const likeCount = card => socialLoaded ? (socialTotals[card.id]?.likes || 0) : Number(!!liked[card.id]);
  window.GoLingoGallerySetSocial = ({totals,likes,accountFavorites,signedIn}) => {
    socialLoaded = true;
    socialSignedIn = !!signedIn;
    socialTotals = totals || Object.create(null);
    liked = booleanCollection(likes || {});
    favorites = booleanCollection(accountFavorites || {});
    cards.forEach(card => {renderLike(card);renderFavorite(card);renderPlays(card);});
    updateStorageStatus();applyView();
  };


  function renderLike(card) {
    const button = card.querySelector('.game-like');
    if (!button) return;
    const isLiked = !!liked[card.id];
    button.setAttribute('aria-pressed', String(isLiked));
    button.setAttribute('aria-label', (isLiked ? 'Unlike ' : 'Like ') + cardNames.get(card));
    button.innerHTML = (isLiked ? '👍 Liked' : '👍 Like') + ' <span aria-hidden="true">' + (socialLoaded ? likeCount(card).toLocaleString() : '—') + '</span>';
    button.title = socialLoaded ? (socialSignedIn ? 'Total likes from GoLingo accounts' : 'Sign in with GoLingo to like this game') : 'Loading shared likes';

  }
  function renderFavorite(card) {
    const button = card.querySelector('.game-favorite');
    if (!button) return;
    const saved = !!favorites[card.id];
    button.setAttribute('aria-pressed', String(saved));
    button.setAttribute('aria-label', (saved ? 'Remove ' : 'Add ') + cardNames.get(card) + (saved ? ' from favorites' : ' to favorites'));
    button.innerHTML = '<span class="favorite-icon" aria-hidden="true">' + (saved ? '♥' : '♡') + '</span> ' + (saved ? 'Favorited' : 'Favorite');
    button.title = socialSignedIn ? 'Saved to your GoLingo account' : 'Download GoLingo for iPhone to favorite games and save or publish your lessons';

  }
  function renderPlays(card) {
    const label = card.querySelector('.game-plays');
    if (!label) return;
    const count = playCount(card);
    label.textContent = socialLoaded
      ? count.toLocaleString() + (count === 1 ? ' global play' : ' global plays')
      : 'Loading global plays…';
    label.title = socialLoaded ? 'Total recorded gallery launches across devices (not completed sessions)' : 'Loading worldwide recorded launches';
    label.setAttribute('aria-label', (socialLoaded ? count.toLocaleString() : 'Loading') + ' recorded launches of ' + cardNames.get(card) + ' across GoLingo users');
  }
  function sortGames() {
    const sorted = cards.slice().sort((a, b) => {
      let difference = 0;
      if (view.sort === 'plays') difference = playCount(b) - playCount(a);
      else if (view.sort === 'recent') difference = (plays[b.id]?.lastPlayed || 0) - (plays[a.id]?.lastPlayed || 0);
      else if (view.sort === 'likes') difference = likeCount(b) - likeCount(a);
      else if (view.sort === 'name') difference = cardNames.get(a).localeCompare(cardNames.get(b));
      return difference || originalOrder.get(a) - originalOrder.get(b);
    });
    // Avoid detaching every card on each keystroke, preserving keyboard focus.
    const focused = document.activeElement;
    sorted.forEach((card, index) => {
      if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] || null);
    });
    if (focused?.closest?.('.game-card') && !focused.closest('.game-card').hidden && document.activeElement !== focused) {
      focused.focus({ preventScroll: true });
    }
  }

  function applyView() {
    const focusedCard = document.activeElement?.closest?.('.game-card');
    const tokens = normalizeSearch(view.search).trim().split(/\s+/).filter(Boolean);
    let count = 0;
    cards.forEach(card => {
      const cardTags=(card.dataset.tags || '').split(/\s+/);
      const categoryMatch = view.categories.length===0 || view.categories.some(tag=>cardTags.includes(tag));
      const show = categoryMatch && (!view.favoritesOnly || !!favorites[card.id]) && tokens.every(token => searchIndex.get(card).includes(token));
      card.hidden = !show;
      if (show) count++;
    });
    filterChips.forEach(chip => {
      const on = chip.dataset.filter === 'all' ? view.categories.length===0 : view.categories.includes(chip.dataset.filter);
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
    if(selectedCount) selectedCount.textContent=view.categories.length
      ? view.categories.length+' tag'+(view.categories.length===1?'':'s')+' selected'
      : 'All tags';
    if (searchControl && searchControl.value !== view.search) searchControl.value = view.search;
    if (clearSearch) clearSearch.hidden = !view.search;
    if (sortControl) sortControl.value = view.sort;
    const favoriteCount = Object.keys(favorites).length;
    const countLabel = document.getElementById('favorites-count');
    if (countLabel) countLabel.textContent = String(favoriteCount);
    if (favoritesToggle) {
      favoritesToggle.classList.toggle('active', view.favoritesOnly);
      favoritesToggle.setAttribute('aria-pressed', String(view.favoritesOnly));
      favoritesToggle.setAttribute('aria-label', (view.favoritesOnly ? 'Turn off' : 'Turn on') + ' favorites filter, ' + favoriteCount + ' saved');
    }
    document.getElementById('hub-count').textContent = count === cards.length
      ? count + (count === 1 ? ' game' : ' games')
      : count + ' of ' + cards.length + ' games';
    const empty = document.getElementById('hub-empty');
    if (empty) {
      empty.hidden = count !== 0;
      const noFavorites = view.favoritesOnly && favoriteCount === 0;
      const heading = document.getElementById('hub-empty-title');
      const description = document.getElementById('hub-empty-description');
      if (heading) heading.textContent = noFavorites ? 'No favorites yet' : 'No games found';
      if (description) description.textContent = noFavorites
        ? 'Tap the heart on a game to save it here. Reset filters to explore the collection.'
        : 'Try another search, choose All games, or turn off the Favorites filter.';
    }
    sortGames();
    if (focusedCard?.hidden) favoritesToggle?.focus({ preventScroll: true });
  }

  cards.forEach(card => {
    if (!card.id) return;
    const copy = card.querySelector('.game-copy');
    const tags = copy?.querySelector('.tags');
    const actions = document.createElement('div');
    actions.className = 'game-actions';
    const likeButton = document.createElement('button');
    likeButton.type = 'button';
    likeButton.className = 'game-like';
    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'game-favorite';
    const playLabel = document.createElement('span');
    playLabel.className = 'game-plays';
    actions.append(likeButton, favoriteButton, playLabel);
    if (tags) tags.insertAdjacentElement('afterend', actions);
    else copy?.appendChild(actions);
    likeButton.addEventListener('click', () => window.GoLingoSocial?.toggleLike(card.id));
    favoriteButton.addEventListener('click', () => window.GoLingoSocial?.toggleFavorite(card.id));
    renderLike(card);
    renderFavorite(card);
    renderPlays(card);
  });

  function changeView(update) {
    Object.assign(view, update);
    rememberView();
    applyView();
  }
  filterChips.forEach(chip => chip.addEventListener('click', () => {
    const tag=chip.dataset.filter;
    if(tag==='all'){changeView({categories:[]});return}
    const selected=new Set(view.categories);
    if(selected.has(tag))selected.delete(tag);else selected.add(tag);
    changeView({categories:[...selected]});
  }));
  function updateTagSearch(){
    const query=normalizeSearch(tagSearch?.value||'').trim();
    let matches=0;
    for(const chip of filterChips){
      const visible=chip.dataset.filter==='all' || normalizeSearch(chip.textContent||'').includes(query);
      chip.hidden=!visible;
      if(visible && chip.dataset.filter!=='all')matches++;
    }
    if(tagEmpty)tagEmpty.hidden=matches>0;
  }
  tagSearch?.addEventListener('input',updateTagSearch);
  tagSearch?.addEventListener('search',updateTagSearch);
  updateTagSearch();
  sortControl?.addEventListener('change', () => changeView({ sort: sortModes.has(sortControl.value) ? sortControl.value : 'default' }));
  searchControl?.addEventListener('input', () => changeView({ search: searchControl.value.slice(0, 200) }));
  searchControl?.addEventListener('search', () => changeView({ search: searchControl.value.slice(0, 200) }));
  searchControl?.addEventListener('keydown', event => {
    if (event.key === 'Escape' && view.search) {
      event.preventDefault();
      changeView({ search: '' });
    }
  });
  clearSearch?.addEventListener('click', () => {
    changeView({ search: '' });
    searchControl?.focus();
  });
  favoritesToggle?.addEventListener('click', () => changeView({ favoritesOnly: !view.favoritesOnly }));
  document.getElementById('filters-reset')?.addEventListener('click', () => {
    changeView({ search: '', categories: [], favoritesOnly: false });
    if(tagSearch){tagSearch.value='';updateTagSearch()}
    searchControl?.focus();
  });

  // Launch counters measure gallery link activations, not game completion,
  // preview views, or App Store downloads. Rapid double taps count once.
  const recentLaunches = new Map();
  function recordLaunch(card) {
    const now = Date.now();
    const previous = recentLaunches.get(card.id);
    if (previous !== undefined && now >= previous && now - previous < 1500) return;
    recentLaunches.set(card.id, now);
    if (localAvailable) plays = playCollection(readLocal(playsKey) || plays);
    plays[card.id] = { count: Math.min(Number.MAX_SAFE_INTEGER, playCount(card) + 1), lastPlayed: now };
    writeLocal(playsKey, plays);
    renderPlays(card);
    // Queue gallery launches before following the game link, so navigation
    // cannot silently cancel the public counter request.
    try {
      const key = 'golingo:pending-game-launches:v1';
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(queue)) {
        queue.push(card.id);
        localStorage.setItem(key, JSON.stringify(queue.slice(-80)));
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('golingo:game-launch',{detail:{gameId:card.id}}));
    // Sorting here could move a touched link before the browser navigates.
    // pageshow refreshes the order on return, including the back/forward cache.
  }

  // Per-game lesson history is private to this browser/device.
  // Identical content (regardless of object key order) uses one history entry.
  const historyPrefix = 'golingo:game-lesson-history:v1:';
  const historyLimit = 20;
  const lessonFields = ['words', 'sentences', 'phrases', 'items', 'entries'];
  function canonicalLesson(value) {
    if (Array.isArray(value)) return '[' + value.map(canonicalLesson).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + canonicalLesson(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }
  function lessonHistoryLabel(lesson) {
    const lang = String(lesson.learningLanguage || lesson.language || lesson.targetLanguage || 'Language').slice(0, 30);
    const entries = lessonFields.flatMap(key => Array.isArray(lesson[key]) ? lesson[key] : []);
    const terms = entries.map(entry => {
      if (typeof entry === 'string') return entry;
      if (!entry || typeof entry !== 'object') return '';
      return entry.word || entry.text || entry.phrase || entry.sentence || '';
    }).filter(Boolean).slice(0, 3).map(term => String(term).replace(/\s+/g, ' ').trim().slice(0, 32));
    return lang + (terms.length ? ' · ' + terms.join(' · ') : '');
  }
  // Per-account lesson history. Anonymous and legacy histories remain separate.
  let lessonHistoryOwner = null;
  function historyStorageKey(gameId) {
    return historyPrefix + gameId + (lessonHistoryOwner ? ':cognito:' + lessonHistoryOwner : '');
  }
  window.GoLingoSetLessonHistoryOwner = (ownerId) => {
    const next = typeof ownerId === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(ownerId) ? ownerId : null;
    if (lessonHistoryOwner !== next) {
      lessonHistoryOwner = next;
      // Avoid carrying another account's currently loaded lesson across logins.
      activeLesson = null;
      try { sessionStorage.removeItem(lessonKey); } catch {}
      lessonInput.value = '';
      lessonStatus.textContent = 'No lesson loaded';
    }
    cards.forEach(card => renderGameHistory(card.id));
  };
  function readGameHistory(id) {
    try {
      const items = JSON.parse(localStorage.getItem(historyStorageKey(id)) || '[]');
      return Array.isArray(items) ? items.filter(item =>
        item && typeof item === 'object' && typeof item.fingerprint === 'string' &&
        item.lesson && typeof item.lesson === 'object' && !Array.isArray(item.lesson)
      ).slice(0, historyLimit) : [];
    } catch { return []; }
  }
  function writeGameHistory(id, items) {
    try {
      localStorage.setItem(historyStorageKey(id), JSON.stringify(items.slice(0, historyLimit)));
      return true;
    } catch { return false; }
  }
  function rememberGameLesson(id, lesson) {
    if (!id || !lesson) return;
    const fingerprint = canonicalLesson(lesson);
    const history = readGameHistory(id);
    const found = history.find(item => item.fingerprint === fingerprint);
    const entry = found || { fingerprint, lesson, label: lessonHistoryLabel(lesson), lastPlayed: 0 };
    entry.lastPlayed = Date.now();
    const next = [entry, ...history.filter(item => item.fingerprint !== fingerprint)].slice(0, historyLimit);
    if (!writeGameHistory(id, next)) {
      const note = document.getElementById('history-storage-warning');
      if (note) note.hidden = false;
      return;
    }
    renderGameHistory(id);
    window.dispatchEvent(new CustomEvent('golingo:game-lesson-played',{detail:{gameId:id,lesson}}));
  }
  function renderGameHistory(id) {
    const card = cardById.get(id);
    const panel = card?.querySelector('.game-history');
    if (!panel) return;
    const items = readGameHistory(id);
    panel.hidden = items.length === 0;
    const list = panel.querySelector('.game-history-list');
    list.replaceChildren();
    for (const item of items) {
      const row = document.createElement('li');
      row.className = 'game-history-entry';
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'game-history-play';
      play.textContent = item.label || lessonHistoryLabel(item.lesson);
      play.title = 'Load and play this lesson again';
      play.addEventListener('click', () => {
        try {
          saveLesson(JSON.stringify(item.lesson));
          // Open the same game using its own established transfer format.
          const link = card.querySelector('.demo-link');
          if (link) link.click();
        } catch (error) {
          lessonStatus.textContent = 'Cannot replay: ' + error.message;
        }
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'game-history-remove';
      remove.setAttribute('aria-label', 'Remove saved lesson ' + (item.label || lessonHistoryLabel(item.lesson)));
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        const next = readGameHistory(id).filter(saved => saved.fingerprint !== item.fingerprint);
        if (writeGameHistory(id, next)) renderGameHistory(id);
      });
      if (window.GoLingoCloud?.isSignedIn()) {
        const state = window.GoLingoCloud.publicationStatus(id, item.lesson);
        const label = item.label || lessonHistoryLabel(item.lesson);
        if (state === true) {
          const published = document.createElement('span');
          published.className = 'game-history-published';
          published.textContent = '✓ Published';
          published.setAttribute('aria-label', label + ' is published to the community');
          const unpublish = document.createElement('button');
          unpublish.type = 'button';
          unpublish.className = 'game-history-unpublish';
          unpublish.textContent = 'Unpublish';
          unpublish.setAttribute('aria-label', 'Unpublish ' + label);
          unpublish.addEventListener('click', () => window.GoLingoCloud.unpublish(id, item.lesson));
          row.append(published);
          const publishedId=window.GoLingoCloud.publicationId?.(id,item.lesson);
          if(publishedId){
            const share=document.createElement('button');
            share.type='button';
            share.className='game-history-unpublish game-history-share';
            share.textContent='Share';
            share.setAttribute('aria-label','Share a link to play '+label);
            share.addEventListener('click',()=>window.GoLingoCloud.shareLesson(publishedId,label,id));
            row.append(share);
          }
          row.append(unpublish);
        } else {
          const publish = document.createElement('button');
          publish.type = 'button'; publish.className = 'game-history-publish';
          publish.textContent = state === null ? 'Checking…' : 'Publish lesson';
          publish.disabled = state === null;
          publish.setAttribute('aria-label', 'Publish ' + label + ' publicly');
          publish.addEventListener('click', async () => {
          if(publish.disabled)return;
          publish.disabled=true;
          try{
            const published=await window.GoLingoCloud.publish(id,item.lesson);
            if(!publish.isConnected)return;
            if(published){
              publish.textContent='✓ Published';
              publish.classList.add('game-history-done');
              publish.setAttribute('aria-label',label+' is published');
            } else if(published === false) {
              publish.textContent='Retry Publish';
              let errorLabel=row.querySelector('.game-row-feedback');
              if(!errorLabel){
                errorLabel=document.createElement('small');
                errorLabel.className='game-row-feedback';
                errorLabel.setAttribute('role','alert');
                row.append(errorLabel);
              }
              errorLabel.textContent='Not published: '+(window.GoLingoCloudLastError||'Cloud request failed');
            } else {
              publish.textContent='Publish lesson';
            }
          }catch(error){
            publish.textContent='Retry Publish';
            const status=document.createElement('small');
            status.className='game-row-feedback';
            status.textContent='Could not publish: '+(error?.message||'Please retry');
            row.append(status);
          }finally{if(publish.isConnected)publish.disabled=false}
        });
          row.append(publish);
        }
      }
      row.append(play, remove);
      list.append(row);
    }
  }
  cards.forEach(card => {
    if (!card.id) return;
    const copy = card.querySelector('.game-copy');
    if (!copy) return;
    const panel = document.createElement('details');
    panel.className = 'game-history';
    panel.hidden = true;
    const heading = document.createElement('summary');
    heading.textContent = 'Played lessons · load & replay';
    const list = document.createElement('ul');
    list.className = 'game-history-list';
    panel.append(heading, list);
    copy.append(panel);
    renderGameHistory(card.id);
  });
  const storageWarning = document.createElement('p');
  storageWarning.id = 'history-storage-warning';
  storageWarning.className = 'hub-storage-note';
  storageWarning.textContent = 'Lesson history could not be saved. This browser may have blocked storage or run out of space.';
  storageWarning.hidden = true;
  document.querySelector('.hub-tools')?.append(storageWarning);

  function launchGame(event) {
    if (event.defaultPrevented || (event.type === 'auxclick' ? event.button !== 1 : event.button !== 0)) return;
    const link = event.currentTarget;
    const card = cardById.get(link.dataset.gameId || link.closest('.game-card')?.id);
    if (!card) return;
    const url = new URL(link.href);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const transferKey = ['data', 'golingo'].includes(link.dataset.lessonKey) ? link.dataset.lessonKey : 'golingoLesson';
    if (activeLesson) url.hash = transferKey + '=' + encodeURIComponent(JSON.stringify(launchLessonPayload(activeLesson, link.dataset.lessonFormat)));
    else if (url.hash.startsWith('#' + transferKey + '=')) url.hash = '';
    link.href = url.toString();
    link.target = '_self'; // WKWebView: keep the normal launch in this WebView.
    if (activeLesson) rememberGameLesson(card.id, activeLesson);
    recordLaunch(card);
    // A game launch recorded on the Supabase server is one day of streak credit.
    // Wait briefly for confirmation before navigation. Unauthenticated and
    // unsupported browsers retain their normal immediate navigation path.
    if (window.GoLingoStreak?.canTrack?.() &&
        !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const destination=url.toString();
      let finished=false;
      const continueToGame=()=>{
        if(finished)return;
        finished=true;
        window.location.assign(destination);
      };
      const fallback=setTimeout(continueToGame,2200);
      Promise.resolve(window.GoLingoStreak.recordLaunch(card.id)).catch(()=>{})
        .finally(()=>{clearTimeout(fallback);continueToGame()});
    }
    // Leave navigation to the native link when not tracking a signed-in launch.
  }
  document.querySelectorAll('.game-card .demo-link, .game-card a.game-cover, #dialog-demo').forEach(link => {
    link.addEventListener('click', launchGame);
    link.addEventListener('auxclick', launchGame);
  });
  window.GoLingoGalleryRefreshHistory = () => cards.forEach(card => renderGameHistory(card.id));
  window.GoLingoPlaySavedLesson = (gameId, lesson) => {
    const card = cardById.get(gameId);
    if (!card || !lesson) return false;
    saveLesson(JSON.stringify(lesson));
    const link = card.querySelector('.demo-link');
    if (!link) return false;
    link.click();
    return true;
  };
  function refreshCollections() {
    // If a write failed, retain this page's in-memory changes rather than
    // replacing them with an older persisted copy.
    if (localAvailable) {
      if (!socialLoaded) {
        liked = booleanCollection(readLocal(likesKey) || liked);
        favorites = booleanCollection(readLocal(favoritesKey) || favorites);
      }
      plays = playCollection(readLocal(playsKey) || plays);
    }
    cards.forEach(card => { renderLike(card); renderFavorite(card); renderPlays(card); renderGameHistory(card.id); });
    updateStorageStatus();
    applyView();
  }
  window.addEventListener('pageshow', refreshCollections);
  window.addEventListener('storage', event => {
    if (event.key === null || [likesKey, favoritesKey, playsKey].includes(event.key)) refreshCollections();
  });
  updateStorageStatus();
  applyView();

  const dialog = document.getElementById('preview-dialog');
  const video = document.getElementById('preview-video');
  const hero = document.getElementById('hero-video');
  const motionButton = document.getElementById('motion-toggle');
  const heroFallback=document.getElementById('hero-fallback');
  const carousel=document.getElementById('hero-carousel');
  const heroLink=document.getElementById('hero-game-link');
  const heroMediaType=document.getElementById('hero-media-type');
  const heroTitle=document.getElementById('hero-slide-title');
  const heroSubtitle=document.getElementById('hero-slide-subtitle');
  const heroPosition=document.getElementById('hero-position');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData=!!navigator.connection?.saveData;
  // Only three game demo clips are available today. Other games show their
  // actual cover artwork with gentle pan/zoom (not fabricated gameplay video).
  const clipFiles={
    'lagoon':'media/lagoon.mp4',
    'word-folio':'media/word-folio.mp4',
    'super-flying-man':'media/super-flying-man.mp4'
  };
  const slides=cards.filter(card=>card.querySelector('.demo-link') && card.querySelector('a.game-cover img')).map(card=>({
    id:card.id,
    title:cardNames.get(card)||card.id,
    poster:card.querySelector('a.game-cover img').getAttribute('src'),
    demo:card.querySelector('.demo-link'),
    clip:clipFiles[card.id]||null
  }));
  let slideIndex=0;
  let carouselPlaying=!reducedMotion.matches && !saveData;
  let heroInView=false;
  let carouselTimer=null;
  let touchStart=null;
  let returnFocus=null,dialogWasPlaying=false;
  function applyDownload(url) {
    try {
      const parsed=new URL(url);
      if(parsed.protocol!=='https:'||!['apps.apple.com','itunes.apple.com','www.golingoapp.com','golingoapp.com'].includes(parsed.hostname))return;
      document.querySelectorAll('.download-link').forEach(link=>{link.href=parsed.href});
      if(parsed.hostname==='apps.apple.com')document.getElementById('platform-note').textContent='Download on the App Store. Play inside GoLingo.';
    }catch{}
  }
  applyDownload(document.querySelector('.download-link')?.href||FALLBACK_URL);
  if(location.protocol!=='file:')fetch('media/app.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(data=>{
    if(data?.verified&&data.downloadUrl)applyDownload(data.downloadUrl);
  }).catch(()=>{});
  document.getElementById('year').textContent=String(new Date().getFullYear());
  function stopCarouselTimer(){
    if(carouselTimer!==null){clearInterval(carouselTimer);carouselTimer=null}
  }
  function updateMotionLabel(){
    motionButton.textContent=carouselPlaying?'Pause':'Play';
    motionButton.setAttribute('aria-label',carouselPlaying?'Pause carousel':'Play carousel');
  }
  function updateHeroPlayback(){
    const slide=slides[slideIndex];
    if(!slide)return;
    const shouldAnimate=carouselPlaying&&heroInView&&!document.hidden&&!dialog.open;
    carousel.classList.toggle('carousel-animated',shouldAnimate);
    if(slide.clip&&shouldAnimate){
      if(!hero.src||!hero.currentSrc)hero.src=slide.clip;
      hero.muted=true;
      hero.play().catch(()=>{heroFallback.hidden=false});
    }else hero.pause();
    stopCarouselTimer();
    if(shouldAnimate&&slides.length>1){
      carouselTimer=setInterval(()=>{
        if(document.hidden||dialog.open)return;
        showSlide(slideIndex+1);
      },6800);
    }
    updateMotionLabel();
  }
  function showSlide(index){
    if(!slides.length)return;
    slideIndex=(index%slides.length+slides.length)%slides.length;
    const item=slides[slideIndex];
    hero.pause();
    hero.removeAttribute('src');
    hero.load();
    hero.hidden=!item.clip;
    heroFallback.hidden=!!item.clip;
    heroFallback.src=item.poster;
    hero.poster=item.poster;
    hero.dataset.src=item.clip||'';
    // Preserve GoLingo lesson transfer parameters when launching the game.
    heroLink.href=item.demo.href;
    heroLink.dataset.gameId=item.id;
    for(const key of ['lessonKey','lessonFormat']){
      if(item.demo.dataset[key])heroLink.dataset[key]=item.demo.dataset[key];
      else delete heroLink.dataset[key];
    }
    heroLink.setAttribute('aria-label','Play '+item.title+' with GoLingo');
    heroTitle.textContent=item.title;
    heroSubtitle.textContent='Tap to play this language game';
    heroMediaType.textContent=item.clip?'GAMEPLAY VIDEO':'GAME COVER PREVIEW';
    heroPosition.textContent=(slideIndex+1)+' / '+slides.length;
    updateHeroPlayback();
  }
  document.getElementById('hero-prev').addEventListener('click',()=>showSlide(slideIndex-1));
  document.getElementById('hero-next').addEventListener('click',()=>showSlide(slideIndex+1));
  motionButton.addEventListener('click',()=>{carouselPlaying=!carouselPlaying;updateHeroPlayback()});
  // Hero is a normal in-gallery game link and uses the same launch handler as
  // a gallery card, so lesson data and launch counting remain intact.
  heroLink.addEventListener('click',launchGame);
  carousel.addEventListener('touchstart',e=>{
    if(e.touches.length!==1)return;
    touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true});
  carousel.addEventListener('touchend',e=>{
    if(!touchStart||e.changedTouches.length!==1)return;
    const dx=e.changedTouches[0].clientX-touchStart.x;
    const dy=e.changedTouches[0].clientY-touchStart.y;
    touchStart=null;
    if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){
      e.preventDefault();
      showSlide(slideIndex+(dx<0?1:-1));
    }
  },{passive:false});
  carousel.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'){e.preventDefault();showSlide(slideIndex-1)}
    if(e.key==='ArrowRight'){e.preventDefault();showSlide(slideIndex+1)}
  });
  hero.addEventListener('error',()=>{
    hero.hidden=true;
    heroFallback.hidden=false;
    heroMediaType.textContent='GAME COVER PREVIEW';
  });
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{
    heroInView=entries[0].isIntersecting;
    updateHeroPlayback();
  },{threshold:.12}).observe(carousel);
  else heroInView=true;
  reducedMotion.addEventListener?.('change',e=>{
    if(e.matches)carouselPlaying=false;
    updateHeroPlayback();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){dialogWasPlaying=!video.paused;video.pause()}
    else if(dialog.open&&dialogWasPlaying)video.play().catch(()=>{});
    updateHeroPlayback();
  });
  showSlide(0);
  function openPreview(id, trigger) {
    const game = games[id]; if (!game) return;
    returnFocus = trigger; hero.pause(); stopCarouselTimer();
    document.getElementById('preview-title').textContent = game.name;
    document.getElementById('preview-description').textContent = game.description;
    document.getElementById('dialog-demo').href = game.demo;
    document.getElementById('dialog-demo').target = '_self';
    const demoLink = document.getElementById('dialog-demo');
    demoLink.dataset.gameId = id;
    const cardLink = cardById.get(id)?.querySelector('.demo-link');
    for (const key of ['lessonKey', 'lessonFormat']) {
      if (cardLink?.dataset[key]) demoLink.dataset[key] = cardLink.dataset[key];
      else delete demoLink.dataset[key];
    }
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
    returnFocus?.focus({ preventScroll: true }); updateHeroPlayback();
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



