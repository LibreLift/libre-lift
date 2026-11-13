# Catalog exercise detail

The maintainer confirmed this follow-up to the temporary #53 catalog after
reviewing its first iteration. This extends the initial catalog's deferred
image/instruction presentation; it does not add template exercise selection.

## Agreed behavior

- Tapping an exercise card opens a detail screen. Show the exercise name first,
  then a large image area that preserves image proportions without cropping.
- A preferred start/peak pair appears as full-width swipeable pages labeled
  Start and Peak with visible position information. Previous/Next controls
  provide an accessible alternative to swiping. A main-only image uses the same
  large presentation without pair controls.
- Below the images, show primary muscle groups, secondary muscle groups,
  equipment, and numbered English instructions, in that order. Retain the
  existing missing-muscle/equipment rules. Omit missing instructions.
- Each image has its own loading indicator and unavailable placeholder. Missing
  imagery also shows a placeholder. One failed pose does not prevent viewing
  the other or reading the exercise information.
- Detail uses the record already loaded by the catalog, without another JSON
  request. Back restores the same list position, search text, and group filter.
  Leaving the catalog entirely and reopening still starts a fresh visit.
- Without the selected record from an open catalog visit, show “Open the catalog
  to view this exercise” and an Open catalog action. That action starts a normal
  catalog visit rather than independently loading the detail record.
- Fullscreen viewing, pinch-to-zoom, individual muscle display, localization UI,
  standalone detail loading, and deep-link support remain deferred.

## Implementation boundary

The existing catalog service and mapper retain their injected HTTP boundary.
The list remains mounted beneath the detail route, keeping its native scroll
position and ViewModel state. The provider shares only the selected catalog
summary with detail and clears it when the list unmounts; it does not retain a
catalog cache across visits. Native image components load the already validated
HTTP(S) URLs and report load/error state independently of catalog loading.

Tests use the existing approved route boundary: controlled HTTP responses pass
through the actual catalog service, mapper, ViewModel, and screens. Native image
load/error and swipe events exercise the gallery through its rendered controls.
The maintainer subsequently reviewed the output on an Android tablet and iPhone
and reported both satisfactory on November 13, 2026.

## Verification

All 62 tests across 11 suites pass, including seven new detail route tests.
TypeScript checking and iOS/Android bundle exports pass. The Standards review's
duplicated summary-rule finding was resolved with a shared presentation component;
there are no remaining Standards or Spec findings.

At implementation time, Expo Doctor reported Expo dependency patch-version
mismatches (19 of 20 checks passed). The automated checks used the committed
dependencies. The maintainer's subsequent Android tablet and iPhone review was
satisfactory; this records their device review without implying that each failure
scenario or the post-merge production audit was separately exercised.
