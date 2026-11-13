export interface AuthClock {
  now(): number;
  subscribe(listener: () => void): () => void;
}

export const systemAuthClock: AuthClock = {
  now: () => Date.now(),
  subscribe(listener) {
    const timer = setInterval(listener, 1000);
    return () => clearInterval(timer);
  },
};
