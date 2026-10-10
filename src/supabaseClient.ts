import { createClient } from '@supabase/supabase-js';

// Your web app's Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://PLACEHOLDER.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PLACEHOLDER";

export const isSupabaseConfigured = !supabaseUrl.includes('PLACEHOLDER');
export const SUPABASE_URL = supabaseUrl;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

