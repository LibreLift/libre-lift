// Shared by the mobile service and Edge handler: all wire data is untrusted.
export type TemplateFailureKind = 'validation' | 'authentication' | 'unavailable' | 'missing';
export class TemplateFailure extends Error {
  constructor(message: string, readonly kind: TemplateFailureKind = 'validation') { super(message); }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TemplateFailure('Invalid template data.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, nonblank = false): string {
  if (typeof value !== 'string' || (nonblank && !value.trim())) throw new TemplateFailure('Invalid template text.');
  return value;
}
export function uuid(value: unknown): string {
  const id = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new TemplateFailure('Invalid template identity.');
  return id;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TemplateFailure('Invalid template list.');
  return value;
}
function texts(value: unknown): string[] { return array(value).map(value => text(value)); }
function number(value: unknown, positiveInteger = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positiveInteger && (!Number.isInteger(value) || value < 1))) {
    throw new TemplateFailure('Invalid template targets.');
  }
  return value;
}
function content(value: unknown) {
  const row = object(value);
  return { name: text(row.name, true), ...(row.instructions === undefined ? {} : { instructions: texts(row.instructions) }) };
}
function images(value: unknown) {
  const row = object(value);
  if (row.preferred === 'main') return { preferred: 'main' as const, main: text(row.main, true) };
  if (row.preferred !== 'pair') throw new TemplateFailure('Invalid exercise images.');
  const pair = object(row.pair);
  return { preferred: 'pair' as const, pair: { start: text(pair.start, true), peak: text(pair.peak, true) },
    ...(row.main === undefined ? {} : { main: text(row.main, true) }) };
}
export function exerciseSnapshot(value: unknown) {
  const row = object(value);
  const equipment = object(row.equipment);
  if (equipment.kind !== 'none' && equipment.kind !== 'required') throw new TemplateFailure('Invalid exercise equipment.');
  const translations = row.translations === undefined ? undefined : object(row.translations);
  return {
    ...content(row), primaryMuscles: texts(row.primaryMuscles), secondaryMuscles: texts(row.secondaryMuscles),
    equipment: equipment.kind === 'none' ? { kind: 'none' as const } : { kind: 'required' as const, name: text(equipment.name, true) },
    ...(row.images === undefined ? {} : { images: images(row.images) }),
    ...(translations === undefined ? {} : { translations: {
      ...(translations.de === undefined ? {} : { de: content(translations.de) }),
      ...(translations.es === undefined ? {} : { es: content(translations.es) }),
    } }),
  };
}
export function templateContent(value: unknown) {
  const row = object(value);
  const ids = new Set<string>();
  const exercises = array(row.exercises).map((value) => {
    const exercise = object(value);
    const id = uuid(exercise.id);
    if (ids.has(id)) throw new TemplateFailure('Duplicate exercise placements.');
    ids.add(id);
    const catalogId = text(exercise.catalogId);
    if (!/^[^\s:]+:[^\s]+$/.test(catalogId)) throw new TemplateFailure('Invalid catalog identity.');
    const sets = array(exercise.sets).map((value, index) => {
      const set = object(value);
      if (set.setNumber !== index + 1) throw new TemplateFailure('Invalid set ordering.');
      return { setNumber: index + 1, targetWeight: number(set.targetWeight), targetReps: number(set.targetReps, true) };
    });
    if (!sets.length) throw new TemplateFailure('Add at least one set per exercise.');
    return { ...exerciseSnapshot(exercise), id, catalogId: catalogId as `${string}:${string}`, sets };
  });
  if (!exercises.length) throw new TemplateFailure('Add at least one exercise.');
  return { title: text(row.title, true), description: text(row.description), exercises };
}
export function savedTemplate(value: unknown) {
  const row = object(value);
  const createdAt = text(row.createdAt);
  if (!Number.isFinite(Date.parse(createdAt))) throw new TemplateFailure('Invalid template creation time.');
  return { id: uuid(row.id), createdAt, ...templateContent(row) };
}
export function savedTemplates(value: unknown) { return array(value).map(savedTemplate); }

export type TemplateReadRequest = { action: 'list' } | { action: 'get'; id: string };
export type TemplateCreateRequest = { action: 'create'; id: string; operationId: string; content: ReturnType<typeof templateContent> };
export type TemplateDeleteRequest = { action: 'delete'; id: string };
export type TemplateRequest = TemplateReadRequest | TemplateCreateRequest | TemplateDeleteRequest;
export function templateRequest(value: unknown): TemplateRequest {
  const row = object(value);
  if (row.action === 'delete') return { action: 'delete', id: uuid(row.id) };
  if (row.action === 'create') {
    const content = templateContent(row.content);
    return { action: 'create', id: uuid(row.id), operationId: uuid(row.operationId), content: { ...content, title: content.title.trim() } };
  }
  return templateReadRequest(value);
}
export function templateReadRequest(value: unknown): TemplateReadRequest {
  const row = object(value);
  if (row.action === 'list') return { action: 'list' };
  if (row.action === 'get') return { action: 'get', id: uuid(row.id) };
  throw new TemplateFailure('Invalid template request.');
}
