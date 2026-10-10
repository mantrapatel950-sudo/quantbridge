import { AppState, Trade, Position, WebhookLog, RiskSettings, BrokerConfig } from '../types';

export async function fetchAppState(): Promise<AppState> {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to fetch state');
    return res.json();
}

export async function sendTradingViewWebhook(payload: Record<string, any>): Promise<any> {
    const res = await fetch('/api/webhook/tradingview', {
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
    const res = await fetch('/api/engine/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
}

export async function resumeEngine(): Promise<any> {
    const res = await fetch('/api/engine/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
}

export async function setTradingMode(mode: 'DEMO' | 'REAL'): Promise<any> {
    const res = await fetch('/api/engine/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
    });
    return res.json();
}

export async function resetDemoBalance(): Promise<any> {
    const res = await fetch('/api/engine/reset-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
}

export async function closePosition(positionId: string): Promise<any> {
    const res = await fetch('/api/trades/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
    });
    return res.json();
}

export async function updateBrokerSettings(config: Partial<BrokerConfig & { apiKey?: string; apiSecret?: string }>): Promise<any> {
    const res = await fetch('/api/settings/broker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    return res.json();
}

export async function updateRiskSettings(settings: Partial<RiskSettings>): Promise<any> {
    const res = await fetch('/api/settings/risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    return res.json();
}

export async function rotateWebhookToken(): Promise<any> {
    const res = await fetch('/api/webhook/rotate-token', {
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
        const res = await fetch(`/api/market/tradingview-quote?symbol=${encodeURIComponent(symbol)}`);
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
    const res = await fetch('/api/trades/place-order', {
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
    const res = await fetch('/api/trades/update-tpsl', {
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
    const res = await fetch('/api/algo/state');
    if (!res.ok) throw new Error('Failed to fetch algo engine state');
    const data = await res.json();
    return data.algoEngine;
}

export async function toggleAlgoMaster(active?: boolean): Promise<any> {
    const res = await fetch('/api/algo/master-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
    });
    if (!res.ok) throw new Error('Failed to toggle master 24/7 algo switch');
    return res.json();
}

export async function createStrategy(strategy: any): Promise<any> {
    const res = await fetch('/api/algo/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(strategy),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create strategy');
    return data;
}

export async function updateStrategy(id: string, updates: any): Promise<any> {
    const res = await fetch(`/api/algo/strategies/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update strategy');
    return data;
}

export async function deleteStrategy(id: string): Promise<any> {
    const res = await fetch(`/api/algo/strategies/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete strategy');
    return data;
}

export async function toggleStrategy(id: string, enabled?: boolean): Promise<any> {
    const res = await fetch(`/api/algo/strategies/${encodeURIComponent(id)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle strategy');
    return data;
}

export async function triggerStrategyNow(id: string): Promise<any> {
    const res = await fetch(`/api/algo/strategies/${encodeURIComponent(id)}/trigger-now`, {
        method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || 'Failed to test trigger strategy');
    return data;
}

export async function backtestStrategy(id: string): Promise<any> {
    const res = await fetch(`/api/algo/strategies/${encodeURIComponent(id)}/backtest`, {
        method: 'POST',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to backtest strategy');
    return data.result;
}

