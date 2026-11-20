import type { CatalogExercise } from './exercise';
// Keep the existing repetition limit in the editor across the storage cutover.
const MAX_TARGET_REPS = 2147483647;

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
  readonly createdAt?: string;
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

export type TemplateContent = Omit<WorkoutTemplate, 'id'>;

export function snapshotTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return { ...template, exercises: template.exercises.map((exercise) =>
    createTemplateExercise(exercise.id, exercise, exercise.sets)) };
}

export function validateTemplate(content: TemplateContent): TemplateContent {
  const details = validateTemplateDetails(content);
  if (!content.exercises.length) throw new Error('Add at least one exercise.');
  const ids = new Set<string>();
  const exercises = content.exercises.map((exercise, index) => {
    if (!exercise.id || ids.has(exercise.id)) throw new Error('Exercise placements must have unique identities.');
    ids.add(exercise.id);
    if (!exercise.sets.length) throw new Error(`Add at least one set to exercise ${index + 1}.`);
    const sets = exercise.sets.map((set, setIndex) => {
      if (!Number.isFinite(set.targetWeight) || set.targetWeight < 0)
        throw new Error(`Exercise ${index + 1}, set ${setIndex + 1}: enter a weight of zero or more.`);
      if (!Number.isInteger(set.targetReps) || set.targetReps < 1)
        throw new Error(`Exercise ${index + 1}, set ${setIndex + 1}: enter a positive whole number of reps.`);
      if (set.targetReps > MAX_TARGET_REPS)
        throw new Error(`Exercise ${index + 1}, set ${setIndex + 1}: enter ${MAX_TARGET_REPS} reps or fewer.`);
      return { ...set, setNumber: setIndex + 1 };
    });
    return createTemplateExercise(exercise.id, exercise, sets);
  });
  return { ...details, exercises };
}
