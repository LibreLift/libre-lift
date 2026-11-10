# Database migrations

A migration is a SQL file describing a database structure change, such as adding
a table. Contributors can create and test migrations locally; only maintainers
apply them to the shared hosted project. Committed migrations define the schema.
There is no initial SQL migration because this infrastructure task adds no feature
schema or seed data.

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
