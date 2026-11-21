import { createContext, useCallback, useContext, useState, type PropsWithChildren } from 'react';
import type { DisplayNameStore } from '../services/display-name-store';
import { useResource } from './workouts';

function useDisplayNameViewModel(store: DisplayNameStore) {
  const { state, retry } = useResource(useCallback(() => store.read(), [store]));
  const [savedName, setSavedName] = useState<string>();

  async function saveDisplayName(name: string) {
    await store.write(name);
    setSavedName(name);
  }

  return {
    status: state.status,
    displayName: savedName ?? (state.status === 'ready' ? state.data : null),
    retry,
    saveDisplayName,
  };
}

const DisplayNameContext = createContext<ReturnType<typeof useDisplayNameViewModel> | null>(null);

export function DisplayNameProvider({ store, children }: PropsWithChildren<{ store: DisplayNameStore }>) {
  const model = useDisplayNameViewModel(store);
  return <DisplayNameContext.Provider value={model}>{children}</DisplayNameContext.Provider>;
}

export function useDisplayName() {
  const model = useContext(DisplayNameContext);
  if (!model) throw new Error('DisplayNameProvider is required.');
  return model;
}
