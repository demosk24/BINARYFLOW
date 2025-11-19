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

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  deactivatedUntil: number | null; // Timestamp
  lastActive: number;
  tradingState?: AppState; // Sync trading state to DB
  createdAt?: number;
}

export interface Notification {
  id: string;
  userId: string;
  userEmail: string;
  type: 'TARGET_HIT' | 'LOSS_LIMIT' | 'SYSTEM';
  message: string;
  timestamp: number;
  read: boolean;
}

export interface Signal {
  id: string;
  pair: string; // e.g. EUR/USD
  direction: 'CALL' | 'PUT';
  startTime: number; // Timestamp when it starts
  expiresInMinutes: number; // How long the signal is valid for
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED';
}