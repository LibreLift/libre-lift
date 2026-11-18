import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthFailure, type Account, type AuthService } from './auth-service';

function accountFrom(user: User): Account {
  return {
    id: user.id,
    email: user.email ?? '',
    name: null,
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

function sessionFrom(session: Session) {
  return { account: accountFrom(session.user), accessToken: session.access_token,
    refreshToken: session.refresh_token, expiresAt: session.expires_at ?? 0 };
}

export function createSupabaseAuthService(getClient: () => SupabaseClient): AuthService {
  async function loadAccount(account: Account): Promise<Account> {
    const { data, error } = await getClient().from('users')
      .select('account_name').eq('id', account.id).maybeSingle();
    if (error) throw failure(error);
    if (data && (typeof data.account_name !== 'string' || !data.account_name.trim())) {
      throw new AuthFailure('Your account could not be loaded. Please try again.');
    }
    return { ...account, name: data ? data.account_name.trim() : null };
  }

  return {
    async restoreSession() {
      const { data, error } = await getClient().auth.getSession();
      if (error) throw failure(error);
      return data.session ? sessionFrom(data.session) : null;
    },
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
    loadAccount,
    async updateName(value, account) {
      const name = value.trim();
      if (!name) throw new AuthFailure('Enter an account name.');
      const users = getClient().from('users');
      const write = account.name === null
        ? users.insert({ id: account.id, account_name: name })
        : users.update({ account_name: name }).eq('id', account.id);
      const { data, error } = await write.select('account_name').single();
      // An insert can succeed even if its response is lost. Recover its stored name
      // on retry instead of overwriting an existing User with an onboarding draft.
      if (error?.code === '23505' && account.name === null) {
        const stored = await loadAccount(account);
        if (stored.name) return stored;
      }
      if (error) throw failure(error);
      if (!data || typeof data.account_name !== 'string' || !data.account_name.trim()) {
        throw new AuthFailure('Your name could not be saved. Please try again.');
      }
      return { ...account, name: data.account_name.trim() };
    },
  };
}
