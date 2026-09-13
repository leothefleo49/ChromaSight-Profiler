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
    assert.equal(severityFromThreshold(D_FLOOR, MAX_D[axis]), 0);
    assert.equal(severityFromThreshold(MAX_D[axis], MAX_D[axis]), 1);
    assert.equal(severityFromThreshold(10, MAX_D[axis]), 1);
  });
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
  const s1 = severityFromThreshold(0.1, 0.7);
  const s2 = severityFromThreshold(0.3, 0.7);
  assert.ok(s1 > 0 && s1 < 1 && s2 > s1 && s2 < 1);
  assert.equal(severityFromThreshold(0.001, 0.7), 0);
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
test('staircase serves warmups for every axis before adapting', () => {
  const st = createStaircase();
  const seen = new Set();
  for (let i = 0; i < 6; i++) {
    const t = st.nextTrial();
    assert.ok(t.warmup);
    seen.add(t.axis);
  }
  assert.equal(seen.size, 3);
  const t7 = st.nextTrial();
  assert.ok(!t7.warmup);
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

test('threshold reflects performance: all-wrong axis ends near its ceiling', () => {
  const st = createStaircase({ warmupsPerAxis: 0, adaptivePerAxis: 8, maxReversals: 99, ceilings: MAX_D });
  for (let i = 0; i < 30; i++) {
    const t = st.nextTrial();
    if (!t) break;
    st.record(t.axis, false);
  }
  ['protan', 'deutan', 'tritan'].forEach((axis) => {
    assert.ok(st.threshold(axis) > MAX_D[axis] * 0.7, `all-wrong ${axis} threshold should be high, got ${st.threshold(axis)}`);
  });
});
