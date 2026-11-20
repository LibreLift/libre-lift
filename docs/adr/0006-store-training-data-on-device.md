# Store training data on one device with SQLite

For [#136](https://github.com/open-source-fitness/open-fit/issues/136), OpenFit will use one device as the authoritative store for workout templates, workout sessions, and personal exercise maximums. Use `expo-sqlite` behind the injected services, replace Supabase sign-in with local display-name onboarding, and bundle the attributed RepDB catalog and flat illustrations so the app works from its first launch at a gym without a connection. Keeping Supabase would preserve account-based recovery and cross-device access, but would add backend operations and require synchronization to deliver reliable offline writes.

## Consequences

- The cutover skips migration because the hosted records are disposable test data.
- Users learn during onboarding that training data is stored on their device and the app offers no backup. Backup and recovery are roadmap work. Cross-device viewing and sync may be explored later.
- [ADR 0002](./0002-use-mvvm-with-injected-services.md) and [ADR 0003](./0003-preserve-independent-session-history.md) still govern the service boundary and independent workout history. Whole-template saves remain atomic. This decision supersedes the hosted runtime in [ADR 0001](./0001-shared-development-backend.md), email OTP in [ADR 0004](./0004-email-otp-account-access.md), and the authenticated HTTP and database-function mechanism in [ADR 0005](./0005-save-template-aggregates-transactionally.md) when the cutover lands.
- Verify the existing template workflow on SQLite in airplane mode before building workout session, history, and personal exercise maximum persistence on it.
