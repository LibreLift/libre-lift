import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { sampleWorkoutService } from '../src/services/sample-workout-service';
import { themePreferenceStore } from '../src/services/theme-preference-store';
import { ThemeProvider, useTheme } from '../src/viewmodels/theme';
import { WorkoutServiceContext } from '../src/viewmodels/workouts';

export default function RootLayout() {
  return (
    <WorkoutServiceContext.Provider value={sampleWorkoutService}>
      <ThemeProvider store={themePreferenceStore}>
        <Navigation />
      </ThemeProvider>
    </WorkoutServiceContext.Provider>
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
