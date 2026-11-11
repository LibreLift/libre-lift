import type { CatalogExercise } from './exercise';

export interface TemplateSet {
  readonly setNumber: number;
  readonly targetWeight: number;
  readonly targetReps: number;
}

export interface SessionSet extends TemplateSet {
  readonly actualWeight: number;
  readonly actualReps: number;
}

export interface TemplateExercise extends CatalogExercise {
  readonly id: string;
  readonly sets: readonly TemplateSet[];
}

export interface SessionExercise extends CatalogExercise {
  readonly id: string;
  readonly sets: readonly SessionSet[];
}

function snapshotExercise(exercise: CatalogExercise): CatalogExercise {
  return {
    ...exercise,
    primaryMuscles: [...exercise.primaryMuscles],
    secondaryMuscles: [...exercise.secondaryMuscles],
    equipment: { ...exercise.equipment },
    ...(exercise.instructions ? { instructions: [...exercise.instructions] } : {}),
    ...(exercise.translations ? {
      translations: Object.fromEntries(Object.entries(exercise.translations).flatMap(([locale, content]) => content ? [[locale, {
        ...content,
        ...(content.instructions ? { instructions: [...content.instructions] } : {}),
      }]] : [])),
    } : {}),
    ...(exercise.images ? {
      images: exercise.images.preferred === 'pair'
        ? { ...exercise.images, pair: { ...exercise.images.pair } }
        : { ...exercise.images },
    } : {}),
  };
}

export function createTemplateExercise(
  id: string, exercise: CatalogExercise, sets: readonly TemplateSet[],
): TemplateExercise {
  return { ...snapshotExercise(exercise), id, sets: sets.map((set) => ({ ...set })) };
}

export function createSessionExercise(
  id: string, exercise: CatalogExercise, sets: readonly SessionSet[],
): SessionExercise {
  return { ...snapshotExercise(exercise), id, sets: sets.map((set) => ({ ...set })) };
}

export interface WorkoutTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly exercises: readonly TemplateExercise[];
}

export type TemplateDetails = Pick<WorkoutTemplate, 'title' | 'description'>;

export function validateTemplateDetails(details: TemplateDetails): TemplateDetails {
  const title = details.title.trim();
  if (!title) throw new Error('Enter a title for this template.');
  return { title, description: details.description };
}

// Session values are snapshots; editing a template must not change history.
export interface WorkoutSession {
  readonly id: string;
  readonly title: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly exercises: readonly SessionExercise[];
}
