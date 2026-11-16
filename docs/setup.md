# Setup

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`) and npm. With nvm installed, run `nvm install`
  and `nvm use` from the repository root.
- Expo Go mobile app on an iPhone or Android device.
- A computer and phone on the same Wi-Fi network.

The app targets SDK 58 to match the Expo Go version on the review device.
The `expo` dependency in `package.json` selects the SDK; `package-lock.json`
records the exact installed versions. The `version` in `app.json` is the app's
release version, not its Expo SDK version.

Use the committed dependency versions. When upgrading the SDK, follow
[Expo's upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
and run `npx expo install --fix` to align native packages, then `npx expo-doctor`.
The installed Expo Go build must support the project's SDK version. Android
users can get matching builds from [Expo Go downloads](https://expo.dev/go).

Account access requires the public Supabase app settings described below and a
backend configured to send email codes. A paid Apple developer membership is not
required. Training screens still use bundled sample data; template metadata edits
live in memory for the running app session. Appearance persists locally.

## Install and launch

For a fresh checkout, clone the project first:

```sh
git clone https://github.com/LibreLift/libre-lift.git
cd libre-lift
```

From the repository root, install and launch the app:

```sh
npm ci
npm start
```

`npm start` runs `expo start --go` and displays a QR code for the LAN development
server (port 8081 by default). Keep the terminal running.

1. Install Expo Go on your iPhone from the App Store.
2. Sign into the same free Expo account in Expo Go and the CLI if prompted
   (`npx expo login`).
3. Join the same Wi-Fi network as the development computer.
4. Scan the QR code with the iPhone Camera and open the link in Expo Go.
5. Allow Expo Go local network access if iOS asks.

For Android, scan the QR code from the matching Expo Go app. If testing with
already-configured simulators/emulators, `npm run ios` and `npm run android`
launch Expo Go there. They require Xcode or Android Studio respectively;
physical-device testing does not.

If LAN access fails, check local network permission, VPN, firewall, and whether
the Wi-Fi isolates devices. Alternatively, install Expo's tunnel helper with
`npm install --global @expo/ngrok` and run `npm start -- --tunnel`. A tunnel
requires internet access. Stop the server with Ctrl+C.

## Checks

```sh
npm run typecheck
npm test
npx expo-doctor
```

The TypeScript check validates app, service, and ViewModel types. Tests cover
navigation, template counts, metadata updates, draft/save guards, history
expansion, and asynchronous ViewModel/theme boundaries. Controlled service
responses exercise pending saves, failures, and retry. Expo Doctor checks
SDK and native dependency compatibility. No CI pipeline is configured yet.

To check native JavaScript bundles without a device:

```sh
npx expo export --platform ios --platform android --output-dir dist
```

This checks bundling; it does not replace launching on a physical device.

## Device review

- Launch on account access. Enter your email, request a code, and enter the
  six-digit code from the email. A missing account name must be saved before
  Templates opens. Codes expire after ten minutes; resend becomes available
  after sixty seconds. Wrong codes and request failures allow correction/retry.
- Change email returns to the populated email field and abandons that attempt.
  The sent code expires naturally at Supabase; this does not revoke it. Closing
  the app before verification starts account access afresh.
- Appearance Settings is available before signing in. Once signed in, Account
  displays name/email and supports Edit name, Save, Cancel, and save retry.
- In Templates, both samples show 2 exercises and 5 sets. Open their detail
  screens and confirm the template preview footers are absent.
- Edit a title/description and Save. Return to the list and reopen the template;
  the saved values should remain. Cancel another edit and confirm it is discarded.
- With an unsaved draft, switch tabs and return; the draft should remain. Back or
  swipe prompts Discard changes / Keep editing. Check the fields remain reachable
  with the keyboard open and with increased text size.
- Switch to Workouts and open a session. Exercise sections start collapsed; expand
  them to compare target and recorded sets. Expansion survives tab changes, while
  returning to the list and opening a session again starts collapsed.
- Open Account → Settings. Select Light, Dark, and System; navigation and screen
  colors should follow the selection. For System, change the phone's appearance.
- Reload the app and confirm the selected appearance is retained.
- Opening a training route while signed out must lead to account access.
  After successful access, Back must not return to an unfinished attempt.

Sample exercises and history are fixed fixtures. Template title/description edits
reset to the bundled values in a fresh app session; a normal tab change or screen
reopening does not reset them. The auth SDK stores renewable sessions, but this
change does not restore them into the app on relaunch: #43 owns restoration,
expiration handling, sign-out, and account-specific cleanup. Full template
editing, workout logging, catalog access, and training-data persistence remain
in their feature tasks.

## Frontend structure

- `app/`: Expo Router account access, required name collection, and guarded tabs.
  Templates is the first tab after successful account access.
- `src/views/`: Native screen components; they render ViewModel state.
- `src/viewmodels/`: Hooks for asynchronous loading, retry, cancellation, and theme state.
- `src/models/`: Readonly template/session types. Sessions store independent snapshots.
- `src/services/`: Async workout interface, sample implementation, and preference storage.
- `src/theme/`: Shared light/dark color tokens based on the chosen palette.

The root layout creates the session-local workout service and injects it with the
preference store. The workout provider refreshes template reads after successful
metadata updates and exposes the save-in-progress state used by navigation. To integrate
real data, implement `WorkoutService` and replace the injected implementation;
views never import fixtures. Loading, errors, retry, empty lists, and missing
detail records are supported. Sample weights use pounds (`lb`).

These instructions provide the runnable setup requested by [#38](https://github.com/LibreLift/libre-lift/issues/38)
and the frontend portion of [#13](https://github.com/LibreLift/libre-lift/issues/13).
Backend setup for contributions and future service integration is documented below.

## Backend setup

Supabase provides the database and backend services. This setup is for backend
contributions and authentication and future training-data service integration.

### Configure the hosted connection

Copy `.env.example` to a new file named `.env` in the same folder. In `.env`:

1. Keep the supplied `EXPO_PUBLIC_SUPABASE_URL`.
2. Ask a maintainer for the development project's **publishable key** and replace
   `replace-with-project-publishable-key` with it.

You do not need a Supabase account or dashboard access. Use only the publishable
key; database passwords and secret/service-role keys must never go in app settings.
Git ignores `.env`, so your settings stay on your computer.

### Check the backend

Open this URL in your browser:

<https://jibzcwwursyzvvthazby.supabase.co/functions/v1/health>

You should see `{"status":"ok"}`. This confirms the hosted health function is
reachable; it does not test your app settings or database access. If it fails,
ask a maintainer to check the deployment.

Account access reads these public settings through the shared Supabase client.
Missing/invalid settings produce an account-access error with retry. Training
reads and writes continue to use sample data pending their persistence tasks.

### Optional: run your own local backend

Use this when testing backend changes without affecting the shared deployment.
It needs no hosted credentials. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/),
open it, and wait until it reports that its engine is running.

In your project terminal, run:

```sh
npx --yes supabase@3.1.0 start
npx --yes supabase@3.1.0 status
npx --yes supabase@3.1.0 db query --read-only 'select 1 as connected'
```

`npx` downloads and runs our required Supabase CLI version, **3.1.0**. The first
start downloads service images and can take several minutes. The final command
should return `connected: 1`, confirming the local database works.

To point the app at this backend, change **both** values in `.env`: set the URL
to `http://127.0.0.1:54321` and use the local publishable key shown by `status`.
For an Android emulator, use `http://10.0.2.2:54321`; for a physical phone, use
your computer's LAN IP instead of `127.0.0.1`, on the same trusted network.
Restart Expo after changing these values when testing backend integrations.

To check the local health function, run this in a second terminal in the project:

```sh
npx --yes supabase@3.1.0 functions serve health
```

Open <http://127.0.0.1:54321/functions/v1/health> in your browser. Expect
`{"status":"ok"}`. Local database browsing is at <http://127.0.0.1:54323>;
local test emails appear at <http://127.0.0.1:54324>.

After changing local Auth settings or email templates, run `supabase stop` and
`supabase start` using the pinned CLI above from this checkout. Existing data is
preserved; already-running containers do not pick up the changed settings.

When finished, press Ctrl-C in the function terminal, then stop the backend:

```sh
npx --yes supabase@3.1.0 stop
```

Stopping preserves local data. If startup cannot connect to Docker, check that
Docker Desktop is running (`docker info`). If ports are busy, stop any other
local Supabase stack first. Keep local services on a trusted network.

For backend contributions, see the [local migration workflow](../supabase/migrations/README.md).
Hosted administration and deployments are covered in the [maintainer guide](maintainers.md).

## Email OTP configuration and verification

The local Auth configuration sets six-digit codes, a 600-second expiry, and a
one-minute send frequency. Both confirmation (new account) and magic-link
(returning account) email template slots use the committed code-only email
content. The returning-account template slot is named “Magic Link” by Supabase;
it must contain the token, not a sign-in URL. No mobile callback is required.

For hosted development, a maintainer must apply the same email template content,
OTP length, expiry, and send frequency in Auth settings. Keep email signup
available. Configure SMTP/delivery restrictions for the intended testers; the
built-in mail service has recipient and project-wide rate limits. Committing
local config does not apply hosted settings. Never put a secret/service-role key
in the Expo environment. Hosted delivery to ordinary users requires custom SMTP;
Supabase's default provider restricts recipients to project team addresses. New
free-tier projects using the default provider cannot customize email templates.
See [SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp) and
[template restrictions](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
Keep SMTP credentials in Supabase, never in the app. Build the deployed app with
the hosted project URL and its matching publishable key; changing Expo public
settings requires restarting the development bundler or rebuilding the deployed
app bundle. Merging this PR does not apply hosted Auth settings automatically.
Account names are saved in authenticated user metadata;
no public profile table is introduced.

The app injects an asynchronous auth service, uses the SDK's native session
storage and process lock, and keeps SDK tokens out of View components. #43 must
restore persisted sessions into app state and manage their lifecycle. There is
no app-imposed maximum session lifetime or inactivity timeout in #42.

An opt-in check exercises the actual service against a **disposable local** stack
and its Mailpit inbox, without sending external email:

```sh
AUTH_TEST_WORKDIR=/absolute/path/to/disposable-supabase-project node scripts/check-auth.cjs
```

Start that stack with the committed auth settings and templates first. Use a
separate project ID and free ports if another stack is running. The script checks
new and returning access, code-only email, invalid and reused codes, account-name
persistence, and resend behavior, including waiting for the real sixty-second
interval. To check time-based expiry quickly, set only the disposable stack’s
OTP expiry to two seconds, restart it, and run the same script with
`AUTH_TEST_EXPIRY_SECONDS=2`. The committed application setting remains 600
seconds. The expiry mode verifies an unused code is rejected after its deadline.
The script creates a test account and emails in that disposable stack. Ordinary
`npm test` uses injected services and clocks and needs no backend or credentials.

The existing router tests exercise forms, protected routes, appearance Settings,
resend timing, abandoned attempts, name editing, and recoverable failures. Native
bundle checks do not replace device review or hosted email-delivery verification.
