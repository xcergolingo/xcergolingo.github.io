// Local personal bests. A replay never calls record(), so it cannot earn stars.
const STORAGE_KEY = 'goal-club.progress.v1';
const DIFFICULTIES = new Set(['practice', 'challenge', 'pro']);
const MODES = new Set(['learn', 'listen', 'meaning']);
const STYLES = new Set(['drive', 'curl', 'chip']);
const LIMIT = Number.MAX_SAFE_INTEGER;
const empty = () => ({ stars: 0, points: 0, goals: 0, precision: 0, style: null });
const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min = 0, max = LIMIT) => Number.isSafeInteger(value) && value >= min && value <= max;
const bounded = (value, max = LIMIT) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.trunc(value))) : 0;

export function createProgress(storage, levelCount = 24) {
  const total = integer(levelCount, 1, 1000) ? levelCount : 24;
  const records = Object.create(null);

  function keyFor(index, difficulty, mode = 'learn') {
    if (!integer(index, 0, total - 1) || !DIFFICULTIES.has(difficulty) || !MODES.has(mode)) return null;
    return `${difficulty}:${mode}:${index}`;
  }

  // Stored data must describe an actual completed puzzle; bad entries do not
  // contaminate other puzzles or prevent fresh in-memory progress from working.
  function readRecord(value) {
    if (!isObject(value) || !integer(value.stars, 0, 3) || !integer(value.points) ||
        !integer(value.goals, 1) || !integer(value.precision, 0, value.goals) ||
        !(value.style === null || STYLES.has(value.style))) return null;
    return { stars: value.stars, points: value.points, goals: value.goals, precision: value.precision, style: value.style };
  }

  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (isObject(saved) && saved.version === 1 && isObject(saved.records)) {
      for (const [key, value] of Object.entries(saved.records)) {
        const match = /^(practice|challenge|pro):(learn|listen|meaning):(0|[1-9]\d*)$/.exec(key);
        if (!match || keyFor(Number(match[3]), match[1], match[2]) !== key) continue;
        const clean = readRecord(value);
        if (clean) records[key] = clean;
      }
    }
  } catch { /* Storage can be unavailable in an embedded or private browser. */ }

  function persist() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records })); }
    catch { /* Keep this session's progress even when persistence is denied. */ }
  }

  function get(index, difficulty, mode = 'learn') {
    const key = keyFor(index, difficulty, mode);
    return key && records[key] ? { ...records[key] } : empty();
  }

  function record(index, options = {}) {
    if (!isObject(options)) return empty();
    const { difficulty, mode = 'learn', stars, points, style, precise } = options;
    const key = keyFor(index, difficulty, mode);
    if (!key) return empty();
    const previous = records[key] || empty();
    const next = {
      stars: Math.max(previous.stars, bounded(stars, 3)),
      points: Math.max(previous.points, bounded(points)),
      goals: Math.min(LIMIT, previous.goals + 1),
      precision: Math.min(LIMIT, previous.precision + (precise === true ? 1 : 0)),
      style: STYLES.has(style) ? style : previous.style
    };
    records[key] = next;
    persist();
    return { ...next };
  }

  function summary(difficulty, mode = 'learn') {
    let completed = 0, stars = 0;
    if (DIFFICULTIES.has(difficulty) && MODES.has(mode)) {
      for (let index = 0; index < total; index++) {
        const result = records[keyFor(index, difficulty, mode)];
        if (result) { completed++; stars += result.stars; }
      }
    }
    return { completed, stars, total, maxStars: total * 3 };
  }

  return { record, get, summary };
}
