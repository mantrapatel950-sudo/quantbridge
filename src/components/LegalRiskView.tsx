import React from 'react';
import { AlertTriangle, Scale, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';

export const LegalRiskView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Mandatory Regulatory Warning Banner */}
      <div className="p-5 bg-rose-950/30 border border-rose-500/40 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-rose-200">
            Mandatory Regulatory Notice & CFTC Rule 4.41 Statement
          </h2>
          <p className="text-xs text-rose-300 leading-relaxed">
            Hypothetical or simulated performance results have certain inherent limitations. Unlike an actual performance record,
            simulated results do not represent actual trading. Also, since the trades have not actually been executed, the results
            may have under- or over-compensated for the impact, if any, of certain market factors, such as lack of liquidity.
            No representation is being made that any account will or is likely to achieve profits or losses similar to those shown.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Black-Box Algo Trading & RIA Compliance */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Scale className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">
              SEC / CFTC / SEBI Regulatory Framework
            </h3>
          </div>
          <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
            <p>
              Under US SEC/CFTC guidelines and Indian SEBI circulars on algorithmic trading, distributing automated trade execution software
              to third parties without proper licensing (such as Registered Investment Advisor - RIA, Commodity Trading Advisor - CTA,
              or Broker-Dealer authorization) carries strict statutory penalties.
            </p>
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded text-[11px] space-y-1 text-slate-400">
              <strong className="text-slate-200 block">Operator Compliance Checklist:</strong>
              <ul className="list-disc list-inside space-y-1">
                <li>Non-Custodial Design: Software does not hold user funds. Orders route straight to user's personal brokerage account.</li>
                <li>Strategy Transparency: Users control their own Pine Script logic; software acts solely as an execution bridge.</li>
                <li>Audit Logs: Every webhook payload and broker order execution is timestamped in the ledger.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Software Latency & API Failures Disclaimer */}
        <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Latency & Third-Party Outage Liability Waiver
            </h3>
          </div>
          <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
            <p>
              QuantBridge utilizes public internet transit, cloud webhooks from TradingView, and third-party broker REST/WebSocket APIs.
              Network congestion, server downtime, exchange circuit breakers, broker rate limits, or slippage during flash-crash events
              can result in delayed, unfilled, or rejected orders.
            </p>
            <p className="text-slate-400 text-[11px]">
              By engaging live algorithmic trading, the operator explicitly acknowledges that QuantBridge and its developers shall bear
              no financial liability whatsoever for losses incurred as a consequence of hardware, software, or network failures.
            </p>
          </div>
        </div>
      </div>

      {/* Production Terms of Service Excerpt */}
      <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">Public Release Terms of Service Summary</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Standard SaaS Legal Architecture</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded space-y-1">
            <span className="font-semibold text-slate-200 block">1. Non-Advisory Status</span>
            <p className="text-slate-400 text-[11px]">
              This software is a technical routing utility and does not constitute financial, investment, or legal advice.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded space-y-1">
            <span className="font-semibold text-slate-200 block">2. Mandatory Paper Trading</span>
            <p className="text-slate-400 text-[11px]">
              All strategies must undergo extensive forward-testing in Demo (Paper Trading) mode before committing real capital.
            </p>
          </div>
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded space-y-1">
            <span className="font-semibold text-slate-200 block">3. Emergency Kill Switch</span>
            <p className="text-slate-400 text-[11px]">
              The user retains sole responsibility for supervising open positions and invoking the Emergency Kill Switch when required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
