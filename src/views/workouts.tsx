import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { SessionExercise } from '../models/workout';
import { useTheme } from '../viewmodels/theme';
import { sessionSummary, useSessionsViewModel, useSessionViewModel } from '../viewmodels/workouts';
import { ExerciseSummary, exerciseSummaryText } from './exercise-summary';
import { Card, Copy, LinkCard, Resource, Screen } from './ui';

export function WorkoutsScreen() {
  const router = useRouter();
  const model = useSessionsViewModel();
  return (
    <Screen>
      <Copy kind="label">ONE SESSION AT A TIME</Copy>
      <Copy kind="title">Keep showing up.</Copy>
      <Copy kind="muted">Your past workouts, with every set accounted for.</Copy>
      <Copy kind="heading">Workout history</Copy>
      <Resource {...model}>
        {(sessions) =>
          sessions.length ? (
            sessions.map((session) => (
              <LinkCard
                key={session.id}
                title={session.title}
                icon="checkmark-circle-outline"
                subtitle={sessionSummary(session.startedAt, session.endedAt)}
                detail={`${session.exercises.length} exercises · Completed`}
                onPress={() => router.push({ pathname: '/workouts/[id]', params: { id: session.id } })}
              />
            ))
          ) : (
            <Card>
              <Copy>No workouts yet.</Copy>
            </Card>
          )
        }
      </Resource>
      <Copy kind="muted">Sample history · Workout logging is coming in a later update.</Copy>
    </Screen>
  );
}

export function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = useSessionViewModel(id);
  return (
    <Screen>
      <Resource {...model}>
        {(session) =>
          session ? (
            <>
              <Copy kind="label">COMPLETED WORKOUT</Copy>
              <Copy kind="title">{session.title}</Copy>
              <Copy kind="muted">{sessionSummary(session.startedAt, session.endedAt)}</Copy>
              {session.exercises.map((exercise) => (
                <SessionExerciseCard key={exercise.id} exercise={exercise} />
              ))}
              <Copy kind="muted">Sample workout · Recorded values are separate from template targets.</Copy>
            </>
          ) : (
            <Card>
              <Copy>This workout couldn’t be found.</Copy>
            </Card>
          )
        }
      </Resource>
    </Screen>
  );
}

function SessionExerciseCard({ exercise }: { exercise: SessionExercise }) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  const count = `${exercise.sets.length} ${exercise.sets.length === 1 ? 'set' : 'sets'}`;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}, ${count}, ${exerciseSummaryText(exercise)}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Copy kind="heading">{exercise.name}</Copy>
          <Copy kind="muted">{count}</Copy>
          <ExerciseSummary exercise={exercise} />
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.text}
          accessible={false}
        />
      </Pressable>
      {expanded
        ? exercise.sets.map((set) => (
            <Card key={set.setNumber}>
              <Copy kind="label">SET {set.setNumber}</Copy>
              <Copy>
                Recorded · {set.actualReps} reps × {set.actualWeight} lb
              </Copy>
              <Copy kind="muted">
                Target · {set.targetReps} reps × {set.targetWeight} lb
              </Copy>
            </Card>
          ))
        : null}
    </Card>
  );
}
