import type { WorkoutSession, WorkoutTemplate } from '../models/workout';

export interface WorkoutService {
  listTemplates(): Promise<readonly WorkoutTemplate[]>;
  getTemplate(id: string): Promise<WorkoutTemplate | null>;
  listSessions(): Promise<readonly WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
}
