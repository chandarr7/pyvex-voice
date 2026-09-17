# Security Specification & Threat Model

## 1. Data Invariants
- `users/{userId}`: Only the authenticated user matching `request.auth.uid == userId` can read or write their user profile. Role changes (`role == 'admin'`) cannot be self-assigned.
- `voice_agents/{agentId}`: A user can only create, update, or delete voice agents where `userId == request.auth.uid`. Listing is scoped to `resource.data.userId == request.auth.uid`.
- `call_sessions/{sessionId}`: A user can only create, update, or read call sessions where `userId == request.auth.uid`. Listing queries enforce `resource.data.userId == request.auth.uid`.

## 2. The Dirty Dozen Payloads (Targeting PERMISSION_DENIED)
1. Unauthenticated read on `/users/{userId}` -> PERMISSION_DENIED.
2. Authenticated user A attempting `get` or `write` on `/users/{userB}` -> PERMISSION_DENIED.
3. User attempting to assign `role: "admin"` on registration -> PERMISSION_DENIED.
4. User A creating a voice agent with `userId: "userB"` -> PERMISSION_DENIED.
5. User A attempting to modify User B's voice agent configuration -> PERMISSION_DENIED.
6. User injecting a 500-character payload into `id` or path variable exceeding 128 chars -> PERMISSION_DENIED.
7. User A listing call sessions without filtering by their own `userId` -> PERMISSION_DENIED.
8. User A reading call transcripts belonging to User B (`/call_sessions/{userBSession}`) -> PERMISSION_DENIED.
9. User modifying `createdAt` or changing `userId` on update -> PERMISSION_DENIED.
10. Shadow update inserting arbitrary unregistered keys into user or agent document -> PERMISSION_DENIED.
11. Blanket read request to all collections without UID predicate -> PERMISSION_DENIED.
12. Attempting to update a call session whose status is terminal ('completed') to overwrite historical logs -> PERMISSION_DENIED.
