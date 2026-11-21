# Local onboarding and SQLite verification

[#141](https://github.com/open-source-fitness/open-fit/issues/141) switches the
production app to local display-name onboarding and uses SQLite for workout
templates. The app ships the RepDB catalog and flat illustrations. Workout
history still shows labeled samples.

## Verified in the worktree

- On Node 24.12.0, `npm ci`, `npm run typecheck`, `npm test` (109 tests in 22
  suites), and `npx expo-doctor` (20 checks) passed.
- The Expo Router tests start the default app with a fresh database and use
  Node's SQLite engine with the Expo SQLite bridge substituted. With JavaScript
  fetch disabled, the tests dismiss the device storage and backup pop-up, require
  a nonblank display name, greet the user on Templates, inspect both poses of a
  bundled exercise, and save a template. They close the database, remount the
  app, reopen the template, edit it, and delete it.
- A pre-cutover SQLite schema version 2 fixture retains its saved template and
  set targets after migration. A name edited in Settings and the Dark
  appearance both survive an app remount. The remaining SQLite and router
  tests cover draft navigation, cancellation, reordering, snapshots, rollback,
  save retries, and sample history.
- Both iOS and Android Expo exports passed with the Supabase environment
  variables unset, dotenv loading disabled, and Expo offline mode enabled.
  Each bundle contains the local SQLite composition and RepDB instructions.
  Both export manifests reference all 1,203 RepDB illustrations, totaling
  19,804,900 bytes before application packaging. The Hermes bundles measure
  5,327,488 bytes for iOS and 5,317,600 for Android. Source maps contain no
  Supabase runtime or legacy account routes.

At the time of this verification, the retired account implementation was
still present in the worktree.
`auth-navigation.test.tsx`, `auth-sessions.test.tsx`, and
`production-template-access.test.tsx` exercise the retired router and are
excluded from the active Jest and TypeScript checks for this run.

## Physical-device evidence pending

No iOS or Android device was available. Neither platform ran an installed build
during this verification. The native Expo SQLite bridge, first launch and
catalog rendering in airplane mode, force-close recovery, in-place app update,
and installed package size remain unverified. The database migration and
restart checks above ran through Jest. Follow the
[device-review steps](setup.md#device-review) to complete the offline
template-parity gate.
