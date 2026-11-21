# Persisted template reads (#121)

> Historical delivery notes for this slice. See the
> [#125 validation record](issue-125-template-production.md) for the pre-cutover
> composition and [historical backend notes](maintainers.md) for its setup.

The injected `createSupabaseWorkoutService(getClient)` reads through the
`workout-templates` Edge Function using the shared runtime's current client.
Production default composition remains for #125; this slice explicitly rejects
unimplemented mutations rather than falling back to sample templates. Session
reads retain the independent sample history pending #47.

The function accepts JSON `{ "action": "list" }` or
`{ "action": "get", "id": "<template UUID>" }` with POST. It verifies the user
JWT through Auth, then forwards that same bearer identity to data access. An
invalid JWT/session is distinct from retryable Auth transport/server/rate-limit
errors or an ordinary permission failure. No privileged key is used for requests.

An additive, invoker-rights `read_workout_templates` database function returns
one JSON aggregate per request under existing RLS. This avoids the API row limit
truncating template lists or nested placements/sets, and all aggregate content is
read from one statement snapshot. Templates sort by ascending creation time then
UUID; placements by position; sets by number. Saved exercise details come from
the persisted snapshot and never need a live catalog request. A shared runtime
validator checks requests and complete canonical responses in both app and Edge.

Saved responses require a creation timestamp. The existing UI model accepts an
optional `createdAt` to keep controlled sample/test data compatible. Catalog IDs
remain provider-namespaced; the type now expresses that existing domain rule
rather than restricting saved snapshots to the current provider.

## Disposable local check

Use the setup guide to start a **separate disposable local** Supabase project
with committed configuration, migrations, templates, and functions. Apply its
migrations, then serve functions from that project:

```sh
npx --yes supabase@3.1.0 functions serve --workdir /absolute/path/to/disposable-project
TEMPLATE_TEST_WORKDIR=/absolute/path/to/disposable-project node scripts/check-templates.cjs
```

The check rejects non-loopback backend URLs. It provisions local accounts, creates
application Users and read fixtures, then exercises the actual production service
through HTTP/Edge/database as the requesting account. Fixture Auth accounts are
removed in `finally`, cascading their data. No external email is sent, and no
shared/hosted backend is reset. Administrative credentials only provision/clean
fixtures; access assertions use owner, other-user, and anonymous clients.

Checks cover empty accounts without sample seeding, complete snapshots and
translations/images, repeated placements, ordered zero/decimal targets, immutable
creation times, missing/foreign reads, malformed identity/authentication, and lists
and child sets beyond the configured 1,000-row API limit. Router checks exercise
loading-error recovery, empty/missing states, and saved exercise detail through the
real service with a controlled external HTTP boundary.

For hosted rollout after review, apply the additive read migration before deploying
`workout-templates` with its committed function configuration. `verify_jwt = false`
disables only the gateway's legacy JWT check: the handler explicitly verifies user
JWTs before any data access. Do not copy the public health handler as authorization.
Production cutover and a complete deployment checklist remain #125.
