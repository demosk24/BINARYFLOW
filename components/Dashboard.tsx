import React, { useState, useEffect } from 'react';
import { AppState, TradeSettings, UserRole } from '../types';
import { calculateNextTradeAmount, calculateProfit, getCycleStatus, CONSTANTS } from '../utils/logic';
import { Play, Zap, Shield, Lock, CheckCircle2, XCircle, Unlock, Wallet, BarChart3, History, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Props {
  state: AppState;
  userRole: UserRole;
  onUpdateState: (newState: AppState) => void;
  onReset: () => void;
}

export const Dashboard: React.FC<Props> = ({ state, userRole, onUpdateState, onReset }) => {
  const [nextTrade, setNextTrade] = useState(calculateNextTradeAmount(state, state.settings));

  useEffect(() => {
    setNextTrade(calculateNextTradeAmount(state, state.settings));
  }, [state]);

  const handleTrade = (outcome: 'WIN' | 'LOSS') => {
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

    // Update Cycles
    const updatedCycles = [...state.cycles];
    const currentCycleIndex = updatedCycles.findIndex(c => c.id === state.currentCycleId);
    
    if (currentCycleIndex > -1) {
      updatedCycles[currentCycleIndex].trades.push(newTrade);
      updatedCycles[currentCycleIndex].netProfit += profit;
      
      // Check Cycle completion
      if (updatedCycles[currentCycleIndex].trades.length >= CONSTANTS.CYCLE_SIZE) {
        updatedCycles[currentCycleIndex].status = 'COMPLETED';
      }
    }

    // Logic for Next State
    let nextRecovery = false;
    let nextStreak = state.currentStreak;

    if (outcome === 'WIN') {
      nextRecovery = false; // Win resets recovery
      nextStreak = state.currentStreak < 0 ? 1 : state.currentStreak + 1;
    } else {
      nextStreak = state.currentStreak > 0 ? -1 : state.currentStreak - 1;
      // If we were doing a recovery trade and lost, we stop recovery (One-Step).
      // If we were doing a base trade and lost, we trigger recovery.
      if (state.isRecoveryNext) {
        nextRecovery = false; // Failed recovery, back to base
      } else {
        nextRecovery = true; // Base lost, try recovery
      }
    }

    // Create new cycle if needed
    let newCycleId = state.currentCycleId;
    if (updatedCycles[currentCycleIndex]?.status === 'COMPLETED') {
       newCycleId = state.currentCycleId + 1;
       updatedCycles.push({ id: newCycleId, trades: [], netProfit: 0, status: 'ACTIVE' });
    }

    const startCap = state.settings.startCapital;
    const dailyTarget = startCap * CONSTANTS.DAILY_PROFIT_TARGET_PERCENT;
    const maxLoss = startCap * (state.settings.dailyRiskPercent / 100);
    
    const newState: AppState = {
      ...state,
      currentCapital: newBalance,
      history: [...state.history, newTrade],
      cycles: updatedCycles,
      currentCycleId: newCycleId,
      isRecoveryNext: nextRecovery,
      currentStreak: nextStreak,
      dailyTargetHit: (newBalance - startCap) >= dailyTarget,
      maxLossHit: (startCap - newBalance) >= maxLoss
    };

    onUpdateState(newState);
  };

  const totalProfit = state.currentCapital - state.settings.startCapital;
  const dailyGoal = state.settings.startCapital * CONSTANTS.DAILY_PROFIT_TARGET_PERCENT;
  const progressPercent = Math.min(100, Math.max(0, (totalProfit / dailyGoal) * 100));
  
  // Chart Data
  const chartData = [
    { name: 'Start', balance: state.settings.startCapital },
    ...state.history.map((t, i) => ({ name: i + 1, balance: t.balanceAfter }))
  ];

  const currentCycle = state.cycles.find(c => c.id === state.currentCycleId);
  const tradesInCycle = currentCycle?.trades.length || 0;

  const isLimitReached = state.maxLossHit || state.dailyTargetHit;
  // Trading is disabled IF limit reached AND NOT ADMIN
  const isTradingDisabled = isLimitReached && userRole !== 'ADMIN';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Stats & Chart */}
      <div className="lg:col-span-8 space-y-6">
        {/* Header Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Balance Card */}
          <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute z-10 -right-8 -top-8 w-32 h-32 bg-neon-blue/10 rounded-full blur-2xl group-hover:bg-neon-blue/20 transition-all duration-500"></div>
            <div className="relative z-20">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <div className="p-1.5 bg-neon-blue/10 rounded-lg">
                    <Wallet size={14} className="text-neon-blue" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider">Current Balance</p>
              </div>
              <h2 className="text-3xl font-mono font-bold text-white mt-1 tracking-tight">${state.currentCapital.toFixed(2)}</h2>
              <div className="flex items-center gap-2 mt-2">
                 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalProfit >= 0 ? 'bg-green-500/20 text-neon-green' : 'bg-red-500/20 text-neon-red'}`}>
                    {totalProfit >= 0 ? '+' : ''}{((totalProfit/state.settings.startCapital)*100).toFixed(2)}%
                 </span>
                 <span className="text-xs text-gray-500">Today's P/L</span>
              </div>
            </div>
          </div>
          
          {/* Target Card */}
          <div className="glass-panel p-5 rounded-2xl relative">
             <div className="flex items-center gap-2 mb-2 text-gray-400">
                <div className="p-1.5 bg-neon-green/10 rounded-lg">
                    <Target size={14} className="text-neon-green" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider">Daily Goal</p>
              </div>
             <div className="flex items-end justify-between mt-1">
               <h2 className="text-2xl font-mono font-bold text-white">${dailyGoal.toFixed(2)}</h2>
               <span className="text-xs text-gray-400 mb-1">{progressPercent.toFixed(0)}% Completed</span>
             </div>
             <div className="w-full bg-gray-800 h-1.5 mt-3 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-neon-green to-emerald-400 transition-all duration-1000 ease-out" 
                 style={{ width: `${progressPercent}%` }}
               ></div>
             </div>
          </div>

          {/* Cycle Card */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center relative border border-white/5">
             <div className="absolute top-3 right-3">
               {state.settings.useBoostMode && <Zap size={14} className="text-neon-purple animate-pulse" />}
             </div>
             <div className="flex items-center gap-2 mb-3 text-gray-400">
                <div className="p-1.5 bg-neon-purple/10 rounded-lg">
                    <History size={14} className="text-neon-purple" />
                </div>
                <p className="text-xs font-medium uppercase tracking-wider">Cycle Status</p>
              </div>
             <div className="flex items-center gap-1.5 mt-1">
               {[...Array(CONSTANTS.CYCLE_SIZE)].map((_, i) => (
                 <div 
                   key={i} 
                   className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                     i < tradesInCycle ? 'bg-neon-blue shadow-[0_0_8px_rgba(0,243,255,0.5)]' : 'bg-gray-800'
                   }`}
                 ></div>
               ))}
             </div>
             <p className="text-xs text-gray-500 mt-3 text-right font-mono">Step {tradesInCycle + 1} / {CONSTANTS.CYCLE_SIZE}</p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="glass-panel p-6 rounded-2xl h-80 w-full border border-white/5 relative">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-neon-blue" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Performance Curve</h3>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-gray-400">1H</span>
                <span className="text-[10px] bg-neon-blue/20 px-2 py-1 rounded text-neon-blue font-bold">1D</span>
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
                   contentStyle={{ backgroundColor: 'rgba(10,10,18,0.9)', borderColor: '#333', borderRadius: '8px', backdropFilter: 'blur(4px)' }} 
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
        
        {/* Recent History */}
        <div className="glass-panel p-6 rounded-2xl overflow-hidden border border-white/5">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
            <History size={14} /> Recent Activity
          </h3>
          <div className="overflow-x-auto max-h-60 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase bg-white/5 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium rounded-l-lg">Time</th>
                  <th className="px-4 py-3 text-left font-medium">Signal Type</th>
                  <th className="px-4 py-3 text-left font-medium">Invest</th>
                  <th className="px-4 py-3 text-left font-medium">Result</th>
                  <th className="px-4 py-3 text-right font-medium rounded-r-lg">Profit/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {[...state.history].reverse().map((trade) => (
                  <tr key={trade.id} className="hover:bg-white/5 transition-colors group">
                     <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                       {new Date(trade.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'})}
                     </td>
                     <td className="px-4 py-3">
                       <span className={`text-[10px] px-2 py-1 rounded-md uppercase font-bold tracking-wide ${
                         trade.type === 'MARTINGALE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                         trade.type === 'BOOST' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                         'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                       }`}>
                         {trade.type}
                       </span>
                     </td>
                     <td className="px-4 py-3 font-mono text-white">${trade.amount.toFixed(2)}</td>
                     <td className="px-4 py-3">
                       <span className={`flex items-center gap-1 font-bold text-xs ${trade.outcome === 'WIN' ? 'text-neon-green' : 'text-neon-red'}`}>
                         {trade.outcome === 'WIN' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                         {trade.outcome}
                       </span>
                     </td>
                     <td className={`px-4 py-3 text-right font-mono ${trade.profit > 0 ? 'text-neon-green' : 'text-red-400'}`}>
                       {trade.profit > 0 ? '+' : ''}{trade.profit.toFixed(2)}
                     </td>
                  </tr>
                ))}
                {state.history.length === 0 && (
                   <tr>
                     <td colSpan={5} className="py-8 text-center text-gray-600 italic text-sm">No trade history available for this session.</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Trade Execution Panel */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Admin Override Warning Banner (Only shows for Admin if limit hit) */}
        {isLimitReached && userRole === 'ADMIN' && (
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
           
           {/* USER Blocking Overlay (Blocks clicks) */}
           {isTradingDisabled && (
             <div className="absolute inset-0 z-50 bg-[#050507]/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-center p-6 pointer-events-auto">
                {state.maxLossHit ? (
                 <>
                   <XCircle size={56} className="text-red-500 mb-4" />
                   <h3 className="text-xl font-bold text-white">Session Halted</h3>
                   <p className="text-gray-400 text-sm mt-2">Max daily loss limit reached.</p>
                 </>
               ) : (
                 <>
                   <CheckCircle2 size={56} className="text-neon-green mb-4" />
                   <h3 className="text-xl font-bold text-white">Target Achieved</h3>
                   <p className="text-gray-400 text-sm mt-2">Daily profit goal secured.</p>
                 </>
               )}
               
               <button onClick={onReset} className="mt-8 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium text-white transition-all">
                   End Session & Reset
               </button>
             </div>
           )}

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
                        nextTrade.type === 'MARTINGALE' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        nextTrade.type === 'BOOST' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                      }`}>
                        {nextTrade.type} Strategy
                      </span>
                    </div>
                  </div>
                  {state.settings.useSafetyMode && (
                    <div className="p-2 bg-green-500/10 rounded-full" title="Safety Mode Active">
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
                    disabled={isTradingDisabled}
                    className="relative group bg-gradient-to-b from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-xl font-bold text-lg shadow-lg shadow-green-900/20 transition-all active:scale-95 flex flex-col items-center justify-center border border-green-500/30"
                  >
                    <span className="relative z-10 flex items-center gap-2">WIN <CheckCircle2 size={16} className="opacity-60" /></span>
                    <span className="relative z-10 text-[10px] font-mono font-normal opacity-80 mt-1">
                      +${calculateProfit(nextTrade.amount, state.settings.profitPayoutPercent, 'WIN').toFixed(2)}
                    </span>
                  </button>
                  
                  <button 
                    onClick={() => handleTrade('LOSS')}
                    disabled={isTradingDisabled}
                    className="relative group bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 disabled:grayscale text-white py-5 rounded-xl font-bold text-lg shadow-lg shadow-red-900/20 transition-all active:scale-95 flex flex-col items-center justify-center border border-red-500/30"
                  >
                     <span className="relative z-10 flex items-center gap-2">LOSS <XCircle size={16} className="opacity-60" /></span>
                     <span className="relative z-10 text-[10px] font-mono font-normal opacity-80 mt-1">
                      -${nextTrade.amount.toFixed(2)}
                    </span>
                  </button>
                </div>
             </div>
           </div>
        </div>
        
        {/* Advisor Panel */}
        <div className="glass-panel p-5 rounded-2xl border-l-2 border-neon-blue">
           <h4 className="text-neon-blue font-bold text-sm flex items-center gap-2 mb-3 uppercase tracking-wide">
             <Zap size={16} /> AI Advisor
           </h4>
           <p className="text-sm text-gray-400 leading-relaxed">
             {isLimitReached 
               ? (userRole === 'ADMIN' 
                  ? "System limits reached. Proceed with caution using Admin privileges." 
                  : "Trading halted to preserve capital/profits. Please reset or return later.")
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
  );
};