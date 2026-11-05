# Project Management

The [LibreLift MVP project board](https://github.com/orgs/LibreLift/projects/1)
tracks planned work, priorities, and progress. Use the Plan view to see task sizes
and milestone groupings, and the Backlog view to follow workflow states. Check
the view's filters if an expected issue is not visible.

## Requests and triage

Use the repository's issue templates to report a problem, suggest a feature, or
request a documentation change. Feature and bug templates apply `needs triage`;
a request is not a commitment to implement it.

Maintainers review requests for scope, clarity, duplicates, and dependencies.
They ask for missing context, explain decisions on the issue, and either close
the request with a reason, defer it, or turn accepted work into actionable tasks.
Only maintainers apply `planned work`, so contributors can distinguish agreed
work from requests still under discussion. When a broad request is replaced by
smaller tasks, link the replacements and explain that closing the request does
not mean its implementation is complete.

## Planned work, epics, and milestones

Use the Task template for agreed work. Each task should describe its goal,
context and related design links, checkable acceptance criteria, dependencies,
and where to start. Size tasks with the board's Task Size field: XS is up to
one hour, S is two hours, M is four hours, L is seven hours, and XL is more than
seven hours. Split work that contains independently useful, reviewable changes.

Group feature tasks under a parent issue labeled `epic`, using GitHub
sub-issues. Epics describe user-visible outcomes; shared setup tasks can remain
standalone when several epics depend on them. Link dependencies so contributors
can see what must be finished first.

Assign planned work to the milestone it supports:

- **M1: Runnable Demo — November 18, 2026:** account access, exercise selection,
  and creating, saving, reopening, editing, and deleting fixed-weight templates.
- **M2: MVP — December 2, 2026:** workout logging and history, personal exercise
  maximums, percentage-based targets, and deferred catalog caching/retry work.

The M1 milestone description records capacity, estimates, and scope cuts.
Maintainers keep milestone assignments and board priorities aligned with that
budget. See the [roadmap](./roadmap.md) for work beyond the MVP.

## Workflow states

| State | Meaning |
| --- | --- |
| Backlog | Work is recorded but is not ready to start. |
| Ready | Scope and acceptance criteria are clear and prerequisites are available. |
| In progress | An assigned contributor is actively working on the issue. |
| In review | The implementation PR is ready for independent review. |
| Done | The change has met the [definition of done](./git-standards.md#definition-of-done). |

Keep issue and board status current as work moves. A blocked task should not be
treated as ready until its prerequisites are resolved. Closed requests that were
superseded or declined should be distinguished from completed implementation in
their closing explanation.

## Labels and choosing work

| Label | How to use it |
| --- | --- |
| `needs triage` | A request awaits a maintainer's decision. |
| `planned work` | Maintainer-approved work available for planning and assignment. |
| `epic` | A parent issue grouping work by the value it delivers. |
| `good first issue` | A task intended to help newcomers get started; check dependencies and Ready status before choosing it. |
| `enhancement` | A feature suggestion or improvement; check triage status before implementing it. |
| `documentation` | A documentation addition or correction. |
| `help wanted` | Community assistance is requested. |
| `question` | A reader needs clarification from the issue author or assignee. |
| `awaiting response` | The issue author or assignee needs a reply from someone else. |

Start with an unassigned Ready task, preferably a `good first issue` for your
first contribution. Read its acceptance criteria and dependencies, then request
assignment through GitHub Discussions as described in the
[communication standards](./communication-standards.md). Ask about blocked
work before starting it to avoid duplicating effort.
