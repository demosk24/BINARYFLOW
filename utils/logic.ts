import { AppState, TradeSettings } from '../types';

export const CONSTANTS = {
  MARTINGALE_MULTIPLIER: 2.3,
  CYCLE_SIZE: 5,
  DAILY_PROFIT_TARGET_PERCENT: 0.12,
  CYCLE_PROFIT_TARGET_PERCENT: 0.02,
  BOOST_TRIGGER_STREAK: 2, // After 2 wins
  BOOST_MULTIPLIER: 0.20, // +20%
  SUPER_BOOST_TRIGGER_STREAK: 3, // After 3 wins
  SUPER_BOOST_ADDITION_PERCENT: 0.30, // Base + 30%
};

// Calculate the Base Amount (BA)
export const calculateBaseAmount = (capital: number, riskPercent: number): number => {
  // BA = (Daily Capital Risk / 4)
  // Daily Capital Risk = Capital * (riskPercent / 100)
  const riskAmount = capital * (riskPercent / 100);
  const ba = riskAmount / 4;
  return Math.max(1, parseFloat(ba.toFixed(2))); // Minimum 1$
};

// Calculate Next Trade Amount based on state
export const calculateNextTradeAmount = (
  state: AppState,
  settings: TradeSettings
): { amount: number; type: 'BASE' | 'MARTINGALE' | 'BOOST'; reason: string } => {
  
  const baseAmount = calculateBaseAmount(settings.startCapital, settings.dailyRiskPercent);
  
  // 1. Safety Mode Check (If enabled, prevents martingale if capital dropped too much)
  const maxDailyLoss = settings.startCapital * (settings.dailyRiskPercent / 100);
  const totalLoss = settings.startCapital - state.currentCapital;
  
  if (settings.useSafetyMode && totalLoss >= maxDailyLoss * 0.9) {
     return { amount: baseAmount, type: 'BASE', reason: 'Safety Mode Limit Approaching' };
  }

  // 2. Recovery Logic (One-Step Martingale)
  if (state.isRecoveryNext) {
    return { 
      amount: parseFloat((baseAmount * CONSTANTS.MARTINGALE_MULTIPLIER).toFixed(2)), 
      type: 'MARTINGALE',
      reason: 'Recover Previous Loss'
    };
  }

  // 3. Boost Logic (Win Streak)
  if (settings.useBoostMode) {
    if (state.currentStreak >= CONSTANTS.SUPER_BOOST_TRIGGER_STREAK) {
      // Super Boost: Base + (Base * 0.30)
      const amount = baseAmount + (baseAmount * CONSTANTS.SUPER_BOOST_ADDITION_PERCENT);
      return { amount: parseFloat(amount.toFixed(2)), type: 'BOOST', reason: 'Super Streak Boost (3+ Wins)' };
    }
    
    if (state.currentStreak >= CONSTANTS.BOOST_TRIGGER_STREAK) {
      // Standard Boost: Base * 1.20
      const amount = baseAmount * (1 + CONSTANTS.BOOST_MULTIPLIER);
      return { amount: parseFloat(amount.toFixed(2)), type: 'BOOST', reason: 'Streak Boost (2 Wins)' };
    }
  }

  // 4. Default Base
  return { amount: baseAmount, type: 'BASE', reason: 'Standard Entry' };
};

export const calculateProfit = (amount: number, payoutPercent: number, outcome: 'WIN' | 'LOSS'): number => {
  if (outcome === 'LOSS') return -amount;
  return amount * (payoutPercent / 100);
};

export const getCycleStatus = (tradesInCycle: any[]): { profit: number, isComplete: boolean } => {
  const profit = tradesInCycle.reduce((sum, t) => sum + t.profit, 0);
  return {
    profit,
    isComplete: tradesInCycle.length >= CONSTANTS.CYCLE_SIZE
  };
};
