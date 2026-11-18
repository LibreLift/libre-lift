import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { createSampleWorkoutService } from '../src/services/sample-workout-service';
import type { WorkoutService } from '../src/services/workout-service';
import { themePreferenceStore } from '../src/services/theme-preference-store';
import { ThemeProvider, useTheme } from '../src/viewmodels/theme';
import { AuthProvider, useAuth } from '../src/viewmodels/auth';
import type { AuthClock } from '../src/services/auth-clock';
import type { Account, AuthService, AuthSession } from '../src/services/auth-service';
import { createAppAuthService } from '../src/services/supabase-client';
import { WorkoutProvider } from '../src/viewmodels/workout-provider';
import { createExerciseCatalogService, type ExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { ExerciseCatalogProvider } from '../src/viewmodels/exercise-catalog';

export default function RootLayout({ service: providedService, authService, initialSession, authClock, catalogService: providedCatalogService, workoutServiceFactory }: {
  service?: WorkoutService;
  authService?: AuthService;
  initialSession?: AuthSession;
  authClock?: AuthClock;
  catalogService?: ExerciseCatalogService;
  workoutServiceFactory?: (account: Account | null) => WorkoutService;
} = {}) {
  const [authentication] = useState(() => authService ?? createAppAuthService());
  const [catalogService] = useState(() => providedCatalogService ?? createExerciseCatalogService((url) => fetch(url)));
  return (
    <AuthProvider service={authentication} initialSession={initialSession} clock={authClock}>
      <ThemeProvider store={themePreferenceStore}>
        <AccountScope service={providedService} factory={workoutServiceFactory} catalogService={catalogService}>
            <Navigation />
        </AccountScope>
      </ThemeProvider>
    </AuthProvider>
  );
}

type AccountServicesProps = PropsWithChildren<{ service?: WorkoutService; catalogService: ExerciseCatalogService;
  factory?: (account: Account | null) => WorkoutService; account?: Account | null }>;

function AccountScope({ children, ...props }: AccountServicesProps) {
  const { accountGeneration, session } = useAuth();
  return <AccountServices key={`${accountGeneration}:${session?.account.id ?? 'none'}`} {...props} account={session?.account ?? null}>{children}</AccountServices>;
}

function AccountServices({ service: provided, factory, account = null, catalogService, children }: AccountServicesProps) {
  const [service] = useState(() => factory ? factory(account) : provided ?? createSampleWorkoutService());
  return <WorkoutProvider service={service}>
    <ExerciseCatalogProvider service={catalogService}>{children}</ExerciseCatalogProvider>
  </WorkoutProvider>;
}

function Navigation() {
  const { scheme, colors, ready } = useTheme();
  const { session, restoring, loadingRestoredAccount, accountGeneration } = useAuth();
  const router = useRouter();
  const entry = session ? (session.account.name ? '/templates' : '/account-name') : '/sign-in';
  useEffect(() => {
    if (ready && !restoring && accountGeneration > 0) router.replace(entry);
  }, [ready, restoring, accountGeneration, entry, router]);
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
      {ready && !restoring ? (
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
          <ActivityIndicator accessibilityLabel={ready ? 'Loading account access' : 'Loading appearance'} color={colors.text} />
          {ready ? <Text style={{ color: colors.text }}>{loadingRestoredAccount ? 'Loading your account' : 'Restoring your account'}</Text> : null}
        </View>
      )}
    </NavigationThemeProvider>
  );
}
