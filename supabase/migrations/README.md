# Database migrations

> These migrations describe the former Supabase backend. See the
> [historical backend notes](../../docs/maintainers.md) for the pre-cutover
> checkout and [setup](../../docs/setup.md) for the SQLite workflow.

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

## Workout template contract

`public.workout_templates` stores a UUID, owning application `user_id`, nonblank
`title`, optional `description`, and immutable `created_at`. Duplicate titles are
valid. `public.template_exercises` stores its own UUID, parent `template_id`,
positive one-based `position`, namespaced `catalog_id`, and descriptive JSONB
`snapshot`. The snapshot preserves the existing catalog description (name,
primary/secondary muscles, equipment, and optional instructions, images, and
translations); catalog identity is relational. No live catalog table is required.

`public.template_sets` uses `(template_exercise_id, set_number)` as its key and
stores positive integer `target_reps` and finite nonnegative numeric
`target_weight` in pounds, preserving decimals and zero. Exercise positions and
set numbers are unique within their parent. Their uniqueness constraints are
DEFERRABLE: #45 can defer constraints inside one transaction when swapping order,
then validate the final order before committing. Database operations may temporarily
have missing exercises/sets or gaps; #45 must atomically validate and save complete
templates with consecutive ordering and at least one set per placement.

Authenticated requests can read, insert, edit, and delete their own template
aggregate under RLS. Column grants keep UUIDs, parents, owners, and creation times
immutable; metadata, positions, snapshots, and targets remain editable. Child
access follows the owning template, including inserts. Deleting a template removes
placements and sets; deleting an Auth account removes its User and templates.
Issue #45 supplies payload validation, HTTP/data-access/service contracts, draft ID
conversion, deterministic listing (creation time with UUID tie-break), and app
integration; this schema does not implement an API or change the current UI.

## Database tests

For the complete isolated migration and behavior check, run:

```sh
npm run test:db
```

The runner stages committed migrations in a temporary postgres-only Supabase
project. It verifies an existing Auth account survives initial application schema
creation without an invented User, then verifies a named User survives the template
migration. A subsequent no-op migration application preserves a complete saved
template. Finally it resets only that generated project and runs the database
suite against the clean rebuild. It copies no linked/hosted state, uses unused
ports, and removes only its own containers/volumes on completion. Fixtures exist
only in that temporary database, never as automatic seed data. Future migrations
are applied in order; once real migrations extending template storage exist, add
appropriate pre-migration template sentinels rather than artificial migrations.

For a faster behavior-only check after applying migrations to your own local backend, run:

```sh
npx --yes supabase@3.1.0 test db
```

The pgTAP tests use real database operations as anonymous and two authenticated
accounts; administrative access is used only for fixture setup and account deletion.
Each test file rolls back its fixtures. Tests do not send OTP emails or test #42's
onboarding UI. For an isolated stack elsewhere, supply `--workdir` and the absolute
test-file path; do not reset or redirect tests to a shared/hosted database.

## Create and test locally

At the pre-cutover checkout, start the local backend using its setup guide, then run from the
repository root:

```sh
npx --yes supabase@3.1.0 migration new describe_change
```

Edit the generated `supabase/migrations/<timestamp>_describe_change.sql`, then apply
it to your local database and check its history:

```sh
npx --yes supabase@3.1.0 db push --include-all
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

After pulling other contributors' migrations, run local `db push --include-all` to apply them,
or `db reset` if you want to discard local data and rebuild.

See the historical maintainer guide linked above for hosted target checks,
deployments, and capturing edits made in the hosted dashboard.
