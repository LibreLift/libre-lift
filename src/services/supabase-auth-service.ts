import type { SupabaseClient, User } from '@supabase/supabase-js';
import { AuthFailure, type Account, type AuthService } from './auth-service';

function accountFrom(user: User): Account {
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof user.user_metadata.name === 'string' ? user.user_metadata.name.trim() || null : null,
  };
}

function failure(error: { code?: string; status?: number }): AuthFailure {
  if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
    return new AuthFailure('Too many requests. Please wait before trying again.', 60);
  }
  if (error.code === 'otp_expired' || error.code === 'otp_disabled') {
    return new AuthFailure('That code is invalid or expired. Try again or request a new code.');
  }
  return new AuthFailure('Account access is unavailable. Check your connection and try again.');
}

export function createSupabaseAuthService(getClient: () => SupabaseClient): AuthService {
  return {
    async requestCode(email) {
      const { error } = await getClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw failure(error);
    },
    async verifyCode(email, token) {
      const { data, error } = await getClient().auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw failure(error);
      if (!data.session || !data.user) throw new AuthFailure('Verification did not complete. Please try again.');
      return { account: accountFrom(data.user), accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token, expiresAt: data.session.expires_at ?? 0 };
    },
    async updateName(name) {
      const { data, error } = await getClient().auth.updateUser({ data: { name } });
      if (error) throw failure(error);
      if (!data.user) throw new AuthFailure('Your name could not be saved. Please try again.');
      return accountFrom(data.user);
    },
  };
}
