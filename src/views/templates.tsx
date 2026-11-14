import { Stack, useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useTemplatesViewModel } from '../viewmodels/workouts';
import { useTemplateEditorViewModel } from '../viewmodels/template-editor';
import { TemplateForm } from './template-form';
import { ExerciseSummary } from './exercise-summary';
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
      <Button label="Create template" onPress={() => router.push('/templates/new')} />
      <Button label="Exercise catalog" onPress={() => router.push('/templates/catalog')} />
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
  const router = useRouter();
  useEffect(() => { if (model.deleted) router.dismissTo('/templates'); }, [model.deleted, router]);
  useTemplateNavigationGuard(model);
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
                  <TemplateForm model={model} />
                ) : (
                  <>
                    <Copy kind="title">{template.title}</Copy>
                    <Copy kind="muted">{template.description}</Copy>
                    <Button label="Edit template details" disabled={model.saving} onPress={model.startEditing} />
                    {model.error ? <Copy>{model.error}</Copy> : null}
                    <Button label={model.saving ? 'Deleting…' : model.error ? 'Retry delete' : 'Delete template'} disabled={model.saving} onPress={() => {
                      Alert.alert('Delete template?', `Delete “${template.title}”?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => void model.removeTemplate() },
                      ]);
                    }} />
                  </>
                )}
                {!model.draft && template.exercises.map((exercise, index) => (
                  <Card key={exercise.id}>
                    <Copy kind="label">EXERCISE {index + 1}</Copy>
                    <Copy kind="heading">{exercise.name}</Copy>
                    <ExerciseSummary exercise={exercise} />
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

function useTemplateNavigationGuard(model: ReturnType<typeof useTemplateEditorViewModel>) {
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
}

export function NewTemplateScreen() {
  const model = useTemplateEditorViewModel('new');
  const router = useRouter();
  useTemplateNavigationGuard(model);
  useEffect(() => {
    if (!model.draft && !model.createdId && model.state.status === 'ready') router.dismissTo('/templates');
  }, [model.draft, model.createdId, model.state.status, router]);
  useEffect(() => {
    if (model.createdId) router.replace({ pathname: '/templates/[id]', params: { id: model.createdId } });
  }, [model.createdId, router]);
  return <>
    <Stack.Screen options={{ title: 'Create template', gestureEnabled: !model.saving, headerBackVisible: !model.saving }} />
    <Screen><Copy kind="title">Create template</Copy><TemplateForm model={model} /></Screen>
  </>;
}
