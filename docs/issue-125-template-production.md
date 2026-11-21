# Production template persistence verification (#125)

Production now uses the account-scoped persistent workout service through the
shared lazy Supabase runtime. Expo Crypto supplies UUIDs at composition; the
service stays importable by Node checks. Test-only sample services remain explicit
factory injections. Workouts shows sample history clearly, without seeding it or
templates into accounts.

## Request and recovery boundaries

Each production request obtains the current SDK session, checks that it belongs
to the service's account, and pins that exact bearer token for HTTP. An old service
cannot send a previous account's creation under newly switched credentials.
A protected-request authentication rejection receives one guarded SDK renewal and
retry with the same operation/body. Ordinary permission/transport/rate-limit
failures preserve the draft. Definitively ended authentication enters existing
recovery; the notification checks both account identity and generation, so an old
request cannot sign out a newly loaded account, including re-entry to the same ID.
Routine renewal preserves the account-scoped service, navigation, and draft.

## Completed checks

- Node 24: `npm run typecheck` and all 23 Jest suites / 136 tests passed.
- TDD reproduced an old service sending under switched credentials, a refreshable
  request rejection incorrectly ending access, and the production default showing
  samples. Public-service/router regressions now cover these outcomes, definitive
  recovery, ordinary permission failure, and a late old-account rejection.
- `npm run test:templates` passed on a freshly generated disposable stack. The
  checked-in runner tested the actual production service through HTTP/Edge/database:
  complete CRUD and snapshots, 1,002 templates and 1,001 nested sets, ordering,
  fixed targets, anonymous/two-user access, safe retries, concurrent saves/deletion,
  late-write/cascade fault rollback, stale replay, changed creation retries, and
  update/deletion non-resurrection.
- The same run recreated SDK clients/services from persisted test credentials,
  renewed real tokens, signed out and renewed local verification access, and recovered the
  same saved template. Local provisioning used generated test tokens, not external
  email or entered-code device review. Switching accounts rejected old bound-service writes and
  left the second account empty. Fixture accounts were deleted; only that generated
  backend was stopped and removed. Injected CLI startup failure and SIGTERM probes
  also verified owned-project cleanup and retained private failure logs.
- `npx expo-doctor`: 20/20 checks passed. Native exports for iOS and Android passed
  with the SDK-compatible Expo Crypto dependency. Exports are ignored build output.
- React review: account lifetime remains an explicit keyed boundary; initialization
  is lazy, generation state and its ref update together, and no new hook, event
  listener, expensive render calculation, or inaccessible editing control was added.

The database schema/functions did not change in this slice. Earlier slices passed
the 100 database assertions and clean/populated migration checks; the fresh
full-stack run applied all committed migrations again.

## Final review corrections

An additive validation migration aligns direct save RPC nonblank text with the
shared wire model, including Unicode whitespace. Authenticated RPC checks reject
blank main, start, peak, and optional image references, along with unusable names,
equipment, translations, and catalog identities. Rejected writes leave no saved
aggregate, and corrected content can reuse the same operation identity, proving
that no successful-save receipt was committed. The real HTTP regression for an
out-of-range repetition count now returns validation/400 rather than unavailable/503.
Both issues were reproduced before correction; the complete fresh-backend check,
TypeScript/Jest, and clean/populated database checks were rerun for these changes.

The PR-comment review also reproduced a stale mutation retry after recovery into
a new session for the same account. Production services now check both account
identity and the captured generation before dispatch, after session lookup, and
before renewal/retry. Public-service and router regressions cover discarded
requests after re-entry to either the same or a different account; the old request
is not resent and cannot end the newly loaded account's access.

The editor and shared HTTP contract now reject repetition targets above the
existing integer storage maximum with correction feedback. Additive migration
`00600` enforces that same bound for direct RPC callers; the full-stack check
rejects an out-of-range write without consuming its operation identity, then
saves the inclusive maximum. This review migration is pending the next reviewed
hosted rollout; the earlier device report covers the deployment through `00500`.

The populated migration check also reproduces the parallel review order (`00400`
before missing `00300`). It first failed with `MigrationMissingRemoteError`;
documented `db push --include-all` now applies the missing migration while
preserving saved templates. Already-deployed migration versions remain unchanged.
After these review corrections, all 139 Jest tests, TypeScript, the three fresh
HTTP suites, 100 database assertions, and iOS/Android exports passed.

## Hosted rollout and physical-device verification

On November 18, 2026, the maintainer reported that even a minimal template failed
to save during hosted physical-device review. The configured template endpoint
returned 404 because it had not been deployed; hosted migration history contained
only the two foundation migrations. The deployment dry run identified the five
pending template migrations.

With explicit maintainer authorization, all five migrations were applied to the
shared OpenFit development project and `workout-templates` was deployed. Migration
history then matched the checkout, the function was active at version 1, and an
unauthenticated request returned the handler's expected authentication/401 response
instead of 404.

After deployment, the maintainer reported: “Hosted verification on a physical
device passes.” This is maintainer-reported device evidence; the report did not
enumerate individual platforms or each scenario in the audit checklist. The agent
did not independently operate the physical device.

## Review still required

The PR-comment Codex review loop, independent non-author contributor approval,
maintainer merge, and the repository's post-merge author/non-author production
audit remain separate completion requirements. See the [historical backend notes](maintainers.md) for
isolated checks and the [maintainer rollout checklist](maintainers.md#template-rollout-audit)
for deployment ordering and the individual device/hosted audit scenarios.
