import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --- ISHIHARA TEST PLATES DEFINITION ---
// 1 Control plate + 5 Deutan + 5 Protan + 5 Tritan plates
const TEST_PLATES = [
  { id: 1, type: 'control', number: '12', description: 'Control Plate (Everyone with normal or deficient vision should see 12)' },
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

// Color confusion palettes for each plate type with lightness/saturation noise
const getPlatePalettes = (type, difficulty = 1) => {
  if (type === 'control') {
    return {
      foreground: ['#EF4444', '#DC2626', '#B91C1C', '#F87171'], // High contrast vibrant reds
      background: ['#10B981', '#059669', '#047857', '#34D399']  // Vibrant greens
    };
  }

  if (type === 'deutan') {
    // Red-Green confusion along Deutan confusion line
    // Difficulty adjusts color proximity
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

    // Timeout ensures UI spinner updates before heavy canvas generation
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

      // Dynamic font scaling for 1-digit vs 2-digit numbers
      const text = plate.number.toString();
      const fontSize = text.length > 1 ? 165 : 215;
      mCtx.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
      mCtx.textAlign = 'center';
      mCtx.textBaseline = 'middle';
      mCtx.fillText(text, width / 2, height / 2 + 6);

      const imgData = mCtx.getImageData(0, 0, width, height).data;

      // Step 2: Clear main canvas & draw base outer circular container
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, width / 2 - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();

      // Step 3: High-Density Circle Packing Algorithm
      // Reduced radii (2.5px - 8px) with maxAttempts (150,000) for sharp curves
      const circles = [];
      const maxAttempts = 150000;
      const maxCircles = 3800;

      for (let i = 0; i < maxAttempts; i++) {
        let r = Math.random() > 0.88 ? 8 : Math.random() > 0.4 ? 4.5 : 2.5;
        let x = Math.random() * width;
        let y = Math.random() * height;

        let distToCenter = Math.sqrt(Math.pow(x - width / 2, 2) + Math.pow(y - height / 2, 2));
        if (distToCenter + r > width / 2 - 4) continue;

        let overlap = false;
        for (let j = 0; j < circles.length; j++) {
          let c = circles[j];
          let dx = x - c.x;
          let dy = y - c.y;
          // Tighter gap constraint (0.8px) for maximum dot density
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
        const isTextPixel = imgData[pixelIdx] > 128; // White text pixel in mask

        const colorList = isTextPixel ? palettes.foreground : palettes.background;
        const baseColor = colorList[Math.floor(Math.random() * colorList.length)];

        // Add subtle lightness jitter to simulate real paper texture
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fillStyle = baseColor;
        ctx.fill();
      });

      setIsGenerating(false);
    }, 30);
  }, [phase, currentIndex]);

  useEffect(() => {
    renderPlate();
  }, [renderPlate]);

  const handleNumClick = (val) => {
    if (inputValue.length < 2) {
      setInputValue(prev => prev + val.toString());
    }
  };

  const handleClear = () => {
    setInputValue('');
  };

  const handleNextPlate = (answerVal) => {
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
  };

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
      showToast('JSON Profile copied to clipboard!');
    }).catch(() => {
      showToast('Failed to copy. Please select and copy manually.');
    });
  };

  return (
    <div className="min-h-screen bg-[#0F111A] text-slate-100 font-sans flex flex-col items-center justify-between p-4 selection:bg-purple-500 selection:text-white relative">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-6 z-50 bg-slate-800 text-white px-5 py-2.5 rounded-full border border-purple-500 shadow-2xl text-xs font-bold animate-bounce flex items-center gap-2">
          <span>✨</span> {toastMessage}
        </div>
      )}

      {/* HEADER */}
      <header className="w-full max-w-lg flex items-center justify-between py-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-md">
            👁️
          </div>
          <div>
            <h1 className="text-base font-black tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-pink-300 to-amber-200">
              ChromaSight
            </h1>
            <span className="text-[10px] text-slate-400 font-bold block -mt-1">Color Vision Diagnostic Profiler</span>
          </div>
        </div>

        {phase === 'testing' && (
          <div className="text-xs font-bold bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
            Plate {currentIndex + 1} / {TEST_PLATES.length}
          </div>
        )}
      </header>

      {/* --- WELCOME SCREEN --- */}
      {phase === 'welcome' && (
        <div className="w-full max-w-md my-auto flex flex-col items-center text-center gap-5 p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="w-20 h-20 rounded-full bg-purple-950/60 border border-purple-500/40 flex items-center justify-center text-4xl shadow-inner">
            🔍
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Precision Ishihara Test</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Assesses hue perception along <strong>Deutan</strong>, <strong>Protan</strong>, and <strong>Tritan</strong> confusion axes using high-density pseudo-isochromatic dot plates.
            </p>
          </div>

          <div className="w-full bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60 text-left text-[11px] text-slate-300 space-y-1.5">
            <div className="font-bold text-purple-300 uppercase tracking-wider text-[10px]">Test Instructions</div>
            <p>1. Keep screen brightness high and hold device at arm's length.</p>
            <p>2. Enter the number you see on each plate using the keypad.</p>
            <p>3. If no number is visible, tap <strong>"Nothing"</strong>.</p>
            <p>4. Get an instant JSON diagnostic profile to paste into <strong>Colorfle Unlimited</strong>.</p>
          </div>

          <button
            onClick={() => {
              setPhase('testing');
              setCurrentIndex(0);
              setUserAnswers({});
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-purple-900/30 transition transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Start Diagnostic Test</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* --- TESTING SCREEN --- */}
      {phase === 'testing' && (
        <div className="w-full max-w-md my-auto flex flex-col items-center gap-4">
          
          {/* Canvas Plate Display Container */}
          <div className="relative flex flex-col items-center">
            <div className="w-72 h-72 sm:w-80 sm:h-80 rounded-full border-4 border-slate-800 shadow-2xl relative overflow-hidden bg-slate-900 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={360}
                height={360}
                className={`w-full h-full rounded-full transition-opacity duration-200 ${isGenerating ? 'opacity-30' : 'opacity-100'}`}
              />
              {isGenerating && (
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-300 bg-black/40 backdrop-blur-xs">
                  Generating Plate...
                </div>
              )}
            </div>
            
            <div className="text-[11px] text-slate-400 font-semibold mt-2">
              What number do you see in the dots?
            </div>
          </div>

          {/* Number Display Field */}
          <div className="w-48 h-11 bg-slate-900 border-2 border-purple-500/60 rounded-xl flex items-center justify-center text-2xl font-black tracking-widest text-purple-200 shadow-inner">
            {inputValue || <span className="text-slate-600 text-base font-normal">Enter number</span>}
          </div>

          {/* On-Screen Keypad */}
          <div className="w-full max-w-xs grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                onClick={() => handleNumClick(num)}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base shadow-md border border-slate-700 active:scale-90 transition"
              >
                {num}
              </button>
            ))}

            <button
              onClick={handleClear}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold text-xs shadow-md border border-slate-700 active:scale-90 transition flex items-center justify-center"
            >
              Clear
            </button>

            <button
              onClick={() => handleNumClick(0)}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-base shadow-md border border-slate-700 active:scale-90 transition"
            >
              0
            </button>

            <button
              onClick={() => handleNextPlate('none')}
              className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs shadow-md border border-slate-700 active:scale-90 transition flex items-center justify-center"
            >
              Nothing
            </button>
          </div>

          {/* Submit Action Row */}
          <div className="w-full max-w-xs flex gap-2 mt-1">
            <button
              onClick={() => handleNextPlate()}
              disabled={!inputValue}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition active:scale-95"
            >
              Confirm Number
            </button>
          </div>
        </div>
      )}

      {/* --- RESULTS SCREEN --- */}
      {phase === 'results' && diagnosticResults && (
        <div className="w-full max-w-md my-auto flex flex-col gap-4 p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-black text-fuchsia-400">Diagnostic Assessment</h2>
            <p className="text-xs text-slate-400">Ishihara Color Discrimination Analysis</p>
          </div>

          {/* Diagnosis Badge */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-purple-500/40 text-center space-y-1 shadow-inner">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Detected Profile</div>
            <div className="text-xl font-black text-white capitalize">
              {diagnosticResults.type === 'normal' ? '✅ Normal Color Vision' : `${diagnosticResults.type}`}
            </div>
            {diagnosticResults.type !== 'normal' && (
              <div className="text-xs font-bold text-purple-300">
                Severity Score: {Math.round(diagnosticResults.severity * 100)}%
              </div>
            )}
          </div>

          {/* Error Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60">
              <div className="text-xs font-bold text-slate-400">Deutan</div>
              <div className="text-base font-black text-emerald-400">{5 - diagnosticResults.deutanErrors} / 5</div>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60">
              <div className="text-xs font-bold text-slate-400">Protan</div>
              <div className="text-base font-black text-amber-400">{5 - diagnosticResults.protanErrors} / 5</div>
            </div>
            <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60">
              <div className="text-xs font-bold text-slate-400">Tritan</div>
              <div className="text-base font-black text-cyan-400">{5 - diagnosticResults.tritanErrors} / 5</div>
            </div>
          </div>

          {/* JSON Export Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-slate-400 block">Colorfle JSON Profile</label>
            <textarea
              readOnly
              value={diagnosticResults.jsonProfile}
              rows={5}
              className="w-full bg-slate-950 text-purple-300 font-mono text-[11px] p-3 rounded-xl border border-slate-800 resize-none shadow-inner"
            />
            <button
              onClick={() => copyToClipboard(diagnosticResults.jsonProfile)}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
            >
              <span>📋 Copy JSON Profile</span>
            </button>
          </div>

          <button
            onClick={() => {
              setPhase('welcome');
            }}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
          >
            Retake Diagnostic Test
          </button>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-[10px] text-slate-500 text-center py-1">
        ChromaSight Profiler • High-Resolution Ishihara Diagnostic Tool
      </footer>

    </div>
  );
}
