// Player settings + best-score persistence via localStorage.
// Small, self-contained store for the Snake game.

const KEYS = {
  sound: 'snake.soundEnabled',
  haptics: 'snake.hapticsEnabled',
  difficulty: 'snake.difficulty', // 'calm' | 'normal'
  walls: 'snake.walls',           // 'wrap' | 'solid'
  best: 'snake.bestScore',
};

const DIFFICULTIES = ['calm', 'normal'];
const WALL_MODES = ['wrap', 'solid'];

function readBool(key, fallback) {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

const SettingsStore = {
  get isSoundEnabled() {
    return readBool(KEYS.sound, true);
  },
  set isSoundEnabled(value) {
    localStorage.setItem(KEYS.sound, value ? 'true' : 'false');
  },

  get areHapticsEnabled() {
    return readBool(KEYS.haptics, true);
  },
  set areHapticsEnabled(value) {
    localStorage.setItem(KEYS.haptics, value ? 'true' : 'false');
  },

  // 'calm' (default) is slower and easier for the smallest kids.
  get difficulty() {
    const v = localStorage.getItem(KEYS.difficulty);
    return DIFFICULTIES.includes(v) ? v : 'calm';
  },
  set difficulty(value) {
    if (!DIFFICULTIES.includes(value)) return;
    localStorage.setItem(KEYS.difficulty, value);
  },

  // 'wrap' (default) = forgiving edges; 'solid' = walls end the round.
  get wallMode() {
    const v = localStorage.getItem(KEYS.walls);
    return WALL_MODES.includes(v) ? v : 'wrap';
  },
  set wallMode(value) {
    if (!WALL_MODES.includes(value)) return;
    localStorage.setItem(KEYS.walls, value);
  },

  get bestScore() {
    const n = parseInt(localStorage.getItem(KEYS.best) || '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  },
  set bestScore(value) {
    localStorage.setItem(KEYS.best, String(Math.max(0, value | 0)));
  },
};

export { SettingsStore };
