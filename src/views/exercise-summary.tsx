import type { CatalogExercise } from '../models/exercise';
import { Copy } from './ui';

function label(value: string) {
  const words = value.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function ExerciseSummary({ exercise }: { exercise: CatalogExercise }) {
  return (
    <>
      {exercise.primaryMuscles.length > 0 && (
        <Copy kind="muted">Primary muscles · {exercise.primaryMuscles.map(label).join(' · ')}</Copy>
      )}
      {exercise.secondaryMuscles.length > 0 && (
        <Copy kind="muted">Secondary muscles · {exercise.secondaryMuscles.map(label).join(' · ')}</Copy>
      )}
      <Copy kind="muted">
        Equipment · {exercise.equipment.kind === 'none' ? 'No equipment' : label(exercise.equipment.name)}
      </Copy>
    </>
  );
}
