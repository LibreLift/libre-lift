import { SectionStack } from '../../../src/views/section-stack';
export default function Layout() {
  return <SectionStack screens={{ index: 'OpenFit', new: 'Create template', 'edit-exercise': 'Edit exercise', exercise: 'Exercise', '[id]': 'Template', catalog: 'Exercise catalog', 'catalog-exercise': 'Exercise' }} />;
}
