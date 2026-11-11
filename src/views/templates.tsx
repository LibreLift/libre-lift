import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { Alert, TextInput } from 'react-native';
import { useTemplatesViewModel } from '../viewmodels/workouts';
import { useTemplateEditorViewModel } from '../viewmodels/template-editor';
import { useTheme } from '../viewmodels/theme';
import { Button, Card, Copy, LinkCard, Resource, Screen } from './ui';

export function TemplatesScreen() {
  const router = useRouter();
  const model = useTemplatesViewModel();
  return (
    <Screen>
      <Copy kind="label">YOUR TRAINING, YOUR WAY</Copy>
      <Copy kind="title">Make a plan.{'\n'}Make it yours.</Copy>
      <Copy kind="muted">A few good exercises. A plan you can come back to.</Copy>
      <Copy kind="heading">Templates</Copy>
      <Resource {...model}>
        {(templates) =>
          templates.length ? (
            templates.map((template) => (
              <LinkCard
                key={template.id}
                title={template.title}
                subtitle={template.description}
                detail={template.summary}
                icon="barbell-outline"
                onPress={() => router.push({ pathname: '/templates/[id]', params: { id: template.id } })}
              />
            ))
          ) : (
            <Card>
              <Copy>No templates yet.</Copy>
            </Card>
          )
        }
      </Resource>
    </Screen>
  );
}

export function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = useTemplateEditorViewModel(id);
  usePreventRemove(model.dirty || model.saving, ({ repeat }) => {
    if (model.saving) return;
    Alert.alert('Discard changes?', 'Your template has unsaved changes.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard changes',
        style: 'destructive',
        onPress: () => {
          model.cancelEditing();
          repeat();
        },
      },
    ]);
  });
  const { colors } = useTheme();
  const fieldStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    color: colors.text,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  };
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: !model.saving, headerBackVisible: !model.saving }} />
      <Screen>
        <Resource {...model}>
          {(template) =>
            template ? (
              <>
                <Copy kind="label">WORKOUT TEMPLATE</Copy>
                {model.draft ? (
                  <Card>
                    <Copy kind="heading">Edit template details</Copy>
                    <Copy>Title</Copy>
                    <TextInput
                      accessibilityLabel="Template title"
                      value={model.draft.title}
                      onChangeText={(value) => model.change('title', value)}
                      editable={!model.saving}
                      accessibilityState={{ disabled: model.saving }}
                      style={fieldStyle}
                    />
                    <Copy>Description</Copy>
                    <TextInput
                      accessibilityLabel="Template description"
                      value={model.draft.description}
                      onChangeText={(value) => model.change('description', value)}
                      editable={!model.saving}
                      accessibilityState={{ disabled: model.saving }}
                      multiline
                      style={[fieldStyle, { minHeight: 96, textAlignVertical: 'top' }]}
                    />
                    {model.error ? <Copy>{model.error}</Copy> : null}
                    <Button
                      label={model.saving ? 'Saving…' : model.error ? 'Retry save' : 'Save'}
                      disabled={model.saving}
                      onPress={() => void model.save()}
                    />
                    <Button label="Cancel" disabled={model.saving} onPress={model.cancelEditing} />
                  </Card>
                ) : (
                  <>
                    <Copy kind="title">{template.title}</Copy>
                    <Copy kind="muted">{template.description}</Copy>
                    <Button label="Edit template details" onPress={model.startEditing} />
                  </>
                )}
                {template.exercises.map((exercise, index) => (
                  <Card key={exercise.id}>
                    <Copy kind="label">EXERCISE {index + 1}</Copy>
                    <Copy kind="heading">{exercise.name}</Copy>
                    <Copy kind="muted">
                      {exercise.muscles} · {exercise.equipment}
                    </Copy>
                    {exercise.sets.map((set) => (
                      <Copy key={set.setNumber}>
                        Set {set.setNumber} · {set.targetReps} reps × {set.targetWeight} lb
                      </Copy>
                    ))}
                  </Card>
                ))}
              </>
            ) : (
              <Card>
                <Copy>This template couldn’t be found.</Copy>
              </Card>
            )
          }
        </Resource>
      </Screen>
    </>
  );
}
