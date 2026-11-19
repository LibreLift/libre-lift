# Supabase maintainer guide

Use this guide to administer the shared hosted **development** backend. For
installation and local services, start with [setup](setup.md). All commands use
Supabase CLI **3.1.0** and run from the repository root.

Project: **OpenFit**, region **us-east-2**, reference `jibzcwwursyzvvthazby`.
Supabase labels its main branch “production”; this project is our development
environment, not a separate OpenFit production deployment.

## Access and deployment


Only maintainers receive organization/project dashboard access, CLI deployment
credentials, or database passwords. Contributors submit backend changes through
PRs and test them locally. Git commits do not automatically deploy anything.
Review membership in the OpenFit organization's dashboard when granting access.
Never distribute an access token, database password, or secret/service-role key
with contributor app settings. A publishable key does not grant deployment access.

Authenticate using your own Supabase account and inspect the target:

```sh
npx --yes supabase@3.1.0 login
npx --yes supabase@3.1.0 projects list
npx --yes supabase@3.1.0 link --project-ref jibzcwwursyzvvthazby
```

`link` stores machine-local connection state under ignored `supabase/.temp/`;
it does not deploy the checkout. Use password prompts rather than committing
credentials or putting them in shell history. Organization owners manage access
through Supabase; this repo does not provision dashboard memberships.

After review, run `npm run test:db` and `npm run test:templates` to verify clean
installation, populated migration preservation, ownership policies, and actual
service/HTTP/database behavior in isolated local projects.
Then check hosted migration history and the pending SQL:

```sh
npx --yes supabase@3.1.0 migration list --remote=jibzcwwursyzvvthazby
npx --yes supabase@3.1.0 db push --remote=jibzcwwursyzvvthazby --include-all --dry-run
npx --yes supabase@3.1.0 db push --remote=jibzcwwursyzvvthazby --include-all
npx --yes supabase@3.1.0 functions deploy health --remote=jibzcwwursyzvvthazby --use-api
npx --yes supabase@3.1.0 functions deploy workout-templates --remote=jibzcwwursyzvvthazby --use-api
```

Confirm the project reference in each hosted prompt. Omit `--yes` for interactive
review. The function deployment can bundle server-side without Docker. Deploy
other functions explicitly by name; do not prune unrelated deployed functions.
Run the hosted health request again after deployment. The M1 migrations create
application Users and template storage with explicit grants and RLS. No trigger
creates application Users and no sample data is seeded. Existing Auth accounts must supply
an account name through #42 before their application User exists. Applying the
schema alone does not deploy the template endpoint or publish the new app. Apply
all additive template migrations before deploying the updated endpoint and app.
The endpoint explicitly verifies user JWTs and forwards the same identity under
RLS; its disabled legacy gateway check is not anonymous authorization. Never
substitute privileged service credentials for routine template data access. Hosted schema application and the required post-merge audit remain
manual maintainer steps; `npm run test:db` never targets hosted data.

### Capture dashboard schema edits

Prefer local Studio edits first, then generate and review a migration:

```sh
npx --yes supabase@3.1.0 db diff -f describe_change
```

For a change already made in the **hosted** dashboard, coordinate with other
maintainers, start local Docker, and capture the difference:

```sh
npx --yes supabase@3.1.0 db pull --remote=jibzcwwursyzvvthazby
```

Review the generated SQL, any migration-history reconciliation prompt, and the
migration list before accepting. This workflow may update hosted migration
history even though it does not reapply the schema change. Commit the migration
and verify a local reset. Contributors then pull Git changes and run local
`db push --include-all` (preserves existing data where the SQL allows), or `db reset` (discards
local data). Do not blindly push a migration for a change already applied through
the dashboard. Coordinate any overlapping pending migrations before deployment.
Diffs do not capture all platform configuration or data changes.

### Local-to-hosted mapping

| Version-controlled item | Hosted action |
| --- | --- |
| `supabase/migrations/*.sql` | Explicit remote `db push` |
| `supabase/functions/<name>/` and its function config | Explicit named `functions deploy` |
| Local service ports, Studio and email inbox | Local only; hosted uses managed HTTPS services |
| Auth settings in `config.toml` | Review hosted settings separately; do not blindly push local defaults |
| `.env` app URL and public key | Select either local values or hosted values as a pair |

For #42 email OTP, apply the confirmation and returning-account code templates
and six-digit / ten-minute / one-minute Auth settings described in
[setup](setup.md#email-otp-configuration-and-verification). Test actual hosted
email delivery separately from the health endpoint. No email callback is needed.
SMTP, feature policies, and application endpoints require their own verification. Hosted settings are not synchronized just by committing
`config.toml`; deliberate config changes require separate review. Automated
hosted deployments are deferred to later M1 or M2.

References: [CLI v3 targeting](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3),
[migrations](https://supabase.com/docs/guides/local-development/database-migrations),
[function development](https://supabase.com/docs/guides/functions/development-environment),
[API keys](https://supabase.com/docs/guides/api/api-keys).

## Template rollout audit

Before publishing the app cutover, verify the deployed endpoint against two
maintainer-controlled accounts: empty lists without seeding, complete creation,
reopening, edits/reordering, fixed targets, safe retries, deletion, and ownership
isolation. Saved detail must use snapshots without catalog JSON requests. Verify
ordinary failures retain drafts, valid refresh preserves editing, and definitive
access loss clears protected state. Sample workout history must be labeled.

The required independent post-merge production audit also covers app restart,
update, and reinstall followed by email OTP access to the same account/backend.
Record actual results in the merged PR; do not treat local service recreation or
native bundle export as evidence that these device scenarios were performed.
Retry recognition remains after template deletion to prevent resurrection and
cascades away with the application User. Do not reset hosted data, rewrite shared
migrations, seed templates, or delete retry recognition as part of deployment.
