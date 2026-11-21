# Atomic template creation (#122)

> Historical delivery notes for this slice. See the
> [#125 validation record](issue-125-template-production.md) for the pre-cutover
> composition and [historical backend notes](maintainers.md) for its setup.

The persistence service now creates complete templates through the authenticated
`workout-templates` Edge Function and an invoker-rights database transaction. The
production default remains unchanged until #125. Updates and changed creation
drafts after uncertain responses are completed by #123; deletion remains #124.

Call `createSupabaseWorkoutService(getClient, newId)` with an injected UUID source.
This keeps the service usable from Node integration checks without native imports;
the production composition must supply an Expo-compatible UUID implementation.
Reads do not require that callback. Creation accepts an optional `TemplateSaveContext`
object: reuse it only for one open draft. The provider owns the context alongside
that draft, preserves it across content changes/failures, and releases it on
Cancel, success, unmount, or account cleanup. A standalone call without a context
starts a distinct creation. Temporary placement IDs are never reused within the
account scope, so removal/addition cannot reuse a pending UUID mapping.

## Backend contract for subsequent slices

POST creation JSON uses `action: create`, template UUID `id`, UUID `operationId`,
and complete `content` containing title, description, ordered UUID placements,
catalog identity/snapshots, and numbered sets. Shared runtime validation checks
the complete content at both mobile and handler boundaries. The database function
also enforces aggregate validity for direct RPC callers.

`save_workout_template(p_id uuid, p_operation uuid, p_content jsonb,
p_mode text default 'create')` currently accepts creation only. It returns the
canonical saved template through the existing read function. Future updates must
extend it with a new migration rather than rewriting the shared migration.

Every save acquires transaction advisory locks in this order, using
`pg_catalog.hashtextextended(key, 0)` and the one-bigint lock overload:

1. `template-operation:<auth.uid()>:<operation UUID>`
2. `workout-template:<template UUID>`

Deletion must acquire the same second lock. This serializes initial creation as
well as existing-record operations, unlike a row lock on an absent template.

`template_private.save_operations` stores immutable owner/operation identity,
template identity, mode, canonical content, and original result. It is outside
exposed API schemas, with requesting-user RLS and select/insert grants required by
invoker execution. It references the application User for account cleanup, but
has **no template foreign key**: recognition must survive deletion. An exact replay
returns its original result only while the owned template still exists. Different
content/template under the same operation identity is invalid. A previous
committed creation whose template is now absent is missing, never recreated.

The transaction inserts metadata, independent placement snapshots, and sets, then
its successful-operation record. Failure rolls everything back. New additive
migrations must preserve this recognition and its non-resurrection behavior.

## Verification and deployment

Run the disposable local check documented for #121 with the new migration applied
and updated function served. It now verifies creation, separate duplicate-title
templates, stable contextual retries, simultaneous first requests, an actual
successful response dropped at the HTTP boundary, owner/anonymous/two-user access,
operation-content rejection, and non-resurrection after fixture deletion. A
disposable trigger fails a later set write after metadata/placement insertion;
public service reads prove rollback, then the same draft retries successfully.
The fault is scoped to the fixture account and removed in `finally`.
The isolated migration runner now installs its saved-template sentinel before
later feature migrations, proving this migration preserves existing aggregates.

Router tests reproduce a committed-but-lost response, retry without duplicate
creation, and Cancel followed by a fresh independent draft. Existing editor
validation, pending guards, discard, navigation, and summary behavior remain.

Apply the additive creation migration before deploying the updated Edge Function.
Do not reset hosted databases or seed sample data. Review/deployment and production
audit remain separate maintainer activities under the repository definition of done.
