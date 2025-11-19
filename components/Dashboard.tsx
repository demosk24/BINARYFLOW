import React, { useState, useEffect, useRef } from 'react';
import { AppState, TradeSettings, UserRole, UserProfile, Signal } from '../types';
import { calculateNextTradeAmount, calculateProfit, getCycleStatus, CONSTANTS } from '../utils/logic';
import { Play, Zap, Shield, Lock, CheckCircle2, XCircle, Unlock, Wallet, BarChart3, History, Target, Timer, TrendingUp, TrendingDown, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface Props {
  state: AppState;
  userProfile: UserProfile;
  onUpdateState: (newState: AppState) => void;
  onReset: () => void;
}

export const Dashboard: React.FC<Props> = ({ state, userProfile, onUpdateState, onReset }) => {
  const [nextTrade, setNextTrade] = useState(calculateNextTradeAmount(state, state.settings));
  const [countdown, setCountdown] = useState<string | null>(null);
  
  // Signal State
  const [latestSignal, setLatestSignal] = useState<Signal | null>(null);
  const [signalTimer, setSignalTimer] = useState('');

  // Sync logic for calculation
  useEffect(() => {
    setNextTrade(calculateNextTradeAmount(state, state.settings));
  }, [state]);

  // Signal Listener
  useEffect(() => {
    const q = query(collection(db, 'signals'), orderBy('startTime', 'desc'), limit(1));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const sig = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Signal;
        // Only show if future or currently active (start time + duration > now)
        const endTime = sig.startTime + (sig.expiresInMinutes * 60 * 1000);
        if (endTime > Date.now()) {
           setLatestSignal(sig);
        } else {
           setLatestSignal(null);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Timers (User Deactivation & Signal)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      // 1. User Deactivation Timer
      if (!userProfile.isActive && userProfile.deactivatedUntil) {
        const diff = userProfile.deactivatedUntil - now;
        if (diff <= 0) {
           setCountdown("Awaiting Admin Activation");
        } else {
           const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
           const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
           const s = Math.floor((diff % (1000 * 60)) / 1000);
           setCountdown(`${h}h ${m}m ${s}s`);
        }
      } else if (!userProfile.isActive) {
        setCountdown("Indefinitely Suspended");
      } else {
        setCountdown(null);
      }

      // 2. Signal Timer
      if (latestSignal) {
         const timeToStart = latestSignal.startTime - now;
         if (timeToStart > 0) {
             // Counting down to start
             const m = Math.floor((timeToStart % (1000 * 60 * 60)) / (1000 * 60));
             const s = Math.floor((timeToStart % (1000 * 60)) / 1000);
             setSignalTimer(`STARTS IN ${m}m ${s}s`);
         } else {
             // Active
             const endTime = latestSignal.startTime + (latestSignal.expiresInMinutes * 60 * 1000);
             const timeToEnd = endTime - now;
             if (timeToEnd > 0) {
                 const m = Math.floor((timeToEnd % (1000 * 60 * 60)) / (1000 * 60));
                 const s = Math.floor((timeToEnd % (1000 * 60)) / 1000);
                 setSignalTimer(`ACTIVE: ${m}m ${s}s REMAINING`);
             } else {
                 setSignalTimer('EXPIRED');
             }
         }
      }

    }, 1000);
    return () => clearInterval(interval);
  }, [userProfile, latestSignal]);

  // Notification Trigger Logic
  const notifyAdmin = async (type: 'TARGET_HIT' | 'LOSS_LIMIT', message: string) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: userProfile.uid,
        userEmail: userProfile.email,
        type,
        message,
        timestamp: Date.now(),
        read: false
      });
    } catch (e) {
      console.error("Failed to send notification", e);
    }
  };

  const lockAccount = async (reason: string) => {
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        isActive: false,
        deactivatedUntil: null 
      });
    } catch (e) {
      console.error("Failed to lock account", e);
    }
  };

  const handleTrade = async (outcome: 'WIN' | 'LOSS') => {
    const tradeAmount = nextTrade.amount;
    const profit = calculateProfit(tradeAmount, state.settings.profitPayoutPercent, outcome);
    const newBalance = state.currentCapital + profit;
    
    const newTrade = {
      id: Date.now().toString(),
      amount: tradeAmount,
      outcome,
      profit,
      type: nextTrade.type,
      timestamp: Date.now(),
      cycleId: state.currentCycleId,
      balanceAfter: newBalance
    };

    const updatedCycles = [...state.cycles];
    const currentCycleIndex = updatedCycles.findIndex(c => c.id === state.currentCycleId);
    
    if (currentCycleIndex > -1) {
      updatedCycles[currentCycleIndex].trades.push(newTrade);
      updatedCycles[currentCycleIndex].netProfit += profit;
      if (updatedCycles[currentCycleIndex].trades.length >= CONSTANTS.CYCLE_SIZE) {
        updatedCycles[currentCycleIndex].status = 'COMPLETED';
      }
    }

    let nextRecovery = false;
    let nextStreak = state.currentStreak;

    if (outcome === 'WIN') {
      nextRecovery = false; 
      nextStreak = state.currentStreak < 0 ? 1 : state.currentStreak + 1;
    } else {
      nextStreak = state.currentStreak > 0 ? -1 : state.currentStreak - 1;
      if (state.isRecoveryNext) {
        nextRecovery = false; 
      } else {
        nextRecovery = true; 
      }
    }

    let newCycleId = state.currentCycleId;
    if (updatedCycles[currentCycleIndex]?.status === 'COMPLETED') {
       newCycleId = state.currentCycleId + 1;
       updatedCycles.push({ id: newCycleId, trades: [], netProfit: 0, status: 'ACTIVE' });
    }

    const startCap = state.settings.startCapital;
    const dailyTarget = startCap * CONSTANTS.DAILY_PROFIT_TARGET_PERCENT;
    const maxLoss = startCap * (state.settings.dailyRiskPercent / 100);
    
    const dailyTargetHit = (newBalance - startCap) >= dailyTarget;
    const maxLossHit = (startCap - newBalance) >= maxLoss;

    const newState: AppState = {
      ...state,
      currentCapital: newBalance,
      history: [...state.history, newTrade],
      cycles: updatedCycles,
      currentCycleId: newCycleId,
      isRecoveryNext: nextRecovery,
      currentStreak: nextStreak,
      dailyTargetHit,
      maxLossHit
    };

    onUpdateState(newState);

    // Sync to Backend
    await updateDoc(doc(db, 'users', userProfile.uid), {
      tradingState: newState,
      lastActive: Date.now()
    });

    // Logic: If target/limit hit -> Lock Account & Notify
    if (dailyTargetHit && !state.dailyTargetHit) {
      await notifyAdmin('TARGET_HIT', `User ${userProfile.email} hit daily profit target! Account Locked.`);
      await lockAccount('Daily Target Hit');
    } else if (maxLossHit && !state.maxLossHit) {
      await notifyAdmin('LOSS_LIMIT', `User ${userProfile.email} hit max loss limit! Account Locked.`);
      await lockAccount('Max Loss Limit Hit');
    }
  };

  const totalProfit = state.currentCapital - state.settings.startCapital;
  const dailyGoal = state.settings.startCapital * CONSTANTS.DAILY_PROFIT_TARGET_PERCENT;
  const progressPercent = Math.min(100, Math.max(0, (totalProfit / dailyGoal) * 100));
  
  const chartData = [
    { name: 'Start', balance: state.settings.startCapital },
    ...state.history.map((t, i) => ({ name: i + 1, balance: t.balanceAfter }))
  ];

  const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
  const tradesInCycle = currentCycle?.trades.length || 0;

  const isLimitReached = state.maxLossHit || state.dailyTargetHit;
  const isAccountBlock = !userProfile.isActive;

  return (
    <div className="space-y-6">
      
      {/* --- TOP BAR: Signal Slide --- */}
      {latestSignal && (
        <div className="w-full glass-panel rounded-xl p-1 relative overflow-hidden animate-glow-blue mb-4">
           <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-blue/10 to-transparent animate-slide-left"></div>
           <div className="relative z-10 flex justify-between items-center px-4 py-2">
              <div className="flex items-center gap-4">
                 <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded animate-pulse flex items-center gap-1">
                    <Radio size={10} /> LIVE SIGNAL
                 </div>
                 <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white tracking-tighter">{latestSignal.pair}</h3>
                    <div className={`flex items-center px-2 py-0.5 rounded text-xs font-bold ${latestSignal.direction === 'CALL' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                       {latestSignal.direction === 'CALL' ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
                       {latestSignal.direction}
                    </div>
                 </div>
              </div>
              <div className="font-mono text-xl font-bold text-neon-blue text-shadow-neon">
                 {signalTimer}
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Account Deactivation Overlay */}
        {isAccountBlock && (
          <div className="absolute inset-0 z-[60] bg-[#020617]/95 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center text-center p-8 border border-red-900/30">
            <div className="p-4 bg-red-900/20 rounded-full mb-6 animate-pulse">
              <Timer size={64} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">
              {state.dailyTargetHit ? 'Daily Target Achieved' : state.maxLossHit ? 'Stop Loss Triggered' : 'Account Suspended'}
            </h2>
            <p className="text-gray-400 max-w-md mb-8">
              {state.dailyTargetHit 
                ? "Congratulations! You've hit your profit target. The system has locked your session to preserve gains." 
                : state.maxLossHit 
                ? "Risk limit reached. The system has halted trading to prevent further losses." 
                : "Administrator has paused your trading access."}
              <br/>
              <span className="text-sm mt-4 block text-gray-500">Please wait for Administrator reactivation.</span>
            </p>
            {countdown && (
              <div className="bg-black/50 border border-red-500/30 px-8 py-4 rounded-xl animate-glow-red">
                <div className="text-sm text-red-400 uppercase tracking-widest mb-1">Status</div>
                <div className="text-xl font-mono font-bold text-white">{countdown}</div>
              </div>
            )}
            
            {/* Detailed Risk Stats during Block */}
            <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-lg text-left">
                <div className="bg-gray-900/50 p-3 rounded border border-gray-800">
                    <div className="text-xs text-gray-500">Session P/L</div>
                    <div className={`text-lg font-bold ${totalProfit >=0 ? 'text-green-400' : 'text-red-400'}`}>
                        ${totalProfit.toFixed(2)}
                    </div>
                </div>
                 <div className="bg-gray-900/50 p-3 rounded border border-gray-800">
                    <div className="text-xs text-gray-500">Limit Hit?</div>
                    <div className="text-lg font-bold text-white">
                        {state.dailyTargetHit ? 'Target' : state.maxLossHit ? 'Loss' : 'Admin'}
                    </div>
                </div>
                 <div className="bg-gray-900/50 p-3 rounded border border-gray-800">
                    <div className="text-xs text-gray-500">Trades</div>
                    <div className="text-lg font-bold text-white">{state.history.length}</div>
                </div>
            </div>
          </div>
        )}

        {/* Left Column: Stats & Chart */}
        <div className="lg:col-span-8 space-y-6">
          {/* Header Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Balance Card */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group animate-glow-blue transition-transform hover:scale-[1.02] duration-300">
              <div className="absolute z-10 -right-8 -top-8 w-32 h-32 bg-neon-blue/10 rounded-full blur-2xl group-hover:bg-neon-blue/20 transition-all duration-500"></div>
              <div className="relative z-20">
                <div className="flex items-center gap-2 mb-2 text-gray-400">
                  <div className="p-1.5 bg-neon-blue/10 rounded-lg shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                      <Wallet size={14} className="text-neon-blue" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider">Current Balance</p>
                </div>
                <h2 className="text-3xl font-mono font-bold text-white mt-1 tracking-tight">${state.currentCapital.toFixed(2)}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalProfit >= 0 ? 'bg-green-500/20 text-neon-green border border-green-500/30' : 'bg-red-500/20 text-neon-red border border-red-500/30'}`}>
                      {totalProfit >= 0 ? '+' : ''}{((totalProfit/state.settings.startCapital)*100).toFixed(2)}%
                  </span>
                  <span className="text-xs text-gray-500">Today's P/L</span>
                </div>
              </div>
            </div>
            
            {/* Target Card */}
            <div className="glass-panel p-5 rounded-2xl relative animate-glow-green transition-transform hover:scale-[1.02] duration-300">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                  <div className="p-1.5 bg-neon-green/10 rounded-lg shadow-[0_0_10px_rgba(0,255,157,0.2)]">
                      <Target size={14} className="text-neon-green" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider">Daily Goal</p>
                </div>
              <div className="flex items-end justify-between mt-1">
                <h2 className="text-2xl font-mono font-bold text-white">${dailyGoal.toFixed(2)}</h2>
                <span className="text-xs text-gray-400 mb-1">{progressPercent.toFixed(0)}% Completed</span>
              </div>
              <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-neon-green to-emerald-400 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,255,157,0.5)]" 
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Cycle Card */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center relative border border-white/5 animate-glow-purple transition-transform hover:scale-[1.02] duration-300">
              <div className="absolute top-3 right-3">
                {state.settings.useBoostMode && <Zap size={14} className="text-neon-purple animate-pulse" />}
              </div>
              <div className="flex items-center gap-2 mb-3 text-gray-400">
                  <div className="p-1.5 bg-neon-purple/10 rounded-lg shadow-[0_0_10px_rgba(188,19,254,0.2)]">
                      <History size={14} className="text-neon-purple" />
                  </div>
                  <p className="text-xs font-medium uppercase tracking-wider">Cycle Status</p>
                </div>
              <div className="flex items-center gap-1.5 mt-1">
                {[...Array(CONSTANTS.CYCLE_SIZE)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                      i < tradesInCycle ? 'bg-neon-blue shadow-[0_0_8px_rgba(0,243,255,0.8)]' : 'bg-gray-800'
                    }`}
                  ></div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3 text-right font-mono">Step {tradesInCycle + 1} / {CONSTANTS.CYCLE_SIZE}</p>
            </div>
          </div>

          {/* Chart Section */}
          <div className="glass-panel p-6 rounded-2xl h-80 w-full border border-white/5 relative hover:border-white/10 transition-colors duration-500">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-neon-blue" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Performance Curve</h3>
                </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00f3ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} tickMargin={10} />
                  <YAxis stroke="#555" fontSize={10} domain={['auto', 'auto']} tickLine={false} axisLine={false} tickMargin={10} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(10,10,18,0.9)', borderColor: '#333', borderRadius: '8px', backdropFilter: 'blur(4px)', boxShadow: '0 0 15px rgba(0,243,255,0.1)' }} 
                    itemStyle={{ color: '#00f3ff', fontFamily: 'monospace' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="balance" 
                    stroke="#00f3ff" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorBalance)" 
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Trade Execution Panel */}
        <div className="lg:col-span-4 space-y-6">
          
          {isLimitReached && userProfile.role === 'ADMIN' && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-xl flex items-center gap-3 animate-pulse">
              <Unlock className="text-yellow-500 shrink-0" size={20} />
              <div>
                <h4 className="text-yellow-500 font-bold text-sm">Admin Override Active</h4>
                <p className="text-yellow-200/70 text-xs">Limits reached. Trading continues.</p>
              </div>
            </div>
          )}

          {/* Next Trade Card */}
          <div className={`glass-panel p-1 rounded-2xl relative transition-all duration-500 ${
            state.maxLossHit ? 'pro-glow-red' : 
            state.dailyTargetHit ? 'pro-glow-green' : 
            'pro-glow'
          }`}>
            
            {/* Main Trade Card Content */}
            <div className="bg-[#13131f] rounded-xl p-6 relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 p-4 opacity-5 z-0 pointer-events-none">
                <Play size={120} />
              </div>

              <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Next Investment</h3>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase tracking-wide border ${
                          nextTrade.type === 'MARTINGALE' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.1)]' :
                          nextTrade.type === 'BOOST' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]' :
                          'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                        }`}>
                          {nextTrade.type} Strategy
                        </span>
                      </div>
                    </div>
                    {state.settings.useSafetyMode && (
                      <div className="p-2 bg-green-500/10 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.1)]" title="Safety Mode Active">
                        <Shield size={16} className="text-neon-green" />
                      </div>
                    )}
                  </div>

                  <div className="text-center py-4">
                    <div className="text-6xl font-mono font-bold text-white tracking-tighter text-shadow-neon flex items-start justify-center gap-1">
                      <span className="text-2xl mt-2 text-gray-500">$</span>
                      {nextTrade.amount.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-mono">{nextTrade.reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <button 
                      onClick={() => handleTrade('WIN')}
                      disabled={isAccountBlock || (isLimitReached && userProfile.role !== 'ADMIN')}
                      className="btn-shine relative group bg-gradient-to-b from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:shadow-[0_0_30px_rgba(22,163,74,0.5)] transition-all active:scale-95 flex flex-col items-center justify-center border border-green-400/30"
                    >
                      <span className="relative z-10 flex items-center gap-2">WIN <CheckCircle2 size={16} className="opacity-60" /></span>
                    </button>
                    
                    <button 
                      onClick={() => handleTrade('LOSS')}
                      disabled={isAccountBlock || (isLimitReached && userProfile.role !== 'ADMIN')}
                      className="btn-shine relative group bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all active:scale-95 flex flex-col items-center justify-center border border-red-400/30"
                    >
                      <span className="relative z-10 flex items-center gap-2">LOSS <XCircle size={16} className="opacity-60" /></span>
                    </button>
                  </div>
              </div>
            </div>
          </div>
          
          {/* Advisor Panel */}
          <div className="glass-panel p-5 rounded-2xl border-l-2 border-neon-blue animate-glow-blue">
            <h4 className="text-neon-blue font-bold text-sm flex items-center gap-2 mb-3 uppercase tracking-wide">
              <Zap size={16} /> AI Advisor
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              {isLimitReached 
                ? (userProfile.role === 'ADMIN' 
                    ? "System limits reached. Proceed with caution using Admin privileges." 
                    : "Daily target or Stop-loss limit reached. System locked. Wait for Admin reactivation.")
                : nextTrade.type === 'MARTINGALE' 
                ? "Market reversal detected. Increasing stake to recover previous loss. Maintain discipline."
                : state.currentStreak >= 2
                ? "Winning momentum detected. Slight stake increase applied to maximize trend profitability."
                : "Market volatility is within standard range. Recommended executing base entry size."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};