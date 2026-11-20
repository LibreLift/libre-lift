# Setup

## Prerequisites

- Node.js 24 (`.nvmrc`) and npm. With nvm, run `nvm install` and `nvm use`.
- Expo Go supporting SDK 58 on an iPhone or Android device.
- A computer and phone on the same Wi-Fi network; internet for email access and
  the live exercise catalog.

`package.json` selects Expo SDK 58; `package-lock.json` pins installed versions.
The version in `app.json` is the app release, not the SDK. Use committed versions.
OpenFit keeps the existing Expo slug and appearance storage key so Expo Go users
can reopen the app with their saved session and theme. The existing URL scheme
also keeps app links working across the rename.
For SDK upgrades, follow [Expo's guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/),
then run `npx expo install --fix` and `npx expo-doctor`.

Supabase settings are required to sign in and reach training screens; without
settings, the app opens account access and appearance Settings only. Templates
and account names persist in Supabase. Workout history remains clearly labeled
sample data until session persistence is available. The template endpoint and
committed migrations must be deployed before using the new app.
Docker and Supabase CLI are optional for hosted development.

## Install and launch

```sh
git clone https://github.com/open-source-fitness/open-fit.git
cd open-fit
npm ci
cp .env.example .env
```

Configure `.env` using **Backend setup** below, then run `npm start`.
This runs `expo start --go` on port 8081 by default; keep the terminal running.

1. Install the matching Expo Go build; sign into Expo Go and the CLI if prompted
   (`npx expo login`). Android builds are at [Expo Go downloads](https://expo.dev/go).
2. Join the computer's Wi-Fi network. On iPhone, scan the terminal QR code with
   Camera and open in Expo Go; on Android, scan from Expo Go.
3. Allow local network access if prompted. Stop the server with Ctrl+C.

For configured simulators/emulators, use `npm run ios` (Xcode) or
`npm run android` (Android Studio).
If LAN access fails, check permissions, VPN, firewall, and Wi-Fi device isolation.
Alternatively, install `npm install --global @expo/ngrok` and run
`npm start -- --tunnel`; tunneling requires internet. Restart Expo after `.env` edits.

## Checks

```sh
npm run typecheck
npm test
npx expo-doctor
npx expo export --platform ios --platform android --output-dir dist
```

These check types, Jest behavior, Expo dependencies, and native JavaScript bundles.
Jest needs no backend or credentials. Bundling does not replace device review.
No CI workflow, lint, or format script is checked in. Backend checks are below.

## Device review

- Sign in by email code, complete name onboarding, and edit the account name.
  Check invalid codes, resend, and failure recovery; training must stay gated.
- Create, edit, reorder, and delete templates. Check set targets, Save/Cancel,
  draft preservation across tabs, and discard confirmation when leaving.
- Search/filter the catalog, inspect images/instructions, and add an exercise to
  a draft. Check Back preserves browsing state and offline errors are clear.
- Open saved template exercises and expand workout history to review set details.
- Check keyboard access, increased text size, and Light/Dark/System appearance.
  Reload to confirm appearance, account names, templates, and valid account access persist.

Saved templates survive app restarts and updates. After reinstall, email OTP access
to the same account/backend restores them. Unsaved drafts remain temporary.
Workout logging and real workout-history persistence are not implemented.

## Frontend structure

- `app/`: Expo Router account access, name onboarding, Settings, and guarded tabs.
- `src/views/`: Native screens rendering ViewModel state.
- `src/viewmodels/`: Auth, theme, loading/retry, catalog, and shared template drafts.
- `src/models/`: Template, session, and exercise types with snapshot/validation rules.
- `src/services/`: Async service contracts, sample training data, Supabase Auth/User
  access, HTTP catalog mapping, and appearance storage.
- `src/theme/`: Shared light/dark colors.

The root layout injects workout, auth, catalog, and preference dependencies.
Its lazy Supabase runtime exposes the same client to authentication and feature
services, so later requests use the current authenticated session after refresh.
The injected persistence service's whole-template update and retry contract is
documented in [template updates](issue-123-template-updates.md), including its
disposable local service/HTTP/database check.
Production template operations use the authenticated persistence service; views do
not import fixtures. Controlled service factories remain available for tests. Template mutations refresh reads. Catalog requests accept injected HTTP;
results belong to the open visit, and detail shares its selected record. Adding
an exercise copies a snapshot into the draft. Catalog caching/retry are deferred.

## Backend setup

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
Production template composition uses that service by default.
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
