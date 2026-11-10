# Share hosted development while keeping schema changes reproducible

Contributors normally run the app against the existing LibreLift hosted development
project, with an optional local Docker backend for isolated backend work. App access
uses a public key and feature-defined data permissions; hosted administration and
manual deployments remain restricted to maintainers.

Committed migrations define the database schema. Dashboard edits remain available,
but lasting schema changes must be captured in migrations and verified through a
local rebuild before being shared. This preserves dashboard flexibility while
allowing contributors to reproduce the backend without hosted administrative access.
Automated deployments are deferred to later M1 or M2.
