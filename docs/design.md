# LibreLift - Design Document

|                  |                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authors**      | James Teuscher                                                                                                                                            |
| **Reviewers**    | [who reviewed it — a teammate, the instructor, a design-review partner]                                                                                   |
| **Status**       | In review                                                                                                                                                 |
| **Last updated** | 11-20-26                                                                                                                                                  |
| **Links**        | [proposal](../cp3/cp3-proposal) · [repository](https://github.com/LibreLift/expo_suite) · [issue tracker](https://github.com/LibreLift/expo_suite/issues) |

## Revision history

| Date     | Author         | What changed                   |
| -------- | -------------- | ------------------------------ |
| 10-16-26 | James Teuscher | First draft                    |
| 10-20-26 | James Teuscher | First full draft               |
| 10-21-26 | James Teuscher | Finished first copy            |
| 11-4-26  | James Teuscher | Revised to respond to feedback |
| 11-9-26  | Codex | Record frontend decisions and clarify shared terminology |
| 11-17-26 | Codex | Record the confirmed M1 database scope and account-name ownership |
| 11-20-26 | Codex | Document local onboarding, SQLite, and offline verification |

---

## 1. Context and scope

LibreLift is a native mobile app for planning, logging, and tracking workouts for those who want to use their phones to do so. It aims to provide the basic functions of creating reusable workout templates, using a template for a workout and logging reps and weight, and reviewing the details of past workouts. For more information about the context of this project, see the [proposal document](../cp3/cp3-proposal).

Use the [glossary](../GLOSSARY.md) for canonical domain terms. The
[architecture decision records](./adr/README.md) and
[UI foundation decision summary](./ui-foundation.md) explain the frontend choices
recorded during #38.

## 2. Goals and non-goals

**Goals**

- Bundle the free RepDB exercise catalog and its illustrations. Users can identify exercises by name, target muscles, and equipment.
- Support creation, persistence, editing, and deletion of reusable workout templates.
- Support starting, stopping, and completing workout sessions for an existing template. Workout sessions allow recording repetitions performed and weight used for each session exercise.
- Support storing "one-rep" maximum weight for certain exercises, and enter weight in template exercises as a percentage of that maximum.

**Non-goals**

- Social exercising features such as followers/friends, sharing workouts, leaving comments, etc., are excluded. They fall outside the scope of primary user needs.
- No body composition and fitness goal customization. 

## 3. System context

A user plans workouts in the app. The app reads its exercise catalog from the
bundled RepDB package and keeps training data in SQLite on the device.

## 4. Architecture and components

### On-device template storage (#141)

[ADR 0006](./adr/0006-store-training-data-on-device.md) records the approved move
to SQLite for [#136](https://github.com/open-source-fitness/open-fit/issues/136).
The Expo root layout supplies async workout, display name, and catalog services
to the existing MVVM frontend. Templates and the display name use the same private
`expo-sqlite` connection and versioned migrations. A missing display name routes
to onboarding. Saving it unlocks the tabs and opens Templates. Editing it in
Settings updates the greeting without remounting the workout and draft state.

A fresh database starts with an empty template list. The cutover begins with
local data and skips hosted records. Each template stores its ordered sets and
exercise snapshots; save receipts share the template transaction for retry
safety. Appearance uses the existing device preference store. Workout history
shows labeled sample data pending workout session persistence.

### Frontend and service boundaries

| Component | Responsibility |
| --- | --- |
| Expo Router | Mounts onboarding and the Templates, Workouts, and Settings screens. |
| Views | Render ViewModel state and collect input. |
| ViewModels | Manage loading, retry, navigation, and temporary template drafts through injected asynchronous services. |
| Services | Read the bundled catalog, manage the display name and templates through SQLite, and supply sample workout history. |

Templates have a saved overview listing exercise names and set counts. Each
placement opens saved exercise detail with its preserved image (or an unavailable
placeholder) and compact read-only set rows. Saved detail reads the template
snapshot without loading the catalog. The complete draft editor manages name,
optional description, catalog exercise placements, and independent fixed-weight
sets.
Editing uses a template overview for name/description, exercise count, membership,
and order, plus a separate screen for one placement’s sets and targets. Each set
is one row: Set number, reps input, ×, weight input, and pounds. Back/Done from
exercise editing returns to the overview without committing; both screens share
one draft, and Save/Cancel on the overview applies to all changes. The overview's
Sets button sits beside the exercise title and trash control. Saved targets and
editable targets use the same row layout; only the editor exposes numeric inputs
and set removal.
Creation, whole-template updates, and deletion use the injected asynchronous
`WorkoutService`. New templates append to the list. Successful mutations
invalidate list and detail reads and refresh counts.

The root owns the service and shared draft state, allowing catalog selection to
return to the same draft. Repeated catalog exercises have independent placement
identities and snapshots. The builder supports long-press dragging from an
edit-only three-line handle, scrolling while dragging, and accessible Move up/down
alternatives. All targets move with their placement. Existing history remains
independent of template edits/deletions.

Save validates and commits the whole draft atomically. Failed saves preserve it
for retry. Tabs preserve unfinished drafts; Back/swipe offers discard/keep editing.
Save/Cancel applies to the entire draft. Pending saves/deletes lock conflicting
actions and navigation. Delete requires confirmation naming the template and
returns to the list on success. See the [confirmed #91 specification](./issue-91-template-crud.md)
for target validation, lifecycle, and testing decisions.

Workout history has independently collapsible exercise sections. Settings
offers display-name editing and Light, Dark, and System appearance, defaulting
to System. An injected storage interface persists the appearance preference.
The app uses the [selected palette](https://colorhunt.co/palette/2c36393f4e4fa27b5cdcd7c9)
with additional neutral colors for readability. Sample weights use pounds.

See [setup](./setup.md) for compatibility and device review instructions.

### Exercise catalog boundary (#44)

RepDB JSON is validated at the service boundary into a shared catalog exercise
model with a namespaced catalog identifier, English name, separate primary and
secondary muscles, and explicit equipment requirements. Optional images,
instructions, and German/Spanish content are retained in the model.
Usable records are returned with diagnostics for malformed data; an unusable
response has a distinct failure result.

The standalone catalog screen opens from Templates. A separately injected
catalog service loads the JSON from the pinned RepDB package through the
existing mapper. The ViewModel exposes loading, usable results, and failure
states. A virtualized list shows exercises alphabetically with colloquial muscle
groups and equipment. Primary and secondary groups remain separate; raw muscles
remain unchanged in the model. Rejected records produce a quiet partial-results
notice; optional-content diagnostics alone do not. Each visit loads afresh,
retaining results while open, with Back available on failure.
The #84 implementation combines case-insensitive exercise-name search with one
primary muscle-group filter, defaulting to All muscles. Secondary targets never
cause filter matches. No-match results offer Clear search and filter without
reloading the catalog. Search/filter state survives tab changes while the route stays
open and resets on leaving and reopening. The catalog and README credit RepDB.
See [the agreed catalog behavior](./issue-53-exercise-catalog.md).

Tapping a catalog card opens an image-first detail screen using the selected
record from that visit. Start/peak images are swipeable, labeled pages with
Previous/Next controls; single illustrations use the same uncropped image area.
Images have independent loading/failure states. Group summaries, equipment, and
numbered English instructions follow the images. The mounted list retains its
scroll position and controls beneath detail without reloading the catalog.
The selected record is released when the catalog list unmounts. A detail route
without it offers Open catalog. See [the confirmed detail behavior](./catalog-exercise-detail.md).

Template exercises and session exercises each have their own placement identity
and copy descriptive exercise details and sets, retaining the shared catalog
identity. Bundled illustrations resolve from the image references in each
snapshot. Catalog updates do not replace the saved exercise details.
See the [catalog contract and tracking](./issue-44-exercise-catalog.md) and
[identity decision](./adr/issue-44-catalog-identity-and-snapshots.md).

### Create a workout template

1. On first launch, the user acknowledges the storage notice and saves their
   display name to open Templates.
2. The user starts a template draft, selects exercises from the bundled catalog,
   and enters a name and fixed weight and repetition targets.
3. Save validates the draft and commits the whole template in a SQLite
   transaction. The list refreshes and saved detail reads the stored snapshots.
   If a save fails, the draft stays open for retry.

### Record a workout session (planned)

The user starts a session from a saved template, records performance for
individual sets, and finishes or stops the session. Saved history retains its
own exercise snapshots, targets, and recorded performance when the template is
edited or deleted. See [ADR 0003](./adr/0003-preserve-independent-session-history.md).

## 5. Data model

| Data | Storage |
| --- | --- |
| Display name | `local_profile` stores a single display name for the installation. |
| Workout templates | `workout_templates` stores the template ID, creation time, list sequence, and JSON content. The content includes ordered exercise placements and sets, including catalog identity and descriptive snapshots. |
| Save receipts | `template_save_receipts` associates a save operation with its template and committed response. Receipts survive template deletion to guard against delayed save requests. |
| Exercise catalog | The pinned RepDB package supplies exercise records and illustrations. |
| Appearance | The device preference store persists the user's selection. |

The database applies migrations in order and tracks its version using SQLite's
`user_version`. Workout sessions, personal exercise maximums, and
percentage-based targets are planned. The [roadmap](./roadmap.md) tracks their
scope.

### Historical account-based storage

#### Authentication session lifecycle (#43)

The [historical design](https://github.com/open-source-fitness/open-fit/blob/63065abb17793d2b217d3b5d3161d1ae143da0ce/docs/design.md#authentication-session-lifecycle-43)
describes the email OTP and account session implementation.

#### M1 database scope and account data (#102)

The [historical design](https://github.com/open-source-fitness/open-fit/blob/63065abb17793d2b217d3b5d3161d1ae143da0ce/docs/design.md#m1-database-scope-and-account-data-102)
describes the Supabase Auth and application User boundary, schema, and row-level
security. The [#125 verification record](./issue-125-template-production.md)
covers the former hosted template persistence implementation.

## 6. Technology choices and alternatives considered

The app uses `expo-sqlite` for local transactions and schema upgrades. Local
display-name onboarding and a bundled catalog allow the app to work offline
from first launch. Backup and recovery are future work. See
[ADR 0006](./adr/0006-store-training-data-on-device.md) for the decision and
trade-offs.

The pinned RepDB package provides search and filter data, instructions, and
illustrations with attribution. See the
[offline catalog verification](./issue-138-offline-catalog.md) for bundle
measurements and the [setup guide](./setup.md#device-review) for the native audit.

## 7. Risks and open questions

| Risk or question | How to assess it |
| --- | --- |
| Data is tied to a single installation. | Audit cold restarts and in-place updates. Track backup and recovery on the roadmap. |
| The bundled illustrations increase application size. | Measure the installed release build and verify image rendering offline. |
| An interrupted write may affect workout session recovery. | Verify session recovery and save retries when session persistence is implemented. |

## 8. Implementation plan

| Milestone | What works when it's done                                                                                                                     | Depends on | Build hours (estimate) |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------- |
| 1         | The first core flow (template creation) works, without "one-rep" maximum support. Editing and deleting templates is also supported.           | —          | 12                     |
| 2         | Both core flows (template creation and workout sessions) work and  support "one-rep" maximum recording and calculations based off that value. | 1          | 8                      |


---

## Sign-off

| Reviewer | Role   | Date   | Approved |
| -------- | ------ | ------ | -------- |
| [name]   | [role] | [date] | ☐        |
