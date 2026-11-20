import { useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useAuth } from '../viewmodels/auth';
import { AccountNameForm } from './account-forms';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { ThemePreference } from '../services/theme-preference-store';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy, FormError, Screen } from './ui';
import { SignOutButton } from './sign-out';

export function AccountScreen() {
  const router = useRouter();
  const model = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  usePreventRemove(model.pending, () => {});
  return (
    <Screen>
      <Copy kind="label">OPENFIT</Copy>
      <Copy kind="title">Your account</Copy>
      <Card>
        {editing ? (
          <AccountNameForm
            initialName={model.session?.account.name ?? ''}
            onSaved={() => { setEditing(false); setNameDirty(false); }}
            onCancel={() => { setEditing(false); setNameDirty(false); }}
            onDirtyChange={setNameDirty}
          />
        ) : <>
          <Copy kind="heading">{model.session?.account.name}</Copy>
          <Button label="Edit name" onPress={() => { model.clearError(); setEditing(true); }} />
        </>}
        <Copy>{model.session?.account.email}</Copy>
      </Card>
      <Button label="Settings" disabled={model.pending} onPress={() => router.push('/account/settings')} />
      <SignOutButton unsaved={nameDirty} />
    </Screen>
  );
}

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function SettingsScreen() {
  return <Screen><AppearanceSettings /></Screen>;
}

export function AppearanceSettings() {
  const model = useTheme();
  return (
    <>
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
                accessibilityLabel={label}
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
        <FormError message={model.error ?? ''} />
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
    </>
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
