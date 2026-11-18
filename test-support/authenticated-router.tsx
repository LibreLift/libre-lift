import { renderRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import type { AuthSession } from '../src/services/auth-service';

export const authenticatedSession: AuthSession = {
  account: { id: 'test-account', email: 'alex@example.com', name: 'Alex' },
  accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: 4102444800,
};

export function renderAuthenticatedRouter(
  options?: Parameters<typeof renderRouter>[1],
) {
  return renderRouter({
    appDir: './app',
    overrides: { _layout: () => <RootLayout initialSession={authenticatedSession} /> },
  }, options);
}
