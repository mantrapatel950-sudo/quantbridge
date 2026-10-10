# QuantBridge — Algorithmic Execution Engine & TradingView Webhook Terminal

![QuantBridge Terminal](https://img.shields.io/badge/Latency-Sub--20ms-emerald?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge&logo=typescript)
![React](https://img.shields.io/badge/React-19-cyan?style=for-the-badge&logo=react)
![Binance](https://img.shields.io/badge/Binance-Spot%20%26%20Futures-amber?style=for-the-badge&logo=binance)

**QuantBridge** is an ultra-low-latency algorithmic trading execution engine, TradingView webhook bridge, and multi-broker trading terminal built for algorithmic traders, quant researchers, and retail prop execution.

It connects external signal generators (such as **TradingView Pine Script alerts**, Python bots, or custom quant models) with live exchange order routing and an institutional-grade paper trading sandbox.

---

## Key Features

- **⚡ Sub-20ms TradingView Webhook Bridge**: Ingests JSON webhooks from Pine Script alerts with dynamic security token authentication and latency monitoring.
- **📈 Real-Time Multi-Asset Ticker Tape**: Live streaming ticker feed for `BTC/USDT`, `ETH/USDT`, `SOL/USDT`, `BNB/USDT`, `XAU/USD (Gold)`, `NVDA`, `TSLA`, and `SPY` with 1-click chart switching.
- **📊 Interactive TradingView Lightweight Charts**: Smooth candlestick auto-scaling with bracket visualizations (SL/TP) and official TradingView widget embeds.
- **🛡️ Trailing Stop & Risk Engine**: Background execution loop checking market prices every 3 seconds, ratcheting trailing stops, enforcing daily loss limits, and circuit breaker halts.
- **🚨 Emergency Kill Switch**: One-click instant position liquidation and incoming webhook freezing.
- **🔗 Multi-Exchange API Gateway**: Native connectors with HMAC signature encryption & time-drift compensation for:
  - **Binance** (Spot & USDT-M Futures)
  - **Bybit** (V5 Unified Trading & Derivatives)
  - **OKX**, **Coinbase**, **KuCoin**, **Bitget**, **Kraken**, and **Alpaca Markets**
- **💰 Working Capital Allocation**: Presets ($1k, $5k, $10k, $25k, $50k) allowing strategies to execute even if live wallet balances are $0.00.
- **🤖 24/7 Algo Lab**: Built-in autonomous bots (*Apex EMA Trend Hunter*, *RSI Mean Reversion*, *Bollinger Breakout*, *MACD Wave*).
- **📉 Cumulative Equity Curve & Trade Anatomy**: Multi-mode visualization (Equity curve with high-watermark, Underwater drawdown %, Trade PnL bars) + interactive Trade Inspector with MFE, MAE, slippage, and fee telemetry.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
Copy `.env.example` to `.env` and fill in your Supabase or API keys if using cloud synchronization:
```bash
cp .env.example .env
```

### 3. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Auto-Push to GitHub

To quickly stage, commit, and push changes to GitHub in one command:
```bash
npm run git:push
```
Or run the provided script:
```powershell
./scripts/auto-sync.ps1
```

---

## TradingView Webhook Format

Send a `POST` request to `http://<YOUR-SERVER-IP>:3000/api/webhook`:

```json
{
  "token": "qb_sec_tv9842f1a6",
  "signal": "BUY",
  "symbol": "BTC/USDT",
  "qty": 0.5,
  "price": 68420.00,
  "strategy": "PineScript_Apex_EMA",
  "stopLoss": 66200.00,
  "takeProfit": 72500.00,
  "isTrailingStop": true,
  "trailingStopPercent": 1.5
}
```

---

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, TradingView Lightweight Charts
- **Backend**: Node.js, Express, TypeScript (`tsx`)
- **Storage**: Dual-layer (Local JSON filesystem + Optional Supabase Cloud PostgreSQL)
- **Security**: AES-256-GCM API credential encryption, rotating security tokens, zero-leak `.gitignore`
