# Separate exercise placements from catalog identity and preserve saved details

Template and session exercise placements have their own identifiers while retaining the same catalog identifier for the movement they reference. Saved templates and sessions preserve exercise details rather than resolving them from the current external catalog, so repeated placements remain distinct and upstream renames or removals cannot alter saved workouts. This accepts duplicated descriptive data in exchange for stable saved plans and history.

Catalog identifiers include a provider namespace, such as `repdb:bench-press`, to prevent accidental identity collisions if another catalog is introduced. Equivalent movements from different providers require an explicit mapping; matching names or provider-local identifiers do not establish equivalence.
