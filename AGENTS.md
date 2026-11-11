# Agent guidance

- **Contributions:** Before changing repository files, read [CONTRIBUTING.md](CONTRIBUTING.md) and [git standards](docs/git-standards.md) for contribution scope, branch and commit conventions, review, and the definition of done.
- **Design:** Before implementing app behavior or changing architecture or the data model, read [the design document](docs/design.md).
- **Scope:** Before planning features or choosing milestone scope, read [the roadmap](docs/roadmap.md).
- **Setup:** Before installing dependencies, running the app, or choosing validation commands, read [the setup guide](docs/setup.md). Confirm commands against checked-in configuration; the documentation includes tooling planned for future development.
- **Issues:** Before selecting work or changing issues, milestones, or board status, read [project management](docs/project-mgmt.md). Use the matching [issue template](.github/ISSUE_TEMPLATE) when creating an issue.
- **Communication:** Before requesting assignment, requesting review, or discussing project-wide decisions, read [communication standards](docs/communication-standards.md).
- **Pull requests:** When preparing a PR, use [the PR template](.github/pull_request_template.md).

## General coding principles

- **Simplicity (KISS):** Choose the simplest design that satisfies the requirements. Prefer straightforward control flow and familiar patterns; each additional layer should solve a concrete problem.
- **Limited complexity (YAGNI):** Implement current requirements. Add extension points, configuration options, and general-purpose abstractions when a concrete use case needs them.
- **Readability:** Use descriptive names and explicit control flow. Keep functions focused on a coherent task, and use comments to explain intent, constraints, or tradeoffs that the code cannot convey.
- **Modularity:** Keep related behavior and the data it operates on together (high cohesion). Expose small interfaces that hide implementation details and minimize dependencies between modules (low coupling).
- **Dependency injection:** Pass external dependencies, such as storage, network clients, and clocks, into the code that uses them so tests can substitute controlled implementations. Prefer function parameters or constructor arguments; introduce a DI framework only when its complexity is justified by current needs.
- **Deduplication (DRY):** Give each business rule or shared piece of knowledge one authoritative implementation. Extract shared logic when callers represent the same concept and should change together; keep coincidentally similar code independent.

## Agent skills

### Issue tracker

Use GitHub Issues and the LibreLift MVP project board. Before tracker operations,
read [issue tracker guidance](docs/agents/issue-tracker.md).

### Triage labels

Before triage or readiness changes, read the
[existing label and board mapping](docs/agents/triage-labels.md).

### Domain docs

This is a single-context project. Before domain exploration or design, read the
[domain documentation guidance](docs/agents/domain.md).
