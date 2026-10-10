import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';
import { Position } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  openPositions: Position[];
  onConfirmKill: () => void;
}

export const KillSwitchModal: React.FC<Props> = ({
  isOpen,
  onClose,
  openPositions,
  onConfirmKill,
}) => {
  const [typedConfirm, setTypedConfirm] = useState('');

  if (!isOpen) return null;

  const totalUnrealized = openPositions.reduce((acc, p) => acc + p.unrealizedPnl, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-slate-900 border-2 border-rose-600 rounded-xl shadow-2xl p-6 space-y-5 text-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-600/20 text-rose-500 rounded-lg">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-rose-400">EMERGENCY KILL SWITCH</h2>
              <p className="text-xs text-slate-400">Circuit Breaker & Immediate Market Liquidation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs space-y-2 text-rose-200">
          <div className="flex items-center gap-1.5 font-bold text-rose-300">
            <AlertTriangle className="w-4 h-4" />
            <span>WARNING: This action is instantaneous and cannot be undone.</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-300">
            <li>
              Immediately issues MARKET CLOSE orders for all <strong>{openPositions.length} open position(s)</strong>.
            </li>
            <li>Current open unrealized PnL: <strong>${totalUnrealized.toFixed(2)}</strong>.</li>
            <li>HALTS the execution engine: all new incoming TradingView webhooks will be rejected with 403 Forbidden.</li>
            <li>Cancels any pending limit/stop orders on connected brokers.</li>
          </ul>
        </div>

        {openPositions.length > 0 && (
          <div className="max-h-36 overflow-y-auto bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Positions to be closed:</span>
            {openPositions.map((pos) => (
              <div key={pos.id} className="flex justify-between items-center text-slate-300">
                <span>
                  {pos.side} {pos.qty} {pos.symbol}
                </span>
                <span className={pos.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {pos.unrealizedPnl >= 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs text-slate-300 block">
            Type <span className="font-mono font-bold text-rose-400">KILL</span> below to confirm:
          </label>
          <input
            type="text"
            value={typedConfirm}
            onChange={(e) => setTypedConfirm(e.target.value.toUpperCase())}
            placeholder="KILL"
            className="w-full bg-slate-950 border border-rose-500/50 rounded px-3 py-2 text-rose-400 font-mono font-bold focus:outline-none focus:border-rose-400 text-center tracking-widest text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel & Keep Trading
          </button>
          <button
            onClick={() => {
              onConfirmKill();
              onClose();
              setTypedConfirm('');
            }}
            disabled={typedConfirm !== 'KILL'}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-950 disabled:text-rose-800 text-white rounded text-xs font-bold transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
          >
            EXECUTE KILL SWITCH
          </button>
        </div>
      </div>
    </div>
  );
};
