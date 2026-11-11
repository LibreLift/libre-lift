# UI foundation decisions

This is a retrospective record of the discussion for
[#38](https://github.com/LibreLift/libre-lift/issues/38), captured on November 9,
2026. It records the agreed foundation and the terminology clarification that
followed implementation; it does not expand the feature scope.

## Shared language

[GLOSSARY.md](../GLOSSARY.md) defines the product vocabulary. Use **workout
template** for a reusable description, **workout session** for one occurrence, and
**workout history** for saved past sessions. “Plan,” “workout,” and “log” may appear
as informal UI wording; they do not introduce additional domain concepts.

A **set** belongs to one exercise. For a template with three bench-press sets and
two row sets, there are five sets across two exercises, not three circuit rounds.
Circuits and rounds are not part of the current MVP model. This clarification
resolves the earlier design prose's use of “round.”

**Target performance** describes planned values; **recorded performance** describes
session values, also called “actual.” For example, a session set can have a target
of eight repetitions and a recorded result of six without changing its target.

## Confirmed foundation

| Area | Agreed behavior |
| --- | --- |
| Architecture | Views render ViewModel state; ViewModels consume injected asynchronous services. Sample data follows the same boundary intended for real data. See [ADR 0002](./adr/0002-use-mvvm-with-injected-services.md). |
| Stub depth | Clickable sample lists and read-only details make navigation reviewable. Authentication forms, template editing, and workout logging belong to later feature tasks. |
| Navigation | Three bottom tabs: Templates, Workouts, and Account. Templates opens first. Account access does not gate this preview. |
| Templates | A sample template opens a detail screen showing its exercises and target sets. |
| Workouts | The Workouts tab shows sample workout history; a session opens a detail screen showing target and recorded values. |
| Account | Account links to Settings and a clearly labeled sign-in placeholder. |
| Appearance | Settings offers Light, Dark, and System. System is the default and follows the phone's appearance. |
| Preference persistence | The appearance preference is saved on the device and restored across app restarts. Storage failures leave a retry path. |
| Training data | Sample templates and history remain fixed fixtures. Persisted user training data is a later integration requirement. |
| Units | Sample weights use pounds (`lb`). Unit conversion and a units preference are deferred. |
| Palette | Both themes use `#2C3639`, `#3F4E4F`, `#A27B5C`, and `#DCD7C9`, with supporting neutral colors for readability. |
| Data states | The frontend represents loading, error/retry, empty lists, and missing detail records. |
| History integrity | Session values remain independent of later template edits. See [ADR 0003](./adr/0003-preserve-independent-session-history.md). |
| Device review | A physical iPhone running Expo Go is the first review target; Android remains supported. |
| SDK | SDK 58 matches the Expo Go version reported on the review device. This superseded the initial SDK 54 selection; the current version is recorded in `package.json`. |

## Approved UI iteration

The maintainer approved the following refinement of the original foundation on
November 9, 2026. The #62–#64 behavior below is implemented on the local foundation
branch. Physical-device review and the published foundation remain prerequisites
for completing the tracker workflow. The #65 investigation is deferred.

- [#62: Template presentation](https://github.com/LibreLift/libre-lift/issues/62)
  changes the list heading to “Templates,” shows exercise and total-set counts,
  and removes the template list/detail preview footers. Exercise counts already
  exist; the added total counts all sets across the template's exercises.
- [#63: Title/description editor](https://github.com/LibreLift/libre-lift/issues/63)
  uses inline editing at the top of template detail, keeping exercises visible,
  with explicit Save/Cancel. It saves metadata for the running app session through
  the service/ViewModel boundary. This revises the original read-only stub scope;
  it does not add cross-restart persistence or complete the full editor in #46.
  Tab changes preserve an unsaved draft while not saving. Back/swipe with unsaved
  changes prompts Discard changes / Keep editing; explicit Cancel discards the
  draft and returns to read-only detail. While Save is pending, show Saving… and
  disable fields, Save, Cancel, Back/swipe, and tab switching until the request
  succeeds or fails. Success returns to read-only detail; failure retains the
  draft for retry and restores editing and navigation controls.
- [#64: Collapsible session sets](https://github.com/LibreLift/libre-lift/issues/64)
  makes each session-detail exercise independently expandable and initially
  collapsed, with its name and set count visible. Target and recorded performance
  remain unchanged, and expanding one exercise does not close another. Switching
  tabs preserves expansion state on the still-open detail screen; leaving detail
  and opening a session again starts collapsed.
- [#65: Duration-estimate investigation](https://github.com/LibreLift/libre-lift/issues/65)
  is deferred to M2: MVP. It will compare approaches and missing timing inputs
  before a display or formula is selected; duration meaning and acceptable inputs
  remain undecided for that milestone. The current UI iteration adds no estimates.

The metadata and history refinements are sub-issues of #46 and #48 respectively;
the template presentation refinement is also under #46. All four tasks depend on
#38 for a published app foundation. The accepted scope does not imply readiness
from the default branch while that dependency remains unresolved.

## Scope and remaining questions

The sample-data preview does not remove authentication or training-data
persistence requirements from the [roadmap](./roadmap.md). Likewise, the domain
glossary describes product concepts; it does not finalize a database schema or
require each concept to have a separate frontend type.

The following were not settled by this discussion and remain for their feature
tasks:

- The active, stopped, and completed session lifecycle, including whether a
  stopped session appears in workout history.
- Exercise catalog and exercise-occurrence identities in the persisted model.
- Long-term weight-unit preferences and conversion behavior.
- Session recovery and synchronization after a save failure.

See [setup](./setup.md) for launch, validation, and physical-device review steps.
Palette values, dependency versions, and navigation labels are kept here and in
their existing configuration rather than being promoted to architectural rules.
