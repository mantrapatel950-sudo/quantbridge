import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const rawUrl = process.env.VITE_SUPABASE_URL || '';
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes('placeholder') &&
  rawUrl.startsWith('http')
);

const supabaseUrl = isSupabaseAdminConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseServiceKey = isSupabaseAdminConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (!isSupabaseAdminConfigured) {
  console.log('ℹ️ Running in local standalone mode (Supabase cloud sync is disabled).');
}

// Service role client bypasses RLS for the backend engine
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

