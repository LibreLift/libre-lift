import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTemplatesViewModel, useTemplateViewModel } from '../viewmodels/workouts';
import { Card, Copy, LinkCard, Resource, Screen } from './ui';

export function TemplatesScreen() {
  const router = useRouter();
  const model = useTemplatesViewModel();
  return (
    <Screen>
      <Copy kind="label">YOUR TRAINING, YOUR WAY</Copy>
      <Copy kind="title">Make a plan.{'\n'}Make it yours.</Copy>
      <Copy kind="muted">A few good exercises. A plan you can come back to.</Copy>
      <Copy kind="heading">Workout templates</Copy>
      <Resource {...model}>
        {(templates) =>
          templates.length ? (
            templates.map((template) => (
              <LinkCard
                key={template.id}
                title={template.title}
                subtitle={template.description}
                detail={`${template.exercises.length} exercises`}
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
      <Copy kind="muted">Sample templates · Template creation is coming next.</Copy>
    </Screen>
  );
}

export function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = useTemplateViewModel(id);
  return (
    <Screen>
      <Resource {...model}>
        {(template) =>
          template ? (
            <>
              <Copy kind="label">WORKOUT TEMPLATE</Copy>
              <Copy kind="title">{template.title}</Copy>
              <Copy kind="muted">{template.description}</Copy>
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
              <Copy kind="muted">
                Sample plan · Editing and starting workouts are coming in later updates.
              </Copy>
            </>
          ) : (
            <Card>
              <Copy>This template couldn’t be found.</Copy>
            </Card>
          )
        }
      </Resource>
    </Screen>
  );
}
