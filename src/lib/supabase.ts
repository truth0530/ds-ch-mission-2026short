import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const createSupabaseClient = (url?: string, key?: string) => {
  return createClient(url || supabaseUrl, key || supabaseAnonKey);
};

let sbClientInstance: any = null;
export const getSbClient = () => {
  if (!sbClientInstance && supabaseUrl && supabaseAnonKey) {
    sbClientInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return sbClientInstance;
};
