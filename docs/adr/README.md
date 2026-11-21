# Architecture decision records

The UI foundation records were captured retrospectively on November 9, 2026,
from the #38 design discussion and existing project requirements. They explain
consequential choices without treating the UI foundation as completed feature
integrations. The existing backend record retains its original number.

- [0001: Share hosted development while keeping schema changes reproducible](./0001-shared-development-backend.md)
- [0002: Use MVVM with injected asynchronous services](./0002-use-mvvm-with-injected-services.md)
- [0003: Preserve session history independently of templates](./0003-preserve-independent-session-history.md)
- [0004: Use email OTP for account access](./0004-email-otp-account-access.md)
- [0005: Save whole templates transactionally in the requesting user's context](./0005-save-template-aggregates-transactionally.md)
- [0006: Store training data on one device with SQLite](./0006-store-training-data-on-device.md)

- [Issue 44: Separate exercise placements from catalog identity and preserve saved details](./issue-44-catalog-identity-and-snapshots.md)

The [UI foundation decision summary](../ui-foundation.md) records the remaining
agreed scope and presentation choices. The [pre-cutover design](https://github.com/open-source-fitness/open-fit/blob/63065abb17793d2b217d3b5d3161d1ae143da0ce/docs/design.md#6-technology-choices-and-alternatives-considered)
records the provider and authentication choices for the Supabase implementation.
