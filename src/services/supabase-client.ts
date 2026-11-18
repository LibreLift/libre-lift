import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AuthFailure } from './auth-service';
import { createSupabaseAuthService } from './supabase-auth-service';

const configurationError = 'Account access is not configured. Check the app settings and try again.';

export function createAppAuthService() {
  let client: SupabaseClient | undefined;
  return createSupabaseAuthService(() => {
    if (client) return client;
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key || key.startsWith('replace-with-')) {
      throw new AuthFailure(configurationError);
    }
    try {
      client = createClient(url, key, {
        auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true,
          detectSessionInUrl: false, lock: processLock },
      });
      return client;
    } catch {
      throw new AuthFailure(configurationError);
    }
  });
}
