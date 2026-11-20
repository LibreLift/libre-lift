import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { randomUUID } from 'expo-crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseWorkoutService } from '../src/services/supabase-workout-service';
import type { WorkoutService } from '../src/services/workout-service';
import { themePreferenceStore } from '../src/services/theme-preference-store';
import { ThemeProvider, useTheme } from '../src/viewmodels/theme';
import { AuthProvider, useAuth } from '../src/viewmodels/auth';
import type { AuthClock } from '../src/services/auth-clock';
import type { Account, AuthService, AuthSession } from '../src/services/auth-service';
import { createAppSupabaseRuntime } from '../src/services/supabase-client';
import { WorkoutProvider } from '../src/viewmodels/workout-provider';
import { bundledExerciseCatalogService, type ExerciseCatalogService } from '../src/services/exercise-catalog-service';
import { AppearanceSettings } from '../src/views/account';
import { Button } from '../src/views/ui';
import { SignOutButton } from '../src/views/sign-out';
import { ExerciseCatalogProvider } from '../src/viewmodels/exercise-catalog';

export default function RootLayout({ authService, initialSession, authClock, catalogService: providedCatalogService, workoutServiceFactory }: {
  authService?: AuthService;
  initialSession?: AuthSession;
  authClock?: AuthClock;
  catalogService?: ExerciseCatalogService;
  workoutServiceFactory?: (account: Account | null) => WorkoutService;
} = {}) {
  const [runtime] = useState(createAppSupabaseRuntime);
  const [authentication] = useState(() => authService ?? runtime.authService);
  const [catalogService] = useState(() => providedCatalogService ?? bundledExerciseCatalogService);
  return (
    <AuthProvider service={authentication} initialSession={initialSession} clock={authClock}>
      <ThemeProvider store={themePreferenceStore}>
        <AccountScope factory={workoutServiceFactory} catalogService={catalogService} getClient={runtime.getClient}>
            <Navigation />
        </AccountScope>
      </ThemeProvider>
    </AuthProvider>
  );
}

type AccountServicesProps = PropsWithChildren<{ catalogService: ExerciseCatalogService;
  factory?: (account: Account | null) => WorkoutService; account?: Account | null; getClient: () => SupabaseClient }>;

function AccountScope({ children, ...props }: AccountServicesProps) {
  const { accountGeneration, session } = useAuth();
  return <AccountServices key={`${accountGeneration}:${session?.account.id ?? 'none'}`} {...props} account={session?.account ?? null}>{children}</AccountServices>;
}

function AccountServices({ factory, account = null, catalogService, getClient, children }: AccountServicesProps) {
  const { accountGeneration, isCurrentAccount, reportSessionEnded } = useAuth();
  const [service] = useState(() => factory ? factory(account) : createSupabaseWorkoutService(getClient, randomUUID, {
    accountId: account?.id ?? null,
    isCurrent: () => isCurrentAccount(account?.id ?? null, accountGeneration),
    onSessionEnded: error => reportSessionEnded(account?.id ?? null, accountGeneration, error),
  }));
  return <WorkoutProvider service={service}>
    <ExerciseCatalogProvider service={catalogService}>{children}</ExerciseCatalogProvider>
  </WorkoutProvider>;
}

function Navigation() {
  const { scheme, colors, ready } = useTheme();
  const { session, restoring, loadingRestoredAccount, accountGeneration, notice } = useAuth();
  const router = useRouter();
  const [loadingSettings, setLoadingSettings] = useState(false);
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
        <View style={{ flex: 1 }}>
          {session && notice ? <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
            <Text accessibilityRole="alert" style={{ color: colors.text, padding: 16 }}>{notice}</Text>
          </SafeAreaView> : null}
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Protected guard={!session}><Stack.Screen name="sign-in" options={{ headerShown: true, title: 'Account access' }} /></Stack.Protected>
          <Stack.Protected guard={!!session?.account.name}><Stack.Screen name="(tabs)" /></Stack.Protected>
          <Stack.Protected guard={!!session && !session.account.name}>
            <Stack.Screen name="account-name" options={{ headerShown: true, title: 'Account name' }} />
          </Stack.Protected>
          <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
        </Stack>
        </View>
      ) : (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
            {ready && loadingSettings ? <>
              <AppearanceSettings />
              <Button label="Back to account loading" onPress={() => setLoadingSettings(false)} />
            </> : <>
              <ActivityIndicator accessibilityLabel={ready ? 'Loading account access' : 'Loading appearance'} color={colors.text} />
              {ready ? <>
                <Text style={{ color: colors.text, fontSize: 24 }}>{loadingRestoredAccount ? 'Loading your account' : 'Restoring your account'}</Text>
                <Button label="Settings" onPress={() => setLoadingSettings(true)} />
                <SignOutButton />
              </> : null}
            </>}
          </ScrollView>
        </SafeAreaView>
      )}
    </NavigationThemeProvider>
  );
}
