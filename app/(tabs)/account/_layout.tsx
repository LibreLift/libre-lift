import { SectionStack } from '../../../src/views/section-stack';
export default function Layout() {
  return <SectionStack screens={{ index: 'Account', settings: 'Settings', 'sign-in': 'Sign in' }} />;
}
