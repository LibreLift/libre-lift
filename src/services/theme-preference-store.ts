import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface ThemePreferenceStore {
  read(): Promise<ThemePreference>;
  write(preference: ThemePreference): Promise<void>;
}

const key = 'librelift.theme.v1';

export const themePreferenceStore: ThemePreferenceStore = {
  async read() {
    const value = await AsyncStorage.getItem(key);
    return value === 'light' || value === 'dark' ? value : 'system';
  },
  write(preference) {
    return AsyncStorage.setItem(key, preference);
  },
};
