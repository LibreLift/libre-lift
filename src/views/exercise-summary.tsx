import type { CatalogExercise } from '../models/exercise';
import { Copy } from './ui';

function label(value: string) {
  const words = value.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function exerciseSummaryText(exercise: CatalogExercise): string {
  return [
    ...(exercise.primaryMuscles.length ? [`Primary muscles · ${exercise.primaryMuscles.map(label).join(' · ')}`] : []),
    ...(exercise.secondaryMuscles.length ? [`Secondary muscles · ${exercise.secondaryMuscles.map(label).join(' · ')}`] : []),
    `Equipment · ${exercise.equipment.kind === 'none' ? 'No equipment' : label(exercise.equipment.name)}`,
  ].join(' · ');
}

export function ExerciseSummary({ exercise }: { exercise: CatalogExercise }) {
  return <Copy kind="muted">{exerciseSummaryText(exercise)}</Copy>;
}
