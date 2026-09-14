// Adaptive transformed-staircase controller (2-down / 1-up) for ChromaSight.
//
// Classic psychophysics: step difficulty down (smaller cone-axis separation)
// after two consecutive correct answers, up after one wrong. This converges
// to the ~70.7% correct point — the standard threshold estimate — separately
// for each cone-confusion axis, with axes interleaved so the user can't
// settle into a rhythm.
//
// Pure logic: no DOM, no React — unit-testable in plain Node.

export const createStaircase = ({
  axes = ['protan', 'deutan', 'tritan'],
  startD,
  floors,
  ceilings,
  warmupsPerAxis = 2,
  adaptivePerAxis = 8,
  maxReversals = 5
} = {}) => {
  const ceilOf = (a) => (ceilings && ceilings[a]) || 0.7;
  const floorOf = (a) => (floors && floors[a]) || 0.05;
  const state = {};
  axes.forEach((axis) => {
    state[axis] = {
      // start at the geometric middle of the axis range unless given
      d: startD ?? Math.sqrt(floorOf(axis) * ceilOf(axis)),
      consecutiveCorrect: 0,
      reversals: [], // { d, direction }
      lastStep: null,
      warmupTrials: 0,
      adaptiveTrials: 0,
      done: false
    };
  });

  let lastAxis = null;

  const axisDone = (a) => state[a].adaptiveTrials >= adaptivePerAxis || state[a].reversals.length >= maxReversals;

  const nextTrial = () => {
    // warm-up phase first: every axis gets its easy trials before adapting
    const warmupAxis = axes.find((a) => state[a].warmupTrials < warmupsPerAxis);
    if (warmupAxis) {
      state[warmupAxis].warmupTrials += 1;
      lastAxis = warmupAxis;
      return { axis: warmupAxis, d: startD, warmup: true };
    }

    const remaining = axes.filter((a) => !axisDone(a));
    if (remaining.length === 0) return null;

    // prefer the axis with the fewest adaptive trials; avoid immediate repeats
    let pool = remaining.filter((a) => a !== lastAxis);
    if (pool.length === 0) pool = remaining;
    pool.sort((a, b) => state[a].adaptiveTrials - state[b].adaptiveTrials);
    const minTrials = state[pool[0]].adaptiveTrials;
    const tied = pool.filter((a) => state[a].adaptiveTrials === minTrials);
    const axis = tied[Math.floor(Math.random() * tied.length)];

    lastAxis = axis;
    return { axis, d: state[axis].d, warmup: false };
  };

  // wrong → easier plate (bigger separation); 2 right in a row → harder.
  // Record is only called for adaptive (non-warmup) trials.
  const record = (axis, correct) => {
    const s = state[axis];
    if (s.done) return;

    if (!correct) {
      s.consecutiveCorrect = 0;
      if (s.lastStep !== 'up') s.reversals.push({ d: s.d, direction: 'up' });
      s.lastStep = 'up';
      s.d = Math.min(ceilOf(axis), s.d * 1.5);
    } else {
      s.consecutiveCorrect += 1;
      if (s.consecutiveCorrect >= 2) {
        s.consecutiveCorrect = 0;
        if (s.lastStep !== 'down') s.reversals.push({ d: s.d, direction: 'down' });
        s.lastStep = 'down';
        s.d = Math.max(floorOf(axis), s.d * 0.7);
      }
    }

    s.adaptiveTrials += 1;
    if (axisDone(axis)) s.done = true;
  };

  // Threshold estimate: geometric mean of the last 4 reversal intensities;
  // fall back to the final d when the user ran the staircase to a boundary.
  const threshold = (axis) => {
    const s = state[axis];
    const revs = s.reversals.slice(-4);
    if (revs.length >= 2) {
      return Math.exp(revs.reduce((acc, r) => acc + Math.log(r.d), 0) / revs.length);
    }
    return s.d;
  };

  const progress = () => {
    const totalWarmups = axes.length * warmupsPerAxis;
    const totalAdaptive = axes.length * adaptivePerAxis;
    const doneWarmups = axes.reduce((acc, a) => acc + Math.min(state[a].warmupTrials, warmupsPerAxis), 0);
    const doneAdaptive = axes.reduce((acc, a) => acc + state[a].adaptiveTrials, 0);
    return (doneWarmups + doneAdaptive) / (totalWarmups + totalAdaptive);
  };

  const isComplete = () => axes.every(axisDone);

  return { nextTrial, record, threshold, progress, isComplete, state };
};
