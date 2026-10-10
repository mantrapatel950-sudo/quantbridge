import React, { useState } from 'react';
import { Trade } from '../types';
import { Download, Search, Filter, ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, FileSpreadsheet } from 'lucide-react';

interface Props {
  trades: Trade[];
  onSelectTrade?: (trade: Trade) => void;
}

export const TradeLedgerTable: React.FC<Props> = ({ trades, onSelectTrade }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const filteredTrades = trades.filter((t) => {
    const matchesSearch =
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.strategy.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const winCount = trades.filter((t) => t.status === 'WIN').length;
  const lossCount = trades.filter((t) => t.status === 'LOSS').length;

  const exportCSV = () => {
    const headers = [
      'Trade ID',
      'Symbol',
      'Side',
      'Quantity',
      'Entry Price',
      'Exit Price',
      'Entry Time',
      'Exit Time',
      'Realized PnL ($)',
      'PnL (%)',
      'Status',
      'Strategy',
      'Mode',
    ];

    const rows = filteredTrades.map((t) => [
      t.id,
      t.symbol,
      t.side,
      t.qty,
      t.entryPrice,
      t.exitPrice,
      t.entryTime,
      t.exitTime,
      t.pnl,
      t.pnlPercent,
      t.status,
      `"${t.strategy}"`,
      t.mode,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `QuantBridge_Trade_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl overflow-hidden shadow-lg">
      {/* Header & Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/90 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-slate-100 tracking-tight">Trade Ledger & Execution History</span>
          <span className="text-xs font-mono text-slate-500">
            ({filteredTrades.length} of {trades.length} records)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search symbol, strategy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48 font-mono"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-slate-100 shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({trades.length})
            </button>
            <button
              onClick={() => setStatusFilter('WIN')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'WIN'
                  ? 'bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              <span>Wins</span>
              <span className="text-[10px] font-mono text-emerald-400">({winCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter('LOSS')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                statusFilter === 'LOSS'
                  ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-500/30'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <span>Losses</span>
              <span className="text-[10px] font-mono text-rose-400">({lossCount})</span>
            </button>
          </div>

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all cursor-pointer border border-slate-700/80 hover:border-slate-600 shadow-xs"
            title="Download CSV ledger for Python / Pandas, QuantConnect or TimescaleDB"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      {filteredTrades.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">
          No trade records match the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 bg-slate-950/40">
                <th className="py-3 px-4 font-semibold">Exit Date / Time</th>
                <th className="py-3 px-4 font-semibold">Asset</th>
                <th className="py-3 px-4 font-semibold">Side</th>
                <th className="py-3 px-4 text-right font-semibold">Size</th>
                <th className="py-3 px-4 text-right font-semibold">Entry Price</th>
                <th className="py-3 px-4 text-right font-semibold">Exit Price</th>
                <th className="py-3 px-4 text-right font-semibold">Realized Net PnL</th>
                <th className="py-3 px-4 text-center font-semibold">Outcome</th>
                <th className="py-3 px-4 font-semibold">Strategy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredTrades.map((t) => {
                const isWin = t.status === 'WIN';
                const isBuy = t.side === 'BUY';

                return (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTrade?.(t)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    title="Click to view quantitative trade anatomy, MAE/MFE, and hold times"
                  >
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(t.exitTime).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100">{t.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`font-semibold inline-flex items-center gap-0.5 ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {t.side}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-200">{t.qty}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-300">
                      ${t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-200 font-semibold">
                      ${t.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums font-bold">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs ${
                          isWin
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isWin ? '+' : ''}${t.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} (
                        {isWin ? '+' : ''}
                        {t.pnlPercent.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          isWin
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isWin ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 truncate max-w-xs">{t.strategy}</td>
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
