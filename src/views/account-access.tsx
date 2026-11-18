import { useRouter } from 'expo-router';
import { useAuth } from '../viewmodels/auth';
import { AccountInput, AccountNameForm } from './account-forms';
import { Button, Card, Copy, FormError, Screen } from './ui';

export function AccountAccessScreen() {
  const model = useAuth();
  const router = useRouter();
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
  </Screen>;
  const verifying = model.step === 'code';
  const action = verifying ? 'Verify code' : 'Continue with email';
  const progress = verifying ? 'Verifying…' : 'Sending…';
  const retryWait = verifying ? model.verificationWait : model.remaining;
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
  return <Screen>
    <Copy kind="title">What should we call you?</Copy>
    <Card>
      <Copy>Choose a name for your account. You can change it later.</Copy>
      <AccountNameForm initialName="" />
    </Card>
    <Button label="Settings" onPress={() => router.push('/settings')} disabled={model.pending} />
  </Screen>;
}
