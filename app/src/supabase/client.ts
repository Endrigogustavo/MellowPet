import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { secureStoreAdapter } from './secureStoreAdapter';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Falls back to placeholder values instead of throwing so the module can
// still be imported (and its lack of config surfaced as a normal app error)
// in a build that omits Supabase env vars, consistent with how
// `api/client.ts` treats a missing EXPO_PUBLIC_API_BASE_URL.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
