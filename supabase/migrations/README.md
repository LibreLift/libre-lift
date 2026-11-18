# Database migrations

A migration is a SQL file describing a database structure change, such as adding
a table. Contributors can create and test migrations locally; only maintainers
apply them to the shared hosted project. Committed migrations define the schema.
The M1 migrations begin with application-owned Users; there is no automatic user
or sample-data seeding.

## Application User contract

`public.users.id` is the account's UUID and references `auth.users.id`. Auth-account
deletion cascades to its application User. No trigger creates an application User
on sign-in: #42 reads the record after verification, and a missing record means
name onboarding. Submitting the name inserts the User; later changes update only
`account_name`. Names are required and cannot consist only of whitespace; different
Users may share a name.

Authenticated requests can select, insert, and update only their own User through
RLS. Column grants allow editing the name but not the identity. Anonymous access
and direct application User deletion are denied. Account names in Auth metadata
are not authoritative. Do not alter Supabase's managed Auth schema.

## Database tests

After applying migrations to your local backend, run:

```sh
npx --yes supabase@3.1.0 test db
```

The pgTAP tests use real database operations as anonymous and two authenticated
accounts; administrative access is used only for fixture setup and account deletion.
Each test file rolls back its fixtures. Tests do not send OTP emails or test #42's
onboarding UI. For an isolated stack elsewhere, supply `--workdir` and the absolute
test-file path; do not reset or redirect tests to a shared/hosted database.

## Create and test locally

Start the local backend using [setup](../../docs/setup.md), then run from the
repository root:

```sh
npx --yes supabase@3.1.0 migration new describe_change
```

Edit the generated `supabase/migrations/<timestamp>_describe_change.sql`, then apply
it to your local database and check its history:

```sh
npx --yes supabase@3.1.0 db push
npx --yes supabase@3.1.0 migration list
```

If you edited your local database through Studio instead, generate the SQL with
`npx --yes supabase@3.1.0 db diff -f describe_change` and review it.

Include explicit access grants and row-level security policies for exposed tables.
Local configuration disables automatic exposure of new tables. Feature tasks own
their tables, policies, and endpoints.

Verify that all migrations can rebuild the database from scratch:

```sh
npx --yes supabase@3.1.0 db reset
```

**Reset deletes local database data.** Never add `--remote` to reset a shared
database. Commit your reviewed SQL with the feature. Once a migration has been
shared, add a new migration to correct it instead of changing its history.

After pulling other contributors' migrations, run local `db push` to apply them,
or `db reset` if you want to discard local data and rebuild.

See the [maintainer guide](../../docs/maintainers.md) for hosted target checks,
deployments, and capturing edits made in the hosted dashboard.
