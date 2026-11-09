# Setup

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`) and npm. With nvm installed, run `nvm install`
  and `nvm use` from the repository root.
- Expo Go compatible with **SDK 58** on an iPhone or Android device.
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
are not required for the UI stub. The app uses bundled sample data and stores
only the appearance preference locally.

## Install and launch

From a fresh checkout, run these commands in the repository root:

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
navigation and the asynchronous ViewModel/theme boundaries. Expo Doctor checks
SDK and native dependency compatibility. No CI pipeline is configured yet.

To check native JavaScript bundles without a device:

```sh
npx expo export --platform ios --platform android --output-dir dist
```

This checks bundling; it does not replace launching on a physical device.

## Device review

- Launch on Templates. Open both sample templates and return with Back.
- Switch to Workouts, open a session, and compare target and recorded sets.
- Open Account → Settings. Select Light, Dark, and System; navigation and screen
  colors should follow the selection. For System, change the phone's appearance.
- Reload the app and confirm the selected appearance is retained.
- Open Account → Sign in to see the account-access placeholder.

Sample plans/history are fixed fixtures; authentication, editing, workout logging,
catalog access, and backend persistence are implemented in their feature tasks.

## Frontend structure

- `app/`: Expo Router tabs and nested stacks. Templates is the initial tab.
- `src/views/`: Native screen components; they render ViewModel state.
- `src/viewmodels/`: Hooks for asynchronous loading, retry, cancellation, and theme state.
- `src/models/`: Readonly template/session types. Sessions store independent snapshots.
- `src/services/`: Async workout interface, sample implementation, and preference storage.
- `src/theme/`: Shared light/dark color tokens based on the chosen palette.

The root layout injects the workout service and preference store. To integrate
real data, implement `WorkoutService` and replace the injected implementation;
views never import fixtures. Loading, errors, retry, empty lists, and missing
detail records are supported. Sample weights use pounds (`lb`).

These instructions provide the runnable setup requested by [#38](https://github.com/LibreLift/libre-lift/issues/38)
and the frontend portion of [#13](https://github.com/LibreLift/libre-lift/issues/13).
Backend setup must be documented when those services become available.
