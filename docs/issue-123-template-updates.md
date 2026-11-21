# Persistent template updates (#123)

> Historical delivery notes for this slice. See the
> [#125 validation record](issue-125-template-production.md) for the pre-cutover
> composition and [historical backend notes](maintainers.md) for its setup.

The persistence service now applies complete saved-template edits through the same
authenticated Edge Function and invoker-rights save transaction as creation.
The existing editor supplies its draft-owned `TemplateSaveContext` to updates,
retaining saved placement UUIDs and translating newly added temporary identities.
Removing and adding placements remains distinct because draft placement identities
are never reused. Metadata-only service calls load the saved aggregate and use
the same whole-save path; immutable creation time and list position are preserved.
Metadata callers may pass the same optional draft context to retain the original
aggregate across retries instead of reloading and reapplying stale metadata after
a newer save.

## Save and retry contract

The additive update migration extends `save_workout_template` to accept create
and update modes. Both modes retain the existing operation-first/template-second
advisory locks and owner-scoped immutable successful-operation records. Exact
replay returns its original result without writing again. Distinct saves serialize
per template and replace the whole aggregate; the last committed save wins.

Updates require a visible existing template. Creation can continue an existing
template only when the requesting owner has committed creation lineage for that
identity. This lets a changed still-open creation draft save to the same template
after a lost response, or create that identity if the earlier transaction rolled
back. Committed creation lineage plus a missing template means deletion, never
permission to recreate it. A reused operation identity with changed content is
invalid, and old replays cannot overwrite a later distinct save.

Before changing rows, membership validation rejects a placement belonging to
another template of the same owner. Existing RLS also protects foreign owners.
The transaction defers ordering uniqueness, replaces sets, removes omitted
placements, and updates surviving placement descriptions/order without changing
their parent or UUID. Set replacement avoids using a deferrable primary key as an
`ON CONFLICT` arbiter. Any later failure rolls back all changes and retry recognition.

## Verification

With a disposable local backend using committed migrations and the current
`workout-templates` function, run:

```sh
TEMPLATE_TEST_WORKDIR=/absolute/path/to/disposable-project node scripts/check-template-updates.cjs
```

The real production service/HTTP/database checks cover metadata, order swaps,
membership changes, stable UUIDs/timestamps, stale operation replay, mismatched
operation content, same-owner unrelated and foreign placements, missing/foreign
updates, concurrent whole saves, both uncertain-creation outcomes, a later set-write
fault with complete update rollback/retry, and update-after-delete. Administrative
setup is limited to disposable actors and a fixture-scoped fault trigger; assertions
use the public authenticated service. Fixtures and faults are removed afterward.

Router coverage verifies that a lost update response preserves the editable draft
and a successful retry followed by a failed detail reload offers read recovery
without claiming the save failed. Existing editor tests retain pending, discard,
tab, validation, and native reorder coverage. Physical-device/native lifecycle
review and production default cutover remain #125.

Use `db push --include-all` (and its dry run for hosted review) when upgrading:
the parallel deletion slice may already have installed migration `00400` before
this slice introduces `00300`. Both versions are already deployed and remain
immutable. The populated migration check reproduces that order, applies the
missing older migration, and verifies existing templates survive before a clean
rebuild. Do not renumber or repair already-applied history to match review order.

Deploy the additive update migration before the updated Edge Function. Preserve
existing data and migration history; do not reset or seed hosted accounts. The
reviewed maintainer deployment and production audit remain separate activities.
