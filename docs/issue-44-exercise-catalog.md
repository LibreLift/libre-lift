# Exercise catalog model and RepDB mapping

Design decisions agreed during the issue #44 interview and confirmed by the maintainer. Implemented on the issue branch; independent review and merge remain part of the repository's completion process.

## Tracking

- Source task: [#44](https://github.com/LibreLift/libre-lift/issues/44).
- Specification: [#74](https://github.com/LibreLift/libre-lift/issues/74).
- Core mapping and snapshots: [#75](https://github.com/LibreLift/libre-lift/issues/75).
- Catalog recovery: [#76](https://github.com/LibreLift/libre-lift/issues/76), blocked by #75.
- Images and localization: [#77](https://github.com/LibreLift/libre-lift/issues/77), blocked by #75.

## Agreed behavior

- Deliver exercise types, RepDB validation and mapping, and minimal adaptation of existing template/session consumers. Live fetching, caching, and catalog UI belong to a separate issue.
- Separate placement identity from namespaced catalog identity and retain saved exercise details; see [the identity ADR](./adr/issue-44-catalog-identity-and-snapshots.md).
- Preserve primary and secondary muscles separately. Omitted lists become empty arrays; malformed lists or entries reject the record. Never infer muscle targets.
- Map absent equipment to an explicit no-equipment value only when `is_bodyweight` is true. Reject absent equipment without that confirmation.
- Return valid exercises together with structured diagnostics about rejected records rather than failing the whole catalog for one invalid record.
- Reject all records sharing a catalog identifier, with diagnostics; do not select one based on input order.
- Use English as the default and require a nonblank English name. Preserve optional German and Spanish names and instructions, with English as the fallback when a translation is unavailable. Define images, instructions, and localization types here even though their UI use is deferred.
- Missing or malformed images, instructions, or optional translations do not invalidate otherwise valid core exercise data. Omit unusable extra fields and report malformed values through diagnostics.
- Support single main images and start/peak pairs, resolving relative image paths against the dataset directory. Prefer a complete start/peak pair if both forms are available, falling back to a valid main image. Preserve both forms when valid.
- Distinguish an unusable response from partial success. An invalid envelope, unsupported schema version, or zero usable exercises produces an explicit failure; rejected records and unusable optional fields remain diagnosable. A declared count mismatch is a diagnostic rather than a reason to discard usable records.

## Public contracts

`mapRepDbResponse` accepts untrusted decoded JSON and supports RepDB schema version 3. It returns `success` for a usable catalog without diagnostics, `partial` for usable exercises with diagnostics, or `failure` with an explicit `invalid_response`, `unsupported_schema`, or `no_usable_exercises` error and an empty exercise list. It performs no network requests.

Diagnostics carry a source field and machine-readable reason, plus a zero-based record index and namespaced catalog identifier when available. Invalid or missing count metadata is diagnostic; count mismatches compare against supplied records before filtering. Descriptive envelope metadata is not required for exercise mapping.

Catalog exercise names and top-level instructions are English. Optional German and Spanish content retains valid supplied fields and uses English for unavailable fields. If a locale is entirely unavailable, consumers use the top-level English content. Missing optional content is accepted without diagnostics; malformed supplied content is diagnosed. No localization UI is introduced.

Images retain a valid main URL and/or complete start/peak pair and declare the preferred form. Incomplete pairs are diagnosed and omitted; a valid main image remains available as fallback. Only HTTP(S) image URLs are returned. Keeping saved URLs cannot guarantee that upstream assets remain available.

`createTemplateExercise` and `createSessionExercise` require caller-supplied placement IDs and sets, preserving catalog identity and copying nested exercise details and set values. Session actual values must be supplied explicitly; they are not inferred from targets. Existing sample services use these constructors, and detail screens present primary muscles, secondary muscles, and equipment separately.

## Verification scope

- Representative mapping of identifiers, English names, primary/secondary muscles, equipment, localized instructions, and both image forms.
- Malformed required values, omitted versus malformed muscle lists, and the confirmed bodyweight rule for absent equipment.
- Partial success, duplicate identities, optional-field diagnostics, and unusable responses.
- Repeated placements of the same catalog exercise and saved details remaining independent of catalog changes.
- Existing consumer behavior and TypeScript compatibility after adapting sample templates and sessions.

## Observed upstream data

The inspected schema-version-3 snapshot contains 701 exercises. Of these, 516 use a start/peak image pair and 185 use a single main image; none supplies both forms. All have English, German, and Spanish names and instructions. These observations inform representative cases, not guarantees that optional data is always present.

The dataset directory is `https://exercise-dataset.com/`; its `homepage` metadata points to a different site and must not be used as the base for relative image paths.

## Upstream references

- [RepDB schema](https://github.com/RepDB/exercise-dataset#schema)
- [RepDB JSON](https://raw.githubusercontent.com/RepDB/exercise-dataset/main/exercises.json)
