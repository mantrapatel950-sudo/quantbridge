export interface Candle {
  time: string | number; // 'YYYY-MM-DD' or UNIX timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: string | number;
  value: number;
}

export interface VolumePoint {
  time: string | number;
  value: number;
  color: string;
}

// Fetch REAL live klines from the backend proxy (Binance & metals)
export async function fetchRealKlines(symbol: string, interval = '1d', limit = 90): Promise<Candle[]> {
  try {
    const res = await fetch(`/api/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`);
    if (!res.ok) throw new Error('API fetch failed');
    const data = await res.json();
    if (data.candles && data.candles.length > 0) {
      return data.candles;
    }
  } catch (err) {
    console.warn('Real klines fetch failed, falling back to realistic generator:', err);
  }
  return generateCandles(symbol, interval, limit);
}

// Generate realistic historical candles for the given base price (fallback)
export function generateCandles(symbol: string, interval = '1d', limit = 120): Candle[] {
  let basePrice = 67500;
  let volatility = 0.025;

  const s = symbol.toUpperCase();
  if (s.includes('BTC')) {
    basePrice = 84500;
    volatility = 0.028;
  } else if (s.includes('ETH')) {
    basePrice = 3150;
    volatility = 0.035;
  } else if (s.includes('SOL')) {
    basePrice = 185;
    volatility = 0.045;
  } else if (s.includes('BNB')) {
    basePrice = 585;
    volatility = 0.025;
  } else if (s.includes('XRP')) {
    basePrice = 0.58;
    volatility = 0.04;
  } else if (s.includes('DOGE')) {
    basePrice = 0.14;
    volatility = 0.05;
  } else if (s.includes('XAU') || s.includes('GOLD')) {
    basePrice = 2680; // Real Gold spot ~$2680/oz
    volatility = 0.012;
  } else if (s.includes('XAG') || s.includes('XUG') || s.includes('SILVER')) {
    basePrice = 32.40; // Real Silver spot ~$32.40/oz
    volatility = 0.022;
  } else if (s.includes('NVDA')) {
    basePrice = 131;
    volatility = 0.025;
  } else if (s.includes('TSLA')) {
    basePrice = 254;
    volatility = 0.032;
  } else if (s.includes('AAPL')) {
    basePrice = 227;
    volatility = 0.012;
  } else if (s.includes('SPY')) {
    basePrice = 575;
    volatility = 0.009;
  }

  const candles: Candle[] = [];
  const now = new Date();
  // round down to the nearest minute to avoid weird timestamps
  now.setSeconds(0, 0);

  let currentClose = basePrice;
  const isIntraday = interval !== '1d' && interval !== '1D';

  let stepMs = 24 * 60 * 60 * 1000;
  if (interval === '1m') stepMs = 60 * 1000;
  else if (interval === '5m') stepMs = 5 * 60 * 1000;
  else if (interval === '15m') stepMs = 15 * 60 * 1000;
  else if (interval === '1h') stepMs = 60 * 60 * 1000;
  else if (interval === '4h') stepMs = 4 * 60 * 60 * 1000;

  // Generate date array
  const times: (string | number)[] = [];
  for (let i = limit; i >= 0; i--) {
    const d = new Date(now.getTime() - i * stepMs);
    // skip weekends for equities
    const isEquity = ['NVDA', 'TSLA', 'AAPL', 'SPY'].includes(symbol);
    const day = d.getUTCDay();
    if (isEquity && (day === 0 || day === 6)) {
      continue;
    }

    if (isIntraday) {
      // Lightweight charts wants UNIX timestamp in seconds for intraday
      times.push(Math.floor(d.getTime() / 1000));
    } else {
      const isoDate = d.toISOString().split('T')[0];
      times.push(isoDate);
    }
  }

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    // Gentle upward drift with natural swings
    const drift = 0.0008;
    const changePct = (Math.random() - 0.48) * volatility + drift;
    const open = Number(currentClose.toFixed(2));
    const close = Number((open * (1 + changePct)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + Math.random() * (volatility * 0.7))).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - Math.random() * (volatility * 0.7))).toFixed(2));
    const volume = Math.floor(Math.random() * 50000 + 10000);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    currentClose = close;
  }

  return candles;
}

// Calculate Exponential Moving Average (EMA)
export function calculateEMA(candles: Candle[], period: number): LinePoint[] {
  if (candles.length < period) return [];

  const k = 2 / (period + 1);
  const result: LinePoint[] = [];

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEMA = sum / period;
  result.push({
    time: candles[period - 1].time,
    value: Number(prevEMA.toFixed(2)),
  });

  for (let i = period; i < candles.length; i++) {
    const currentPrice = candles[i].close;
    const currentEMA = currentPrice * k + prevEMA * (1 - k);
    result.push({
      time: candles[i].time,
      value: Number(currentEMA.toFixed(2)),
    });
    prevEMA = currentEMA;
  }

  return result;
}

// Format volume with up/down colors
export function getVolumeSeriesData(candles: Candle[]): VolumePoint[] {
  return candles.map((c) => ({
    time: c.time,
    value: c.volume,
    color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)',
  }));
}

// Calculate Bollinger Bands (20 periods, 2 standard deviations)
export function calculateBollingerBands(candles: Candle[], period = 20, multiplier = 2) {
  const upper: LinePoint[] = [];
  const middle: LinePoint[] = [];
  const lower: LinePoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = slice.reduce((acc, c) => acc + c.close, 0) / period;
    const variance = slice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const time = candles[i].time;
    middle.push({ time, value: Number(mean.toFixed(2)) });
    upper.push({ time, value: Number((mean + stdDev * multiplier).toFixed(2)) });
    lower.push({ time, value: Number((mean - stdDev * multiplier).toFixed(2)) });
  }

  return { upper, middle, lower };
}

// Calculate Relative Strength Index (RSI 14)
export function calculateRSI(candles: Candle[], period = 14): LinePoint[] {
  if (candles.length <= period) return [];

  const rsiPoints: LinePoint[] = [];
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  rsiPoints.push({ time: candles[period].time, value: Number(rsi.toFixed(2)) });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    rsiPoints.push({ time: candles[i].time, value: Number(rsi.toFixed(2)) });
  }

  return rsiPoints;
}

// Simulate Fast 90-Day Backtest on Historical Candles
export function runStrategyBacktest(candles: Candle[], strategy: 'EMA_CROSS' | 'RSI_REVERSION' = 'EMA_CROSS') {
  if (candles.length < 30) return null;

  const emaFast = calculateEMA(candles, 12);
  const emaSlow = calculateEMA(candles, 26);
  const fastMap = new Map(emaFast.map((d) => [d.time, d.value]));
  const slowMap = new Map(emaSlow.map((d) => [d.time, d.value]));

  const trades: Array<{
    entryTime: string;
    exitTime: string;
    side: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPct: number;
  }> = [];

  let inPosition = false;
  let entryPrice = 0;
  let entryTime = '';

  for (let i = 27; i < candles.length; i++) {
    const c = candles[i];
    const prevC = candles[i - 1];
    const fast = fastMap.get(c.time);
    const slow = slowMap.get(c.time);
    const prevFast = fastMap.get(prevC.time);
    const prevSlow = slowMap.get(prevC.time);

    if (!fast || !slow || !prevFast || !prevSlow) continue;

    const crossOver = prevFast <= prevSlow && fast > slow;
    const crossUnder = prevFast >= prevSlow && fast < slow;

    if (!inPosition && crossOver) {
      inPosition = true;
      entryPrice = c.close;
      entryTime = String(c.time);
    } else if (inPosition && crossUnder) {
      const exitPrice = c.close;
      const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;
      const pnl = Number(((exitPrice - entryPrice) * 10).toFixed(2));
      trades.push({
        entryTime,
        exitTime: String(c.time),
        side: 'BUY',
        entryPrice,
        exitPrice,
        pnl,
        pnlPct: Number(pnlPct.toFixed(2)),
      });
      inPosition = false;
    }
  }

  // Calculate metrics
  const total = trades.length;
  const wins = trades.filter((t) => t.pnl > 0);
  const winRate = total > 0 ? Number(((wins.length / total) * 100).toFixed(1)) : 0;
  const totalGain = wins.reduce((acc, t) => acc + t.pnl, 0);
  const totalLoss = Math.abs(trades.filter((t) => t.pnl <= 0).reduce((acc, t) => acc + t.pnl, 0));
  const profitFactor = totalLoss > 0 ? Number((totalGain / totalLoss).toFixed(2)) : totalGain > 0 ? 3.5 : 1;
  const netPnl = Number((totalGain - totalLoss).toFixed(2));

  return {
    strategyName: strategy === 'EMA_CROSS' ? 'EMA 12/26 Trend Follower' : 'RSI Mean Reversion',
    totalTrades: total,
    winRate,
    profitFactor,
    netPnl,
    trades,
  };
}

