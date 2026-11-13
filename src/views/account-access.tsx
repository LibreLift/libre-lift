import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { useAuth } from '../viewmodels/auth';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy, FormError, Screen } from './ui';

export function AccountInput({ label, value, onChangeText, disabled, kind = 'email' }: {
  label: string; value: string; onChangeText: (value: string) => void; disabled: boolean; kind?: 'email' | 'code' | 'name';
}) {
  const { colors } = useTheme();
  return <>
    <Copy>{label}</Copy>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
    editable={!disabled} accessibilityState={{ disabled }} autoCapitalize={kind === 'name' ? 'words' : 'none'} autoCorrect={false}
    keyboardType={kind === 'code' ? 'number-pad' : kind === 'email' ? 'email-address' : 'default'}
    autoComplete={kind === 'code' ? 'one-time-code' : kind === 'email' ? 'email' : 'name'}
    style={{ borderWidth: 1, borderColor: colors.border, color: colors.text,
      backgroundColor: colors.background, borderRadius: 12, padding: 16, minHeight: 52, fontSize: 18 }} />
  </>;
}

export function AccountAccessScreen() {
  const model = useAuth();
  const router = useRouter();
  const verifying = model.step === 'code';
  return <Screen>
    <Copy kind="label">LIBRELIFT</Copy>
    <Copy kind="title">Your training starts here.</Copy>
    <Card>
      <Copy kind="heading">{verifying ? 'Check your email' : 'Continue with email'}</Copy>
      {verifying ? <>
        <Copy>{model.email}</Copy>
        <Copy kind="muted">Enter your six-digit code. It expires in 10 minutes.</Copy>
        <AccountInput label="Email code" value={model.code} onChangeText={model.setCode} disabled={model.pending} kind="code" />
      </> : <>
        <Copy>We’ll email you a code to create an account or sign in. No password needed.</Copy>
        <AccountInput label="Email" value={model.email} onChangeText={model.setEmail} disabled={model.pending} />
      </>}
      <FormError message={model.error} />
      {model.verificationWait > 0 ? <Copy>Try again in {model.verificationWait}s.</Copy> : null}
      <Button label={model.pending ? (verifying ? 'Verifying…' : 'Sending…') : verifying ? 'Verify code' : 'Continue with email'}
        onPress={() => void model.submit()} disabled={model.pending || (verifying ? model.verificationWait > 0 : model.remaining > 0)} />
      {verifying ? <>
        <Button label={model.remaining > 0 ? `Resend code in ${model.remaining}s` : 'Resend code'}
          onPress={() => void model.resend()} disabled={model.pending || model.remaining > 0} />
        <Button label="Change email" onPress={model.changeEmail} disabled={model.pending} />
      </> : model.remaining > 0 ? <Copy>Try again in {model.remaining}s.</Copy> : null}
    </Card>
    <Button label="Settings" onPress={() => router.push('/settings')} disabled={model.pending} />
  </Screen>;
}

export function AccountNameScreen() {
  const model = useAuth();
  const [name, setName] = useState('');
  const router = useRouter();
  return <Screen>
    <Copy kind="title">What should we call you?</Copy>
    <Card>
      <Copy>Choose a name for your account. You can change it later.</Copy>
      <AccountInput label="Account name" value={name} onChangeText={setName} disabled={model.pending} kind="name" />
      <FormError message={model.error} />
      {model.nameWait > 0 ? <Copy>Try again in {model.nameWait}s.</Copy> : null}
      <Button label={model.pending ? 'Saving…' : 'Save name'} disabled={model.pending || model.nameWait > 0} onPress={() => void model.saveName(name)} />
    </Card>
    <Button label="Settings" onPress={() => router.push('/settings')} disabled={model.pending} />
  </Screen>;
}
