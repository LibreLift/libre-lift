import { SectionStack } from '../../../src/views/section-stack';
export default function Layout() {
  return <SectionStack screens={{ index: 'Workouts', '[id]': 'Workout details' }} />;
}
