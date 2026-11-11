# Exercise catalog model and RepDB mapping

Design decisions agreed during the issue #44 interview and confirmed by the maintainer. Implementation is pending.

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
