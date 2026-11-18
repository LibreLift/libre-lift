import type { AuthClock } from '../src/services/auth-clock';

export function createManualClock(): AuthClock & { advance(milliseconds: number): void } {
  let now = 0;
  const listeners = new Set<() => void>();
  return {
    now: () => now,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    advance(milliseconds) { now += milliseconds; listeners.forEach((listener) => listener()); },
  };
}
