import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemePreference, ThemePreferenceStore } from '../services/theme-preference-store';
import { themes } from '../theme/palette';

function useThemeViewModel(store: ThemePreferenceStore) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writing = useRef(false);
  useEffect(() => {
    let active = true;
    store.read().then(
      (value) => {
        if (active) {
          setPreference(value);
          setReady(true);
        }
      },
      () => {
        if (active) {
          setError('Your saved appearance couldn’t be loaded. Choose it again below.');
          setReady(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [store]);

  async function selectPreference(value: ThemePreference) {
    if (!ready || writing.current) return;
    writing.current = true;
    setSaving(true);
    setError(null);
    try {
      await store.write(value);
      setPreference(value);
    } catch {
      setError('Your appearance couldn’t be saved. Please try again.');
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }

  const scheme = preference === 'system' ? (system ?? 'light') : preference;
  return { preference, scheme, colors: themes[scheme], ready, saving, error, selectPreference };
}

const ThemeContext = createContext<ReturnType<typeof useThemeViewModel> | null>(null);

export function ThemeProvider({ store, children }: PropsWithChildren<{ store: ThemePreferenceStore }>) {
  const value = useThemeViewModel(store);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is required.');
  return theme;
}
