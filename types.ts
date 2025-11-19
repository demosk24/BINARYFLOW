export interface TradeSettings {
  startCapital: number;
  dailyRiskPercent: number;
  winRatePercent: number; // Expected/Historical
  profitPayoutPercent: number; // Broker payout (e.g., 85%)
  useBoostMode: boolean;
  useSafetyMode: boolean;
}

export interface TradeResult {
  id: string;
  amount: number;
  outcome: 'WIN' | 'LOSS';
  profit: number; // Positive or negative
  type: 'BASE' | 'MARTINGALE' | 'BOOST';
  timestamp: number;
  cycleId: number;
  balanceAfter: number;
}

export interface CycleStats {
  id: number;
  trades: TradeResult[];
  netProfit: number;
  status: 'ACTIVE' | 'COMPLETED' | 'COOLDOWN';
}

export interface AppState {
  settings: TradeSettings;
  currentCapital: number;
  currentStreak: number; // Positive for wins, negative for losses
  history: TradeResult[];
  cycles: CycleStats[];
  currentCycleId: number;
  isRecoveryNext: boolean; // If true, next trade is Martingale
  dailyTargetHit: boolean;
  maxLossHit: boolean;
}

export type UserRole = 'ADMIN' | 'USER';