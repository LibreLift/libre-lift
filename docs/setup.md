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
git clone https://github.com/open-source-fitness/open-fit.git
cd open-fit
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
EXPO_OFFLINE=1 EXPO_NO_DOTENV=1 npx expo export --platform ios --platform android --output-dir dist
```

These check types, Jest behavior, Expo dependencies, and native JavaScript bundles.
Jest needs no backend or credentials. The export checks the production JavaScript
bundles and bundled assets with Expo offline and dotenv loading disabled. Use an
installed release build to verify the native SQLite bridge and image rendering.

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

Use a supported physical device for the offline acceptance audit. Start from a
fresh checkout and run `npm ci` while the build computer is online. Set up Android
Studio and its SDK for Android, or Xcode and CocoaPods for iOS. A physical iPhone
requires local code signing. An emulator or simulator can be used for a rehearsal.

In your disposable checkout, set `expo.android.package` or
`expo.ios.bundleIdentifier` in `app.json` to an unused test identifier before
generating the native project. Keep this identifier out of commits. Before
running the command, connect the test device over USB, enable airplane mode,
and turn Wi-Fi off. The command can launch the app immediately after installing
it. Keep Metro stopped throughout.

```sh
# Android
npx expo run:android --variant release --device --no-bundler

# iOS
npx expo run:ios --configuration Release --device --no-bundler
```

Select the test device when prompted. The native project is generated locally.
See [Expo's local build guide](https://docs.expo.dev/guides/local-app-development/).

1. On first launch, confirm the storage and backup notice,
   enter a display name, and check the greeting and empty template list.
2. Search and filter the bundled RepDB catalog. Confirm it credits RepDB, then
   read the instructions and view a single illustration and both poses of a
   paired exercise. Add exercises to a template and save a name, description,
   and fixed weight and rep targets.
3. Force-close the app through the OS and reopen it while offline. Confirm the
   display name and template targets survived. Check that Cancel discards an
   edit, then save different targets and reorder the exercises. Reopen and
   verify the saved edit. Delete the template, then force-close and reopen to
   confirm it stays deleted.
4. Create another template, edit the display name in Settings, and select a
   different appearance. Install a newer release build over it without
   uninstalling or clearing storage. Use the same application identifier and
   signing identity, then verify the name, template, saved exercise details,
   and appearance offline.
5. Check keyboard access, increased text size, Light/Dark/System appearance, and
   the sample labels on workout history and detail.

Record the commit(s), device and OS version, install and network conditions,
and the result of each step. Record the packaged release size and compare it
with a release build of pre-catalog commit `63065abb17793d2b217d3b5d3161d1ae143da0ce` using the same platform,
build configuration, and size measurement. The
[#138 catalog record](issue-138-offline-catalog.md#bundle-evidence) gives the
exported bundle comparison. The [#141 verification record](issue-141-local-onboarding.md)
gives the existing automated SQLite evidence, including save failures and retries.

Unsaved drafts are temporary. Backup and recovery are planned after the MVP.

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

## Historical backend

The previous Supabase workflow is archived. See the
[historical backend notes](maintainers.md) for the pre-cutover snapshot and
retained artifacts.
