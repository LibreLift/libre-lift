import { useRef, useState } from 'react';
import { createTemplateExercise, validateTemplate, type TemplateContent } from '../models/workout';
import type { CatalogExercise } from '../models/exercise';
import { useWorkouts } from './workout-provider';
import { useTemplateViewModel } from './workouts';

export interface TemplateDraft {
  title: string;
  description: string;
  exercises: readonly (Omit<TemplateContent['exercises'][number], 'sets'> & {
    readonly sets: readonly { weight: string; reps: string }[];
  })[];
}

function toDraft(template: TemplateContent): TemplateDraft {
  return { ...template, exercises: template.exercises.map((exercise) => ({ ...exercise,
    sets: exercise.sets.map((set) => ({ weight: String(set.targetWeight), reps: String(set.targetReps) })),
  })) };
}

function toContent(draft: TemplateDraft): TemplateContent {
  return validateTemplate({ ...draft, exercises: draft.exercises.map((exercise) => ({ ...exercise,
    sets: exercise.sets.map((set, index) => ({ setNumber: index + 1,
      targetWeight: set.weight.trim() === '' ? NaN : Number(set.weight),
      targetReps: set.reps.trim() === '' ? NaN : Number(set.reps),
    })),
  })) });
}

export function useTemplateEditorViewModel(id: string) {
  const resource = useTemplateViewModel(id);
  const { savingTemplate, saveTemplate, drafts, setDraft: updateDraft } = useWorkouts();
  const draft = drafts[id] ?? null;
  const setDraft = (update: React.SetStateAction<TemplateDraft | null>) => updateDraft(id, update);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const template = resource.state.status === 'ready' ? resource.state.data : null;

  function startEditing() {
    if (!template || saving.current) return;
    setDraft(toDraft(template));
    setError(null);
  }
  function edit(update: (value: TemplateDraft) => TemplateDraft) {
    if (!saving.current && !savingTemplate) setDraft((current) => current ? update(current) : current);
  }
  function change(field: 'title' | 'description', value: string) {
    edit((current) => ({ ...current, [field]: value }));
  }
  function changeSet(exerciseId: string, index: number, field: 'weight' | 'reps', value: string) {
    edit((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: exercise.sets.map((set, position) => position === index ? { ...set, [field]: value } : set),
    }) }));
  }
  function addSet(exerciseId: string) {
    edit((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: [...exercise.sets, { ...(exercise.sets.at(-1) ?? { weight: '', reps: '' }) }],
    }) }));
  }
  function removeSet(exerciseId: string, index: number) {
    edit((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: exercise.sets.filter((_, position) => position !== index),
    }) }));
  }
  function removeExercise(exerciseId: string) {
    edit((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) }));
  }
  function cancelEditing() {
    if (saving.current) return;
    setDraft(null);
    setError(null);
  }
  async function save() {
    if (!draft || saving.current || savingTemplate) return;
    let content: TemplateContent;
    try { content = toContent(draft); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check your template.');
      return;
    }
    saving.current = true;
    setError(null);
    try {
      await saveTemplate(id, content);
      setDraft(null);
    } catch {
      setError('Your changes couldn’t be saved. Please try again.');
    } finally { saving.current = false; }
  }
  const dirty = !!draft && !!template && JSON.stringify(draft) !== JSON.stringify(toDraft(template));
  return { ...resource, id, draft, error, dirty, saving: savingTemplate,
    startEditing, change, changeSet, addSet, removeSet, removeExercise, cancelEditing, save };
}

// A catalog route can add only to a still-open draft identified by its owner route.
export function useTemplateCatalogSelection(draftId: string | undefined) {
  const { drafts, setDraft, savingTemplate } = useWorkouts();
  const available = !!draftId && !!drafts[draftId] && !savingTemplate;
  function add(exercise: CatalogExercise) {
    if (!available || !draftId) return false;
    setDraft(draftId, (draft) => {
      if (!draft) return draft;
      let number = 1;
      while (draft.exercises.some((value) => value.id === `placement-${number}`)) number++;
      const placement = createTemplateExercise(`placement-${number}`, exercise, []);
      return { ...draft, exercises: [...draft.exercises, { ...placement, sets: [{ weight: '', reps: '' }] }] };
    });
    return true;
  }
  return { available, add };
}
