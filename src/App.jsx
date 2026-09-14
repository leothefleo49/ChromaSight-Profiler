import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createStaircase } from './adaptive.js';
import { makeTrialPlate, makeControlPlate, makeNullPlate, renderPlate, DIRECTIONS } from './plategen.js';
import {
  MAX_D,
  D_FLOOR,
  severityFromThreshold,
  classify,
  getInterpolatedMatrix
} from './colorscience.js';

const COLORFLE_URL = 'https://colorfle-unlimited.vercel.app';
const HISTORY_KEY = 'chromasight_history_v2';
const LAST_KEY = 'chromasight_last_v2';

const AXES = ['protan', 'deutan', 'tritan'];
const MAX_BLANK_TRIALS = 3;
const BLANK_CHANCE = 0.15;
const AXIS_LABELS = { protan: 'Protan (L cone / red)', deutan: 'Deutan (M cone / green)', tritan: 'Tritan (S cone / blue)' };
const AXIS_COLORS = { protan: 'bg-rose-500', deutan: 'bg-emerald-500', tritan: 'bg-sky-500' };

const readJson = (key, fallback) => {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch (e) {
    return fallback;
  }
};

const encodeProfileB64 = (profile) =>
  btoa(JSON.stringify(profile)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const TYPE_INFO = {
  normal: { title: 'Normal Color Perception', blurb: 'Your thresholds along all three cone-confusion axes are within the normal trichromat range. No color assistance needed.' },
  protanopia: { title: 'Protan-type Deficiency', blurb: 'Elevated threshold along the L-cone (red) confusion axis. Reds appear darker and red/green hues can collapse.' },
  deuteranopia: { title: 'Deutan-type Deficiency', blurb: 'Elevated threshold along the M-cone (green) confusion axis — the most common form of color blindness. Red/green hues can collapse.' },
  tritanopia: { title: 'Tritan-type Deficiency', blurb: 'Elevated threshold along the S-cone (blue) confusion axis. Blue/yellow hues can collapse. (Rare — worth confirming clinically.)' },
  achromatopsia: { title: 'Strong Deficiency on All Axes', blurb: 'All three axes show strongly elevated thresholds. This pattern can indicate achromatopsia (monochromacy) or a very dim/miscalibrated screen — verify with controls on another display.' }
};

// ---------- Colorfle preview board ----------
const PREVIEW_PALETTE = ['#EF4444', '#FB923C', '#FACC15', '#84CC16', '#16A34A', '#06B6D4', '#2563EB', '#9333EA', '#F472B6', '#6B7280'];
const PREVIEW_SLICES = ['#EF4444', '#FACC15', '#16A34A'];
const PREVIEW_TARGET = '#9333EA';

const ColorflePreview = ({ type, strength, view, setView }) => {
  const filtered = view === 'standard' ? null : { type, strength };
  const assisted = view === 'assisted';

  const tileBorder = (status) => {
    if (!assisted) {
      if (status === 'correct') return 'border-emerald-500 border-4';
      if (status === 'present') return 'border-amber-400 border-4';
      return 'border-slate-700';
    }
    if (status === 'correct') return 'border-blue-500 border-4';
    if (status === 'present') return 'border-orange-500 border-4';
    return 'border-slate-700';
  };

  const symbol = (status) =>
    assisted ? (status === 'correct' ? '✓' : status === 'present' ? '⟳' : '✕') : null;

  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-1.5">
        {[
          ['standard', 'Standard vision'],
          ['yours', 'Your vision'],
          ['assisted', 'With Colorfle assist']
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={'px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ' + (
              view === id ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-xs rounded-2xl border border-slate-800 bg-[#12131C] p-3 shadow-inner">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <filter id="preview-sim">
              <feColorMatrix type="matrix" values={filtered ? getInterpolatedMatrix(filtered.type, filtered.strength) : getInterpolatedMatrix('deuteranopia', 0)} />
            </filter>
          </defs>
        </svg>

        <div style={filtered ? { filter: 'url(#preview-sim)' } : undefined} className="flex flex-col items-center gap-2.5">
          {/* the pie wheel: target right half, player slices left */}
          <div className="w-28 h-28 rounded-full border-4 border-slate-700 overflow-hidden">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              <path d="M 100 100 L 100 10 A 90 90 0 0 1 100 190 Z" fill={PREVIEW_TARGET} />
              <path d="M 100 100 L 100 10 A 90 90 0 0 0 10 100 Z" fill={PREVIEW_SLICES[0]} />
              <path d="M 100 100 L 10 100 A 90 90 0 0 0 73 171.8 Z" fill={PREVIEW_SLICES[1]} />
              <path d="M 100 100 L 73 171.8 A 90 90 0 0 0 100 190 Z" fill={PREVIEW_SLICES[2]} />
            </svg>
          </div>

          {/* a sample guess row with Wordle-style feedback */}
          <div className="flex items-center gap-1.5">
            {[
              ['#EF4444', 'correct'],
              ['#16A34A', 'present'],
              ['#FACC15', 'absent']
            ].map(([hex, status], i) => (
              <div
                key={i}
                className={'w-8 h-8 rounded-lg flex items-center justify-center relative ' + tileBorder(status)}
                style={{ backgroundColor: hex }}
              >
                {symbol(status) && (
                  <span className={'text-[11px] font-black drop-shadow ' + (status === 'correct' ? 'text-blue-300' : status === 'present' ? 'text-orange-300' : 'text-slate-300')}>
                    {symbol(status)}
                  </span>
                )}
              </div>
            ))}
            <div className="ml-1 w-8 h-8 rounded-full border-2 border-slate-700 flex items-center justify-center text-[9px] font-black text-white" style={{ backgroundColor: '#7A6BAA' }}>
              82%
            </div>
          </div>

          {/* palette keyboard */}
          <div className="flex flex-wrap justify-center gap-1 max-w-[240px]">
            {PREVIEW_PALETTE.map((hex, i) => (
              <div
                key={i}
                className={'w-6 h-6 rounded-md border shadow-sm flex items-center justify-center ' + (assisted ? 'border-blue-500 border-2' : 'border-slate-600')}
                style={{ backgroundColor: hex }}
              >
                {assisted && <span className="text-[6px] font-black text-white drop-shadow">{hex.slice(1, 4).toUpperCase()}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-[9px] text-slate-400 mt-2 leading-relaxed">
          {view === 'standard' && 'How the game looks with standard trichromatic vision.'}
          {view === 'yours' && `How the game looks for you: ${type} simulation at ${Math.round(strength * 100)}% — the measured severity from your test.`}
          {view === 'assisted' && 'Colorfle\'s assistive mode (high-contrast blue/orange borders, symbols, swatch labels) restores playability.'}
        </div>
      </div>
    </div>
  );
};

// ---------- main app ----------
export default function App() {
  const [phase, setPhase] = useState('welcome'); // welcome | testing | results
  const [trial, setTrial] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [previewView, setPreviewView] = useState('yours');

  const canvasRef = useRef(null);
  const staircaseRef = useRef(null);
  const sessionRef = useRef({});
  const toastTimer = useRef(null);

  const fromColorfle = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('from') === 'colorfle';
    } catch (e) {
      return false;
    }
  }, []);

  const [history, setHistory] = useState(() => readJson(HISTORY_KEY, []));
  const [lastResult, setLastResult] = useState(() => readJson(LAST_KEY, null));

  const resultsRef = useRef(null);
  const [results, setResults] = useState(null);

  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => setToastMessage(''), 2800);
  }, []);

  // --- session lifecycle ---
  const beginSession = () => {
    staircaseRef.current = createStaircase({ floors: D_FLOOR, ceilings: MAX_D });
    sessionRef.current = {
      nonce: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      trialNum: 0,
      controlResults: [],
      controlCheckpoints: [1, 15], // trial numbers (post-answer counts) where a control is injected
      finalControlDone: false,
      blanksUsed: 0,
      blanksCaught: 0,
      blankFalsePositives: 0,
      lastWasBlank: false
    };
    setAnsweredCount(0);
    setResults(null);
    setPhase('testing');
    advanceTrial();
  };

  const buildTrial = (kind) => {
    const s = sessionRef.current;
    s.trialNum += 1;
    const direction = DIRECTIONS[Math.floor(Math.random() * 4)];
    const seed = s.nonce + '-' + s.trialNum;

    if (kind === 'control') {
      return { kind, plate: makeControlPlate({ direction, seed }), direction, seed };
    }
    const t = staircaseRef.current.nextTrial();
    if (!t) return null;
    const d = Math.min(t.d, MAX_D[t.axis]);

    // Blank (catch) plates: same colors/difficulty as a real plate, no
    // chevron. They don't consume staircase trials — a "No arrow" answer is
    // correct on them, and reporting a direction on one is a false positive.
    if (!t.warmup && s.blanksUsed < MAX_BLANK_TRIALS && !s.lastWasBlank && Math.random() < BLANK_CHANCE) {
      s.blanksUsed += 1;
      s.lastWasBlank = true;
      return {
        kind: 'blank',
        axis: t.axis,
        d,
        direction: null,
        seed,
        plate: makeNullPlate({ axis: t.axis, d, seed })
      };
    }
    s.lastWasBlank = false;

    return {
      kind: t.warmup ? 'warmup' : 'adaptive',
      axis: t.axis,
      d,
      direction,
      seed,
      plate: makeTrialPlate({ axis: t.axis, d, direction, seed })
    };
  };

  const advanceTrial = () => {
    const s = sessionRef.current;

    // inject control plates at checkpoints and at the very end
    const needControl = s.controlCheckpoints.includes(s.trialNum + 1);
    const next = buildTrial(needControl ? 'control' : 'test');

    if (next) {
      setTrial(next);
      setAnsweredCount(s.trialNum);
      return;
    }

    if (!s.finalControlDone) {
      s.finalControlDone = true;
      const control = buildTrial('control');
      setTrial(control);
      setAnsweredCount(s.trialNum);
      return;
    }

    finishSession();
  };

  const handleAnswer = (dir) => {
    if (!trial || isLocked || phase !== 'testing') return;
    const st = staircaseRef.current;
    const s = sessionRef.current;

    if (trial.kind === 'blank') {
      if (dir === null) s.blanksCaught += 1;
      else s.blankFalsePositives += 1;
    } else if (trial.kind === 'control') {
      s.controlResults.push(dir !== null && dir === trial.direction);
    } else if (trial.kind === 'adaptive' && st) {
      // "No arrow" on a real plate means the chevron wasn't visible at this
      // difficulty — an honest wrong answer that steers the staircase up.
      st.record(trial.axis, dir !== null && dir === trial.direction);
    }

    setIsLocked(true);
    setTimeout(() => {
      setIsLocked(false);
      advanceTrial();
    }, 220);
  };

  const finishSession = () => {
    const st = staircaseRef.current;
    const s = sessionRef.current;

    const severities = {};
    AXES.forEach((axis) => {
      severities[axis] = severityFromThreshold(st.threshold(axis), D_FLOOR[axis], MAX_D[axis]);
    });
    const cls = classify(severities);
    const controlsPassed = s.controlResults.filter(Boolean).length;
    const controlsTotal = s.controlResults.length;
    const controlsFailed = controlsTotal >= 2 && controlsPassed < controlsTotal - 1;
    const blanksFailed = s.blanksUsed >= 2 && s.blankFalsePositives >= Math.ceil(s.blanksUsed / 2);

    const result = {
      type: cls.type,
      severity: cls.type === 'normal' ? 0 : cls.severity,
      severities,
      borderline: cls.borderline,
      controlsPassed,
      controlsTotal,
      blanksUsed: s.blanksUsed,
      blanksCaught: s.blanksCaught,
      blankFalsePositives: s.blankFalsePositives,
      lowReliability: controlsFailed || blanksFailed,
      trials: s.trialNum,
      testedAt: new Date().toISOString().slice(0, 10)
    };
    resultsRef.current = result;
    setResults(result);
    setTrial(null);
    setPhase('results');

    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(result));
      const h = [result, ...history].slice(0, 6);
      setHistory(h);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
    } catch (e) {}
  };

  // --- results → profile ---
  const profileJson = useMemo(() => {
    if (!results) return '';
    // 'normal' exports a zero-strength simulation (identity) so Colorfle
    // accepts the profile cleanly without enabling any filter effect
    const simType = results.type === 'normal' ? 'deuteranopia' : results.type;
    return JSON.stringify({
      v: 2,
      app: 'chromasight',
      type: simType,
      strength: Math.round(results.severity * 100) / 100,
      axes: {
        protanopia: Math.round(results.severities.protan * 100) / 100,
        deuteranopia: Math.round(results.severities.deutan * 100) / 100,
        tritanopia: Math.round(results.severities.tritan * 100) / 100
      },
      reliability: results.lowReliability ? 'low' : 'ok',
      testedAt: results.testedAt
    }, null, 2);
  }, [results]);

  const sendToColorfle = () => {
    if (!results) return;
    const profile = JSON.parse(profileJson);
    window.location.href = COLORFLE_URL + '#cb-profile=' + encodeProfileB64(profile);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      showToast('Profile copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    }).catch(() => {
      showToast('Copy failed — select the text manually.');
    });
  };

  // --- plate rendering ---
  useEffect(() => {
    if (phase !== 'testing' || !trial || !canvasRef.current) return;
    renderPlate(canvasRef.current, trial.plate, trial.seed);
  }, [phase, trial]);

  // --- keyboard controls ---
  useEffect(() => {
    if (phase !== 'testing') return;
    const onKey = (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const map = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right'
      };
      if (map[e.key]) {
        e.preventDefault();
        handleAnswer(map[e.key]);
      } else if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
        e.preventDefault();
        handleAnswer(null);
      } else if (e.key === 'Escape') {
        setPhase('welcome');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const totalTrialsEstimate = 2 * 3 + 8 * 3 + 3; // warmups + adaptive + controls
  const progressPct = Math.min(100, Math.round((answeredCount / totalTrialsEstimate) * 100));

  return (
    <div className="min-h-screen bg-[#090C15] text-slate-100 font-sans flex flex-col items-center justify-between p-4 selection:bg-purple-500 selection:text-white relative">

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full border border-purple-500/60 shadow-2xl text-xs font-bold animate-fade-in flex items-center gap-2" role="status">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --- HEADER --- */}
      <header className="w-full max-w-lg flex items-center justify-between py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-950/50 border border-purple-400/30">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-indigo-200 to-slate-100">
              ChromaSight
            </h1>
            <span className="text-[10px] text-slate-400 font-bold block -mt-1 tracking-wider uppercase">Adaptive Vision Profiler</span>
          </div>
        </div>

        {phase === 'testing' && trial && (
          <div className="text-xs font-bold bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <span className={'w-2 h-2 rounded-full animate-pulse ' + (trial.kind === 'control' ? 'bg-amber-400' : 'bg-purple-500')} />
            <span>
              {trial.kind === 'control' ? 'Check plate' : 'Trial'} {answeredCount + 1}
            </span>
          </div>
        )}
      </header>

      {/* --- WELCOME --- */}
      {phase === 'welcome' && (
        <div className="w-full max-w-md my-auto flex flex-col items-center text-center gap-5 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-950 to-indigo-950 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-wide">Adaptive Color Vision Test</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              Measures your thresholds along the <strong>Protan</strong>, <strong>Deutan</strong>, and <strong>Tritan</strong> cone-confusion axes using an adaptive staircase — the same principle as laboratory color vision tests — with a continuous severity estimate instead of coarse pass/fail plates.
            </p>
          </div>

          {fromColorfle && (
            <div className="w-full p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-[11px] text-purple-200 text-left flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
              Opened from Colorfle — finish the test, then tap <strong>Send to Colorfle</strong> to apply your profile instantly.
            </div>
          )}

          <div className="w-full bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left text-xs text-slate-300 space-y-1.5">
            <div className="font-bold text-purple-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Before You Start</span>
            </div>
            <p>1. Screen brightness at <strong>max</strong>, no night-shift / blue-light filters.</p>
            <p>2. View from about <strong>50–70 cm</strong>, ambient light on, no glare.</p>
            <p>3. A chevron <strong>▲</strong> hides in most plates — answer the direction it points.</p>
            <p>4. <strong>Some plates are intentionally blank.</strong> If you see no chevron, tap <strong>No arrow</strong> (or press <strong>N</strong>) — never guess a direction.</p>
            <p>5. Arrow keys / compass to answer. Takes about <strong>3 minutes</strong>.</p>
          </div>

          {lastResult && (
            <div className="w-full p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-left">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Last result</div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-white">{(TYPE_INFO[lastResult.type] || TYPE_INFO.normal).title}</div>
                  <div className="text-[10px] text-slate-400">
                    {lastResult.type === 'normal' ? 'No assistance needed' : `Severity ${Math.round(lastResult.severity * 100)}%`} • {lastResult.testedAt}
                  </div>
                </div>
                {lastResult.type !== 'normal' && (
                  <button
                    onClick={() => {
                      const profile = {
                        v: 2,
                        app: 'chromasight',
                        type: lastResult.type,
                        strength: Math.round(lastResult.severity * 100) / 100,
                        testedAt: lastResult.testedAt
                      };
                      window.location.href = COLORFLE_URL + '#cb-profile=' + encodeProfileB64(profile);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition shrink-0"
                  >
                    Send to Colorfle
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={beginSession}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-950/40 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Begin Assessment</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}

      {/* --- TESTING --- */}
      {phase === 'testing' && trial && (
        <div className="w-full max-w-md my-auto flex flex-col items-center gap-4">

          <div className="w-full max-w-xs">
            <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
              <span>{trial.kind === 'control' ? 'Attention check — this one should be easy' : 'Adaptive measurement in progress'}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all duration-300" style={{ width: progressPct + '%' }} />
            </div>
          </div>

          <div className="relative flex flex-col items-center">
            <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-full border-4 border-slate-800 shadow-2xl relative overflow-hidden bg-slate-950">
              <canvas
                ref={canvasRef}
                width={360}
                height={360}
                className={'w-full h-full rounded-full transition-opacity duration-150 ' + (isLocked ? 'opacity-60' : 'opacity-100')}
              />
            </div>
            <div className="text-[11px] text-slate-400 font-semibold mt-2.5 text-center">
              Which way does the hidden chevron point?
              <span className="block text-[9px] text-slate-500 mt-0.5">Some plates are intentionally blank — if there&apos;s no chevron, tap <strong className="text-slate-300">No arrow</strong>.</span>
            </div>
          </div>

          {/* Compass answer pad */}
          <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-44 h-44">
            <div />
            <button onClick={() => handleAnswer('up')} disabled={isLocked} aria-label="Up" className="rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 flex items-center justify-center transition active:scale-95">
              <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
            </button>
            <div />
            <button onClick={() => handleAnswer('left')} disabled={isLocked} aria-label="Left" className="rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 flex items-center justify-center transition active:scale-95">
              <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              onClick={() => handleAnswer(null)}
              disabled={isLocked}
              aria-label="No arrow"
              className="rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 disabled:opacity-50 flex flex-col items-center justify-center transition active:scale-95"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <span className="text-[8px] font-black uppercase tracking-wider text-amber-300 mt-0.5">No arrow</span>
            </button>
            <button onClick={() => handleAnswer('right')} disabled={isLocked} aria-label="Right" className="rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 flex items-center justify-center transition active:scale-95">
              <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </button>
            <div />
            <button onClick={() => handleAnswer('down')} disabled={isLocked} aria-label="Down" className="rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 flex items-center justify-center transition active:scale-95">
              <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div />
          </div>

          <div className="text-[9px] text-slate-500 text-center -mt-2">Arrow keys answer · N or Space = No arrow</div>

          <button
            onClick={() => {
              if (window.confirm('Abort the test and return to the start? Results will be discarded.')) setPhase('welcome');
            }}
            className="text-[10px] text-slate-500 hover:text-rose-400 font-bold transition"
          >
            Abort test
          </button>
        </div>
      )}

      {/* --- RESULTS --- */}
      {phase === 'results' && results && (
        <div className="w-full max-w-md my-auto flex flex-col gap-4 p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md max-h-none">

          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-purple-300">Assessment Complete</h2>
            <p className="text-xs text-slate-400">Adaptive cone-confusion threshold profile • {results.trials} trials</p>
          </div>

          {/* Diagnosis */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-purple-500/40 text-center space-y-1.5 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected Diagnosis</div>
            <div className="text-lg font-black text-white">{(TYPE_INFO[results.type] || TYPE_INFO.normal).title}</div>
            {results.type !== 'normal' && results.type !== 'achromatopsia' && (
              <div className="text-xs font-bold text-purple-400">
                Severity: {Math.round(results.severity * 100)}% {results.borderline && <span className="text-amber-400">(borderline — confirm with a retest)</span>}
              </div>
            )}
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto pt-1">{(TYPE_INFO[results.type] || TYPE_INFO.normal).blurb}</p>
            {results.controlsTotal > 0 && results.controlsPassed < results.controlsTotal && (
              <div className="text-[10px] text-amber-400 font-bold pt-1">
                ⚠ Attention checks missed ({results.controlsPassed}/{results.controlsTotal}) — screen or attention issue; consider retaking.
              </div>
            )}
            {results.blankFalsePositives > 0 && (
              <div className="text-[10px] text-amber-400 font-bold pt-1">
                ⚠ Reported chevrons on {results.blankFalsePositives} of {results.blanksUsed} blank plate{results.blanksUsed === 1 ? '' : 's'} — answers on pure noise inflate the result; retake without guessing.
              </div>
            )}
            {results.blanksUsed > 0 && results.blankFalsePositives === 0 && (
              <div className="text-[10px] text-emerald-500/90 font-bold pt-1">
                ✓ Blank checks passed ({results.blanksCaught}/{results.blanksUsed} correctly called blank)
              </div>
            )}
            <div className="text-[9px] text-slate-500 pt-1">Screening estimate — not a clinical diagnosis.</div>
          </div>

          {/* Per-axis meters */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Axis Threshold Severities</div>
            {AXES.map((axis) => (
              <div key={axis} className="flex items-center gap-2">
                <span className="w-32 text-[10px] text-slate-400 font-bold shrink-0">{AXIS_LABELS[axis]}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={'h-full rounded-full transition-all duration-700 ' + AXIS_COLORS[axis]}
                    style={{ width: Math.max(2, results.severities[axis] * 100) + '%' }}
                  />
                </div>
                <span className="w-9 text-right text-[10px] font-black text-white">{Math.round(results.severities[axis] * 100)}%</span>
              </div>
            ))}
            <div className="text-[9px] text-slate-500">0% = normal trichromat threshold • 100% = effectively dichromatic on that axis</div>
          </div>

          {/* Colorfle preview */}
          <div className="space-y-2 p-3 rounded-2xl bg-slate-950/50 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What Colorfle looks like for you</div>
            </div>
            <ColorflePreview
              type={results.type === 'normal' ? 'deuteranopia' : (results.type === 'achromatopsia' ? 'achromatopsia' : results.type)}
              strength={results.severity}
              view={previewView}
              setView={setPreviewView}
            />
          </div>

          {/* Export */}
          <div className="space-y-2">
            <button
              onClick={sendToColorfle}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              Send to Colorfle — Apply My Profile
            </button>

            <button
              onClick={() => copyToClipboard(profileJson)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              {isCopied ? (
                <>
                  <svg className="w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Profile Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy Profile JSON (manual import)</span>
                </>
              )}
            </button>

            <details className="group">
              <summary className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer font-bold select-none">Show raw profile JSON</summary>
              <textarea
                readOnly
                value={profileJson}
                rows={7}
                className="w-full mt-1.5 bg-slate-950 text-purple-300 font-mono text-[10px] p-3 rounded-xl border border-slate-800 resize-none shadow-inner focus:outline-none"
              />
            </details>
          </div>

          {/* History */}
          {history.length > 1 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">History</div>
              <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar pr-1">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
                    <span className="text-slate-300 font-bold">{(TYPE_INFO[h.type] || TYPE_INFO.normal).title}</span>
                    <span className="text-slate-500">
                      {h.type === 'normal' ? '—' : Math.round(h.severity * 100) + '%'} • {h.testedAt}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={beginSession}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retake Test</span>
            </button>
            <button
              onClick={() => setPhase('welcome')}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
            >
              Home
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-[10px] text-slate-500 text-center py-2">
        ChromaSight Profiler • LMS cone-space adaptive psychophysics • Screening tool, not a medical device
      </footer>

    </div>
  );
}
