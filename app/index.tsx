import { Redirect } from 'expo-router';
import { useDisplayName } from '../src/viewmodels/display-name';

export default function Index() {
  const { displayName } = useDisplayName();
  return <Redirect href={displayName === null ? '/onboarding' : '/templates'} />;
}
