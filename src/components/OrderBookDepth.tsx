import React, { useState, useEffect } from 'react';
import { OrderBookEntry, MarketTapeItem } from '../types';
import { ArrowDown, ArrowUp, Activity } from 'lucide-react';

interface Props {
  symbol: string;
  currentPrice: number;
  onSelectPrice: (price: number) => void;
}

export const OrderBookDepth: React.FC<Props> = ({ symbol, currentPrice, onSelectPrice }) => {
  const [bids, setBids] = useState<OrderBookEntry[]>([]);
  const [asks, setAsks] = useState<OrderBookEntry[]>([]);
  const [tape, setTape] = useState<MarketTapeItem[]>([]);
  const [activeTab, setActiveTab] = useState<'book' | 'tape'>('book');

  // Generate realistic order book around currentPrice
  useEffect(() => {
    if (!currentPrice || currentPrice <= 0) return;

    const tickSize = currentPrice > 1000 ? 0.5 : currentPrice > 100 ? 0.05 : 0.01;
    const spread = tickSize * 2;

    const newAsks: OrderBookEntry[] = [];
    let cumulativeAsk = 0;
    for (let i = 5; i >= 1; i--) {
      const price = Number((currentPrice + spread / 2 + i * tickSize).toFixed(2));
      const size = Number((Math.random() * (currentPrice > 1000 ? 1.5 : 45) + 0.1).toFixed(2));
      cumulativeAsk += size;
      newAsks.push({ price, size, total: Number(cumulativeAsk.toFixed(2)) });
    }

    const newBids: OrderBookEntry[] = [];
    let cumulativeBid = 0;
    for (let i = 1; i <= 5; i++) {
      const price = Number((currentPrice - spread / 2 - i * tickSize).toFixed(2));
      const size = Number((Math.random() * (currentPrice > 1000 ? 1.5 : 45) + 0.1).toFixed(2));
      cumulativeBid += size;
      newBids.push({ price, size, total: Number(cumulativeBid.toFixed(2)) });
    }

    setAsks(newAsks);
    setBids(newBids);
  }, [currentPrice]);

  // Simulate incoming tape transactions
  useEffect(() => {
    if (!currentPrice) return;

    const interval = setInterval(() => {
      const isBuy = Math.random() > 0.5;
      const jitter = (Math.random() - 0.5) * (currentPrice > 1000 ? 2 : 0.1);
      const price = Number((currentPrice + jitter).toFixed(2));
      const size = Number((Math.random() * (currentPrice > 1000 ? 0.8 : 25) + 0.05).toFixed(2));

      const newItem: MarketTapeItem = {
        id: `tape-${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString(undefined, {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        price,
        size,
        side: isBuy ? 'BUY' : 'SELL',
      };

      setTape((prev) => [newItem, ...prev.slice(0, 14)]);
    }, 1800);

    return () => clearInterval(interval);
  }, [currentPrice]);

  const maxTotal = Math.max(
    ...asks.map((a) => a.total),
    ...bids.map((b) => b.total),
    1
  );

  const bestAsk = asks.length > 0 ? asks[asks.length - 1].price : currentPrice;
  const bestBid = bids.length > 0 ? bids[0].price : currentPrice;
  const spread = Math.max(0, Number((bestAsk - bestBid).toFixed(2)));
  const spreadPct = currentPrice > 0 ? ((spread / currentPrice) * 100).toFixed(3) : '0';

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col overflow-hidden text-xs font-mono select-none">
      {/* Header Tabs */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('book')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
              activeTab === 'book' ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Level 2 Depth
          </button>
          <button
            onClick={() => setActiveTab('tape')}
            className={`px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === 'tape' ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span>Time & Sales</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </button>
        </div>
        <span className="text-[10px] text-slate-500">{symbol}</span>
      </div>

      {activeTab === 'book' ? (
        <div className="p-2 space-y-1">
          {/* Column headers */}
          <div className="grid grid-cols-3 text-[10px] text-slate-500 px-1 pb-1 border-b border-slate-800/60">
            <span>Price ($)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Depth</span>
          </div>

          {/* Asks (Sell orders - red) */}
          <div className="space-y-0.5">
            {asks.map((ask, idx) => {
              const depthPct = Math.min(100, (ask.total / maxTotal) * 100);
              return (
                <div
                  key={`ask-${idx}`}
                  onClick={() => onSelectPrice(ask.price)}
                  className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-rose-950/30 cursor-pointer rounded transition-colors group"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-rose-500/10 rounded-r"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative text-rose-400 font-semibold tabular-nums">${ask.price.toLocaleString()}</span>
                  <span className="relative text-right text-slate-300 tabular-nums">{ask.size}</span>
                  <span className="relative text-right text-slate-500 tabular-nums">{ask.total}</span>
                </div>
              );
            })}
          </div>

          {/* Spread Bar */}
          <div className="py-1 px-2 my-1 bg-slate-950/70 border-y border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Spread: ${spread}</span>
            <span className="text-slate-500">({spreadPct}%)</span>
            <span className="text-emerald-400 font-bold">${currentPrice.toLocaleString()}</span>
          </div>

          {/* Bids (Buy orders - green) */}
          <div className="space-y-0.5">
            {bids.map((bid, idx) => {
              const depthPct = Math.min(100, (bid.total / maxTotal) * 100);
              return (
                <div
                  key={`bid-${idx}`}
                  onClick={() => onSelectPrice(bid.price)}
                  className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-emerald-950/30 cursor-pointer rounded transition-colors group"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 rounded-r"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative text-emerald-400 font-semibold tabular-nums">${bid.price.toLocaleString()}</span>
                  <span className="relative text-right text-slate-300 tabular-nums">{bid.size}</span>
                  <span className="relative text-right text-slate-500 tabular-nums">{bid.total}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Market Tape / Time & Sales */
        <div className="p-2 space-y-1">
          <div className="grid grid-cols-3 text-[10px] text-slate-500 px-1 pb-1 border-b border-slate-800/60">
            <span>Time</span>
            <span className="text-right">Price</span>
            <span className="text-right">Size</span>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
            {tape.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-600">Awaiting market ticks...</div>
            ) : (
              tape.map((t) => (
                <div key={t.id} className="grid grid-cols-3 px-1 py-0.5 text-[11px] hover:bg-slate-800/40 rounded">
                  <span className="text-slate-500">{t.time}</span>
                  <span className={`text-right tabular-nums font-semibold ${t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${t.price.toLocaleString()}
                  </span>
                  <span className="text-right text-slate-300 tabular-nums">{t.size}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
