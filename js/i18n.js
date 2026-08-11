// Snake i18n (Playground contract v1). Self-contained per game.
//
// Canonical store: localStorage 'lang' ∈ {'en','he'}. Same origin as the hub, so
// this key is shared — the hub sets it and every game reads it. English is the
// LTR fallback; Hebrew is RTL. Numbers always stay numeric; only text + chrome
// localize. Movement/swipe directions, the snake's heading, and the game grid
// are gameplay and are NEVER inverted or mirrored in RTL.

export const LANGS = ['en', 'he'];

// A value may be a plain string or a function(...args) => string for dynamic
// phrases (score/best lines).
const STRINGS = {
  en: {
    settings: 'Settings',
    speed: 'Speed',
    calm: 'Calm',
    normal: 'Normal',
    walls: 'Walls',
    sound: 'Sound',
    vibration: 'Vibration',
    newGame: 'New Game',
    resetBest: 'Reset Best Score',
    tapAgain: 'Tap again to confirm',
    backToGames: '\u2190 Back to Games',
    close: 'Close',
    yourScore: 'Your score',
    oops: 'Oops!',
    newBest: 'New Best!',
    playAgain: 'Play Again',
    // aria labels
    settingsAria: 'Settings',
    directionPadAria: 'Direction pad',
    upAria: 'Up',
    downAria: 'Down',
    leftAria: 'Left',
    rightAria: 'Right',
    roundOverAria: 'Round over',
    wallsAria: 'Solid walls',
    // dynamic
    bestScoreLine: (n) => `Best score: ${n}`,
    bestBadgeLine: (n) => `\uD83D\uDC51 Best: ${n}`,
  },
  he: {
    settings: 'הגדרות',
    speed: 'מהירות',
    calm: 'רגוע',
    normal: 'רגיל',
    walls: 'קירות',
    sound: 'צליל',
    vibration: 'רטט',
    newGame: 'משחק חדש',
    resetBest: 'איפוס שיא',
    tapAgain: 'הקישו שוב לאישור',
    backToGames: 'חזרה למשחקים \u2192',
    close: 'סגירה',
    yourScore: 'הניקוד שלך',
    oops: 'אופס!',
    newBest: 'שיא חדש!',
    playAgain: 'שחקו שוב',
    // aria labels
    settingsAria: 'הגדרות',
    directionPadAria: 'לוח כיוונים',
    upAria: 'למעלה',
    downAria: 'למטה',
    leftAria: 'שמאלה',
    rightAria: 'ימינה',
    roundOverAria: 'סוף סיבוב',
    wallsAria: 'קירות מלאים',
    // dynamic
    bestScoreLine: (n) => `שיא: ${n}`,
    bestBadgeLine: (n) => `\uD83D\uDC51 שיא: ${n}`,
  },
};

export function isValidLang(code) {
  return LANGS.includes(code);
}

function detectFromNavigator() {
  const list = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ''];
  for (const raw of list) {
    const code = String(raw).toLowerCase();
    if (code.startsWith('he') || code.startsWith('iw')) return 'he';
    if (code.startsWith('en')) return 'en';
  }
  return 'en';
}

// Resolution order: (1) URL ?lang= if valid → also persist; (2) stored 'lang';
// (3) auto-detect. Auto-detect must never overwrite an explicit stored choice.
export function resolveLang() {
  try {
    const param = new URLSearchParams(location.search).get('lang');
    if (param && isValidLang(param)) {
      try { localStorage.setItem('lang', param); } catch { /* ignore */ }
      return param;
    }
  } catch { /* ignore */ }

  try {
    const stored = localStorage.getItem('lang');
    if (stored && isValidLang(stored)) return stored;
  } catch { /* ignore */ }

  return detectFromNavigator();
}

let currentLang = 'en';
const listeners = new Set();

export function getLang() { return currentLang; }

// t('key') or t('key', arg1, ...) — supports string and function entries, with
// an English fallback and a final fallback to the key itself.
export function t(key, ...args) {
  const dict = STRINGS[currentLang] || STRINGS.en;
  let val = dict[key];
  if (val == null) val = STRINGS.en[key];
  if (val == null) return key;
  return typeof val === 'function' ? val(...args) : val;
}

// Register a callback fired whenever the language changes (live hub update).
export function onLang(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Apply the locale to the document: set lang/dir and notify listeners. `persist`
// writes an explicit user/hub choice to localStorage.
export function applyLang(code, persist = false) {
  const lang = isValidLang(code) ? code : 'en';
  const changed = lang !== currentLang;
  currentLang = lang;
  if (persist) {
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  }
  const el = document.documentElement;
  el.lang = lang;
  el.dir = lang === 'he' ? 'rtl' : 'ltr';
  listeners.forEach((cb) => { try { cb(lang, changed); } catch { /* ignore */ } });
  return lang;
}
