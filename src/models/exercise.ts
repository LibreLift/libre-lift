export type CatalogExerciseId = `repdb:${string}`;

export type ExerciseEquipment =
  | { readonly kind: 'none' }
  | { readonly kind: 'required'; readonly name: string };

export interface ExerciseContent {
  readonly name: string;
  readonly instructions?: readonly string[];
}

export type ExerciseLocale = 'en' | 'de' | 'es';

export interface ExerciseImagePair {
  readonly start: string;
  readonly peak: string;
}

export type ExerciseImages =
  | { readonly preferred: 'pair'; readonly pair: ExerciseImagePair; readonly main?: string }
  | { readonly preferred: 'main'; readonly main: string; readonly pair?: never };

export interface CatalogExercise {
  readonly catalogId: CatalogExerciseId;
  readonly name: string;
  readonly primaryMuscles: readonly string[];
  readonly secondaryMuscles: readonly string[];
  readonly equipment: ExerciseEquipment;
  readonly instructions?: readonly string[];
  // Absent locale/content falls back to the English name and instructions above.
  readonly translations?: Readonly<Partial<Record<Exclude<ExerciseLocale, 'en'>, ExerciseContent>>>;
  readonly images?: ExerciseImages;
}
