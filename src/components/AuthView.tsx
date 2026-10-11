import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { Shield, Mail, AlertCircle, Loader2, Zap, Terminal, Activity, ArrowRight, Lock, CheckCircle2, UserCheck, Database } from 'lucide-react';

interface Props {
  onGuestAccess?: () => void;
  onLoginSuccess?: (user: { id: string; email: string }) => void;
}

interface LocalAccount {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

const getLocalAccounts = (): Record<string, LocalAccount> => {
  try {
    return JSON.parse(localStorage.getItem('qb_local_accounts') || '{}');
  } catch {
    return {};
  }
};

const saveLocalAccounts = (accounts: Record<string, LocalAccount>) => {
  try {
    localStorage.setItem('qb_local_accounts', JSON.stringify(accounts));
  } catch {}
};

export const AuthView: React.FC<Props> = ({ onGuestAccess, onLoginSuccess }) => {
  const [view, setView] = useState<'login' | 'signup'>('login');
  
  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // General state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dbStatusNotice, setDbStatusNotice] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setDbStatusNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please provide a valid email and password.');
      setLoading(false);
      return;
    }

    // 1. If Supabase is configured, attempt authentication with a 3.5s timeout protection
    let supabaseHandled = false;

    if (isSupabaseConfigured) {
      try {
        const timeoutPromise = new Promise<{ error: Error }>((_, reject) =>
          setTimeout(() => reject(new Error('DATABASE_CONNECTION_TIMEOUT')), 3500)
        );

        if (view === 'login') {
          const res: any = await Promise.race([
            supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword }),
            timeoutPromise,
          ]);

          if (res?.error) {
            const msg = res.error.message?.toLowerCase() || '';
            // If it's explicitly bad credentials from an alive database, notify user
            if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
              // Check if they have a local account with this email/password before giving error
              const localAccounts = getLocalAccounts();
              if (localAccounts[cleanEmail] && localAccounts[cleanEmail].passwordHash === cleanPassword) {
                setSuccess('Authenticated via Local Terminal Profile.');
                setTimeout(() => {
                  if (onLoginSuccess) onLoginSuccess({ id: localAccounts[cleanEmail].id, email: cleanEmail });
                }, 400);
                return;
              }
              setError('Invalid login credentials. Please check your email and password.');
              setLoading(false);
              return;
            }
            console.warn('Supabase sign-in rejected or database unreachable:', res.error);
          } else if (res?.data?.user) {
            supabaseHandled = true;
            setSuccess('Authenticated successfully with Supabase Cloud!');
            setTimeout(() => {
              if (onLoginSuccess) {
                onLoginSuccess({ id: res.data.user.id, email: res.data.user.email || cleanEmail });
              }
            }, 400);
            return;
          }
        } else {
          // Signup
          const res: any = await Promise.race([
            supabase.auth.signUp({ email: cleanEmail, password: cleanPassword }),
            timeoutPromise,
          ]);

          if (res?.error) {
            console.warn('Supabase sign-up rejected or database unreachable:', res.error);
          } else if (res?.data?.user) {
            supabaseHandled = true;
            setSuccess('Account registered successfully! Entering terminal...');
            setTimeout(() => {
              if (onLoginSuccess) {
                onLoginSuccess({ id: res.data.user.id, email: res.data.user.email || cleanEmail });
              }
            }, 500);
            return;
          }
        }
      } catch (err: any) {
        console.warn('Supabase call failed/timed out:', err);
      }
    }

    // 2. Seamless local terminal fallback:
    // If Supabase timed out, is paused, or is offline, log in or register locally so user & friends are NEVER blocked!
    try {
      const accounts = getLocalAccounts();
      if (view === 'login') {
        const existing = accounts[cleanEmail];
        if (existing) {
          if (existing.passwordHash === cleanPassword) {
            setSuccess('Authenticated via Local Trader Profile!');
            setTimeout(() => {
              if (onLoginSuccess) onLoginSuccess({ id: existing.id, email: cleanEmail });
            }, 400);
            return;
          } else {
            setError('Incorrect password for this profile. Please try again.');
            setLoading(false);
            return;
          }
        } else {
          // Auto-provision local profile so friends can start immediately
          const newId = 'trader-' + Math.random().toString(36).substring(2, 9);
          accounts[cleanEmail] = {
            id: newId,
            email: cleanEmail,
            passwordHash: cleanPassword,
            createdAt: new Date().toISOString(),
          };
          saveLocalAccounts(accounts);
          setSuccess('Created and authenticated Local Trader Profile!');
          setTimeout(() => {
            if (onLoginSuccess) onLoginSuccess({ id: newId, email: cleanEmail });
          }, 500);
          return;
        }
      } else {
        // Sign up
        const newId = 'trader-' + Math.random().toString(36).substring(2, 9);
        accounts[cleanEmail] = {
          id: newId,
          email: cleanEmail,
          passwordHash: cleanPassword,
          createdAt: new Date().toISOString(),
        };
        saveLocalAccounts(accounts);
        setSuccess('Account created and saved locally! Entering terminal...');
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess({ id: newId, email: cleanEmail });
        }, 500);
        return;
      }
    } catch (localErr: any) {
      setError(localErr.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantLocalEntry = () => {
    const targetEmail = email.trim() || 'trader@quantbridge.io';
    if (onLoginSuccess) {
      onLoginSuccess({ id: 'local-' + Date.now().toString(36), email: targetEmail });
    } else if (onGuestAccess) {
      onGuestAccess();
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      if (!isSupabaseConfigured) {
        handleInstantLocalEntry();
        return;
      }
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (googleError) throw googleError;
    } catch (err: any) {
      console.error(err);
      setError('OAuth sign in unavailable. Use Instant Demo or Email login below.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden cyber-grid">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-8 relative overflow-hidden">
        {/* Top Gradient Border */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Header */}
        <div className="relative z-10 flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 mb-4 shadow-xl shadow-emerald-500/10 relative">
            <span className="w-3 h-3 rounded-full bg-emerald-500 absolute top-2 right-2 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
            <Terminal className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            QuantBridge
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              v2.4 PRO
            </span>
          </h1>
          <p className="text-slate-400 text-xs text-center mt-1">
            Algorithmic Execution Engine & TradingView Webhook Terminal
          </p>
        </div>

        {/* Instant Guest / Evaluator Mode Banner (Zero friction customer entry) */}
        {onGuestAccess && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-950/70 via-slate-900/80 to-teal-950/70 border border-emerald-500/40 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
                Instant Access (No Database Wait)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-semibold border border-emerald-500/30">
                ZERO FRICTION
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Launch directly into the execution terminal with live prices, order management, and exchange connectors.
            </p>
            <button
              type="button"
              id="instant-demo-access-btn"
              onClick={onGuestAccess}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Terminal Immediately</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/40 rounded-xl flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-200">{error}</p>
            </div>
            <button
              type="button"
              onClick={handleInstantLocalEntry}
              className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 underline text-left cursor-pointer mt-1"
            >
              Click here to bypass cloud database and enter immediately &rarr;
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/40 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200">{success}</p>
          </div>
        )}

        {/* View Toggle (Login / Signup) */}
        <div className="flex bg-slate-950 rounded-xl p-1 mb-5 border border-slate-800">
          <button
            onClick={() => setView('login')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              view === 'login' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Login With Email
          </button>
          <button
            onClick={() => setView('signup')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              view === 'signup' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Forms */}
        <div className="space-y-4">
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                placeholder="trader@quantbridge.com"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              id="auth-submit-btn"
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 text-xs cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {view === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="relative flex py-3 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink-0 mx-3 text-slate-500 text-[10px] font-mono">OR SIGN IN WITH</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full bg-slate-950 hover:bg-slate-900 text-slate-200 font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800 text-xs cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Feature badges footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <Database className="w-3 h-3" />
            <span>Hybrid DB Sync</span>
          </span>
          <span>·</span>
          <span>Binance · Bybit · Delta · Shark</span>
          <span>·</span>
          <span>Webhooks v5</span>
        </div>
      </div>
    </div>
  );
};
