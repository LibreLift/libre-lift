# Triage roles: existing labels and board status

The skills' canonical roles map to combinations of existing labels, project
Status, issue state, and the implementation brief. This adapter replaces the
skills' default one-label-per-role convention; it creates no new labels or fields.

## Categories

- `bug`: a failure in existing behavior.
- `enhancement`: an improvement or new behavior.
- `documentation` and `accessibility` describe relevant subject matter; they do
  not substitute for a bug/enhancement classification during triage.

The bug-report template currently defaults to `documentation, needs triage`.
For an app bug, apply `bug` and retain `documentation` only if the report also
concerns documentation.

## State roles

| Canonical role | Existing labels | Project Status / issue state | Brief field |
| --- | --- | --- | --- |
| `needs-triage` | `needs triage` | Backlog; open | Maintainer evaluation pending |
| `needs-info` | `question` | Backlog; open | Identify the missing reporter information |
| `ready-for-agent` | `planned work` | Ready; open; prerequisites satisfied | `Implementation: agent` |
| `ready-for-human` | `planned work` | Ready; open; prerequisites satisfied | `Implementation: human`, with the reason |
| `wontfix` | `non-goal` for a scope rejection | Closed as `not planned` | Record why the request is declined |

`planned work` alone means accepted scope, not readiness or permission to start.
Agent-ready and human-ready work share existing labels and Status; distinguish
them in the brief rather than inferring an executor from `help wanted` or an assignee.
If the brief does not name an executor, resolve that before treating it as either
ready role. Remove the previous triage-state label when moving to a different role.

Use the existing execution statuses after work begins: In progress, In review,
and Done. Done follows the repository's definition of done; it is not a synonym
for any closed issue. Keep rejected requests out of Done; archive their Backlog
board items when removal from active views is authorized.

## Waiting and closure distinctions

- The live `question` description requests information from the issue author;
  use it for `needs-info`.
- The live `awaiting response` description means the issue author is waiting for
  a maintainer reply. Preserve it for that direction of communication; it is not
  an alias for `needs-info`.
- A duplicate uses `duplicate` and links the original issue. An already-delivered
  request points to the implementation. Neither automatically becomes `non-goal`.
- Deferred work stays in Backlog with its disposition explained; deferral alone
  is not a rejection.
- Preserve unrelated labels such as `epic` and `good first issue`.

If labels, the implementation brief, and board Status conflict, report the conflict
and ask the maintainer to resolve it before advancing the issue. Existing label
descriptions and the board's field names were checked on November 9, 2026.
