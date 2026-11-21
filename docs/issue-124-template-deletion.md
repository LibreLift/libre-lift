# Persisted template deletion (#124)

> Historical delivery notes for this slice. See the
> [#125 validation record](issue-125-template-production.md) for the pre-cutover
> composition and [historical backend notes](maintainers.md) for its setup.

The injected persistence service now supports the existing confirmation/detail
workflow through the authenticated template endpoint. A confirmed deletion removes
only the requesting user's template aggregate. A valid missing or inaccessible
identity succeeds without revealing whether another user owns it; malformed
identities remain validation errors.

`delete_workout_template(p_id uuid)` is an invoker-rights database operation under
the requesting user's RLS context. It takes the same transaction advisory template
lock as creation/saving, including when no template row exists, then deletes the
visible parent. Existing foreign-key cascades remove placements and sets. The
private successful-save records deliberately remain, so a committed creation
cannot be resurrected by a delayed replay after deletion. They still cascade away
with the application User.

The endpoint returns a null acknowledgment. The service validates that response;
an unavailable or malformed response remains a failure eligible for retry. Existing
UI behavior preserves detail on failure, locks conflicting actions while pending,
and returns to the updated list on success. Retrying a committed deletion whose
response was lost succeeds even though the template is already absent. Empty
accounts retain Create, and independent sample workout history is unchanged.

## Verification and deployment

The existing disposable `check-templates` workflow now covers owner deletion,
missing and foreign no-ops, malformed identities, anonymous HTTP/RPC denial,
committed-but-lost deletion responses, and concurrent creation replay/deletion.
A child-delete fault injected only for the fixture account proves the complete
aggregate remains intact on a cascade failure; after removing the fault, retry
removes the template. Public service reads assert outcomes. The #102 database
suite retains its relational cascade and ownership-policy assertions.

Router tests use the real persistence service and SDK with controlled HTTP
responses to verify confirmation/cancellation, visible detail after a lost
response, pending navigation guards, safe retry to the empty state, and malformed
acknowledgment recovery. Production composition remains the final #125 slice.

Apply the additive deletion migration before deploying the updated template Edge
Function. Keep the existing foundation and creation migrations unchanged; do not
reset hosted data or remove successful-save recognition during template deletion.
Independent review, maintainer deployment, and production audit remain required.
