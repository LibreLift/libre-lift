import type { CatalogExerciseSummary } from '../viewmodels/exercise-catalog';
import { Copy } from './ui';

export function CatalogExerciseFacts({ item }: { item: CatalogExerciseSummary }) {
  return (
    <>
      <Copy kind="muted">Primary muscles: {item.primaryGroups.length ? item.primaryGroups.join(' · ') : 'Not specified'}</Copy>
      {item.secondaryGroups.length ? <Copy kind="muted">Secondary muscles: {item.secondaryGroups.join(' · ')}</Copy> : null}
      <Copy kind="muted">Equipment: {item.equipment}</Copy>
    </>
  );
}
