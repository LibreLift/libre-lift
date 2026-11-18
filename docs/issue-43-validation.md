# Authentication sessions: implementation and validation

The confirmed specification is [issue 43](issue-43-auth-sessions.md). Its approved
vertical slices were published as #115 (returning access), #116 (local sign-out
and isolation), and #117 (refresh, expiration, and recovery), with native parent
and blocking links. The parent issue's specification was preserved.

## Implemented behavior

- Restore stored authentication and load the application User before training.
  Protected direct links wait for readiness; absent Users require onboarding.
- Offer Settings and Sign out even while restoration/User loading is pending.
- Preserve work during routine same-account refresh. Gate unusable authentication;
  retain stored credentials on temporary failure and reload cleanly on recovery.
- Sign out locally with unsaved/pending controls. Server failure does not prevent
  local exit; device cleanup failure blocks access until retry succeeds.
- Reset account-scoped service instances, drafts, reads, edits, and navigation.
  Ignore stale operations and unmatched refreshes after access ends.
- Preserve current renewed credentials when an earlier name save completes.
  Protected operations use the SDK's current authenticated context.

## Automated checks

Run in the implementation workspace on November 18, 2026:

- `npm test`: 16 suites, 119 tests passed, including 21 session-router tests
  after the GitHub review fix.
- `npm run typecheck`: passed.
- `npx expo-doctor`: 20/20 checks passed.
- `npx expo export --platform ios --platform android`: both bundles passed,
  repeated after the review fixes.
- `git diff 5d05ac3...HEAD --check`: passed.

The opt-in `scripts/check-auth-sessions.cjs` passed against a newly generated,
isolated local Supabase stack with committed migrations and Auth configuration:

- Persisted restoration across client recreation and application User loading.
- Real token renewal and protected requests using its current credentials.
- Switching between two real authenticated accounts without reading/updating
  the other account's User.
- Local credential removal despite a simulated server logout failure, with an
  independent session still renewable.
- Device storage removal failure followed by successful cleanup retry.
- Rejected refresh for revoked stored authentication prevents restoration.

The SDK logs an expected invalid-refresh-token error in the revocation case;
the check asserts the account is not restored. No hosted settings or existing
local backend were changed. The generated stack is removed after verification.

## Standards

The two-axis code review used baseline `5d05ac3`. Standards review initially
identified a fixed-instance service injection path, duplicate SDK session mapping,
a stale-name-save credential race, and missing top safe-area handling for the
recovery notice. All were fixed; follow-up review reported **zero remaining
Standards findings**.

## Spec

Spec review identified the stale-name-save race, unavailable controls during
stalled restored User loading, fixed-service lifetime bypass, and acceptance of
unmatched late refreshes. Router regressions cover those cases. Follow-up review
reported **zero remaining Spec findings** and no scope creep.

## GitHub automated review follow-up (#118)

Codex identified discarded token refreshes while a newly verified account's User
lookup was pending or awaiting retry. A router regression reproduced draft loss
at the original token expiry. The provider now retains renewed verified
credentials through the lookup; both pending and retry variants pass. Typecheck
and the complete test suite were repeated after the fix.

An earlier finding about expired/offline sign-out applied to auth-js 2.118.0,
not the locked 2.119.0 dependency. The published package matches the lockfile
integrity and already removes local credentials after retryable refresh failure.
A real-SDK check through the app service, using an expired persisted fixture and
HTTP 503 for every request, confirmed sign-out resolves, credentials are removed,
and a fresh client restores no account. Evidence is recorded on the resolved PR
thread; no duplicate credential-removal implementation was added.

## Physical-device verification

After correcting the hosted API-key configuration, the maintainer reported that
the feature was verified on a physical device. This verification was performed
by the maintainer, not by the implementation agent. The configuration correction
did not require a tracked code change; the old and new email-code request paths
produce the same error when the gateway rejects an invalid key.

The implementation workspace had no available simulator devices. The particular
physical-device platform and individual scenario results were not recorded here,
so this report does not independently claim an exhaustive iOS/Android, keyboard,
large-text, or both-theme matrix.

## Remaining release requirements

Independent non-author contributor PR approval and the repository's post-merge
production audit remain part of the definition of done. These local results and
the maintainer's device verification do not themselves close the issues or mark
them Done. Concrete personal exercise maximum cleanup remains #49.
