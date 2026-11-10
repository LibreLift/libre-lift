export interface TemplateSet {
  readonly setNumber: number;
  readonly targetWeight: number;
  readonly targetReps: number;
}

export interface SessionSet extends TemplateSet {
  readonly actualWeight: number;
  readonly actualReps: number;
}

export interface SessionExercise extends Omit<TemplateExercise, 'sets'> {
  readonly sets: readonly SessionSet[];
}

export interface TemplateExercise {
  readonly id: string;
  readonly name: string;
  readonly muscles: string;
  readonly equipment: string;
  readonly sets: readonly TemplateSet[];
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
