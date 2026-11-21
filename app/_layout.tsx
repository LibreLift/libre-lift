import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import type { DisplayNameStore } from '../src/services/display-name-store';
import { bundledExerciseCatalogService, type ExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { createNativeServices } from '../src/services/native-services';
import { themePreferenceStore } from '../src/services/theme-preference-store';
import type { WorkoutService } from '../src/services/workout-service';
import { DisplayNameProvider, useDisplayName } from '../src/viewmodels/display-name';
import { ExerciseCatalogProvider } from '../src/viewmodels/exercise-catalog';
import { ThemeProvider, useTheme } from '../src/viewmodels/theme';
import { WorkoutProvider } from '../src/viewmodels/workout-provider';
import { Button, FormError } from '../src/views/ui';

export default function RootLayout({
  catalogService = bundledExerciseCatalogService, displayNameStore, workoutServiceFactory,
}: {
  catalogService?: ExerciseCatalogService;
  displayNameStore?: DisplayNameStore;
  workoutServiceFactory?: () => WorkoutService;
} = {}) {
  const [services] = useState(() => {
    const native = createNativeServices();
    return {
      displayNameStore: displayNameStore ?? native.displayNameStore,
      workoutService: workoutServiceFactory?.() ?? native.workoutService,
    };
  });

  return (
    <ThemeProvider store={themePreferenceStore}>
      <DisplayNameProvider store={services.displayNameStore}>
        <WorkoutProvider service={services.workoutService}>
          <ExerciseCatalogProvider service={catalogService}>
            <Navigation />
          </ExerciseCatalogProvider>
        </WorkoutProvider>
      </DisplayNameProvider>
    </ThemeProvider>
  );
}

function Navigation() {
  const { scheme, colors, ready } = useTheme();
  const { displayName, status, retry } = useDisplayName();
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
      {ready && status === 'ready' ? (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Protected guard={displayName === null}>
            <Stack.Screen name="onboarding" options={{ headerShown: true, title: 'Welcome' }} />
          </Stack.Protected>
          <Stack.Protected guard={displayName !== null}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
        </Stack>
      ) : (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.background }}>
          {status === 'error' ? <>
            <FormError message="Your local data couldn’t be opened. Please try again." />
            <Button label="Try again" onPress={retry} />
          </> : <ActivityIndicator accessibilityLabel="Loading your settings" color={colors.text} />}
        </SafeAreaView>
      )}
    </NavigationThemeProvider>
  );
}
