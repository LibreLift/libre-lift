import { useRef, useState } from 'react';
import { validateTemplateDetails, type TemplateDetails } from '../models/workout';
import { useWorkouts } from './workout-provider';
import { useTemplateViewModel } from './workouts';

export function useTemplateEditorViewModel(id: string) {
  const resource = useTemplateViewModel(id);
  const { savingTemplate, saveTemplateDetails } = useWorkouts();
  const [draft, setDraft] = useState<TemplateDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const template = resource.state.status === 'ready' ? resource.state.data : null;

  function startEditing() {
    if (!template || saving.current) return;
    setDraft({ title: template.title, description: template.description });
    setError(null);
  }

  function change(field: keyof TemplateDetails, value: string) {
    if (!saving.current) setDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function cancelEditing() {
    if (saving.current) return;
    setDraft(null);
    setError(null);
  }

  async function save() {
    if (!draft || saving.current || savingTemplate) return;
    let details: TemplateDetails;
    try {
      details = validateTemplateDetails(draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enter a title for this template.');
      return;
    }
    saving.current = true;
    setError(null);
    try {
      await saveTemplateDetails(id, details);
      setDraft(null);
    } catch {
      setError('Your changes couldn’t be saved. Please try again.');
    } finally {
      saving.current = false;
    }
  }

  const dirty =
    !!draft && !!template && (draft.title !== template.title || draft.description !== template.description);
  return {
    ...resource,
    draft,
    error,
    dirty,
    saving: savingTemplate,
    startEditing,
    change,
    cancelEditing,
    save,
  };
}
