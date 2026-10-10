export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  pnlPercent: number;
  strategy: string;
  status: 'WIN' | 'LOSS';
  mode: 'DEMO' | 'REAL';
  mfe?: number; // Max Favorable Excursion
  mae?: number; // Max Adverse Excursion
  slippage?: number;
  commission?: number;
  durationMinutes?: number;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

export interface MarketTapeItem {
  id: string;
  time: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
}

export interface BacktestResult {
  strategyName: string;
  symbol: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netPnl: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  trades: Array<{
    time: string;
    type: 'BUY' | 'SELL';
    price: number;
    pnl?: number;
  }>;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  qty: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  strategy: string;
  openedAt: string;
  stopLoss?: number;
  takeProfit?: number;
  mode: 'DEMO' | 'REAL';
  leverage?: number;
  liquidationPrice?: number;
  margin?: number;
  isTrailingStop?: boolean;
  trailingStopPercent?: number;
  highestPrice?: number;
  lowestPrice?: number;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  ip: string;
  status: 'SUCCESS' | 'REJECTED' | 'HALTED';
  payload: any;
  message: string;
  latencyMs: number;
}

export interface RiskSettings {
  maxDailyLossPercent: number;
  maxOpenPositions: number;
  riskPerTradePercent: number;
  consecutiveLossHalt: number;
  slippageTolerancePercent: number;
}

export interface ExchangeAssetBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  usdValue: number;
}

export interface ExchangeAccountSummary {
  broker: string;
  apiKeyMasked: string;
  isSandbox: boolean;
  accountType?: 'SPOT' | 'FUTURES' | 'UNIFIED' | 'MARGIN';
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'CONNECTING' | string;
  lastPingMs: number;
  lastSyncedAt?: string;
  walletBalance: number;
  assetBreakdown?: ExchangeAssetBalance[];
  errorMessage?: string;
}

export interface BrokerConfig {
  broker: string;
  apiKeyMasked: string;
  apiSecretMasked: string;
  passphraseMasked?: string;
  accountType?: 'SPOT' | 'FUTURES' | 'UNIFIED' | 'MARGIN';
  isSandbox: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'CONNECTING' | string;
  lastPingMs: number;
  encryptionStandard: string;
  lastSyncedAt?: string;
  errorMessage?: string;
  walletBalance?: number;
  useAllocatedCapital?: boolean;
  assetBreakdown?: ExchangeAssetBalance[];
  customEndpoint?: string;
  connectedAccounts?: ExchangeAccountSummary[];
}

export interface PerformanceMetrics {
  totalTrades: number;
  winTradesCount: number;
  lossTradesCount: number;
  winRate: number;
  lossRate: number;
  avgWin: number;
  avgLoss: number;
  riskReward: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  netPnl: number;
  openUnrealized: number;
  sharpeRatio?: number;
  dailyLossUsedPct?: number;
  marginUsedPct?: number;
  valueAtRisk95?: number;
}

export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  direction: 'LONG_ONLY' | 'SHORT_ONLY' | 'BOTH';
  type: 'EMA_CROSS' | 'RSI_REVERSION' | 'BOLLINGER_BREAKOUT' | 'MACD_MOMENTUM' | 'MULTI_CONDITION' | 'CUSTOM' | 'PINE_SCRIPT';
  enabled: boolean;
  status: 'RUNNING' | 'PAUSED' | 'COOLDOWN' | 'TRIGGERED';
  parameters: {
    emaFastPeriod?: number; // e.g. 9
    emaSlowPeriod?: number; // e.g. 21
    trendEmaPeriod?: number; // e.g. 200
    rsiPeriod?: number; // e.g. 14
    rsiOversold?: number; // e.g. 30
    rsiOverbought?: number; // e.g. 70
    bbPeriod?: number; // e.g. 20
    bbStdDev?: number; // e.g. 2.0
    macdFast?: number; // 12
    macdSlow?: number; // 26
    macdSignal?: number; // 9
    volumeConfirmation?: boolean; // volume > 1.2x avg
    pineScriptCode?: string; // For custom Pine Script execution
  };
  risk: {
    allocationUsd?: number;
    allocationPercent?: number; // e.g. 5%
    leverage: number; // 1x to 100x
    stopLossPercent: number; // e.g. 1.5%
    takeProfitPercent: number; // e.g. 3.5%
    isTrailingStop: boolean;
    trailingStopPercent?: number; // e.g. 1.0%
    cooldownMinutes: number; // e.g. 10
  };
  stats: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    lastTriggeredAt?: string;
    lastSignalMessage?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AlgoSignalLog {
  id: string;
  timestamp: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'SIGNAL_SKIPPED' | 'CHECK_NEUTRAL';
  price: number;
  reason: string;
  executed: boolean;
}

export interface AlgoEngineState {
  is247Active: boolean;
  activeBotCount: number;
  totalAlgoTrades: number;
  totalAlgoPnl: number;
  winRate: number;
  lastTickAt: string;
  strategies: StrategyConfig[];
  recentSignals: AlgoSignalLog[];
}

export interface AppState {
  isKillSwitchActive: boolean;
  tradingMode: 'DEMO' | 'REAL';
  webhookSecret: string;
  virtualBalance: number;
  realBalance: number;
  riskSettings: RiskSettings;
  brokerConfig: BrokerConfig;
  metrics: PerformanceMetrics;
  openPositions: Position[];
  closedTrades: Trade[];
  webhookLogs: WebhookLog[];
  algoEngine?: AlgoEngineState;
}


