// Snake game scene: grid state, movement, input buffering, and canvas render.
// Calm-first tuning for smaller kids — slow speed, forgiving edges (wrap by
// default), no timers, and a soft round-over.
import { SettingsStore } from './storage.js';
import { SoundPlayer, Haptics } from './audio.js';
import { SkinCatalog } from './skins.js';
import { css, rgb } from './color.js';
import { drawCandyBlock, drawTreat, drawSnakeHead } from './render.js';

// Grid is square; big cells for little fingers.
const GRID = 11;

// Step interval (ms per cell) by difficulty. Higher = slower/calmer.
const BASE_STEP = { calm: 340, normal: 250 };
// Gentle speed-up as the snake grows: subtract a tiny amount per treat, clamped.
const STEP_PER_GROWTH = 6;
const MIN_STEP = { calm: 230, normal: 160 };

const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

// Snake body color (Candy green) and a small rotation of candy treat colors.
function candy(i) {
  const c = SkinCatalog.blockPalette.colors;
  return c[((i % c.length) + c.length) % c.length];
}

class GameScene {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom;

    this.sound = new SoundPlayer(SettingsStore);
    this.haptics = new Haptics(SettingsStore);

    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.overlayOpen = false;

    this.resize = this.resize.bind(this);
    this.tickFrame = this.tickFrame.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);

    this.bindInput();
    this.resize();
    this.startNewGame();

    this.lastFrame = performance.now();
    requestAnimationFrame(this.tickFrame);
  }

  // ---- Lifecycle ----

  startNewGame() {
    const mid = Math.floor(GRID / 2);
    // Start with 3 segments moving right; head last in array.
    this.snake = [
      { x: mid - 2, y: mid },
      { x: mid - 1, y: mid },
      { x: mid, y: mid },
    ];
    this.dir = DIRS.right;
    this.pendingDir = null;
    this.inputQueue = [];
    this.score = 0;
    this.growthBy = 0;      // remaining segments to grow
    this.alive = true;
    this.stepAcc = 0;
    this.treatColorIndex = 1; // green is 1; treats use others
    this.spawnTreat();
    this.eatPulse = 0;
    this.deathFlash = 0;
    this.updateHud(false);
  }

  get stepInterval() {
    const d = SettingsStore.difficulty;
    const base = BASE_STEP[d] ?? BASE_STEP.calm;
    const min = MIN_STEP[d] ?? MIN_STEP.calm;
    return Math.max(min, base - this.score * STEP_PER_GROWTH);
  }

  spawnTreat() {
    const occupied = new Set(this.snake.map((s) => `${s.x},${s.y}`));
    const free = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    if (free.length === 0) { this.treat = null; return; } // board full — win-ish
    const cell = free[Math.floor(Math.random() * free.length)];
    // Rotate treat color through candy palette, skipping the snake green (1).
    const colors = [0, 2, 3, 4, 5, 6, 7];
    this.treatColorIndex = colors[(this.score) % colors.length];
    this.treat = { x: cell.x, y: cell.y };
  }

  // ---- Input ----

  bindInput() {
    // Swipe on the canvas.
    let sx = 0, sy = 0, tracking = false;
    const threshold = 24;
    const onStart = (e) => {
      this.sound.unlock();
      const p = pointFrom(e);
      sx = p.x; sy = p.y; tracking = true;
    };
    const onMove = (e) => {
      if (!tracking) return;
      const p = pointFrom(e);
      const dx = p.x - sx;
      const dy = p.y - sy;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.queueDir(dx > 0 ? DIRS.right : DIRS.left);
      } else {
        this.queueDir(dy > 0 ? DIRS.down : DIRS.up);
      }
      // Reset origin so a continued drag can register a second turn.
      sx = p.x; sy = p.y;
    };
    const onEnd = () => { tracking = false; };

    this.canvas.addEventListener('touchstart', onStart, { passive: true });
    this.canvas.addEventListener('touchmove', onMove, { passive: true });
    this.canvas.addEventListener('touchend', onEnd, { passive: true });
    this.canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    // Keyboard for desktop testing.
    window.addEventListener('keydown', (e) => {
      const map = { ArrowUp: DIRS.up, ArrowDown: DIRS.down, ArrowLeft: DIRS.left, ArrowRight: DIRS.right };
      if (map[e.key]) { this.queueDir(map[e.key]); e.preventDefault(); }
    });
  }

  // Public: called by D-pad buttons.
  press(name) {
    this.sound.unlock();
    if (DIRS[name]) this.queueDir(DIRS[name]);
  }

  queueDir(dir) {
    if (!this.alive) return;
    // Buffer up to 2 turns so a slightly-early tap still registers.
    const last = this.inputQueue.length
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.dir;
    // Ignore reversing directly into self.
    if (dir.dx === -last.dx && dir.dy === -last.dy) return;
    // Ignore no-op (same direction).
    if (dir.dx === last.dx && dir.dy === last.dy) return;
    if (this.inputQueue.length >= 2) this.inputQueue.shift();
    this.inputQueue.push(dir);
    this.sound.play('turn');
    this.haptics.turn();
  }

  // ---- Simulation ----

  tickFrame(now) {
    const dt = Math.min(now - this.lastFrame, 100);
    this.lastFrame = now;

    if (this.eatPulse > 0) this.eatPulse = Math.max(0, this.eatPulse - dt / 220);
    if (this.deathFlash > 0) this.deathFlash = Math.max(0, this.deathFlash - dt / 400);

    if (this.alive && !this.overlayOpen) {
      this.stepAcc += dt;
      while (this.stepAcc >= this.stepInterval) {
        this.stepAcc -= this.stepInterval;
        this.step();
        if (!this.alive) break;
      }
    }
    this.render(now);
    requestAnimationFrame(this.tickFrame);
  }

  step() {
    // Apply the next buffered turn.
    if (this.inputQueue.length) {
      const next = this.inputQueue.shift();
      if (!(next.dx === -this.dir.dx && next.dy === -this.dir.dy)) this.dir = next;
    }

    const head = this.snake[this.snake.length - 1];
    let nx = head.x + this.dir.dx;
    let ny = head.y + this.dir.dy;

    const solid = SettingsStore.wallMode === 'solid';
    if (nx < 0 || nx >= GRID || ny < 0 || ny >= GRID) {
      if (solid) { this.die(); return; }
      // Wrap around (forgiving default).
      nx = (nx + GRID) % GRID;
      ny = (ny + GRID) % GRID;
    }

    // Self-collision: the tail cell is free this step (unless we're growing).
    const willGrow = this.growthBy > 0;
    const body = this.snake;
    for (let i = 0; i < body.length; i++) {
      // Skip the current tail if it will move away this step.
      if (i === 0 && !willGrow) continue;
      if (body[i].x === nx && body[i].y === ny) { this.die(); return; }
    }

    this.snake.push({ x: nx, y: ny });
    if (willGrow) {
      this.growthBy -= 1;
    } else {
      this.snake.shift();
    }

    // Eat?
    if (this.treat && nx === this.treat.x && ny === this.treat.y) {
      this.score += 1;
      this.growthBy += 1;
      this.eatPulse = 1;
      this.sound.play('eat');
      this.haptics.eat();
      this.spawnTreat();
      this.updateHud(true);
      // Gentle grow chirp on milestones.
      if (this.score % 5 === 0) { this.sound.play('grow'); this.haptics.grow(); }
    }
  }

  die() {
    this.alive = false;
    this.deathFlash = 1;
    this.sound.play('bonk');
    this.haptics.bonk();
    const best = SettingsStore.bestScore;
    const isNewBest = this.score > best;
    if (isNewBest) SettingsStore.bestScore = this.score;
    // Soft round-over — no harsh game over.
    setTimeout(() => {
      if (this.dom.onPresentGameOver) {
        this.overlayOpen = true;
        this.dom.onPresentGameOver({
          score: this.score,
          bestScore: SettingsStore.bestScore,
          isNewBest,
        });
      }
    }, 520);
  }

  updateHud(scored) {
    if (this.dom.hudScore) this.dom.hudScore.textContent = String(this.score);
    const best = Math.max(SettingsStore.bestScore, this.score);
    if (this.dom.hudBest) this.dom.hudBest.textContent = String(best);
    if (scored && this.dom.hudScore) {
      this.dom.hudScore.classList.remove('pulse');
      void this.dom.hudScore.offsetWidth;
      this.dom.hudScore.classList.add('pulse');
    }
  }

  get visibleBestScore() {
    return Math.max(SettingsStore.bestScore, this.score);
  }

  resetBestScore() {
    SettingsStore.bestScore = 0;
    this.updateHud(false);
  }

  presentSettings() {
    this.overlayOpen = true;
    if (this.dom.onPresentSettings) this.dom.onPresentSettings();
  }

  dismissOverlay() {
    this.overlayOpen = false;
    this.lastFrame = performance.now();
    this.stepAcc = 0;
  }

  // ---- Layout & render ----

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.viewW = w;
    this.viewH = h;

    // Board is centered, leaving room for HUD (top) and D-pad (bottom).
    const topInset = 96;
    const bottomInset = 210;
    const avail = Math.min(w - 24, h - topInset - bottomInset);
    this.boardSide = Math.max(180, avail);
    this.cell = this.boardSide / GRID;
    this.boardX = (w - this.boardSide) / 2;
    this.boardY = topInset + ((h - topInset - bottomInset) - this.boardSide) / 2;
  }

  render(now) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // Twilight background gradient.
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grad.addColorStop(0, 'rgb(92,120,219)');
    grad.addColorStop(1, 'rgb(56,66,153)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    this.drawBoard(ctx);
    this.drawTreatCell(ctx, now);
    this.drawSnake(ctx);

    if (this.deathFlash > 0) {
      ctx.fillStyle = `rgba(237,102,107,${this.deathFlash * 0.22})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    ctx.restore();
  }

  drawBoard(ctx) {
    const surf = SkinCatalog.surfacePalette;
    const pad = this.cell * 0.28;
    // Board plate.
    ctx.fillStyle = css({ ...surf.boardBackground, a: 0.9 });
    roundRectPath(ctx, this.boardX - pad, this.boardY - pad,
      this.boardSide + pad * 2, this.boardSide + pad * 2, this.cell * 0.5);
    ctx.fill();

    // Empty cells.
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const px = this.boardX + x * this.cell;
        const py = this.boardY + y * this.cell;
        const inset = this.cell * 0.06;
        ctx.fillStyle = css(surf.emptyCell);
        roundRectPath(ctx, px + inset, py + inset,
          this.cell - inset * 2, this.cell - inset * 2, this.cell * 0.22);
        ctx.fill();
      }
    }
  }

  drawTreatCell(ctx, now) {
    if (!this.treat) return;
    const cx = this.boardX + (this.treat.x + 0.5) * this.cell;
    const cy = this.boardY + (this.treat.y + 0.5) * this.cell;
    const pulse = (Math.sin(now / 300) + 1) / 2;
    drawTreat(ctx, cx, cy, this.cell, candy(this.treatColorIndex), pulse);
  }

  drawSnake(ctx) {
    const green = candy(1); // Candy green body
    const headColor = candy(1);
    for (let i = 0; i < this.snake.length; i++) {
      const seg = this.snake[i];
      const px = this.boardX + seg.x * this.cell;
      const py = this.boardY + seg.y * this.cell;
      const isHead = i === this.snake.length - 1;
      if (isHead) {
        drawSnakeHead(ctx, px, py, this.cell, headColor, this.dir);
      } else {
        // Subtle alternating shade so the body reads as segments.
        const c = i % 2 === 0 ? green : lightenSlightly(green);
        drawCandyBlock(ctx, px, py, this.cell, c);
      }
    }
  }
}

function lightenSlightly(c) {
  return { r: Math.min(1, c.r * 1.08), g: Math.min(1, c.g * 1.08), b: Math.min(1, c.b * 1.08), a: c.a ?? 1 };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function pointFrom(e) {
  if (e.touches && e.touches.length) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

export { GameScene };
