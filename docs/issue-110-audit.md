# Account-access hosted and device audit (#110)

## Preflight: November 17, 2026

Implementation: `1d3ff78`, plus the working tree's Expo 58.0.26, Expo Router
58.0.32, and Jest Expo 58.0.15 package updates. Those dependency edits were
already present when this audit began and have not been modified by the audit.

Local checks on this reviewed working tree:

- TypeScript passed.
- Jest passed all 98 tests across 15 suites.
- Expo Doctor passed all 20 checks; the earlier patch-version warnings are resolved.
- iOS and Android bundle exports passed.

The app uses the hosted OpenFit development project
`jibzcwwursyzvvthazby.supabase.co`. Its configured publishable key is present
and is not a placeholder. The read-only hosted migration history matches both
committed migrations: `20261117000100` and `20261117000200`.

Read-only configuration comparison found differences that need reconciliation:

| Setting | Committed local value | Hosted value |
| --- | --- | --- |
| Email confirmations | Enabled | Disabled |
| New-account email subject | Your LibreLift code | Confirm your email address |
| Returning-account email subject | Your LibreLift code | Your One-Time Password |

Hosted custom SMTP is enabled. This comparison does not prove that delivered
email bodies contain codes instead of links, or that email delivery succeeds.
No hosted settings have been changed during this audit. The email-confirmation
difference must be resolved or explained before configuration parity is claimed;
subject differences alone do not establish a functional email failure.

## User-reported hands-on evidence

Device: **iPhone 13**, **iOS 27**, **Expo Go 58.0.5**, as reported by the author.
Android was **not tested**. Successful Android bundling is build evidence only,
not a substitute for its device/emulator acceptance check.

The author reported the name-edit recovery check passed: an initial online edit
worked, an edit while disconnected showed an error as expected, and retrying
with connectivity restored succeeded. This confirms the requested correction/
retry behavior in the author's iPhone session.

The author also reported all four account-loading recovery checks passed:

- After code verification, the loading error showed **Retry loading account**.
- Training remained inaccessible while the User was unresolved.
- Settings opened and Back returned to the recovery screen.
- Retry opened Templates without requesting or verifying another email code.

For this check only, the development build's first User lookup was deliberately
failed at the injected auth-service boundary. Code verification and the successful
retry used hosted Supabase. This verifies native UI behavior under a controlled
lookup failure; it does not claim an actual hosted outage was reproduced. The
temporary failure was removed after the author confirmed the result. Neither
hands-on report substitutes for a non-author contributor's audit.

## Evidence awaiting hands-on confirmation

Issue #110 already had hosted setup, new/returning access, and native-device
criteria checked when this audit began. The author has since identified the
iPhone environment and confirmed Android was not included. Keep the combined
native-device criterion incomplete until its Android coverage is resolved.
Do not infer additional device observations from the initial checkmarks.

Next steps:

1. Confirm the existing hosted/device evidence and reconcile the hosted settings.
2. Complete Android device/emulator review, and confirm any appearance/text/
   keyboard cases not covered by the existing iPhone evidence.
3. Obtain the required non-author contributor audit and record results on the
   relevant merged implementation PR. The #108/#109 implementation is currently
   a local commit with no implementation PR found at audit start, so this is
   pre-merge evidence until that delivery/review step is complete.

Keep #110 open while required evidence is missing. Authentication-session
restoration/sign-out remain #43, and training persistence remains #45.
