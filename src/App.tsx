import React, { useState, useEffect } from 'react';
import {
  fetchAppState,
  sendTradingViewWebhook,
  activateKillSwitch,
  resumeEngine,
  setTradingMode as apiSetTradingMode,
  resetDemoBalance,
  closePosition as apiClosePosition,
  updateBrokerSettings,
  updateRiskSettings,
  rotateWebhookToken,
  fetchTradingViewQuote,
  placeOrder as apiPlaceOrder,
  updatePositionTPSL as apiUpdatePositionTPSL,
  syncExchangeBalance,
  setRealCapital,
  switchActiveBroker,
  toggleAllocatedCapital,
  TradingViewQuoteResponse,
} from './services/api';


import { AppState, Position, Trade } from './types';
import { TopNav } from './components/TopNav';
import { MetricsRibbon } from './components/MetricsRibbon';
import { TradingViewChart } from './components/TradingViewChart';
import { TradingViewOfficialChart } from './components/TradingViewOfficialChart';
import { EquityCurveChart } from './components/EquityCurveChart';
import { OpenPositionsTable } from './components/OpenPositionsTable';
import { TradeLedgerTable } from './components/TradeLedgerTable';
import { OrderBookDepth } from './components/OrderBookDepth';
import { TradeDetailModal } from './components/TradeDetailModal';
import { WebhookBridgeView } from './components/WebhookBridgeView';
import { BrokerSecurityView } from './components/BrokerSecurityView';
import { LegalRiskView } from './components/LegalRiskView';
import { KillSwitchModal } from './components/KillSwitchModal';
import { AlgoStrategyView } from './components/AlgoStrategyView';
import { AuthView } from './components/AuthView';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { User } from '@supabase/supabase-js';

import { playOrderFilledSound, playKillSwitchSound, playMarginWarningSound, playTradeWinSound } from './utils/audioAlerts';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendBrowserNotification,
  calculateMarginUsage,
  NotificationPermissionStatus,
} from './utils/notifications';
import { ShieldAlert, AlertCircle, RefreshCw, Zap, Sparkles, AlertTriangle, Cpu, Loader2 } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'strategies' | 'webhook' | 'ledger' | 'broker' | 'legal'>('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDT');
  const [chartViewMode, setChartViewMode] = useState<'interactive' | 'official'>('interactive');
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [tvQuote, setTvQuote] = useState<TradingViewQuoteResponse | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [isKillModalOpen, setIsKillModalOpen] = useState(false);
  const [selectedTradeForDetail, setSelectedTradeForDetail] = useState<Trade | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionStatus>('default');
  const [marginUsagePercent, setMarginUsagePercent] = useState<number>(0);
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // References for detecting real-time state transitions
  const previousPositionsRef = React.useRef<Position[]>([]);
  const previousTradesRef = React.useRef<Trade[]>([]);
  const marginAlertTriggeredRef = React.useRef<boolean>(false);
  const initialLoadDoneRef = React.useRef<boolean>(false);

  // Check auth state on mount
  useEffect(() => {
    // DEV BYPASS: If no real Supabase keys are provided, mock authentication
    if (!isSupabaseConfigured) {
      setUser({ id: 'local-dev-user', email: 'dev@quantbridge.com' } as User);
      setIsAuthLoading(false);
      return;
    }


    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
  }, []);

  const handleRequestNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      sendBrowserNotification({
        title: 'QuantBridge Notifications Enabled',
        body: 'Real-time alerts active: Triggers when trade is opened, closed, or margin usage > 80%.',
        type: 'TRADE_OPEN',
      });
      showNotification('Browser desktop notifications enabled successfully!');
    } else if (perm === 'denied') {
      showNotification('Notifications were blocked. You can enable them in site settings.', 'warning');
    }
  };

  const handleTestNotification = () => {
    sendBrowserNotification({
      title: 'QuantBridge Test Notification',
      body: 'Browser alert channel operational: Monitoring trade executions & margin limits.',
      type: 'TRADE_OPEN',
    });
    playOrderFilledSound();
    showNotification('Test notification dispatched!');
  };

  // Dynamically fetch live prices from the TradingView official feed (especially for precious metals XAU/USD & XAG/USD)
  useEffect(() => {
    let isMounted = true;

    async function updatePriceFromTradingView() {
      setIsPriceLoading(true);
      try {
        const quote = await fetchTradingViewQuote(selectedSymbol);
        if (isMounted && quote && quote.price > 0) {
          setSelectedPrice(quote.price);
          setTvQuote(quote);
        }
      } catch (err) {
        console.warn(`Dynamic price lookup error for ${selectedSymbol}:`, err);
      } finally {
        if (isMounted) setIsPriceLoading(false);
      }
    }

    updatePriceFromTradingView();
    // Poll every 5 seconds for live price updates from the TradingView official feed
    const priceInterval = setInterval(updatePriceFromTradingView, 5000);

    return () => {
      isMounted = false;
      clearInterval(priceInterval);
    };
  }, [selectedSymbol]);

  // Load app state and trigger real-time browser alerts
  const loadState = async () => {
    try {
      const data = await fetchAppState();
      setAppState(data);

      const totalBal = data.tradingMode === 'DEMO' ? data.virtualBalance : data.realBalance;
      const equity = totalBal + data.metrics.openUnrealized;
      const marginPct = calculateMarginUsage(data.openPositions, equity);
      setMarginUsagePercent(marginPct);

      // Only check state changes after initial load is established
      if (initialLoadDoneRef.current) {
        // 1. Check for newly opened positions
        const prevPosIds = new Set(previousPositionsRef.current.map((p) => p.id));
        const newPositions = data.openPositions.filter((p) => !prevPosIds.has(p.id));
        for (const newPos of newPositions) {
          sendBrowserNotification({
            title: `QuantBridge: Trade Opened (${newPos.side})`,
            body: `Filled ${newPos.side} ${newPos.qty} ${newPos.symbol} @ $${newPos.entryPrice.toLocaleString()} via ${newPos.mode}`,
            type: 'TRADE_OPEN',
          });
          playOrderFilledSound();
          showNotification(`Trade Opened: ${newPos.side} ${newPos.qty} ${newPos.symbol} @ $${newPos.entryPrice.toLocaleString()}`);
        }

        // 2. Check for newly closed trades
        const prevTradeIds = new Set(previousTradesRef.current.map((t) => t.id));
        const newClosedTrades = data.closedTrades.filter((t) => !prevTradeIds.has(t.id));
        for (const closed of newClosedTrades) {
          sendBrowserNotification({
            title: `QuantBridge: Trade Closed (${closed.status})`,
            body: `${closed.symbol} closed @ $${closed.exitPrice.toLocaleString()} | Realized PnL: ${closed.pnl >= 0 ? '+' : ''}$${closed.pnl.toFixed(2)} (${closed.pnlPercent}%)`,
            type: 'TRADE_CLOSE',
          });
          playTradeWinSound();
          showNotification(
            `Trade Closed: ${closed.symbol} | Realized PnL: ${closed.pnl >= 0 ? '+' : ''}$${closed.pnl.toFixed(2)} (${closed.pnlPercent}%)`
          );
        }

        // 3. Check if margin usage exceeds 80%
        if (marginPct > 80) {
          if (!marginAlertTriggeredRef.current) {
            marginAlertTriggeredRef.current = true;
            sendBrowserNotification({
              title: `CRITICAL ALERT: Margin Usage Exceeds 80% (${marginPct}%)`,
              body: `High liquidation risk! Margin requirement is at ${marginPct}% of account equity ($${equity.toLocaleString()}).`,
              type: 'MARGIN_WARNING',
            });
            playMarginWarningSound();
            showNotification(`CRITICAL ALERT: Margin usage exceeded 80% (${marginPct}%)!`, 'error');
          }
        } else if (marginPct <= 75) {
          // Reset trigger when margin cools down below 75%
          marginAlertTriggeredRef.current = false;
        }
      } else {
        initialLoadDoneRef.current = true;
      }

      previousPositionsRef.current = data.openPositions;
      previousTradesRef.current = data.closedTrades;
    } catch (err: any) {
      console.error('State load error:', err);
    }
  };

  useEffect(() => {
    loadState();
    const interval = setInterval(loadState, 3000); // Polling sync
    return () => clearInterval(interval);
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Mode Toggle
  const handleModeToggle = async (newMode: 'DEMO' | 'REAL') => {
    try {
      const res = await apiSetTradingMode(newMode);
      if (newMode === 'REAL') {
        if (res && res.realBalance !== undefined) {
          showNotification(`Switched to Live Capital: $${res.realBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on ${res.brokerConfig?.broker || 'Exchange'}`);
        } else {
          showNotification('Switched to Live Real Money mode.');
        }
      } else {
        showNotification('Switched to Demo Virtual Paper mode.');
      }
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to switch mode', 'error');
    }
  };

  // Sync Real Exchange Balance
  const handleSyncBalance = async () => {
    try {
      const res = await syncExchangeBalance();
      showNotification(`Live balance synced from ${res.brokerConfig.broker}: $${res.realBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      loadState();
      return res;
    } catch (err: any) {
      showNotification(err.message || 'Failed to sync exchange balance', 'error');
      throw err;
    }
  };

  // Set Real Capital Baseline
  const handleSetRealCapital = async (amount: number) => {
    try {
      await setRealCapital(amount);
      showNotification(`Real capital baseline set to $${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update real capital', 'error');
    }
  };

  // Switch Active Connected Exchange
  const handleSwitchActiveBroker = async (broker: string) => {
    try {
      const res = await switchActiveBroker(broker);
      showNotification(`Switched active exchange to ${broker}. Live capital: $${(res.realBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      loadState();
      return res;
    } catch (err: any) {
      showNotification(err.message || 'Failed to switch exchange', 'error');
    }
  };

  // Toggle Working Capital vs Raw Wallet Balance
  const handleToggleAllocatedCapital = async (useAllocated: boolean, amount?: number) => {
    try {
      const res = await toggleAllocatedCapital(useAllocated, amount);
      if (useAllocated) {
        showNotification(`Working capital allocation active: $${res.realBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      } else {
        showNotification(`Using raw exchange wallet balance: $${res.realBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      }
      loadState();
      return res;
    } catch (err: any) {
      showNotification(err.message || 'Failed to toggle working capital', 'error');
    }
  };



  // Emergency Kill Switch
  const handleKillSwitch = async () => {
    try {
      playKillSwitchSound();
      const res = await activateKillSwitch();
      showNotification(`KILL SWITCH ENGAGED! Liquidated ${res.liquidatedCount} open positions.`, 'warning');
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to trigger kill switch', 'error');
    }
  };

  // Resume Engine
  const handleResumeEngine = async () => {
    try {
      await resumeEngine();
      showNotification('Algo execution engine resumed & armed.');
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to resume engine', 'error');
    }
  };

  // Quick trade from Chart or Order Book
  const handleQuickTrade = async (action: 'BUY' | 'SELL' | 'CLOSE', symbol: string, price: number, qty?: number) => {
    if (!appState) return;
    try {
      const defaultQty = qty || (symbol.includes('BTC') ? 0.5 : symbol.includes('ETH') ? 2 : 20);
      const payload = {
        token: appState.webhookSecret,
        signal: action,
        symbol,
        qty: defaultQty,
        price,
        strategy: 'Terminal_Manual_Signal',
      };
      const res = await sendTradingViewWebhook(payload);
      playOrderFilledSound();
      showNotification(res.message || `Executed ${action} on ${symbol}`);
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Order failed', 'error');
    }
  };

  // Place order from Floating Order Placer
  const handleExecuteOrder = async (order: {
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT' | 'TRAILING_STOP';
    price: number;
    qty: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
    isTrailingStop?: boolean;
    trailingStopPercent?: number;
  }) => {
    if (!appState) return;
    try {
      const res = await apiPlaceOrder(order);
      playOrderFilledSound();
      showNotification(res.message || `Executed ${order.orderType} ${order.side} ${order.qty} ${order.symbol}`);
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Order failed', 'error');
      throw err;
    }
  };

  // Close Position
  const handleClosePosition = async (posId: string) => {
    try {
      await apiClosePosition(posId);
      showNotification('Position closed successfully.');
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to close position', 'error');
    }
  };

  // Update Stop Loss, Take Profit, and Trailing Stop
  const handleUpdateTPSL = async (
    positionId: string,
    stopLoss?: number,
    takeProfit?: number,
    trailingStopPercent?: number,
    isTrailingStop?: boolean
  ) => {
    try {
      const res = await apiUpdatePositionTPSL(positionId, stopLoss, takeProfit, trailingStopPercent, isTrailingStop);
      showNotification(res.message || 'Brackets & Trailing Stop updated successfully.');
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to update brackets', 'error');
    }
  };

  // Rotate Webhook Token
  const handleRotateToken = async () => {
    try {
      const res = await rotateWebhookToken();
      showNotification('New Webhook Security Token generated.');
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to rotate token', 'error');
    }
  };

  // Reset Demo Balance
  const handleResetDemo = async (amount?: number) => {
    try {
      await resetDemoBalance(amount);
      if (amount !== undefined) {
        showNotification(`Virtual demo balance set to $${amount.toLocaleString()}`);
      } else {
        showNotification('Virtual demo balance reset to $100,000.00');
      }
      loadState();
    } catch (err: any) {
      showNotification(err.message || 'Failed to reset balance', 'error');
    }
  };

  const handleSignOut = async () => {
    if (!isSupabaseConfigured) {
      setUser(null);
      showNotification('Signed out of Dev Mode.');
      return;
    }

    
    try {
      await supabase.auth.signOut();
      showNotification('Signed out successfully.');
    } catch (err: any) {
      showNotification(err.message || 'Failed to sign out', 'error');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-sm">Authenticating...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView
        onGuestAccess={() => {
          setUser({ id: 'guest-trader', email: 'guest@quantbridge.io' } as User);
        }}
      />
    );
  }

  if (!appState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span className="text-sm">Connecting to QuantBridge Execution Engine...</span>
      </div>
    );
  }

  const currentBalance = appState.tradingMode === 'DEMO' ? appState.virtualBalance : appState.realBalance;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (3 Zones) with Live Ticker Tape */}
      <TopNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tradingMode={appState.tradingMode}
        onModeToggle={handleModeToggle}
        isKillSwitchActive={appState.isKillSwitchActive}
        onOpenKillSwitch={() => setIsKillModalOpen(true)}
        onResumeEngine={handleResumeEngine}
        notificationPermission={notificationPermission}
        onRequestNotifications={handleRequestNotifications}
        onTestNotification={handleTestNotification}
        activeAlgoBotsCount={appState.algoEngine?.activeBotCount}
        onSignOut={handleSignOut}
        brokerName={appState.brokerConfig?.broker}
        brokerStatus={appState.brokerConfig?.status}
        currentBalance={currentBalance}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={setSelectedSymbol}
        onOpenCapitalModal={() => setActiveTab('broker')}
      />


      {/* Emergency Halted Alert Banner */}
      {appState.isKillSwitchActive && (
        <div className="bg-rose-950/80 border-b border-rose-500/50 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>ALGO ENGINE HALTED BY KILL SWITCH: Incoming signals are blocked.</span>
          </div>
          <button
            onClick={handleResumeEngine}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold cursor-pointer transition-colors"
          >
            Arm & Resume Engine
          </button>
        </div>
      )}

      {/* Real-Time Critical Margin Alert Banner (>80%) */}
      {marginUsagePercent > 80 && (
        <div className="bg-rose-950/90 border-b border-rose-500/80 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2 font-bold animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>CRITICAL MARGIN UTILIZATION ALERT: Margin requirement is at {marginUsagePercent.toFixed(1)}% (Threshold: 80%). Liquidation risk high!</span>
          </div>
          <button
            onClick={() => setIsKillModalOpen(true)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold cursor-pointer transition-colors"
          >
            Emergency Liquidation
          </button>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg border text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
            notification.type === 'error'
              ? 'bg-rose-950 border-rose-500 text-rose-200'
              : notification.type === 'warning'
              ? 'bg-amber-950 border-amber-500 text-amber-200'
              : 'bg-emerald-950 border-emerald-500 text-emerald-200'
          }`}
        >
          <span>{notification.message}</span>
        </div>
      )}

      {/* High-Precision Performance Metrics Ribbon */}
      <MetricsRibbon
        metrics={appState.metrics}
        balance={currentBalance}
        mode={appState.tradingMode}
        marginUsagePercent={marginUsagePercent}
        onResetDemo={handleResetDemo}
        brokerName={appState.brokerConfig?.broker}
        onSyncBalance={handleSyncBalance}
        onSetRealCapital={handleSetRealCapital}
      />


      {/* Main Viewport Content */}
      <main className="flex-1 p-4 md:p-6 w-full mx-auto space-y-6">
        {/* Tab 1: Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Row: Official Real TradingView Chart (Left 70%) + Depth & Telemetry (Right 30%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* TradingView Real Chart Section (Chart Only) */}
              <div className="lg:col-span-8 flex flex-col gap-2 min-h-[580px]">
                {/* Header status bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>TradingView Terminal</span>
                    </div>

                    {/* Chart Mode Switcher: Auto-Scale Pro Engine vs Official Widget */}
                    <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] font-mono">
                      <button
                        onClick={() => setChartViewMode('interactive')}
                        className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                          chartViewMode === 'interactive'
                            ? 'bg-slate-800 text-emerald-400 font-bold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Interactive TradingView Lightweight Chart with visible candlestick Y-axis auto-scale and anti-clipping padding"
                      >
                        ⚡ Pro Engine (Auto-Scale Y)
                      </button>
                      <button
                        onClick={() => setChartViewMode('official')}
                        className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer ${
                          chartViewMode === 'official'
                            ? 'bg-slate-800 text-emerald-400 font-bold shadow-xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                        title="Official TradingView Embed Widget"
                      >
                        🌐 Official Widget
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    {tvQuote ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-slate-400">TV Feed ({tvQuote.ticker}):</span>
                        <strong className="text-slate-100 font-bold tabular-nums">
                          ${tvQuote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                        <span className={`font-semibold tabular-nums ${tvQuote.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ({tvQuote.changePercent >= 0 ? '+' : ''}{tvQuote.changePercent}%)
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 hidden sm:inline">
                        Connecting to TradingView Feed ({selectedSymbol})...
                      </span>
                    )}
                  </div>
                </div>

                {/* Render Selected TradingView Chart Mode */}
                {chartViewMode === 'interactive' ? (
                  <TradingViewChart
                    selectedSymbol={selectedSymbol}
                    onSymbolChange={setSelectedSymbol}
                    openPositions={appState.openPositions}
                    closedTrades={appState.closedTrades}
                    availableFunds={currentBalance}
                    tradingMode={appState.tradingMode}
                    onExecuteOrder={handleExecuteOrder}
                    onClosePosition={handleClosePosition}
                    onUpdateTPSL={handleUpdateTPSL}
                  />
                ) : (
                  <TradingViewOfficialChart
                    selectedSymbol={selectedSymbol}
                    onSymbolChange={setSelectedSymbol}
                    openPositions={appState.openPositions}
                    currentPrice={selectedPrice}
                    availableFunds={currentBalance}
                    tradingMode={appState.tradingMode}
                    onExecuteOrder={handleExecuteOrder}
                    onClosePosition={handleClosePosition}
                    onUpdateTPSL={handleUpdateTPSL}
                  />
                )}
              </div>

              {/* Order Book Depth & Equity Curve */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* Level 2 Order Book & Tape */}
                <OrderBookDepth
                  symbol={selectedSymbol}
                  currentPrice={selectedPrice}
                  onSelectPrice={(price) => setSelectedPrice(price)}
                />

                {/* Equity Curve & Quantitative Trade Inspector */}
                <EquityCurveChart
                  trades={appState.closedTrades}
                  startingBalance={
                    appState.tradingMode === 'DEMO'
                      ? appState.virtualBalance || 100000
                      : appState.realBalance || 25000
                  }
                  onSelectTrade={(t) => setSelectedTradeForDetail(t)}
                />
              </div>
            </div>

            {/* Bottom Row: Active Positions & Trade Ledger */}
            <div className="space-y-6">
              <OpenPositionsTable
                positions={appState.openPositions}
                onClosePosition={handleClosePosition}
              />

              <TradeLedgerTable
                trades={appState.closedTrades}
                onSelectTrade={(t) => setSelectedTradeForDetail(t)}
              />
            </div>
          </div>
        )}

        {/* Tab 1b: 24/7 Algo Lab & Strategies */}
        {activeTab === 'strategies' && (
          <AlgoStrategyView
            algoEngine={appState.algoEngine}
            onRefreshState={loadState}
            onSelectSymbol={(sym) => {
              setSelectedSymbol(sym);
              setActiveTab('dashboard');
            }}
          />
        )}

        {/* Tab 2: Webhook Bridge */}
        {activeTab === 'webhook' && (
          <WebhookBridgeView
            webhookSecret={appState.webhookSecret}
            webhookLogs={appState.webhookLogs}
            tradingMode={appState.tradingMode}
            onRotateToken={handleRotateToken}
            onSendTestWebhook={async (payload) => {
              const res = await sendTradingViewWebhook(payload);
              loadState();
              return res;
            }}
          />
        )}

        {/* Tab 3: Trade Ledger & Positions */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <OpenPositionsTable
              positions={appState.openPositions}
              onClosePosition={handleClosePosition}
            />
            <TradeLedgerTable
              trades={appState.closedTrades}
              onSelectTrade={(t) => setSelectedTradeForDetail(t)}
            />
          </div>
        )}

        {/* Tab 4: Broker & Security */}
        {activeTab === 'broker' && (
          <BrokerSecurityView
            brokerConfig={appState.brokerConfig}
            riskSettings={appState.riskSettings}
            tradingMode={appState.tradingMode}
            realBalance={appState.realBalance}
            onUpdateBroker={async (cfg) => {
              const res = await updateBrokerSettings(cfg);
              loadState();
              return res;
            }}
            onUpdateRisk={async (risk) => {
              const res = await updateRiskSettings(risk);
              loadState();
              return res;
            }}
            onToggleMode={handleModeToggle}
            onSyncBalance={handleSyncBalance}
            onSetRealCapital={handleSetRealCapital}
            onSwitchActiveBroker={handleSwitchActiveBroker}
            onToggleAllocatedCapital={handleToggleAllocatedCapital}
          />
        )}



        {/* Tab 5: Legal & Risk Disclaimers */}
        {activeTab === 'legal' && <LegalRiskView />}
      </main>

      {/* Footer (Anti-slop compliant: clean copyright and links) */}
      <footer className="mt-auto px-6 py-4 border-t border-slate-900 bg-slate-950 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>QuantBridge Terminal</span>
          <span aria-hidden="true">·</span>
          <span>TradingView Webhook Execution Engine</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <button onClick={() => setActiveTab('legal')} className="hover:text-slate-200 transition-colors cursor-pointer">
            Regulatory Disclaimers
          </button>
          <span aria-hidden="true">·</span>
          <button onClick={() => setActiveTab('broker')} className="hover:text-slate-200 transition-colors cursor-pointer">
            Security & AES-256
          </button>
          <span aria-hidden="true">·</span>
          <button onClick={() => setActiveTab('webhook')} className="hover:text-slate-200 transition-colors cursor-pointer">
            Pine Script Bridge
          </button>
        </div>
      </footer>

      {/* Emergency Kill Switch Confirmation Modal */}
      <KillSwitchModal
        isOpen={isKillModalOpen}
        onClose={() => setIsKillModalOpen(false)}
        openPositions={appState.openPositions}
        onConfirmKill={handleKillSwitch}
      />

      {/* Trade Anatomy Detail Modal */}
      <TradeDetailModal
        trade={selectedTradeForDetail}
        onClose={() => setSelectedTradeForDetail(null)}
      />
    </div>
  );
}
