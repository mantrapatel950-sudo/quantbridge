import React from 'react';
import { Position } from '../types';
import { ArrowUpRight, ArrowDownRight, XCircle, Shield, TrendingUp, Zap, Clock } from 'lucide-react';

interface Props {
  positions: Position[];
  onClosePosition: (positionId: string) => void;
  onSelectPosition?: (position: Position) => void;
}

export const OpenPositionsTable: React.FC<Props> = ({ positions, onClosePosition, onSelectPosition }) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl overflow-hidden shadow-lg">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-sm font-bold text-slate-100 tracking-tight">Active Open Positions</span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {positions.length} ACTIVE
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Real-Time Broker Execution State</span>
        </div>
      </div>

      {positions.length === 0 ? (
        <div className="py-14 px-4 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
            <Zap className="w-6 h-6 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-300 mb-1">No Active Positions Open</p>
          <p className="text-xs text-slate-500 max-w-md">
            Execute orders from the TradingView terminal, the Order Placer widget, or send webhook signals to open positions.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">Asset</th>
                <th className="py-3 px-4 font-semibold">Side</th>
                <th className="py-3 px-4 text-right font-semibold">Size</th>
                <th className="py-3 px-4 text-right font-semibold">Leverage & Margin</th>
                <th className="py-3 px-4 text-right font-semibold">Entry Price</th>
                <th className="py-3 px-4 text-right font-semibold">Mark Price</th>
                <th className="py-3 px-4 text-right font-semibold">Liq. Price</th>
                <th className="py-3 px-4 text-right font-semibold">Unrealized PnL</th>
                <th className="py-3 px-4 font-semibold">Brackets (SL / TP)</th>
                <th className="py-3 px-4 font-semibold">Strategy</th>
                <th className="py-3 px-4 text-center font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {positions.map((pos) => {
                const isLong = pos.side === 'LONG';
                const isProfit = pos.unrealizedPnl >= 0;

                return (
                  <tr
                    key={pos.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectPosition?.(pos)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 text-sm">{pos.symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[11px] ${
                          isLong
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                        }`}
                      >
                        {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {pos.side}
                      </span>
                      {pos.strategy === 'PENDING_LIMIT' && (
                        <span className="ml-2 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-bold">
                          LIMIT
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-100 font-bold">{pos.qty}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span className="text-emerald-400 font-bold">{pos.leverage || 10}x</span>
                      <span className="text-slate-500 text-[10px] block">
                        ${pos.margin ? pos.margin.toLocaleString() : ((pos.entryPrice * pos.qty) / (pos.leverage || 10)).toFixed(0)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-100 font-bold">
                      ${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-amber-400 font-semibold">
                      {pos.liquidationPrice && pos.liquidationPrice > 0
                        ? `$${pos.liquidationPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold">
                      {pos.strategy === 'PENDING_LIMIT' ? (
                        <span className="text-slate-500">Pending Fill...</span>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs ${
                            isProfit
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isProfit ? '+' : ''}${pos.unrealizedPnl.toFixed(2)} ({isProfit ? '+' : ''}
                          {pos.unrealizedPnlPercent.toFixed(2)}%)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      <div>SL: ${pos.stopLoss?.toLocaleString() || '-'} · TP: ${pos.takeProfit?.toLocaleString() || '-'}</div>
                      {pos.isTrailingStop && (
                        <div className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-semibold mt-0.5 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30">
                          <span>⚡ Trail {pos.trailingStopPercent}%</span>
                          <span className="text-slate-400">· Peak ${pos.highestPrice?.toLocaleString() || pos.entryPrice.toLocaleString()}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-[130px]" title={pos.strategy}>
                      {pos.strategy}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClosePosition(pos.id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500/60 rounded text-[11px] font-bold transition-all cursor-pointer shadow-xs"
                        title="Close position at current market price"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Close</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
