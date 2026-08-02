import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- SOUND & HAPTIC SYNTHESIZER ---
const playSound = (type) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'tap') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'win' || type === 'finish') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.1);
        gain.gain.setValueAtTime(0.15, now + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.3);
      });
    }
  } catch (e) {}
};

const triggerHaptic = (type) => {
  if (typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'tap') navigator.vibrate(25);
    else if (type === 'error') navigator.vibrate([50, 30, 50]);
    else if (type === 'finish') navigator.vibrate([60, 40, 60, 40, 120]);
  } catch (e) {}
};

// --- TEST CONFIGURATION ---
// We test the 3 primary color confusion axes.
const TEST_AXES = [
  {
    id: 'deuteranopia',
    name: 'Deutan (Green-Red)',
    description: 'Testing sensitivity to green and red hues.',
    baseHue: 130, // Green
    targetDir: -1, // Shift towards red/yellow
  },
  {
    id: 'protanopia',
    name: 'Protan (Red-Green)',
    description: 'Testing sensitivity to deep reds.',
    baseHue: 5, // Red
    targetDir: 1, // Shift towards orange/green
  },
  {
    id: 'tritanopia',
    name: 'Tritan (Blue-Yellow)',
    description: 'Testing sensitivity to blue and yellow hues.',
    baseHue: 225, // Blue
    targetDir: 1, // Shift towards cyan/green
  }
];

export default function App() {
  // App States
  const [phase, setPhase] = useState('intro'); // 'intro', 'testing', 'result'
  
  // Test States
  const [axisIndex, setAxisIndex] = useState(0);
  const [level, setLevel] = useState(0);
  const [lives, setLives] = useState(3);
  const [scores, setScores] = useState({ deuteranopia: 0, protanopia: 0, tritanopia: 0 });
  
  // Grid States
  const [targetIndex, setTargetIndex] = useState(0);
  const [tiles, setTiles] = useState([]);
  const [shake, setShake] = useState(false);

  // Generate grid for the current level
  const generateGrid = useCallback(() => {
    const currentAxis = TEST_AXES[axisIndex];
    // Grid size scales up as level increases (2x2 -> 3x3 -> 4x4 -> ... up to 8x8)
    const size = Math.min(8, Math.floor(level / 4) + 2);
    const totalTiles = size * size;
    
    // Delta (hue difference) decreases exponentially to find the threshold of perception
    const deltaHue = Math.max(1.5, 35 * Math.pow(0.85, level));
    
    const targetIdx = Math.floor(Math.random() * totalTiles);
    setTargetIndex(targetIdx);

    const newTiles = [];
    for (let i = 0; i < totalTiles; i++) {
      // Add random lightness noise to prevent cheating via screen brightness
      const lNoise = Math.random() * 10 - 5; 
      const lightness = 55 + lNoise;
      const saturation = 65 + (Math.random() * 10 - 5);

      if (i === targetIdx) {
        // Target Tile
        const h = currentAxis.baseHue + (deltaHue * currentAxis.targetDir);
        newTiles.push({ h, s: saturation, l: lightness, isTarget: true });
      } else {
        // Base Tile
        newTiles.push({ h: currentAxis.baseHue, s: saturation, l: lightness, isTarget: false });
      }
    }
    
    setTiles(newTiles);
  }, [axisIndex, level]);

  // Initialize grid when level or axis changes
  useEffect(() => {
    if (phase === 'testing') {
      generateGrid();
    }
  }, [phase, axisIndex, level, generateGrid]);

  const handleTileClick = (isTarget) => {
    if (isTarget) {
      playSound('tap');
      triggerHaptic('tap');
      setLevel(l => l + 1);
    } else {
      playSound('error');
      triggerHaptic('error');
      setShake(true);
      setTimeout(() => setShake(false), 400);
      
      const newLives = lives - 1;
      setLives(newLives);

      if (newLives <= 0) {
        // Axis Test Completed
        const currentAxisId = TEST_AXES[axisIndex].id;
        setScores(prev => ({ ...prev, [currentAxisId]: level }));
        
        if (axisIndex < TEST_AXES.length - 1) {
          // Move to next axis
          setAxisIndex(i => i + 1);
          setLevel(0);
          setLives(3);
        } else {
          // Finish test
          playSound('finish');
          triggerHaptic('finish');
          setPhase('result');
        }
      }
    }
  };

  const startTest = () => {
    setScores({ deuteranopia: 0, protanopia: 0, tritanopia: 0 });
    setAxisIndex(0);
    setLevel(0);
    setLives(3);
    setPhase('testing');
  };

  // --- RESULT CALCULATION ---
  const resultData = useMemo(() => {
    if (phase !== 'result') return null;

    // Normal vision threshold (typically reaching level 18+ on all axes)
    const THRESHOLD = 16;
    
    let lowestScore = Infinity;
    let worstType = 'none';

    Object.entries(scores).forEach(([type, score]) => {
      if (score < lowestScore) {
        lowestScore = score;
        worstType = type;
      }
    });

    if (lowestScore >= THRESHOLD) {
      return {
        type: 'none',
        diagnosis: 'Normal Color Vision',
        strength: 0,
        message: 'You have excellent color discrimination across all spectrums!'
      };
    }

    // Map raw level score to a 0.0 -> 1.0 strength percentage.
    // Level 0 = 1.0 (Maximum severity), Level 16 = 0.0 (Normal)
    let rawStrength = 1 - (lowestScore / THRESHOLD);
    const strength = parseFloat(Math.max(0.1, Math.min(1.0, rawStrength)).toFixed(2));

    const names = {
      deuteranopia: 'Deutan (Green-Blind)',
      protanopia: 'Protan (Red-Blind)',
      tritanopia: 'Tritan (Blue-Blind)'
    };

    let severityText = strength > 0.7 ? 'Severe' : strength > 0.4 ? 'Moderate' : 'Mild';

    return {
      type: worstType,
      diagnosis: `${severityText} ${names[worstType]}`,
      strength: strength,
      message: `Your results indicate a difficulty distinguishing colors along the ${names[worstType].split(' ')[1]} axis.`
    };
  }, [scores, phase]);

  const copyToClipboard = () => {
    const jsonStr = JSON.stringify({ type: resultData.type, strength: resultData.strength }, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert('Profile copied to clipboard! Paste this into Colorfle.');
  };

  const downloadJson = () => {
    const jsonStr = JSON.stringify({ type: resultData.type, strength: resultData.strength }, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'colorfle_vision_profile.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0F111A] text-slate-100 font-sans flex items-center justify-center overflow-hidden selection:bg-purple-500 selection:text-white">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-900/10 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-900/10 blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center">
        
        {/* --- PHASE: INTRO --- */}
        {phase === 'intro' && (
          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl w-full text-center animate-fade-in">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              ChromaSight Profiler
            </h1>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              Find out your precise color vision profile. Click the tile that looks slightly different from the rest. The test automatically adapts to find your exact threshold.
            </p>
            
            <button 
              onClick={startTest}
              className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg shadow-lg shadow-purple-600/30 transition transform hover:scale-[1.02] active:scale-95"
            >
              Start Calibration
            </button>
            <p className="text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-bold">
              Compatible with Colorfle
            </p>
          </div>
        )}

        {/* --- PHASE: TESTING --- */}
        {phase === 'testing' && TEST_AXES[axisIndex] && (
          <div className="w-full flex flex-col items-center w-full animate-fade-in">
            
            {/* Header & Progress */}
            <div className="w-full flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-white">{TEST_AXES[axisIndex].name}</h2>
                <p className="text-xs text-slate-400">Level {level + 1}</p>
              </div>
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <svg key={i} className={`w-6 h-6 ${i < lives ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.6)]' : 'text-slate-800'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                ))}
              </div>
            </div>

            {/* Grid Container */}
            <div 
              className={`bg-slate-900 border border-slate-800 p-3 rounded-2xl shadow-2xl w-full aspect-square max-w-[400px] transition-transform ${shake ? 'animate-shake' : ''}`}
            >
              <div 
                className="w-full h-full grid gap-1 sm:gap-2"
                style={{ 
                  gridTemplateColumns: `repeat(${Math.sqrt(tiles.length)}, minmax(0, 1fr))` 
                }}
              >
                {tiles.map((tile, i) => (
                  <button
                    key={`${axisIndex}-${level}-${i}`}
                    onClick={() => handleTileClick(tile.isTarget)}
                    className="w-full h-full rounded-lg md:rounded-xl shadow-inner transition-transform active:scale-95"
                    style={{ backgroundColor: `hsl(${tile.h}, ${tile.s}%, ${tile.l}%)` }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className="text-sm font-bold text-slate-300">Test {axisIndex + 1} of 3</p>
              <div className="w-48 h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden mx-auto">
                <div 
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${((axisIndex) / 3) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* --- PHASE: RESULT --- */}
        {phase === 'result' && resultData && (
          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl w-full animate-fade-in">
            
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center border-4 border-slate-700">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">Calibration Complete</h2>
              <p className="text-sm text-slate-400">Here is your vision profile.</p>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 p-5 rounded-2xl mb-6">
              <h3 className="text-lg font-bold text-purple-400 mb-1">{resultData.diagnosis}</h3>
              <p className="text-xs text-slate-300 mb-4">{resultData.message}</p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Profile Type</span>
                  <span className="font-mono text-white font-bold bg-slate-900 px-2 py-1 rounded">{resultData.type}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Calculated Intensity</span>
                  <span className="font-mono text-white font-bold bg-slate-900 px-2 py-1 rounded">{Math.round(resultData.strength * 100)}%</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={copyToClipboard}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Profile JSON
              </button>
              
              <button 
                onClick={downloadJson}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Profile
              </button>
            </div>

            <p className="text-[10px] text-center text-slate-500 mt-6 leading-tight">
              Paste or upload this profile into the Colorfle settings menu to automatically calibrate the colorblindness simulation to your exact threshold.
            </p>
          </div>
        )}

      </div>

      {/* --- INLINE CSS UTILITIES --- */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .animate-fade-in { 
          animation: fadeIn 0.4s ease-out; 
        }
        @keyframes fadeIn { 
          from { opacity: 0; transform: translateY(10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
      `}</style>

    </div>
  );
}
