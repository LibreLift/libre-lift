import type { TemplateDetails, WorkoutSession, WorkoutTemplate } from '../models/workout';

export interface WorkoutService {
  listTemplates(): Promise<readonly WorkoutTemplate[]>;
  getTemplate(id: string): Promise<WorkoutTemplate | null>;
  updateTemplateDetails(id: string, details: TemplateDetails): Promise<WorkoutTemplate>;
  listSessions(): Promise<readonly WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
}
