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

## Review still required

No iOS simulator runtimes/devices were installed, and no supported physical target
was connected for this session. Physical restart/update/reinstall + entered email
OTP, native dragging, keyboard, increased text size, and theme review remain
pending. Service recreation and bundle export do not establish those checks.

Nothing was deployed to the shared hosted backend. Maintainer-reviewed migration
and endpoint deployment, independent review, and the repository's post-merge
production audit remain required. See [setup](setup.md) for repeatable isolated
checks and [maintainer rollout](maintainers.md#template-rollout-audit) for deployment
ordering and the actual device/hosted audit.
