import React, { useState, useEffect } from 'react';
import { ShieldAlert, Volume2, VolumeX, Clock, Cpu, Activity, Bell, BellOff, BellRing, LogOut, Wallet, Zap, Cloud } from 'lucide-react';
import { setTerminalMuted } from '../utils/audioAlerts';
import { MarketTickerTape } from './MarketTickerTape';

interface Props {
  activeTab: 'dashboard' | 'strategies' | 'webhook' | 'ledger' | 'broker' | 'legal';
  onTabChange: (tab: 'dashboard' | 'strategies' | 'webhook' | 'ledger' | 'broker' | 'legal') => void;
  tradingMode: 'DEMO' | 'REAL';
  onModeToggle: (mode: 'DEMO' | 'REAL') => void;
  isKillSwitchActive: boolean;
  onOpenKillSwitch: () => void;
  onResumeEngine: () => void;
  notificationPermission?: 'default' | 'granted' | 'denied' | 'unsupported';
  onRequestNotifications?: () => void;
  onTestNotification?: () => void;
  activeAlgoBotsCount?: number;
  userEmail?: string;
  onSignOut?: () => void;
  brokerName?: string;
  brokerStatus?: string;
  currentBalance?: number;
  selectedSymbol?: string;
  onSelectSymbol?: (symbol: string) => void;
  onOpenCapitalModal?: () => void;
}

export const TopNav: React.FC<Props> = ({
  activeTab,
  onTabChange,
  tradingMode,
  onModeToggle,
  isKillSwitchActive,
  onResumeEngine,
  onOpenKillSwitch,
  notificationPermission = 'default',
  onRequestNotifications,
  onTestNotification,
  activeAlgoBotsCount,
  userEmail,
  onSignOut,
  brokerName = 'Binance',
  brokerStatus = 'CONNECTED',
  currentBalance = 100000,
  selectedSymbol = 'BTC/USDT',
  onSelectSymbol,
  onOpenCapitalModal,
}) => {
  const [utcTime, setUtcTime] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [gitStatus, setGitStatus] = useState<{
    hasRemoteUpdate?: boolean;
    currentCommit?: string;
    remoteCommit?: string;
    isPulling?: boolean;
    statusMessage?: string;
  }>({});
  const [isUpdatingGit, setIsUpdatingGit] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toISOString().slice(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll GitHub auto-sync status every 10s and auto-reload on update
  useEffect(() => {
    let prevCommit = '';
    const checkGit = async () => {
      try {
        const res = await fetch('/api/system/git-status');
        if (res.ok) {
          const data = await res.json();
          setGitStatus(data);
          if (data.statusMessage === 'RELOAD_REQUIRED' || (prevCommit && data.currentCommit && prevCommit !== data.currentCommit)) {
            console.log('⚡ QuantBridge updated to latest version! Auto-reloading UI...');
            setTimeout(() => window.location.reload(), 1500);
          }
          if (data.currentCommit) prevCommit = data.currentCommit;
        }
      } catch {}
    };
    checkGit();
    const timer = setInterval(checkGit, 10000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    setTerminalMuted(next);
  };

  return (
    <>
      {/* Primary Top Bar */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-slate-950/95 border-b border-slate-800/80 text-slate-100 select-none overflow-x-auto flex-nowrap gap-4 backdrop-blur-md custom-scrollbar sticky top-0 z-40">
        {/* Zone 1: Wordmark Brand Title & Session Telemetry */}
        <div className="flex items-center gap-3.5 shrink-0">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              onTabChange('dashboard');
            }}
            className="text-base font-extrabold tracking-tight text-white flex items-center gap-2 group cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.5)] group-hover:shadow-[0_0_18px_rgba(16,185,129,0.8)] transition-all">
              <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
            </div>
            <span className="tracking-tight font-sans text-slate-100 font-bold">QuantBridge</span>
          </a>

          {/* Global Market Session & UTC Time */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono text-slate-400 pl-3 border-l border-slate-800/80">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{utcTime}</span>
            </span>
            <span aria-hidden="true" className="text-slate-700">·</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-slate-300 font-medium">NYSE / CME / 24/7 Crypto Active</span>
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Clean unboxed typography with glowing indicators) */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs font-semibold shrink-0">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-emerald-400 font-bold border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>Dashboard & Terminal</span>
          </button>
          <button
            onClick={() => onTabChange('strategies')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'strategies'
                ? 'bg-slate-900 text-emerald-400 font-bold border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>24/7 Algo Lab</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              {activeAlgoBotsCount !== undefined ? `${activeAlgoBotsCount} ACTIVE` : '24/7'}
            </span>
          </button>
          <button
            onClick={() => onTabChange('webhook')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'webhook'
                ? 'bg-slate-900 text-emerald-400 font-bold border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>Webhook Bridge</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>
          <button
            onClick={() => onTabChange('ledger')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ledger'
                ? 'bg-slate-900 text-emerald-400 font-bold border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            Trade Ledger
          </button>
          <button
            onClick={() => onTabChange('broker')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'broker'
                ? 'bg-slate-900 text-emerald-400 font-bold border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <span>Broker & Risk</span>
            {brokerStatus === 'CONNECTED' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            )}
          </button>
          <button
            onClick={() => onTabChange('legal')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'legal'
                ? 'bg-slate-900 text-emerald-400 font-bold border border-slate-800 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            Disclaimers
          </button>
        </nav>

        {/* Zone 3: Capital Pill, Mode Switcher, Audio, Alerts, Kill Switch */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Quick Capital Display Pill */}
          <div
            onClick={onOpenCapitalModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
              tradingMode === 'REAL'
                ? 'bg-amber-950/40 border-amber-500/40 hover:border-amber-500/70 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                : 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/50 text-slate-200 shadow-xs'
            }`}
            title="Click to view or adjust capital preset"
          >
            <Wallet className={`w-3.5 h-3.5 ${tradingMode === 'REAL' ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div className="flex flex-col leading-none text-left">
              <span className="text-[9px] text-slate-400 uppercase font-sans font-bold">
                {tradingMode === 'REAL' ? `Live Capital (${brokerName})` : 'Virtual Capital'}
              </span>
              <span className="font-bold tabular-nums text-xs mt-0.5">
                ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Mode Selector Toggle */}
          <div className="flex items-center p-0.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold">
            <button
              onClick={() => onModeToggle('DEMO')}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
                tradingMode === 'DEMO'
                  ? 'bg-slate-800 text-emerald-400 shadow-xs font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Demo
            </button>
            <button
              onClick={() => onModeToggle('REAL')}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                tradingMode === 'REAL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Live Capital</span>
              {brokerStatus === 'CONNECTED' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Browser Notifications Status Button */}
          {notificationPermission === 'granted' ? (
            <button
              onClick={onTestNotification}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
              title="Browser Notifications Active: Triggers when trade is opened, closed, or margin > 80%. Click to test."
            >
              <BellRing className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xl:inline text-[11px] font-mono text-emerald-400 font-semibold">Alerts</span>
            </button>
          ) : (
            <button
              onClick={onRequestNotifications}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
              title="Enable desktop notifications for trade alerts"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}

          {/* Audio Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 bg-slate-900 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio Cues' : 'Mute Audio Cues'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>

          {/* GitHub Continuous Auto-Sync Pill Button */}
          <button
            onClick={async () => {
              setIsUpdatingGit(true);
              try {
                const res = await fetch('/api/system/git-pull', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  setGitStatus(data);
                  alert(`✅ QuantBridge updated to latest version (${data.currentCommit})! Reloading...`);
                  window.location.reload();
                } else {
                  alert(`Notice: ${data.error || 'Already on latest version'}`);
                }
              } catch (e: any) {
                alert(`Git check: ${e.message}`);
              } finally {
                setIsUpdatingGit(false);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
              gitStatus.hasRemoteUpdate
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title={
              gitStatus.hasRemoteUpdate
                ? '⚡ New version available on GitHub! Click to update now.'
                : `Continuous GitHub Auto-Sync: Active (${gitStatus.currentCommit || 'Live'})`
            }
          >
            <Cloud className={`w-3.5 h-3.5 ${gitStatus.hasRemoteUpdate ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline text-[11px] font-sans font-medium">
              {isUpdatingGit ? 'Updating...' : gitStatus.hasRemoteUpdate ? 'Update Available' : 'Auto-Sync'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                gitStatus.hasRemoteUpdate ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
              }`}
            />
          </button>

          {/* User Account & Sign Out */}
          {onSignOut && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 shadow-sm">
              <span className="text-[11px] font-mono text-slate-300 max-w-[140px] truncate" title={userEmail || 'Trader'}>
                {userEmail || 'Trader'}
              </span>
              <button
                onClick={onSignOut}
                id="sign-out-btn"
                className="flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-white hover:bg-rose-600/80 px-2 py-0.5 rounded transition-all cursor-pointer border border-rose-900/50"
                title="Sign Out of Session"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Emergency Kill Switch */}
          {isKillSwitchActive ? (
            <button
              onClick={onResumeEngine}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-md animate-pulse cursor-pointer whitespace-nowrap"
            >
              <Activity className="w-3.5 h-3.5" />
              HALTED: Resume
            </button>
          ) : (
            <button
              onClick={onOpenKillSwitch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-[0_0_12px_rgba(225,29,72,0.4)] hover:shadow-[0_0_18px_rgba(225,29,72,0.6)] cursor-pointer whitespace-nowrap"
              title="Emergency halt: liquidates open positions and freezes incoming orders"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              KILL SWITCH
            </button>
          )}
        </div>
      </header>

      {/* Live Market Ticker Tape */}
      {onSelectSymbol && (
        <MarketTickerTape
          selectedSymbol={selectedSymbol}
          onSelectSymbol={onSelectSymbol}
        />
      )}

      {/* Mobile Navigation Strip (Visible on screens < lg) */}
      <nav className="flex lg:hidden items-center gap-1.5 px-4 py-2 bg-slate-950/95 border-b border-slate-800 overflow-x-auto text-xs font-medium scrollbar-none select-none">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onTabChange('strategies')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'strategies'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Algo Lab
        </button>
        <button
          onClick={() => onTabChange('webhook')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'webhook'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Webhook
        </button>
        <button
          onClick={() => onTabChange('ledger')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'ledger'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Ledger
        </button>
        <button
          onClick={() => onTabChange('broker')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'broker'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Broker
        </button>
        <button
          onClick={() => onTabChange('legal')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'legal'
              ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Legal
        </button>
      </nav>
    </>
  );
};
