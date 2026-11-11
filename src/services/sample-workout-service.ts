import { createSessionExercise, createTemplateExercise, type WorkoutSession, type WorkoutTemplate } from '../models/workout';
import type { WorkoutService } from './workout-service';

const templates: readonly WorkoutTemplate[] = [
  {
    id: 'upper-body',
    title: 'Upper body',
    description: 'A little push. A little pull.',
    exercises: [
      createTemplateExercise('placement-bench-press', {
        catalogId: 'repdb:bench-press',
        name: 'Bench press',
        primaryMuscles: ['Chest'],
        secondaryMuscles: ['Triceps'],
        equipment: { kind: 'required', name: 'Barbell' },
      }, [
        { setNumber: 1, targetWeight: 95, targetReps: 8 },
        { setNumber: 2, targetWeight: 115, targetReps: 8 },
        { setNumber: 3, targetWeight: 115, targetReps: 8 },
      ]),
      createTemplateExercise('placement-dumbbell-row', {
        catalogId: 'repdb:dumbbell-row',
        name: 'Dumbbell row',
        primaryMuscles: ['Back'],
        secondaryMuscles: ['Biceps'],
        equipment: { kind: 'required', name: 'Dumbbell' },
      }, [
        { setNumber: 1, targetWeight: 35, targetReps: 10 },
        { setNumber: 2, targetWeight: 35, targetReps: 10 },
      ]),
    ],
  },
  {
    id: 'lower-body',
    title: 'Lower body',
    description: 'Build from the ground up.',
    exercises: [
      createTemplateExercise('placement-squat', {
        catalogId: 'repdb:squat',
        name: 'Back squat',
        primaryMuscles: ['Quads'],
        secondaryMuscles: ['Glutes'],
        equipment: { kind: 'required', name: 'Barbell' },
      }, [
        { setNumber: 1, targetWeight: 135, targetReps: 5 },
        { setNumber: 2, targetWeight: 135, targetReps: 5 },
        { setNumber: 3, targetWeight: 135, targetReps: 5 },
      ]),
      createTemplateExercise('placement-romanian-deadlift', {
        catalogId: 'repdb:romanian-deadlift',
        name: 'Romanian deadlift',
        primaryMuscles: ['Hamstrings'],
        secondaryMuscles: ['Glutes'],
        equipment: { kind: 'required', name: 'Barbell' },
      }, [
        { setNumber: 1, targetWeight: 95, targetReps: 10 },
        { setNumber: 2, targetWeight: 95, targetReps: 10 },
      ]),
    ],
  },
];

const sessions: readonly WorkoutSession[] = [
  {
    id: 'upper-nov-06',
    title: 'Upper body',
    startedAt: '2026-11-06T17:00:00Z',
    endedAt: '2026-11-06T17:42:00Z',
    exercises: [
      createSessionExercise('session-bench-press', {
        catalogId: 'repdb:bench-press',
        name: 'Bench press',
        primaryMuscles: ['Chest'],
        secondaryMuscles: ['Triceps'],
        equipment: { kind: 'required', name: 'Barbell' },
      }, [
        { setNumber: 1, targetWeight: 95, targetReps: 8, actualWeight: 95, actualReps: 8 },
        { setNumber: 2, targetWeight: 115, targetReps: 8, actualWeight: 115, actualReps: 8 },
        { setNumber: 3, targetWeight: 115, targetReps: 8, actualWeight: 115, actualReps: 6 },
      ]),
      createSessionExercise('session-dumbbell-row', {
        catalogId: 'repdb:dumbbell-row',
        name: 'Dumbbell row',
        primaryMuscles: ['Back'],
        secondaryMuscles: ['Biceps'],
        equipment: { kind: 'required', name: 'Dumbbell' },
      }, [
        { setNumber: 1, targetWeight: 35, targetReps: 10, actualWeight: 35, actualReps: 10 },
        { setNumber: 2, targetWeight: 35, targetReps: 10, actualWeight: 35, actualReps: 10 },
      ]),
    ],
  },
  {
    id: 'lower-nov-04',
    title: 'Lower body',
    startedAt: '2026-11-04T17:00:00Z',
    endedAt: '2026-11-04T17:35:00Z',
    exercises: [
      createSessionExercise('session-squat', {
        catalogId: 'repdb:squat',
        name: 'Back squat',
        primaryMuscles: ['Quads'],
        secondaryMuscles: ['Glutes'],
        equipment: { kind: 'required', name: 'Barbell' },
      }, [
        { setNumber: 1, targetWeight: 135, targetReps: 5, actualWeight: 135, actualReps: 5 },
        { setNumber: 2, targetWeight: 135, targetReps: 5, actualWeight: 135, actualReps: 5 },
        { setNumber: 3, targetWeight: 135, targetReps: 5, actualWeight: 135, actualReps: 5 },
      ]),
    ],
  },
];

// Matches the async boundary a backend implementation will use, without fake latency.
export const sampleWorkoutService: WorkoutService = {
  async listTemplates() {
    return templates;
  },
  async getTemplate(id) {
    return templates.find((template) => template.id === id) ?? null;
  },
  async listSessions() {
    return sessions;
  },
  async getSession(id) {
    return sessions.find((session) => session.id === id) ?? null;
  },
};
