import type { CatalogExerciseSummary } from '../viewmodels/exercise-catalog';
import { Copy } from './ui';

export function catalogExerciseFacts(item: CatalogExerciseSummary): readonly string[] {
  return [
    `Primary muscles: ${item.primaryGroups.length ? item.primaryGroups.join(' · ') : 'Not specified'}`,
    ...(item.secondaryGroups.length ? [`Secondary muscles: ${item.secondaryGroups.join(' · ')}`] : []),
    `Equipment: ${item.equipment}`,
  ];
}

export function CatalogExerciseFacts({ item }: { item: CatalogExerciseSummary }) {
  return (
    <>
      {catalogExerciseFacts(item).map((fact) => <Copy key={fact} kind="muted">{fact}</Copy>)}
    </>
  );
}
