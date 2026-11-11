# Preserve session history independently of templates

The [roadmap](../roadmap.md#mvp) requires template edits and reuse to leave earlier
workout sessions unchanged. Session exercises, target performance, and recorded
performance therefore belong to the session independently of the editable
template, accepting duplicated values instead of reconstructing history from the
current template. The current sample records demonstrate this separation; session
creation and backend persistence remain future feature work.
