import { Redirect } from 'expo-router';
import { useAuth } from '../src/viewmodels/auth';

export default function Index() {
  const { session } = useAuth();
  return <Redirect href={session ? (session.account.name ? '/templates' : '/account-name') : '/sign-in'} />;
}
