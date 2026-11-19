# Use email OTP for account access

During the [#42](https://github.com/open-source-fitness/open-fit/issues/42) design discussion
on November 13, 2026, the maintainer selected email OTP as the sole account-access
method, replacing the earlier email/password plus email OTP decision from #41.
Users of a gym app are expected to sign in infrequently and keep a renewable
session on their device, so avoiding a rarely used password is more useful than
offering multiple credential methods.

## Considered options

Email/password introduces password management and recovery for infrequent
sign-ins. Magic links require callback handling rather than code entry in the
app. Google and Apple OAuth introduce provider configuration and maintenance.
Email OTP serves both new and returning users without these additional flows.

## Account-access behavior

- One “Continue with email” flow serves new and returning users. Successful
  verification establishes access to a new account or signs into the existing
  account for that email; there is no separate registration form.
- Email codes contain six digits, expire after ten minutes, and can be requested
  again after a sixty-second cooldown shown in the UI. Wrong or expired codes
  leave the user able to retry or request another code.
- “Change email” returns to the populated email field, clears the entered code,
  and abandons the current attempt. Late responses from that attempt cannot
  advance the UI; another code request is required before verification in the
  new attempt. The earlier code remains valid at Supabase until it expires.
  The maintainer accepted this behavior instead of server-side cancellation.
- Conflicting actions are disabled while a request is pending. Unfinished
  sign-in attempts are not persisted across app restarts.
- Collect the account name after verification and before entering Templates
  when an account has no name. Allow editing the account name from Account.
  The signed-in Account screen shows account name, email, and Settings.
- Appearance Settings is also accessible before signing in.
- The [application User contract](../design.md#m1-database-scope-and-account-data-102)
  governs account-name storage and recovery if loading that User fails after
  successful verification. Auth metadata is not the authoritative name source.
- Password registration, password recovery, magic links, and OAuth are outside
  this account-access scope. In-app code verification needs no email callback.

## Navigation and session boundary

#42 introduces a signed-out account-access gate and opens Templates after
successful authentication and any required name collection. This supersedes
unrestricted sample browsing from the initial UI foundation.

“Indefinitely” means no application-imposed session lifetime or inactivity
timeout, using renewable sessions rather than non-expiring access tokens.
Sign-out, revoked credentials, or loss of the stored session require another
sign-in. [#43](https://github.com/open-source-fitness/open-fit/issues/43) retains restoration
across launches, expiration handling, sign-out, and account-specific state cleanup.
Training-data persistence and account isolation remain in their feature tasks.

## Testing decisions

Use the existing route-level seam with an injected authentication service and
controlled clock. Drive real screens and navigation to cover code requests,
validation, resend cooldown, failures and retries, abandoned attempts, account
name collection/editing, and the signed-out gate. Assert externally observable
behavior rather than hook internals or implementation structure.

Supplement these tests with real Supabase verification of code emails and
authentication behavior. Configure code templates and timing consistently for
the local backend and hosted development project.

## References

- [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase session behavior](https://supabase.com/docs/guides/auth/sessions)
