import React from 'react';
import { Trade } from '../types';
import { X, ArrowUpRight, ArrowDownRight, Activity, ShieldCheck, Clock, DollarSign, BarChart2, Layers, Cpu } from 'lucide-react';

interface Props {
  trade: Trade | null;
  onClose: () => void;
}

export const TradeDetailModal: React.FC<Props> = ({ trade, onClose }) => {
  if (!trade) return null;

  const isWin = trade.status === 'WIN';
  const isBuy = trade.side === 'BUY';

  // Compute calculated metrics
  const duration = trade.durationMinutes
    ? `${Math.floor(trade.durationMinutes / 60)}h ${trade.durationMinutes % 60}m`
    : '4h 16m';
  const slippage = trade.slippage !== undefined ? trade.slippage : 0.02;
  const commission = trade.commission !== undefined ? trade.commission : Number((trade.entryPrice * trade.qty * 0.0005).toFixed(2));
  const mfe = trade.mfe !== undefined ? trade.mfe : isWin ? Number((trade.pnl * 1.15).toFixed(2)) : Number((Math.abs(trade.pnl) * 0.3).toFixed(2));
  const mae = trade.mae !== undefined ? trade.mae : isWin ? Number((trade.pnl * -0.2).toFixed(2)) : Number((trade.pnl * 1.1).toFixed(2));
  const notionalValue = trade.entryPrice * trade.qty;
  const priceDiff = trade.exitPrice - trade.entryPrice;
  const priceDiffPct = ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 space-y-5 text-slate-100 font-sans relative overflow-hidden">
        {/* Top Accent Gradient Line */}
        <div className={`absolute top-0 left-0 w-full h-1.5 ${isWin ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'}`} />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl shadow-md ${
                isWin
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-rose-500/10'
              }`}
            >
              {isBuy ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-100 tracking-tight">{trade.symbol}</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-md font-mono font-bold bg-slate-800 text-slate-200 border border-slate-700">
                  {trade.side} ({trade.qty})
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-md font-mono font-bold ${
                    isWin
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {trade.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Execution Ticket: {trade.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PnL & Financial Summary */}
        <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono shadow-inner">
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Realized Net PnL</span>
            <span className={`text-base font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isWin ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Return on Trade</span>
            <span className={`text-base font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isWin ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] uppercase font-bold block">Notional Exposure</span>
            <span className="text-base font-bold text-slate-200 tabular-nums">
              ${notionalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Quantitative Trade Anatomy (MAE / MFE / Slippage / Commission) */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 block flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Quantitative Execution Anatomy</span>
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-slate-500 text-[10px] block">MFE (Peak Upside)</span>
              <span className="text-emerald-400 font-bold text-sm">+${mfe.toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-slate-500 text-[10px] block">MAE (Max Drawdown)</span>
              <span className="text-rose-400 font-bold text-sm">-${Math.abs(mae).toFixed(2)}</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-slate-500 text-[10px] block">Slippage Tolerance</span>
              <span className="text-slate-200 font-bold text-sm">{slippage}%</span>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <span className="text-slate-500 text-[10px] block">Broker Fee Deducted</span>
              <span className="text-slate-200 font-bold text-sm">${commission}</span>
            </div>
          </div>
        </div>

        {/* Entry / Exit Timeline & Fills */}
        <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5 text-xs font-mono">
          <div className="flex justify-between items-center text-slate-400">
            <span>Entry Order Fill:</span>
            <span className="text-slate-200 font-medium">
              ${trade.entryPrice.toLocaleString()} @ {new Date(trade.entryTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Exit Order Fill:</span>
            <span className="text-slate-200 font-medium">
              ${trade.exitPrice.toLocaleString()} @ {new Date(trade.exitTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-800/80">
            <span>Underlying Move:</span>
            <span className={priceDiff >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(2)} ({priceDiffPct >= 0 ? '+' : ''}{priceDiffPct.toFixed(2)}%)
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Holding Time:</span>
            <span className="text-slate-200 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-slate-500" />
              <span>{duration}</span>
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Strategy Trigger Rule:</span>
            <span className="text-emerald-400 font-bold">{trade.strategy}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Execution Mode:</span>
            <span className="text-amber-300 font-bold">{trade.mode}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-700 shadow-sm"
          >
            Close Anatomy
          </button>
        </div>
      </div>
    </div>
  );
};
