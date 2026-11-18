import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AuthFailure, type AuthService, type AuthSession } from '../services/auth-service';
import { systemAuthClock, type AuthClock } from '../services/auth-clock';

function useAccountAccess(service: AuthService, clock: AuthClock, initialSession?: AuthSession) {
  const [session, setSession] = useState(initialSession ?? null);
  const [verifiedSession, setVerifiedSession] = useState<AuthSession | null>(null);
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
      setSession({ ...verified, account });
      setVerifiedSession(null);
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
    setPending(true);
    setError('');
    try {
      const result = await request();
      if (current !== attempt.current) return false;
      onSuccess(result);
      return true;
    } catch (cause) {
      if (current !== attempt.current) return false;
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
    await perform('verifyCode', () => service.verifyCode(address, code.trim()), setVerifiedSession);
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
      if (account.id !== session.account.id) throw new AuthFailure('Your name could not be saved. Please try again.');
      setSession({ ...session, account });
    });
  }

  return { saveName, clearError: () => setError(''), session, resolvingAccount: !!verifiedSession, loadAccount, accountWait,
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
