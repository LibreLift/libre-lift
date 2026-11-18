import type { TemplateContent, TemplateDetails, WorkoutSession, WorkoutTemplate } from '../models/workout';

// One context belongs to one open draft, independent of its changing content.
export type TemplateSaveContext = object;

export interface WorkoutService {
  listTemplates(): Promise<readonly WorkoutTemplate[]>;
  getTemplate(id: string): Promise<WorkoutTemplate | null>;
  deleteTemplate(id: string): Promise<void>;
  createTemplate(content: TemplateContent, context?: TemplateSaveContext): Promise<WorkoutTemplate>;
  updateTemplate(id: string, content: TemplateContent, context?: TemplateSaveContext): Promise<WorkoutTemplate>;
  updateTemplateDetails(id: string, details: TemplateDetails): Promise<WorkoutTemplate>;
  listSessions(): Promise<readonly WorkoutSession[]>;
  getSession(id: string): Promise<WorkoutSession | null>;
}
