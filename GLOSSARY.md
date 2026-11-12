# LibreLift

LibreLift helps individuals plan reusable workouts, record their performance,
and review their workout history. These terms distinguish planned training from
what happened during a particular session.

## Language

### People and access

**User**:
A person who plans and records their training in LibreLift and owns their workout
templates and workout sessions.

**Account**:
The identity through which a user signs in and accesses their saved training data.
_Avoid_: User when referring specifically to sign-in identity

### Planning

**Exercise**:
A movement, such as a bench press or squat, described by its name, target muscles,
and equipment.

**Exercise catalog**:
The collection of exercises available for inclusion in workout templates.
_Avoid_: Workout catalog, template library

**Catalog exercise**:
A named movement in the exercise catalog, with an identity shared by every template
or session that references it.
_Avoid_: Template exercise, session exercise

**Primary muscles**:
The muscles identified by the catalog as the main targets of an exercise. Missing
targets remain unspecified rather than being inferred.
_Avoid_: All target muscles

**Secondary muscles**:
The muscles identified by the catalog as supporting targets of an exercise,
distinct from its primary muscles. Missing targets remain unspecified rather than
being inferred.
_Avoid_: Primary muscles

**Muscle group**:
A broader category of muscles described by a familiar training label, such as
Chest, Upper back, Lower back, or Calves.
_Avoid_: Primary muscle when referring to the broader category

**No equipment**:
An exercise's explicit lack of required equipment, identified from the catalog's
bodyweight designation when equipment is absent. Missing equipment without that
designation is not evidence that no equipment is required.
_Avoid_: Unknown equipment

**Workout template**:
A reusable workout description containing exercises and their planned sets.
“Template” is its short name.
_Avoid_: Plan, routine (as separate domain concepts)

**Template draft**:
Unsaved changes to a workout template. These changes are separate from the saved
template until the user saves them.

**Template exercise**:
A placement of a catalog exercise within a workout template, with its own identity,
saved exercise details, and planned sets. The same catalog exercise can appear in
multiple placements; catalog changes do not change saved templates.
_Avoid_: Exercise when referring specifically to its inclusion in a template

**Template set**:
A planned set for a template exercise, with a target weight and target repetition
count.
_Avoid_: Round

### Performing and reviewing

**Workout session**:
One occurrence of performing a workout based on a workout template. “Session” is
its short name.
_Avoid_: Workout when the distinction from a workout template matters

**Session exercise**:
A placement of a catalog exercise within a workout session, with its own identity,
saved exercise details, and session sets. Its catalog identity is retained, and
catalog changes do not change saved workout history.
_Avoid_: Template exercise when referring to a session's exercise

**Session set**:
A set belonging to a session exercise, with planned targets and the performance
recorded for that session.
_Avoid_: Round, template set when referring to a session's set

**Workout history**:
The collection of saved past workout sessions available for review.
_Avoid_: Workout log, log (as names for a separate domain concept)

### Sets and performance

**Repetition**:
One performance of an exercise's movement. “Rep” is its short name.

**Set**:
A group of repetitions of one exercise; it belongs to that exercise rather than
grouping several exercises together.
_Avoid_: Round, circuit

**Target performance**:
The planned weight and repetition count for a set.
_Avoid_: Goal when referring specifically to a set's targets

**Fixed-weight target**:
A target weight expressed directly as an amount of weight.

**Personal exercise maximum**:
The weight a user records as their maximum for one repetition of a particular
exercise. It is the reference weight for percentage-based targets.

**Percentage-based target**:
A target weight expressed as a percentage of the user's personal maximum for that
exercise.

**Recorded performance**:
The weight and repetition count recorded for a session set, which may differ from
its target performance. “Actual” is a synonym for these recorded values.
