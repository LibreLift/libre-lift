import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useTemplateExerciseEditorViewModel } from '../viewmodels/template-editor';
import { TemplateSetRows } from './template-set-rows';
import { ExerciseSummary } from './exercise-summary';
import { Button, Card, Copy, Screen } from './ui';

export function TemplateExerciseEditorScreen() {
  const { draftId = '', exerciseId = '' } = useLocalSearchParams<{ draftId?: string; exerciseId?: string }>();
  const model = useTemplateExerciseEditorViewModel(draftId, exerciseId);
  const router = useRouter();
  usePreventRemove(model.saving, () => {});
  const backToTemplate = () => router.dismissTo(draftId === 'new' ? '/templates/new' : {
    pathname: '/templates/[id]', params: { id: draftId },
  });
  if (!model.exercise) return <Screen>
    <Copy>This exercise draft is no longer available.</Copy>
    <Button label="Open templates" onPress={() => router.replace('/templates')} />
  </Screen>;
  return <>
    <Stack.Screen options={{ title: model.exercise.name, gestureEnabled: !model.saving, headerBackVisible: !model.saving }} />
    <Screen>
      <Copy kind="title">{model.exercise.name}</Copy>
      <ExerciseSummary exercise={model.exercise} />
      <Copy kind="heading">{model.exercise.sets.length} {model.exercise.sets.length === 1 ? 'set' : 'sets'}</Copy>
      <TemplateSetRows sets={model.exercise.sets} editor={{
        exerciseNumber: model.exerciseNumber, disabled: model.saving,
        changeSet: model.changeSet, removeSet: model.removeSet,
      }} />
      {!model.exercise.sets.length ? <Card><Copy>Add a set before saving the template.</Copy></Card> : null}
      <Button label={`Add set to exercise ${model.exerciseNumber}`} disabled={model.saving} onPress={model.addSet} />
      <Button label="Done" disabled={model.saving} onPress={backToTemplate} />
    </Screen>
  </>;
}
