import { useState } from 'react';
import { TextInput } from 'react-native';
import { useAuth } from '../viewmodels/auth';
import { useTheme } from '../viewmodels/theme';
import { Button, Copy, FormError } from './ui';

const inputOptions = {
  email: { autoCapitalize: 'none', keyboardType: 'email-address', autoComplete: 'email' },
  code: { autoCapitalize: 'none', keyboardType: 'number-pad', autoComplete: 'one-time-code' },
  name: { autoCapitalize: 'words', keyboardType: 'default', autoComplete: 'name' },
} as const;

export function AccountInput({ label, value, onChangeText, disabled, kind = 'email' }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled: boolean;
  kind?: keyof typeof inputOptions;
}) {
  const { colors } = useTheme();
  return <>
    <Copy>{label}</Copy>
    <TextInput
      {...inputOptions[kind]}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      editable={!disabled}
      accessibilityState={{ disabled }}
      autoCorrect={false}
      style={{ borderWidth: 1, borderColor: colors.border, color: colors.text,
        backgroundColor: colors.background, borderRadius: 12, padding: 16, minHeight: 52, fontSize: 18 }}
    />
  </>;
}

export function AccountNameForm({ initialName, onSaved, onCancel }: {
  initialName: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const model = useAuth();
  const [name, setName] = useState(initialName);

  async function save() {
    if (await model.saveName(name)) onSaved?.();
  }

  function cancel() {
    model.clearError();
    onCancel?.();
  }

  return <>
    <AccountInput label="Account name" value={name} onChangeText={setName} disabled={model.pending} kind="name" />
    <FormError message={model.error} />
    {model.nameWait > 0 ? <Copy>Try again in {model.nameWait}s.</Copy> : null}
    <Button label={model.pending ? 'Saving…' : 'Save name'} disabled={model.pending || model.nameWait > 0} onPress={() => void save()} />
    {onCancel ? <Button label="Cancel" disabled={model.pending} onPress={cancel} /> : null}
  </>;
}
