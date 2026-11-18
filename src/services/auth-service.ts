export type Account = Readonly<{ id: string; email: string; name: string | null }>;
export type AuthSession = Readonly<{
  account: Account;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}>;

export type AuthEvent = { type: 'signed-out' } | { type: 'signed-in' | 'refreshed'; session: AuthSession };

export interface AuthService {
  restoreSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
  subscribe(listener: (event: AuthEvent) => void): () => void;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<AuthSession>;
  loadAccount(account: Account): Promise<Account>;
  updateName(name: string, account: Account): Promise<Account>;
}

export class AuthFailure extends Error {
  constructor(message: string, readonly retryAfterSeconds = 0) {
    super(message);
  }
}
