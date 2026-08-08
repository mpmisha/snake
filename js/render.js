// Canvas drawing helpers for the Snake game — reuses the shared bevel/gloss
// "candy block" shading language so the snake and treats match the house style.
import { css, adjustBrightness, lightened } from './color.js';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Draws one beveled candy block filling the cell [x,y,side].
// Mirrors the Block Grid bevel: dark body, raised face, top gloss, corner glint.
function drawCandyBlock(ctx, x, y, side, color, opts = {}) {
  const cornerRatio = opts.cornerRatio ?? 0.28;
  const bodyInset = side * 0.02;
  const bodyRadius = side * cornerRatio;

  // Dark body (bevel).
  ctx.fillStyle = css(adjustBrightness(color, 0.62));
  roundRect(ctx, x + bodyInset, y + bodyInset, side - bodyInset * 2, side - bodyInset * 2, bodyRadius);
  ctx.fill();

  // Raised face, nudged up so the bottom edge reads as shadow.
  const faceInset = side * 0.13;
  const fx = x + faceInset;
  const fy = y + faceInset * 0.70;
  const fw = side - faceInset * 2;
  const fh = side - faceInset * 2.25;
  const faceRadius = bodyRadius * 0.62;

  ctx.fillStyle = css(color);
  roundRect(ctx, fx, fy, fw, fh, faceRadius);
  ctx.fill();

  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, faceRadius);
  ctx.clip();
  // Top gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(fx, fy, fw, fh * 0.42);
  // Small corner highlight.
  const hs = side * 0.16;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, fx + side * 0.06, fy + side * 0.06, hs, hs * 0.6, hs * 0.3);
  ctx.fill();
  ctx.restore();
}

// Draws a glossy candy "treat" — a rounded bubble that sits inside the cell.
function drawTreat(ctx, cx, cy, side, color, pulse = 0) {
  const r = side * (0.34 + pulse * 0.03);

  // Soft shadow disc.
  ctx.fillStyle = css({ ...adjustBrightness(color, 0.55), a: 0.9 });
  ctx.beginPath();
  ctx.arc(cx, cy + side * 0.03, r * 1.02, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  ctx.fillStyle = css(color);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Upper gloss cap.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.32, r * 0.85, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bright glint.
  ctx.fillStyle = css(lightened(color, 0.7));
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.32, cy - r * 0.38, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

// Draws the snake head: a rounded candy block plus two tiny friendly eyes,
// oriented by direction {dx,dy}.
function drawSnakeHead(ctx, x, y, side, color, dir) {
  drawCandyBlock(ctx, x, y, side, color, { cornerRatio: 0.42 });

  const cx = x + side / 2;
  const cy = y + side / 2;
  // Place eyes toward the facing edge, offset perpendicular.
  const forward = side * 0.16;
  const spread = side * 0.20;
  const ex = cx + dir.dx * forward;
  const ey = cy + dir.dy * forward;
  // Perpendicular vector.
  const px = -dir.dy;
  const py = dir.dx;
  const eyeR = side * 0.11;
  const pupilR = side * 0.055;

  for (const s of [-1, 1]) {
    const wx = ex + px * spread * s;
    const wy = ey + py * spread * s;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(wx, wy, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20264f';
    ctx.beginPath();
    ctx.arc(wx + dir.dx * eyeR * 0.35, wy + dir.dy * eyeR * 0.35, pupilR, 0, Math.PI * 2);
    ctx.fill();
  }
}

export { roundRect, drawCandyBlock, drawTreat, drawSnakeHead };
