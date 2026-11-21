import { useEffect, useRef, useState, type SetStateAction } from 'react';
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
  const isNew = id === 'new';
  const resource = useTemplateViewModel(isNew ? null : id);
  const { savingTemplate, saveTemplate, deleteTemplate, setDraft: updateDraft } = useWorkouts();
  const draftEditor = useTemplateDraftViewModel(id);
  const { draft } = draftEditor;
  const setDraft = (update: SetStateAction<TemplateDraft | null>) => updateDraft(id, update);
  const [deleted, setDeleted] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  useEffect(() => {
    if (isNew) updateDraft(id, (current) => current ?? { title: '', description: '', exercises: [] });
    return () => updateDraft(id, null);
  }, [id, isNew, updateDraft]);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const template = resource.state.status === 'ready' ? resource.state.data : null;

  function startEditing() {
    if (!template || saving.current) return;
    setDraft(toDraft(template));
    setError(null);
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
      const saved = await saveTemplate(isNew ? null : id, content);
      setDraft(null);
      if (isNew) setCreatedId(saved.id);
    } catch {
      setError('Your changes couldn’t be saved. Please try again.');
    } finally { saving.current = false; }
  }
  async function removeTemplate() {
    if (saving.current || savingTemplate || draft || isNew) return;
    saving.current = true;
    setError(null);
    try {
      await deleteTemplate(id);
      setDeleted(true);
    } catch { setError('This template couldn’t be deleted. Please try again.'); }
    finally { saving.current = false; }
  }
  const baseline = isNew ? { title: '', description: '', exercises: [] } : template ? toDraft(template) : null;
  const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline);
  return { ...resource, id, deleted, removeTemplate, createdId, error, dirty,
    ...draftEditor, startEditing, cancelEditing, save };
}

// A catalog route can add only to a still-open draft identified by its owner route.
export function useTemplateCatalogSelection(draftId: string | undefined) {
  const { drafts, setDraft, nextPlacementId, savingTemplate } = useWorkouts();
  const available = !!draftId && !!drafts[draftId] && !savingTemplate;
  function add(exercise: CatalogExercise) {
    if (!available || !draftId) return false;
    const placementId = nextPlacementId();
    setDraft(draftId, (draft) => {
      if (!draft) return draft;
      const placement = createTemplateExercise(placementId, exercise, []);
      return { ...draft, exercises: [...draft.exercises, { ...placement, sets: [{ weight: '', reps: '' }] }] };
    });
    return true;
  }
  return { available, add };
}

// These operations edit the shared draft without owning its lifetime or saving it.
// The template overview remains mounted while an exercise screen is open.
export function useTemplateDraftViewModel(id: string) {
  const { drafts, setDraft: updateDraft, savingTemplate } = useWorkouts();
  const draft = drafts[id] ?? null;
  const setDraft = (update: SetStateAction<TemplateDraft | null>) => updateDraft(id, update);
  function edit(update: (value: TemplateDraft) => TemplateDraft) {
    if (!savingTemplate) setDraft((current) => current ? update(current) : current);
  }
  function change(field: 'title' | 'description', value: string) {
    edit((current) => ({ ...current, [field]: value }));
  }
  function editExercise(exerciseId: string, update: (exercise: TemplateDraft['exercises'][number]) => TemplateDraft['exercises'][number]) {
    edit((current) => ({
      ...current,
      exercises: current.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        return update(exercise);
      }),
    }));
  }
  function changeSet(exerciseId: string, index: number, field: 'weight' | 'reps', value: string) {
    editExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, position) => position === index ? { ...set, [field]: value } : set),
    }));
  }
  function addSet(exerciseId: string) {
    editExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: [...exercise.sets, { ...(exercise.sets.at(-1) ?? { weight: '', reps: '' }) }],
    }));
  }
  function removeSet(exerciseId: string, index: number) {
    editExercise(exerciseId, (exercise) => ({
      ...exercise,
      sets: exercise.sets.filter((_, position) => position !== index),
    }));
  }
  function removeExercise(exerciseId: string) {
    edit((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) }));
  }
  function moveExercise(exerciseId: string, target: number) {
    edit((current) => {
      const exercises = [...current.exercises];
      const source = exercises.findIndex((exercise) => exercise.id === exerciseId);
      if (source < 0 || target < 0 || target >= exercises.length) return current;
      const [exercise] = exercises.splice(source, 1);
      exercises.splice(target, 0, exercise);
      return { ...current, exercises };
    });
  }
  return { draft, saving: savingTemplate, change, changeSet, addSet, removeSet, removeExercise, moveExercise };
}

export function useTemplateExerciseEditorViewModel(draftId: string, exerciseId: string) {
  const editor = useTemplateDraftViewModel(draftId);
  const index = editor.draft?.exercises.findIndex((exercise) => exercise.id === exerciseId) ?? -1;
  const exercise = index >= 0 ? editor.draft?.exercises[index] : undefined;
  return {
    exercise,
    exerciseNumber: index + 1,
    saving: editor.saving,
    changeSet: (set: number, field: 'weight' | 'reps', value: string) => editor.changeSet(exerciseId, set, field, value),
    addSet: () => editor.addSet(exerciseId),
    removeSet: (set: number) => editor.removeSet(exerciseId, set),
  };
}
