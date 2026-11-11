# LibreLift

LibreLift provides exercise selection, reusable workout planning, and workout history.

## Language

**Catalog exercise**:
A named movement in the exercise catalog, with an identity shared by every template or session that references it.
_Avoid_: Template exercise, session exercise

**No equipment**:
An exercise's explicit lack of required equipment, identified from the catalog's bodyweight designation when equipment is absent. Missing equipment without that designation is not evidence that no equipment is required.
_Avoid_: Unknown equipment

**Template exercise**:
A placement of a catalog exercise within a workout template, with its own identity, saved exercise details, and planned sets. The same catalog exercise can appear in multiple placements; changes to the external catalog do not change saved templates.
_Avoid_: Catalog exercise

**Primary muscles**:
The muscles identified by the catalog as the main targets of an exercise. Missing targets remain unspecified rather than being inferred.
_Avoid_: All target muscles

**Secondary muscles**:
The muscles identified by the catalog as supporting targets of an exercise, distinct from its primary muscles. Missing targets remain unspecified rather than being inferred.
_Avoid_: Primary muscles

**Session exercise**:
A placement of a catalog exercise within a workout session, with its own identity, saved exercise details, and recorded sets. Its catalog identity is retained, and changes to the external catalog do not change saved workout history.
_Avoid_: Catalog exercise
