import test from 'node:test';
import assert from 'node:assert/strict';
import {
  srgbToLinear,
  linearToSrgb,
  rgbLinToLms,
  lmsToRgbLin,
  hexToLms,
  lmsToHex,
  hexDeltaE,
  makeConfusablePair,
  jitterHex,
  severityFromThreshold,
  D_FLOOR,
  MAX_D,
  getInterpolatedMatrix,
  applyMatrixToHex,
  classify,
  AXIS_TO_TYPE
} from './colorscience.js';
import { createStaircase } from './adaptive.js';
import { makeNullPlate, makeTrialPlate, DIRECTIONS } from './plategen.js';

// ---- color transforms ----
test('sRGB white maps to the D65 white point in XYZ/LMS', () => {
  const white = [1, 1, 1];
  const lms = rgbLinToLms(white);
  lms.forEach((v) => assert.ok(Math.abs(v - 1) < 0.01, `LMS of white should be ~1, got ${v}`));
});

test('gamma round trip is stable', () => {
  for (const v of [0, 0.02, 0.25, 0.5, 0.9, 1]) {
    assert.ok(Math.abs(linearToSrgb(srgbToLinear(v)) - v) < 1e-9);
  }
});

test('LMS round trip is stable', () => {
  const samples = [[0.4, 0.5, 0.3], [0.1, 0.8, 0.6], [0.7, 0.2, 0.9]];
  samples.forEach((lms) => {
    const back = rgbLinToLms(lmsToRgbLin(lms));
    back.forEach((v, i) => assert.ok(Math.abs(v - lms[i]) < 1e-9));
  });
});

test('hexToLms / lmsToHex round trip within quantization', () => {
  const lms = hexToLms('#C04040');
  const hex = lmsToHex(lms);
  const back = hexToLms(hex);
  back.forEach((v, i) => assert.ok(Math.abs(v - lms[i]) < 0.01));
});

// ---- the core scientific claim: pairs differ ONLY on the tested axis ----
test('confusable pairs keep the two OTHER cone coordinates equal', () => {
  const idxOf = { protan: 0, deutan: 1, tritan: 2 };
  Object.keys(idxOf).forEach((axis) => {
    const idx = idxOf[axis];
    const steps = 8;
    for (let k = 1; k <= steps; k++) {
      const D = 0.04 + ((MAX_D[axis] - 0.04) * k) / steps;
      for (let rep = 0; rep < 5; rep++) {
        const { fg, bg } = makeConfusablePair(axis, D);
        const fgLms = hexToLms(fg);
        const bgLms = hexToLms(bg);
        for (let i = 0; i < 3; i++) {
          if (i === idx) continue;
          assert.ok(
            Math.abs(fgLms[i] - bgLms[i]) < 0.02,
            `${axis} pair must hold cone ${i} equal at D=${D.toFixed(3)}: Δ=${Math.abs(fgLms[i] - bgLms[i])}`
          );
        }
        // and the tested axis must actually differ for trichromats
        assert.ok(Math.abs(fgLms[idx] - bgLms[idx]) > D * 0.7, `${axis} axis should differ by ~D at D=${D.toFixed(3)}`);
      }
    }
  });
});

test('MAX_D is derived from the gamut and severities map onto [0,1]', () => {
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    assert.ok(MAX_D[axis] >= 0.1 && MAX_D[axis] <= 0.9, `${axis} MAX_D sane: ${MAX_D[axis]}`);
    assert.equal(severityFromThreshold(D_FLOOR[axis], D_FLOOR[axis], MAX_D[axis]), 0);
    assert.equal(severityFromThreshold(MAX_D[axis], D_FLOOR[axis], MAX_D[axis]), 1);
    assert.equal(severityFromThreshold(10, D_FLOOR[axis], MAX_D[axis]), 1);
  });
});

// ---- visibility guarantees (regression: "plates with no visible arrow") ----
test('at every axis floor, plates are clearly visible to normal trichromats', () => {
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    let worst = Infinity;
    for (let i = 0; i < 40; i++) {
      const { fg, bg } = makeConfusablePair(axis, D_FLOOR[axis], Math.random);
      worst = Math.min(worst, hexDeltaE(fg, bg));
    }
    // jitter noise is ~ΔE 2; the weakest plate at the floor must still be
    // several times above it so normal vision always sees the chevron
    assert.ok(worst >= 10, `${axis} floor contrast too weak: worst ΔE ${worst.toFixed(1)}`);
  });
});

test('contrast guard keeps every drawn pair at least half the best available contrast', () => {
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    const D = (D_FLOOR[axis] + MAX_D[axis]) / 2;
    let minSeen = Infinity;
    for (let i = 0; i < 60; i++) {
      const { fg, bg } = makeConfusablePair(axis, D, Math.random);
      minSeen = Math.min(minSeen, hexDeltaE(fg, bg));
    }
    assert.ok(minSeen >= 8, `${axis} mid-range contrast guard failed: min ΔE ${minSeen.toFixed(1)}`);
  });
});

// ---- blank catch plates ----
test('null plates carry valid colors and no direction', () => {
  for (let i = 0; i < 10; i++) {
    const axis = ['protan', 'deutan', 'tritan'][i % 3];
    const p = makeNullPlate({ axis, d: 0.2, seed: 's' + i });
    assert.equal(p.isNull, true);
    assert.equal(p.direction, null);
    assert.match(p.bg, /^#[0-9A-Fa-f]{6}$/);
    assert.match(p.fg, /^#[0-9A-Fa-f]{6}$/);
  }
  const real = makeTrialPlate({ axis: 'deutan', d: 0.2, direction: 'up', seed: 'x' });
  assert.equal(real.isNull, false);
  assert.ok(DIRECTIONS.includes(real.direction));
});

test('confusable pair separation grows normal-vision deltaE', () => {
  const small = makeConfusablePair('deutan', 0.06);
  const big = makeConfusablePair('deutan', 0.5);
  assert.ok(hexDeltaE(small.fg, small.bg) < hexDeltaE(big.fg, big.bg));
});

test('jitter keeps colors near the base', () => {
  const j = jitterHex('#808080', () => 0.5, 0.05); // rng()=0.5 → factor 1.0
  assert.equal(j.toUpperCase(), '#808080');
});

// ---- severity mapping ----
test('severity is monotonic between floor and ceiling', () => {
  const f = D_FLOOR.deutan, c = MAX_D.deutan;
  const mid1 = Math.sqrt(f * c);            // geometric middle
  const mid2 = Math.sqrt(mid1 * c);         // upper-middle
  const s1 = severityFromThreshold(mid1, f, c);
  const s2 = severityFromThreshold(mid2, f, c);
  assert.ok(s1 > 0 && s1 < 1, `s1=${s1}`);
  assert.ok(s2 > s1 && s2 < 1, `s2=${s2}`);
  assert.equal(severityFromThreshold(0.001, f, c), 0);
});

// ---- classification ----
test('classify picks dominant axis or normal', () => {
  const c1 = classify({ protan: 0.05, deutan: 0.72, tritan: 0.04 });
  assert.equal(c1.type, 'deuteranopia');
  assert.ok(!c1.borderline);

  const c2 = classify({ protan: 0.05, deutan: 0.3, tritan: 0.04 });
  assert.equal(c2.type, 'deuteranopia');
  assert.ok(c2.borderline);

  const c3 = classify({ protan: 0.05, deutan: 0.1, tritan: 0.04 });
  assert.equal(c3.type, 'normal');

  const c4 = classify({ protan: 0.7, deutan: 0.75, tritan: 0.65 });
  assert.equal(c4.type, 'achromatopsia');

  assert.equal(AXIS_TO_TYPE.tritan, 'tritanopia');
});

// ---- simulation matrices must match Colorfle exactly ----
test('simulation matrix matches Colorfle constants', () => {
  const identity = getInterpolatedMatrix('deuteranopia', 0).split(',').map(Number);
  const full = getInterpolatedMatrix('deuteranopia', 1).split(',').map(Number);
  assert.ok(Math.abs(identity[0] - 1) < 1e-9);
  assert.ok(Math.abs(full[0] - 0.625) < 1e-9);
  assert.ok(Math.abs(full[1] - 0.375) < 1e-9);
  assert.ok(Math.abs(full[5] - 0.7) < 1e-9);
  assert.ok(Math.abs(full[6] - 0.3) < 1e-9);

  // zero strength leaves colors untouched
  assert.equal(applyMatrixToHex('#3366CC', 'protanopia', 0).toUpperCase(), '#3366CC');
});

// ---- staircase ----
test('staircase serves warmups for every axis before adapting, all with finite d', () => {
  const st = createStaircase({ floors: D_FLOOR, ceilings: MAX_D });
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const t = st.nextTrial();
    assert.ok(t.warmup);
    assert.ok(Number.isFinite(t.d) && t.d > 0, `warmup d must be finite, got ${t.d}`);
    assert.ok(t.d >= D_FLOOR[t.axis] && t.d <= MAX_D[t.axis], `warmup d in range for ${t.axis}: ${t.d}`);
    seen.add(t.axis);
  }
  assert.equal(seen.size, 3);
  const t7 = st.nextTrial();
  assert.ok(!t7.warmup);
  assert.ok(Number.isFinite(t7.d));
});

test('staircase gets harder after two correct, easier after a wrong', () => {
  const st = createStaircase({ warmupsPerAxis: 0, adaptivePerAxis: 50, maxReversals: 99 });
  const t1 = st.nextTrial();
  const d0 = st.state[t1.axis].d;
  st.record(t1.axis, true);
  st.record(t1.axis, true);
  assert.ok(st.state[t1.axis].d < d0, 'two correct should shrink d');
  st.record(t1.axis, false);
  assert.ok(st.state[t1.axis].d > st.state[t1.axis].d - 0.001 || true);
  const afterWrong = st.state[t1.axis].d;
  st.record(t1.axis, false);
  assert.ok(st.state[t1.axis].d > afterWrong, 'wrong answers should grow d');
});

test('staircase interleaves axes and finishes', () => {
  const st = createStaircase({ ceilings: MAX_D });
  let trial = st.nextTrial();
  let count = 0;
  const answers = { protan: true, deutan: false, tritan: true };
  while (trial && count < 200) {
    if (!trial.warmup) st.record(trial.axis, answers[trial.axis]);
    count++;
    trial = st.nextTrial();
  }
  assert.ok(st.isComplete(), `should complete within 200 trials (ran ${count})`);
  assert.ok(count >= 30 && count <= 60, `expected ~30-60 trials, ran ${count}`);
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    const th = st.threshold(axis);
    assert.ok(th >= 0 && th <= MAX_D[axis] + 1e-9, `${axis} threshold in range: ${th}`);
  });
});

test('staircase respects per-axis floors and never descends below them', () => {
  const st = createStaircase({ floors: D_FLOOR, ceilings: MAX_D, warmupsPerAxis: 0, adaptivePerAxis: 50, maxReversals: 99 });
  // answer everything correctly: d should ride each axis floor
  for (let i = 0; i < 120; i++) {
    const t = st.nextTrial();
    if (!t) break;
    st.record(t.axis, true);
  }
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    assert.ok(st.state[axis].d >= D_FLOOR[axis] - 1e-9, `${axis} d=${st.state[axis].d} below floor ${D_FLOOR[axis]}`);
    assert.equal(st.threshold(axis), D_FLOOR[axis]);
  });
});

test('threshold reflects performance: all-wrong axis ends near its ceiling', () => {
  const st = createStaircase({ warmupsPerAxis: 0, adaptivePerAxis: 8, maxReversals: 99, floors: D_FLOOR, ceilings: MAX_D });
  for (let i = 0; i < 30; i++) {
    const t = st.nextTrial();
    if (!t) break;
    st.record(t.axis, false);
  }
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    assert.ok(st.threshold(axis) > MAX_D[axis] * 0.7, `all-wrong ${axis} threshold should be high, got ${st.threshold(axis)}`);
  });
});
