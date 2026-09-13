// Pseudo-isochromatic plate renderer for ChromaSight.
// Deterministic (seeded), canvas-based, with luminance jitter across ALL
// dots so brightness can never leak the hidden shape — the only usable cue
// is the cone-axis difference being measured.

import { mulberry32, strHash } from './rng.js';
import { makeConfusablePair, jitterHex } from './colorscience.js';

// Directions for the 4-alternative forced-choice task
export const DIRECTIONS = ['up', 'right', 'down', 'left'];

export const makeTrialPlate = ({ axis, d, direction, seed }) => {
  const rng = mulberry32(strHash(seed + '|' + axis + '|' + direction + '|' + d.toFixed(4)));
  const { bg, fg } = makeConfusablePair(axis, d, rng);
  return { bg, fg, direction, axis, d };
};

// Control plates use strongly separated colors (blue vs orange) so anyone
// with usable vision can answer them — they validate attention/screen, not
// color discrimination.
export const makeControlPlate = ({ direction, seed }) => {
  const rng = mulberry32(strHash('control|' + seed + '|' + direction));
  return { bg: '#F59E0B', fg: '#2563EB', direction, axis: 'control', d: 1 };
};

const radius = (dir) => {
  switch (dir) {
    case 'up': return 0;
    case 'right': return 90;
    case 'down': return 180;
    case 'left': return 270;
    default: return 0;
  }
};

// Draws a bold triangle pointing `direction` on the mask canvas.
const drawDirectionMask = (ctx, width, height, direction) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((radius(direction) * Math.PI) / 180);

  const s = Math.min(width, height) * 0.62;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.55); // tip
  ctx.lineTo(s * 0.48, s * 0.38); // bottom right
  ctx.lineTo(0, s * 0.14); // notch
  ctx.lineTo(-s * 0.48, s * 0.38); // bottom left
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

// Renders a circular pseudo-isochromatic plate onto the given 2D context.
// Returns nothing; caller manages canvas sizing and display.
export const renderPlate = (canvas, plate, seed) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const width = canvas.width;
  const height = canvas.height;
  const rng = mulberry32(strHash('render|' + seed + '|' + plate.axis + '|' + plate.direction + '|' + plate.d.toFixed(4)));

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  drawDirectionMask(maskCanvas.getContext('2d'), width, height, plate.direction);
  const mask = maskCanvas.getContext('2d').getImageData(0, 0, width, height).data;

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  // High-density circle packing (rejection sampling, mixed dot sizes)
  const circles = [];
  const maxAttempts = 160000;

  for (let i = 0; i < maxAttempts; i++) {
    const t = rng();
    const r = t > 0.88 ? 7.5 : t > 0.4 ? 4.2 : 2.4;
    const x = rng() * width;
    const y = rng() * height;
    const distToCenter = Math.sqrt((x - width / 2) ** 2 + (y - height / 2) ** 2);
    if (distToCenter + r > width / 2 - 4) continue;

    let overlap = false;
    for (let j = 0; j < circles.length; j++) {
      const c = circles[j];
      const dx = x - c.x;
      const dy = y - c.y;
      if (dx * dx + dy * dy < (r + c.r + 0.8) ** 2) {
        overlap = true;
        break;
      }
    }
    if (!overlap) circles.push({ x, y, r });
  }

  circles.forEach((c) => {
    const pixelIdx = (Math.floor(c.y) * width + Math.floor(c.x)) * 4;
    const isFigure = mask[pixelIdx] > 128;
    const base = isFigure ? plate.fg : plate.bg;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = jitterHex(base, rng);
    ctx.fill();
  });
};
