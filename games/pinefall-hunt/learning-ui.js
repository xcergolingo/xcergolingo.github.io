import { LANGUAGES } from './learning.js';

const ICONS = {
  book: '<path d="M3 4h6a4 4 0 0 1 3 1.3A4 4 0 0 1 15 4h6v15h-6a4 4 0 0 0-3 1.3A4 4 0 0 0 9 19H3Z"/><path d="M12 5.3v15"/>',
  listen: '<path d="m11 5-5 4H3v6h3l5 4ZM15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>',
  basket: '<path d="M3 9h18l-2 11H5ZM7 9l5-6 5 6M9 13v4m6-4v4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
};
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const icon = (name) => {
  const holder = node('span', 'learning-icon');
  // Fixed application artwork only. Lesson text is always set with textContent.
  holder.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.book}</svg>`;
  return holder;
};
const button = (text, className, action, iconName) => {
  const element = node('button', className);
  element.type = 'button';
  if (iconName) element.append(icon(iconName));
  if (text) element.append(node('span', '', text));
  element.addEventListener('click', (event) => { event.stopPropagation(); action?.(event); });
  ['pointerdown', 'pointerup', 'pointercancel'].forEach(type => element.addEventListener(type, event => event.stopPropagation()));
  return element;
};
const languageName = code => LANGUAGES.find(language => language.code === code)?.name || code || 'Language';
const jsonText = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);

export class LearningUI {
  constructor(learning, { onOpen, onClose, onTrack } = {}) {
    this.learning = learning;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onTrack = onTrack;
    this.playing = false;
    this.mode = null;
    this.busy = false;
    this.lastReviewSignature = '';
    this.preferenceInputs = {};
    this.host = document.getElementById('game');
    if (!this.host) throw new Error('The game container is missing.');
    if (!document.querySelector('link[href*="learning.css"]')) {
      const stylesheet = node('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = new URL('./learning.css', import.meta.url).href;
      document.head.append(stylesheet);
    }
    this.host.classList.add('has-learning-ui');
    this.buildCard();
    this.buildEntrances();
    this.buildModal();
    this.handleKey = event => {
      if (!this.mode) return;
      // Keep letter keys and Space inside the lesson editor, away from game controls.
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
      if (event.key === 'Tab') {
        const focusable = [...this.dialog.querySelectorAll('button, a, input, textarea, select, [tabindex="0"]')]
          .filter(element => !element.disabled && !element.closest('[hidden]') && element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first) return;
        if (event.shiftKey && (document.activeElement === first || !this.dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !this.dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', this.handleKey, true);
    window.addEventListener('keyup', event => { if (this.mode) event.stopImmediatePropagation(); }, true);
    this.render();
  }

  buildCard() {
    this.cardWrap = node('section', 'learning-card-wrap');
    this.cardWrap.setAttribute('aria-label', 'Current learning word');
    this.cardWrap.hidden = true;
    this.card = node('div', 'learning-card');
    const head = node('div', 'learning-card-head');
    this.cardProgress = node('span', 'learning-card-progress');
    this.hideCard = button('Hide', 'learning-quiet-button', () => this.preference('showCard', false));
    this.hideCard.setAttribute('aria-label', 'Hide word card');
    head.append(this.cardProgress, this.hideCard);
    const content = node('div', 'learning-card-main');
    const words = node('div', 'learning-card-words');
    this.currentWord = node('strong', 'learning-current-word');
    this.currentTranslation = node('span', 'learning-current-translation');
    words.append(this.currentWord, this.currentTranslation);
    this.listen = button('', 'learning-listen-button', () => this.speak(), 'listen');
    this.listen.setAttribute('aria-label', 'Listen to current word');
    this.listen.title = 'Listen';
    content.append(words, this.listen);
    const foot = node('div', 'learning-card-foot');
    this.translationToggle = button('Translation', 'learning-text-toggle', () => this.preference('showTranslation', !this.learning.preferences.showTranslation));
    this.translationToggle.setAttribute('aria-pressed', 'true');
    foot.append(this.translationToggle);
    if (this.onTrack) foot.append(button('Find word', 'learning-quiet-button learning-track-button', () => this.onTrack(), 'arrow'));
    this.card.append(head, content, foot);
    this.showCard = button('Show word', 'learning-show-card', () => this.preference('showCard', true), 'eye');
    this.cardWrap.append(this.card, this.showCard);
    this.host.append(this.cardWrap);
  }

  buildEntrances() {
    const top = document.querySelector('.top-right');
    if (top) {
      top.classList.add('learning-top-right');
      const tools = node('div', 'learning-hud-tools');
      this.lessonButton = button('Lesson', 'learning-hud-button', () => this.openLesson(), 'book');
      this.reviewButton = button('Words', 'learning-hud-button', () => this.openReview(), 'basket');
      this.reviewButton.title = 'Collected words';
      this.reviewButton.setAttribute('aria-label', 'Review collected words');
      tools.append(this.lessonButton, this.reviewButton);
      top.append(tools);
    }
    const startRow = document.querySelector('.start-row');
    if (startRow) {
      const intro = button('', 'round-button learning-intro-button', () => this.openLesson(), 'book');
      intro.setAttribute('aria-label', 'Choose words and language');
      intro.title = 'Choose words and language';
      startRow.append(intro);
    }
    const pausePanel = document.querySelector('.pause-panel');
    if (pausePanel) {
      const actions = node('div', 'learning-pause-actions');
      actions.append(button('Change lesson', 'learning-secondary-button', () => this.openLesson(), 'book'));
      actions.append(button('Collected words', 'learning-secondary-button', () => this.openReview(), 'basket'));
      const settings = pausePanel.querySelector('#pause-settings');
      if (settings) settings.before(actions); else pausePanel.append(actions);
    }
  }

  buildModal() {
    this.overlay = node('section', 'learning-modal');
    this.overlay.hidden = true;
    this.dialog = node('div', 'learning-dialog');
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.dialog.setAttribute('aria-labelledby', 'learning-dialog-title');
    this.dialog.tabIndex = -1;
    const header = node('header', 'learning-dialog-header');
    const heading = node('div');
    heading.append(node('div', 'learning-eyebrow', 'GOLINGO · PINEFALL'));
    this.modalTitle = node('h2', 'learning-dialog-title');
    this.modalTitle.id = 'learning-dialog-title';
    this.modalSubtitle = node('p', 'learning-dialog-subtitle');
    heading.append(this.modalTitle, this.modalSubtitle);
    this.closeButton = button('', 'learning-close-button', () => this.close(), 'close');
    this.closeButton.setAttribute('aria-label', 'Close learning panel');
    header.append(heading, this.closeButton);
    this.body = node('div', 'learning-dialog-body');
    this.lessonPanel = this.buildLessonPanel();
    this.reviewPanel = this.buildReviewPanel();
    this.body.append(this.lessonPanel, this.reviewPanel);
    const footer = node('footer', 'learning-dialog-footer');
    const goLingo = node('a', '', 'GoLingo'); goLingo.href = 'https://www.golingoapp.com/';
    const games = node('a', '', 'Back to games ↗'); games.href = 'https://xcergolingo.github.io/games/';
    footer.append(goLingo, games);
    this.dialog.append(header, this.body, footer);
    this.overlay.append(this.dialog);
    ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'click'].forEach(type => {
      this.overlay.addEventListener(type, event => event.stopPropagation());
    });
    this.overlay.addEventListener('click', event => { if (event.target === this.overlay) this.close(); });
    this.host.append(this.overlay);
  }

  buildLessonPanel() {
    const panel = node('div', 'learning-lesson-panel');
    const languageSection = node('section', 'learning-section');
    const languageGrid = node('div', 'learning-language-grid');
    this.learningSelect = this.buildLanguageSelect('I’m learning', 'learning-language', languageGrid);
    this.primarySelect = this.buildLanguageSelect('Translations in', 'learning-primary', languageGrid);
    const metadataNote = node('p', 'learning-note', 'Language choices set pronunciation and labels. They don’t translate your own lesson.');
    const demoRow = node('div', 'learning-demo-row');
    this.lessonCount = node('span', 'learning-lesson-count');
    this.demoButton = button('Load nature demo', 'learning-secondary-button', () => this.loadDemo(), 'book');
    demoRow.append(this.lessonCount, this.demoButton);
    languageSection.append(languageGrid, metadataNote, demoRow);

    const importSection = node('section', 'learning-section');
    const importHeader = node('div', 'learning-section-heading');
    const importLabel = node('label', '', 'Bring your own words');
    importLabel.htmlFor = 'learning-import-text';
    const fileLabel = node('label', 'learning-file-label', 'Choose JSON / TXT');
    this.fileInput = node('input');
    this.fileInput.type = 'file';
    this.fileInput.accept = '.json,.txt,application/json,text/plain';
    this.fileInput.setAttribute('aria-label', 'Import a JSON or text lesson');
    this.fileInput.addEventListener('change', () => this.readFile());
    fileLabel.append(this.fileInput);
    importHeader.append(importLabel, fileLabel);
    this.importText = node('textarea', 'learning-import-text');
    this.importText.id = 'learning-import-text';
    this.importText.spellcheck = false;
    this.importText.rows = 4;
    this.importText.placeholder = 'Paste GoLingo lesson JSON, or one pair per line:\nhola = hello\nárbol = tree';
    this.importText.setAttribute('aria-describedby', 'learning-import-help');
    const importHelp = node('p', 'learning-note', 'Use word = translation for text lessons. JSON can also include example sentences and audio.');
    importHelp.id = 'learning-import-help';
    const applyRow = node('div', 'learning-apply-row');
    const appendLabel = node('label', 'learning-checkbox-inline');
    this.appendInput = node('input'); this.appendInput.type = 'checkbox';
    appendLabel.append(this.appendInput, node('span', '', 'Add to this lesson'));
    this.applyButton = button('Apply lesson', 'learning-primary-button', () => this.applyLesson(), 'arrow');
    applyRow.append(appendLabel, this.applyButton);
    this.importStatus = node('p', 'learning-status');
    this.importStatus.setAttribute('role', 'status');
    this.importStatus.setAttribute('aria-live', 'polite');
    importSection.append(importHeader, this.importText, importHelp, applyRow, this.importStatus);

    const preferences = node('section', 'learning-section learning-preferences');
    preferences.append(node('h3', '', 'Make the hunt yours'));
    const preferenceGrid = node('div', 'learning-preference-grid');
    [
      ['showCard', 'Word card', 'Keep the current word in view'],
      ['showTranslation', 'Translations', 'Show meanings with the words'],
      ['showLabels', 'Words over deer', 'Show word labels in the forest'],
      ['repeat', 'Repeat current word', 'Hear it again while you search'],
    ].forEach(([key, title, description]) => {
      const label = node('label', 'learning-preference');
      const copy = node('span'); copy.append(node('strong', '', title), node('small', '', description));
      const input = node('input'); input.type = 'checkbox';
      input.addEventListener('change', () => this.preference(key, input.checked));
      this.preferenceInputs[key] = input;
      label.append(copy, input); preferenceGrid.append(label);
    });
    preferences.append(preferenceGrid);
    panel.append(languageSection, importSection, preferences);
    return panel;
  }

  buildLanguageSelect(title, id, host) {
    const label = node('label', 'learning-language-field', title);
    const select = node('select'); select.id = id;
    LANGUAGES.forEach(language => {
      const option = node('option', '', language.name); option.value = language.code; select.append(option);
    });
    select.addEventListener('change', () => {
      try {
        this.learning.setLanguages(this.learningSelect.value, this.primarySelect.value);
        this.status(this.learning.isDefault ? 'Nature demo updated for your languages.' : 'Language labels updated. Your lesson text stays the same.');
        this.render();
      } catch (error) { this.status(error?.message || 'Could not change the languages.', true); }
    });
    label.append(select); host.append(label);
    return select;
  }

  buildReviewPanel() {
    const panel = node('div', 'learning-review-panel');
    const summary = node('div', 'learning-review-summary');
    const summaryCopy = node('div');
    this.reviewCount = node('strong');
    this.reviewSummary = node('span');
    summaryCopy.append(this.reviewCount, this.reviewSummary);
    this.clearButton = button('Clear collected', 'learning-quiet-button', () => {
      this.learning.clearBasket(); this.copyFallback.hidden = true; this.reviewStatus.textContent = 'Collected words cleared.'; this.lastReviewSignature = ''; this.render();
    });
    const summaryActions = node('div', 'learning-review-summary-actions');
    this.reviewTranslationToggle = button('Hide meanings', 'learning-quiet-button', () => this.preference('showTranslation', !this.learning.preferences.showTranslation));
    summaryActions.append(this.reviewTranslationToggle, this.clearButton);
    summary.append(summaryCopy, summaryActions);
    this.reviewList = node('div', 'learning-review-list');
    this.reviewList.setAttribute('aria-label', 'Collected vocabulary');
    const exportActions = node('div', 'learning-export-actions');
    this.exportSummary = node('p', 'learning-note learning-export-summary');
    this.exportButton = button('Export this language pair', 'learning-primary-button', () => this.downloadLesson(), 'arrow');
    this.copyButton = button('Copy this language pair', 'learning-secondary-button', () => this.copyLesson());
    exportActions.append(this.exportButton, this.copyButton);
    this.reviewStatus = node('p', 'learning-status');
    this.reviewStatus.setAttribute('role', 'status');
    this.copyFallback = node('div', 'learning-copy-fallback'); this.copyFallback.hidden = true;
    const copyLabel = node('label', 'learning-note', 'Select and copy your collected-word lesson:');
    this.copyText = node('textarea', 'learning-import-text'); this.copyText.rows = 5;
    this.copyText.id = 'learning-export-text'; this.copyText.readOnly = true;
    copyLabel.htmlFor = this.copyText.id;
    this.copyFallback.append(copyLabel, this.copyText);
    panel.append(summary, this.reviewList, this.exportSummary, exportActions, this.reviewStatus, this.copyFallback);
    return panel;
  }

  setPlaying(playing) {
    this.playing = Boolean(playing);
    this.render();
  }

  render() {
    const current = this.learning.current;
    const preferences = this.learning.preferences || {};
    const total = Number(this.learning.total) || this.learning.entries?.length || 0;
    const count = Number(this.learning.learnedCount) || 0;
    const basketCount = this.learning.basket?.length || 0;
    this.cardWrap.hidden = !this.playing || !!this.mode;
    this.card.hidden = preferences.showCard === false;
    this.showCard.hidden = preferences.showCard !== false;
    this.cardProgress.textContent = this.learning.complete ? `LESSON COMPLETE · ${count}/${total}` : `FIND THIS WORD · ${count}/${total}`;
    this.currentWord.textContent = current?.word || (this.learning.complete ? 'Well explored.' : 'Ready for a word hunt?');
    this.currentWord.lang = this.learning.lesson?.learningLanguage || '';
    this.currentWord.title = current?.word || '';
    this.currentWord.classList.toggle('learning-long-word', (current?.word?.length || 0) > 20);
    this.currentWord.dir = 'auto';
    this.currentTranslation.dir = 'auto';
    this.currentTranslation.textContent = current?.translation || '';
    this.currentTranslation.lang = this.learning.lesson?.primaryLanguage || '';
    this.currentTranslation.hidden = preferences.showTranslation === false || !current?.translation;
    this.translationToggle.classList.toggle('is-on', preferences.showTranslation !== false);
    this.translationToggle.setAttribute('aria-pressed', String(preferences.showTranslation !== false));
    this.translationToggle.setAttribute('aria-label', preferences.showTranslation !== false ? 'Hide translation' : 'Show translation');
    this.listen.disabled = !current?.word;
    this.listen.title = current?.word ? `Listen to ${current.word}` : 'No current word';
    if (this.reviewButton) {
      this.reviewButton.querySelector('span:last-child').textContent = `Words${basketCount ? ` ${basketCount}` : ''}`;
      this.reviewButton.setAttribute('aria-label', `Review ${basketCount} collected words`);
    }
    this.lessonCount.textContent = `${total} ${total === 1 ? 'word' : 'words'} in this lesson`;
    this.setSelectValue(this.learningSelect, this.learning.lesson?.learningLanguage);
    this.setSelectValue(this.primarySelect, this.learning.lesson?.primaryLanguage);
    Object.entries(this.preferenceInputs).forEach(([key, input]) => { input.checked = preferences[key] !== false; });
    if (this.mode === 'review') this.renderReview();
  }

  setSelectValue(select, code) {
    if (!code) return;
    if (![...select.options].some(option => option.value === code)) {
      const option = node('option', '', languageName(code)); option.value = code; select.append(option);
    }
    select.value = code;
  }

  renderReview() {
    const entries = this.learning.basket || [];
    this.reviewCount.textContent = `${entries.length} ${entries.length === 1 ? 'word' : 'words'} collected`;
    const showTranslations = this.learning.preferences.showTranslation !== false;
    this.reviewTranslationToggle.textContent = showTranslations ? 'Hide meanings' : 'Show meanings';
    this.reviewTranslationToggle.setAttribute('aria-pressed', String(showTranslations));
    const pairs = new Set(entries.map(entry => `${entry.learningLanguage || this.learning.lesson?.learningLanguage}|${entry.primaryLanguage || this.learning.lesson?.primaryLanguage}`));
    this.reviewSummary.textContent = pairs.size > 1 ? `${pairs.size} language pairs in your collection` : `${languageName(entries[0]?.learningLanguage || this.learning.lesson?.learningLanguage)} → ${languageName(entries[0]?.primaryLanguage || this.learning.lesson?.primaryLanguage)}`;
    const exportCount = Number.isFinite(this.learning.exportableBasketCount) ? this.learning.exportableBasketCount : entries.length;
    this.clearButton.disabled = !entries.length;
    this.exportButton.disabled = !exportCount;
    this.copyButton.disabled = !exportCount;
    this.exportSummary.textContent = `${languageName(this.learning.lesson?.learningLanguage)} → ${languageName(this.learning.lesson?.primaryLanguage)} · ${exportCount} ${exportCount === 1 ? 'word' : 'words'} ready as GoLingo JSON.${entries.length > exportCount ? ' Other language pairs stay in your collection.' : ''}`;
    const signature = JSON.stringify([entries, showTranslations]);
    if (signature === this.lastReviewSignature) return;
    this.lastReviewSignature = signature;
    this.reviewList.replaceChildren();
    if (!entries.length) {
      const empty = node('div', 'learning-review-empty');
      empty.append(icon('basket'), node('h3', '', 'Your word collection starts here.'), node('p', '', 'Find the word shown on your card and collect it in the forest. Come back to listen and review.'));
      this.reviewList.append(empty); return;
    }
    entries.forEach((entry, index) => {
      const row = node('article', 'learning-review-item');
      const number = node('span', 'learning-word-number', String(index + 1).padStart(2, '0'));
      const copy = node('div', 'learning-review-word');
      const word = node('strong', '', entry.word || ''); word.lang = entry.learningLanguage || this.learning.lesson?.learningLanguage || ''; word.dir = 'auto';
      copy.append(word);
      if (pairs.size > 1) copy.append(node('small', 'learning-entry-languages', `${languageName(entry.learningLanguage || this.learning.lesson?.learningLanguage)} → ${languageName(entry.primaryLanguage || this.learning.lesson?.primaryLanguage)}`));
      if (showTranslations && entry.translation) { const translation = node('span', 'learning-review-translation', entry.translation); translation.lang = entry.primaryLanguage || this.learning.lesson?.primaryLanguage || ''; translation.dir = 'auto'; copy.append(translation); }
      if (entry.sentence) {
        const sentence = node('p', 'learning-example', entry.sentence); sentence.lang = entry.learningLanguage || this.learning.lesson?.learningLanguage || ''; sentence.dir = 'auto'; copy.append(sentence);
        if (showTranslations && entry.sentenceTranslation) copy.append(node('p', 'learning-example-translation', entry.sentenceTranslation));
      }
      const controls = node('div', 'learning-review-audio');
      const listenWord = button('', 'learning-listen-button', () => this.speak(entry), 'listen');
      listenWord.setAttribute('aria-label', `Listen to ${entry.word}`); listenWord.title = 'Listen to word'; controls.append(listenWord);
      if (entry.sentence) controls.append(button('Sentence', 'learning-sentence-button', () => this.speak(entry, true)));
      row.append(number, copy, controls); this.reviewList.append(row);
    });
  }

  preference(key, value) {
    this.learning.setPreference(key, value);
    this.render();
  }

  speak(entry, sentence = false) {
    this.learning.unlock();
    const selected = entry || this.learning.current;
    if (!selected) return;
    if (sentence) {
      this.learning.replay({ ...selected, word: selected.sentence, translation: selected.sentenceTranslation || '', audioUrl: selected.sentenceAudioUrl || '', sentence: '', sentenceTranslation: '' });
    } else this.learning.replay(selected);
  }

  openLesson() { this.open('lesson'); }
  openReview() { this.open('review'); }
  open(mode) {
    const wasOpen = !!this.mode;
    if (!wasOpen) this.previousFocus = document.activeElement;
    this.mode = mode;
    this.modalTitle.textContent = mode === 'lesson' ? 'Choose your words.' : 'Words worth keeping.';
    this.modalSubtitle.textContent = mode === 'lesson' ? 'A new language. A familiar trail.' : 'Listen again, then take your words to GoLingo.';
    this.lessonPanel.hidden = mode !== 'lesson';
    this.reviewPanel.hidden = mode !== 'review';
    this.overlay.hidden = false;
    this.body.scrollTop = 0;
    if (!wasOpen) this.onOpen?.(mode);
    this.render();
    this.closeButton.focus({ preventScroll: true });
  }

  close() {
    if (!this.mode) return;
    this.mode = null;
    this.overlay.hidden = true;
    this.render();
    this.onClose?.();
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  }

  status(message, error = false) {
    this.importStatus.textContent = message;
    this.importStatus.classList.toggle('is-error', error);
  }

  async readFile() {
    const file = this.fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a lesson file smaller than 2 MB.');
      this.importText.value = await file.text();
      this.status(`Loaded ${file.name}. Choose Apply lesson when ready.`);
    } catch (error) { this.status(error?.message || 'Could not read this file.', true); }
    this.fileInput.value = '';
  }

  parseLesson(source) {
    const text = source.trim();
    if (!text) throw new Error('Paste a lesson or choose a JSON / TXT file first.');
    const metadata = { learningLanguage: this.learningSelect.value, primaryLanguage: this.primarySelect.value };
    if (text.startsWith('{') || text.startsWith('[')) {
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error('This JSON has a formatting error. Check commas and quotation marks.'); }
      return Array.isArray(parsed) ? { ...metadata, words: parsed } : parsed;
    }
    const words = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const separator = line.indexOf('=');
      if (separator < 1) throw new Error(`Line ${index + 1}: use word = translation.`);
      const word = line.slice(0, separator).trim();
      const translation = line.slice(separator + 1).trim();
      if (!word || !translation) throw new Error(`Line ${index + 1} needs both a word and its translation.`);
      return { word, translation };
    });
    return { ...metadata, words };
  }

  async applyLesson() {
    if (this.busy) return;
    this.busy = true; this.applyButton.disabled = true;
    try {
      const payload = this.parseLesson(this.importText.value);
      await this.learning.importLesson(payload, { append: this.appendInput.checked });
      this.lastReviewSignature = '';
      this.render();
      this.status(`${this.learning.total || this.learning.entries.length} words ready. Close this panel to explore.`);
    } catch (error) { this.status(error?.message || 'This lesson could not be loaded. Your current lesson is still ready.', true); }
    finally { this.busy = false; this.applyButton.disabled = false; }
  }

  async loadDemo() {
    if (this.busy) return;
    this.busy = true; this.demoButton.disabled = true;
    try {
      await this.learning.useDefault(this.learningSelect.value, this.primarySelect.value);
      this.importText.value = ''; this.appendInput.checked = false;
      this.lastReviewSignature = ''; this.render();
      this.status('Nature demo ready. Close this panel to begin the word hunt.');
    } catch (error) { this.status(error?.message || 'Could not load this demo.', true); }
    finally { this.busy = false; this.demoButton.disabled = false; }
  }

  exportText() { return jsonText(this.learning.exportLesson({ collectedOnly: true })); }

  downloadLesson() {
    try {
      const blob = new Blob([this.exportText()], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = node('a'); anchor.href = url; anchor.download = 'pinefall-collected-words.json';
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.reviewStatus.textContent = 'Your collected-word lesson is ready to import into GoLingo.';
    } catch { this.showCopyFallback('Download unavailable. Copy the JSON below instead.'); }
  }

  async copyLesson() {
    try {
      const text = this.exportText();
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      this.reviewStatus.textContent = 'Copied your GoLingo lesson JSON.';
    } catch { this.showCopyFallback('Select and copy the JSON below.'); }
  }

  showCopyFallback(message) {
    this.copyFallback.hidden = false;
    this.copyText.value = this.exportText();
    this.reviewStatus.textContent = message;
    this.copyText.focus(); this.copyText.select();
    this.copyText.scrollIntoView({ block: 'nearest' });
  }
}
