# Domain documentation

LibreLift has one domain context, with a root glossary and shared ADR directory.

Before exploring domain code, designing a change, or naming concepts in issues,
tests, and documentation:

1. Read [GLOSSARY.md](../../GLOSSARY.md) and use its canonical terms.
2. Read the relevant records in [docs/adr/](../adr/README.md).
3. For the initial UI, read the [foundation decisions](../ui-foundation.md).

Keep the glossary limited to domain meanings. Record implementation choices in
the design documentation or an ADR when the decision has a consequential trade-off.
Surface contradictions with an existing term or ADR before changing its meaning.
Use the domain-modeling flow to resolve gaps and update documentation as decisions
are agreed. If a referenced domain document is absent, continue; create it when
there is a resolved term or decision to record.
