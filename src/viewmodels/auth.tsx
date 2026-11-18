import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { AuthFailure, AuthSessionEnded, type AuthEvent, type AuthService, type AuthSession } from '../services/auth-service';
import { systemAuthClock, type AuthClock } from '../services/auth-clock';

function useAccountAccess(service: AuthService, clock: AuthClock, initialSession?: AuthSession) {
  const [session, setSession] = useState(initialSession ?? null);
  const currentSession = useRef(initialSession ?? null);
  const restorationSession = useRef<AuthSession | null>(null);
  const recoveringAccount = useRef<string | null>(null);
  const [restoring, setRestoring] = useState(!initialSession);
  const [restoreError, setRestoreError] = useState('');
  const [loadingRestoredAccount, setLoadingRestoredAccount] = useState(false);
  const [accountGeneration, setAccountGeneration] = useState(0);
  const currentGeneration = useRef(0);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [cleanupError, setCleanupError] = useState('');
  const [notice, setNotice] = useState('');
  const cleaning = useRef(false);
  const cleanupRequired = useRef(false);
  const operation = useRef('');
  const [verifiedSession, setVerifiedSession] = useState<AuthSession | null>(null);
  const currentVerifiedSession = useRef<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [pending, setPending] = useState(false);
  // Block repeated taps before React renders the pending state.
  const busy = useRef(false);
  const attempt = useRef(0);
  const [cooldowns, setCooldowns] = useState(() => new Map<string, number>());
  const [now, setNow] = useState(clock.now);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState({ requestCode: 0, verifyCode: 0, loadAccount: 0, saveName: 0 });
  const address = email.trim().toLowerCase();
  const secondsUntil = (deadline: number) => Math.max(0, Math.ceil((deadline - now) / 1000));
  const remaining = secondsUntil(Math.max(cooldowns.get(address) ?? 0, retryAt.requestCode));
  const verificationWait = secondsUntil(retryAt.verifyCode);
  const nameWait = secondsUntil(retryAt.saveName);
  const accountWait = secondsUntil(retryAt.loadAccount);
  const coolingDown = Math.max(remaining, verificationWait, nameWait, accountWait) > 0;

  useEffect(() => () => { attempt.current++; }, []);
  useEffect(() => { if (!initialSession) void restore(); }, [service]);
  const events = useRef(handleAuthEvent);
  events.current = handleAuthEvent;
  useEffect(() => {
    try { return service.subscribe((event) => events.current(event)); }
    catch { /* Restoration reports configuration/storage errors through its recovery UI. */ }
  }, [service]);
  const checkExpiry = useRef(checkSessionExpiry);
  checkExpiry.current = checkSessionExpiry;
  useEffect(() => {
    function foreground(active: boolean) {
      try { service.setForeground(active && !cleanupRequired.current); } catch { /* Restoration reports configuration errors. */ }
      if (active) checkExpiry.current();
    }
    foreground(AppState.currentState === 'active');
    const state = AppState.addEventListener('change', (value) => foreground(value === 'active'));
    const unsubscribe = clock.subscribe(() => checkExpiry.current());
    return () => { state.remove(); unsubscribe(); foreground(false); };
  }, [clock, service]);
  useEffect(() => {
    if (session) {
      try { service.setForeground(AppState.currentState === 'active' && !cleanupRequired.current); } catch { /* Restoration reports configuration errors. */ }
    }
  }, [!!session, service]);

  function checkSessionExpiry() {
    if (!cleaning.current && currentSession.current && currentSession.current.expiresAt * 1000 <= clock.now()) {
      const accountId = currentSession.current.account.id;
      clearAccount();
      recoveringAccount.current = accountId;
      setNotice('Your account was reloaded. Unsaved changes were discarded.');
      void restore();
    }
  }

  function acceptSession(value: AuthSession | null) {
    currentSession.current = value;
    setSession(value);
  }

  function handleAuthEvent(event: AuthEvent) {
    if (cleanupRequired.current) return;
    if (event.type === 'signed-out') {
      clearAccount();
      setError('Your account access ended. Please sign in again.');
    } else if (currentSession.current?.account.id === event.session.account.id) {
      acceptSession({ ...event.session, account: currentSession.current.account });
    } else if (restorationSession.current?.account.id === event.session.account.id) {
      restorationSession.current = event.session;
    } else if (currentVerifiedSession.current?.account.id === event.session.account.id) {
      currentVerifiedSession.current = event.session;
    } else if (!(operation.current === 'verifyCode' && event.session.account.email === address)) {
      if (event.type === 'refreshed' && recoveringAccount.current !== event.session.account.id) return;
      const recovered = recoveringAccount.current === event.session.account.id;
      clearAccount();
      if (recovered) setNotice('Your account was reloaded. Unsaved changes were discarded.');
      void restore(event.session);
    }
  }

  async function restore(supplied?: AuthSession) {
    const current = ++attempt.current;
    restorationSession.current = supplied ?? null;
    setLoadingRestoredAccount(false);
    setRestoring(true);
    setRestoreError('');
    try {
      const restored = supplied ?? await service.restoreSession();
      if (current !== attempt.current) return;
      if (restored) {
        restorationSession.current = restored;
        setLoadingRestoredAccount(true);
        const account = await service.loadAccount(restored.account);
        if (current !== attempt.current) return;
        if (account.id !== restored.account.id) throw new AuthFailure('Your account could not be loaded. Please try again.');
        acceptSession({ ...restorationSession.current, account });
        recoveringAccount.current = null;
      }
    } catch (cause) {
      if (current === attempt.current) {
        if (cause instanceof AuthSessionEnded) {
          void signOut(cause.message);
        } else setRestoreError(cause instanceof Error ? cause.message : 'Account access is unavailable. Please try again.');
      }
    } finally {
      if (current === attempt.current) {
        restorationSession.current = null;
        setRestoring(false);
        setLoadingRestoredAccount(false);
      }
    }
  }

  function clearAccount() {
    attempt.current++;
    busy.current = false;
    operation.current = '';
    setPending(false);
    acceptSession(null);
    restorationSession.current = null;
    recoveringAccount.current = null;
    setLoadingRestoredAccount(false);
    setVerifiedSession(null);
    currentVerifiedSession.current = null;
    setRestoring(false);
    setRestoreError('');
    setError('');
    setNotice('');
    setEmail('');
    setCode('');
    setStep('email');
    currentGeneration.current++;
    setAccountGeneration(currentGeneration.current);
  }

  function reportSessionEnded(accountId: string | null, generation: number, cause: AuthSessionEnded) {
    if (generation !== currentGeneration.current || !accountId || currentSession.current?.account.id !== accountId) return;
    void signOut(cause.message);
  }

  async function signOut(message = '') {
    if (cleaning.current) return;
    cleaning.current = true;
    cleanupRequired.current = true;
    try { service.setForeground(false); } catch { /* Local sign-out reports cleanup failures below. */ }
    clearAccount();
    const current = attempt.current;
    setCleanupPending(true);
    setCleanupError('');
    try {
      await service.signOut();
      if (current === attempt.current) { cleanupRequired.current = false; setError(message); }
    } catch {
      if (current === attempt.current) setCleanupError('Device sign-out could not be completed. Please retry.');
    } finally {
      if (current === attempt.current) { cleaning.current = false; setCleanupPending(false); }
    }
  }
  useEffect(() => {
    if (coolingDown) return clock.subscribe(() => setNow(clock.now()));
  }, [clock, coolingDown]);

  useEffect(() => {
    if (verifiedSession) void loadAccount(verifiedSession);
  }, [verifiedSession]);

  async function loadAccount(verified = verifiedSession) {
    if (!verified) return;
    await perform('loadAccount', () => service.loadAccount(verified.account), (account) => {
      if (account.id !== verified.account.id) throw new AuthFailure('Your account could not be loaded. Please try again.');
      acceptSession({ ...(currentVerifiedSession.current ?? verified), account });
      setVerifiedSession(null);
      currentVerifiedSession.current = null;
    });
  }

  async function perform<T>(
    kind: keyof typeof retryAt,
    request: () => Promise<T>,
    onSuccess: (result: T) => void,
  ) {
    if (busy.current || retryAt[kind] > clock.now()) return false;
    const current = attempt.current;
    busy.current = true;
    operation.current = kind;
    setPending(true);
    setError('');
    try {
      const result = await request();
      if (current !== attempt.current) return false;
      onSuccess(result);
      return true;
    } catch (cause) {
      if (current !== attempt.current) return false;
      if (cause instanceof AuthSessionEnded) { void signOut(cause.message); return false; }
      setError(cause instanceof Error ? cause.message : 'Account access failed. Please try again.');
      if (cause instanceof AuthFailure && cause.retryAfterSeconds > 0) {
        const deadline = clock.now() + cause.retryAfterSeconds * 1000;
        setRetryAt((previous) => ({ ...previous, [kind]: deadline }));
        setNow(clock.now());
      }
      return false;
    } finally {
      if (current === attempt.current) {
        busy.current = false;
        operation.current = '';
        setPending(false);
      }
    }
  }

  async function sendCode() {
    if ((cooldowns.get(address) ?? 0) > clock.now()) return;
    await perform('requestCode', () => service.requestCode(address), () => {
      const deadline = clock.now() + 60000;
      setCooldowns((previous) => new Map(previous).set(address, deadline));
      setNow(clock.now());
      setEmail(address);
      setCode('');
      setStep('code');
    });
  }

  async function submit() {
    if (busy.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    if (step === 'email') return sendCode();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the six-digit code from your email.');
      return;
    }
    await perform('verifyCode', () => service.verifyCode(address, code.trim()), (verified) => {
      currentVerifiedSession.current = verified;
      setVerifiedSession(verified);
    });
  }

  function changeEmail() {
    if (busy.current) return;
    attempt.current++;
    setCode('');
    setError('');
    setStep('email');
  }

  async function saveName(value: string) {
    const name = value.trim();
    if (!name) {
      setError('Enter an account name.');
      return false;
    }
    if (!session) return false;
    return perform('saveName', () => service.updateName(name, session.account), (account) => {
      const latest = currentSession.current;
      if (!latest || account.id !== latest.account.id) throw new AuthFailure('Your name could not be saved. Please try again.');
      acceptSession({ ...latest, account });
    });
  }

  return { notice, accountGeneration, reportSessionEnded, signOut, cleanupPending, cleanupError, restoring, restoreError, restore, loadingRestoredAccount, saveName, clearError: () => setError(''), session, resolvingAccount: !!verifiedSession, loadAccount, accountWait,
    email, setEmail, code, setCode, step, pending, error, submit,
    verificationWait, nameWait, remaining, resend: sendCode, changeEmail };
}

const AuthContext = createContext<ReturnType<typeof useAccountAccess> | null>(null);
export function AuthProvider({ service, initialSession, clock = systemAuthClock, children }: PropsWithChildren<{
  service: AuthService; initialSession?: AuthSession; clock?: AuthClock;
}>) {
  const value = useAccountAccess(service, clock, initialSession);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
