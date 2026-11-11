import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { ThemePreference } from '../services/theme-preference-store';
import { useTheme } from '../viewmodels/theme';
import { Card, Copy, LinkCard, Screen } from './ui';

export function AccountScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Copy kind="label">LIBRELIFT</Copy>
      <Copy kind="title">Room for you.</Copy>
      <Copy kind="muted">Your training belongs to you.</Copy>
      <Card>
        <Copy kind="heading">Welcome to LibreLift</Copy>
        <Copy>Explore sample plans and workout history while we build your training companion.</Copy>
      </Card>
      <LinkCard
        title="Settings"
        subtitle="Make yourself at home"
        icon="settings-outline"
        onPress={() => router.push('/account/settings')}
      />
      <LinkCard
        title="Sign in"
        subtitle="Account access preview"
        icon="person-circle-outline"
        onPress={() => router.push('/account/sign-in')}
      />
    </Screen>
  );
}

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function SettingsScreen() {
  const model = useTheme();
  return (
    <Screen>
      <Copy kind="title">Settings</Copy>
      <Card>
        <Copy kind="heading">Appearance</Copy>
        <Copy kind="muted">Choose your look. System follows your phone’s appearance.</Copy>
        <View accessibilityRole="radiogroup" style={{ gap: 8 }}>
          {options.map(({ value, label }) => {
            const selected = model.preference === value;
            const disabled = !model.ready || model.saving;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                onPress={() => void model.selectPreference(value)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: model.colors.border,
                  backgroundColor: selected ? model.colors.selected : model.colors.background,
                  opacity: pressed || disabled ? 0.6 : 1,
                })}
              >
                <CopySelection label={label} selected={selected} />
              </Pressable>
            );
          })}
        </View>
        {model.error ? <Copy>{model.error}</Copy> : null}
        <Copy kind="muted">
          {model.error
            ? 'Choose an appearance to try again.'
            : !model.ready
            ? 'Loading preference…'
            : model.saving
              ? 'Saving preference…'
              : 'Your preference is saved on this device.'}
        </Copy>
      </Card>
    </Screen>
  );
}

function CopySelection({ label, selected }: { label: string; selected: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 16, fontWeight: '600', color: selected ? colors.onSelected : colors.text }}>
      {label}
      {selected ? '  ✓' : ''}
    </Text>
  );
}

export function SignInScreen() {
  return (
    <Screen>
      <Copy kind="label">ACCOUNT ACCESS PREVIEW</Copy>
      <Copy kind="title">Your next chapter.</Copy>
      <Card>
        <Copy kind="heading">Sign-in is on the way</Copy>
        <Copy>
          You’ll be able to create an account and sign in with email and a password, or an email code.
        </Copy>
        <Copy kind="muted">For now, explore the sample templates and workouts. No account is needed.</Copy>
      </Card>
    </Screen>
  );
}
