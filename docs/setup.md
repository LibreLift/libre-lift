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

Docker, Supabase CLI, backend credentials, and a paid Apple developer membership
are not required for the UI stub. The app uses bundled sample data and persists
only the appearance preference across app restarts. Template metadata edits live
in memory for the running app session.

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

- Launch on Templates. Both samples show 2 exercises and 5 sets. Open their detail
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
- Open Account → Sign in to see the account-access placeholder.
- Open Templates → Exercise catalog with internet access. Confirm the loading
  indicator gives way to alphabetically ordered live exercises, grouped primary
  and secondary muscles, and equipment. Search names using different casing and
  choose a muscle group; both controls should narrow the results together, using
  primary targets only. Clear a no-match result to restore all exercises without
  reloading. Scroll the full list, open the RepDB
  credit link, and check both themes. Switch tabs and return to retain the open
  catalog and its search/filter state; Back and reopening resets the controls
  and starts a fresh request. With networking unavailable,
  confirm the clear failure message and Back control; no Retry button is provided.

Sample exercises and history are fixed fixtures. Template title/description edits
reset to the bundled values in a fresh app session; a normal tab change or screen
reopening does not reset them. Authentication, full template editing, workout
logging, template exercise selection, and backend persistence remain in their
feature tasks. The standalone exercise catalog loads real RepDB data; it does not
change the sample templates or history.

## Frontend structure

- `app/`: Expo Router tabs and nested stacks. Templates is the initial tab.
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

The root also injects a separate exercise catalog service. Its construction API
accepts an HTTP request function: production supplies real HTTP, while route tests
supply controlled responses through the same API. The catalog ViewModel uses the
existing mapper, presents familiar muscle groups, and retains results only for
the open screen. The temporary route uses a virtualized list rather than loading
the catalog into the sample workout service. Catalog caching and retry are deferred.

These instructions provide the runnable setup requested by [#38](https://github.com/LibreLift/libre-lift/issues/38)
and the frontend portion of [#13](https://github.com/LibreLift/libre-lift/issues/13).
Backend setup for contributions and future service integration is documented below.

## Backend setup

Supabase provides the database and backend services. This setup is for backend
contributions and future service integration; it is optional for the UI stub.

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

The current UI stub uses sample data and does not read these settings. Service
integration will connect workout reads and writes to the development backend.

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

When finished, press Ctrl-C in the function terminal, then stop the backend:

```sh
npx --yes supabase@3.1.0 stop
```

Stopping preserves local data. If startup cannot connect to Docker, check that
Docker Desktop is running (`docker info`). If ports are busy, stop any other
local Supabase stack first. Keep local services on a trusted network.

For backend contributions, see the [local migration workflow](../supabase/migrations/README.md).
Hosted administration and deployments are covered in the [maintainer guide](maintainers.md).
