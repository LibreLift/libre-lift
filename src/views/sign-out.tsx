import { Alert } from 'react-native';
import { useAuth } from '../viewmodels/auth';
import { useWorkouts } from '../viewmodels/workout-provider';
import { Button } from './ui';

export function SignOutButton({ unsaved = false }: { unsaved?: boolean }) {
  const model = useAuth();
  const { savingTemplate, hasUnsavedChanges } = useWorkouts();
  function signOut() {
    if (unsaved || hasUnsavedChanges) Alert.alert('Discard changes and sign out?', 'Your unsaved changes will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void model.signOut() },
    ]);
    else void model.signOut();
  }
  return <Button label="Sign out" disabled={(model.pending && !model.resolvingAccount) || savingTemplate || model.cleanupPending}
    onPress={signOut} />;
}
