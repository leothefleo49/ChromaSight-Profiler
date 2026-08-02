import React, { useState, useEffect } from 'react';
import { 
  User, Users, Trash2, RotateCcw, Shuffle, Settings, 
  ShieldCheck, Plus, Trophy, X, AlertOctagon, Sparkles,
  ChevronRight, Edit2, Check, Snowflake, Hand, Crown, AlertTriangle,
  Maximize, Minimize, Undo2
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
const WINNING_SCORE = 200;

function calculatePoints(cardsArray, isBusted = false) {
  if (isBusted) return 0;
  
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
  if (!id) return ''; // Fix for null ID error
  if (id.startsWith('num_')) return id.replace('num_', '');
  if (id.startsWith('mod_')) return id.replace('mod_', '');
  if (id === 'act_freeze') return 'Freeze';
  if (id === 'act_flip3') return 'Flip 3';
  if (id === 'act_2nd') return '2nd Chance';
  return id;
};

const GamePopup = ({ popup, onClose }) => {
  useEffect(() => {
    if (!popup) return;
    const timer = setTimeout(() => onClose(), 2500); 
    return () => clearTimeout(timer);
  }, [popup, onClose]);

  if (!popup) return null;

  const configs = {
    BUST: {
      bg: 'bg-rose-600', border: 'border-rose-400',
      icon: <AlertOctagon size={56} className="text-white mb-2 animate-bounce" />,
      title: 'BUSTED!',
      desc: `${popup.playerName} hit a duplicate ${formatCardName(popup.cardId)}!`
    },
    SAVED: {
      bg: 'bg-amber-500', border: 'border-amber-300',
      icon: <ShieldCheck size={56} className="text-white mb-2 animate-pulse" />,
      title: 'SAVED!',
      desc: `${popup.playerName} used a 2nd Chance on ${formatCardName(popup.cardId)}!`
    },
    FLIP7: {
      bg: 'bg-blue-600', border: 'border-blue-400',
      icon: <Sparkles size={56} className="text-white mb-2 animate-spin-slow" />,
      title: 'FLIP 7!',
      desc: `${popup.playerName} collected 7 unique numbers! +15 Pts!`
    }
  };

  const config = configs[popup.type];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm transition-all animate-in fade-in zoom-in duration-200 cursor-pointer"
    >
      <div 
        onClick={(e) => e.stopPropagation()} 
        className={`${config.bg} border-4 ${config.border} p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col items-center text-center max-w-sm w-full transform transition-all cursor-default`}
      >
        {config.icon}
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-widest uppercase shadow-black/50 drop-shadow-lg mb-2">{config.title}</h2>
        <p className="text-white/95 font-bold text-lg md:text-xl">{config.desc}</p>
        <p className="text-white/50 text-xs mt-6 uppercase tracking-widest font-bold">Tap anywhere to dismiss</p>
      </div>
    </div>
  );
};

export default function Flip7Tracker() {
  const [players, setPlayers] = useState([
    { id: '1', name: 'Player 1', cards: [], score: 0, busted: false, standing: false, frozen: false, color: 'blue' },
    { id: '2', name: 'Player 2', cards: [], score: 0, busted: false, standing: false, frozen: false, color: 'purple' }
  ]);
  const [activeTab, setActiveTab] = useState('1'); 
  const [discardPile, setDiscardPile] = useState([]);
  const [round, setRound] = useState(1);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showEndRound, setShowEndRound] = useState(false);
  const [popup, setPopup] = useState(null);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editName, setEditName] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [settings, setSettings] = useState({
    trackAllPlayers: true,
    trackDiscard: true,
    autoSwitch: true
  });

  // Track Fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const activePlayer = players.find(p => p.id === activeTab);
  const isDiscardTab = activeTab === 'discard';

  const getRemaining = (key) => {
    let count = DECK[key];
    if (settings.trackAllPlayers) players.forEach(p => { count -= p.cards.filter(c => c === key).length; });
    if (settings.trackDiscard) count -= discardPile.filter(c => c === key).length;
    return Math.max(0, count);
  };

  const totalRemaining = Object.keys(DECK).reduce((sum, key) => sum + getRemaining(key), 0);
  const currentPoints = activePlayer ? calculatePoints(activePlayer.cards, activePlayer.busted) : 0;
  const activeNums = activePlayer ? new Set(activePlayer.cards.filter(c => c.startsWith('num_'))) : new Set();
  const hasSecondChance = activePlayer ? activePlayer.cards.includes('act_2nd') : false;
  
  let bustCardsCount = 0;
  let newNumCardsCount = 0;
  let specialCardsCount = 0;
  let expectedDelta = 0;

  if (activePlayer && !activePlayer.busted && !activePlayer.standing && !activePlayer.frozen) {
    Object.keys(DECK).forEach(key => {
      const count = getRemaining(key);
      if (count === 0) return;
      const prob = count / totalRemaining;
      let delta = 0;
      
      if (key.startsWith('num_')) {
        if (activeNums.has(key)) {
          bustCardsCount += count;
          delta = hasSecondChance ? 0 : -currentPoints; 
        } else {
          newNumCardsCount += count;
          const val = parseInt(key.replace('num_', ''));
          const multiplier = activePlayer.cards.includes('mod_x2') ? 2 : 1;
          delta = val * multiplier;
          if (activeNums.size === 6) delta += 15; 
        }
      } else if (key.startsWith('mod_')) {
        specialCardsCount += count;
        if (key === 'mod_x2') {
          const numSum = activePlayer.cards.filter(c => c.startsWith('num_')).reduce((acc, c) => acc + parseInt(c.replace('num_', '')), 0);
          delta = numSum; 
        } else delta = parseInt(key.replace('mod_+', ''));
      } else {
        specialCardsCount += count;
      }
      expectedDelta += prob * delta;
    });
  }

  const fatalBustProb = (!activePlayer || activePlayer.busted || activePlayer.standing || activePlayer.frozen || totalRemaining === 0) ? 0 : (hasSecondChance ? 0 : bustCardsCount / totalRemaining);
  const safeProb = (!activePlayer || activePlayer.busted || activePlayer.standing || activePlayer.frozen || totalRemaining === 0) ? 0 : (1 - fatalBustProb);
  
  const triggerPopup = (type, playerName, cardId = null) => setPopup({ type, playerName, cardId });

  const advanceTurn = (newPlayersState) => {
    if (!settings.autoSwitch) return;
    const currentIndex = newPlayersState.findIndex(p => p.id === activeTab);
    if (currentIndex === -1) return;
    
    let nextIndex = (currentIndex + 1) % newPlayersState.length;
    let loopCount = 0;
    
    while (loopCount < newPlayersState.length) {
      const nextP = newPlayersState[nextIndex];
      if (!nextP.busted && !nextP.standing && !nextP.frozen) {
        setActiveTab(nextP.id);
        return;
      }
      nextIndex = (nextIndex + 1) % newPlayersState.length;
      loopCount++;
    }
  };

  const handleAddCard = (id) => {
    if (getRemaining(id) <= 0) return;

    if (isDiscardTab) {
      setDiscardPile([...discardPile, id]);
      return;
    }

    if (!activePlayer || activePlayer.busted || activePlayer.standing || activePlayer.frozen) return;

    let updatedPlayers = [...players];
    let isBustEvent = false;

    if (id.startsWith('num_') && activePlayer.cards.includes(id)) {
      const secondChanceIdx = activePlayer.cards.indexOf('act_2nd');
      if (secondChanceIdx !== -1) {
        const newCards = [...activePlayer.cards];
        newCards.splice(secondChanceIdx, 1);
        updatedPlayers = updatedPlayers.map(p => p.id === activePlayer.id ? { ...p, cards: newCards } : p);
        setDiscardPile([...discardPile, 'act_2nd', id]);
        triggerPopup('SAVED', activePlayer.name, id);
      } else {
        const newCards = [...activePlayer.cards, id];
        updatedPlayers = updatedPlayers.map(p => p.id === activePlayer.id ? { ...p, cards: newCards, busted: true } : p);
        triggerPopup('BUST', activePlayer.name, id);
        isBustEvent = true;
      }
    } else {
      const newCards = [...activePlayer.cards, id];
      updatedPlayers = updatedPlayers.map(p => p.id === activePlayer.id ? { ...p, cards: newCards } : p);
      if (id.startsWith('num_')) {
        const uniqueNumsCount = new Set(newCards.filter(c => c.startsWith('num_'))).size;
        if (uniqueNumsCount === 7) triggerPopup('FLIP7', activePlayer.name);
      }
    }

    setPlayers(updatedPlayers);
    advanceTurn(updatedPlayers);
  };

  const handleUndo = () => {
    if (isDiscardTab) {
      if (discardPile.length === 0) return;
      setDiscardPile(discardPile.slice(0, -1));
    } else {
      if (!activePlayer || activePlayer.cards.length === 0) return;
      const newCards = activePlayer.cards.slice(0, -1);
      const hasDuplicate = new Set(newCards.filter(c => c.startsWith('num_'))).size !== newCards.filter(c => c.startsWith('num_')).length;
      setPlayers(players.map(p => p.id === activePlayer.id ? { ...p, cards: newCards, busted: hasDuplicate } : p));
    }
  };

  const handleResetGame = () => {
    if (window.confirm("Are you sure you want to reset the entire game? All players, scores, and round data will be wiped.")) {
      setPlayers([
        { id: '1', name: 'Player 1', cards: [], score: 0, busted: false, standing: false, frozen: false, color: 'blue' },
        { id: '2', name: 'Player 2', cards: [], score: 0, busted: false, standing: false, frozen: false, color: 'purple' }
      ]);
      setDiscardPile([]);
      setRound(1);
      setActiveTab('1');
      setShowSettings(false);
    }
  };

  const togglePlayerState = (playerId, field) => {
    setPlayers(players.map(p => p.id === playerId ? { ...p, [field]: !p[field] } : p));
  };

  const handleRemoveCard = (playerId, index) => {
    if (playerId === 'discard') {
      setDiscardPile(discardPile.filter((_, i) => i !== index));
    } else {
      setPlayers(players.map(p => {
        if (p.id === playerId) {
          const newCards = [...p.cards];
          newCards.splice(index, 1);
          const hasDuplicate = new Set(newCards.filter(c => c.startsWith('num_'))).size !== newCards.filter(c => c.startsWith('num_')).length;
          return { ...p, cards: newCards, busted: hasDuplicate };
        }
        return p;
      }));
    }
  };

  const handleAddPlayer = () => {
    const newId = Date.now().toString();
    const colors = ['emerald', 'amber', 'pink', 'cyan', 'indigo', 'rose', 'orange'];
    const randomColor = colors[players.length % colors.length];
    setPlayers([...players, { id: newId, name: `Player ${players.length + 1}`, cards: [], score: 0, busted: false, standing: false, frozen: false, color: randomColor }]);
  };

  const handleRemovePlayer = (idToRemove) => {
    if (players.length <= 1) return;
    const newPlayers = players.filter(p => p.id !== idToRemove);
    setPlayers(newPlayers);
    if (activeTab === idToRemove) setActiveTab(newPlayers[0].id);
  };

  const commitRoundScores = (shuffleDeck = false) => {
    let allCardsToDiscard = [];
    const updatedPlayers = players.map(p => {
      const roundPts = calculatePoints(p.cards, p.busted);
      allCardsToDiscard = [...allCardsToDiscard, ...p.cards];
      return { ...p, score: p.score + roundPts, cards: [], busted: false, standing: false, frozen: false };
    });
    setPlayers(updatedPlayers);
    if (shuffleDeck) setDiscardPile([]);
    else setDiscardPile([...discardPile, ...allCardsToDiscard]);
    setRound(round + 1);
    setShowEndRound(false);
  };

  const handleEntireDeckReshuffle = () => {
    setDiscardPile([]);
  };

  const InputButton = ({ id }) => {
    const count = getRemaining(id);
    const disabled = count <= 0 || (!isDiscardTab && (activePlayer?.busted || activePlayer?.standing || activePlayer?.frozen));
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

  const CardBadge = ({ id, onRemove, isBustCard }) => {
    const text = formatCardName(id);
    let color = 'bg-slate-700 text-white';
    if (id.startsWith('num_')) color = 'bg-blue-600 text-white';
    if (id.startsWith('mod_')) color = 'bg-purple-600 text-white';
    if (id.startsWith('act_')) color = 'bg-amber-600 text-white';
    
    return (
      <div onClick={onRemove} className={`rounded-lg cursor-pointer flex flex-col items-center justify-center font-bold text-sm md:text-base lg:text-lg shadow-md border hover:border-red-400 transition-all w-12 h-16 md:w-14 md:h-20 group relative overflow-hidden flex-shrink-0 ${color} ${isBustCard ? 'border-red-500 animate-pulse' : 'border-white/10'}`}>
        <span>{text}</span>
        <div className="absolute inset-0 bg-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={18} />
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden selection:bg-blue-500/30">
      <GamePopup popup={popup} onClose={() => setPopup(null)} />

      {/* --- TOP HEADER (Fixed Height) --- */}
      <div className="h-16 md:h-20 px-3 md:px-6 flex justify-between items-center bg-slate-900/50 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-black bg-gradient-to-r from-blue-400 via-purple-400 to-amber-400 bg-clip-text text-transparent leading-none">
              FLIP 7 <span className="text-slate-500 text-sm md:text-lg font-medium tracking-widest uppercase hidden sm:inline">Engine</span>
            </h1>
            <p className="text-slate-400 text-[10px] md:text-xs mt-1 font-bold tracking-wider">
              ROUND {round} <span className="mx-2 text-slate-700">|</span> {totalRemaining} CARDS
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 relative">
          <button onClick={handleUndo} className="px-2 md:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors flex items-center gap-1.5 text-xs md:text-sm border border-slate-700">
            <Undo2 size={14} /> <span className="hidden sm:inline">Undo</span>
          </button>
          
          <button onClick={handleEntireDeckReshuffle} className="hidden sm:flex px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors items-center gap-1.5 text-xs md:text-sm border border-slate-700">
            <Shuffle size={14} /> Reshuffle
          </button>
          
          <button onClick={() => setShowEndRound(true)} className="px-3 md:px-4 py-1.5 md:py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg text-xs md:text-sm">
            <Trophy size={14} /> End Round
          </button>
          
          <button onClick={() => setShowSettings(!showSettings)} className="px-2 md:px-3 py-1.5 md:py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center">
            <Settings size={16} />
          </button>

          <button onClick={toggleFullscreen} className="px-2 md:px-3 py-1.5 md:py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-300">
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          
          {showSettings && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 z-40">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Settings</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">Auto-Switch Player Turns</span>
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-900" checked={settings.autoSwitch} onChange={() => setSettings(s => ({ ...s, autoSwitch: !s.autoSwitch }))} />
                </label>
                <div className="h-px w-full bg-slate-700"></div>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">Track All Players</span>
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-900" checked={settings.trackAllPlayers} onChange={() => setSettings(s => ({ ...s, trackAllPlayers: !s.trackAllPlayers }))} />
                </label>
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white">Track Discard</span>
                  <input type="checkbox" className="w-4 h-4 rounded bg-slate-900" checked={settings.trackDiscard} onChange={() => setSettings(s => ({ ...s, trackDiscard: !s.trackDiscard }))} />
                </label>
                <div className="h-px w-full bg-slate-700 my-2"></div>
                <button onClick={handleResetGame} className="w-full text-left flex items-center gap-2 text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors">
                  <RotateCcw size={14} /> Reset Entire Game
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MAIN 3-COLUMN LAYOUT --- */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full max-w-[1600px] mx-auto p-2 md:p-4 gap-2 md:gap-4 overflow-hidden">
        
        {/* COLUMN 1: Input / Keyboard (Always visible, scrollable if tiny height) */}
        <div className="w-full lg:w-3/12 xl:w-1/4 flex flex-col min-h-0 gap-2 md:gap-4 order-2 lg:order-1">
          {/* Deck Composition Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl hidden lg:block flex-shrink-0">
             <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Live Deck Remaining</h3>
             <div className="flex items-end h-12 gap-1 w-full">
                {NUMBERS.map(id => {
                   const count = getRemaining(id);
                   return (
                      <div key={id} className="flex-1 flex flex-col items-center relative group">
                         <div className="w-full bg-blue-600/50 rounded-t transition-all group-hover:bg-blue-400" style={{ height: `${(count/12)*100}%`, minHeight: count > 0 ? '2px' : '0' }}>
                           {count === 0 && <div className="absolute inset-0 bg-rose-500/20 w-full h-1 bottom-0"></div>}
                         </div>
                      </div>
                   );
                })}
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center flex-shrink-0">
              <span>{isDiscardTab ? 'Add to Discard' : 'Draw Card'}</span>
            </h3>
            
            <div className={`flex flex-col gap-3 transition-opacity ${(!isDiscardTab && (activePlayer?.busted || activePlayer?.standing || activePlayer?.frozen)) ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-4 gap-1.5">
                {NUMBERS.map(id => <InputButton key={id} id={id} />)}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {MODIFIERS.map(id => <InputButton key={id} id={id} />)}
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {ACTIONS.map(id => <InputButton key={id} id={id} />)}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Active Center Stage */}
        <div className="w-full lg:w-6/12 xl:w-2/4 flex flex-col min-h-0 order-1 lg:order-2">
          
          {/* Top Leaderboard / Tabs (Horizontal scroll) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 shadow-xl overflow-x-auto custom-scrollbar mb-2 flex-shrink-0">
            <div className="flex gap-1.5 min-w-max">
              {players.map((p) => (
                <button 
                  key={p.id} onClick={() => setActiveTab(p.id)} 
                  className={`relative px-3 py-2 rounded-lg text-sm font-bold flex flex-col items-start min-w-[110px] transition-all ${activeTab === p.id ? `bg-${p.color}-600 text-white shadow-lg` : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <div className="flex items-center justify-between w-full mb-0.5">
                    <span className="truncate pr-1 text-xs">{p.name}</span>
                    {activeTab === p.id && <Edit2 size={10} className="opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setEditName(p.name); setEditingPlayerId(p.id); }} />}
                  </div>
                  <div className="text-[10px] font-normal opacity-80 flex gap-1.5 items-center">
                     <span>Pts: {p.score}</span>
                     <span className={p.busted ? 'text-red-300 font-bold' : (p.standing || p.frozen) ? 'text-amber-300 font-bold' : ''}>
                       ({p.busted ? 'BUST' : p.standing ? 'STAND' : p.frozen ? 'FROZEN' : `+${calculatePoints(p.cards)}`})
                     </span>
                  </div>
                </button>
              ))}
              
              <button onClick={() => setActiveTab('discard')} className={`px-3 py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center min-w-[90px] transition-all ${activeTab === 'discard' ? 'bg-slate-600 text-white shadow-lg' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                 <Trash2 size={14} className="mb-0.5" /> Discard
              </button>
              <button onClick={handleAddPlayer} className="px-3 py-2 rounded-lg text-xs font-bold flex flex-col items-center justify-center min-w-[60px] bg-slate-900 border border-slate-700 border-dashed text-slate-400 hover:bg-slate-800 transition-all">
                 <Plus size={16} /> Add
              </button>
            </div>
          </div>

          {/* Inline Edit UI */}
          {editingPlayerId && (
             <div className="bg-slate-800 border border-slate-600 p-2 rounded-lg flex gap-2 shadow-xl mb-2 flex-shrink-0 animate-in fade-in slide-in-from-top-1">
                <input 
                  type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white focus:outline-none" autoFocus maxLength={12}
                />
                <button onClick={() => { setPlayers(players.map(p => p.id === editingPlayerId ? { ...p, name: editName || p.name } : p)); setEditingPlayerId(null); }} className="bg-blue-600 p-1.5 rounded text-white"><Check size={14}/></button>
                <button onClick={() => setEditingPlayerId(null)} className="bg-slate-700 p-1.5 rounded text-white"><X size={14}/></button>
                {players.length > 1 && <button onClick={() => { handleRemovePlayer(editingPlayerId); setEditingPlayerId(null); }} className="bg-rose-900/50 text-rose-400 p-1.5 rounded ml-auto hover:bg-rose-900"><Trash2 size={14}/></button>}
             </div>
          )}

          {/* Active View Area (Fills remaining height) */}
          <div className="flex-1 flex flex-col min-h-0 relative">
            {isDiscardTab ? (
              <div className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 flex flex-col overflow-y-auto custom-scrollbar shadow-inner">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center justify-between mb-4 sticky top-0 bg-slate-900/90 backdrop-blur pb-2 z-10">
                  <span className="flex items-center gap-1.5"><Trash2 size={14} className="text-slate-500"/> Discard Pile</span>
                  <span className="bg-slate-800 px-2 py-1 rounded">{discardPile.length} Cards</span>
                </h3>
                <div className="flex flex-wrap gap-1.5 content-start">
                   {discardPile.map((card, i) => <CardBadge key={`disc-${i}`} id={card} onRemove={() => handleRemoveCard('discard', i)} />)}
                </div>
              </div>
            ) : activePlayer ? (
              <div className={`flex-1 bg-slate-900/60 border rounded-xl p-3 md:p-5 flex flex-col overflow-y-auto custom-scrollbar shadow-inner transition-colors ${activePlayer.busted ? 'border-rose-900/50 bg-rose-950/10' : activePlayer.standing ? 'border-amber-900/50' : activePlayer.frozen ? 'border-cyan-900/50' : `border-${activePlayer.color}-900/30`}`}>
                 
                 {/* Player Header Banner */}
                 <div className="flex justify-between items-start mb-4">
                   <div>
                     <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
                        <User size={20} className={`text-${activePlayer.color}-500`} /> {activePlayer.name}
                     </h2>
                     <div className="text-xs text-slate-400 font-bold mt-1 tracking-wider uppercase">Total: {activePlayer.score} / {WINNING_SCORE}</div>
                   </div>
                   
                   <div className="flex gap-1.5 md:gap-2">
                      <button onClick={() => togglePlayerState(activePlayer.id, 'frozen')} className={`p-2 rounded-lg border transition-all ${activePlayer.frozen ? 'bg-cyan-900/80 text-cyan-300 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-cyan-400 hover:border-cyan-800'}`} title="Toggle Frozen">
                         <Snowflake size={16} />
                      </button>
                      <button onClick={() => togglePlayerState(activePlayer.id, 'standing')} className={`p-2 rounded-lg border transition-all ${activePlayer.standing ? 'bg-amber-900/80 text-amber-300 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-900 text-slate-500 border-slate-700 hover:text-amber-400 hover:border-amber-800'}`} title="Toggle Stand">
                         <Hand size={16} />
                      </button>
                   </div>
                 </div>

                 {/* Active Status Badges */}
                 <div className="flex flex-wrap gap-2 mb-4">
                   <div className="bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-2 shadow-inner">
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Round</span>
                      <span className={`text-xl font-black ${activePlayer.busted ? 'text-rose-500 line-through opacity-50' : 'text-white'}`}>{currentPoints}</span>
                   </div>
                   {hasSecondChance && <span className="bg-amber-900/40 text-amber-400 text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-amber-700/50 flex items-center gap-1"><ShieldCheck size={12}/> Shield Active</span>}
                   {activePlayer.busted && <span className="bg-rose-900/40 text-rose-400 text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-rose-700/50 flex items-center gap-1 animate-pulse"><AlertTriangle size={12}/> BUSTED</span>}
                   {activePlayer.standing && <span className="bg-amber-900/40 text-amber-400 text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-amber-700/50 flex items-center gap-1"><Hand size={12}/> STANDING</span>}
                   {activePlayer.frozen && <span className="bg-cyan-900/40 text-cyan-400 text-[10px] px-2 py-1 rounded-lg uppercase font-bold border border-cyan-700/50 flex items-center gap-1"><Snowflake size={12}/> FROZEN</span>}
                   <span className={`text-[10px] px-2 py-1 rounded-lg uppercase font-bold border flex items-center gap-1 ml-auto ${activeNums.size >= 7 ? 'bg-blue-900/50 text-blue-300 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>
                      <Sparkles size={12}/> {activeNums.size}/7
                   </span>
                 </div>
                 
                 {/* Card Line Render */}
                 <div className="flex-1 flex flex-wrap gap-1.5 md:gap-2 content-start bg-slate-950/30 rounded-xl p-2 md:p-4 border border-slate-800/50 min-h-[120px]">
                    {activePlayer.cards.length === 0 ? (
                      <div className="w-full flex flex-col items-center justify-center text-slate-600 text-xs font-bold uppercase tracking-wider py-8">
                        Line is empty
                      </div>
                    ) : (
                      activePlayer.cards.map((card, i) => {
                        const isBustCard = activePlayer.busted && card.startsWith('num_') && activePlayer.cards.filter(c => c === card).length > 1;
                        return <CardBadge key={`card-${i}`} id={card} onRemove={() => handleRemoveCard(activePlayer.id, i)} isBustCard={isBustCard} />;
                      })
                    )}
                 </div>

                 {/* Math HUD (Only shown if active and not busted/stood/frozen) */}
                 {!activePlayer.busted && !activePlayer.standing && !activePlayer.frozen && totalRemaining > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-3 flex-shrink-0">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 relative overflow-hidden flex flex-col items-center justify-center text-center">
                        <div className={`absolute -inset-10 opacity-10 blur-xl rounded-full ${safeProb > 0.7 ? 'bg-emerald-500' : safeProb > 0.4 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                        <p className="text-slate-400 font-bold tracking-widest uppercase text-[9px] relative z-10">Safe Draw</p>
                        <h2 className="text-xl md:text-2xl font-black relative z-10 leading-none mt-1">{(safeProb * 100).toFixed(0)}<span className="text-xs text-slate-500">%</span></h2>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col items-center justify-center text-center">
                        <p className="text-slate-400 font-bold tracking-widest uppercase text-[9px]">Exp. Value</p>
                        <div className={`text-xl md:text-2xl font-black leading-none mt-1 ${expectedDelta > 0 ? 'text-emerald-400' : expectedDelta < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {expectedDelta > 0 ? '+' : ''}{expectedDelta.toFixed(1)}
                        </div>
                      </div>
                    </div>
                 )}
              </div>
            ) : null}
          </div>
        </div>

        {/* COLUMN 3: Right Overview (Widescreen Only natively, accessible on mobile via tabs/scroll if adjusted, but hidden to save space normally) */}
        <div className="hidden lg:flex w-3/12 xl:w-1/4 flex-col min-h-0 order-3 border-l border-slate-800 pl-4 bg-slate-950">
           <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2 flex-shrink-0">
             <Users size={14}/> Table Overview
           </h3>
           <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
              {players.map((p, idx) => {
                 const pRoundPts = calculatePoints(p.cards, p.busted);
                 const progressPercent = Math.min(100, ((p.score + pRoundPts) / WINNING_SCORE) * 100);
                 const isWinning = p.score + pRoundPts >= WINNING_SCORE;
                 
                 return (
                   <div key={p.id} className={`bg-slate-900/80 border p-3 rounded-xl flex flex-col gap-2 transition-all ${p.id === activeTab ? `border-${p.color}-500/50 shadow-[0_0_15px_rgba(var(--tw-colors-${p.color}-500),0.1)]` : 'border-slate-800'}`}>
                      <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2">
                           <div className={`w-5 h-5 rounded bg-${p.color}-900/50 text-${p.color}-400 text-[10px] font-bold flex items-center justify-center border border-${p.color}-700`}>{idx + 1}</div>
                           <span className="text-sm font-bold text-white truncate max-w-[100px]">{p.name}</span>
                         </div>
                         <div className="flex gap-1">
                            <button onClick={() => togglePlayerState(p.id, 'frozen')} className={`p-1 rounded ${p.frozen ? 'bg-cyan-900 text-cyan-400' : 'bg-slate-800 text-slate-500 hover:text-cyan-400'}`}><Snowflake size={12}/></button>
                            <button onClick={() => togglePlayerState(p.id, 'standing')} className={`p-1 rounded ${p.standing ? 'bg-amber-900 text-amber-400' : 'bg-slate-800 text-slate-500 hover:text-amber-400'}`}><Hand size={12}/></button>
                         </div>
                      </div>
                      
                      {/* Points / Win Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                          <span className={isWinning ? 'text-amber-400 animate-pulse flex items-center gap-1' : 'text-slate-400'}>
                             {isWinning && <Crown size={10}/>} Total {p.score} <span className="text-emerald-400 opacity-80">(+{pRoundPts})</span>
                          </span>
                          <span className="text-slate-600">{WINNING_SCORE}</span>
                        </div>
                        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                           <div className={`h-full transition-all ${isWinning ? 'bg-amber-400' : `bg-${p.color}-500`}`} style={{width: `${progressPercent}%`}}></div>
                        </div>
                      </div>

                      {/* Mini Cards */}
                      <div className="flex flex-wrap gap-1 mt-1">
                         {p.cards.length === 0 ? <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">No Cards</span> : null}
                         {p.cards.map((c, i) => (
                           <div key={i} className={`w-4 h-5 rounded-sm border ${c.startsWith('num_') ? 'bg-blue-900/50 border-blue-700/50' : c.startsWith('mod_') ? 'bg-purple-900/50 border-purple-700/50' : 'bg-amber-900/50 border-amber-700/50'}`}></div>
                         ))}
                      </div>
                      
                      {/* Status row */}
                      <div className="flex gap-1 mt-auto pt-1">
                         {p.busted && <span className="text-[8px] bg-rose-900/50 text-rose-400 px-1.5 py-0.5 rounded border border-rose-800 uppercase font-bold">Busted</span>}
                         {p.standing && <span className="text-[8px] bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800 uppercase font-bold">Stand</span>}
                         {p.frozen && <span className="text-[8px] bg-cyan-900/50 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800 uppercase font-bold">Frozen</span>}
                         {new Set(p.cards.filter(c => c.startsWith('num_'))).size >= 7 && <span className="text-[8px] bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500 uppercase font-bold ml-auto">Flip 7</span>}
                      </div>
                   </div>
                 );
              })}
           </div>
        </div>
      </div>

      {/* --- END ROUND MODAL --- */}
      {showEndRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-900 border border-slate-700 p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest mb-4 flex items-center justify-between flex-shrink-0">
              Round {round} Summary <Trophy className="text-amber-400" />
            </h2>
            
            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2 mb-6 pr-2">
              {players.map((p, i) => {
                const roundPts = calculatePoints(p.cards, p.busted);
                const newTotal = p.score + roundPts;
                const isWinner = newTotal >= WINNING_SCORE;
                
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border ${isWinner ? 'bg-amber-900/30 border-amber-500/50' : 'bg-slate-800 border-slate-700/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-${p.color}-500 flex items-center justify-center text-white font-bold shadow-md`}>{i+1}</div>
                      <div>
                        <span className="font-bold text-white block leading-tight">{p.name}</span>
                        {isWinner && <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1"><Crown size={10}/> Winner!</span>}
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={`text-lg font-black block leading-tight ${p.busted ? 'text-rose-500' : 'text-emerald-400'}`}>
                         {p.busted ? 'BUST (0)' : `+${roundPts}`}
                       </span>
                       <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total: {newTotal}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <button onClick={() => commitRoundScores(false)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-colors">
                Next Round (Keep Discard)
              </button>
              <button onClick={() => commitRoundScores(true)} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Shuffle size={14}/> Reshuffle Deck
              </button>
            </div>
            <button onClick={() => setShowEndRound(false)} className="w-full mt-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-sm font-bold rounded-xl transition-colors flex-shrink-0">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
