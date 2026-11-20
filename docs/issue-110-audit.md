# Account-access hosted and device audit (#110)

## Preflight: November 17, 2026

Implementation: `1d3ff78`, plus Expo 58.0.26, Expo Router 58.0.32, and Jest Expo
58.0.15 patch updates included in this PR. Sign-in emails retain the installed app's
branding.

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
| Email confirmations | Disabled (aligned after audit) | Disabled |
| New-account email subject | Branded sign-in code | Confirm your email address |
| Returning-account email subject | Branded sign-in code | Your One-Time Password |

Hosted custom SMTP is enabled. The author subsequently confirmed manual
verification of the hosted email template. The subject differences above are
recorded cosmetic differences; the audit relies on the verified code-based body
and successful hosted access rather than exact subject matching.
No hosted settings have been changed during this audit. The author selected
disabled email confirmation, and the committed local configuration now matches
the hosted value. The app still requires successful email-code verification
before loading the application User or entering training. Subject differences
alone do not establish a functional email failure.

## User-reported hands-on evidence

Device: **iPhone 13**, **iOS 27**, **Expo Go 58.0.5**, as reported by the author.
Android was **not tested**. The maintainer explicitly deferred its device/emulator
audit to [#112](https://github.com/open-source-fitness/open-fit/issues/112), removing
it from #110's immediate acceptance scope. Successful Android bundling remains
build evidence only.

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
iPhone environment and confirmed Android was not included. The immediate device
audit is now iPhone-only, with the approved Android deferral tracked in #112.
Do not infer additional device observations from the initial checkmarks.

Next steps:

1. Obtain the required non-author contributor review and audit, and record results
   on the merged #108/#109 implementation PR. This document carries pre-merge
   evidence; the post-merge audit requirement remains outstanding.
2. Complete the deferred Android audit separately under #112.

Keep #110 open while required evidence is missing. Authentication-session
restoration/sign-out remain #43, and training persistence remains #45.
