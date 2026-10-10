import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';

export interface MarketTickerItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  high24h?: number;
  low24h?: number;
  volume24h?: string;
  category: 'CRYPTO' | 'EQUITY' | 'COMMODITY';
}

const INITIAL_TICKERS: MarketTickerItem[] = [
  { symbol: 'BTC/USDT', name: 'Bitcoin', price: 68420.50, changePercent: 2.38, category: 'CRYPTO', volume24h: '$38.2B' },
  { symbol: 'ETH/USDT', name: 'Ethereum', price: 2482.10, changePercent: 1.84, category: 'CRYPTO', volume24h: '$16.4B' },
  { symbol: 'SOL/USDT', name: 'Solana', price: 154.75, changePercent: 5.12, category: 'CRYPTO', volume24h: '$5.8B' },
  { symbol: 'BNB/USDT', name: 'BNB Chain', price: 592.40, changePercent: 0.94, category: 'CRYPTO', volume24h: '$1.2B' },
  { symbol: 'XAU/USD', name: 'Gold Spot', price: 2654.80, changePercent: 0.42, category: 'COMMODITY', volume24h: '$95.0B' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 138.25, changePercent: 3.14, category: 'EQUITY', volume24h: '$28.1B' },
  { symbol: 'TSLA', name: 'Tesla Motors', price: 218.40, changePercent: -1.25, category: 'EQUITY', volume24h: '$14.2B' },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: 582.60, changePercent: 0.58, category: 'EQUITY', volume24h: '$42.5B' },
];

interface Props {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
}

export const MarketTickerTape: React.FC<Props> = ({ selectedSymbol, onSelectSymbol }) => {
  const [tickers, setTickers] = useState<MarketTickerItem[]>(INITIAL_TICKERS);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Subtle real-time micro-fluctuations to emulate high-frequency live market feed
  useEffect(() => {
    const interval = setInterval(() => {
      setTickers((prev) =>
        prev.map((item) => {
          // Subtle random micro tick between -0.05% and +0.05%
          const deltaFactor = 1 + (Math.random() * 0.001 - 0.0005);
          const newPrice = +(item.price * deltaFactor).toFixed(item.price < 10 ? 4 : 2);
          const deltaChange = (Math.random() * 0.04 - 0.02);
          const newChange = +(item.changePercent + deltaChange).toFixed(2);
          return {
            ...item,
            price: newPrice,
            changePercent: newChange,
          };
        })
      );
      setLastUpdated(new Date().toLocaleTimeString());
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-950/95 border-b border-slate-800/80 px-4 py-1.5 flex items-center justify-between text-xs overflow-x-auto custom-scrollbar select-none gap-4">
      {/* Feed Status Pill */}
      <div className="flex items-center gap-2 shrink-0 border-r border-slate-800/80 pr-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 text-emerald-400" />
          <span>TAPE FEED</span>
        </span>
      </div>

      {/* Ticker Stream */}
      <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
        {tickers.map((ticker) => {
          const isSelected = selectedSymbol === ticker.symbol;
          const isPositive = ticker.changePercent >= 0;

          return (
            <button
              key={ticker.symbol}
              type="button"
              onClick={() => onSelectSymbol(ticker.symbol)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer whitespace-nowrap border ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
              title={`Switch active chart to ${ticker.symbol} (${ticker.name})`}
            >
              <span className={`font-bold ${isSelected ? 'text-emerald-300' : 'text-slate-200'}`}>
                {ticker.symbol}
              </span>
              <span className="font-semibold text-slate-100 tabular-nums">
                ${ticker.price.toLocaleString(undefined, {
                  minimumFractionDigits: ticker.price < 10 ? 4 : 2,
                  maximumFractionDigits: ticker.price < 10 ? 4 : 2,
                })}
              </span>
              <span
                className={`flex items-center text-[10px] font-bold tabular-nums px-1 rounded ${
                  isPositive
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                {isPositive ? '+' : ''}
                {ticker.changePercent}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Latency & Timestamp */}
      <div className="hidden 2xl:flex items-center gap-2 text-[10px] font-mono text-slate-500 shrink-0 border-l border-slate-800/80 pl-3">
        <Activity className="w-3 h-3 text-slate-500" />
        <span>Sub-20ms Engine</span>
      </div>
    </div>
  );
};
