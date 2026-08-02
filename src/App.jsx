import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- ISHIHARA DIAGNOSTIC TEST PLATES ---
// 1 Control plate + 5 Deutan + 5 Protan + 5 Tritan plates
const TEST_PLATES = [
  { id: 1, type: 'control', number: '12', description: 'Control Plate (Visible to all vision types)' },
  { id: 2, type: 'deutan', number: '8', difficulty: 1, description: 'Mild Deutan Assessment' },
  { id: 3, type: 'deutan', number: '29', difficulty: 2, description: 'Moderate Deutan Assessment' },
  { id: 4, type: 'deutan', number: '5', difficulty: 3, description: 'Moderate-Strong Deutan Assessment' },
  { id: 5, type: 'deutan', number: '74', difficulty: 4, description: 'Strong Deutan Assessment' },
  { id: 6, type: 'deutan', number: '3', difficulty: 5, description: 'Severe Deutan Assessment' },
  { id: 7, type: 'protan', number: '6', difficulty: 1, description: 'Mild Protan Assessment' },
  { id: 8, type: 'protan', number: '45', difficulty: 2, description: 'Moderate Protan Assessment' },
  { id: 9, type: 'protan', number: '2', difficulty: 3, description: 'Moderate-Strong Protan Assessment' },
  { id: 10, type: 'protan', number: '97', difficulty: 4, description: 'Strong Protan Assessment' },
  { id: 11, type: 'protan', number: '15', difficulty: 5, description: 'Severe Protan Assessment' },
  { id: 12, type: 'tritan', number: '7', difficulty: 1, description: 'Mild Tritan Assessment' },
  { id: 13, type: 'tritan', number: '16', difficulty: 2, description: 'Moderate Tritan Assessment' },
  { id: 14, type: 'tritan', number: '4', difficulty: 3, description: 'Moderate-Strong Tritan Assessment' },
  { id: 15, type: 'tritan', number: '35', difficulty: 4, description: 'Strong Tritan Assessment' },
  { id: 16, type: 'tritan', number: '9', difficulty: 5, description: 'Severe Tritan Assessment' }
];

const getPlatePalettes = (type, difficulty = 1) => {
  if (type === 'control') {
    return {
      foreground: ['#EF4444', '#DC2626', '#B91C1C', '#F87171'], // Vibrant high-contrast reds
      background: ['#10B981', '#059669', '#047857', '#34D399']  // Deep rich greens
    };
  }

  if (type === 'deutan') {
    // Red-Green confusion along Deutan confusion line
    const fgShades = difficulty > 3 
      ? ['#6EE7B7', '#34D399', '#10B981', '#A7F3D0']
      : ['#34D399', '#10B981', '#059669', '#A7F3D0'];
    const bgShades = ['#F97316', '#FB923C', '#EA580C', '#D97706', '#B45309', '#CA8A04'];
    return { foreground: fgShades, background: bgShades };
  }

  if (type === 'protan') {
    // Red-Olive confusion along Protan confusion line
    const fgShades = difficulty > 3
      ? ['#EF4444', '#F87171', '#DC2626', '#FCA5A5']
      : ['#DC2626', '#B91C1C', '#EF4444', '#F87171'];
    const bgShades = ['#65A30D', '#84CC16', '#4D7C0F', '#A16207', '#854D0E', '#713F12'];
    return { foreground: fgShades, background: bgShades };
  }

  if (type === 'tritan') {
    // Blue-Yellow confusion along Tritan confusion line
    const fgShades = difficulty > 3
      ? ['#38BDF8', '#60A5FA', '#0284C7', '#93C5FD']
      : ['#0284C7', '#1D4ED8', '#2563EB', '#3B82F6'];
    const bgShades = ['#EAB308', '#FACC15', '#CA8A04', '#E11D48', '#BE123C', '#9F1239'];
    return { foreground: fgShades, background: bgShades };
  }

  return { foreground: ['#22C55E'], background: ['#F97316'] };
};

export default function App() {
  const [phase, setPhase] = useState('welcome'); // 'welcome' | 'testing' | 'results'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const canvasRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  const renderPlate = useCallback(() => {
    if (phase !== 'testing' || !TEST_PLATES[currentIndex]) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsGenerating(true);

    setTimeout(() => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const width = canvas.width;
      const height = canvas.height;
      const plate = TEST_PLATES[currentIndex];

      // Step 1: Draw hidden text mask on offscreen canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const mCtx = maskCanvas.getContext('2d');
      mCtx.fillStyle = 'black';
      mCtx.fillRect(0, 0, width, height);
      mCtx.fillStyle = 'white';

      // Precise font size to ensure zero clipping
      const text = plate.number.toString();
      const fontSize = text.length > 1 ? 165 : 215;
      mCtx.font = `900 ${fontSize}px Inter, System-UI, sans-serif`;
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      mCtx.fillText(text, width / 2, height / 2 + 6);

      const imgData = mCtx.getImageData(0, 0, width, height).data;

      // Step 2: Draw circular base plate
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#1E293B';
      ctx.fill();

      // Step 3: High-Density Circle Packing Algorithm (~3800 circles)
      const circles = [];
      const maxAttempts = 150000;
      const maxCircles = 3800;

      for (let i = 0; i < maxAttempts; i++) {
        let r = Math.random() > 0.88 ? 7.5 : Math.random() > 0.4 ? 4.2 : 2.4;
        let x = Math.random() * width;
        let y = Math.random() * height;

        let distToCenter = Math.sqrt(Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2));
        if (distToCenter + r > width / 2 - 4) continue;

        let overlap = false;
        for (let j = 0; j < circles.length; j++) {
          let c = circles[j];
          let dx = x - c.x;
          let dy = y - c.y;
          if (dx * dx + dy * dy < Math.pow(r + c.r + 0.8, 2)) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          circles.push({ x, y, r });
          if (circles.length >= maxCircles) break;
        }
      }

      const palettes = getPlatePalettes(plate.type, plate.difficulty);

      circles.forEach(c => {
        const pixelIdx = (Math.floor(c.y) * width + Math.floor(c.x)) * 4;
        const isTextPixel = imgData[pixelIdx] > 128;

        const colorList = isTextPixel ? palettes.foreground : palettes.background;
        const baseColor = colorList[Math.floor(Math.random() * colorList.length)];

        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();
      });

      setIsGenerating(false);
    }, 20);
  }, [phase, currentIndex]);

  useEffect(() => {
    renderPlate();
  }, [renderPlate]);

  const handleNextPlate = useCallback((answerVal) => {
    const finalAnswer = answerVal !== undefined ? answerVal : inputValue.trim() || 'none';
    
    setUserAnswers(prev => ({
      ...prev,
      [TEST_PLATES[currentIndex].id]: finalAnswer
    }));

    setInputValue('');

    if (currentIndex < TEST_PLATES.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setPhase('results');
    }
  }, [currentIndex, inputValue]);

  useEffect(() => {
    if (phase !== 'testing') return;

    const handleKeyDown = (e) => {
      // Ignore if modifier keys are down
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key >= '0' && e.key <= '9') {
        setInputValue(prev => (prev.length < 2 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        setInputValue(prev => prev.slice(0, -1));
      } else if (e.key === 'Delete' || e.key === 'c' || e.key === 'C') {
        setInputValue('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleNextPlate();
      } else if (e.key === 'n' || e.key === 'N' || e.key === ' ') {
        e.preventDefault();
        handleNextPlate('none');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, handleNextPlate]);

  const diagnosticResults = useMemo(() => {
    if (phase !== 'results') return null;

    let deutanErrors = 0;
    let protanErrors = 0;
    let tritanErrors = 0;

    TEST_PLATES.forEach(plate => {
      const ans = userAnswers[plate.id];
      const isCorrect = ans === plate.number.toString();

      if (!isCorrect && plate.type !== 'control') {
        if (plate.type === 'deutan') deutanErrors++;
        if (plate.type === 'protan') protanErrors++;
        if (plate.type === 'tritan') tritanErrors++;
      }
    });

    let primaryType = 'normal';
    let maxErrors = 0;

    if (deutanErrors >= 2 && deutanErrors >= maxErrors) {
      primaryType = 'deuteranopia';
      maxErrors = deutanErrors;
    }
    if (protanErrors >= 2 && protanErrors > maxErrors) {
      primaryType = 'protanopia';
      maxErrors = protanErrors;
    }
    if (tritanErrors >= 2 && tritanErrors > maxErrors) {
      primaryType = 'tritanopia';
      maxErrors = tritanErrors;
    }

    const severity = Math.min(1.0, Math.round((maxErrors / 5) * 100) / 100);

    const jsonProfile = JSON.stringify({
      type: primaryType,
      severity: severity,
      deutanScore: `${5 - deutanErrors}/5`,
      protanScore: `${5 - protanErrors}/5`,
      tritanScore: `${5 - tritanErrors}/5`,
      timestamp: new Date().toISOString().split('T')[0]
    }, null, 2);

    return {
      type: primaryType,
      severity,
      deutanErrors,
      protanErrors,
      tritanErrors,
      jsonProfile
    };
  }, [phase, userAnswers]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      showToast('Profile copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    }).catch(() => {
      showToast('Select text manually to copy.');
    });
  };

  return (
    <div className="min-h-screen bg-[#090C15] text-slate-100 font-sans flex flex-col items-center justify-between p-4 selection:bg-purple-500 selection:text-white relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 z-50 bg-slate-800/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full border border-purple-500/60 shadow-2xl text-xs font-bold animate-bounce flex items-center gap-2">
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
            <span className="text-[10px] text-slate-400 font-bold block -mt-1 tracking-wider uppercase">Diagnostic Profiler</span>
          </div>
        </div>

        {phase === 'testing' && (
          <div className="text-xs font-bold bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>Plate {currentIndex + 1} / {TEST_PLATES.length}</span>
          </div>
        )}
      </header>

      {/* --- WELCOME SCREEN --- */}
      {phase === 'welcome' && (
        <div className="w-full max-w-md my-auto flex flex-col items-center text-center gap-6 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-950 to-indigo-950 border border-purple-500/30 flex items-center justify-center text-purple-300 shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white tracking-wide">Precision Ishihara Assessment</h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              Measures perception along <strong>Deutan</strong>, <strong>Protan</strong>, and <strong>Tritan</strong> color confusion axes using pseudo-isochromatic dot plates.
            </p>
          </div>

          <div className="w-full bg-slate-950/70 p-4 rounded-2xl border border-slate-800 text-left text-xs text-slate-300 space-y-2">
            <div className="font-bold text-purple-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Test Guidelines</span>
            </div>
            <p>1. Increase screen brightness to max for best fidelity.</p>
            <p>2. Enter the numbers you see using your <strong>keyboard</strong> or the keypad.</p>
            <p>3. Press <strong>Space</strong> or tap <strong>"Nothing"</strong> if no number is visible.</p>
            <p>4. Export your JSON profile directly into <strong>Colorfle Unlimited</strong>.</p>
          </div>

          <button
            onClick={() => {
              setPhase('testing');
              setCurrentIndex(0);
              setUserAnswers({});
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-950/40 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Begin Assessment</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      )}

      {/* --- TESTING SCREEN --- */}
      {phase === 'testing' && (
        <div className="w-full max-w-md my-auto flex flex-col items-center gap-4">
          
          {/* Canvas Plate Container */}
          <div className="relative flex flex-col items-center">
            <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-full border-4 border-slate-800 shadow-2xl relative overflow-hidden bg-slate-950 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={360}
                height={360}
                className={`w-full h-full rounded-full transition-opacity duration-200 ${isGenerating ? 'opacity-30' : 'opacity-100'}`}
              />
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-300 bg-black/50 backdrop-blur-xs">
                  Generating Plate...
                </div>
              )}
            </div>
            
            <div className="text-[11px] text-slate-400 font-semibold mt-2.5 flex items-center gap-1.5">
              <span>Type or select the number visible in the dots</span>
            </div>
          </div>

          {/* Number Display Field */}
          <div className="w-52 h-11 bg-slate-950 border-2 border-purple-500/60 rounded-xl flex items-center justify-center text-2xl font-black tracking-widest text-purple-200 shadow-inner">
            {inputValue || <span className="text-slate-600 text-xs font-normal uppercase tracking-wider">Type number</span>}
          </div>

          {/* On-Screen Keypad */}
          <div className="w-full max-w-xs grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => setInputValue(prev => (prev.length < 2 ? prev + num.toString() : prev))}
                className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-md border border-slate-800 active:scale-95 transition"
              >
                {num}
              </button>
            ))}

            <button
              onClick={() => setInputValue('')}
              className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 font-bold text-xs shadow-md border border-slate-800 active:scale-95 transition flex items-center justify-center gap-1"
            >
              <span>Clear</span>
            </button>

            <button
              onClick={() => setInputValue(prev => (prev.length < 2 ? prev + '0' : prev))}
              className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-base shadow-md border border-slate-800 active:scale-95 transition"
            >
              0
            </button>

            <button
              onClick={() => handleNextPlate('none')}
              className="py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs shadow-md border border-slate-800 active:scale-95 transition flex items-center justify-center gap-1"
            >
              <span>Nothing</span>
            </button>
          </div>

          {/* Submit Action Button */}
          <div className="w-full max-w-xs flex gap-2 mt-1">
            <button
              onClick={() => handleNextPlate()}
              disabled={!inputValue}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>Confirm Answer</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* --- RESULTS SCREEN --- */}
      {phase === 'results' && diagnosticResults && (
        <div className="w-full max-w-md my-auto flex flex-col gap-4 p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-purple-300">Diagnostic Assessment</h2>
            <p className="text-xs text-slate-400">Ishihara Color Discrimination Profile</p>
          </div>

          {/* Diagnosis Badge */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-purple-500/40 text-center space-y-1 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected Diagnosis</div>
            <div className="text-lg font-black text-white capitalize">
              {diagnosticResults.type === 'normal' ? 'Normal Color Perception' : diagnosticResults.type}
            </div>
            {diagnosticResults.type !== 'normal' && (
              <div className="text-xs font-bold text-purple-400">
                Severity Rating: {Math.round(diagnosticResults.severity * 100)}%
              </div>
            )}
          </div>

          {/* Error Breakdown Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-400">Deutan</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">{5 - diagnosticResults.deutanErrors} / 5</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-400">Protan</div>
              <div className="text-sm font-black text-amber-400 mt-0.5">{5 - diagnosticResults.protanErrors} / 5</div>
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-slate-400">Tritan</div>
              <div className="text-sm font-black text-cyan-400 mt-0.5">{5 - diagnosticResults.tritanErrors} / 5</div>
            </div>
          </div>

          {/* JSON Export Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Colorfle JSON Profile</label>
              {isCopied && <span className="text-[10px] font-bold text-emerald-400">Copied!</span>}
            </div>
            <textarea
              readOnly
              value={diagnosticResults.jsonProfile}
              rows={5}
              className="w-full bg-slate-950 text-purple-300 font-mono text-[11px] p-3 rounded-xl border border-slate-800 resize-none shadow-inner focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(diagnosticResults.jsonProfile)}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
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
                  <span>Copy Diagnostic JSON Profile</span>
                </>
              )}
            </button>
          </div>

          <button
            onClick={() => setPhase('welcome')}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Retake Diagnostic Test</span>
          </button>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-[10px] text-slate-500 text-center py-2">
        ChromaSight Profiler • High-Resolution Ishihara Diagnostics
      </footer>

    </div>
  );
}
