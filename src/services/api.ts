import { AppState, Trade, Position, WebhookLog, RiskSettings, BrokerConfig } from '../types';
import { supabase } from '../supabaseClient';

async function authFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(options.headers || {});
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  if (session?.user?.id) {
    headers.set('x-user-id', session.user.id);
  }
  return fetch(url, { ...options, headers });
}

export async function fetchAppState(): Promise<AppState> {
  const res = await authFetch('/api/state');
  if (!res.ok) throw new Error('Failed to fetch state');
  return res.json();
}

export async function sendTradingViewWebhook(payload: Record<string, any>): Promise<any> {
  const res = await authFetch('/api/webhook/tradingview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Webhook execution failed');
  }
  return data;
}

export async function activateKillSwitch(): Promise<any> {
  const res = await authFetch('/api/engine/kill-switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function resumeEngine(): Promise<any> {
  const res = await authFetch('/api/engine/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function setTradingMode(mode: 'DEMO' | 'REAL'): Promise<any> {
  const res = await authFetch('/api/engine/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  return res.json();
}

export async function resetDemoBalance(amount?: number): Promise<any> {
  const res = await authFetch('/api/engine/reset-demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(amount !== undefined ? { amount } : {}),
  });
  return res.json();
}

export async function closePosition(positionId: string): Promise<any> {
  const res = await authFetch('/api/trades/close-position', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionId }),
  });
  return res.json();
}

export async function updateBrokerSettings(config: Partial<BrokerConfig & { apiKey?: string; apiSecret?: string; passphrase?: string; customEndpoint?: string }>): Promise<any> {
  const res = await authFetch('/api/settings/broker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function syncExchangeBalance(): Promise<{ success: boolean; realBalance: number; brokerConfig: BrokerConfig }> {
  const res = await authFetch('/api/broker/sync-balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to sync exchange balance');
  }
  return data;
}

export async function setRealCapital(amount: number): Promise<any> {
  const res = await authFetch('/api/engine/set-real-capital', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  return res.json();
}

export async function switchActiveBroker(broker: string): Promise<any> {
  const res = await authFetch('/api/broker/switch-active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ broker }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to switch active broker');
  }
  return data;
}

export async function toggleAllocatedCapital(useAllocated: boolean, allocatedAmount?: number): Promise<any> {
  const res = await authFetch('/api/broker/allocated-capital', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useAllocated, allocatedAmount }),
  });
  return res.json();
}

export async function updateRiskSettings(settings: Partial<RiskSettings>): Promise<any> {
  const res = await authFetch('/api/settings/risk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return res.json();
}

export async function rotateWebhookToken(): Promise<any> {
  const res = await authFetch('/api/webhook/rotate-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

export interface TradingViewQuoteResponse {
  success: boolean;
  symbol: string;
  ticker: string;
  price: number;
  changePercent: number;
  description: string;
  source: string;
  timestamp: string;
}

export async function fetchTradingViewQuote(symbol: string): Promise<TradingViewQuoteResponse | null> {
  try {
    const res = await authFetch(`/api/market/tradingview-quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data : null;
  } catch (err) {
    console.warn(`Failed to fetch TradingView live quote for ${symbol}:`, err);
    return null;
  }
}

export interface PlaceOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL' | 'LONG' | 'SHORT';
  orderType: 'MARKET' | 'LIMIT' | 'TRAILING_STOP';
  price: number;
  qty: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  isTrailingStop?: boolean;
  trailingStopPercent?: number;
}

export async function placeOrder(order: PlaceOrderParams): Promise<any> {
  const res = await authFetch('/api/trades/place-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to execute order');
  }
  return data;
}

export async function updatePositionTPSL(
  positionId: string,
  stopLoss?: number,
  takeProfit?: number,
  trailingStopPercent?: number,
  isTrailingStop?: boolean
): Promise<any> {
  const res = await authFetch('/api/trades/update-tpsl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positionId, stopLoss, takeProfit, trailingStopPercent, isTrailingStop }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'Failed to update SL/TP');
  }
  return data;
}

// ==========================================
// 24/7 ALGO STRATEGY ENGINE API CLIENTS
// ==========================================

export async function fetchAlgoState(): Promise<any> {
  const res = await authFetch('/api/algo/state');
  if (!res.ok) throw new Error('Failed to fetch algo engine state');
  const data = await res.json();
  return data.algoEngine;
}

export async function toggleAlgoMaster(active?: boolean): Promise<any> {
  const res = await authFetch('/api/algo/master-toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  if (!res.ok) throw new Error('Failed to toggle master 24/7 algo switch');
  return res.json();
}

export async function createStrategy(strategy: any): Promise<any> {
  const res = await authFetch('/api/algo/strategies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(strategy),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create strategy');
  return data;
}

export async function updateStrategy(id: string, updates: any): Promise<any> {
  const res = await authFetch(`/api/algo/strategies/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update strategy');
  return data;
}

export async function deleteStrategy(id: string): Promise<any> {
  const res = await authFetch(`/api/algo/strategies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete strategy');
  return data;
}

export async function toggleStrategy(id: string, enabled?: boolean): Promise<any> {
  const res = await authFetch(`/api/algo/strategies/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to toggle strategy');
  return data;
}

export async function triggerStrategyNow(id: string): Promise<any> {
  const res = await authFetch(`/api/algo/strategies/${encodeURIComponent(id)}/trigger-now`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Failed to test trigger strategy');
  return data;
}

export async function backtestStrategy(id: string): Promise<any> {
  const res = await authFetch(`/api/algo/strategies/${encodeURIComponent(id)}/backtest`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to backtest strategy');
  return data.result;
}

export async function fetchGitSyncStatus(): Promise<any> {
  const res = await authFetch('/api/system/git-status');
  if (!res.ok) throw new Error('Failed to fetch git status');
  return res.json();
}

export interface TrustedIpResponse {
  success: boolean;
  serverOutboundIp: string;
  serverIpv4?: string;
  serverIpv6?: string;
  clientDeviceIp: string;
  exchangeReportedIp?: string;
  whitelistIps: string[];
  tip: string;
}

export async function fetchTrustedIp(): Promise<TrustedIpResponse> {
  const res = await authFetch('/api/network/trusted-ip');
  if (!res.ok) throw new Error('Failed to fetch trusted IP');
  return res.json();
}



