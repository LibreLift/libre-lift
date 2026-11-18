import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { AuthFailure, AuthSessionEnded, type Account, type AuthService } from './auth-service';

function accountFrom(user: User): Account {
  return {
    id: user.id,
    email: user.email ?? '',
    name: null,
  };
}

function failure(error: { code?: string; status?: number }): AuthFailure {
  if (['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'user_not_found', 'user_banned'].includes(error.code ?? '')) {
    return new AuthSessionEnded('Your account access ended. Please sign in again.');
  }
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
    setForeground(active) {
      const auth = getClient().auth;
      void (active ? auth.startAutoRefresh() : auth.stopAutoRefresh()).catch(() => {
        // A retryable SDK refresh failure is handled at expiry by the app's recovery gate.
      });
    },
    subscribe(listener) {
      const { data: { subscription } } = getClient().auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') listener({ type: 'signed-out' });
        else if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
          listener({ type: event === 'SIGNED_IN' ? 'signed-in' : 'refreshed', session: sessionFrom(session) });
        }
      });
      return () => subscription.unsubscribe();
    },
    signOut() {
      const auth = getClient().auth;
      // SIGNED_OUT is emitted after durable local removal, before server revocation.
      // Resolve then so an offline server cannot delay local sign-out.
      return new Promise<void>((resolve, reject) => {
        const { data: { subscription } } = auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT') { subscription.unsubscribe(); resolve(); }
        });
        void auth.signOut({ scope: 'local' }).then(({ error }) => {
          subscription.unsubscribe();
          if (error) reject(new AuthFailure('Device sign-out could not be completed. Please retry.'));
          else resolve();
        }, () => {
          subscription.unsubscribe();
          reject(new AuthFailure('Device sign-out could not be completed. Please retry.'));
        });
      });
    },
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
      return sessionFrom(data.session);
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
