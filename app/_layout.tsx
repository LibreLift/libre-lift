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
import { AuthProvider, useAuth } from '../src/viewmodels/auth';
import type { AuthClock } from '../src/services/auth-clock';
import type { AuthService, AuthSession } from '../src/services/auth-service';
import { createAppAuthService } from '../src/services/supabase-client';
import { WorkoutProvider } from '../src/viewmodels/workout-provider';
import { createExerciseCatalogService, type ExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { ExerciseCatalogProvider } from '../src/viewmodels/exercise-catalog';

export default function RootLayout({ service: providedService, authService, initialSession, authClock, catalogService: providedCatalogService }: {
  service?: WorkoutService;
  authService?: AuthService;
  initialSession?: AuthSession;
  authClock?: AuthClock;
  catalogService?: ExerciseCatalogService;
} = {}) {
  const [service] = useState(() => providedService ?? createSampleWorkoutService());
  const [authentication] = useState(() => authService ?? createAppAuthService());
  const [catalogService] = useState(() => providedCatalogService ?? createExerciseCatalogService((url) => fetch(url)));
  return (
    <AuthProvider service={authentication} initialSession={initialSession} clock={authClock}>
      <WorkoutProvider service={service}>
        <ExerciseCatalogProvider service={catalogService}>
          <ThemeProvider store={themePreferenceStore}>
            <Navigation />
          </ThemeProvider>
        </ExerciseCatalogProvider>
      </WorkoutProvider>
    </AuthProvider>
  );
}

function Navigation() {
  const { scheme, colors, ready } = useTheme();
  const { session } = useAuth();
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
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Protected guard={!session}><Stack.Screen name="sign-in" options={{ headerShown: true, title: 'Account access' }} /></Stack.Protected>
          <Stack.Protected guard={!!session?.account.name}><Stack.Screen name="(tabs)" /></Stack.Protected>
          <Stack.Protected guard={!!session && !session.account.name}>
            <Stack.Screen name="account-name" options={{ headerShown: true, title: 'Account name' }} />
          </Stack.Protected>
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        </Stack>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator accessibilityLabel="Loading appearance" color={colors.text} />
        </View>
      )}
    </NavigationThemeProvider>
  );
}
