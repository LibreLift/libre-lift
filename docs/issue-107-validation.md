# Account-access completion verification (#107)

This change implements the application work in #108 and #109 under the approved
[#107 specification](https://github.com/open-source-fitness/open-fit/issues/107).
It does not complete the human-led hosted/device audit in #110 or close #42.

## Local evidence

- TypeScript passed; the full Jest suite passed all 98 tests across 15 suites.
- Router tests cover existing and missing application Users, failed and repeated
  account-loading retry, pending lookup controls with Settings available, lookup
  rate limits, and restart ignoring a late User response. Successful verification
  is retained while lookup retries; the consumed code is not submitted again.
- Existing onboarding/editing tests remain, with an additional pending onboarding
  save that fails, preserves its draft, and succeeds on retry.
- The real service check ran against an isolated local Supabase stack using the
  committed migrations, OTP timing, and code-only templates. It verifies no User
  before name submission, metadata-only onboarding, User creation, trimmed names,
  name editing, direct stored values, metadata disagreement, duplicate-insert
  reconciliation, anonymous rejection, and another authenticated User's isolation.
  It also checks invalid/reused OTPs, returning access, and the real resend interval.
  Test-only administrative credentials provision the second local account without
  external email; application requests use authenticated publishable-key clients.
- Initial iOS and Android bundle exports passed. The subsequent iPhone review
  and maintainer-approved Android deferral are recorded in the
  [#110 audit](issue-110-audit.md).
- Initial Expo Doctor passed 19/20 checks. Its only failure reported existing patch
  versions: expo 58.0.25 versus expected 58.0.26, expo-router 58.0.31 versus
  58.0.32, and jest-expo 58.0.14 versus 58.0.15. Those dependencies were unchanged
  in the initial implementation. The PR includes the audited Expo patch updates,
  and the subsequent audit passed all 20 Doctor checks.

Use the TypeScript/Jest commands and the opt-in disposable Supabase service check
documented in the [pre-cutover setup guide](https://github.com/open-source-fitness/open-fit/blob/63065abb17793d2b217d3b5d3161d1ae143da0ce/docs/setup.md#email-otp-configuration-and-verification) to reproduce
the checks. The approved UI seam injects the auth service and clock; the real
Supabase check independently establishes correct backend storage.

## Remaining acceptance work

#110 requires maintainer verification of hosted migration availability, matching
public app settings, OTP templates/timing, and actual email delivery. Run the
complete new/returning account and failure/retry journey on the physical iPhone
with Expo Go first. Android runtime review was deferred by the maintainer to #112.
Review keyboard use, increased text,
appearance, direct protected routes, and Back navigation. The author and a
non-author contributor must record the hosted/device audit on the relevant merged
implementation PRs. Local checks and agent review do not fulfill that requirement.

Session restoration, sign-out, and authentication lifecycle remain #43. Training
data remains in memory until #45; an application User does not make samples into
persisted personal training data.

## Agent code review

Two separate review agents checked standards and spec compliance against the
approved starting commit `2262f5e`. Standards: zero actionable findings; Spec:
zero findings, including no scope creep. These reviews do not replace the
non-author contributor approval required by the repository's merge process.
