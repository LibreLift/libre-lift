import { Stack } from 'expo-router';
import { useTheme } from '../viewmodels/theme';

export function SectionStack({ screens }: { screens: Readonly<Record<string, string>> }) {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {Object.entries(screens).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title }} />
      ))}
    </Stack>
  );
}
