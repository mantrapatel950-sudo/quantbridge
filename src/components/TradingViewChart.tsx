import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  Time,
  LogicalRange,
} from 'lightweight-charts';
import {
  fetchRealKlines,
  calculateEMA,
  getVolumeSeriesData,
  calculateBollingerBands,
  calculateRSI,
  runStrategyBacktest,
  Candle,
} from '../utils/marketData';
import { Position, Trade } from '../types';
import { FloatingOrderPlacer } from './FloatingOrderPlacer';
import {
  Maximize2,
  RefreshCw,
  Target,
  ShieldAlert,
  MoveVertical,
  X,
  Zap,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface Props {
  selectedSymbol: string;
  onSymbolChange: (sym: string) => void;
  openPositions?: Position[];
  closedTrades?: Trade[];
  availableFunds?: number;
  tradingMode?: 'DEMO' | 'REAL';
  onQuickTrade?: (action: 'BUY' | 'SELL' | 'CLOSE', symbol: string, price: number, qty?: number) => void;
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

export const TradingViewChart: React.FC<Props> = ({
  selectedSymbol,
  onSymbolChange,
  openPositions = [],
  availableFunds = 100000,
  tradingMode = 'DEMO',
  onExecuteOrder,
  onClosePosition,
  onUpdateTPSL,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const isDisposedRef = useRef(false);
  const priceLinesRef = useRef<any[]>([]);

  // Direct references to individual price lines for 60fps native canvas manipulation
  const tpPriceLineRef = useRef<any>(null);
  const slPriceLineRef = useRef<any>(null);
  const entryPriceLineRef = useRef<any>(null);
  const runningPriceLineRef = useRef<any>(null);

  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candlesRef = useRef<Candle[]>([]);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [priceChange, setPriceChange] = useState<{ change: number; pct: number }>({ change: 0, pct: 0 });

  // Auto-Scale Y-Axis State for Visible Candlesticks
  const [isYAutoScaleActive, setIsYAutoScaleActive] = useState<boolean>(true);
  const [visiblePriceRange, setVisiblePriceRange] = useState<{
    min: number;
    max: number;
    spread: number;
    visibleCandlesCount: number;
  } | null>(null);
  const antiClippingMargin = 8;

  // Indicator States
  const [showEMA20, setShowEMA20] = useState(true);
  const [showEMA50, setShowEMA50] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [timeframe, setTimeframe] = useState<'15m' | '1h' | '4h' | '1D'>('1D');
  const [isLoading, setIsLoading] = useState(false);

  // Strategy Backtest Simulation State
  const [backtestResult, setBacktestResult] = useState<any | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  // Interactive Target (TP) and Stop Loss (SL) Dragging States
  const activePosition = openPositions.find((p) => p.symbol === selectedSymbol);
  const [activeTP, setActiveTP] = useState<number | null>(null);
  const [activeSL, setActiveSL] = useState<number | null>(null);
  const [isDraggingBracket, setIsDraggingBracket] = useState<'TP' | 'SL' | null>(null);
  const [dragLivePrice, setDragLivePrice] = useState<number | null>(null);

  // API update toast notification
  const [apiToast, setApiToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Coordinates on chart canvas for interactive lines & handles
  const [entryCoordY, setEntryCoordY] = useState<number | null>(null);
  const [currentPriceCoordY, setCurrentPriceCoordY] = useState<number | null>(null);
  const [tpCoordY, setTpCoordY] = useState<number | null>(null);
  const [slCoordY, setSlCoordY] = useState<number | null>(null);
  const [chartDimensions, setChartDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 500 });

  // Floating order placer widget toggle
  const [isPlacerVisible, setIsPlacerVisible] = useState(true);

  // Suppress any stray lightweight-charts 'Object is disposed' events from unmount race conditions
  useEffect(() => {
    const handleDisposedError = (event: ErrorEvent) => {
      if (event.message?.includes('Object is disposed')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('error', handleDisposedError);
    return () => window.removeEventListener('error', handleDisposedError);
  }, []);

  // Sync TP and SL with active position
  useEffect(() => {
    if (activePosition) {
      setActiveTP(activePosition.takeProfit ?? null);
      setActiveSL(activePosition.stopLoss ?? null);
    } else {
      setActiveTP(null);
      setActiveSL(null);
      setEntryCoordY(null);
      setCurrentPriceCoordY(null);
      setTpCoordY(null);
      setSlCoordY(null);
    }
  }, [activePosition?.id, activePosition?.takeProfit, activePosition?.stopLoss]);

  // Load candle data when symbol or timeframe changes
  useEffect(() => {
    let isMounted = true;
    async function loadCandles() {
      setIsLoading(true);
      try {
        const realCandles = await fetchRealKlines(selectedSymbol, timeframe, 90);
        if (!isMounted) return;
        setCandles(realCandles);
        candlesRef.current = realCandles;

        if (realCandles.length > 0) {
          const last = realCandles[realCandles.length - 1];
          const prev = realCandles[realCandles.length - 2] || last;
          setCurrentPrice(last.close);

          const diff = Number((last.close - prev.close).toFixed(2));
          const pct = Number(((diff / prev.close) * 100).toFixed(2));
          setPriceChange({ change: diff, pct });
        }
      } catch (err) {
        console.error('Failed to load candlestick data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadCandles();
    return () => {
      isMounted = false;
    };
  }, [selectedSymbol, timeframe]);

  // Handler to compute and update visible price range
  const updateVisibleRangeFromLogical = useCallback((logicalRange: LogicalRange | null) => {
    const allCandles = candlesRef.current;
    if (!logicalRange || allCandles.length === 0) return;

    const fromIndex = Math.max(0, Math.floor(logicalRange.from));
    const toIndex = Math.min(allCandles.length - 1, Math.ceil(logicalRange.to));

    if (fromIndex <= toIndex && fromIndex < allCandles.length) {
      const visibleBars = allCandles.slice(fromIndex, toIndex + 1);
      if (visibleBars.length > 0) {
        let minLow = Infinity;
        let maxHigh = -Infinity;

        for (const bar of visibleBars) {
          if (bar.low < minLow) minLow = bar.low;
          if (bar.high > maxHigh) maxHigh = bar.high;
        }

        if (minLow !== Infinity && maxHigh !== -Infinity) {
          setVisiblePriceRange({
            min: minLow,
            max: maxHigh,
            spread: Number((maxHigh - minLow).toFixed(2)),
            visibleCandlesCount: visibleBars.length,
          });
        }
      }
    }
  }, []);

  // Update visual pixel coordinates of Entry, Current Price (Running PnL), TP, and SL for interactive chart overlays
  const updateBracketCoordinates = useCallback(() => {
    if (isDisposedRef.current || !candleSeriesRef.current || !activePosition) {
      setEntryCoordY(null);
      setCurrentPriceCoordY(null);
      setTpCoordY(null);
      setSlCoordY(null);
      return;
    }

    try {
      // 1. Entry price Y coordinate
      const entryY = candleSeriesRef.current.priceToCoordinate(activePosition.entryPrice);
      setEntryCoordY(entryY !== null ? Math.round(entryY) : null);

      // 2. Current market price Y coordinate (Running Profit / Loss line)
      const curPrice = activePosition.currentPrice || currentPrice;
      if (curPrice > 0) {
        const curY = candleSeriesRef.current.priceToCoordinate(curPrice);
        setCurrentPriceCoordY(curY !== null ? Math.round(curY) : null);
      } else {
        setCurrentPriceCoordY(null);
      }

      // 3. Target (TP) Y coordinate
      const targetPrice = dragLivePrice && isDraggingBracket === 'TP' ? dragLivePrice : activeTP;
      if (targetPrice && targetPrice > 0) {
        const tpY = candleSeriesRef.current.priceToCoordinate(targetPrice);
        setTpCoordY(tpY !== null ? Math.round(tpY) : null);
      } else {
        setTpCoordY(null);
      }

      // 4. Stop Loss (SL) Y coordinate
      const stopPrice = dragLivePrice && isDraggingBracket === 'SL' ? dragLivePrice : activeSL;
      if (stopPrice && stopPrice > 0) {
        const slY = candleSeriesRef.current.priceToCoordinate(stopPrice);
        setSlCoordY(slY !== null ? Math.round(slY) : null);
      } else {
        setSlCoordY(null);
      }
    } catch (e) {
      // ignore
    }
  }, [activePosition, currentPrice, activeTP, activeSL, dragLivePrice, isDraggingBracket]);

  // Mount Chart ONCE - bulletproof lifecycle
  useEffect(() => {
    if (!chartContainerRef.current) return;
    isDisposedRef.current = false;

    const container = chartContainerRef.current;
    const initialWidth = container.clientWidth || 800;
    const initialHeight = container.clientHeight || 500;
    setChartDimensions({ width: initialWidth, height: initialHeight });

    const chart = createChart(container, {
      width: initialWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.4)', style: 1 },
        horzLines: { color: 'rgba(30, 41, 59, 0.4)', style: 1 },
      },
      crosshair: {
        vertLine: { color: '#0ea5e9', width: 1, style: 3, labelBackgroundColor: '#0369a1' },
        horzLine: { color: '#0ea5e9', width: 1, style: 3, labelBackgroundColor: '#0369a1' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.08, bottom: 0.12 },
        autoScale: true,
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartInstanceRef.current = chart;

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
      autoscaleInfoProvider: (original: () => any) => {
        const res = original();
        if (res !== null && res.priceRange !== null) {
          const min = res.priceRange.minValue;
          const max = res.priceRange.maxValue;
          const delta = max - min;
          const buffer = delta > 0 ? delta * (antiClippingMargin / 100) : (max > 0 ? max * 0.02 : 1);
          return {
            priceRange: {
              minValue: Math.max(0, min - buffer),
              maxValue: max + buffer,
            },
            margins: { above: 24, below: 28 },
          };
        }
        return res;
      },
    });
    candleSeriesRef.current = candleSeries;

    // Moving Averages
    const ema20 = chart.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'EMA 20' });
    ema20SeriesRef.current = ema20;

    const ema50 = chart.addSeries(LineSeries, { color: '#0ea5e9', lineWidth: 2, title: 'EMA 50' });
    ema50SeriesRef.current = ema50;

    const bbUp = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, lineStyle: 2, title: 'BB Upper' });
    bbUpperRef.current = bbUp;

    const bbLow = chart.addSeries(LineSeries, { color: '#a855f7', lineWidth: 1, lineStyle: 2, title: 'BB Lower' });
    bbLowerRef.current = bbLow;

    const rsi = chart.addSeries(LineSeries, {
      color: '#ec4899',
      lineWidth: 2,
      priceScaleId: 'rsiScale',
      title: 'RSI 14',
    });
    rsi.priceScale().applyOptions({ scaleMargins: { top: 0.7, bottom: 0.05 } });
    rsiSeriesRef.current = rsi;

    // Visible range subscriber
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (isDisposedRef.current) return;
      updateVisibleRangeFromLogical(range);
      updateBracketCoordinates();
    });

    // Crosshair move subscriber
    chart.subscribeCrosshairMove((param) => {
      if (isDisposedRef.current) return;
      if (!param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }
      const data = param.seriesData.get(candleSeries) as any;
      if (data && data.open !== undefined) {
        setHoveredCandle({
          time: String(param.time),
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: 0,
        });
      }
    });

    // ResizeObserver safely handles container resizing
    const resizeObserver = new ResizeObserver((entries) => {
      if (isDisposedRef.current || !chartInstanceRef.current) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          setChartDimensions({ width, height });
          updateBracketCoordinates();
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      isDisposedRef.current = true;
      resizeObserver.disconnect();
      candleSeriesRef.current = null;
      ema20SeriesRef.current = null;
      ema50SeriesRef.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
      rsiSeriesRef.current = null;
      volumeSeriesRef.current = null;
      tpPriceLineRef.current = null;
      slPriceLineRef.current = null;
      entryPriceLineRef.current = null;
      runningPriceLineRef.current = null;
      priceLinesRef.current = [];
      const chartToDispose = chartInstanceRef.current;
      chartInstanceRef.current = null;
      if (chartToDispose) {
        setTimeout(() => {
          try {
            chartToDispose.remove();
          } catch (e) {
            // suppress disposal exception
          }
        }, 0);
      }
    };
  }, []);

  // Sync Candlestick & Indicator data to chart
  useEffect(() => {
    if (isDisposedRef.current || !candleSeriesRef.current || candles.length === 0) return;

    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    if (volumeSeriesRef.current) {
      const volData = getVolumeSeriesData(candles);
      volumeSeriesRef.current.setData(
        showVolume
          ? volData.map((d) => ({
              time: d.time as Time,
              value: d.value,
              color: d.color,
            }))
          : []
      );
    }

    if (ema20SeriesRef.current) {
      const ema20Data = calculateEMA(candles, 20);
      ema20SeriesRef.current.setData(
        showEMA20 ? ema20Data.map((d) => ({ time: d.time as Time, value: d.value })) : []
      );
    }

    if (ema50SeriesRef.current) {
      const ema50Data = calculateEMA(candles, 50);
      ema50SeriesRef.current.setData(
        showEMA50 ? ema50Data.map((d) => ({ time: d.time as Time, value: d.value })) : []
      );
    }

    if (bbUpperRef.current && bbLowerRef.current) {
      const bbData = calculateBollingerBands(candles, 20, 2);
      bbUpperRef.current.setData(
        showBB ? bbData.upper.map((d) => ({ time: d.time as Time, value: d.value })) : []
      );
      bbLowerRef.current.setData(
        showBB ? bbData.lower.map((d) => ({ time: d.time as Time, value: d.value })) : []
      );
    }

    if (rsiSeriesRef.current) {
      const rsiData = calculateRSI(candles, 14);
      rsiSeriesRef.current.setData(
        showRSI ? rsiData.map((d) => ({ time: d.time as Time, value: d.value })) : []
      );
    }

    if (chartInstanceRef.current) {
      chartInstanceRef.current.timeScale().fitContent();
      const logicalRange = chartInstanceRef.current.timeScale().getVisibleLogicalRange();
      updateVisibleRangeFromLogical(logicalRange);
      updateBracketCoordinates();
    }
  }, [candles, showVolume, showEMA20, showEMA50, showBB, showRSI, updateVisibleRangeFromLogical, updateBracketCoordinates]);

  // Synchronize and draw open position price lines onto the candlestick chart
  useEffect(() => {
    if (isDisposedRef.current || !candleSeriesRef.current) return;

    // Clear existing price lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeriesRef.current?.removePriceLine(line);
      } catch (err) {
        // ignore
      }
    });
    priceLinesRef.current = [];
    tpPriceLineRef.current = null;
    slPriceLineRef.current = null;
    entryPriceLineRef.current = null;
    runningPriceLineRef.current = null;

    if (!activePosition) return;

    const isLong = activePosition.side === 'LONG';

    // 1. POSITION ENTRY LINE ON CHART
    const entryLine = candleSeriesRef.current.createPriceLine({
      price: activePosition.entryPrice,
      color: isLong ? '#10b981' : '#f43f5e',
      lineWidth: 2,
      lineStyle: 0, // Solid line
      axisLabelVisible: true,
      title: `${activePosition.side} ${activePosition.qty} @ $${activePosition.entryPrice.toLocaleString()}`,
    });
    if (entryLine) {
      entryPriceLineRef.current = entryLine;
      priceLinesRef.current.push(entryLine);
    }

    // 2. RUNNING PROFIT / LOSS (MARK PRICE) LINE ON CHART
    const curPrice = activePosition.currentPrice || currentPrice;
    if (curPrice > 0) {
      const isProfit = activePosition.unrealizedPnl >= 0;
      const runningLine = candleSeriesRef.current.createPriceLine({
        price: curPrice,
        color: isProfit ? '#10b981' : '#f43f5e',
        lineWidth: 2,
        lineStyle: 1, // Dotted
        axisLabelVisible: true,
        title: `${isProfit ? 'PROFIT +' : 'LOSS '}$${activePosition.unrealizedPnl.toFixed(2)} (${isProfit ? '+' : ''}${activePosition.unrealizedPnlPercent}%)`,
      });
      if (runningLine) {
        runningPriceLineRef.current = runningLine;
        priceLinesRef.current.push(runningLine);
      }
    }

    // 3. TARGET (TP) LINE (Emerald dashed line)
    const effectiveTP = dragLivePrice && isDraggingBracket === 'TP' ? dragLivePrice : activeTP;
    if (effectiveTP && effectiveTP > 0) {
      const tpLine = candleSeriesRef.current.createPriceLine({
        price: effectiveTP,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2, // Dashed line
        axisLabelVisible: true,
        title: `🎯 TARGET TP $${effectiveTP.toLocaleString()}`,
      });
      if (tpLine) {
        tpPriceLineRef.current = tpLine;
        priceLinesRef.current.push(tpLine);
      }
    }

    // 4. STOP LOSS (SL) LINE (Rose dashed line)
    const effectiveSL = dragLivePrice && isDraggingBracket === 'SL' ? dragLivePrice : activeSL;
    if (effectiveSL && effectiveSL > 0) {
      const slLine = candleSeriesRef.current.createPriceLine({
        price: effectiveSL,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: 2, // Dashed line
        axisLabelVisible: true,
        title: `🛑 STOP LOSS $${effectiveSL.toLocaleString()}`,
      });
      if (slLine) {
        slPriceLineRef.current = slLine;
        priceLinesRef.current.push(slLine);
      }
    }

    // 5. LIQUIDATION LINE (Amber dotted line)
    if (activePosition.liquidationPrice && activePosition.liquidationPrice > 0) {
      const liqLine = candleSeriesRef.current.createPriceLine({
        price: activePosition.liquidationPrice,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: `LIQ $${activePosition.liquidationPrice.toLocaleString()}`,
      });
      if (liqLine) priceLinesRef.current.push(liqLine);
    }

    updateBracketCoordinates();

    return () => {
      priceLinesRef.current.forEach((line) => {
        try {
          candleSeriesRef.current?.removePriceLine(line);
        } catch (err) {
          // ignore
        }
      });
      priceLinesRef.current = [];
    };
  }, [activePosition, currentPrice, activeTP, activeSL, dragLivePrice, isDraggingBracket, candles, updateBracketCoordinates]);

  // DRAG TARGET (TP) & STOP LOSS (SL) HANDLERS WITH INSTANT CANVAS + API SYNCHRONIZATION
  const startDraggingBracket = (type: 'TP' | 'SL', e: React.MouseEvent | React.TouchEvent, initialPrice?: number) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingBracket(type);

    let latestCalculatedPrice: number | null = initialPrice ?? (type === 'TP' ? activeTP : activeSL);

    // If starting a drag for a new bracket, ensure a priceLine exists in Lightweight Charts
    if (!tpPriceLineRef.current && type === 'TP' && candleSeriesRef.current && latestCalculatedPrice) {
      const line = candleSeriesRef.current.createPriceLine({
        price: latestCalculatedPrice,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `🎯 TARGET TP $${latestCalculatedPrice.toLocaleString()}`,
      });
      if (line) {
        tpPriceLineRef.current = line;
        priceLinesRef.current.push(line);
      }
    } else if (!slPriceLineRef.current && type === 'SL' && candleSeriesRef.current && latestCalculatedPrice) {
      const line = candleSeriesRef.current.createPriceLine({
        price: latestCalculatedPrice,
        color: '#f43f5e',
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `🛑 STOP LOSS $${latestCalculatedPrice.toLocaleString()}`,
      });
      if (line) {
        slPriceLineRef.current = line;
        priceLinesRef.current.push(line);
      }
    }

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (isDisposedRef.current || !chartContainerRef.current || !candleSeriesRef.current) return;
      const clientY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const relativeY = Math.max(10, Math.min(rect.height - 20, clientY - rect.top));
      const newPrice = candleSeriesRef.current.coordinateToPrice(relativeY);

      if (newPrice && newPrice > 0) {
        const cleanPrice = Number(newPrice.toFixed(2));
        latestCalculatedPrice = cleanPrice;
        setDragLivePrice(cleanPrice);

        // 1. Instantly sync HTML handle coordinates for 60fps tracking
        if (type === 'TP') {
          setTpCoordY(Math.round(relativeY));
          setActiveTP(cleanPrice);

          // 2. Direct Lightweight Charts native canvas update for live price axis tag
          if (tpPriceLineRef.current) {
            tpPriceLineRef.current.applyOptions({
              price: cleanPrice,
              title: `🎯 TP $${cleanPrice.toLocaleString()}`,
            });
          }
        } else {
          setSlCoordY(Math.round(relativeY));
          setActiveSL(cleanPrice);

          // 2. Direct Lightweight Charts native canvas update for live price axis tag
          if (slPriceLineRef.current) {
            slPriceLineRef.current.applyOptions({
              price: cleanPrice,
              title: `🛑 SL $${cleanPrice.toLocaleString()}`,
            });
          }
        }
      }
    };

    const onEnd = async () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);

      const finalPrice = latestCalculatedPrice;

      if (activePosition && onUpdateTPSL && finalPrice && finalPrice > 0) {
        try {
          if (type === 'TP') {
            await onUpdateTPSL(
              activePosition.id,
              activePosition.stopLoss,
              finalPrice,
              activePosition.trailingStopPercent,
              activePosition.isTrailingStop
            );
            setApiToast({
              message: `Updated Target (TP) to $${finalPrice.toLocaleString()} via API ✓`,
              type: 'success',
            });
          } else {
            await onUpdateTPSL(
              activePosition.id,
              finalPrice,
              activePosition.takeProfit,
              activePosition.trailingStopPercent,
              activePosition.isTrailingStop
            );
            setApiToast({
              message: `Updated Stop Loss (SL) to $${finalPrice.toLocaleString()} via API ✓`,
              type: 'success',
            });
          }
          setTimeout(() => setApiToast(null), 3500);
        } catch (err: any) {
          setApiToast({
            message: err.message || 'Failed to update bracket via API',
            type: 'error',
          });
          setTimeout(() => setApiToast(null), 4000);
        }
      }

      setIsDraggingBracket(null);
      setDragLivePrice(null);
      updateBracketCoordinates();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  };

  // Add Default Bracket if None Exists
  const handleAddDefaultBracket = async (type: 'TP' | 'SL') => {
    if (!activePosition) return;
    const isLong = activePosition.side === 'LONG';
    const entry = activePosition.entryPrice;

    if (type === 'TP') {
      const defaultTP = Number((isLong ? entry * 1.035 : entry * 0.965).toFixed(2));
      setActiveTP(defaultTP);
      if (onUpdateTPSL) {
        await onUpdateTPSL(
          activePosition.id,
          activePosition.stopLoss,
          defaultTP,
          activePosition.trailingStopPercent,
          activePosition.isTrailingStop
        );
        setApiToast({ message: `Target TP added at $${defaultTP.toLocaleString()} via API ✓`, type: 'success' });
        setTimeout(() => setApiToast(null), 3000);
      }
    } else {
      const defaultSL = Number((isLong ? entry * 0.975 : entry * 1.025).toFixed(2));
      setActiveSL(defaultSL);
      if (onUpdateTPSL) {
        await onUpdateTPSL(
          activePosition.id,
          defaultSL,
          activePosition.takeProfit,
          activePosition.trailingStopPercent,
          activePosition.isTrailingStop
        );
        setApiToast({ message: `Stop Loss added at $${defaultSL.toLocaleString()} via API ✓`, type: 'success' });
        setTimeout(() => setApiToast(null), 3000);
      }
    }
  };

  // Nudge adjustment for brackets (+/- 0.5%)
  const handleNudgeBracket = async (type: 'TP' | 'SL', pctDelta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activePosition || !onUpdateTPSL) return;
    const currentVal = type === 'TP' ? activeTP : activeSL;
    if (!currentVal) return;

    const newVal = Number((currentVal * (1 + pctDelta / 100)).toFixed(2));
    if (type === 'TP') {
      setActiveTP(newVal);
      await onUpdateTPSL(
        activePosition.id,
        activePosition.stopLoss,
        newVal,
        activePosition.trailingStopPercent,
        activePosition.isTrailingStop
      );
      setApiToast({ message: `Target TP adjusted to $${newVal.toLocaleString()} via API ✓`, type: 'success' });
    } else {
      setActiveSL(newVal);
      await onUpdateTPSL(
        activePosition.id,
        newVal,
        activePosition.takeProfit,
        activePosition.trailingStopPercent,
        activePosition.isTrailingStop
      );
      setApiToast({ message: `Stop Loss adjusted to $${newVal.toLocaleString()} via API ✓`, type: 'success' });
    }
    setTimeout(() => setApiToast(null), 3000);
    updateBracketCoordinates();
  };

  // Remove bracket via API
  const handleRemoveBracket = async (type: 'TP' | 'SL', e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activePosition || !onUpdateTPSL) return;
    if (type === 'TP') {
      setActiveTP(null);
      setTpCoordY(null);
      await onUpdateTPSL(
        activePosition.id,
        activePosition.stopLoss,
        undefined,
        activePosition.trailingStopPercent,
        activePosition.isTrailingStop
      );
      setApiToast({ message: 'Target (TP) removed via API ✓', type: 'success' });
    } else {
      setActiveSL(null);
      setSlCoordY(null);
      await onUpdateTPSL(
        activePosition.id,
        undefined,
        activePosition.takeProfit,
        activePosition.trailingStopPercent,
        false
      );
      setApiToast({ message: 'Stop Loss (SL) removed via API ✓', type: 'success' });
    }
    setTimeout(() => setApiToast(null), 3000);
  };

  // Action: Auto-Fit Y-Axis to frame visible candlesticks
  const handleAutoFitYAxis = () => {
    if (isDisposedRef.current || !chartInstanceRef.current || !candleSeriesRef.current) return;
    const priceScale = candleSeriesRef.current.priceScale();
    priceScale.applyOptions({
      autoScale: true,
      scaleMargins: {
        top: antiClippingMargin / 100,
        bottom: (antiClippingMargin + 6) / 100,
      },
    });
    setIsYAutoScaleActive(true);
    const logicalRange = chartInstanceRef.current.timeScale().getVisibleLogicalRange();
    updateVisibleRangeFromLogical(logicalRange);
    updateBracketCoordinates();
  };

  const toggleYAutoScale = () => {
    if (isDisposedRef.current || !candleSeriesRef.current) return;
    const nextState = !isYAutoScaleActive;
    setIsYAutoScaleActive(nextState);
    candleSeriesRef.current.priceScale().applyOptions({ autoScale: nextState });
  };

  // Compute estimated profit/loss on dragged brackets
  const isPositionLong = activePosition?.side === 'LONG';
  const displayedTP = dragLivePrice && isDraggingBracket === 'TP' ? dragLivePrice : activeTP;
  const displayedSL = dragLivePrice && isDraggingBracket === 'SL' ? dragLivePrice : activeSL;

  const estTPProfit =
    activePosition && displayedTP
      ? (isPositionLong ? displayedTP - activePosition.entryPrice : activePosition.entryPrice - displayedTP) *
        activePosition.qty
      : 0;
  const estTPProfitPct =
    activePosition && displayedTP
      ? (((isPositionLong ? displayedTP - activePosition.entryPrice : activePosition.entryPrice - displayedTP) /
          activePosition.entryPrice) *
          100)
      : 0;

  const estSLLoss =
    activePosition && displayedSL
      ? (isPositionLong ? displayedSL - activePosition.entryPrice : activePosition.entryPrice - displayedSL) *
        activePosition.qty
      : 0;
  const estSLLossPct =
    activePosition && displayedSL
      ? (((isPositionLong ? displayedSL - activePosition.entryPrice : activePosition.entryPrice - displayedSL) /
          activePosition.entryPrice) *
          100)
      : 0;

  // Risk / Reward Ratio calculation
  const rewardDelta = activePosition && displayedTP ? Math.abs(displayedTP - activePosition.entryPrice) : 0;
  const riskDelta = activePosition && displayedSL ? Math.abs(activePosition.entryPrice - displayedSL) : 0;
  const riskRewardRatio = riskDelta > 0 && rewardDelta > 0 ? (rewardDelta / riskDelta).toFixed(2) : null;

  return (
    <div className="flex flex-col h-full min-h-[580px] bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden select-none relative">
      {/* Top Toolbar: Instrument, Live Price, Timeframes & Auto-Scale Y Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {/* Symbol Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Instrument</span>
            <select
              value={selectedSymbol}
              onChange={(e) => onSymbolChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
            >
              <optgroup label="Cryptocurrency (Live Feeds)">
                <option value="BTC/USDT">BTC/USDT · Bitcoin</option>
                <option value="ETH/USDT">ETH/USDT · Ethereum</option>
                <option value="SOL/USDT">SOL/USDT · Solana</option>
                <option value="BNB/USDT">BNB/USDT · Binance Coin</option>
                <option value="XRP/USDT">XRP/USDT · Ripple</option>
                <option value="DOGE/USDT">DOGE/USDT · Dogecoin</option>
                <option value="ADA/USDT">ADA/USDT · Cardano</option>
                <option value="AVAX/USDT">AVAX/USDT · Avalanche</option>
                <option value="LINK/USDT">LINK/USDT · Chainlink</option>
              </optgroup>
              <optgroup label="Precious Metals (Spot Feeds)">
                <option value="XAU/USD">XAU/USD · Gold Spot</option>
                <option value="XAG/USD">XAG/USD · Silver Spot</option>
              </optgroup>
            </select>
          </div>

          {/* Current Live Price & Change */}
          <div className="flex items-baseline gap-2 pl-3 border-l border-slate-800 font-mono">
            <span className="text-base font-bold text-slate-100 tabular-nums">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`text-xs font-semibold tabular-nums flex items-center ${
                priceChange.change >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {priceChange.change >= 0 ? '+' : ''}
              {priceChange.change} ({priceChange.change >= 0 ? '+' : ''}
              {priceChange.pct}%)
            </span>
          </div>

          {/* Timeframe Select */}
          <div className="hidden sm:flex items-center p-0.5 bg-slate-900 rounded border border-slate-800 text-[11px] font-mono">
            {(['15m', '1h', '4h', '1D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  timeframe === tf ? 'bg-slate-800 text-emerald-400 font-bold shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Indicator Toggles & Actions */}
        <div className="flex items-center gap-2">
          {/* Floating Placer Toggle */}
          <button
            onClick={() => setIsPlacerVisible(!isPlacerVisible)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded border transition-colors cursor-pointer ${
              isPlacerVisible
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Floating Order Placer widget"
          >
            <Zap className="w-3 h-3 text-emerald-400" />
            <span className="hidden md:inline">Order Placer</span>
          </button>

          {/* Indicators Bar */}
          <div className="hidden md:flex items-center gap-1.5 text-xs font-mono">
            <button
              onClick={() => setShowEMA20(!showEMA20)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                showEMA20 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              EMA 20
            </button>
            <button
              onClick={() => setShowEMA50(!showEMA50)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                showEMA50 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              EMA 50
            </button>
            <button
              onClick={() => setShowBB(!showBB)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                showBB ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              BB
            </button>
            <button
              onClick={() => setShowRSI(!showRSI)}
              className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                showRSI ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              RSI
            </button>
          </div>

          {/* Auto-Scale Y-Axis Button */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <button
              onClick={handleAutoFitYAxis}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs ${
                isYAutoScaleActive
                  ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
              title="Automatically fit Y-axis price scale to visible candlesticks range (prevents data clipping)"
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Auto-Scale Y</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative flex-1 min-h-[500px] w-full bg-[#090d16]">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Fetching real market candlestick data...</span>
            </div>
          </div>
        )}

        {/* Live API sync notification toast directly on chart */}
        {apiToast && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 bg-slate-950/95 border border-emerald-500/60 text-emerald-300 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono animate-in fade-in slide-in-from-top-2 duration-150">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{apiToast.message}</span>
          </div>
        )}

        {/* INTERACTIVE DRAGGABLE HORIZONTAL LINES OVERLAY FOR ACTIVE POSITIONS */}
        {activePosition && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {/* A. SHADED RUNNING PROFIT / LOSS CONNECTOR BAND BETWEEN ENTRY AND CURRENT PRICE */}
            {entryCoordY !== null && currentPriceCoordY !== null && (
              <div
                style={{
                  top: `${Math.min(entryCoordY, currentPriceCoordY)}px`,
                  height: `${Math.max(2, Math.abs(currentPriceCoordY - entryCoordY))}px`,
                }}
                className={`absolute left-0 right-14 pointer-events-none transition-all duration-75 border-y ${
                  activePosition.unrealizedPnl >= 0
                    ? 'bg-emerald-500/15 border-emerald-500/30'
                    : 'bg-rose-500/15 border-rose-500/30'
                }`}
              />
            )}

            {/* B. 1. POSITION ENTRY HORIZONTAL LINE & BADGE (With Direct "+ Drag TP" / "+ Drag SL" tabs) */}
            {entryCoordY !== null && entryCoordY > 0 && entryCoordY < chartDimensions.height && (
              <div
                style={{ top: `${entryCoordY}px` }}
                className="absolute left-0 right-14 flex items-center justify-between px-3 -translate-y-1/2 pointer-events-none"
              >
                {/* Horizontal Solid Guideline across full chart width */}
                <div
                  className={`absolute inset-x-0 border-t-2 ${
                    activePosition.side === 'LONG' ? 'border-emerald-500' : 'border-rose-500'
                  } -z-10`}
                />

                {/* Entry Badge */}
                <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/95 border border-slate-700 px-2.5 py-1 rounded-lg shadow-xl font-mono text-[11px]">
                  <span
                    className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                      activePosition.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {activePosition.side} {activePosition.qty} {activePosition.symbol}
                  </span>
                  <span className="text-slate-300">
                    Entry: ${activePosition.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {activePosition.leverage && (
                    <span className="text-[10px] px-1 bg-slate-800 text-slate-300 rounded font-semibold">
                      {activePosition.leverage}x Lev
                    </span>
                  )}
                </div>

                {/* Interactive Pull-Tabs to drag out new TP or SL directly from position line */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  {!activeTP && (
                    <div
                      onMouseDown={(e) => {
                        const initPrice = isPositionLong
                          ? Number((activePosition.entryPrice * 1.035).toFixed(2))
                          : Number((activePosition.entryPrice * 0.965).toFixed(2));
                        startDraggingBracket('TP', e, initPrice);
                      }}
                      onTouchStart={(e) => {
                        const initPrice = isPositionLong
                          ? Number((activePosition.entryPrice * 1.035).toFixed(2))
                          : Number((activePosition.entryPrice * 0.965).toFixed(2));
                        startDraggingBracket('TP', e, initPrice);
                      }}
                      className="cursor-ns-resize flex items-center gap-1 px-2.5 py-1 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 rounded-lg text-[10px] font-bold font-mono transition-all shadow-lg active:scale-95"
                      title="Click and drag up or down to set Target (TP) via API"
                    >
                      <Target className="w-3 h-3 text-emerald-400" />
                      <span>+ Drag TP ↕</span>
                    </div>
                  )}

                  {!activeSL && (
                    <div
                      onMouseDown={(e) => {
                        const initPrice = isPositionLong
                          ? Number((activePosition.entryPrice * 0.975).toFixed(2))
                          : Number((activePosition.entryPrice * 1.025).toFixed(2));
                        startDraggingBracket('SL', e, initPrice);
                      }}
                      onTouchStart={(e) => {
                        const initPrice = isPositionLong
                          ? Number((activePosition.entryPrice * 0.975).toFixed(2))
                          : Number((activePosition.entryPrice * 1.025).toFixed(2));
                        startDraggingBracket('SL', e, initPrice);
                      }}
                      className="cursor-ns-resize flex items-center gap-1 px-2.5 py-1 bg-rose-950/90 hover:bg-rose-900 border border-rose-500/60 text-rose-300 rounded-lg text-[10px] font-bold font-mono transition-all shadow-lg active:scale-95"
                      title="Click and drag up or down to set Stop Loss (SL) via API"
                    >
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>+ Drag SL ↕</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* C. 2. LINE OF RUNNING PROFIT / LOSS (AT CURRENT PRICE) */}
            {currentPriceCoordY !== null && currentPriceCoordY > 0 && currentPriceCoordY < chartDimensions.height && (
              <div
                style={{ top: `${currentPriceCoordY}px` }}
                className="absolute left-0 right-14 flex items-center justify-between px-3 -translate-y-1/2 pointer-events-none"
              >
                {/* Glowing Running PnL Guideline */}
                <div
                  className={`absolute inset-x-0 border-t-2 ${
                    activePosition.unrealizedPnl >= 0
                      ? 'border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                      : 'border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                  } -z-10`}
                />

                {/* Running PnL Live Badge */}
                <div
                  className={`pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-lg font-mono text-xs shadow-2xl backdrop-blur-md border ${
                    activePosition.unrealizedPnl >= 0
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                      : 'bg-rose-950/95 border-rose-400 text-rose-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-ping"
                    style={{ backgroundColor: activePosition.unrealizedPnl >= 0 ? '#10b981' : '#f43f5e' }}
                  />
                  <span className="font-extrabold tracking-wide">
                    {activePosition.unrealizedPnl >= 0 ? '▲ RUNNING PROFIT' : '▼ RUNNING LOSS'}:
                  </span>
                  <span className="font-bold tabular-nums text-white">
                    {activePosition.unrealizedPnl >= 0 ? '+' : ''}${activePosition.unrealizedPnl.toFixed(2)}
                    {' '}({activePosition.unrealizedPnlPercent >= 0 ? '+' : ''}{activePosition.unrealizedPnlPercent}%)
                  </span>
                  <span className="text-slate-400 text-[10px] hidden sm:inline">
                    @ ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {onClosePosition && (
                    <button
                      onClick={() => onClosePosition(activePosition.id)}
                      className="px-1.5 py-0.5 bg-rose-500/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded text-[10px] font-bold cursor-pointer transition-colors ml-1 border border-rose-500/40"
                      title="Market close position at current price"
                    >
                      Close Market ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* D. 3. INTERACTIVE HORIZONTAL TARGET (TP) LINE & DRAG HANDLE (Updates via API) */}
            {tpCoordY !== null && tpCoordY > 0 && tpCoordY < chartDimensions.height && displayedTP && (
              <div
                style={{ top: `${tpCoordY}px` }}
                className="absolute left-0 right-14 flex items-center justify-end px-4 -translate-y-1/2 pointer-events-none"
              >
                {/* Horizontal Draggable Guideline across entire chart */}
                <div
                  onMouseDown={(e) => startDraggingBracket('TP', e)}
                  onTouchStart={(e) => startDraggingBracket('TP', e)}
                  className="absolute inset-x-0 h-5 -translate-y-1/2 cursor-ns-resize pointer-events-auto flex items-center group/line"
                  title="Click & drag line up or down to update Target (TP) via API"
                >
                  <div className="w-full border-t-2 border-dashed border-emerald-400 group-hover/line:border-emerald-300 group-hover/line:border-solid transition-colors" />
                </div>

                {/* Draggable Handle Pill with Live PnL, R:R & Nudge Controls */}
                <div
                  onMouseDown={(e) => startDraggingBracket('TP', e)}
                  onTouchStart={(e) => startDraggingBracket('TP', e)}
                  className="pointer-events-auto cursor-ns-resize flex items-center gap-2 px-3 py-1.5 bg-emerald-950/98 hover:bg-emerald-900 border-2 border-emerald-400 hover:border-emerald-300 text-emerald-200 rounded-xl shadow-2xl font-mono text-xs transition-transform active:scale-95 group select-none ring-2 ring-emerald-500/30"
                  title="Drag up or down to adjust Take Profit value via API"
                >
                  <Target className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="font-bold text-white">TARGET (TP): ${displayedTP.toLocaleString()}</span>
                  <span className="text-[11px] font-semibold text-emerald-300 tabular-nums">
                    ({estTPProfit >= 0 ? '+' : ''}${estTPProfit.toFixed(2)} | {estTPProfitPct >= 0 ? '+' : ''}{estTPProfitPct.toFixed(2)}%)
                  </span>

                  {riskRewardRatio && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded font-bold">
                      R:R {riskRewardRatio}x
                    </span>
                  )}

                  {/* Nudge Buttons */}
                  <div className="flex items-center gap-0.5 pl-1 border-l border-emerald-500/40">
                    <button
                      onClick={(e) => handleNudgeBracket('TP', -0.5, e)}
                      className="px-1 py-0.2 bg-emerald-900/60 hover:bg-emerald-800 rounded text-[9px] text-emerald-300 cursor-pointer"
                      title="Nudge TP down by 0.5%"
                    >
                      -0.5%
                    </button>
                    <button
                      onClick={(e) => handleNudgeBracket('TP', 0.5, e)}
                      className="px-1 py-0.2 bg-emerald-900/60 hover:bg-emerald-800 rounded text-[9px] text-emerald-300 cursor-pointer"
                      title="Nudge TP up by 0.5%"
                    >
                      +0.5%
                    </button>
                  </div>

                  <div className="flex items-center gap-1 pl-1 border-l border-emerald-500/40 text-[10px] text-emerald-400 font-bold">
                    <MoveVertical className="w-3 h-3" />
                    <span>DRAG ↕</span>
                  </div>

                  <button
                    onClick={(e) => handleRemoveBracket('TP', e)}
                    className="p-0.5 hover:bg-emerald-800 text-emerald-400 hover:text-white rounded cursor-pointer ml-0.5"
                    title="Remove Take Profit bracket via API"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* E. 4. INTERACTIVE HORIZONTAL STOP LOSS (SL) LINE & DRAG HANDLE (Updates via API) */}
            {slCoordY !== null && slCoordY > 0 && slCoordY < chartDimensions.height && displayedSL && (
              <div
                style={{ top: `${slCoordY}px` }}
                className="absolute left-0 right-14 flex items-center justify-end px-4 -translate-y-1/2 pointer-events-none"
              >
                {/* Horizontal Draggable Guideline across entire chart */}
                <div
                  onMouseDown={(e) => startDraggingBracket('SL', e)}
                  onTouchStart={(e) => startDraggingBracket('SL', e)}
                  className="absolute inset-x-0 h-5 -translate-y-1/2 cursor-ns-resize pointer-events-auto flex items-center group/line"
                  title="Click & drag line up or down to update Stop Loss (SL) via API"
                >
                  <div className="w-full border-t-2 border-dashed border-rose-500 group-hover/line:border-rose-400 group-hover/line:border-solid transition-colors" />
                </div>

                {/* Draggable Handle Pill with Live Loss & Nudge Controls */}
                <div
                  onMouseDown={(e) => startDraggingBracket('SL', e)}
                  onTouchStart={(e) => startDraggingBracket('SL', e)}
                  className="pointer-events-auto cursor-ns-resize flex items-center gap-2 px-3 py-1.5 bg-rose-950/98 hover:bg-rose-900 border-2 border-rose-400 hover:border-rose-300 text-rose-200 rounded-xl shadow-2xl font-mono text-xs transition-transform active:scale-95 group select-none ring-2 ring-rose-500/30"
                  title="Drag up or down to adjust Stop Loss value via API"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span className="font-bold text-white">STOP LOSS (SL): ${displayedSL.toLocaleString()}</span>
                  <span className="text-[11px] font-semibold text-rose-300 tabular-nums">
                    ({estSLLoss <= 0 ? '' : '+'}${estSLLoss.toFixed(2)} | {estSLLossPct.toFixed(2)}%)
                  </span>

                  {/* Nudge Buttons */}
                  <div className="flex items-center gap-0.5 pl-1 border-l border-rose-500/40">
                    <button
                      onClick={(e) => handleNudgeBracket('SL', -0.5, e)}
                      className="px-1 py-0.2 bg-rose-900/60 hover:bg-rose-800 rounded text-[9px] text-rose-300 cursor-pointer"
                      title="Nudge SL down by 0.5%"
                    >
                      -0.5%
                    </button>
                    <button
                      onClick={(e) => handleNudgeBracket('SL', 0.5, e)}
                      className="px-1 py-0.2 bg-rose-900/60 hover:bg-rose-800 rounded text-[9px] text-rose-300 cursor-pointer"
                      title="Nudge SL up by 0.5%"
                    >
                      +0.5%
                    </button>
                  </div>

                  <div className="flex items-center gap-1 pl-1 border-l border-rose-500/40 text-[10px] text-rose-400 font-bold">
                    <MoveVertical className="w-3 h-3" />
                    <span>DRAG ↕</span>
                  </div>

                  <button
                    onClick={(e) => handleRemoveBracket('SL', e)}
                    className="p-0.5 hover:bg-rose-800 text-rose-400 hover:text-white rounded cursor-pointer ml-0.5"
                    title="Remove Stop Loss bracket via API"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Active Position HUD on Chart Canvas */}
        {activePosition && (
          <div className="absolute bottom-6 left-4 z-30 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3.5 py-2.5 bg-slate-950/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono">
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
      </div>

      {/* Floating Order Placer Widget (Portaled to document.body, free to float inside or outside chart) */}
      {isPlacerVisible && onExecuteOrder && (
        <FloatingOrderPlacer
          symbol={selectedSymbol}
          currentPrice={currentPrice}
          availableFunds={availableFunds}
          tradingMode={tradingMode}
          activePosition={activePosition}
          onExecuteOrder={onExecuteOrder}
          onClosePosition={onClosePosition}
          onUpdateTPSL={onUpdateTPSL}
          onCloseWidget={() => setIsPlacerVisible(false)}
        />
      )}
    </div>
  );
};
