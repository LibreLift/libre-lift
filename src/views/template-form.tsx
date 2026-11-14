import { useRouter } from 'expo-router';
import { TextInput } from 'react-native';
import type { useTemplateEditorViewModel } from '../viewmodels/template-editor';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy } from './ui';
import { ReorderableExercises } from './reorderable-exercises';
import { ExerciseSummary } from './exercise-summary';

type Editor = ReturnType<typeof useTemplateEditorViewModel>;

export function TemplateField({ label, value, onChange, disabled, numeric = false, multiline = false }: {
  label: string; value: string; onChange(value: string): void; disabled: boolean; numeric?: boolean; multiline?: boolean;
}) {
  const { colors } = useTheme();
  return <>
    <Copy>{label}</Copy>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
      editable={!disabled} accessibilityState={{ disabled }} multiline={multiline}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10,
        backgroundColor: colors.background, color: colors.text, padding: 12, fontSize: 16,
        minHeight: multiline ? 96 : 48, ...(multiline ? { textAlignVertical: 'top' } : {}) }} />
  </>;
}

export function TemplateForm({ model }: { model: Editor }) {
  const router = useRouter();
  const draft = model.draft;
  if (!draft) return null;
  return <>
    <Card>
      <Copy kind="heading">Edit template</Copy>
      <TemplateField label="Template title" value={draft.title} onChange={(value) => model.change('title', value)} disabled={model.saving} />
      <TemplateField label="Template description" value={draft.description} onChange={(value) => model.change('description', value)} disabled={model.saving} multiline />
    </Card>
    <ReorderableExercises exercises={draft.exercises} disabled={model.saving} onMove={model.moveExercise}>{(exercise, index) => <Card key={exercise.id}>
      <Copy kind="label">EXERCISE {index + 1}</Copy>
      <Copy kind="heading">{exercise.name}</Copy>
      <ExerciseSummary exercise={exercise} />
      {exercise.sets.map((set, position) => <Card key={position}>
        <Copy>Set {position + 1}</Copy>
        <TemplateField label={`Exercise ${index + 1} set ${position + 1} weight (lb)`} value={set.weight}
          onChange={(value) => model.changeSet(exercise.id, position, 'weight', value)} disabled={model.saving} numeric />
        <TemplateField label={`Exercise ${index + 1} set ${position + 1} reps`} value={set.reps}
          onChange={(value) => model.changeSet(exercise.id, position, 'reps', value)} disabled={model.saving} numeric />
        <Button label={`Remove exercise ${index + 1} set ${position + 1}`} disabled={model.saving} onPress={() => model.removeSet(exercise.id, position)} />
      </Card>)}
      <Button label={`Add set to exercise ${index + 1}`} disabled={model.saving} onPress={() => model.addSet(exercise.id)} />
      <Button label={`Remove exercise ${index + 1}`} disabled={model.saving} onPress={() => model.removeExercise(exercise.id)} />
    </Card>}</ReorderableExercises>
    <Button label="Add exercise" disabled={model.saving} onPress={() => router.push({ pathname: '/templates/catalog', params: { draftId: model.id } })} />
    {model.error ? <Copy>{model.error}</Copy> : null}
    <Button label={model.saving ? 'Saving…' : model.error ? 'Retry save' : 'Save'} disabled={model.saving} onPress={() => void model.save()} />
    <Button label="Cancel" disabled={model.saving} onPress={model.cancelEditing} />
  </>;
}
