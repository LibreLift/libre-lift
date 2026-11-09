import { useCallback, type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themePreferenceStore, type ThemePreferenceStore } from '../src/services/theme-preference-store';
import { ThemeProvider, useTheme } from '../src/viewmodels/theme';
import { useResource } from '../src/viewmodels/workouts';

test('failed data requests can be retried', async () => {
  const load = jest
    .fn<Promise<string[]>, []>()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce([]);
  const { result } = await renderHook(() => useResource(load));
  await waitFor(() => expect(result.current.state.status).toBe('error'));
  await act(async () => result.current.retry());
  await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: [] }));
});

test('a late response cannot replace the data for a newer selection', async () => {
  let finishOld: (value: string) => void = () => {};
  const oldRequest = new Promise<string>((resolve) => {
    finishOld = resolve;
  });
  const { result, rerender } = await renderHook(
    ({ id }: { id: string }) =>
      useResource(useCallback(() => (id === 'old' ? oldRequest : Promise.resolve('new')), [id])),
    { initialProps: { id: 'old' } },
  );
  await rerender({ id: 'new' });
  await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: 'new' }));
  await act(async () => finishOld('old'));
  expect(result.current.state).toEqual({ status: 'ready', data: 'new' });
});

test('appearance survives remount and System follows the phone', async () => {
  await AsyncStorage.clear();
  const phone = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
  const wrapper = ({ children }: PropsWithChildren) => (
    <ThemeProvider store={themePreferenceStore}>{children}</ThemeProvider>
  );
  const first = await renderHook(useTheme, { wrapper });
  await waitFor(() => expect(first.result.current.ready).toBe(true));
  expect(first.result.current.preference).toBe('system');
  expect(first.result.current.scheme).toBe('dark');
  phone.mockReturnValue('light');
  await first.rerender({});
  expect(first.result.current.scheme).toBe('light');
  await act(async () => first.result.current.selectPreference('dark'));
  await first.unmount();
  const second = await renderHook(useTheme, { wrapper });
  await waitFor(() => expect(second.result.current.ready).toBe(true));
  expect(second.result.current.preference).toBe('dark');
  expect(second.result.current.scheme).toBe('dark');
  phone.mockRestore();
});

test('storage failures leave settings usable and allow a save retry', async () => {
  const store: ThemePreferenceStore = {
    read: jest.fn().mockRejectedValue(new Error('Unreadable')),
    write: jest.fn().mockRejectedValueOnce(new Error('Full')).mockResolvedValueOnce(undefined),
  };
  const wrapper = ({ children }: PropsWithChildren) => (
    <ThemeProvider store={store}>{children}</ThemeProvider>
  );
  const { result } = await renderHook(useTheme, { wrapper });
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.error).toMatch(/couldn’t be loaded/);
  await act(async () => result.current.selectPreference('dark'));
  expect(result.current.preference).toBe('system');
  expect(result.current.error).toMatch(/couldn’t be saved/);
  await act(async () => result.current.selectPreference('dark'));
  expect(result.current.preference).toBe('dark');
  expect(result.current.error).toBeNull();
});
