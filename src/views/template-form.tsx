import { useRouter } from 'expo-router';
import { TextInput, View } from 'react-native';
import type { useTemplateEditorViewModel } from '../viewmodels/template-editor';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy, IconButton } from './ui';
import { ReorderableExercises } from './reorderable-exercises';

type Editor = ReturnType<typeof useTemplateEditorViewModel>;

function TemplateField({ label, value, onChange, disabled, multiline = false }: {
  label: string; value: string; onChange(value: string): void; disabled: boolean; multiline?: boolean;
}) {
  const { colors } = useTheme();
  return <>
    <Copy>{label}</Copy>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
      editable={!disabled} accessibilityState={{ disabled }} multiline={multiline}
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
    <Copy kind="heading">{draft.exercises.length} {draft.exercises.length === 1 ? 'exercise' : 'exercises'}</Copy>
    <ReorderableExercises exercises={draft.exercises} disabled={model.saving} onMove={model.moveExercise}>{(exercise, index) => <Card key={exercise.id}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><Copy kind="heading">{exercise.name}</Copy></View>
        <Button label="Sets" accessibilityLabel={`Sets for exercise ${index + 1}`} disabled={model.saving} onPress={() => router.push({
          pathname: '/templates/edit-exercise', params: { draftId: model.id, exerciseId: exercise.id },
        })} />
        <IconButton label={`Remove exercise ${index + 1}`} icon="trash-outline" disabled={model.saving} onPress={() => model.removeExercise(exercise.id)} />
      </View>
      <Copy kind="muted">{exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}</Copy>
    </Card>}</ReorderableExercises>
    <Button label="Add exercise" disabled={model.saving} onPress={() => router.push({ pathname: '/templates/catalog', params: { draftId: model.id } })} />
    {model.error ? <Copy>{model.error}</Copy> : null}
    <Button label={model.saving ? 'Saving…' : model.error ? 'Retry save' : 'Save'} disabled={model.saving} onPress={() => void model.save()} />
    <Button label="Cancel" disabled={model.saving} onPress={model.cancelEditing} />
  </>;
}
