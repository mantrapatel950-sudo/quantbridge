import React, { useState } from 'react';
import { WebhookLog } from '../types';
import { Copy, Check, Terminal, Play, RotateCw, ExternalLink, ShieldCheck, Zap, AlertCircle } from 'lucide-react';

interface Props {
  webhookSecret: string;
  webhookLogs: WebhookLog[];
  tradingMode: 'DEMO' | 'REAL';
  onRotateToken: () => void;
  onSendTestWebhook: (payload: any) => Promise<any>;
}

export const WebhookBridgeView: React.FC<Props> = ({
  webhookSecret,
  webhookLogs,
  tradingMode,
  onRotateToken,
  onSendTestWebhook,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPine, setCopiedPine] = useState(false);

  const [testSymbol, setTestSymbol] = useState('BTC/USDT');
  const [testAction, setTestAction] = useState<'BUY' | 'SELL' | 'CLOSE'>('BUY');
  const [testQty, setTestQty] = useState(0.5);
  const [testPrice, setTestPrice] = useState(67850);
  const [testStrategy, setTestStrategy] = useState('TradingView_EMA_Pro');
  const [customJson, setCustomJson] = useState('');
  const [useCustomJson, setUseCustomJson] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute absolute webhook URL
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://quantbridge-terminal.com';
  const webhookUrl = `${origin}/api/webhook/tradingview`;

  const handleCopy = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const pineScriptCode = `//@version=5
strategy("QuantBridge Custom Webhook Strategy", overlay=true, margin_long=100, margin_short=100)

// =========================================================================
// 1. 🛠️ DEFINE YOUR CUSTOM INDICATOR LOGIC HERE
// =========================================================================
// Example: Fast & Slow Moving Averages (Replace this with your own logic!)
fastEMA = ta.ema(close, 14)
slowEMA = ta.ema(close, 28)

// =========================================================================
// 2. 🎯 DEFINE YOUR LONG / SHORT TRADE CONDITIONS HERE
// =========================================================================
// Replace these with your own custom indicator conditions
longCondition = ta.crossover(fastEMA, slowEMA)
shortCondition = ta.crossunder(fastEMA, slowEMA)

// =========================================================================
// 3. 🚀 WEBHOOK ALERTS TO AI ALGO ENGINE (DO NOT MODIFY JSON STRUCTURE)
// =========================================================================
if (longCondition)
    strategy.entry("Long", strategy.long)
    // Send Real-Time Webhook Alert to QuantBridge AI Agent
    alert('{"token":"${webhookSecret}","signal":"BUY","symbol":"' + syminfo.ticker + '","qty":1.0,"price":' + str.tostring(close) + ',"strategy":"My_Custom_Indicator"}', alert.freq_once_per_bar_close)

if (shortCondition)
    strategy.entry("Short", strategy.short)
    // Send Real-Time Webhook Alert to QuantBridge AI Agent
    alert('{"token":"${webhookSecret}","signal":"SELL","symbol":"' + syminfo.ticker + '","qty":1.0,"price":' + str.tostring(close) + ',"strategy":"My_Custom_Indicator"}', alert.freq_once_per_bar_close)

// Optional: Plot your custom indicators on the chart
plot(fastEMA, "Fast EMA", color=color.yellow)
plot(slowEMA, "Slow EMA", color=color.aqua)`;

  const handleExecuteTest = async () => {
    setIsSending(true);
    setErrorMessage(null);
    setLastResult(null);

    let payload: any;
    if (useCustomJson) {
      try {
        payload = JSON.parse(customJson);
      } catch (err: any) {
        setErrorMessage('Invalid JSON format: ' + err.message);
        setIsSending(false);
        return;
      }
    } else {
      payload = {
        token: webhookSecret,
        signal: testAction,
        symbol: testSymbol,
        qty: Number(testQty),
        price: Number(testPrice),
        strategy: testStrategy,
      };
    }

    try {
      const res = await onSendTestWebhook(payload);
      setLastResult(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Webhook failed');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            TradingView Webhook Execution Bridge
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Connect your Pine Script strategies to automatically execute virtual orders in{' '}
            <strong className="text-emerald-400 font-semibold">{tradingMode === 'DEMO' ? 'Demo Mode' : 'Live Real Money'}</strong>{' '}
            with sub-20ms execution latency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Current Engine:</span>
          <span className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-800 border border-slate-700 rounded text-emerald-400">
            {tradingMode === 'DEMO' ? 'Virtual Broker Active' : 'Live Broker API'}
          </span>
        </div>
      </div>

      {/* Webhook Endpoint & Secret Token Box */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Endpoint Card */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Live Webhook URL (Paste into TradingView Alert)</span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
              POST
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200 select-all focus:outline-none"
            />
            <button
              onClick={() => handleCopy(webhookUrl, setCopiedUrl)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedUrl ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            TradingView Webhook alerts will POST JSON payloads directly to this endpoint.
          </p>
        </div>

        {/* Security Token Card */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Webhook Authentication Secret</span>
            <button
              onClick={onRotateToken}
              className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors cursor-pointer"
              title="Generate new secret token"
            >
              <RotateCw className="w-3 h-3" />
              Rotate Token
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookSecret}
              className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-amber-400 select-all focus:outline-none"
            />
            <button
              onClick={() => handleCopy(webhookSecret, setCopiedToken)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedToken ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Include this token in the JSON body (<code className="text-slate-400">"token": "..."</code>) or as <code className="text-slate-400">X-Webhook-Token</code> header.
          </p>
        </div>
      </div>

      {/* Simulator / Test Trigger Sandbox & Pine Script Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Trigger Sandbox */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-bold text-slate-100">Webhook Signal Simulator</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => setUseCustomJson(false)}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  !useCustomJson ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                Form Mode
              </button>
              <button
                onClick={() => {
                  setUseCustomJson(true);
                  if (!customJson) {
                    setCustomJson(
                      JSON.stringify(
                        {
                          token: webhookSecret,
                          signal: 'BUY',
                          symbol: 'BTC/USDT',
                          qty: 0.5,
                          price: 67800,
                          strategy: 'EMA_Cross_v5',
                        },
                        null,
                        2
                      )
                    );
                  }
                }}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  useCustomJson ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400'
                }`}
              >
                Raw JSON
              </button>
            </div>
          </div>

          {!useCustomJson ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Signal Action</label>
                  <select
                    value={testAction}
                    onChange={(e: any) => setTestAction(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BUY">BUY (Long Entry)</option>
                    <option value="SELL">SELL (Short Entry)</option>
                    <option value="CLOSE">CLOSE (Exit Position)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Asset Symbol</label>
                  <select
                    value={testSymbol}
                    onChange={(e) => {
                      const s = e.target.value;
                      setTestSymbol(s);
                      if (s === 'BTC/USDT') setTestPrice(84500);
                      else if (s === 'ETH/USDT') setTestPrice(3150);
                      else if (s === 'SOL/USDT') setTestPrice(185);
                      else if (s === 'XAU/USD') setTestPrice(4116);
                      else if (s === 'XAG/USD') setTestPrice(60.2);
                      else if (s === 'NVDA') setTestPrice(131.2);
                      else if (s === 'TSLA') setTestPrice(254.3);
                      else if (s === 'AAPL') setTestPrice(227.5);
                      else if (s === 'SPY') setTestPrice(576.0);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BTC/USDT">BTC/USDT (Bitcoin)</option>
                    <option value="ETH/USDT">ETH/USDT (Ethereum)</option>
                    <option value="SOL/USDT">SOL/USDT (Solana)</option>
                    <option value="XAU/USD">XAU/USD (Gold Spot)</option>
                    <option value="XAG/USD">XAG/USD (Silver Spot)</option>
                    <option value="NVDA">NVDA (Nvidia)</option>
                    <option value="TSLA">TSLA (Tesla)</option>
                    <option value="SPY">SPY (S&P 500)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.01"
                    value={testQty}
                    onChange={(e) => setTestQty(parseFloat(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Simulated Price ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={testPrice}
                    onChange={(e) => setTestPrice(parseFloat(e.target.value) || 100)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Strategy Identifier</label>
                <input
                  type="text"
                  value={testStrategy}
                  onChange={(e) => setTestStrategy(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Instant Strategy Presets */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-500 block mb-1">Quick Strategy Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTestAction('BUY');
                      setTestSymbol('BTC/USDT');
                      setTestQty(0.5);
                      setTestPrice(67850);
                      setTestStrategy('EMA_Golden_Cross_v5');
                    }}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] font-mono transition-colors"
                  >
                    + Long 0.5 BTC
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestAction('SELL');
                      setTestSymbol('ETH/USDT');
                      setTestQty(3.0);
                      setTestPrice(2640);
                      setTestStrategy('Mean_Reversion_RSI');
                    }}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] font-mono transition-colors"
                  >
                    - Short 3.0 ETH
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestAction('BUY');
                      setTestSymbol('NVDA');
                      setTestQty(25);
                      setTestPrice(131.2);
                      setTestStrategy('Volume_Breakout_Pro');
                    }}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 text-[10px] font-mono transition-colors"
                  >
                    + Long 25 NVDA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTestAction('CLOSE');
                      setTestSymbol('BTC/USDT');
                      setTestPrice(68200);
                      setTestStrategy('Take_Profit_Full');
                    }}
                    className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-rose-300 rounded border border-rose-500/30 text-[10px] font-mono transition-colors"
                  >
                    Flatten BTC
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-slate-400 block text-xs mb-1">Custom Webhook JSON Payload</label>
              <textarea
                rows={7}
                value={customJson}
                onChange={(e) => setCustomJson(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Trigger Button */}
          <button
            onClick={handleExecuteTest}
            disabled={isSending}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isSending ? 'Transmitting to Bridge...' : `Send Test Webhook Signal (${tradingMode} Mode)`}
          </button>

          {/* Feedback response */}
          {errorMessage && (
            <div className="p-2.5 bg-rose-950/40 border border-rose-500/30 rounded text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {lastResult && (
            <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-emerald-400 font-bold">
                <span>✓ Webhook Processed Successfully</span>
                <span>Latency: {lastResult.latencyMs}ms</span>
              </div>
              <p className="text-slate-300">{lastResult.message}</p>
            </div>
          )}
        </div>

        {/* Ready Pine Script Template Card */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-sm font-bold text-slate-100">Custom Pine Script Webhook Template</span>
              <button
                onClick={() => handleCopy(pineScriptCode, setCopiedPine)}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors cursor-pointer"
              >
                {copiedPine ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPine ? 'Copied' : 'Copy Template'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Copy this into TradingView's <strong>Pine Editor</strong> and plug in your own custom indicator logic! When creating an alert in TradingView, set the Webhook URL to your QuantBridge endpoint above.
            </p>
          </div>

          <pre className="p-3 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56">
            <code>{pineScriptCode}</code>
          </pre>

          <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Supported Pine parameters: <code className="text-slate-400">signal, symbol, qty, price, strategy</code></span>
          </div>
        </div>
      </div>

      {/* Real-Time Webhook Activity Logs */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100">Inbound Webhook Execution Log</span>
            <span className="text-xs font-mono text-slate-500">({webhookLogs.length} events logged)</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Real-Time Bridge Ingestion</span>
        </div>

        {webhookLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No webhook signals recorded yet. Fire a test signal or set up a TradingView alert to see live executions!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Origin IP</th>
                  <th className="py-2 px-3">Signal</th>
                  <th className="py-2 px-3">Asset</th>
                  <th className="py-2 px-3">Message</th>
                  <th className="py-2 px-3 text-right">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {webhookLogs.map((log) => {
                  const payload = log.payload || {};
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-semibold ${
                            log.status === 'SUCCESS'
                              ? 'text-emerald-400'
                              : log.status === 'HALTED'
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{log.ip}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            payload.signal === 'BUY'
                              ? 'text-emerald-400'
                              : payload.signal === 'SELL'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {payload.signal || payload.action || 'N/A'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">
                        {payload.symbol || payload.ticker || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 tabular-nums">
                        {log.latencyMs}ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Developer Terminal Command & TradingView Placeholder Spec */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Direct Terminal / cURL Trigger Test
            </span>
            <button
              onClick={() => {
                const cmd = `curl -X POST ${webhookUrl} -H "Content-Type: application/json" -d '{"token":"${webhookSecret}","signal":"BUY","symbol":"BTC/USDT","qty":0.5,"price":67850,"strategy":"Terminal_cURL_Test"}'`;
                navigator.clipboard.writeText(cmd);
              }}
              className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
            >
              Copy Command
            </button>
          </div>
          <pre className="p-2.5 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-300 overflow-x-auto">
            <code>{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"token":"${webhookSecret}","signal":"BUY","symbol":"BTC/USDT","qty":0.5,"price":67850,"strategy":"Terminal_cURL_Test"}'`}</code>
          </pre>
        </div>

        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2 text-xs">
          <span className="font-bold text-slate-200 block">Standard TradingView Alert Variables</span>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
            <div><code className="text-emerald-400">{`{{strategy.order.action}}`}</code>: BUY / SELL</div>
            <div><code className="text-emerald-400">{`{{ticker}}`}</code>: Instrument name</div>
            <div><code className="text-emerald-400">{`{{close}}`}</code>: Current bar close</div>
            <div><code className="text-emerald-400">{`{{strategy.order.contracts}}`}</code>: Order size</div>
            <div><code className="text-emerald-400">{`{{strategy.market_position}}`}</code>: Position state</div>
            <div><code className="text-emerald-400">{`{{timenow}}`}</code>: Unix timestamp</div>
          </div>
        </div>
      </div>
    </div>
  );
};
