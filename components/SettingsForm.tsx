import React, { useState } from 'react';
import { TradeSettings } from '../types';
import { ArrowRight, Settings } from 'lucide-react';

interface Props {
  onStart: (settings: TradeSettings) => void;
}

export const SettingsForm: React.FC<Props> = ({ onStart }) => {
  const [config, setConfig] = useState<TradeSettings>({
    startCapital: 100,
    dailyRiskPercent: 10,
    winRatePercent: 60,
    profitPayoutPercent: 85,
    useBoostMode: true,
    useSafetyMode: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(config);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="glass-panel p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden animate-glow-purple">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue via-neon-purple to-neon-red"></div>
        
        <div className="flex items-center gap-3 mb-8">
            <div className="bg-gray-800 p-3 rounded-lg shadow-[0_0_15px_rgba(188,19,254,0.2)]">
                <Settings className="text-neon-blue w-6 h-6" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white">System Configuration</h1>
                <p className="text-gray-400 text-sm">Setup your money management parameters</p>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Starting Capital ($)</label>
              <input 
                type="number" 
                min="10" 
                value={config.startCapital}
                onChange={e => setConfig({...config, startCapital: Number(e.target.value)})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none transition-all input-glow focus:bg-gray-800"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Daily Risk Limit (%)</label>
              <input 
                type="number" 
                min="1" max="50"
                value={config.dailyRiskPercent}
                onChange={e => setConfig({...config, dailyRiskPercent: Number(e.target.value)})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none transition-all input-glow focus:border-neon-red focus:shadow-[0_0_15px_rgba(255,51,102,0.3)] focus:bg-gray-800"
              />
              <p className="text-xs text-gray-600">Recommended: 5% - 15%</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400">Target Win Rate (%)</label>
              <input 
                type="number" 
                min="10" max="100"
                value={config.winRatePercent}
                onChange={e => setConfig({...config, winRatePercent: Number(e.target.value)})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none transition-all input-glow focus:border-neon-purple focus:shadow-[0_0_15px_rgba(188,19,254,0.3)] focus:bg-gray-800"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Broker Payout (%)</label>
              <input 
                type="number" 
                min="50" max="99"
                value={config.profitPayoutPercent}
                onChange={e => setConfig({...config, profitPayoutPercent: Number(e.target.value)})}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white outline-none transition-all input-glow focus:border-neon-green focus:shadow-[0_0_15px_rgba(0,255,157,0.3)] focus:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
             <div 
               className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between hover:shadow-[0_0_15px_rgba(188,19,254,0.2)] ${config.useBoostMode ? 'bg-purple-900/20 border-neon-purple shadow-[0_0_10px_rgba(188,19,254,0.1)]' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}
               onClick={() => setConfig({...config, useBoostMode: !config.useBoostMode})}
             >
                <div>
                    <h4 className="text-white font-bold text-sm">Profit Boost Mode</h4>
                    <p className="text-xs text-gray-500">Increase stake after win streaks</p>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${config.useBoostMode ? 'border-neon-purple bg-neon-purple' : 'border-gray-500'}`}>
                    {config.useBoostMode && <span className="text-black text-xs">✓</span>}
                </div>
             </div>

             <div 
               className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center justify-between hover:shadow-[0_0_15px_rgba(0,255,157,0.2)] ${config.useSafetyMode ? 'bg-green-900/20 border-neon-green shadow-[0_0_10px_rgba(0,255,157,0.1)]' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}
               onClick={() => setConfig({...config, useSafetyMode: !config.useSafetyMode})}
             >
                <div>
                    <h4 className="text-white font-bold text-sm">Safety Protection</h4>
                    <p className="text-xs text-gray-500">Halt Martingale if loss &gt; 90%</p>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${config.useSafetyMode ? 'border-neon-green bg-neon-green' : 'border-gray-500'}`}>
                    {config.useSafetyMode && <span className="text-black text-xs">✓</span>}
                </div>
             </div>
          </div>

          <button 
            type="submit" 
            className="btn-shine w-full py-4 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold rounded-lg text-lg hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)] mt-6 flex items-center justify-center gap-2"
          >
            Generate Trading Plan <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};