import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ThemePreference } from '../services/theme-preference-store';
import { useDisplayName } from '../viewmodels/display-name';
import { useTheme } from '../viewmodels/theme';
import { DisplayNameForm } from './display-name';
import { Button, Card, Copy, FormError, Screen } from './ui';

export function SettingsScreen() {
  const { displayName } = useDisplayName();
  const [editing, setEditing] = useState(false);
  return (
    <Screen>
      <Card>
        {editing ? (
          <DisplayNameForm initialName={displayName ?? ''} onDone={() => setEditing(false)} />
        ) : <>
          <Copy kind="heading">Display name</Copy>
          <Copy>{displayName}</Copy>
          <Button label="Edit name" onPress={() => setEditing(true)} />
        </>}
      </Card>
      <AppearanceSettings />
    </Screen>
  );
}

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function AppearanceSettings() {
  const model = useTheme();
  return (
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
