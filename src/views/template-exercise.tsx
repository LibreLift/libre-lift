import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTemplateExerciseViewModel } from '../viewmodels/workouts';
import { CatalogExerciseImages } from './catalog-exercise-images';
import { ExerciseSummary } from './exercise-summary';
import { TemplateSetRows } from './template-set-rows';
import { Button, Card, Copy, Resource, Screen } from './ui';

export function TemplateExerciseDetailScreen() {
  const { templateId = '', exerciseId = '' } = useLocalSearchParams<{ templateId?: string; exerciseId?: string }>();
  const model = useTemplateExerciseViewModel(templateId, exerciseId);
  const router = useRouter();
  return <Screen>
    <Resource {...model}>{(exercise) => exercise ? <>
      <Stack.Screen options={{ title: exercise.name }} />
      <Copy kind="title">{exercise.name}</Copy>
      <CatalogExerciseImages key={exercise.id} images={exercise.images} name={exercise.name} />
      <ExerciseSummary exercise={exercise} />
      <Copy kind="heading">{exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}</Copy>
      <TemplateSetRows sets={exercise.sets.map((set) => ({ reps: String(set.targetReps), weight: String(set.targetWeight) }))} />
    </> : <Card>
      <Copy>This template exercise couldn’t be found.</Copy>
      <Button label="Open templates" onPress={() => router.replace('/templates')} />
    </Card>}</Resource>
  </Screen>;
}
