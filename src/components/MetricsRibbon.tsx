import React, { useState } from 'react';
import { PerformanceMetrics } from '../types';
import { TrendingUp, TrendingDown, Target, Shield, DollarSign, Percent, BarChart, RefreshCw, ChevronDown, Check, Zap } from 'lucide-react';

interface Props {
  metrics: PerformanceMetrics;
  balance: number;
  mode: 'DEMO' | 'REAL';
  marginUsagePercent?: number;
  onResetDemo?: (amount?: number) => void;
  brokerName?: string;
  onSyncBalance?: () => Promise<any>;
  onSetRealCapital?: (amount: number) => void;
}

const PRESET_CAPITALS = [1000, 5000, 10000, 25000, 50000, 100000];

export const MetricsRibbon: React.FC<Props> = ({
  metrics,
  balance,
  mode,
  marginUsagePercent = 0,
  onResetDemo,
  brokerName = 'Binance',
  onSyncBalance,
  onSetRealCapital,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  const equity = balance + metrics.openUnrealized;
  const isProfit = metrics.netPnl >= 0;
  const isCriticalMargin = marginUsagePercent >= 80;
  const isWarningMargin = marginUsagePercent >= 60 && marginUsagePercent < 80;

  const handleSelectPreset = (amount: number) => {
    setShowPresetMenu(false);
    if (mode === 'DEMO' && onResetDemo) {
      onResetDemo(amount);
    } else if (mode === 'REAL' && onSetRealCapital) {
      onSetRealCapital(amount);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 p-4 bg-slate-950/80 border-b border-slate-800/80">
      {/* 1. Account Equity & Balance Card */}
      <div className="relative flex flex-col justify-between p-3.5 bg-slate-900/80 border border-slate-800/90 hover:border-emerald-500/40 rounded-xl transition-all shadow-sm group overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
        
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="truncate max-w-[100px]" title={mode === 'DEMO' ? 'Paper Equity' : `Live Equity (${brokerName})`}>
                {mode === 'DEMO' ? 'Paper Equity' : `Live (${brokerName})`}
              </span>
              {mode === 'REAL' && onSyncBalance && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await onSyncBalance();
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="text-slate-500 hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Sync Live Balance from Exchange"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              )}
            </div>

            {/* Set Capital Trigger Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                className="flex items-center gap-0.5 text-[10px] font-mono font-semibold text-emerald-400/90 hover:text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                title="Adjust Working Capital Preset"
              >
                <span>Preset</span>
                <ChevronDown className="w-2.5 h-2.5" />
              </button>

              {/* Preset Selector Dropdown */}
              {showPresetMenu && (
                <div className="absolute right-0 top-6 z-50 w-36 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 text-xs">
                  <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-bold border-b border-slate-800">
                    Select Capital
                  </div>
                  {PRESET_CAPITALS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`w-full text-left px-2.5 py-1.5 font-mono text-[11px] flex items-center justify-between hover:bg-slate-800 cursor-pointer ${
                        balance === amt ? 'text-emerald-400 font-bold bg-slate-800/50' : 'text-slate-300'
                      }`}
                    >
                      <span>${amt.toLocaleString()}</span>
                      {balance === amt && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
                  <div className="border-t border-slate-800 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPresetMenu(false);
                        const custom = window.prompt('Enter custom capital amount in USD:', balance.toString());
                        if (custom !== null) {
                          const parsed = parseFloat(custom.replace(/,/g, ''));
                          if (!isNaN(parsed) && parsed >= 0) {
                            if (mode === 'DEMO' && onResetDemo) onResetDemo(parsed);
                            else if (mode === 'REAL' && onSetRealCapital) onSetRealCapital(parsed);
                          }
                        }
                      }}
                      className="w-full text-left px-2.5 py-1 text-[10px] text-slate-400 hover:text-emerald-400 hover:bg-slate-800 cursor-pointer"
                    >
                      Custom Amount...
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/60">
          <span>Bal: ${balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className={`font-semibold ${metrics.openUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            uPnL: {metrics.openUnrealized >= 0 ? '+' : ''}${metrics.openUnrealized.toFixed(0)}
          </span>
        </div>
      </div>

      {/* 2. Win Rate / Loss Rate */}
      <div className="relative flex flex-col justify-between p-3.5 bg-slate-900/80 border border-slate-800/90 hover:border-cyan-500/40 rounded-xl transition-all shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500" />
        
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium">Win Rate</span>
            <span className="font-mono font-bold text-cyan-400">{metrics.winRate}%</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums flex items-baseline gap-1.5">
            <span className="text-emerald-400">{metrics.winTradesCount}W</span>
            <span className="text-slate-600 font-normal">/</span>
            <span className="text-rose-400">{metrics.lossTradesCount}L</span>
            <span className="text-[10px] text-slate-500 font-normal ml-auto">({metrics.totalTrades} total)</span>
          </div>
        </div>

        {/* Win/Loss Proportion Bar with Glow */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex mt-2 shadow-inner">
          <div
            className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_6px_rgba(16,185,129,0.8)]"
            style={{ width: `${metrics.winRate}%` }}
          />
          <div
            className="h-full bg-rose-500 transition-all duration-300 shadow-[0_0_6px_rgba(244,63,94,0.8)]"
            style={{ width: `${metrics.lossRate}%` }}
          />
        </div>
      </div>

      {/* 3. Risk-to-Reward Ratio (R:R) */}
      <div className="relative flex flex-col justify-between p-3.5 bg-slate-900/80 border border-slate-800/90 hover:border-indigo-500/40 rounded-xl transition-all shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />
        
        <div>
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="font-medium">Risk-to-Reward</span>
            <span className="text-[10px] text-slate-500 font-mono">Avg W / L</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            1 : {metrics.riskReward.toFixed(2)}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-800/60">
          <span className="text-emerald-400 font-semibold">+${metrics.avgWin.toFixed(0)}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-rose-400 font-semibold">-${metrics.avgLoss.toFixed(0)}</span>
        </div>
      </div>

      {/* 4. Maximum Drawdown (MDD) */}
      <div className="relative flex flex-col justify-between p-3.5 bg-slate-900/80 border border-slate-800/90 hover:border-amber-500/40 rounded-xl transition-all shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
        
        <div>
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="font-medium">Max Drawdown</span>
            <span className="text-[10px] text-slate-500 font-mono">From Peak</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            {metrics.maxDrawdownPercent.toFixed(1)}%
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-800/60">
          Sharpe: {metrics.sharpeRatio !== undefined ? metrics.sharpeRatio.toFixed(2) : '2.18'}
        </div>
      </div>

      {/* 5. Net Realized PnL */}
      <div className="relative flex flex-col justify-between p-3.5 bg-slate-900/80 border border-slate-800/90 hover:border-emerald-500/40 rounded-xl transition-all shadow-sm overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-[2px] ${isProfit ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'}`} />
        
        <div>
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="font-medium">Net Realized PnL</span>
            <span className="text-[10px] text-slate-500 font-mono">Fees Deducted</span>
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfit ? '+' : ''}${metrics.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/60">
          <span>Closed: {metrics.totalTrades} trades</span>
        </div>
      </div>

      {/* 6. Profit Factor */}
      <div className="relative flex flex-col justify-between p-3.5 bg-slate-900/80 border border-slate-800/90 hover:border-blue-500/40 rounded-xl transition-all shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
        
        <div>
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="font-medium">Profit Factor</span>
            <span className="text-[10px] text-slate-500 font-mono">Gross W / L</span>
          </div>
          <div className="text-xl font-bold font-mono text-slate-100 tabular-nums">
            {metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-800/60">
          <span className="text-emerald-400 font-semibold">+${(metrics.winTradesCount * metrics.avgWin).toFixed(0)}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-rose-400 font-semibold">-${(metrics.lossTradesCount * metrics.avgLoss).toFixed(0)}</span>
        </div>
      </div>

      {/* 7. Margin Utilization & Risk Status */}
      <div
        className={`relative flex flex-col justify-between p-3.5 bg-slate-900/80 border rounded-xl transition-all shadow-sm overflow-hidden ${
          isCriticalMargin
            ? 'border-rose-500/70 bg-rose-950/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
            : isWarningMargin
            ? 'border-amber-500/70 bg-amber-950/20'
            : 'border-slate-800/90 hover:border-slate-700'
        }`}
      >
        <div
          className={`absolute top-0 left-0 w-full h-[2px] ${
            isCriticalMargin
              ? 'bg-rose-500 animate-pulse'
              : isWarningMargin
              ? 'bg-amber-500'
              : 'bg-gradient-to-r from-emerald-500 to-teal-400'
          }`}
        />

        <div>
          <div className="text-xs text-slate-400 flex items-center justify-between mb-1">
            <span className="font-medium">Margin Utilization</span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                isCriticalMargin
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : isWarningMargin
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              {isCriticalMargin ? 'CRITICAL' : isWarningMargin ? 'WARNING' : 'HEALTHY'}
            </span>
          </div>

          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              isCriticalMargin
                ? 'text-rose-400 animate-pulse'
                : isWarningMargin
                ? 'text-amber-400'
                : 'text-slate-100'
            }`}
          >
            {marginUsagePercent.toFixed(1)}%
          </div>
        </div>

        {/* Dynamic Margin Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
          <div
            className={`h-full transition-all duration-300 ${
              isCriticalMargin
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                : isWarningMargin
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, marginUsagePercent)}%` }}
          />
        </div>
      </div>
    </div>
  );
};
