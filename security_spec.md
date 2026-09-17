# Security Specification & Threat Model

## 1. Where the boundary is

The browser talks to Supabase directly with the anon key, so **row-level
security is the enforcement point**, not the Node API. A request that never
touches the API is still governed by the policies in
`supabase/migrations/`. The API's own ownership checks are a second layer over
its own session state, not a substitute for RLS.

Identity everywhere comes from a verified token. A `userId`, `agentId` or
`sessionId` supplied by a client is data, never proof.

## 2. Data invariants

- `profiles`: a user reads, updates and deletes only the row whose `id` equals
  their `auth.uid()`. Inserts are restricted to `role in ('engineer',
  'operator')`, so a first write cannot arrive already privileged, and the
  `profiles_role_immutable` trigger rejects any role change made by an
  `authenticated` request. The service role and direct database access still
  administer roles.
- `voice_agents`: every statement is scoped to `user_id = auth.uid()`. `UPDATE`
  carries both `USING` and `WITH CHECK`, so a row cannot be updated into
  another account's ownership.
- `call_sessions`: same ownership rule. `messages` is capped at 200 entries and
  must be a JSON array.
- Client-supplied ids on `voice_agents` and `call_sessions` are constrained to
  1–128 characters matching `^[A-Za-z0-9_-]+$`.
- `anon` holds no grants on any of the three tables.

## 3. Payloads that must be refused

1. Unauthenticated select on `profiles` → empty result, no rows.
2. User A selecting, updating or deleting User B's `profiles` row → no rows.
3. A user setting `role: 'admin'` on insert → policy violation.
4. A user updating their own `role` → `insufficient_privilege` from the trigger.
5. User A inserting a `voice_agents` row with `user_id` set to User B → policy
   violation.
6. User A updating or deleting User B's `voice_agents` row → no rows.
7. Reassigning `user_id` on an owned row → `WITH CHECK` violation.
8. User A selecting User B's `call_sessions`, including transcripts → no rows.
9. An id over 128 characters or containing other characters → check constraint.
10. A `messages` array over 200 entries → check constraint.
11. A select with no ownership predicate → only the caller's own rows.
12. Any write with the `anon` role → no grant.

## 4. API surface

- Every authenticated route requires `Authorization: Bearer <supabase access
  token>`; the token is verified locally against the project issuer with
  audience `authenticated`.
- A token whose `role` claim is not `authenticated` is refused, so a leaked
  service-role key cannot be presented as an end user.
- A missing `SUPABASE_URL` fails closed: authenticated routes return
  `AUTH_NOT_CONFIGURED` rather than serving anyone.
- A session belonging to another user is reported as `SESSION_NOT_FOUND`,
  identical to one that never existed, so ids cannot be probed.
- Endpoints that reach a paid provider are rate limited per authenticated user.

## 5. Verification status

The policies above are enforced by the database and need to be exercised
against a real project. Ownership and token handling on the API surface are
covered by the suite in `tests/server/`; the RLS policies themselves are not,
because no Postgres instance runs in CI. Running the migration against a
project and working through §3 is a required step before production use.
