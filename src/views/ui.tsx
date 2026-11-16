import { createContext, useContext, useRef, useState, type ComponentRef, type ComponentProps, type PropsWithChildren, type ReactNode } from 'react';
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

interface ScreenScroll {
  beginDrag(): void;
  endDrag(): void;
  offset(): number;
  scrollAtEdge(pageY: number): void;
}
const ScreenScrollContext = createContext<ScreenScroll | null>(null);
export function useScreenScroll() {
  const scroll = useContext(ScreenScrollContext);
  if (!scroll) throw new Error('Screen is required for reordering.');
  return scroll;
}

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const metrics = useRef({ offset: 0, height: 0, contentHeight: 0, top: 0 });
  const [dragging, setDragging] = useState(false);
  const scroll: ScreenScroll = {
    beginDrag() {
      scrollRef.current?.measureInWindow((_x, y, _width, height) => {
        metrics.current.top = y;
        metrics.current.height = height;
      });
      setDragging(true);
    },
    endDrag() { setDragging(false); },
    offset() { return metrics.current.offset; },
    scrollAtEdge(pageY) {
      const m = metrics.current;
      const delta = pageY < m.top + 80 ? -8 : pageY > m.top + m.height - 80 ? 8 : 0;
      const offset = Math.max(0, Math.min(Math.max(0, m.contentHeight - m.height), m.offset + delta));
      m.offset = offset;
      scrollRef.current?.scrollTo({ y: offset, animated: false });
    },
  };
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
        <ScreenScrollContext.Provider value={scroll}>
          <ScrollView ref={scrollRef} scrollEnabled={!dragging} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.screen}
            scrollEventThrottle={16} onScroll={(event) => { metrics.current.offset = event.nativeEvent.contentOffset.y; }}
            onLayout={(event) => { metrics.current.height = event.nativeEvent.layout.height; }}
            onContentSizeChange={(_width, height) => { metrics.current.contentHeight = height; }}>
            {children}
          </ScrollView>
        </ScreenScrollContext.Provider>
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

export function IconButton({ label, icon, onPress, disabled = false }: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress(): void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled || pressed ? 0.5 : 1 })}>
    <Ionicons name={icon} size={24} color={colors.text} accessible={false} />
  </Pressable>;
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
      accessibilityLabel={`${title}. ${[subtitle, detail].filter(Boolean).join(' ')}`}
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
