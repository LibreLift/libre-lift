import type { WorkoutSession, WorkoutTemplate } from '../models/workout';
import { validateTemplateDetails } from '../models/workout';
import type { WorkoutService } from './workout-service';

const templates: readonly WorkoutTemplate[] = [
  {
    id: 'upper-body',
    title: 'Upper body',
    description: 'A little push. A little pull.',
    exercises: [
      {
        id: 'bench-press',
        name: 'Bench press',
        muscles: 'Chest · Triceps',
        equipment: 'Barbell',
        sets: [
          { setNumber: 1, targetWeight: 95, targetReps: 8 },
          { setNumber: 2, targetWeight: 115, targetReps: 8 },
          { setNumber: 3, targetWeight: 115, targetReps: 8 },
        ],
      },
      {
        id: 'dumbbell-row',
        name: 'Dumbbell row',
        muscles: 'Back · Biceps',
        equipment: 'Dumbbell',
        sets: [
          { setNumber: 1, targetWeight: 35, targetReps: 10 },
          { setNumber: 2, targetWeight: 35, targetReps: 10 },
        ],
      },
    ],
  },
  {
    id: 'lower-body',
    title: 'Lower body',
    description: 'Build from the ground up.',
    exercises: [
      {
        id: 'squat',
        name: 'Back squat',
        muscles: 'Quads · Glutes',
        equipment: 'Barbell',
        sets: [
          { setNumber: 1, targetWeight: 135, targetReps: 5 },
          { setNumber: 2, targetWeight: 135, targetReps: 5 },
          { setNumber: 3, targetWeight: 135, targetReps: 5 },
        ],
      },
      {
        id: 'romanian-deadlift',
        name: 'Romanian deadlift',
        muscles: 'Hamstrings · Glutes',
        equipment: 'Barbell',
        sets: [
          { setNumber: 1, targetWeight: 95, targetReps: 10 },
          { setNumber: 2, targetWeight: 95, targetReps: 10 },
        ],
      },
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
      {
        id: 'bench-press',
        name: 'Bench press',
        muscles: 'Chest · Triceps',
        equipment: 'Barbell',
        sets: [
          { setNumber: 1, targetWeight: 95, targetReps: 8, actualWeight: 95, actualReps: 8 },
          { setNumber: 2, targetWeight: 115, targetReps: 8, actualWeight: 115, actualReps: 8 },
          { setNumber: 3, targetWeight: 115, targetReps: 8, actualWeight: 115, actualReps: 6 },
        ],
      },
      {
        id: 'dumbbell-row',
        name: 'Dumbbell row',
        muscles: 'Back · Biceps',
        equipment: 'Dumbbell',
        sets: [
          { setNumber: 1, targetWeight: 35, targetReps: 10, actualWeight: 35, actualReps: 10 },
          { setNumber: 2, targetWeight: 35, targetReps: 10, actualWeight: 35, actualReps: 10 },
        ],
      },
    ],
  },
  {
    id: 'lower-nov-04',
    title: 'Lower body',
    startedAt: '2026-11-04T17:00:00Z',
    endedAt: '2026-11-04T17:35:00Z',
    exercises: [
      {
        id: 'squat',
        name: 'Back squat',
        muscles: 'Quads · Glutes',
        equipment: 'Barbell',
        sets: [
          { setNumber: 1, targetWeight: 135, targetReps: 5, actualWeight: 135, actualReps: 5 },
          { setNumber: 2, targetWeight: 135, targetReps: 5, actualWeight: 135, actualReps: 5 },
          { setNumber: 3, targetWeight: 135, targetReps: 5, actualWeight: 135, actualReps: 5 },
        ],
      },
    ],
  },
];

// A new service instance starts a fresh app session, without changing the fixtures.
export function createSampleWorkoutService(): WorkoutService {
  let savedTemplates = templates;
  return {
    async listTemplates() {
      return savedTemplates;
    },
    async getTemplate(id) {
      return savedTemplates.find((template) => template.id === id) ?? null;
    },
    async updateTemplateDetails(id, details) {
      const template = savedTemplates.find((value) => value.id === id);
      if (!template) throw new Error('This template couldn’t be found.');
      const updated = { ...template, ...validateTemplateDetails(details) };
      savedTemplates = savedTemplates.map((value) => (value.id === id ? updated : value));
      return updated;
    },
    async listSessions() {
      return sessions;
    },
    async getSession(id) {
      return sessions.find((session) => session.id === id) ?? null;
    },
  };
}
