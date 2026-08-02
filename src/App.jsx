import React, { useState } from 'react';
import { 
  ShieldCheck, Trash2, Zap, Flame, User, Users,
  Maximize, Minimize, RotateCcw
} from 'lucide-react';

const DECK = {
  'num_0': 1, 'num_1': 1, 'num_2': 2, 'num_3': 3, 'num_4': 4,
  'num_5': 5, 'num_6': 6, 'num_7': 7, 'num_8': 8, 'num_9': 9,
  'num_10': 10, 'num_11': 11, 'num_12': 12,
  'mod_+2': 1, 'mod_+4': 1, 'mod_+6': 1, 'mod_+8': 1, 'mod_+10': 1, 'mod_x2': 1,
  'act_freeze': 3, 'act_flip3': 3, 'act_2nd': 3
};

const NUMBERS = Array.from({ length: 13 }, (_, i) => `num_${i}`);
const MODIFIERS = ['mod_+2', 'mod_+4', 'mod_+6', 'mod_+8', 'mod_+10', 'mod_x2'];
const ACTIONS = ['act_freeze', 'act_flip3', 'act_2nd'];

function calculatePoints(cardsArray) {
  let numSum = 0;
  let plusSum = 0;
  let hasX2 = false;
  let uniqueNums = new Set();
  
  cardsArray.forEach(c => {
    if (c.startsWith('num_')) {
      const val = parseInt(c.replace('num_', ''));
      numSum += val;
      uniqueNums.add(val);
    } else if (c.startsWith('mod_')) {
      if (c === 'mod_x2') hasX2 = true;
      else plusSum += parseInt(c.replace('mod_+', ''));
    }
  });
  
  let total = numSum * (hasX2 ? 2 : 1) + plusSum;
  if (uniqueNums.size >= 7) total += 15;
  return total;
}

const formatCardName = (id) => {
  if (!id) return '';
  if (id.startsWith('num_')) return id.replace('num_', '');
  if (id.startsWith('mod_')) return id.replace('mod_', '');
  if (id === 'act_freeze') return 'Freeze';
  if (id === 'act_flip3') return 'Flip 3';
  if (id === 'act_2nd') return '2nd Chance';
  return id;
};

export default function Flip7Stats() {
  const [myCards, setMyCards] = useState([]);
  const [otherCards, setOtherCards] = useState([]); // Opponent cards + Discard (Combined for speed)
  const [activeZone, setActiveZone] = useState('mine');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getRemaining = (key) => {
    let count = DECK[key];
    count -= myCards.filter(c => c === key).length;
    count -= otherCards.filter(c => c === key).length;
    return Math.max(0, count);
  };

  const totalRemaining = Object.keys(DECK).reduce((sum, key) => sum + getRemaining(key), 0);
  const currentPoints = calculatePoints(myCards);
  const myNums = new Set(myCards.filter(c => c.startsWith('num_')));
  const hasSecondChance = myCards.includes('act_2nd');
  
  let bustCardsCount = 0;
  let newNumCardsCount = 0;
  let expectedDelta = 0;
  let highCardsRemaining = 0; // 8 through 12
  let lowCardsRemaining = 0; // 0 through 7
  let shieldsRemaining = getRemaining('act_2nd');
  let x2Remaining = getRemaining('mod_x2');

  Object.keys(DECK).forEach(key => {
    const count = getRemaining(key);
    if (count === 0) return;
    
    // Deck Heat
    if (key.startsWith('num_')) {
      const val = parseInt(key.replace('num_', ''));
      if (val >= 8) highCardsRemaining += count;
      else lowCardsRemaining += count;
    }

    // Expected Value
    const prob = count / totalRemaining;
    let delta = 0;
    
    if (key.startsWith('num_')) {
      if (myNums.has(key)) {
        bustCardsCount += count;
        delta = hasSecondChance ? 0 : -currentPoints; 
      } else {
        newNumCardsCount += count;
        const val = parseInt(key.replace('num_', ''));
        const multiplier = myCards.includes('mod_x2') ? 2 : 1;
        delta = val * multiplier;
        if (myNums.size === 6) delta += 15; 
      }
    } else if (key.startsWith('mod_')) {
      if (key === 'mod_x2') {
        const numSum = myCards.filter(c => c.startsWith('num_')).reduce((acc, c) => acc + parseInt(c.replace('num_', '')), 0);
        delta = numSum; 
      } else {
        delta = parseInt(key.replace('mod_+', ''));
      }
    }
    expectedDelta += prob * delta;
  });

  const deckHeatRatio = lowCardsRemaining > 0 ? (highCardsRemaining / lowCardsRemaining).toFixed(1) : highCardsRemaining;
  const isDeckHot = highCardsRemaining > lowCardsRemaining;
  const fatalBustProb = totalRemaining === 0 ? 0 : (hasSecondChance ? 0 : bustCardsCount / totalRemaining);
  const safeProb = totalRemaining === 0 ? 0 : (1 - fatalBustProb);

  const handleAddCard = (id) => {
    if (getRemaining(id) <= 0) return;
    if (activeZone === 'mine') setMyCards([...myCards, id]);
    if (activeZone === 'other') setOtherCards([...otherCards, id]);
  };

  const handleRemoveCard = (zone, index) => {
    if (zone === 'mine') setMyCards(myCards.filter((_, i) => i !== index));
    if (zone === 'other') setOtherCards(otherCards.filter((_, i) => i !== index));
  };

  const resetRound = () => {
    setMyCards([]);
    setOtherCards([]);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(e => console.error(e));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(e => console.error(e));
      }
    }
  };

  const InputButton = ({ id }) => {
    const count = getRemaining(id);
    const disabled = count <= 0;
    const text = formatCardName(id);
    
    let colorClasses = 'bg-slate-800 text-slate-200 border-slate-700/50';
    if (!disabled) {
      if (id.startsWith('num_')) colorClasses = 'bg-blue-900/40 hover:bg-blue-800/60 text-blue-100 border-blue-700/50';
      if (id.startsWith('mod_')) colorClasses = 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-100 border-purple-700/50';
      if (id.startsWith('act_')) colorClasses = 'bg-amber-900/40 hover:bg-amber-800/60 text-amber-100 border-amber-700/50';
    }
    
    return (
      <button 
        onClick={() => handleAddCard(id)} 
        disabled={disabled}
        className={`relative p-1 md:p-2 rounded-xl border flex flex-col items-center justify-center font-bold transition-all h-12 md:h-14 w-full ${colorClasses} ${disabled ? 'opacity-30 cursor-not-allowed' : 'active:scale-95 hover:shadow-lg'}`}
      >
        <span className="text-base md:text-lg lg:text-xl leading-none mb-1">{text}</span>
        <span className="text-[9px] md:text-[10px] font-normal opacity-70 absolute bottom-1">{count} left</span>
      </button>
    );
  };

  const CardBadge = ({ id, onRemove }) => {
    const text = formatCardName(id);
    let color = 'bg-slate-700 text-white';
    if (id.startsWith('num_')) color = 'bg-blue-600 text-white';
    if (id.startsWith('mod_')) color = 'bg-purple-600 text-white';
    if (id.startsWith('act_')) color = 'bg-amber-600 text-white';
    
    return (
      <div onClick={onRemove} className={`rounded-lg cursor-pointer flex flex-col items-center justify-center font-bold text-sm md:text-base lg:text-lg shadow-md border hover:border-red-400 transition-all w-12 h-16 md:w-14 md:h-20 group relative overflow-hidden flex-shrink-0 ${color} border-white/10`}>
        <span>{text}</span>
        <div className="absolute inset-0 bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={18} />
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-blue-500/30">
      
      {/* HEADER */}
      <div className="h-14 md:h-16 px-3 md:px-6 flex justify-between items-center bg-slate-900/80 border-b border-slate-800 flex-shrink-0 backdrop-blur z-20">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-emerald-400 leading-none flex items-center gap-2">
            PRO STATS <span className="text-slate-500 text-xs md:text-sm font-medium tracking-widest uppercase hidden sm:inline">Offline Tracker</span>
          </h1>
          <p className="text-slate-400 text-[9px] md:text-[10px] mt-1 font-bold tracking-wider uppercase">
            {totalRemaining} CARDS IN DECK
          </p>
        </div>
        
        <div className="flex gap-2">
          <button onClick={resetRound} className="px-3 md:px-4 py-1.5 md:py-2 bg-rose-900/50 text-rose-400 hover:bg-rose-900 font-bold rounded-lg transition-colors flex items-center gap-2 text-xs md:text-sm">
            <RotateCcw size={14} /> Clear All
          </button>
          <button onClick={toggleFullscreen} className="hidden md:flex px-2 md:px-3 py-1.5 md:py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors items-center justify-center text-slate-400 hover:text-white">
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full mx-auto p-2 md:p-3 lg:p-4 gap-2 md:gap-3 lg:gap-4 overflow-hidden relative">
        
        {/* MATH GAUGES & DECK HEAT (Left Side on wide screens) */}
        <div className="w-full lg:w-4/12 flex flex-col gap-2 md:gap-3 min-h-0 order-1">
           
           <div className="grid grid-cols-2 gap-2 flex-shrink-0">
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 relative overflow-hidden flex flex-col items-center justify-center text-center shadow-xl">
               <div className={`absolute -inset-10 opacity-10 blur-xl rounded-full ${safeProb > 0.7 ? 'bg-emerald-500' : safeProb > 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
               <p className="text-slate-400 font-bold tracking-widest uppercase text-[9px] relative z-10 flex items-center gap-1"><ShieldCheck size={10}/> Safe Draw</p>
               <h2 className="text-2xl md:text-3xl font-black relative z-10 leading-none mt-1">{(safeProb * 100).toFixed(0)}<span className="text-xs text-slate-500">%</span></h2>
             </div>
             
             <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col items-center justify-center text-center shadow-xl">
               <p className="text-slate-400 font-bold tracking-widest uppercase text-[9px] flex items-center gap-1"><Zap size={10}/> Exp. Value</p>
               <div className={`text-2xl md:text-3xl font-black leading-none mt-1 ${expectedDelta > 0 ? 'text-emerald-400' : expectedDelta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                   {expectedDelta > 0 ? '+' : ''}{expectedDelta.toFixed(1)}
               </div>
             </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl flex flex-col flex-shrink-0 gap-3">
             <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
               Deck Intelligence <Flame size={12} className={isDeckHot ? 'text-rose-500' : 'text-slate-500'}/>
             </h3>
             <div className="flex gap-2 w-full">
                <div className="flex-1 bg-slate-950 rounded border border-slate-800 p-2 text-center">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Heat (High/Low)</div>
                  <div className={`text-lg font-black leading-none ${isDeckHot ? 'text-rose-400' : 'text-blue-400'}`}>{deckHeatRatio}</div>
                </div>
                <div className="flex-1 bg-slate-950 rounded border border-slate-800 p-2 text-center">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">x2 Left</div>
                  <div className="text-lg font-black leading-none text-purple-400">{x2Remaining}</div>
                </div>
                <div className="flex-1 bg-slate-950 rounded border border-slate-800 p-2 text-center">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Shields Left</div>
                  <div className="text-lg font-black leading-none text-amber-400">{shieldsRemaining}</div>
                </div>
             </div>
             
             {/* Mini Deck Chart */}
             <div className="flex items-end h-10 gap-[2px] w-full mt-1">
                {NUMBERS.map(id => {
                   const count = getRemaining(id);
                   const isHigh = parseInt(id.replace('num_', '')) >= 8;
                   return (
                      <div key={id} className="flex-1 flex flex-col items-center relative group">
                         <div className={`w-full rounded-t transition-all ${isHigh ? 'bg-rose-500/60' : 'bg-blue-600/50'}`} style={{ height: `${(count/12)*100}%`, minHeight: count > 0 ? '2px' : '0' }}></div>
                      </div>
                   );
                })}
             </div>
           </div>

           {/* Current Target Target */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
             <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Flip 7 Target</span>
                <span className="text-[10px] font-bold text-blue-400">{myNums.size} / 7</span>
             </div>
             <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-[2px]">
               {[1,2,3,4,5,6,7].map(i => (
                 <div key={i} className={`flex-1 ${i <= myNums.size ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
               ))}
             </div>
           </div>
        </div>

        {/* INPUT KEYBOARD (Center Side) */}
        <div className="w-full lg:w-4/12 flex flex-col min-h-0 order-2">
           {/* Zone Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-xl flex gap-1.5 mb-2 md:mb-3 flex-shrink-0">
             <button onClick={() => setActiveZone('mine')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeZone === 'mine' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                <User size={14}/> Add to My Hand
             </button>
             <button onClick={() => setActiveZone('other')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${activeZone === 'other' ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                <Users size={14}/> Log Played Card
             </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl flex-1 overflow-y-auto custom-scrollbar flex flex-col relative">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center flex-shrink-0 sticky top-0 bg-slate-900 pb-2 z-10 border-b border-slate-800">
              <span>{activeZone === 'mine' ? 'Draw for Self' : 'Mark card out of play'}</span>
            </h3>
            
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="grid grid-cols-4 gap-1.5">
                {NUMBERS.map(id => <InputButton key={id} id={id} />)}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {MODIFIERS.map(id => <InputButton key={id} id={id} />)}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTIONS.map(id => <InputButton key={id} id={id} />)}
              </div>
            </div>
          </div>
        </div>

        {/* LOGGED CARDS (Right Side) */}
        <div className="w-full lg:w-4/12 flex flex-col gap-2 md:gap-3 min-h-0 order-3">
           <div className="flex-1 bg-slate-900/60 border border-blue-900/30 rounded-xl p-3 flex flex-col overflow-y-auto custom-scrollbar shadow-inner">
             <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5 mb-3 sticky top-0 bg-slate-900/90 -mx-3 px-3 py-1 z-10">
               My Hand ({myCards.length})
             </h3>
             <div className="flex flex-wrap gap-1.5 content-start">
                {myCards.length === 0 && <div className="text-slate-600 text-[10px] uppercase font-bold">Empty</div>}
                {myCards.map((card, i) => <CardBadge key={`mine-${i}`} id={card} onRemove={() => handleRemoveCard('mine', i)} />)}
             </div>
           </div>

           <div className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col overflow-y-auto custom-scrollbar shadow-inner">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-3 sticky top-0 bg-slate-900/90 -mx-3 px-3 py-1 z-10">
               Logged & Discarded ({otherCards.length})
             </h3>
             <div className="flex flex-wrap gap-1.5 content-start">
                {otherCards.length === 0 && <div className="text-slate-600 text-[10px] uppercase font-bold">Empty</div>}
                {otherCards.map((card, i) => <CardBadge key={`other-${i}`} id={card} onRemove={() => handleRemoveCard('other', i)} />)}
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
