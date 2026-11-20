# Offline exercise catalog verification

The catalog uses the schema v3 JSON in `@repdb/exercises@2026.11.1`. The
existing mapper accepted all 708 records without diagnostics. The package
contains 523 start/peak pairs and 185 single illustrations. The catalog screen
links to RepDB for attribution.

`npm ci` generates a Metro index with a static import reference for every
packaged flat WebP. On display, the gallery resolves matching RepDB image paths
to native assets. Snapshots retain the existing string references, names,
instructions, and targets. An earlier snapshot with the same RepDB path also
uses the bundled image. Other legacy URLs remain usable when reachable, and
their saved details remain readable if the image fails.

## Bundle evidence

iOS and Android passed `expo export` and the production-mode
`expo export:embed` step used by native builds. The embedded asset output for
each platform contained 1,231 WebP files whose SHA-256 hashes matched the
package. Together the images add 20,278,684 bytes (19.34 MiB) per platform before
packaging. The regular export stores 1,203 unique WebP payloads
(19,804,900 bytes) because 28 files share identical contents.

Compared with integration base `0e508fb`, the regular export's Hermes bytecode
increased by 3,144,897 bytes on iOS and 3,145,098 bytes on Android. These
measurements cover exported artifacts. The signed app download and installed
size were unmeasured.

## Device acceptance

Router tests exercise offline search, filtering, instructions, navigation,
both packaged poses, and saved template detail. No supported physical device
was connected, so native decoding and installed-app behavior in airplane mode
remain unverified. For this slice, enter the authenticated catalog before
going offline. From an installed build in airplane mode, search and filter,
open a single illustration and both poses of a paired exercise, read the
instructions, and return to the filtered list. The full fresh-install and saved
template airplane-mode check requires the local onboarding and SQLite cutover
in [#136](https://github.com/open-source-fitness/open-fit/issues/136).
