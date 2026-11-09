export interface TemplateSet {
  readonly setNumber: number;
  readonly targetWeight: number;
  readonly targetReps: number;
}

export interface SessionSet extends TemplateSet {
  readonly actualWeight: number;
  readonly actualReps: number;
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

// Session values are snapshots; editing a template must not change history.
export interface WorkoutSession {
  readonly id: string;
  readonly title: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly exercises: readonly (Omit<TemplateExercise, 'sets'> & {
    readonly sets: readonly SessionSet[];
  })[];
}
