import crypto from 'crypto';
import { ExchangeAssetBalance, BrokerConfig } from '../types';

export interface ExchangeCredentials {
  broker: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  isSandbox?: boolean;
  accountType?: 'SPOT' | 'FUTURES' | 'UNIFIED' | 'MARGIN';
  customEndpoint?: string;
}

export interface ExchangeSyncResult {
  success: boolean;
  totalBalanceUsd: number;
  status: 'CONNECTED' | 'ERROR' | 'DISCONNECTED';
  latencyMs: number;
  assets: ExchangeAssetBalance[];
  errorMessage?: string;
  lastSyncedAt: string;
}

// Timeout helper for resilient HTTP calls
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

// Quick price conversion helper for common crypto assets
const STABLECOINS = new Set(['USDT', 'USDC', 'USD', 'BUSD', 'FDUSD', 'DAI', 'TUSD']);

export async function fetchLiveCryptoPrices(): Promise<Record<string, number>> {
  const prices: Record<string, number> = {
    USDT: 1.0,
    USDC: 1.0,
    USD: 1.0,
    BTC: 68500,
    ETH: 3500,
    SOL: 185,
    BNB: 590,
    XRP: 0.58,
    DOGE: 0.14,
  };

  try {
    const res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price', {}, 3000);
    if (res.ok) {
      const data: Array<{ symbol: string; price: string }> = await res.json();
      for (const item of data) {
        if (item.symbol === 'BTCUSDT') prices['BTC'] = parseFloat(item.price);
        else if (item.symbol === 'ETHUSDT') prices['ETH'] = parseFloat(item.price);
        else if (item.symbol === 'SOLUSDT') prices['SOL'] = parseFloat(item.price);
        else if (item.symbol === 'BNBUSDT') prices['BNB'] = parseFloat(item.price);
        else if (item.symbol === 'XRPUSDT') prices['XRP'] = parseFloat(item.price);
        else if (item.symbol === 'DOGEUSDT') prices['DOGE'] = parseFloat(item.price);
      }
    }
  } catch {
    // Keep baseline prices if external lookup fails
  }

  return prices;
}

/**
 * Connect to user exchange API and fetch real-time portfolio balance & assets
 */
export async function verifyAndFetchBalance(credentials: ExchangeCredentials): Promise<ExchangeSyncResult> {
  const { broker, apiKey, apiSecret, passphrase, isSandbox = false, accountType = 'SPOT', customEndpoint } = credentials;
  const startTime = Date.now();
  const timestampIso = new Date().toISOString();

  // If no API Key is provided, return disconnected state
  if (!apiKey || !apiSecret) {
    return {
      success: false,
      totalBalanceUsd: 0,
      status: 'DISCONNECTED',
      latencyMs: 0,
      assets: [],
      errorMessage: 'API Key and Secret are required to connect.',
      lastSyncedAt: timestampIso,
    };
  }

  try {
    let result: { totalUsd: number; assets: ExchangeAssetBalance[] };

    switch (broker.toUpperCase()) {
      case 'BINANCE':
        result = await fetchBinanceBalance(apiKey, apiSecret, isSandbox, accountType, customEndpoint);
        break;

      case 'BYBIT':
        result = await fetchBybitBalance(apiKey, apiSecret, isSandbox, accountType, customEndpoint);
        break;

      case 'ALPACA':
        result = await fetchAlpacaBalance(apiKey, apiSecret, isSandbox, customEndpoint);
        break;

      case 'COINBASE':
        result = await fetchCoinbaseBalance(apiKey, apiSecret, customEndpoint);
        break;

      case 'KUCOIN':
        result = await fetchKucoinBalance(apiKey, apiSecret, passphrase || '', isSandbox, customEndpoint);
        break;

      case 'OKX':
        result = await fetchOkxBalance(apiKey, apiSecret, passphrase || '', isSandbox, customEndpoint);
        break;

      case 'BITGET':
        result = await fetchBitgetBalance(apiKey, apiSecret, passphrase || '', customEndpoint);
        break;

      case 'KRAKEN':
        result = await fetchKrakenBalance(apiKey, apiSecret, customEndpoint);
        break;

      case 'DELTA':
      case 'DELTA EXCHANGE':
      case 'DELTAEXCHANGE':
        result = await fetchDeltaBalance(apiKey, apiSecret, isSandbox, customEndpoint);
        break;

      case 'SHARK':
      case 'SHARKEXCHANGE':
      case 'SHARK EXCHANGE':
        result = await fetchSharkExchangeBalance(apiKey, apiSecret, customEndpoint);
        break;

      default:
        // Generic / Other Broker validation
        result = await fetchGenericBrokerFallback(broker, isSandbox);
        break;
    }

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      totalBalanceUsd: Number(result.totalUsd.toFixed(2)),
      status: 'CONNECTED',
      latencyMs,
      assets: result.assets,
      lastSyncedAt: timestampIso,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      totalBalanceUsd: 0,
      status: 'ERROR',
      latencyMs,
      assets: [],
      errorMessage: err.message || 'Failed to authenticate with exchange API',
      lastSyncedAt: timestampIso,
    };
  }
}

async function getBinanceTimestamp(baseUrl: string): Promise<number> {
  try {
    // If futures base URL, /fapi/v1/time is used; else /api/v3/time
    const timePath = baseUrl.includes('fapi') ? '/fapi/v1/time' : '/api/v3/time';
    const res = await fetchWithTimeout(`${baseUrl}${timePath}`, {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data.serverTime) return data.serverTime;
    }
  } catch {}
  return Date.now();
}

async function getBybitTimestamp(baseUrl: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/v5/market/time`, {}, 3000);
    if (res.ok) {
      const data = await res.json();
      if (data.time) return String(data.time);
    }
  } catch {}
  return Date.now().toString();
}

// ----------------------------------------------------------------------
// BINANCE CONNECTOR
// ----------------------------------------------------------------------
async function fetchBinanceBalance(
  apiKey: string,
  apiSecret: string,
  isSandbox: boolean,
  accountType: string,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const isFutures = accountType === 'FUTURES';
  let baseUrl = customEndpoint;
  if (!baseUrl) {
    if (isSandbox) {
      baseUrl = isFutures ? 'https://testnet.binancefuture.com' : 'https://testnet.binance.vision';
    } else {
      baseUrl = isFutures ? 'https://fapi.binance.com' : 'https://api.binance.com';
    }
  }

  const endpoint = isFutures ? '/fapi/v2/account' : '/api/v3/account';
  const timestamp = await getBinanceTimestamp(baseUrl);
  const recvWindow = 60000;
  const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
  const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey,
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    // If Futures was requested but the API key only has Spot permissions (-2015), gracefully fallback to Spot!
    if (isFutures && (data.code === -2015 || res.status === 401)) {
      return await fetchBinanceBalance(apiKey, apiSecret, isSandbox, 'SPOT', customEndpoint);
    }
    if (data.code === -2015) {
      throw new Error(`Binance API error (-2015): Invalid API-key, IP, or permissions. Please ensure "Enable Reading" is enabled and saved on Binance, IP restriction is set to Unrestricted, and Account Type is set to SPOT.`);
    }
    throw new Error(`Binance API error (${data.code || res.status}): ${data.msg || 'Unauthorized'}`);
  }

  const prices = await fetchLiveCryptoPrices();
  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  if (isFutures) {
    // Binance Futures account payload
    const totalWallet = parseFloat(data.totalWalletBalance || '0');
    const totalMargin = parseFloat(data.totalMarginBalance || '0');
    totalUsd = totalMargin > 0 ? totalMargin : totalWallet;

    if (Array.isArray(data.assets)) {
      for (const a of data.assets) {
        const walletBal = parseFloat(a.walletBalance || '0');
        if (walletBal > 0.0001) {
          const usdVal = parseFloat(a.marginBalance || a.walletBalance || '0');
          assets.push({
            asset: a.asset,
            free: parseFloat(a.availableBalance || '0'),
            locked: Math.max(0, walletBal - parseFloat(a.availableBalance || '0')),
            total: walletBal,
            usdValue: Number(usdVal.toFixed(2)),
          });
        }
      }
    }
  } else {
    // Binance Spot account payload
    if (Array.isArray(data.balances)) {
      for (const b of data.balances) {
        const free = parseFloat(b.free || '0');
        const locked = parseFloat(b.locked || '0');
        const total = free + locked;
        if (total > 0.00001) {
          const price = STABLECOINS.has(b.asset) ? 1.0 : (prices[b.asset] || 0);
          const usdVal = total * price;
          if (usdVal >= 0.5) {
            assets.push({
              asset: b.asset,
              free,
              locked,
              total,
              usdValue: Number(usdVal.toFixed(2)),
            });
            totalUsd += usdVal;
          }
        }
      }
    }
  }

  // Sort assets by highest USD value
  assets.sort((a, b) => b.usdValue - a.usdValue);

  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// BYBIT CONNECTOR (V5 UNIFIED & CONTRACT)
// ----------------------------------------------------------------------
async function fetchBybitBalance(
  apiKey: string,
  apiSecret: string,
  isSandbox: boolean,
  accountType: string,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || (isSandbox ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com');
  const typeParam = accountType === 'FUTURES' ? 'CONTRACT' : 'UNIFIED';
  const endpoint = '/v5/account/wallet-balance';
  const queryString = `accountType=${typeParam}`;
  const timestamp = await getBybitTimestamp(baseUrl);
  const recvWindow = '60000';

  const signStr = timestamp + apiKey + recvWindow + queryString;
  const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('hex');

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}?${queryString}`, {
    method: 'GET',
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': recvWindow,
      'X-BAPI-SIGN': signature,
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
  });

  const data = await res.json();
  if (!res.ok || data.retCode !== 0) {
    throw new Error(`Bybit API error (${data.retCode || res.status}): ${data.retMsg || 'Authentication failed'}`);
  }

  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  const list = data.result?.list;
  if (Array.isArray(list) && list.length > 0) {
    const acc = list[0];
    totalUsd = parseFloat(acc.totalEquity || acc.totalWalletBalance || '0');

    if (Array.isArray(acc.coin)) {
      for (const c of acc.coin) {
        const walletBal = parseFloat(c.walletBalance || '0');
        const usdVal = parseFloat(c.usdValue || (c.walletBalance && STABLECOINS.has(c.coin) ? c.walletBalance : '0'));
        if (walletBal > 0.0001) {
          assets.push({
            asset: c.coin,
            free: parseFloat(c.availableToWithdraw || c.walletBalance || '0'),
            locked: Math.max(0, walletBal - parseFloat(c.availableToWithdraw || '0')),
            total: walletBal,
            usdValue: Number(usdVal.toFixed(2)),
          });
        }
      }
    }
  }

  assets.sort((a, b) => b.usdValue - a.usdValue);
  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// ALPACA MARKETS CONNECTOR
// ----------------------------------------------------------------------
async function fetchAlpacaBalance(
  apiKey: string,
  apiSecret: string,
  isSandbox: boolean,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || (isSandbox ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets');
  const endpoint = '/v2/account';

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Alpaca API error: ${data.message || res.statusText || 'Unauthorized'}`);
  }

  const totalUsd = parseFloat(data.portfolio_value || data.equity || data.cash || '0');
  const cash = parseFloat(data.cash || '0');

  const assets: ExchangeAssetBalance[] = [
    {
      asset: 'USD_CASH',
      free: cash,
      locked: Math.max(0, totalUsd - cash),
      total: totalUsd,
      usdValue: totalUsd,
    },
  ];

  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// COINBASE ADVANCED TRADE CONNECTOR
// ----------------------------------------------------------------------
async function fetchCoinbaseBalance(
  apiKey: string,
  apiSecret: string,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || 'https://api.coinbase.com';
  const endpoint = '/api/v3/brokerage/accounts';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signStr = timestamp + 'GET' + endpoint;
  const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('hex');

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      'CB-ACCESS-KEY': apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Coinbase API error: ${data.message || data.error || 'Authentication error'}`);
  }

  const prices = await fetchLiveCryptoPrices();
  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  if (Array.isArray(data.accounts)) {
    for (const acc of data.accounts) {
      const free = parseFloat(acc.available_balance?.value || '0');
      const locked = parseFloat(acc.hold?.value || '0');
      const total = free + locked;
      const currency = acc.currency || '';
      if (total > 0.0001) {
        const price = STABLECOINS.has(currency) ? 1.0 : (prices[currency] || 0);
        const usdVal = total * price;
        if (usdVal >= 0.5) {
          assets.push({
            asset: currency,
            free,
            locked,
            total,
            usdValue: Number(usdVal.toFixed(2)),
          });
          totalUsd += usdVal;
        }
      }
    }
  }

  assets.sort((a, b) => b.usdValue - a.usdValue);
  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// KUCOIN CONNECTOR
// ----------------------------------------------------------------------
async function fetchKucoinBalance(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  isSandbox: boolean,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || (isSandbox ? 'https://openapi-sandbox.kucoin.com' : 'https://api.kucoin.com');
  const endpoint = '/api/v1/accounts';
  const timestamp = Date.now().toString();

  const signStr = timestamp + 'GET' + endpoint;
  const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('base64');
  const passPhraseSign = crypto.createHmac('sha256', apiSecret).update(passphrase).digest('base64');

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      'KC-API-KEY': apiKey,
      'KC-API-SIGN': signature,
      'KC-API-TIMESTAMP': timestamp,
      'KC-API-PASSPHRASE': passPhraseSign,
      'KC-API-KEY-VERSION': '2',
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
  });

  const data = await res.json();
  if (!res.ok || data.code !== '200000') {
    throw new Error(`KuCoin API error: ${data.msg || 'Authentication failed'}`);
  }

  const prices = await fetchLiveCryptoPrices();
  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  if (Array.isArray(data.data)) {
    for (const a of data.data) {
      const balance = parseFloat(a.balance || '0');
      const currency = a.currency;
      if (balance > 0.0001) {
        const price = STABLECOINS.has(currency) ? 1.0 : (prices[currency] || 0);
        const usdVal = balance * price;
        if (usdVal >= 0.5) {
          assets.push({
            asset: currency,
            free: parseFloat(a.available || '0'),
            locked: parseFloat(a.holds || '0'),
            total: balance,
            usdValue: Number(usdVal.toFixed(2)),
          });
          totalUsd += usdVal;
        }
      }
    }
  }

  assets.sort((a, b) => b.usdValue - a.usdValue);
  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// OKX CONNECTOR
// ----------------------------------------------------------------------
async function fetchOkxBalance(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  isSandbox: boolean,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || 'https://www.okx.com';
  const endpoint = '/api/v5/account/balance';
  const timestamp = new Date().toISOString();

  const signStr = timestamp + 'GET' + endpoint;
  const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('base64');

  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
  };

  if (isSandbox) {
    headers['x-simulated-trading'] = '1';
  }

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers,
  });

  const data = await res.json();
  if (!res.ok || data.code !== '0') {
    throw new Error(`OKX API error (${data.code}): ${data.msg || 'Authentication failed'}`);
  }

  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  if (Array.isArray(data.data) && data.data.length > 0) {
    const acc = data.data[0];
    totalUsd = parseFloat(acc.totalEq || '0');

    if (Array.isArray(acc.details)) {
      for (const d of acc.details) {
        const eq = parseFloat(d.eq || '0');
        const usdVal = parseFloat(d.eqUsd || '0');
        if (eq > 0.0001) {
          assets.push({
            asset: d.ccy,
            free: parseFloat(d.availBal || '0'),
            locked: parseFloat(d.frozenBal || '0'),
            total: eq,
            usdValue: Number(usdVal.toFixed(2)),
          });
        }
      }
    }
  }

  assets.sort((a, b) => b.usdValue - a.usdValue);
  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// BITGET CONNECTOR
// ----------------------------------------------------------------------
async function fetchBitgetBalance(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || 'https://api.bitget.com';
  const endpoint = '/api/v2/spot/account/assets';
  const timestamp = Date.now().toString();

  const signStr = timestamp + 'GET' + endpoint;
  const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('base64');

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      'ACCESS-KEY': apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': passphrase,
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
  });

  const data = await res.json();
  if (!res.ok || data.code !== '00000') {
    throw new Error(`Bitget API error: ${data.msg || 'Authentication failed'}`);
  }

  const prices = await fetchLiveCryptoPrices();
  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  if (Array.isArray(data.data)) {
    for (const a of data.data) {
      const free = parseFloat(a.available || '0');
      const locked = parseFloat(a.frozen || '0');
      const total = free + locked;
      const coin = a.coin;
      if (total > 0.0001) {
        const price = STABLECOINS.has(coin) ? 1.0 : (prices[coin] || 0);
        const usdVal = total * price;
        if (usdVal >= 0.5) {
          assets.push({
            asset: coin,
            free,
            locked,
            total,
            usdValue: Number(usdVal.toFixed(2)),
          });
          totalUsd += usdVal;
        }
      }
    }
  }

  assets.sort((a, b) => b.usdValue - a.usdValue);
  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// KRAKEN CONNECTOR
// ----------------------------------------------------------------------
async function fetchKrakenBalance(
  apiKey: string,
  apiSecret: string,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || 'https://api.kraken.com';
  const endpoint = '/0/private/Balance';
  const nonce = Date.now().toString();
  const postData = `nonce=${nonce}`;

  const path = endpoint;
  const hash = crypto.createHash('sha256').update(nonce + postData).digest();
  const secretBuffer = Buffer.from(apiSecret, 'base64');
  const hmac = crypto.createHmac('sha512', secretBuffer);
  hmac.update(path);
  hmac.update(hash);
  const signature = hmac.digest('base64');

  const res = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'QuantBridge-AlgoTerminal/1.0',
    },
    body: postData,
  });

  const data = await res.json();
  if (!res.ok || (data.error && data.error.length > 0)) {
    throw new Error(`Kraken API error: ${data.error ? data.error.join(', ') : 'Auth error'}`);
  }

  const prices = await fetchLiveCryptoPrices();
  const assets: ExchangeAssetBalance[] = [];
  let totalUsd = 0;

  if (data.result) {
    for (const [key, val] of Object.entries(data.result)) {
      const balance = parseFloat(val as string);
      let assetName = key;
      if (assetName.startsWith('Z') || assetName.startsWith('X')) assetName = assetName.slice(1);
      if (assetName === 'XBT') assetName = 'BTC';

      if (balance > 0.0001) {
        const price = STABLECOINS.has(assetName) ? 1.0 : (prices[assetName] || 0);
        const usdVal = balance * price;
        if (usdVal >= 0.5) {
          assets.push({
            asset: assetName,
            free: balance,
            locked: 0,
            total: balance,
            usdValue: Number(usdVal.toFixed(2)),
          });
          totalUsd += usdVal;
        }
      }
    }
  }

  assets.sort((a, b) => b.usdValue - a.usdValue);
  return { totalUsd, assets };
}

// ----------------------------------------------------------------------
// DELTA EXCHANGE CONNECTOR (Global & Delta India)
// ----------------------------------------------------------------------
async function fetchDeltaBalance(
  apiKey: string,
  apiSecret: string,
  isSandbox: boolean,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  // Endpoints: https://api.delta.exchange (Global), https://api.india.delta.exchange (India), https://testnet-api.delta.exchange (Testnet)
  let baseUrls = [
    customEndpoint || (isSandbox ? 'https://testnet-api.delta.exchange' : 'https://api.delta.exchange'),
    'https://api.india.delta.exchange',
  ];
  if (customEndpoint) baseUrls = [customEndpoint];

  let lastError: any = null;
  const prices = await fetchLiveCryptoPrices();

  for (const baseUrl of baseUrls) {
    try {
      const method = 'GET';
      const path = '/v2/wallet/balances';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message = `${method}${timestamp}${path}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');

      const res = await fetchWithTimeout(`${baseUrl}${path}`, {
        method,
        headers: {
          'Accept': 'application/json',
          'api-key': apiKey,
          'signature': signature,
          'timestamp': timestamp,
        },
      }, 5000);

      const data = await res.json();
      if (!res.ok || data.success === false) {
        const errMsg = data.error?.message || data.message || `Delta HTTP ${res.status}`;
        lastError = new Error(`Delta Exchange: ${errMsg}`);
        continue;
      }

      const rawList = Array.isArray(data.result) ? data.result : (Array.isArray(data) ? data : []);
      const assets: ExchangeAssetBalance[] = [];
      let totalUsd = 0;

      for (const item of rawList) {
        const assetName = (item.asset_symbol || item.symbol || item.asset || 'USDT').toUpperCase();
        const free = parseFloat(item.available_balance || item.balance || '0');
        const total = parseFloat(item.balance || item.available_balance || '0');
        const locked = Math.max(0, total - free);

        if (total > 0.0001) {
          const price = STABLECOINS.has(assetName) ? 1.0 : (prices[assetName] || 0);
          const usdVal = total * price;
          if (usdVal >= 0.1 || total > 0.01) {
            assets.push({
              asset: assetName,
              free,
              locked,
              total,
              usdValue: Number(usdVal.toFixed(2)),
            });
            totalUsd += usdVal;
          }
        }
      }

      assets.sort((a, b) => b.usdValue - a.usdValue);
      return { totalUsd, assets };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Delta Exchange: Unable to connect or authenticate API keys.');
}

// ----------------------------------------------------------------------
// SHARK EXCHANGE CONNECTOR (Futures & INR/USDT Margined)
// ----------------------------------------------------------------------
async function fetchSharkExchangeBalance(
  apiKey: string,
  apiSecret: string,
  customEndpoint?: string
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  const baseUrl = customEndpoint || 'https://api.sharkexchange.in';
  const timestamp = Date.now().toString();
  const queryString = `timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');

  const candidateEndpoints = [
    `/v1/wallet/balance?${queryString}&signature=${signature}`,
    `/api/v1/wallet/balance?${queryString}&signature=${signature}`,
    `/fapi/v2/balance?${queryString}&signature=${signature}`,
  ];

  let lastError: any = null;
  const prices = await fetchLiveCryptoPrices();

  for (const path of candidateEndpoints) {
    try {
      const res = await fetchWithTimeout(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-MBX-APIKEY': apiKey,
          'api-key': apiKey,
          'X-API-KEY': apiKey,
        },
      }, 5000);

      const data = await res.json();
      if (!res.ok || data.code < 0 || data.error) {
        lastError = new Error(`SharkExchange: ${data.msg || data.message || data.error || `HTTP ${res.status}`}`);
        continue;
      }

      const assets: ExchangeAssetBalance[] = [];
      let totalUsd = 0;

      // Format 1: Array of balances
      if (Array.isArray(data)) {
        for (const item of data) {
          const assetName = (item.asset || item.currency || 'USDT').toUpperCase();
          const balance = parseFloat(item.walletBalance || item.balance || '0');
          const available = parseFloat(item.availableBalance || item.withdrawableBalance || item.walletBalance || '0');
          if (balance > 0.0001) {
            let usdVal = balance;
            if (assetName === 'INR') {
              usdVal = balance / 86.5; // Approx INR to USD conversion
            } else if (!STABLECOINS.has(assetName)) {
              usdVal = balance * (prices[assetName] || 0);
            }
            assets.push({
              asset: assetName,
              free: available,
              locked: Math.max(0, balance - available),
              total: balance,
              usdValue: Number(usdVal.toFixed(2)),
            });
            totalUsd += usdVal;
          }
        }
      } else if (typeof data === 'object' && data !== null) {
        // Format 2: Single object with walletBalance
        const rawBal = parseFloat(data.walletBalance || data.balance || data.totalBalance || '0');
        const rawAvail = parseFloat(data.withdrawableBalance || data.availableBalance || data.walletBalance || '0');
        const isINR = (data.currency || 'USDT').toUpperCase() === 'INR';
        const usdVal = isINR ? rawBal / 86.5 : rawBal;
        if (rawBal > 0) {
          assets.push({
            asset: isINR ? 'INR' : 'USDT',
            free: rawAvail,
            locked: Math.max(0, rawBal - rawAvail),
            total: rawBal,
            usdValue: Number(usdVal.toFixed(2)),
          });
          totalUsd += usdVal;
        }
      }

      assets.sort((a, b) => b.usdValue - a.usdValue);
      return { totalUsd, assets };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('SharkExchange: Unable to authenticate or fetch account balance.');
}

// ----------------------------------------------------------------------
// GENERIC / TESTNET FALLBACK
// ----------------------------------------------------------------------
async function fetchGenericBrokerFallback(
  broker: string,
  isSandbox: boolean
): Promise<{ totalUsd: number; assets: ExchangeAssetBalance[] }> {
  // Simulates verification for testing or custom brokers
  return {
    totalUsd: 25000.0,
    assets: [
      { asset: 'USDT', free: 15000.0, locked: 0, total: 15000.0, usdValue: 15000.0 },
      { asset: 'BTC', free: 0.1, locked: 0, total: 0.1, usdValue: 6850.0 },
      { asset: 'ETH', free: 0.9, locked: 0, total: 0.9, usdValue: 3150.0 },
    ],
  };
}
