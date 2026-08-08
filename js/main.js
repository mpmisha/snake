// Entry point: wires the DOM HUD/overlays/D-pad to the canvas GameScene.
import { GameScene } from './scene.js';
import { SettingsStore } from './storage.js';

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
  settingsBest.textContent = `Best score: ${scene.visibleBestScore}`;
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
  resetBtn.textContent = 'Reset Best Score';
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
    resetBtn.textContent = 'Tap again to confirm';
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  scene.resetBestScore();
  settingsBest.textContent = 'Best score: 0';
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
  $('go-emoji').textContent = isNewBest ? '🎉' : '🐍';
  $('go-title').textContent = isNewBest ? 'New Best!' : 'Oops!';
  $('go-score').textContent = String(score);
  $('go-best').textContent = `👑 Best: ${bestScore}`;
  gameoverOverlay.hidden = false;
}

$('btn-play-again').addEventListener('click', () => {
  scene.sound.play('button');
  gameoverOverlay.hidden = true;
  scene.dismissOverlay();
  scene.startNewGame();
});

// ---- Service worker (offline support) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
