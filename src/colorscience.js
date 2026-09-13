// Color vision science core for ChromaSight Profiler.
//
// The test measures how well a user distinguishes colors that differ ONLY
// along one cone axis in LMS cone space. A dichromat who is missing (or has
// a non-functional) L, M, or S cone physically cannot see differences along
// that axis — so "figure vs background" pairs that differ only in the
// missing coordinate are exactly confusable for that vision type, while
// trichromats see them clearly. This is the same principle the Cambridge
// Color Test uses, applied to pseudo-isochromatic (Ishihara-style) plates.
//
// All transforms use standard sRGB D65 primaries and the Hunt-Pointer-Estevez
// cone fundamentals normalized to the D65 white point (white → L=M=S=1).

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// --- gamma ---
export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);

// --- matrices ---
const mulMatVec = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]
];

// linear sRGB (D65) → XYZ
const RGB2XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041]
];

// Hunt-Pointer-Estevez cone fundamentals, normalized to the D65 white point
const XYZ2LMS = [
  [0.4002, 0.7076, -0.0808],
  [-0.2263, 1.1653, 0.0457],
  [0.0, 0.0, 0.9182]
];

// Exact 3x3 inverse (computed, never hand-typed)
const invert3 = (m) => {
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('singular matrix');
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]
  ];
};

export const XYZ2RGB = invert3(RGB2XYZ);
const LMS2XYZ = invert3(XYZ2LMS);

export const rgbLinToLms = (rgbLin) => mulMatVec(XYZ2LMS, mulMatVec(RGB2XYZ, rgbLin));
export const lmsToRgbLin = (lms) => mulMatVec(XYZ2RGB, mulMatVec(LMS2XYZ, lms));

export const hexToRgb = (hex) => {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

export const rgbToHex = (r, g, b) => {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
};

// hex (gamma-encoded 0-255) → LMS cone responses
export const hexToLms = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbLinToLms([srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)]);
};

// LMS → hex, clamping into the sRGB gamut
export const lmsToHex = (lms) => {
  const lin = lmsToRgbLin(lms);
  return rgbToHex(
    linearToSrgb(clamp01(lin[0])) * 255,
    linearToSrgb(clamp01(lin[1])) * 255,
    linearToSrgb(clamp01(lin[2])) * 255
  );
};

const lmsInGamut = (lms, margin = 0.02) => lmsToRgbLin(lms).every((v) => v >= margin && v <= 1 - margin);
export { lmsInGamut };

// --- CIE Lab (for normal-vision visibility checks) ---
export const rgbLinToLab = (rgbLin) => {
  const xyz = mulMatVec(RGB2XYZ, rgbLin);
  const wp = [0.95047, 1.0, 1.08883];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xyz[0] / wp[0]);
  const fy = f(xyz[1] / wp[1]);
  const fz = f(xyz[2] / wp[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

export const hexDeltaE = (hexA, hexB) => {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const labA = rgbLinToLab([srgbToLinear(a.r / 255), srgbToLinear(a.g / 255), srgbToLinear(a.b / 255)]);
  const labB = rgbLinToLab([srgbToLinear(b.r / 255), srgbToLinear(b.g / 255), srgbToLinear(b.b / 255)]);
  return Math.sqrt(
    (labA[0] - labB[0]) ** 2 + (labA[1] - labB[1]) ** 2 + (labA[2] - labB[2]) ** 2
  );
};

// --- confusion-axis pairs ---
// Axis = which cone the tested defect lacks: 'protan' (L), 'deutan' (M), 'tritan' (S).
// The returned { bg, fg } pair differs ONLY on that axis (within 8-bit
// quantization), so:
//   - a full dichromat of that axis sees zero difference, at any D;
//   - a trichromat sees a difference that grows with D.
//
// The sRGB gamut is narrow in the L−M direction, so pure axis shifts only
// have limited room. For each separation D we scan a grid of anchors (the
// two held cone coordinates, taken from real in-gamut colors) × centers
// (the free coordinate) and keep every combination where both colors stay
// in gamut with margin. MAX_D per axis is derived from the same scan.
export const CONE_AXIS_INDEX = { protan: 0, deutan: 1, tritan: 2 };

const ANCHOR_SAMPLES = [
  '#C04040', '#D06050', '#C88040', '#B8A040', '#90B040', '#50B060', '#40B090',
  '#4090C0', '#5060C0', '#8050C0', '#B050A0', '#909098', '#70A8A0', '#C09880',
  '#80B0B8', '#A088B0', '#B08060', '#60A878', '#5878A8', '#A85858'
];

const buildAnchors = () => {
  const anchors = { protan: [], deutan: [], tritan: [] };
  ANCHOR_SAMPLES.forEach((hex) => {
    const lms = hexToLms(hex);
    anchors.protan.push([lms[1], lms[2]]); // hold M, S
    anchors.deutan.push([lms[0], lms[2]]); // hold L, S
    anchors.tritan.push([lms[0], lms[1]]); // hold L, M
  });
  return anchors;
};
const ANCHORS = buildAnchors();

const luminanceY = (rgbLin) => 0.2126 * rgbLin[0] + 0.7152 * rgbLin[1] + 0.0722 * rgbLin[2];

const candidatePairs = (axis, D, margin = 0.015) => {
  const idx = CONE_AXIS_INDEX[axis];
  const out = [];
  ANCHORS[axis].forEach((held) => {
    for (let c = 0.05; c <= 0.95; c += 0.025) {
      const bg = [0, 0, 0];
      const fg = [0, 0, 0];
      bg[idx] = c - D / 2;
      fg[idx] = c + D / 2;
      let k = 0;
      for (let i = 0; i < 3; i++) {
        if (i === idx) continue;
        bg[i] = held[k];
        fg[i] = held[k];
        k++;
      }
      if (bg[idx] < 0.01 || fg[idx] < 0.01) continue;
      const bgLin = lmsToRgbLin(bg);
      const fgLin = lmsToRgbLin(fg);
      const inG = (v) => v.every((x) => x >= margin && x <= 1 - margin);
      if (!inG(bgLin) || !inG(fgLin)) continue;
      if (luminanceY(bgLin) < 0.14 || luminanceY(fgLin) < 0.14) continue;
      out.push({ bg: lmsToHex(bg), fg: lmsToHex(fg) });
    }
  });
  return out;
};

// Largest separation per axis that still yields several distinct in-gamut
// pairs (computed once at module load from the same scan the test uses).
export const MAX_D = {};
['protan', 'deutan', 'tritan'].forEach((axis) => {
  let best = 0.06;
  for (let D = 0.06; D <= 0.9; D += 0.02) {
    if (candidatePairs(axis, D).length >= 4) best = D;
  }
  MAX_D[axis] = Math.round(best * 100) / 100;
});

export const makeConfusablePair = (axis, D, rng = Math.random) => {
  const clampedD = Math.min(D, MAX_D[axis]);
  const options = candidatePairs(axis, clampedD);
  if (options.length === 0) {
    // extreme fallback: neutral gray pair (still axis-pure, possibly clamped)
    const idx = CONE_AXIS_INDEX[axis];
    const base = [0.45, 0.45, 0.45];
    const bg = [...base];
    const fg = [...base];
    bg[idx] = Math.max(0.05, base[idx] - clampedD / 2);
    fg[idx] = Math.min(0.95, base[idx] + clampedD / 2);
    return { bg: lmsToHex(bg), fg: lmsToHex(fg) };
  }
  return options[Math.floor(rng() * options.length)];
};

// Per-dot luminance jitter shared by fg and bg dots: masks tiny brightness
// differences (exactly why real Ishihara plates look noisy), so the only
// reliable signal is the missing-cone axis difference.
export const jitterHex = (hex, rng = Math.random, amount = 0.045) => {
  const { r, g, b } = hexToRgb(hex);
  const lin = [srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)];
  const f = 1 + (rng() * 2 - 1) * amount;
  return rgbToHex(
    linearToSrgb(clamp01(lin[0] * f)) * 255,
    linearToSrgb(clamp01(lin[1] * f)) * 255,
    linearToSrgb(clamp01(lin[2] * f)) * 255
  );
};

// --- severity mapping (continuous, log-scaled, per axis) ---
// D_FLOOR: the practical threshold of a sharp trichromat on noisy
// pseudo-isochromatic plates at a consumer display — below this, plate noise
// dominates, so it anchors severity 0. The ceiling is the axis MAX_D:
// failing to see separations that large means effectively dichromatic
// vision on that axis. (Screening anchors, not clinical values.)
export const D_FLOOR = 0.05;

export const severityFromThreshold = (D, axisCeiling = 0.7) => {
  if (!Number.isFinite(D)) return 1;
  const d = Math.max(D, D_FLOOR);
  const sev = Math.log(d / D_FLOOR) / Math.log(axisCeiling / D_FLOOR);
  return Math.max(0, Math.min(1, sev));
};

// --- dichromacy simulation (matches Colorfle's feColorMatrix exactly) ---
// Colorfle applies these matrices to gamma-encoded sRGB via SVG filters, so
// the preview here applies them the same way — what you see is what the
// game will look like.
export const CB_BASE_MATRICES = {
  protanopia: [0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0, 0, 1, 0],
  deuteranopia: [0.625, 0.375, 0, 0, 0, 0.7, 0.3, 0, 0, 0, 0, 0.3, 0.7, 0, 0, 0, 0, 0, 1, 0],
  tritanopia: [0.95, 0.05, 0, 0, 0, 0, 0.433, 0.567, 0, 0, 0, 0.475, 0.525, 0, 0, 0, 0, 0, 1, 0],
  achromatopsia: [0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 1, 0]
};
const CB_IDENTITY = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

export const getInterpolatedMatrix = (type, strength) => {
  const target = CB_BASE_MATRICES[type];
  if (!target) return CB_IDENTITY.join(',');
  return target.map((val, i) => CB_IDENTITY[i] + (val - CB_IDENTITY[i]) * strength).join(',');
};

export const applyMatrixToHex = (hex, type, strength) => {
  const m = getInterpolatedMatrix(type, strength).split(',').map(Number);
  const { r, g, b } = hexToRgb(hex);
  const nr = m[0] * r + m[1] * g + m[2] * b + m[3] * 255;
  const ng = m[5] * r + m[6] * g + m[7] * b + m[8] * 255;
  const nb = m[10] * r + m[11] * g + m[12] * b + m[13] * 255;
  return rgbToHex(nr, ng, nb);
};

// Axis key ('deutan') → Colorfle/HTML-friendly type name ('deuteranopia')
export const AXIS_TO_TYPE = { protan: 'protanopia', deutan: 'deuteranopia', tritan: 'tritanopia' };

// Primary diagnosis from per-axis severities.
// Achromatopsia hint when ALL axes are strongly affected (rare but real).
export const classify = (severities, cutoff = 0.3) => {
  const entries = Object.entries(severities).sort((a, b) => b[1] - a[1]);
  const [topAxis, topSev] = entries[0];
  const allHigh = entries.every(([, s]) => s >= 0.55);

  if (allHigh) {
    return { type: 'achromatopsia', primaryAxis: topAxis, severity: topSev, borderline: false };
  }
  if (topSev < cutoff) {
    return { type: 'normal', primaryAxis: topAxis, severity: topSev, borderline: false };
  }
  return {
    type: AXIS_TO_TYPE[topAxis],
    primaryAxis: topAxis,
    severity: topSev,
    borderline: topSev < 0.5
  };
};
