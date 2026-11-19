import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../viewmodels/auth';
import { AccountInput, AccountNameForm } from './account-forms';
import { Button, Card, Copy, FormError, Screen } from './ui';
import { SignOutButton } from './sign-out';

export function AccountAccessScreen() {
  const model = useAuth();
  const router = useRouter();
  if (model.cleanupPending || model.cleanupError) return <Screen>
    <Copy kind="title">{model.cleanupPending ? 'Signing out' : 'Device sign-out incomplete'}</Copy>
    <FormError message={model.cleanupError} />
    {model.cleanupError ? <Button label="Retry sign-out" onPress={() => void model.signOut()} /> : null}
    <Button label="Settings" onPress={() => router.push('/settings')} />
  </Screen>;
  if (model.restoreError) return <Screen>
    <Copy kind="title">Account access interrupted</Copy>
    <FormError message={model.restoreError} />
    <Button label="Retry account access" onPress={() => void model.restore()} />
    <SignOutButton />
    <Button label="Settings" onPress={() => router.push('/settings')} />
  </Screen>;
  if (model.resolvingAccount) return <Screen>
    <Copy kind="title">Loading your account</Copy>
    <Card>
      <Copy>Your email is verified. We’re loading your account details.</Copy>
      <FormError message={model.error} />
      {model.accountWait > 0 ? <Copy>Try again in {model.accountWait}s.</Copy> : null}
      <Button label={model.pending ? 'Loading account…' : 'Retry loading account'}
        onPress={() => void model.loadAccount()} disabled={model.pending || model.accountWait > 0} />
    </Card>
    <Button label="Settings" onPress={() => router.push('/settings')} />
    <SignOutButton />
  </Screen>;
  const verifying = model.step === 'code';
  const action = verifying ? 'Verify code' : 'Continue with email';
  const progress = verifying ? 'Verifying…' : 'Sending…';
  const retryWait = verifying ? model.verificationWait : model.remaining;
  return <Screen>
    <Copy kind="label">OPENFIT</Copy>
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
      {retryWait > 0 ? <Copy>Try again in {retryWait}s.</Copy> : null}
      <Button label={model.pending ? progress : action}
        onPress={() => void model.submit()} disabled={model.pending || retryWait > 0} />
      {verifying ? <>
        <Button label={model.remaining > 0 ? `Resend code in ${model.remaining}s` : 'Resend code'}
          onPress={() => void model.resend()} disabled={model.pending || model.remaining > 0} />
        <Button label="Change email" onPress={model.changeEmail} disabled={model.pending} />
      </> : null}
    </Card>
    <Button label="Settings" onPress={() => router.push('/settings')} disabled={model.pending} />
  </Screen>;
}

export function AccountNameScreen() {
  const model = useAuth();
  const router = useRouter();
  const [nameDirty, setNameDirty] = useState(false);
  return <Screen>
    <Copy kind="title">What should we call you?</Copy>
    <Card>
      <Copy>Choose a name for your account. You can change it later.</Copy>
      <AccountNameForm initialName="" onDirtyChange={setNameDirty} />
    </Card>
    <Button label="Settings" onPress={() => router.push('/settings')} disabled={model.pending} />
    <SignOutButton unsaved={nameDirty} />
  </Screen>;
}
