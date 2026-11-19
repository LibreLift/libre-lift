import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ThemePreferenceStore {
  read(): Promise<ThemePreference>;
  write(preference: ThemePreference): Promise<void>;
}

const key = 'openfit.theme.v1';
const legacyKey = 'librelift.theme.v1';

export const themePreferenceStore: ThemePreferenceStore = {
  async read() {
    const value = (await AsyncStorage.getItem(key)) ?? (await AsyncStorage.getItem(legacyKey));
    return value === 'light' || value === 'dark' ? value : 'system';
  },
  write(preference) {
    return AsyncStorage.setItem(key, preference);
  },
};
