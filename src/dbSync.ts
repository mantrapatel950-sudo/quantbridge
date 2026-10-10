import { supabaseAdmin, isSupabaseAdminConfigured } from './supabaseAdmin';
import { Trade, Position, StrategyConfig, WebhookLog } from '../server';

export let globalUserId: string | null = null;

export async function initializeDatabaseSync(
  setPositions: (positions: Position[]) => void,
  setTrades: (trades: Trade[]) => void,
  setStrategies: (strategies: StrategyConfig[]) => void
) {
  if (!isSupabaseAdminConfigured) {
    return;
  }
  try {
    // 1. Find the master user
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw usersError;
    
    if (!usersData.users || usersData.users.length === 0) {
      console.warn('⚠️ No users found in Supabase. Please sign up on the frontend first to sync data.');
      return;
    }
    
    // We assume single-tenant execution engine for now
    globalUserId = usersData.users[0].id;
    console.log(`✅ DB Sync Initialized for User: ${globalUserId}`);

    // 2. Load open positions
    const { data: positions } = await supabaseAdmin
      .from('positions')
      .select('*')
      .eq('user_id', globalUserId);
      
    if (positions && positions.length > 0) {
      setPositions(positions.map(mapDbToPosition));
      console.log(`Loaded ${positions.length} open positions from DB.`);
    }

    // 3. Load closed trades (limit 100 for memory)
    const { data: trades } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('user_id', globalUserId)
      .order('exit_time', { ascending: false })
      .limit(100);
      
    if (trades && trades.length > 0) {
      setTrades(trades.map(mapDbToTrade));
      console.log(`Loaded ${trades.length} closed trades from DB.`);
    }

    // 4. Load strategies
    const { data: strategies } = await supabaseAdmin
      .from('strategies')
      .select('*')
      .eq('user_id', globalUserId);

    if (strategies && strategies.length > 0) {
      setStrategies(strategies.map(mapDbToStrategy));
      console.log(`Loaded ${strategies.length} strategies from DB.`);
    }

  } catch (err) {
    console.error('Failed to initialize DB sync:', err);
  }
}

// ==========================================
// BACKGROUND SYNC MUTATIONS (Fire & Forget)
// ==========================================

function handleSyncError(context: string, error: any) {
  if (!error) return;
  if (error.code === 'PGRST205') {
    // Table not yet created in Supabase. Handled by local persistent JSON storage.
    return;
  }
  console.error(`DB Sync Error (${context}):`, error);
}

export function syncInsertPosition(position: Position) {
  if (!globalUserId) return;
  supabaseAdmin.from('positions').insert({
    id: position.id,
    user_id: globalUserId,
    symbol: position.symbol,
    side: position.side,
    qty: position.qty,
    entry_price: position.entryPrice,
    current_price: position.currentPrice,
    unrealized_pnl: position.unrealizedPnl,
    unrealized_pnl_percent: position.unrealizedPnlPercent,
    strategy: position.strategy,
    opened_at: position.openedAt,
    stop_loss: position.stopLoss,
    take_profit: position.takeProfit,
    mode: position.mode,
    leverage: position.leverage,
    margin: position.margin,
    liquidation_price: position.liquidationPrice,
    is_trailing_stop: position.isTrailingStop,
    trailing_stop_percent: position.trailingStopPercent,
    highest_price: position.highestPrice,
    lowest_price: position.lowestPrice
  }).then(({ error }) => handleSyncError('insert position', error));
}

export function syncUpdatePosition(position: Position) {
  if (!globalUserId) return;
  supabaseAdmin.from('positions').update({
    current_price: position.currentPrice,
    unrealized_pnl: position.unrealizedPnl,
    unrealized_pnl_percent: position.unrealizedPnlPercent,
    highest_price: position.highestPrice,
    lowest_price: position.lowestPrice,
    stop_loss: position.stopLoss,
    take_profit: position.takeProfit,
    strategy: position.strategy
  }).eq('id', position.id).then(({ error }) => handleSyncError('update position', error));
}

export function syncDeletePosition(id: string) {
  if (!globalUserId) return;
  supabaseAdmin.from('positions').delete().eq('id', id)
    .then(({ error }) => handleSyncError('delete position', error));
}

export function syncInsertTrade(trade: Trade) {
  if (!globalUserId) return;
  supabaseAdmin.from('trades').insert({
    id: trade.id,
    user_id: globalUserId,
    symbol: trade.symbol,
    side: trade.side,
    qty: trade.qty,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    entry_time: trade.entryTime,
    exit_time: trade.exitTime,
    pnl: trade.pnl,
    pnl_percent: trade.pnlPercent,
    strategy: trade.strategy,
    status: trade.status,
    mode: trade.mode
  }).then(({ error }) => handleSyncError('insert trade', error));
}

export function syncInsertStrategy(strategy: StrategyConfig) {
  if (!globalUserId) return;
  supabaseAdmin.from('strategies').insert({
    id: strategy.id,
    user_id: globalUserId,
    name: strategy.name,
    description: strategy.description,
    symbol: strategy.symbol,
    timeframe: strategy.timeframe,
    direction: strategy.direction,
    type: strategy.type,
    enabled: strategy.enabled,
    status: strategy.status,
    parameters: strategy.parameters,
    risk: strategy.risk,
    stats: strategy.stats,
    created_at: strategy.createdAt,
    updated_at: strategy.updatedAt
  }).then(({ error }) => handleSyncError('insert strategy', error));
}

export function syncUpdateStrategy(strategy: StrategyConfig) {
  if (!globalUserId) return;
  supabaseAdmin.from('strategies').update({
    name: strategy.name,
    description: strategy.description,
    symbol: strategy.symbol,
    timeframe: strategy.timeframe,
    direction: strategy.direction,
    type: strategy.type,
    enabled: strategy.enabled,
    status: strategy.status,
    parameters: strategy.parameters,
    risk: strategy.risk,
    stats: strategy.stats,
    updated_at: strategy.updatedAt
  }).eq('id', strategy.id).then(({ error }) => handleSyncError('update strategy', error));
}

export function syncDeleteStrategy(id: string) {
  if (!globalUserId) return;
  supabaseAdmin.from('strategies').delete().eq('id', id)
    .then(({ error }) => handleSyncError('delete strategy', error));
}

// ==========================================
// MAPPERS
// ==========================================
function mapDbToPosition(db: any): Position {
  return {
    id: db.id,
    symbol: db.symbol,
    side: db.side,
    qty: Number(db.qty),
    entryPrice: Number(db.entry_price),
    currentPrice: Number(db.current_price),
    unrealizedPnl: Number(db.unrealized_pnl),
    unrealizedPnlPercent: Number(db.unrealized_pnl_percent),
    strategy: db.strategy,
    openedAt: db.opened_at,
    stopLoss: db.stop_loss ? Number(db.stop_loss) : undefined,
    takeProfit: db.take_profit ? Number(db.take_profit) : undefined,
    mode: db.mode,
    leverage: db.leverage ? Number(db.leverage) : undefined,
    margin: db.margin ? Number(db.margin) : undefined,
    liquidationPrice: db.liquidation_price ? Number(db.liquidation_price) : undefined,
    isTrailingStop: db.is_trailing_stop,
    trailingStopPercent: db.trailing_stop_percent ? Number(db.trailing_stop_percent) : undefined,
    highestPrice: db.highest_price ? Number(db.highest_price) : undefined,
    lowestPrice: db.lowest_price ? Number(db.lowest_price) : undefined
  };
}

function mapDbToTrade(db: any): Trade {
  return {
    id: db.id,
    symbol: db.symbol,
    side: db.side,
    qty: Number(db.qty),
    entryPrice: Number(db.entry_price),
    exitPrice: Number(db.exit_price),
    entryTime: db.entry_time,
    exitTime: db.exit_time,
    pnl: Number(db.pnl),
    pnlPercent: Number(db.pnl_percent),
    strategy: db.strategy,
    status: db.status,
    mode: db.mode
  };
}

function mapDbToStrategy(db: any): StrategyConfig {
  return {
    id: db.id,
    name: db.name,
    description: db.description,
    symbol: db.symbol,
    timeframe: db.timeframe,
    direction: db.direction,
    type: db.type,
    enabled: db.enabled,
    status: db.status,
    parameters: db.parameters,
    risk: db.risk,
    stats: db.stats,
    createdAt: db.created_at,
    updatedAt: db.updated_at
  };
}
