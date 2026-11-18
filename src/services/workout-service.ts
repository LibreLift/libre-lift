import type { TemplateContent, TemplateDetails, WorkoutSession, WorkoutTemplate } from '../models/workout';

export interface WorkoutService {
  listTemplates(): Promise<readonly WorkoutTemplate[]>;
  getTemplate(id: string): Promise<WorkoutTemplate | null>;
  deleteTemplate(id: string): Promise<void>;
  createTemplate(content: TemplateContent): Promise<WorkoutTemplate>;
  updateTemplate(id: string, content: TemplateContent): Promise<WorkoutTemplate>;
  updateTemplateDetails(id: string, details: TemplateDetails): Promise<WorkoutTemplate>;
  listSessions(): Promise<readonly WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
}
