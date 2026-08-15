import './telemetry.js';
// Entry point: wires the DOM HUD/overlays/D-pad to the canvas GameScene.
import { GameScene } from './scene.js';
import { SettingsStore } from './storage.js';
import { resolveLang, applyLang, isValidLang, t } from './i18n.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');

const dom = {
  header: $('hud'),
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  bestBadge: $('best-badge'),
  onPresentSettings: openSettings,
  onPresentGameOver: openGameOver,
};

const scene = new GameScene(canvas, dom);

// ---- i18n: resolve + apply the platform language, then translate the DOM ----
// Language is chosen only in the hub and shared via same-origin localStorage
// 'lang'. We never mirror movement/board — only text + chrome localize.

// Remember the last round-over state so a live language switch re-renders it.
let lastGameOver = null;

function translateDom() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });
  // Dynamic strings that carry live numbers.
  settingsBest.textContent = t('bestScoreLine', scene.visibleBestScore);
  if (resetArmed) resetBtn.textContent = t('tapAgain');
  if (lastGameOver) {
    $('go-title').textContent = lastGameOver.isNewBest ? t('newBest') : t('oops');
    $('go-best').textContent = t('bestBadgeLine', lastGameOver.bestScore);
  }
}

function setLanguage(code, persist = false) {
  applyLang(code, persist);
  translateDom();
}

// Live updates from the hub (same-origin postMessage) when language changes
// while this game is open in the hub's iframe player.
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const data = e.data;
  if (data && data.type === 'playground:lang' && isValidLang(data.lang)) {
    setLanguage(data.lang);
  }
});

// Also honor a language change made in another same-origin tab (e.g. the hub
// standalone) via the shared localStorage 'lang' key.
window.addEventListener('storage', (e) => {
  if (e.key === 'lang' && isValidLang(e.newValue)) {
    setLanguage(e.newValue);
  }
});

// ---- D-pad ----
const dpad = $('dpad');
dpad.addEventListener('touchstart', (e) => {
  const btn = e.target.closest('.dbtn');
  if (!btn) return;
  e.preventDefault();
  scene.press(btn.dataset.dir);
}, { passive: false });
dpad.addEventListener('click', (e) => {
  const btn = e.target.closest('.dbtn');
  if (!btn) return;
  scene.press(btn.dataset.dir);
});

// ---- Gear ----
$('gear').addEventListener('click', () => {
  scene.sound.unlock();
  scene.sound.play('button');
  scene.presentSettings();
});

// ---- Settings overlay ----
const settingsOverlay = $('settings-overlay');
const settingsBest = $('settings-best');
const diffSeg = $('difficulty-seg');
const toggleWalls = $('toggle-walls');
const toggleSound = $('toggle-sound');
const toggleHaptics = $('toggle-haptics');
const resetBtn = $('btn-reset-best');
let resetArmed = false;
let resetTimer = null;

function syncSettingsUi() {
  settingsBest.textContent = t('bestScoreLine', scene.visibleBestScore);
  for (const btn of diffSeg.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.diff === SettingsStore.difficulty);
  }
  toggleWalls.classList.toggle('on', SettingsStore.wallMode === 'solid');
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
  disarmReset();
}

function disarmReset() {
  resetArmed = false;
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
  resetBtn.textContent = t('resetBest');
}

function openSettings() {
  syncSettingsUi();
  settingsOverlay.hidden = false;
}

function closeSettings() {
  settingsOverlay.hidden = true;
  scene.dismissOverlay();
  disarmReset();
}

diffSeg.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  scene.sound.play('button');
  SettingsStore.difficulty = btn.dataset.diff;
  syncSettingsUi();
});

toggleWalls.addEventListener('click', () => {
  SettingsStore.wallMode = SettingsStore.wallMode === 'solid' ? 'wrap' : 'solid';
  toggleWalls.classList.toggle('on', SettingsStore.wallMode === 'solid');
  scene.sound.play('button');
});

toggleSound.addEventListener('click', () => {
  SettingsStore.isSoundEnabled = !SettingsStore.isSoundEnabled;
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  scene.sound.play('button');
});

toggleHaptics.addEventListener('click', () => {
  SettingsStore.areHapticsEnabled = !SettingsStore.areHapticsEnabled;
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
  scene.haptics.eat();
});

$('btn-new-game').addEventListener('click', () => {
  scene.sound.play('button');
  closeSettings();
  scene.startNewGame();
});

resetBtn.addEventListener('click', () => {
  scene.sound.play('button');
  if (!resetArmed) {
    resetArmed = true;
    resetBtn.textContent = t('tapAgain');
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  scene.resetBestScore();
  settingsBest.textContent = t('bestScoreLine', 0);
});

$('btn-close').addEventListener('click', () => {
  scene.sound.play('button');
  closeSettings();
});

// ---- Back to hub ----
const HUB_URL = (() => {
  const param = new URLSearchParams(location.search).get('hub');
  if (param) { try { return new URL(param, location.href).href; } catch { /* ignore */ } }
  return 'https://mpmisha.github.io/playground/';
})();
const backHubBtn = $('btn-back-hub');
const hubParamPresent = new URLSearchParams(location.search).has('hub');
const embeddedInHub = window.self !== window.top;
backHubBtn.href = HUB_URL;
// Only show the Back-to-Games control when launched from the hub.
backHubBtn.hidden = !hubParamPresent;
backHubBtn.addEventListener('click', (e) => {
  scene.sound.play('button');
  if (embeddedInHub) {
    e.preventDefault();
    try {
      window.parent.postMessage({ type: 'playground:back' }, new URL(HUB_URL).origin);
    } catch {
      window.parent.postMessage({ type: 'playground:back' }, '*');
    }
  }
});

settingsOverlay.querySelector('[data-dismiss="settings"]').addEventListener('click', closeSettings);

// ---- Round-over overlay ----
const gameoverOverlay = $('gameover-overlay');

function openGameOver({ score, bestScore, isNewBest }) {
  lastGameOver = { score, bestScore, isNewBest };
  $('go-emoji').textContent = isNewBest ? '🎉' : '🐍';
  $('go-title').textContent = isNewBest ? t('newBest') : t('oops');
  $('go-score').textContent = String(score);
  $('go-best').textContent = t('bestBadgeLine', bestScore);
  gameoverOverlay.hidden = false;
}

$('btn-play-again').addEventListener('click', () => {
  scene.sound.play('button');
  lastGameOver = null;
  gameoverOverlay.hidden = true;
  scene.dismissOverlay();
  scene.startNewGame();
});

// Apply the resolved language now that all DOM refs + handlers exist.
setLanguage(resolveLang());

// Read-only debug probe (gated by ?debug=1) used by the headless smoke test to
// assert that movement direction is identical in LTR and RTL. No effect on play.
if (new URLSearchParams(location.search).get('debug') === '1') {
  window.__snakeHead = () => {
    const h = scene.snake[scene.snake.length - 1];
    return { x: h.x, y: h.y, dx: scene.dir.dx, dy: scene.dir.dy };
  };
}

// ---- Service worker (offline support + reliable auto-update) ----
// The SW caches the whole shell, so without an update path an old build can
// keep running. We check for updates, promote a freshly-installed worker to
// active, and reload once it takes control so users always get the new build.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Skip the very first install (no prior controller) — nothing to refresh.
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      reg.update().catch(() => {});

      const promote = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      };
      // A worker already waiting from a previous check.
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => promote(reg.installing));

      // Re-check for updates when the app returns to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
