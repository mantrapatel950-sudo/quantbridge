import React, { useState, useEffect } from 'react';
import { Position } from '../types';
import { DraggableFloatingWrapper } from './DraggableFloatingWrapper';
import {
  TrendingUp,
  TrendingDown,
  Sliders,
  AlertCircle,
  Zap,
  Minus,
  CheckCircle,
  Move,
  RotateCcw,
  Target,
  ShieldAlert,
  X,
  Maximize2,
  Compass,
  Radio,
} from 'lucide-react';

interface Props {
  symbol: string;
  currentPrice: number;
  availableFunds: number;
  tradingMode: 'DEMO' | 'REAL';
  activePosition?: Position | null;
  onExecuteOrder: (order: {
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
  onCloseWidget?: () => void;
}

export const FloatingOrderPlacer: React.FC<Props> = ({
  symbol,
  currentPrice,
  availableFunds,
  tradingMode,
  activePosition,
  onExecuteOrder,
  onClosePosition,
  onUpdateTPSL,
  onCloseWidget,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'TRAILING_STOP'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [qty, setQty] = useState<string>('0.5');
  const [leverage, setLeverage] = useState<number>(10);
  const [stopLossInput, setStopLossInput] = useState<string>('');
  const [takeProfitInput, setTakeProfitInput] = useState<string>('');
  const [trailingPercent, setTrailingPercent] = useState<number>(1.5);
  const [enableTrailingStop, setEnableTrailingStop] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sync limit price with current market price
  useEffect(() => {
    if (currentPrice > 0 && (!limitPrice || orderType === 'MARKET' || orderType === 'TRAILING_STOP')) {
      setLimitPrice(currentPrice.toString());
    }
  }, [currentPrice, symbol]);

  // Adjust default quantity based on symbol scale
  useEffect(() => {
    const isCryptoHigh = symbol.includes('BTC');
    const isCryptoMid = symbol.includes('ETH');
    const isGold = symbol.includes('XAU') || symbol.includes('GOLD');
    const isSilver = symbol.includes('XAG') || symbol.includes('SILVER');
    if (isCryptoHigh) setQty('0.5');
    else if (isCryptoMid) setQty('2.0');
    else if (isGold) setQty('5.0');
    else if (isSilver) setQty('50.0');
    else setQty('20.0');
  }, [symbol]);

  // Update SL/TP inputs when active position changes
  useEffect(() => {
    if (activePosition) {
      if (activePosition.stopLoss) setStopLossInput(activePosition.stopLoss.toString());
      if (activePosition.takeProfit) setTakeProfitInput(activePosition.takeProfit.toString());
      if (typeof activePosition.isTrailingStop === 'boolean') {
        setEnableTrailingStop(activePosition.isTrailingStop);
      }
      if (activePosition.trailingStopPercent) {
        setTrailingPercent(activePosition.trailingStopPercent);
      }
    }
  }, [activePosition?.id]);

  // Financial Calculations
  const numericPrice = orderType === 'LIMIT' ? parseFloat(limitPrice) || currentPrice : currentPrice;
  const numericQty = parseFloat(qty) || 0;
  const orderValue = numericPrice * numericQty;
  const marginRequired = leverage > 0 ? orderValue / leverage : orderValue;
  const isSufficientFunds = availableFunds >= marginRequired;
  const fundsAfterTrade = Math.max(0, availableFunds - marginRequired);

  // Trailing Stop estimated starting level
  const isTrailingMode = enableTrailingStop;
  const estTrailingSL = side === 'BUY'
    ? numericPrice * (1 - trailingPercent / 100)
    : numericPrice * (1 + trailingPercent / 100);

  // Liquidation Price Estimation
  const estLiqPrice =
    side === 'BUY'
      ? numericPrice * (1 - (1 / leverage) * 0.9)
      : numericPrice * (1 + (1 / leverage) * 0.9);

  // Quick Adjust Price for Limit Order
  const handleAdjustPrice = (pctOffset: number) => {
    if (numericPrice > 0) {
      const adjusted = numericPrice * (1 + pctOffset / 100);
      setLimitPrice(adjusted.toFixed(2));
    }
  };

  // Quick Margin % Allocations
  const handleSetMarginPercent = (percent: number) => {
    if (numericPrice <= 0 || availableFunds <= 0) return;
    const maxMargin = (availableFunds * percent) / 100;
    const computedOrderValue = maxMargin * leverage;
    const computedQty = computedOrderValue / numericPrice;
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH');
    setQty(computedQty.toFixed(isCrypto ? 4 : 2));
  };

  // Submit Order Execution
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numericQty <= 0) {
      setFeedback({ message: 'Enter a valid quantity', type: 'error' });
      return;
    }
    if (numericPrice <= 0) {
      setFeedback({ message: 'Enter a valid price', type: 'error' });
      return;
    }
    if (!isSufficientFunds) {
      setFeedback({
        message: `Insufficient margin! Need $${marginRequired.toFixed(2)}, have $${availableFunds.toFixed(2)}`,
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      await onExecuteOrder({
        symbol,
        side,
        orderType,
        price: numericPrice,
        qty: numericQty,
        leverage,
        stopLoss: isTrailingMode
          ? Number(estTrailingSL.toFixed(2))
          : stopLossInput ? parseFloat(stopLossInput) : undefined,
        takeProfit: takeProfitInput ? parseFloat(takeProfitInput) : undefined,
        isTrailingStop: isTrailingMode,
        trailingStopPercent: isTrailingMode ? trailingPercent : undefined,
      });
      setFeedback({
        message: `Filled: ${orderType} ${side} ${numericQty} ${symbol} ${isTrailingMode ? `(Trailing ${trailingPercent}%)` : ''}`,
        type: 'success',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ message: err.message || 'Execution rejected', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Position TP/SL and Trailing Stop directly from Placer
  const handleUpdatePositionBrackets = async () => {
    if (!activePosition || !onUpdateTPSL) return;
    try {
      await onUpdateTPSL(
        activePosition.id,
        stopLossInput ? parseFloat(stopLossInput) : undefined,
        takeProfitInput ? parseFloat(takeProfitInput) : undefined,
        trailingPercent,
        enableTrailingStop
      );
      setFeedback({
        message: `Updated brackets: ${enableTrailingStop ? `Trailing Stop (${trailingPercent}%)` : 'Fixed SL/TP'} synced!`,
        type: 'success',
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ message: err.message || 'Failed to update SL/TP', type: 'error' });
    }
  };

  return (
    <DraggableFloatingWrapper
      storageKey={`quantbridge_floating_placer_${symbol}`}
      isCollapsed={isCollapsed}
    >
      {({ dragControls, snapToPreset }) =>
        isCollapsed ? (
          /* Minimized Draggable Pill */
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-950/95 hover:bg-slate-900 border border-emerald-500/60 hover:border-emerald-400 text-slate-100 rounded-xl shadow-2xl backdrop-blur-md transition-all cursor-grab active:cursor-grabbing group ring-1 ring-emerald-500/30"
          >
            <Move className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold font-mono text-emerald-400">{symbol}</span>
            <span className="text-xs font-mono text-slate-200 tabular-nums font-bold">
              ${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">
              {leverage}x
            </span>

            {activePosition && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                  activePosition.unrealizedPnl >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {activePosition.isTrailingStop ? '⚡' : ''} PnL: {activePosition.unrealizedPnl >= 0 ? '+' : ''}${activePosition.unrealizedPnl.toFixed(2)}
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-1 hover:bg-slate-800 text-emerald-400 hover:text-white rounded cursor-pointer ml-1 transition-colors"
              title="Expand Full Order Placer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Full Floating Draggable Order Placer Panel */
          <div className="w-80 sm:w-88 max-h-[80vh] flex flex-col bg-slate-950/98 border border-slate-700/90 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden ring-1 ring-slate-800">
            {/* Top Draggable Header */}
            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button, input, select, a')) return;
                dragControls.start(e);
              }}
              className="flex-shrink-0 flex items-center justify-between px-3.5 py-2.5 bg-slate-900/95 border-b border-slate-800 cursor-grab active:cursor-grabbing hover:bg-slate-900 transition-colors"
            >
              <div className="flex items-center gap-1.5 pointer-events-none">
                <Move className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-100 font-mono tracking-wide">{symbol}</span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold tabular-nums">
                  ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Order Type Selector: Market, Limit, Trailing Stop */}
                <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType('MARKET');
                      setEnableTrailingStop(false);
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      orderType === 'MARKET' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType('LIMIT');
                      setEnableTrailingStop(false);
                      if (!limitPrice || limitPrice === '0') setLimitPrice(currentPrice.toString());
                    }}
                    className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      orderType === 'LIMIT' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Limit
                  </button>

                </div>

                {/* Preset Snap Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded transition-colors cursor-pointer"
                    title="Snap position anywhere (inside/outside chart)"
                  >
                    <Compass className="w-3.5 h-3.5" />
                  </button>

                  {showPresetsMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 text-[11px] font-mono z-50">
                      <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">
                        Float / Snap Anywhere
                      </div>
                      <button
                        onClick={() => {
                          snapToPreset('chart-bottom-right');
                          setShowPresetsMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                      >
                        <span>Inside Chart (Bottom-R)</span>
                      </button>
                      <button
                        onClick={() => {
                          snapToPreset('chart-top-right');
                          setShowPresetsMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                      >
                        <span>Inside Chart (Top-R)</span>
                      </button>
                      <button
                        onClick={() => {
                          snapToPreset('outside-right');
                          setShowPresetsMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                      >
                        <span>Outside Chart (Right Edge)</span>
                      </button>
                      <button
                        onClick={() => {
                          snapToPreset('outside-left');
                          setShowPresetsMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                      >
                        <span>Outside Chart (Left Edge)</span>
                      </button>
                      <button
                        onClick={() => {
                          snapToPreset('center');
                          setShowPresetsMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 hover:bg-slate-800 text-slate-200 flex items-center justify-between cursor-pointer"
                      >
                        <span>Center Screen</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => snapToPreset('chart-bottom-right')}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                  title="Reset position to default"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                  title="Minimize to floating chip"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                {onCloseWidget && (
                  <button
                    type="button"
                    onClick={onCloseWidget}
                    className="p-1 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded transition-colors cursor-pointer"
                    title="Close widget"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-3 space-y-2 text-[11px] overflow-y-auto custom-scrollbar flex-1">
              {/* Long / Short Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                    side === 'BUY'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-500/50'
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>BUY / LONG</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                    side === 'SELL'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/60 ring-2 ring-rose-500/50'
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>SELL / SHORT</span>
                </button>
              </div>

              {/* Limit Price Input */}
              {orderType === 'LIMIT' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Limit Price</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAdjustPrice(-0.2)}
                        className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-[10px] cursor-pointer"
                      >
                        -0.2%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustPrice(+0.2)}
                        className="px-1.5 py-0.5 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 text-[10px] cursor-pointer"
                      >
                        +0.2%
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</span>
                    <input
                      type="number"
                      step="any"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder={currentPrice.toString()}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-3 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}

              {/* TRAILING STOP CONFIGURATION BLOCK */}
              <div className={`p-2.5 rounded-xl space-y-2 font-mono transition-colors ${isTrailingMode ? 'bg-amber-950/30 border border-amber-500/40' : 'bg-slate-900/60 border border-slate-800'}`}>
                <div className="flex items-center justify-between text-[11px]">
                  <div className={`flex items-center gap-1.5 font-bold ${isTrailingMode ? 'text-amber-300' : 'text-slate-400'}`}>
                    <Radio className={`w-3.5 h-3.5 ${isTrailingMode ? 'animate-pulse' : ''}`} />
                    <span>Trailing Stop</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] font-bold text-slate-500">{isTrailingMode ? 'ON' : 'OFF'}</span>
                    <input
                      type="checkbox"
                      checked={enableTrailingStop}
                      onChange={(e) => setEnableTrailingStop(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-500 cursor-pointer"
                    />
                  </label>
                </div>

                {isTrailingMode && (
                  <>
                    {/* Preset Trailing % Pills */}
                    <div className="grid grid-cols-6 gap-1 pt-0.5">
                      {[0.5, 1.0, 1.5, 2.0, 3.0, 5.0].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setTrailingPercent(pct)}
                          className={`py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                            trailingPercent === pct
                              ? 'bg-amber-400 text-slate-950 shadow-sm'
                              : 'bg-slate-900 text-slate-400 hover:text-amber-300 border border-slate-800'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                      Initial Trail SL: <strong className="text-amber-300">${estTrailingSL.toFixed(2)}</strong>. Ratchets automatically to lock in gains.
                    </div>
                  </>
                )}
              </div>

              {/* Quantity Input & Quick Margin Presets */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Order Quantity</span>
                  <span className="text-slate-500">
                    Avail: ${availableFunds.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0.5"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[11px]">
                    {symbol.split('/')[0]}
                  </span>
                </div>

                {/* Quick Margin % Buttons */}
                <div className="grid grid-cols-4 gap-1 pt-1">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleSetMarginPercent(pct)}
                      className="py-1 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-emerald-400 border border-slate-800 rounded text-[10px] font-mono transition-colors cursor-pointer"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Leverage Selector & Slider */}
              <div className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Sliders className="w-3 h-3 text-emerald-400" />
                    <span>Leverage</span>
                  </div>
                  <span className="font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    {leverage}x
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />

                <div className="flex items-center justify-between pt-1">
                  {[1, 5, 10, 20, 50, 100].map((lev) => (
                    <button
                      key={lev}
                      type="button"
                      onClick={() => setLeverage(lev)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        leverage === lev
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {lev}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Target (TP) & Stop Loss (SL) inputs */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-semibold">
                    <Target className="w-3 h-3" />
                    <span>Target (TP)</span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={takeProfitInput}
                    onChange={(e) => setTakeProfitInput(e.target.value)}
                    placeholder="e.g. 71000"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono font-semibold">
                    <div className="flex items-center gap-1 text-rose-400">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Stop Loss (SL)</span>
                    </div>
                    {/* Toggle removed; moved to the dedicated Trailing Stop block above */}
                  </div>
                  <input
                    type="number"
                    step="any"
                    disabled={isTrailingMode}
                    value={isTrailingMode ? estTrailingSL.toFixed(2) : stopLossInput}
                    onChange={(e) => setStopLossInput(e.target.value)}
                    placeholder="e.g. 65000"
                    className={`w-full bg-slate-900 border rounded px-2 py-1 font-mono text-[11px] focus:outline-none ${
                      isTrailingMode
                        ? 'border-amber-500/50 text-amber-300 bg-amber-950/20'
                        : 'border-slate-700 text-slate-100 focus:border-rose-500'
                    }`}
                  />
                </div>
              </div>

              {activePosition && (
                <button
                  type="button"
                  onClick={handleUpdatePositionBrackets}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded text-[10px] font-mono font-semibold transition-colors cursor-pointer border border-slate-700 flex items-center justify-center gap-1"
                >
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>Update Position Brackets & Trailing Stop</span>
                </button>
              )}

              {/* Financial Breakdown & Requirements */}
              <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 space-y-1 text-[11px] font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Order Value</span>
                  <span className="text-slate-200 font-semibold">${orderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Margin Required</span>
                  <span className={`font-bold ${isSufficientFunds ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${marginRequired.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Est. Liq. Price</span>
                  <span className="text-amber-400 font-semibold">
                    ${Math.max(0, estLiqPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-500 pt-0.5 border-t border-slate-800 text-[10px]">
                  <span>Mode: {tradingMode}</span>
                  <span>Free Remainder: ${fundsAfterTrade.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Feedback message */}
              {feedback && (
                <div
                  className={`p-2 rounded text-[11px] font-mono flex items-center gap-1.5 ${
                    feedback.type === 'success'
                      ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !isSufficientFunds}
                className={`w-full py-2.5 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                  !isSufficientFunds
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : isTrailingMode
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-amber-950/60 ring-2 ring-amber-500/30'
                    : side === 'BUY'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-emerald-950/60'
                    : 'bg-rose-600 hover:bg-rose-500 text-white font-extrabold shadow-rose-950/60'
                }`}
              >
                {isSubmitting ? (
                  <span>Transmitting Order...</span>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {isTrailingMode ? 'TRAILING STOP' : orderType} {side} {numericQty} {symbol.split('/')[0]} ({leverage}x)
                    </span>
                  </>
                )}
              </button>

              {/* Active Position in Chart HUD if open */}
              {activePosition && (
                <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Position in Chart:</span>
                    <span
                      className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                        activePosition.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {activePosition.side} {activePosition.qty} @ ${activePosition.entryPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Running PnL:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        activePosition.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {activePosition.unrealizedPnl >= 0 ? '+' : ''}${activePosition.unrealizedPnl.toFixed(2)} ({activePosition.unrealizedPnlPercent >= 0 ? '+' : ''}{activePosition.unrealizedPnlPercent}%)
                    </span>
                  </div>

                  {activePosition.isTrailingStop && (
                    <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                      <span>⚡ Trailing Stop: Active ({activePosition.trailingStopPercent}%)</span>
                      <span>Peak: ${activePosition.highestPrice?.toLocaleString() || activePosition.entryPrice.toLocaleString()}</span>
                    </div>
                  )}

                  {onClosePosition && (
                    <button
                      type="button"
                      onClick={() => onClosePosition(activePosition.id)}
                      className="w-full py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded text-[10px] font-mono font-bold transition-all cursor-pointer"
                    >
                      Close Market Position
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        )
      }
    </DraggableFloatingWrapper>
  );
};
