import React, { useState, useEffect, useRef, useCallback } from 'react';

// --- SOUND & HAPTIC ENGINE ---
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
    } else if (type === 'finish') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
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

const triggerHaptic = () => {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(30); } catch (e) {}
  }
};

// --- ISHIHARA PLATE GENERATION DATA ---
const NUMBERS = [3, 5, 6, 8, 9, 12, 15, 29, 45, 73, 74, 97];

// Configuration for generating the plates progressively
const generateTestPlates = () => {
  const plates = [];
  
  // 1. Control Plate (Easy for everyone)
  plates.push({
    id: 'control', axis: 'control', level: 0,
    number: 12, // Always 12 for control
    bgHue: 220, targetHue: 10, // Blue bg, Red target
    hNoise: 15,
  });

  const getRandNum = () => NUMBERS[Math.floor(Math.random() * NUMBERS.length)];

  // 2. Deutan Plates (Green weakness)
  // Background: Orange/Reds (Hue 15-40), Target: Greens (Hue 100-140)
  for (let i = 1; i <= 5; i++) {
    plates.push({
      id: `deutan-${i}`, axis: 'deutan', level: i,
      number: getRandNum(),
      bgHue: 25, targetHue: 120,
      // As level increases, we inject more hue noise to blend the bounds
      hNoise: i * 8, 
    });
  }

  // 3. Protan Plates (Red weakness)
  // Background: Greens/Olives (Hue 80-110), Target: Reds/Pinks (Hue 350-10)
  for (let i = 1; i <= 5; i++) {
    plates.push({
      id: `protan-${i}`, axis: 'protan', level: i,
      number: getRandNum(),
      bgHue: 90, targetHue: 0,
      hNoise: i * 8,
    });
  }

  // 4. Tritan Plates (Blue/Yellow weakness)
  // Background: Blues (Hue 190-220), Target: Yellows/Pinks (Hue 50 or 330)
  for (let i = 1; i <= 5; i++) {
    plates.push({
      id: `tritan-${i}`, axis: 'tritan', level: i,
      number: getRandNum(),
      bgHue: 210, targetHue: i % 2 === 0 ? 50 : 330,
      hNoise: i * 8,
    });
  }

  return plates;
};

export default function App() {
  const [phase, setPhase] = useState('intro'); // 'intro', 'testing', 'result'
  const [plates, setPlates] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scores, setScores] = useState({ deutan: 0, protan: 0, tritan: 0 });
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef(null);

  // Start the test
  const startTest = () => {
    playSound('tap');
    triggerHaptic();
    const newPlates = generateTestPlates();
    setPlates(newPlates);
    setScores({ deutan: 0, protan: 0, tritan: 0 });
    setCurrentIndex(0);
    setInputValue('');
    setPhase('testing');
  };

  // Rendering the Canvas Plate
  const renderPlate = useCallback(async () => {
    if (phase !== 'testing' || !plates[currentIndex]) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);
    
    // We use a timeout to allow UI to show loading state before blocking main thread
    setTimeout(() => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const width = canvas.width;
      const height = canvas.height;
      const plate = plates[currentIndex];

      // 1. Draw the hidden text mask
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const mCtx = maskCanvas.getContext('2d');
      mCtx.fillStyle = 'black';
      mCtx.fillRect(0, 0, width, height);
      mCtx.fillStyle = 'white';
      mCtx.font = 'bold 220px Arial, Helvetica, sans-serif'; // Thick, standard font
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      mCtx.fillText(plate.number.toString(), width / 2, height / 2);
      const imgData = mCtx.getImageData(0, 0, width, height).data;

      // 2. Clear visible canvas & draw boundary circle
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.arc(width/2, height/2, width/2 - 2, 0, Math.PI*2);
      ctx.fillStyle = '#E2E8F0'; // Base plate color behind dots
      ctx.fill();

      // 3. Circle Packing Algorithm
      const circles = [];
      const maxAttempts = 60000;
      const maxCircles = 1600;

      for (let i = 0; i < maxAttempts; i++) {
        // Favor smaller circles as we get denser
        let r = Math.random() > 0.85 ? 12 : Math.random() > 0.5 ? 8 : 4.5;
        let x = Math.random() * width;
        let y = Math.random() * height;

        // Keep inside circular plate
        let distToCenter = Math.sqrt(Math.pow(x - width/2, 2) + Math.pow(y - height/2, 2));
        if (distToCenter + r > width/2 - 4) continue;

        // Check overlap
        let overlap = false;
        for (let j = 0; j < circles.length; j++) {
          let c = circles[j];
          let dx = x - c.x;
          let dy = y - c.y;
          if (dx*dx + dy*dy < Math.pow(r + c.r + 1.2, 2)) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          circles.push({ x, y, r });
          if (circles.length >= maxCircles) break;
        }
      }

      // 4. Draw Packed Circles based on Mask
      circles.forEach(c => {
        const pixelIndex = (Math.floor(c.y) * width + Math.floor(c.x)) * 4;
        const isTarget = imgData[pixelIndex] > 128; // White text mask

        let baseHue = isTarget ? plate.targetHue : plate.bgHue;
        // Inject hue noise
        let hue = baseHue + (Math.random() - 0.5) * plate.hNoise;
        
        // Massive lightness & saturation noise to prevent contrast cheating
        let sat = 60 + Math.random() * 30; // 60% to 90%
        let light = 35 + Math.random() * 40; // 35% to 75%

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI*2);
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.fill();
      });

      setIsGenerating(false);
    }, 50);
  }, [phase, currentIndex, plates]);

  // Re-render when plate index changes
  useEffect(() => {
    if (phase === 'testing') {
      renderPlate();
    }
  }, [phase, currentIndex, renderPlate]);

  // Handle Numpad input
  const handleInput = (num) => {
    if (inputValue.length < 2) {
      playSound('tap');
      triggerHaptic();
      setInputValue(prev => prev + num);
    }
  };

  const handleClear = () => {
    playSound('tap');
    triggerHaptic();
    setInputValue('');
  };

  // Submit Answer
  const submitAnswer = (userAnswer) => {
    playSound('tap');
    triggerHaptic();
    const plate = plates[currentIndex];
    
    // Parse user answer ('nothing' = -1)
    const isCorrect = parseInt(userAnswer) === plate.number;

    if (isCorrect && plate.axis !== 'control') {
      setScores(prev => ({
        ...prev,
        [plate.axis]: prev[plate.axis] + 1
      }));
    }

    // Move to next or finish
    if (currentIndex < plates.length - 1) {
      setInputValue('');
      setCurrentIndex(prev => prev + 1);
    } else {
      playSound('finish');
      setPhase('result');
    }
  };

  // --- RESULT CALCULATION ---
  const resultData = useMemo(() => {
    if (phase !== 'result') return null;

    // Total possible per axis is 5.
    let lowestScore = 5;
    let worstAxis = 'off'; // default normal

    Object.entries(scores).forEach(([axis, score]) => {
      if (score < lowestScore) {
        lowestScore = score;
        worstAxis = axis;
      }
    });

    if (lowestScore >= 4) {
      return {
        type: 'off',
        diagnosis: 'Normal Color Vision',
        strength: 0,
        desc: 'You accurately passed the Ishihara plates across all spectrums.'
      };
    }

    // Calculate strength: Score 0 = 1.0 (Severe), Score 3 = 0.4 (Mild)
    let rawStrength = (5 - lowestScore) / 5.0;
    const strength = parseFloat(Math.max(0.1, Math.min(1.0, rawStrength)).toFixed(2));

    const mapping = {
      deutan: { key: 'deuteranopia', name: 'Deutan (Green-Weak)' },
      protan: { key: 'protanopia', name: 'Protan (Red-Weak)' },
      tritan: { key: 'tritanopia', name: 'Tritan (Blue-Yellow)' }
    };

    const severity = strength > 0.7 ? 'Severe' : strength > 0.4 ? 'Moderate' : 'Mild';

    return {
      type: mapping[worstAxis].key,
      diagnosis: `${severity} ${mapping[worstAxis].name}`,
      strength: strength,
      desc: `You scored ${lowestScore}/5 on the ${worstAxis} axis. This indicates difficulty distinguishing hues along this specific light spectrum.`
    };
  }, [phase, scores]);

  const copyProfile = () => {
    const jsonStr = JSON.stringify({
      type: resultData.type,
      strength: resultData.strength
    }, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert('Profile copied to clipboard! Paste this directly into Colorfle Unlimited settings.');
  };

  const downloadProfile = () => {
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
    <div className="fixed inset-0 w-full h-full bg-[#0F111A] text-slate-100 font-sans flex flex-col items-center justify-center overflow-hidden selection:bg-purple-500 selection:text-white">
      
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-purple-900/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-900/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 flex flex-col items-center flex-1 py-6 h-full">
        
        {/* --- PHASE: INTRO --- */}
        {phase === 'intro' && (
          <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl w-full text-center my-auto">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              ChromaSight
            </h1>
            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-6">Profiler & Calibration</p>
            
            <p className="text-sm text-slate-300 mb-8 leading-relaxed">
              This clinical-grade Ishihara test generates thousands of colored dots dynamically to precisely identify your color vision deficiencies. 
              <br/><br/>
              It generates a secure JSON profile to instantly calibrate games like <strong>Colorfle Unlimited</strong> to your exact eyesight.
            </p>
            
            <button 
              onClick={startTest}
              className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-lg shadow-lg shadow-purple-600/30 transition transform hover:scale-[1.02] active:scale-95"
            >
              Start Diagnostic Test
            </button>
          </div>
        )}

        {/* --- PHASE: TESTING --- */}
        {phase === 'testing' && (
          <div className="w-full h-full flex flex-col justify-between animate-fade-in">
            
            {/* Header / Progress */}
            <div className="w-full flex items-center justify-between mb-4 flex-shrink-0">
              <h2 className="text-lg font-black text-white">What number do you see?</h2>
              <div className="text-sm font-bold text-slate-400">
                Plate {currentIndex + 1} <span className="text-slate-600">/ {plates.length}</span>
              </div>
            </div>

            {/* Ishihara Canvas Display */}
            <div className="w-full flex justify-center flex-shrink-0 relative">
              <div className="bg-slate-900 border-4 border-slate-800 p-2 rounded-full shadow-2xl relative">
                
                {/* Loading State while packing circles */}
                {isGenerating && (
                  <div className="absolute inset-0 bg-slate-900 rounded-full flex flex-col items-center justify-center z-10">
                    <svg className="animate-spin w-10 h-10 text-purple-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">Generating Plate</span>
                  </div>
                )}

                {/* The actual Plate Canvas */}
                <canvas 
                  ref={canvasRef} 
                  width={340} 
                  height={340}
                  className="rounded-full w-[300px] h-[300px] sm:w-[340px] sm:h-[340px]"
                />
              </div>
            </div>

            {/* Input Display Area */}
            <div className="w-full mt-4 mb-2 flex justify-center flex-shrink-0">
              <div className={`w-32 h-14 bg-slate-900 border-2 rounded-xl flex items-center justify-center text-2xl font-black ${inputValue ? 'border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-slate-800 text-slate-500'}`}>
                {inputValue || '?'}
              </div>
            </div>

            {/* Numpad Input */}
            <div className="w-full flex-1 flex flex-col justify-end pb-2">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button
                    key={num}
                    onClick={() => handleInput(num)}
                    className="h-14 sm:h-16 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-xl font-bold transition active:scale-90"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  className="h-14 sm:h-16 bg-slate-800/80 hover:bg-slate-700 text-rose-400 rounded-xl text-sm font-bold transition active:scale-90"
                >
                  CLEAR
                </button>
                <button
                  onClick={() => handleInput(0)}
                  className="h-14 sm:h-16 bg-slate-800/80 hover:bg-slate-700 rounded-xl text-xl font-bold transition active:scale-90"
                >
                  0
                </button>
                <button
                  onClick={() => submitAnswer(inputValue || -1)}
                  disabled={!inputValue}
                  className="h-14 sm:h-16 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 text-white rounded-xl text-sm font-black transition active:scale-90"
                >
                  ENTER
                </button>
              </div>

              {/* Nothing Button */}
              <button
                onClick={() => submitAnswer(-1)}
                className="w-full h-14 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white rounded-xl text-sm font-bold transition active:scale-95"
              >
                I Don't See A Number
              </button>
            </div>

            {/* Progress Bar Bottom */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden flex-shrink-0">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                style={{ width: `${(currentIndex / plates.length) * 100}%` }}
              />
            </div>

          </div>
        )}

        {/* --- PHASE: RESULT --- */}
        {phase === 'result' && resultData && (
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-2xl backdrop-blur-xl w-full text-center animate-fade-in my-auto">
            
            <div className="w-16 h-16 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center border-4 border-slate-700">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-black text-white mb-1">Diagnostic Complete</h2>
            <p className="text-xs text-slate-400 mb-6">Your clinical vision profile has been generated.</p>

            <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-2xl mb-6 text-left">
              <h3 className="text-lg font-black text-purple-400 mb-1">{resultData.diagnosis}</h3>
              <p className="text-xs text-slate-300 mb-4">{resultData.desc}</p>
              
              <div className="space-y-2 font-mono text-sm">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                  <span className="text-slate-400">Diagnosis ID</span>
                  <span className="text-white font-bold bg-slate-900 px-2 py-0.5 rounded">{resultData.type}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Severity Metric</span>
                  <span className="text-white font-bold bg-slate-900 px-2 py-0.5 rounded">{resultData.strength}</span>
                </div>
              </div>
            </div>

            <div className="bg-black/50 p-3 rounded-xl border border-slate-800 mb-6">
              <div className="text-[10px] uppercase text-slate-500 font-bold mb-2 flex justify-between">
                <span>Colorfle Export JSON</span>
              </div>
              <pre className="text-left text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify({ type: resultData.type, strength: resultData.strength }, null, 2)}
              </pre>
            </div>

            <div className="space-y-3">
              <button 
                onClick={copyProfile}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm shadow-lg transition flex items-center justify-center gap-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copy Profile & Play Colorfle
              </button>
              
              <button 
                onClick={downloadProfile}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 active:scale-95 border border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Profile .json
              </button>
            </div>
          </div>
        )}

      </div>

      <style>{`
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
