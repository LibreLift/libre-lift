import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../viewmodels/theme';
import type { LoadState } from '../viewmodels/workouts';

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export function Copy({
  children,
  kind = 'body',
}: PropsWithChildren<{ kind?: 'title' | 'heading' | 'body' | 'muted' | 'label' }>) {
  const { colors } = useTheme();
  return (
    <Text style={[styles[kind], { color: kind === 'muted' ? colors.secondary : colors.text }]}>
      {children}
    </Text>
  );
}

export function Card({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.selected, opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: colors.onSelected }]}>{label}</Text>
    </Pressable>
  );
}

export function LinkCard({
  title,
  subtitle,
  detail,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  detail?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.link,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Ionicons name={icon} size={26} color={colors.accent} accessible={false} />
      <View style={styles.linkText}>
        <Copy kind="heading">{title}</Copy>
        <Copy kind="muted">{subtitle}</Copy>
        {detail ? <Copy>{detail}</Copy> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text} accessible={false} />
    </Pressable>
  );
}

export function Resource<T>({
  state,
  retry,
  children,
}: {
  state: LoadState<T>;
  retry: () => void;
  children: (data: T) => ReactNode;
}) {
  const { colors } = useTheme();
  if (state.status === 'loading')
    return <ActivityIndicator accessibilityLabel="Loading" color={colors.text} />;
  if (state.status === 'error')
    return (
      <Card>
        <Copy>{state.message}</Copy>
        <Button label="Try again" onPress={retry} />
      </Card>
    );
  return <>{children(state.data)}</>;
}

const styles = StyleSheet.create({
  screen: { padding: 24, gap: 20, paddingBottom: 32, maxWidth: 700, width: '100%', alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.8 },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  muted: { fontSize: 15, lineHeight: 23 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  card: { padding: 20, gap: 12, borderRadius: 18, borderWidth: 1 },
  link: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 88,
  },
  linkText: { flex: 1, gap: 6 },
  button: { padding: 16, borderRadius: 12, minHeight: 48, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
