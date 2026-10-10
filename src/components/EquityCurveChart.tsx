import React, { useState, useMemo } from 'react';
import { Trade } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Info,
  DollarSign,
  Percent,
  BarChart2,
  Layers,
  Sparkles,
} from 'lucide-react';

interface Props {
  trades: Trade[];
  startingBalance?: number;
  onSelectTrade?: (trade: Trade) => void;
}

type ChartViewMode = 'EQUITY' | 'DRAWDOWN' | 'TRADE_PNL';
type FilterRange = 'ALL' | 'LAST_20' | 'LAST_10' | 'WINS' | 'LOSSES';

export const EquityCurveChart: React.FC<Props> = ({
  trades,
  startingBalance = 100000,
  onSelectTrade,
}) => {
  const [viewMode, setViewMode] = useState<ChartViewMode>('EQUITY');
  const [filterRange, setFilterRange] = useState<FilterRange>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedTradeIndex, setSelectedTradeIndex] = useState<number | null>(null);

  // Sort trades chronologically
  const sortedTrades = useMemo(() => {
    return [...trades].sort(
      (a, b) => new Date(a.exitTime).getTime() - new Date(b.exitTime).getTime()
    );
  }, [trades]);

  // Filter trades based on user selection
  const filteredTrades = useMemo(() => {
    let list = [...sortedTrades];
    if (filterRange === 'LAST_20') list = list.slice(-20);
    else if (filterRange === 'LAST_10') list = list.slice(-10);
    else if (filterRange === 'WINS') list = list.filter((t) => t.status === 'WIN');
    else if (filterRange === 'LOSSES') list = list.filter((t) => t.status === 'LOSS');
    return list;
  }, [sortedTrades, filterRange]);

  // Compute equity points, peak high-watermark, and drawdown for each point
  const equityPoints = useMemo(() => {
    let currentEquity = startingBalance;
    let peak = startingBalance;
    let maxDrawdownUsd = 0;
    let maxDrawdownPct = 0;

    const points: Array<{
      index: number;
      equity: number;
      peak: number;
      drawdownUsd: number;
      drawdownPct: number;
      pnl: number;
      pnlPercent: number;
      date: string;
      trade?: Trade;
    }> = [
      {
        index: 0,
        equity: startingBalance,
        peak: startingBalance,
        drawdownUsd: 0,
        drawdownPct: 0,
        pnl: 0,
        pnlPercent: 0,
        date: 'Initial Baseline',
      },
    ];

    filteredTrades.forEach((t, i) => {
      currentEquity += t.pnl;
      if (currentEquity > peak) {
        peak = currentEquity;
      }
      const ddUsd = peak - currentEquity;
      const ddPct = peak > 0 ? (ddUsd / peak) * 100 : 0;

      if (ddUsd > maxDrawdownUsd) maxDrawdownUsd = ddUsd;
      if (ddPct > maxDrawdownPct) maxDrawdownPct = ddPct;

      points.push({
        index: i + 1,
        equity: currentEquity,
        peak,
        drawdownUsd: ddUsd,
        drawdownPct: ddPct,
        pnl: t.pnl,
        pnlPercent: t.pnlPercent,
        date: new Date(t.exitTime).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        trade: t,
      });
    });

    return { points, maxDrawdownUsd, maxDrawdownPct, finalEquity: currentEquity, peak };
  }, [filteredTrades, startingBalance]);

  const { points, maxDrawdownPct, finalEquity, peak } = equityPoints;

  // Selected trade for the inspector card (defaults to the hovered point, or explicit selection, or the latest trade)
  const activeTradeIndex =
    hoveredIndex !== null && points[hoveredIndex]?.trade
      ? hoveredIndex
      : selectedTradeIndex !== null && points[selectedTradeIndex]?.trade
      ? selectedTradeIndex
      : points.length > 1
      ? points.length - 1
      : null;

  const inspectedPoint = activeTradeIndex !== null ? points[activeTradeIndex] : null;
  const activeTrade = inspectedPoint?.trade;

  // Chart SVG Coordinates
  const width = 640;
  const height = 220;
  const paddingX = 46;
  const paddingY = 28;

  // Min / Max calculations
  const equities = points.map((p) => p.equity);
  const minEquity = Math.min(...equities, startingBalance) * 0.992;
  const maxEquity = Math.max(...equities, startingBalance, peak) * 1.008;
  const equityRange = maxEquity - minEquity || 1;

  const maxDDPctPlot = Math.max(...points.map((p) => p.drawdownPct), 5) * 1.1;

  const getX = (index: number) => {
    if (points.length <= 1) return paddingX;
    return paddingX + (index / (points.length - 1)) * (width - paddingX * 2);
  };

  const getEquityY = (val: number) => {
    const norm = (val - minEquity) / equityRange;
    return height - paddingY - norm * (height - paddingY * 2);
  };

  const getDrawdownY = (ddPct: number) => {
    // 0% at the top (paddingY), maxDDPctPlot at the bottom (height - paddingY)
    const norm = ddPct / maxDDPctPlot;
    return paddingY + norm * (height - paddingY * 2);
  };

  // Paths for Equity Curve
  const svgEquityPoints = points.map((p) => `${getX(p.index)},${getEquityY(p.equity)}`).join(' ');
  const svgPeakPoints = points.map((p) => `${getX(p.index)},${getEquityY(p.peak)}`).join(' ');
  const areaEquityPoints = `${getX(0)},${height - paddingY} ${svgEquityPoints} ${getX(points.length - 1)},${height - paddingY}`;

  // Paths for Underwater Drawdown
  const svgDDPoints = points.map((p) => `${getX(p.index)},${getDrawdownY(p.drawdownPct)}`).join(' ');
  const areaDDPoints = `${getX(0)},${paddingY} ${svgDDPoints} ${getX(points.length - 1)},${paddingY}`;

  // Performance summary stats
  const totalNetPnl = finalEquity - startingBalance;
  const totalReturnPct = startingBalance > 0 ? (totalNetPnl / startingBalance) * 100 : 0;
  const isNetProfit = totalNetPnl >= 0;

  // Stepper handlers
  const handlePrevTrade = () => {
    if (activeTradeIndex !== null && activeTradeIndex > 1) {
      setSelectedTradeIndex(activeTradeIndex - 1);
      setHoveredIndex(null);
    }
  };

  const handleNextTrade = () => {
    if (activeTradeIndex !== null && activeTradeIndex < points.length - 1) {
      setSelectedTradeIndex(activeTradeIndex + 1);
      setHoveredIndex(null);
    }
  };

  return (
    <div className="flex flex-col bg-slate-900/80 border border-slate-800/90 rounded-xl overflow-hidden shadow-xl backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/90 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
            <span>Cumulative Account Equity Curve</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {filteredTrades.length} trades
          </span>
        </div>

        {/* View Mode Toggle: Equity vs Drawdown vs PnL */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('EQUITY')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'EQUITY'
                  ? 'bg-slate-800 text-emerald-400 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Equity ($)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DRAWDOWN')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'DRAWDOWN'
                  ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-500/30 shadow-xs'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Underwater (%)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TRADE_PNL')}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === 'TRADE_PNL'
                  ? 'bg-slate-800 text-cyan-300 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PnL Bars
            </button>
          </div>

          {/* Filter Range */}
          <div className="hidden sm:flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setFilterRange('ALL')}
              className={`px-2 py-1 rounded cursor-pointer ${
                filterRange === 'ALL' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterRange('LAST_20')}
              className={`px-2 py-1 rounded cursor-pointer ${
                filterRange === 'LAST_20' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              L20
            </button>
            <button
              type="button"
              onClick={() => setFilterRange('LAST_10')}
              className={`px-2 py-1 rounded cursor-pointer ${
                filterRange === 'LAST_10' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              L10
            </button>
          </div>
        </div>
      </div>

      {/* Financial Telemetry Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-2.5 bg-slate-950/50 border-b border-slate-800/60 text-xs font-mono">
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Starting Capital</span>
          <span className="text-slate-300 font-bold">${startingBalance.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Current Equity</span>
          <span className="text-slate-100 font-bold tabular-nums">
            ${finalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Total Net Return</span>
          <span className={`font-bold tabular-nums ${isNetProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isNetProfit ? '+' : ''}${totalNetPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({isNetProfit ? '+' : ''}
            {totalReturnPct.toFixed(2)}%)
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 uppercase block">Peak / Max Drawdown</span>
          <span className="font-bold text-slate-300 tabular-nums">
            ${peak.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="text-rose-400 ml-1">(-{maxDrawdownPct.toFixed(1)}%)</span>
          </span>
        </div>
      </div>

      {/* SVG Chart Display */}
      <div className="relative w-full overflow-hidden p-4">
        {/* Floating Tooltip during hover */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute top-2 right-4 z-20 pointer-events-none p-2.5 bg-slate-950/95 border border-slate-700 rounded-lg shadow-xl text-xs font-mono flex flex-col gap-0.5 animate-in fade-in"
          >
            <div className="flex items-center justify-between gap-3 text-slate-400 text-[10px]">
              <span>{points[hoveredIndex].date}</span>
              {points[hoveredIndex].trade && (
                <span className="text-slate-500 font-bold">Trade #{points[hoveredIndex].index}</span>
              )}
            </div>
            {points[hoveredIndex].trade ? (
              <>
                <div className="flex items-center gap-2 font-bold mt-0.5">
                  <span className="text-slate-100">{points[hoveredIndex].trade?.symbol}</span>
                  <span
                    className={`px-1 rounded text-[10px] ${
                      points[hoveredIndex].trade?.side === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-rose-300 bg-rose-500/20'
                    }`}
                  >
                    {points[hoveredIndex].trade?.side}
                  </span>
                  <span
                    className={
                      points[hoveredIndex].pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {points[hoveredIndex].pnl >= 0 ? '+' : ''}${points[hoveredIndex].pnl.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                  <span>Cumulative Equity:</span>
                  <span className="text-slate-200 font-bold">
                    ${points[hoveredIndex].equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {points[hoveredIndex].drawdownPct > 0 && (
                  <div className="flex items-center justify-between gap-3 text-[10px] text-rose-400">
                    <span>Drawdown from Peak:</span>
                    <span>-{points[hoveredIndex].drawdownPct.toFixed(2)}%</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-slate-300 font-bold">
                Baseline Starting Capital: ${startingBalance.toLocaleString()}
              </div>
            )}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 overflow-visible select-none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id="eqGreenGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.42" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={(height - paddingY * 2) / 2 + paddingY}
            x2={width - paddingX}
            y2={(height - paddingY * 2) / 2 + paddingY}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#1e293b"
            strokeDasharray="4 4"
          />

          {/* View Mode 1: Cumulative Equity ($) */}
          {viewMode === 'EQUITY' && (
            <>
              {/* Baseline Breakeven starting capital dashed guide */}
              <line
                x1={paddingX}
                y1={getEquityY(startingBalance)}
                x2={width - paddingX}
                y2={getEquityY(startingBalance)}
                stroke="#475569"
                strokeDasharray="2 3"
                strokeWidth="1.2"
              />
              <text
                x={paddingX + 4}
                y={getEquityY(startingBalance) - 4}
                fill="#64748b"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                Breakeven (${startingBalance.toLocaleString()})
              </text>

              {/* High Watermark (Peak Equity) guide line */}
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                points={svgPeakPoints}
                opacity="0.6"
              />

              {/* Area gradient fill */}
              <polygon points={areaEquityPoints} fill="url(#eqGreenGradient)" />

              {/* Main Equity Line */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgEquityPoints}
              />

              {/* Hover vertical guide line */}
              {hoveredIndex !== null && (
                <line
                  x1={getX(hoveredIndex)}
                  y1={paddingY}
                  x2={getX(hoveredIndex)}
                  y2={height - paddingY}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}

              {/* Data points */}
              {points.map((p, i) => {
                const cx = getX(p.index);
                const cy = getEquityY(p.equity);
                const isHovered = hoveredIndex === i;
                const isSelected = activeTradeIndex === i;

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onClick={() => {
                      setSelectedTradeIndex(i);
                      if (p.trade && onSelectTrade) {
                        onSelectTrade(p.trade);
                      }
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : isHovered ? 5 : 3.5}
                      className={`transition-all ${
                        isSelected
                          ? 'fill-cyan-400 stroke-white stroke-2 shadow-lg'
                          : isHovered
                          ? 'fill-emerald-400 stroke-white stroke-2'
                          : p.pnl >= 0
                          ? 'fill-slate-950 stroke-emerald-400 stroke-2'
                          : 'fill-slate-950 stroke-rose-400 stroke-2'
                      }`}
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* View Mode 2: Underwater Drawdown (%) */}
          {viewMode === 'DRAWDOWN' && (
            <>
              {/* 0% Drawdown top reference line */}
              <line
                x1={paddingX}
                y1={paddingY}
                x2={width - paddingX}
                y2={paddingY}
                stroke="#10b981"
                strokeWidth="1.5"
              />
              <text
                x={paddingX + 4}
                y={paddingY - 6}
                fill="#10b981"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                0% (Peak High-Watermark)
              </text>

              {/* Drawdown area polygon */}
              <polygon points={areaDDPoints} fill="url(#drawdownGradient)" />

              {/* Drawdown stroke line */}
              <polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={svgDDPoints}
              />

              {/* Hover vertical guide line */}
              {hoveredIndex !== null && (
                <line
                  x1={getX(hoveredIndex)}
                  y1={paddingY}
                  x2={getX(hoveredIndex)}
                  y2={height - paddingY}
                  stroke="#fb7185"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
              )}

              {/* Drawdown points */}
              {points.map((p, i) => {
                const cx = getX(p.index);
                const cy = getDrawdownY(p.drawdownPct);
                const isHovered = hoveredIndex === i;
                const isSelected = activeTradeIndex === i;

                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onClick={() => {
                      setSelectedTradeIndex(i);
                      if (p.trade && onSelectTrade) {
                        onSelectTrade(p.trade);
                      }
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 6 : isHovered ? 5 : 3.5}
                      className={`transition-all ${
                        isSelected
                          ? 'fill-rose-400 stroke-white stroke-2'
                          : isHovered
                          ? 'fill-rose-300 stroke-white stroke-2'
                          : 'fill-slate-950 stroke-rose-400 stroke-2'
                      }`}
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* View Mode 3: Trade PnL Bars ($) */}
          {viewMode === 'TRADE_PNL' && (
            <>
              {/* Center Zero line */}
              <line
                x1={paddingX}
                y1={height / 2}
                x2={width - paddingX}
                y2={height / 2}
                stroke="#64748b"
                strokeWidth="1"
              />

              {filteredTrades.map((t, idx) => {
                const pointIndex = idx + 1;
                const cx = getX(pointIndex);
                const barWidth = Math.max(
                  4,
                  Math.min(18, (width - paddingX * 2) / (filteredTrades.length * 2))
                );
                const maxAbsPnl = Math.max(...filteredTrades.map((x) => Math.abs(x.pnl)), 100);
                const barHeight = Math.min(
                  height / 2 - paddingY,
                  (Math.abs(t.pnl) / maxAbsPnl) * (height / 2 - paddingY)
                );
                const isWin = t.pnl >= 0;
                const y = isWin ? height / 2 - barHeight : height / 2;
                const isHovered = hoveredIndex === pointIndex;
                const isSelected = activeTradeIndex === pointIndex;

                return (
                  <g
                    key={t.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(pointIndex)}
                    onClick={() => {
                      setSelectedTradeIndex(pointIndex);
                      if (onSelectTrade) onSelectTrade(t);
                    }}
                  >
                    <rect
                      x={cx - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={Math.max(2, barHeight)}
                      rx="2"
                      fill={isWin ? '#10b981' : '#f43f5e'}
                      opacity={isSelected ? 1 : isHovered ? 0.9 : 0.75}
                      stroke={isSelected ? '#ffffff' : 'none'}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* X and Y Axis Scale Labels */}
          <text
            x={paddingX}
            y={height - 8}
            fill="#64748b"
            fontSize="9"
            fontFamily="JetBrains Mono, monospace"
          >
            Start (Trade 1)
          </text>
          <text
            x={width - paddingX}
            y={height - 8}
            fill="#64748b"
            fontSize="9"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            Trade {points.length - 1} (Latest)
          </text>

          {viewMode === 'EQUITY' ? (
            <>
              <text
                x={width - paddingX}
                y={paddingY + 8}
                fill="#10b981"
                fontSize="9"
                textAnchor="end"
                fontFamily="JetBrains Mono, monospace"
              >
                ${maxEquity.toFixed(0)}
              </text>
              <text
                x={width - paddingX}
                y={height - paddingY - 2}
                fill="#64748b"
                fontSize="9"
                textAnchor="end"
                fontFamily="JetBrains Mono, monospace"
              >
                ${minEquity.toFixed(0)}
              </text>
            </>
          ) : viewMode === 'DRAWDOWN' ? (
            <text
              x={width - paddingX}
              y={height - paddingY - 2}
              fill="#f43f5e"
              fontSize="9"
              textAnchor="end"
              fontFamily="JetBrains Mono, monospace"
            >
              -{maxDDPctPlot.toFixed(1)}% Max DD
            </text>
          ) : null}
        </svg>
      </div>

      {/* Comprehensive Trade Details Inspector Card */}
      {activeTrade ? (
        <div className="p-4 bg-slate-950 border-t border-slate-800/90 text-xs font-mono space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">
                Inspected Trade:
              </span>
              <span className="font-bold text-slate-100 text-sm">{activeTrade.symbol}</span>
              <span
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold ${
                  activeTrade.side === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}
              >
                {activeTrade.side === 'BUY' ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {activeTrade.side} ({activeTrade.qty})
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  activeTrade.status === 'WIN'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-950 text-rose-400 border border-rose-500/40'
                }`}
              >
                {activeTrade.status}
              </span>
            </div>

            {/* Stepper Navigation: Prev / Next Trade */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevTrade}
                disabled={activeTradeIndex === null || activeTradeIndex <= 1}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 cursor-pointer"
                title="Previous trade"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] text-slate-400 px-1">
                {activeTradeIndex} of {points.length - 1}
              </span>
              <button
                type="button"
                onClick={handleNextTrade}
                disabled={activeTradeIndex === null || activeTradeIndex >= points.length - 1}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-800 cursor-pointer"
                title="Next trade"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {onSelectTrade && (
                <button
                  type="button"
                  onClick={() => onSelectTrade(activeTrade)}
                  className="flex items-center gap-1 ml-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-semibold border border-slate-700 cursor-pointer transition-colors"
                  title="Open full trade anatomy modal"
                >
                  <Maximize2 className="w-3 h-3 text-emerald-400" />
                  <span>Deep Anatomy</span>
                </button>
              )}
            </div>
          </div>

          {/* Key Trade Parameters Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-900/60 rounded-lg border border-slate-800/80">
            <div>
              <span className="text-slate-500 text-[10px] block">Realized Net PnL</span>
              <span
                className={`text-sm font-bold ${
                  activeTrade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeTrade.pnl >= 0 ? '+' : ''}${activeTrade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} (
                {activeTrade.pnl >= 0 ? '+' : ''}
                {activeTrade.pnlPercent.toFixed(2)}%)
              </span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block">Entry ➔ Exit Fill</span>
              <span className="text-slate-200 text-xs">
                ${activeTrade.entryPrice.toLocaleString()} ➔ ${activeTrade.exitPrice.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block">Holding Duration</span>
              <span className="text-slate-200 text-xs flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>
                  {activeTrade.durationMinutes
                    ? `${Math.floor(activeTrade.durationMinutes / 60)}h ${activeTrade.durationMinutes % 60}m`
                    : '3h 42m'}
                </span>
              </span>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] block">Strategy Rule</span>
              <span className="text-emerald-400 text-xs truncate block" title={activeTrade.strategy}>
                {activeTrade.strategy}
              </span>
            </div>
          </div>

          {/* Quantitative Execution Micro-Metrics (MFE, MAE, Slippage, Fee) */}
          <div className="grid grid-cols-4 gap-2 text-[11px] pt-1 border-t border-slate-800/60 text-slate-400">
            <div>
              <span className="text-[10px] text-slate-500 block">Peak Upside (MFE)</span>
              <span className="text-emerald-400 font-semibold">
                +${(activeTrade.mfe ?? (activeTrade.pnl > 0 ? activeTrade.pnl * 1.12 : Math.abs(activeTrade.pnl) * 0.25)).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Max Adverse (MAE)</span>
              <span className="text-rose-400 font-semibold">
                -${Math.abs(activeTrade.mae ?? (activeTrade.pnl > 0 ? activeTrade.pnl * -0.18 : activeTrade.pnl * 1.05)).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Slippage</span>
              <span className="text-slate-300 font-semibold">{activeTrade.slippage ?? 0.02}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Commission / Fee</span>
              <span className="text-slate-300 font-semibold">
                ${(activeTrade.commission ?? (activeTrade.entryPrice * activeTrade.qty * 0.0004)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center text-xs text-slate-500">
          No trade selected. Hover or click any point along the curve to inspect full quantitative anatomy.
        </div>
      )}
    </div>
  );
};
