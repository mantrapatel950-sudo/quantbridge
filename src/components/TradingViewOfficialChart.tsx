import React, { useEffect, useRef } from 'react';
import { Position } from '../types';
import { FloatingOrderPlacer } from './FloatingOrderPlacer';

interface Props {
  selectedSymbol: string;
  onSymbolChange: (sym: string) => void;
  openPositions?: Position[];
  currentPrice?: number;
  availableFunds?: number;
  tradingMode?: 'DEMO' | 'REAL';
  onQuickTrade?: (action: 'BUY' | 'SELL' | 'CLOSE', symbol: string, price: number) => void;
  onExecuteOrder?: (order: {
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
  }) => Promise<void>;
  onClosePosition?: (posId: string) => Promise<void>;
  onUpdateTPSL?: (
    positionId: string,
    stopLoss?: number,
    takeProfit?: number,
    trailingStopPercent?: number,
    isTrailingStop?: boolean
  ) => Promise<void>;
}

// Maps platform symbol to real TradingView symbol
export function mapToTradingViewSymbol(sym: string): string {
  const s = sym.toUpperCase();
  if (s.includes('BTC')) return 'BINANCE:BTCUSDT';
  if (s.includes('ETH')) return 'BINANCE:ETHUSDT';
  if (s.includes('SOL')) return 'BINANCE:SOLUSDT';
  if (s.includes('BNB')) return 'BINANCE:BNBUSDT';
  if (s.includes('XRP')) return 'BINANCE:XRPUSDT';
  if (s.includes('DOGE')) return 'BINANCE:DOGEUSDT';
  if (s.includes('ADA')) return 'BINANCE:ADAUSDT';
  if (s.includes('AVAX')) return 'BINANCE:AVAXUSDT';
  if (s.includes('LINK')) return 'BINANCE:LINKUSDT';
  if (s.includes('DOT')) return 'BINANCE:DOTUSDT';
  if (s.includes('XAU') || s.includes('GOLD')) return 'OANDA:XAUUSD';
  if (s.includes('XAG') || s.includes('XUG') || s.includes('SILVER')) return 'OANDA:XAGUSD';
  return 'BINANCE:BTCUSDT';
}

export const TradingViewOfficialChart: React.FC<Props> = ({
  selectedSymbol,
  onSymbolChange,
  openPositions = [],
  currentPrice = 0,
  availableFunds = 100000,
  tradingMode = 'DEMO',
  onExecuteOrder,
  onClosePosition,
  onUpdateTPSL,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tvSymbol = mapToTradingViewSymbol(selectedSymbol);
  const activePosition = openPositions.find((p) => p.symbol === selectedSymbol);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: '#090d16',
      gridColor: 'rgba(30, 41, 59, 0.4)',
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      studies: [
        'STD;EMA',
        'STD;RSI',
      ],
      support_host: 'https://www.tradingview.com',
    });

    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'tradingview-widget-container__widget';
    widgetContainer.style.height = '100%';
    widgetContainer.style.width = '100%';

    containerRef.current.appendChild(widgetContainer);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol]);

  return (
    <div className="flex flex-col h-full min-h-[580px] bg-slate-900/60 border border-slate-800 rounded-lg overflow-hidden select-none relative">
      {/* Top Bar for Instrument Selection */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Instrument</span>
            <select
              value={selectedSymbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
            >
              <optgroup label="Crypto Assets (Binance Live)">
                <option value="BTC/USDT">BTC/USDT · Bitcoin (Binance)</option>
                <option value="ETH/USDT">ETH/USDT · Ethereum (Binance)</option>
                <option value="SOL/USDT">SOL/USDT · Solana (Binance)</option>
                <option value="BNB/USDT">BNB/USDT · Binance Coin (Binance)</option>
                <option value="XRP/USDT">XRP/USDT · Ripple (Binance)</option>
                <option value="DOGE/USDT">DOGE/USDT · Dogecoin (Binance)</option>
                <option value="ADA/USDT">ADA/USDT · Cardano (Binance)</option>
                <option value="AVAX/USDT">AVAX/USDT · Avalanche (Binance)</option>
                <option value="LINK/USDT">LINK/USDT · Chainlink (Binance)</option>
              </optgroup>
              <optgroup label="Precious Metals (OANDA / TVC Spot)">
                <option value="XAU/USD">XAU/USD · Gold Spot (OANDA / LBMA)</option>
                <option value="XAG/USD">XAG/USD (XUG/USD) · Silver Spot (OANDA / Comex)</option>
              </optgroup>
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs font-mono text-slate-400">
            <span>TradingView Feed: <strong className="text-emerald-400">{tvSymbol}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">Live TradingView Official Chart</span>
        </div>
      </div>

      {/* TradingView Real Chart Embed Container */}
      <div className="relative flex-1 min-h-[500px] w-full bg-[#090d16]">
        <div ref={containerRef} className="tradingview-widget-container h-full w-full" style={{ height: '100%', minHeight: '500px' }} />

        {/* Floating Active Position HUD on Chart */}
        {activePosition && (
          <div className="absolute bottom-10 left-4 z-20 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3.5 py-2.5 bg-slate-950/95 border border-slate-700/80 rounded-lg shadow-2xl backdrop-blur-md text-xs font-mono">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded font-bold text-[11px] flex items-center gap-1 ${
                  activePosition.side === 'LONG'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activePosition.side === 'LONG' ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
                {activePosition.side} {activePosition.qty} {activePosition.symbol}
              </span>
              <span className="text-slate-400">
                Entry: ${activePosition.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`font-bold tabular-nums ${
                  activePosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                uPnL: {activePosition.unrealizedPnl >= 0 ? '+' : ''}${activePosition.unrealizedPnl.toFixed(2)} ({activePosition.unrealizedPnlPercent >= 0 ? '+' : ''}{activePosition.unrealizedPnlPercent}%)
              </span>

              {activePosition.leverage && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded font-semibold">
                  {activePosition.leverage}x Lev
                </span>
              )}

              {activePosition.liquidationPrice && activePosition.liquidationPrice > 0 && (
                <span className="text-[10px] text-amber-400 hidden md:inline">
                  Liq: ${activePosition.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}

              {onClosePosition && (
                <button
                  type="button"
                  onClick={() => onClosePosition(activePosition.id)}
                  className="px-2 py-0.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded text-[11px] font-semibold transition-all cursor-pointer ml-1"
                >
                  Close Market
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Order Placer Widget */}
        {onExecuteOrder && (
          <FloatingOrderPlacer
            symbol={selectedSymbol}
            currentPrice={currentPrice}
            availableFunds={availableFunds}
            tradingMode={tradingMode}
            activePosition={activePosition}
            onExecuteOrder={onExecuteOrder}
            onClosePosition={onClosePosition}
            onUpdateTPSL={onUpdateTPSL}
          />
        )}
      </div>
    </div>
  );
};
