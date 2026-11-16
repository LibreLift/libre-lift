# Live exercise catalog (#53)

Decisions agreed during the issue #53 design interview. The maintainer confirmed
shared understanding on November 12, 2026, and subsequently authorized
implementation of the published specification and tickets.

Source task: [#53](https://github.com/LibreLift/libre-lift/issues/53).
Template editor integration: [#46](https://github.com/LibreLift/libre-lift/issues/46).
Existing model and mapping: [catalog contract](./issue-44-exercise-catalog.md).

## Published tracking

- Specification: [#82](https://github.com/LibreLift/libre-lift/issues/82).
- Live loading and browsing: [#83](https://github.com/LibreLift/libre-lift/issues/83).
- Combined search and group filtering: [#84](https://github.com/LibreLift/libre-lift/issues/84), blocked by #83.

The network-to-screen testing seam is approved. The service module calling
RepDB accepts an injected HTTP request function, supplied through its construction
API. Production supplies the real transport; tests supply controlled responses
without global fetch patching, module mocks, or changes to consumers.

## Agreed scope

- Build a temporary standalone catalog screen. It will be removed later when
  the template editor supplies the catalog selection surface. Adding, swapping,
  and saving template exercises remain with #46.
- Provide alphabetical browsing, case-insensitive exercise-name search, and a
  muscle filter. Match primary muscles only; secondary-muscle filtering and
  equipment filtering are deferred. Select one muscle at a time, with all
  muscles as the default. Search and filtering apply together.
- Present broader, colloquial muscle groups in the filter rather than individual
  anatomical muscle names. Use group labels in exercise details too, deduplicated
  within each primary/secondary list. Identifying or displaying individual
  muscles within groups is deferred. Preserve original muscle values in the
  model. Group matches continue to use primary muscles only.
- Show exercise names, primary muscle groups, secondary muscle groups, and equipment.
  The first iteration deferred images and instructions. The subsequent confirmed
  [detail screen](./catalog-exercise-detail.md) presents them when a card is tapped.
- Display usable exercises when mapping produces partial success. When records
  were rejected, show a quiet “Some exercises couldn’t be loaded” notice.
  Diagnostics about optional content do not produce a notice on this screen.
- Show “Primary muscles: Not specified” when primary muscles are absent. Omit
  an absent secondary-muscle line. Use “No equipment” only for the explicit
  no-equipment designation from the mapper.
- Open the temporary screen through an “Exercise catalog” button on Templates.
  Fetch on every visit. Retain results and search/filter state while the screen
  stays open; leaving and reopening starts fresh. On failure, display a clear
  message and allow Back. Explicit Retry controls, automatic retries, and
  caching are deferred.
- Include an “Exercise data by RepDB” link on the catalog screen and attribution
  in the README so credit survives removal of the temporary screen.

## Approved primary-muscle grouping

An exercise matches every group represented among its primary muscles, not just
the group of its first primary muscle. These are presentation categories; they
do not replace the provider's anatomical values or imply new muscle targets.

| Group label | RepDB muscles |
| --- | --- |
| Chest | pectoralis_major |
| Upper back | latissimus_dorsi, rhomboids, trapezius, infraspinatus_teres_minor |
| Lower back | erector_spinae, quadratus_lumborum |
| Shoulders | anterior_deltoid, lateral_deltoid, posterior_deltoid |
| Biceps | biceps_brachii, brachialis |
| Triceps | triceps_brachii |
| Forearms | brachioradialis, forearm_extensors, forearm_flexors |
| Abs | rectus_abdominis, transverse_abdominis, obliques |
| Glutes | gluteus_maximus, gluteus_medius |
| Quads | quadriceps |
| Hamstrings | hamstrings |
| Inner thighs | adductors |
| Outer hips | abductors |
| Hip flexors | hip_flexors |
| Calves | gastrocnemius, soleus |
| Shins | tibialis_anterior |

The secondary summary uses the same map, with these additional assignments:

| Group label | Secondary-only RepDB muscles |
| --- | --- |
| Forearms | forearms |
| Chest | serratus_anterior |
| Shoulders | supraspinatus |

## Existing task requirements

- Fetch the provider's catalog through the injected service boundary and reuse
  the #44 mapper and stable catalog identifiers. The current provider distributes
  one JSON document at `https://exercise-dataset.com/exercises.json`; no
  pagination is currently documented.
- Represent loading, usable results, and failure explicitly. Network failures,
  unsuccessful HTTP responses, malformed JSON, and mapper failures must produce
  defined results the UI can handle without receiving invalid exercise data.
- Verify the request-to-screen success path, combined name search and primary
  group filtering, partial results, and representative transport/mapping failures.
  Controlled HTTP responses exercise the actual service, mapper, ViewModel,
  screen, and router rather than replacing internal collaborators.

## Confirmation

All interview questions have been answered and shared understanding is confirmed.
Routine presentation details, including filter-option ordering and empty-search wording,
can follow the existing UI conventions without changing these decisions.

The glossary defines catalog exercises, primary and secondary muscles, no
equipment, and the newly agreed muscle group term. No architectural decision
record is needed for these reversible presentation choices.

## Implementation verification

The initial implementation covers both #83 and #84. TypeScript checking and all 54 tests
across 10 suites pass, including 17 catalog route tests with controlled HTTP
responses. iOS and Android bundle exports pass. Independent Standards and Spec
reviews reported no actionable findings.

Expo Doctor passes 19 of 20 checks; the remaining check reports patch-version
mismatches in unchanged Expo dependencies. No simulator devices are available
on this host. On November 13, 2026, the maintainer reported satisfactory output
on an Android tablet and iPhone and approved wrapping up the task. Independent
PR review, merge, and the production audit remain part of the repository's
definition of done.
