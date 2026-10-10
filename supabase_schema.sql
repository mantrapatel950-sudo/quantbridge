-- ==============================================================================
-- QuantBridge Database Schema for Supabase
-- Run this in your Supabase SQL Editor: Dashboard -> SQL Editor -> New Query
-- ==============================================================================

-- 1. Create Strategies Table
CREATE TABLE IF NOT EXISTS public.strategies (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    symbol TEXT NOT NULL,
    timeframe TEXT NOT NULL DEFAULT '15m',
    direction TEXT NOT NULL DEFAULT 'BOTH',
    type TEXT NOT NULL DEFAULT 'EMA_CROSS',
    enabled BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'RUNNING',
    parameters JSONB DEFAULT '{}'::jsonb,
    risk JSONB DEFAULT '{}'::jsonb,
    stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Create Positions Table
CREATE TABLE IF NOT EXISTS public.positions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    current_price NUMERIC NOT NULL,
    unrealized_pnl NUMERIC DEFAULT 0,
    unrealized_pnl_percent NUMERIC DEFAULT 0,
    strategy TEXT,
    opened_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    stop_loss NUMERIC,
    take_profit NUMERIC,
    mode TEXT DEFAULT 'DEMO',
    leverage NUMERIC DEFAULT 10,
    margin NUMERIC DEFAULT 0,
    liquidation_price NUMERIC,
    is_trailing_stop BOOLEAN DEFAULT false,
    trailing_stop_percent NUMERIC,
    highest_price NUMERIC,
    lowest_price NUMERIC
);

-- 3. Create Trades Ledger Table
CREATE TABLE IF NOT EXISTS public.trades (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty NUMERIC NOT NULL,
    entry_price NUMERIC NOT NULL,
    exit_price NUMERIC NOT NULL,
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ NOT NULL,
    pnl NUMERIC NOT NULL,
    pnl_percent NUMERIC NOT NULL,
    strategy TEXT,
    status TEXT NOT NULL,
    mode TEXT DEFAULT 'DEMO'
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Allow authenticated users access to their own data)
CREATE POLICY "Allow individual select on strategies" ON public.strategies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert on strategies" ON public.strategies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update on strategies" ON public.strategies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow individual delete on strategies" ON public.strategies
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Allow individual select on positions" ON public.positions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert on positions" ON public.positions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update on positions" ON public.positions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow individual delete on positions" ON public.positions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Allow individual select on trades" ON public.trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert on trades" ON public.trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Indexes for real-time querying performance
CREATE INDEX IF NOT EXISTS idx_strategies_user_id ON public.strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON public.positions(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);

-- 7. Multi-Tenant Per-User Broker Configs Table (Private to each user)
CREATE TABLE IF NOT EXISTS public.user_broker_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    broker TEXT NOT NULL DEFAULT 'Binance',
    account_type TEXT NOT NULL DEFAULT 'SPOT',
    is_sandbox BOOLEAN NOT NULL DEFAULT false,
    api_key_masked TEXT DEFAULT '',
    api_secret_masked TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'DISCONNECTED',
    wallet_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_broker_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow individual select on user_broker_configs" ON public.user_broker_configs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert on user_broker_configs" ON public.user_broker_configs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual update on user_broker_configs" ON public.user_broker_configs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow individual delete on user_broker_configs" ON public.user_broker_configs
    FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_broker_configs_user_id ON public.user_broker_configs(user_id);
