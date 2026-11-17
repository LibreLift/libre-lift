import { SectionStack } from '../../../src/views/section-stack';
export default function Layout() {
  return <SectionStack screens={{ index: 'LibreLift', new: 'Create template', '[id]': 'Template', catalog: 'Exercise catalog', 'catalog-exercise': 'Exercise' }} />;
}
