import { renderRouter } from 'expo-router/testing-library';
import RootLayout from '../app/_layout';
import type { DisplayNameStore } from '../src/services/display-name-store';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';

export const namedDisplayStore: DisplayNameStore = {
  async read() { return 'Alex'; },
  async write() { throw new Error('Display name writes require a writable fixture.'); },
};

export function renderLocalRouter(options?: Parameters<typeof renderRouter>[1]) {
  return renderRouter({
    appDir: './app',
    overrides: { _layout: () => <RootLayout displayNameStore={namedDisplayStore} workoutServiceFactory={createSampleWorkoutService} /> },
  }, options);
}
