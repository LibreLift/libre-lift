import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useState } from 'react';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import type { WorkoutService } from '../src/services/workout-service';
import { themePreferenceStore } from '../src/services/theme-preference-store';
import { ThemeProvider, useTheme } from '../src/viewmodels/theme';
import { WorkoutProvider } from '../src/viewmodels/workout-provider';

export default function RootLayout({ service: providedService }: { service?: WorkoutService } = {}) {
  const [service] = useState(() => providedService ?? createSampleWorkoutService());
  return (
    <WorkoutProvider service={service}>
      <ThemeProvider store={themePreferenceStore}>
        <Navigation />
      </ThemeProvider>
    </WorkoutProvider>
  );
}

function Navigation() {
  const { scheme, colors, ready } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <NavigationThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.text,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
      }}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {ready ? (
        <Stack screenOptions={{ headerShown: false }} />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator accessibilityLabel="Loading appearance" color={colors.text} />
        </View>
      )}
    </NavigationThemeProvider>
  );
}
