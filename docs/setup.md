# Setup

## Prerequisites

- Node.js 24 (`.nvmrc`) and npm. With nvm, run `nvm install` and `nvm use`.
- Expo Go supporting SDK 58 on an iPhone or Android device.
- A computer and phone on the same Wi-Fi network when using Expo Go over LAN.

`package.json` selects Expo SDK 58; `package-lock.json` pins installed versions.
The version in `app.json` is the app release, not the SDK. Use committed versions.
For SDK upgrades, follow [Expo's guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/),
then run `npx expo install --fix` and `npx expo-doctor`.

The app uses on-device SQLite and a bundled RepDB exercise catalog. First launch
requires a display name. App development requires no backend credentials or
environment file.

## Install and launch

```sh
git clone https://github.com/LibreLift/libre-lift.git
cd libre-lift
npm ci
npm start
```

`npm start` runs `expo start --go` on port 8081 by default; keep the terminal running.
`npm ci` also generates Metro's illustration index from the pinned RepDB
package. Run `npm run postinstall` to regenerate it after an install with
lifecycle scripts disabled.

1. Install the matching Expo Go build; sign into Expo Go and the CLI if prompted
   (`npx expo login`). Android builds are at [Expo Go downloads](https://expo.dev/go).
2. Join the computer's Wi-Fi network. On iPhone, scan the terminal QR code with
   Camera and open in Expo Go; on Android, scan from Expo Go.
3. Allow local network access if prompted. Stop the server with Ctrl+C.

For configured simulators/emulators, use `npm run ios` (Xcode) or
`npm run android` (Android Studio).
If LAN access fails, check permissions, VPN, firewall, and Wi-Fi device isolation.
Alternatively, install `npm install --global @expo/ngrok` and run
`npm start -- --tunnel`; tunneling requires internet.

## Checks

```sh
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform ios --platform android --output-dir dist
```

These check types, Jest behavior, Expo dependencies, and native JavaScript bundles.
Jest needs no backend or credentials. Bundling verifies package contents. Use an
installed build for device review. No CI workflow, lint, or format script is checked in.

## Local template storage development

Run `npm test -- --runTestsByPath __tests__/sqlite-template-creation.test.tsx`
to drive the existing routes against disposable database files. Node's SQLite
engine runs the app's SQL through a substitute for the Expo native bridge. The
suite covers onboarding, renaming, migration of an existing local database,
template CRUD, reorder, Cancel, reopen, rollback, and retry after a commit.

The display name and workout templates share one versioned database. Each
template is stored as one row with its exercise snapshots and ordered sets.
Save receipts commit with the template so a retry from the same open draft can
recover its result without reversing a newer edit. Deletion keeps those receipts
so delayed saves cannot restore the template.

## Device review

- Use a fresh installed build in airplane mode. Check the storage and backup
  notice, enter a display name, and confirm the greeting and empty template list.
- Search and filter RepDB, read instructions, and view both poses of a paired
  exercise. Add an exercise to a template and save fixed weight and rep targets.
- Force-close and reopen the app. Confirm the name and template details survived.
  Edit the template, check Save/Cancel and draft behavior across tabs, and confirm
  deletion persists after reopening.
- Install an update over a build with saved data and check that the display name,
  templates, and appearances carry forward. Change the display name in Settings
  and confirm existing templates still open.
- Check keyboard access, increased text size, Light/Dark/System appearance, and
  the sample labels on workout history and detail.

Unsaved drafts remain temporary. Local training data is tied to the installation.
Backup and recovery are planned after the MVP. Persistent workout logging is
future work. See the [#141 verification record](issue-141-local-onboarding.md).

## Frontend structure

- `app/`: Expo Router onboarding, Settings, and guarded training tabs.
- `src/views/`: Native screens rendering ViewModel state.
- `src/viewmodels/`: Display name, theme, loading/retry, catalog, and template drafts.
- `src/models/`: Templates, sessions, exercises, snapshots, and validation.
- `src/services/`: Async service contracts, SQLite, sample workout history,
  bundled catalog mapping, and appearance storage.
- `src/theme/`: Shared light/dark colors.

The root layout supplies the display-name store, workout service, bundled catalog,
and appearance store. The name store and workout service share a lazy SQLite
connection. Catalog details share the open visit's selected record. Adding an
exercise copies a snapshot into the draft. See the
[offline catalog verification](issue-138-offline-catalog.md).

## Legacy backend setup

These instructions cover the retained hosted adapter and backend tools from the
pre-cutover app. The production app runs independently of this setup.


### Configure the hosted connection

In `.env` copied from `.env.example`, keep `EXPO_PUBLIC_SUPABASE_URL` and replace
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the development project's publishable
key from a maintainer. No Supabase account/dashboard access is needed for this.
Never use database passwords or secret/service-role keys in app settings.
Git ignores `.env`. Restart Expo after changes.

### Check the backend

Open <https://jibzcwwursyzvvthazby.supabase.co/functions/v1/health>; expect
`{"status":"ok"}`. This checks function reachability only, not app credentials,
email delivery, or database access. Ask a maintainer about deployment failures.
Account access needs the application User migration and hosted Auth configuration
below. Template persistence additionally requires all committed migrations and the
`workout-templates` Edge Function; health alone does not establish that they work.

### Optional: run your own local backend

Install and start [Docker Desktop](https://www.docker.com/products/docker-desktop/).
From the repository root, use the pinned Supabase CLI 3.1.0:

```sh
npx --yes supabase@3.1.0 start
npx --yes supabase@3.1.0 status
npx --yes supabase@3.1.0 db push --include-all
npx --yes supabase@3.1.0 db query --read-only 'select 1 as connected'
```

`db push --include-all` applies pending migrations, including older-numbered
changes from parallel branches; the query should return
`connected: 1`. First startup downloads images.
Set BOTH `.env` values to the local URL and publishable key from `status`.
Use `http://127.0.0.1:54321` on the computer, `http://10.0.2.2:54321` for Android
emulators, or the computer's LAN IP for a physical phone. Restart Expo.
Studio is at <http://127.0.0.1:54323>; test emails at <http://127.0.0.1:54324>.
In another terminal, run `npx --yes supabase@3.1.0 functions serve`;
<http://127.0.0.1:54321/functions/v1/health> should return `{"status":"ok"}`.
Stop that process with Ctrl+C, then run `npx --yes supabase@3.1.0 stop` when done.
Stopping preserves data. After Auth config/template changes, stop and start the
stack with the pinned CLI to pick them up. For Docker failures check `docker info`;
for port conflicts stop other local stacks. Keep services on a trusted network.

### Verify the database in isolation

Run `npm run test:db` with Node/npm and Docker available. It uses CLI 3.1.0 to
start a temporary PostgreSQL-only project on unused ports, verify migrations
preserve existing Auth/User/template records, rebuild, and run database tests.
It removes its containers/volumes and does not reset your local or hosted stack.
No hosted credentials or PostgreSQL client are needed.
Failures include migration, assertion, or cleanup errors; cleanup failures print
recovery details. For behavior-only checks on your migrated local stack, run
`npx --yes supabase@3.1.0 test db`.

See the [migration workflow](../supabase/migrations/README.md) for schema changes
and the [maintainer guide](maintainers.md) for hosted administration/deployment.

## Email OTP configuration and verification

Committed local Auth settings use six-digit codes, 600-second expiry, one-minute
send frequency, signup enabled, and email confirmation disabled. Both confirmation
and Magic Link email slots use `supabase/templates/email-code.html`; verification
uses the entered code, with no mobile callback. Maintainers must separately apply
these settings/templates and migrations to hosted development. Configure hosted
[SMTP and recipient restrictions](https://supabase.com/docs/guides/auth/auth-smtp)
for testers; credentials stay in Supabase.

After verification, the app loads `public.users`; an absent record requires name
onboarding, and editing updates `account_name`. Auth metadata names are ignored.
Lookup failures offer Retry loading account without opening onboarding. SDK tokens
use native storage/process locking. Valid stored access restores on reopening;
explicit sign-out, reinstall, or ended authentication requires email OTP again.
Refreshing valid credentials preserves drafts. Account changes or definitive access
loss clear protected state; ordinary template connection/permission errors retain it.

For the real-service check, start a **disposable local** stack with committed
migrations, Auth settings, and templates (separate project ID/ports), then run:

```sh
AUTH_TEST_WORKDIR=/absolute/path/to/disposable-supabase-project node scripts/check-auth.cjs
```

It creates test accounts/local Mailpit emails and checks new/returning access,
invalid/reused codes, resend timing (including a real sixty-second wait), User
creation/editing, retry, and access isolation. No external email is sent. To check
expiry, set only that disposable stack's OTP expiry to two seconds, restart it,
and add `AUTH_TEST_EXPIRY_SECONDS=2` to the command. Keep committed expiry at 600.
Device review and hosted delivery verification remain separate from these checks.

The optional [persisted template read check](./issue-121-template-reads.md) exercises
the production service through a disposable local Edge Function and database.
The pre-cutover app used that service by default.
The same check now covers [atomic creation and retry safety](./issue-122-template-creation.md),
including an injected late-write failure in the disposable database.
It also verifies [retry-safe deletion](./issue-124-template-deletion.md), including
lost responses, owner isolation, cascade failure recovery, and creation replay.

## Verify template persistence in isolation

With Docker running, use `npm run test:templates`. The checked-in runner creates a
fresh local project on unused ports, copies only committed configuration,
migrations, functions, and email templates, starts its own backend/function server,
and runs the production service through real HTTP. It verifies CRUD, snapshots,
ordering beyond backend row limits, retries, rollback, two-user isolation, restored
credentials, renewed access, and old-account request rejection. It removes only its
own containers/volumes and scratch files. No hosted credentials or email delivery
are needed; fixtures provision local accounts and are cleaned up.

The separate `npm run test:db` verifies clean/populated migrations and database
policies. TypeScript/Jest and Expo checks remain as listed above. Backend startup
logs can contain local credentials, so the runner keeps them private; a startup
failure prints their scratch location for diagnosis. If cleanup fails, use the
printed project path with the pinned CLI's local `stop --no-backup --workdir PATH`.
Do not redirect checks to a shared project or add a remote target.

Native device review remains separate: verify restart/update/reinstall + OTP on
the same backend/account, drag ordering, keyboard, large text, and both themes.
The [#125 validation record](issue-125-template-production.md) distinguishes checks
completed here from device and hosted audit work still requiring review.
