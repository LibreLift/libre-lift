import { useState } from 'react';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useAuth } from '../viewmodels/auth';
import { AccountNameForm } from './account-forms';
import { useRouter } from 'expo-router';
import { Button, Card, Copy, Screen } from './ui';
import { SignOutButton } from './sign-out';

export function AccountScreen() {
  const router = useRouter();
  const model = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  usePreventRemove(model.pending, () => {});
  return (
    <Screen>
      <Copy kind="label">LIBRELIFT</Copy>
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
