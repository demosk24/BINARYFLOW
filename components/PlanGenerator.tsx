import React, { useMemo } from 'react';
import { TradeSettings } from '../types';
import { calculateBaseAmount, CONSTANTS } from '../utils/logic';
import { ArrowRight, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  settings: TradeSettings;
}

export const PlanGenerator: React.FC<Props> = ({ settings }) => {
  const baseAmount = calculateBaseAmount(settings.startCapital, settings.dailyRiskPercent);
  const martingaleAmount = baseAmount * CONSTANTS.MARTINGALE_MULTIPLIER;
  const dailyRiskLimit = settings.startCapital * (settings.dailyRiskPercent / 100);
  const dailyTarget = settings.startCapital * CONSTANTS.DAILY_PROFIT_TARGET_PERCENT;

  // Simulation of 20 trades based on win rate
  const simulation = useMemo(() => {
    const totalTrades = 20;
    const winCount = Math.round(totalTrades * (settings.winRatePercent / 100));
    // Distribute wins/losses somewhat evenly for a realistic simulation
    // This is a simple deterministic shuffle for demo purposes
    const outcomes = Array(totalTrades).fill('LOSS');
    for(let i = 0; i < winCount; i++) outcomes[i] = 'WIN';
    // Shuffle simply
    const shuffled = outcomes.sort(() => 0.5 - Math.random());
    
    let balance = settings.startCapital;
    let nextTrade = baseAmount;
    let isRecovery = false;
    let streak = 0;
    
    return shuffled.map((outcome, idx) => {
      const amount = nextTrade;
      let profit = 0;
      let type = isRecovery ? 'MARTINGALE' : 'BASE';

      if (outcome === 'WIN') {
        profit = amount * (settings.profitPayoutPercent / 100);
        balance += profit;
        isRecovery = false;
        streak++;
        
        // Calculate next
        if (settings.useBoostMode && streak >= 2) {
            nextTrade = baseAmount * 1.2;
            type = 'BOOST';
        } else {
            nextTrade = baseAmount;
        }
      } else {
        profit = -amount;
        balance += profit;
        streak = 0;
        
        if (isRecovery) {
          // Double Loss
          isRecovery = false;
          nextTrade = baseAmount;
        } else {
          isRecovery = true;
          nextTrade = martingaleAmount;
        }
      }

      return { step: idx + 1, amount, outcome, profit, balance, type };
    });
  }, [settings, baseAmount, martingaleAmount]);

  const totalProjProfit = simulation[simulation.length - 1].balance - settings.startCapital;

  return (
    <div className="glass-panel p-6 rounded-xl border-t border-neon-blue/30">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
        <TrendingUp className="text-neon-blue" /> AI Daily Projection
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Base Investment</div>
          <div className="text-2xl font-mono text-neon-blue">${baseAmount.toFixed(2)}</div>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Rescue Amount (1-Step)</div>
          <div className="text-2xl font-mono text-orange-400">${martingaleAmount.toFixed(2)}</div>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Max Daily Risk</div>
          <div className="text-2xl font-mono text-neon-red">${dailyRiskLimit.toFixed(2)}</div>
        </div>
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
          <div className="text-gray-400 text-sm">Projected Daily Profit</div>
          <div className={`text-2xl font-mono ${totalProjProfit > 0 ? 'text-neon-green' : 'text-red-500'}`}>
            ${totalProjProfit.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Target: ${dailyTarget.toFixed(2)}</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-200 uppercase bg-gray-800/50">
            <tr>
              <th className="px-4 py-3 rounded-l-lg">#</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Stake</th>
              <th className="px-4 py-3">Simulated Outcome</th>
              <th className="px-4 py-3">P/L</th>
              <th className="px-4 py-3 rounded-r-lg">Balance</th>
            </tr>
          </thead>
          <tbody>
            {simulation.slice(0, 10).map((row) => (
              <tr key={row.step} className="border-b border-gray-800 hover:bg-gray-800/30">
                <td className="px-4 py-3 font-mono">{row.step}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    row.type === 'MARTINGALE' ? 'bg-orange-900/30 text-orange-400' :
                    row.type === 'BOOST' ? 'bg-purple-900/30 text-purple-400' :
                    'bg-blue-900/30 text-blue-400'
                  }`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-white">${row.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                   <span className={row.outcome === 'WIN' ? 'text-neon-green' : 'text-neon-red'}>
                     {row.outcome}
                   </span>
                </td>
                <td className="px-4 py-3 font-mono">
                  {row.profit > 0 ? '+' : ''}{row.profit.toFixed(2)}
                </td>
                <td className="px-4 py-3 font-mono text-white">${row.balance.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg flex items-start gap-3">
        <AlertTriangle className="text-yellow-500 shrink-0" size={20} />
        <p className="text-xs text-yellow-200">
          <strong>Simulation Note:</strong> This projection uses a random distribution based on your {settings.winRatePercent}% win rate. 
          Real market conditions vary. Stick to the plan and stop if you hit your Daily Risk limit (${dailyRiskLimit.toFixed(2)}).
        </p>
      </div>
    </div>
  );
};