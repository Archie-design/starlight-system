## Context

`import_sessions` has no direct system/tenant column. The existing `/api/history` route (added in a prior change, P2 #22) already solved "which system does this import session belong to" by reading the first row of `diff_snapshot` (a `StudentInsert[]` JSONB blob) and running it through the shared `systemOf()` helper — relying on the invariant, enforced elsewhere (P0 #2), that a single import session can never mix rows from two systems. That route also has a known limitation: it fetches only the newest 100 sessions (`.order('imported_at').limit(100)`) and filters by system *after* the fetch, so if the newest 100 sessions all belong to the other system, a session that does belong to the caller's system but is older than those 100 could be missed. It also gates access behind `requireManager`, because it exposes the full history list (filenames, row counts, etc.) to anyone who can call it.

This change only needs a single value — the most recent **applied** session's `applied_at` for the caller's system — not a list, and it needs to be visible to any authenticated user (not just managers), since it's rendered in the main grid's FilterBar that every role sees. See proposal.md - Why for the user-facing motivation.

## Goals / Non-Goals

**Goals:**
- Return exactly one timestamp (or an explicit "none yet" signal) scoped to the caller's effective system, without the pagination-then-filter blind spot the `history` route has.
- Make the result visible to every authenticated role, not just `requireManager`.
- Keep the elapsed-time text visually advancing without re-fetching every minute.

**Non-Goals:**
- Not building a general-purpose "list all import sessions" endpoint (that's what `/api/history` already is).
- Not changing what `students.updated_at` / the existing "更新：" text means or where its data comes from.
- Not surfacing per-system import history beyond the single most-recent-applied timestamp.

## Decisions

**1. New dedicated endpoint (`/api/last-import`) rather than extending `/api/history`.**
`/api/history` is `requireManager`-gated and returns a list; this feature needs a single value visible to all authenticated roles. Reusing `/api/history` would mean either loosening its access control (expanding what non-managers can see: filenames, row counts) or branching its response shape by role — both add risk to an existing, already-reviewed endpoint for a need that's actually simpler. A small dedicated route mirrors the existing pattern (`/api/last-updated` already does exactly this for the "資料最後異動時間" case) and keeps `/api/history`'s access model untouched.
- Alternative considered: extend `/api/history` with a `?latestOnly=true` mode. Rejected — still requires either loosening its auth gate or adding role-conditional logic, and couples two different consumers (full history page vs. a lightweight status chip) to one endpoint's evolution.

**2. Query directly for `applied = true` ordered by `applied_at` descending with no `LIMIT` on the *pre-filter* set — filter by system in the same pass, not after truncating to a fixed page.**
Because a system-scoped answer requires reading `diff_snapshot` to determine each session's system (same as `/api/history`), and there's no indexed system column to push the filter into SQL, the query still has to pull candidate rows into JS to inspect `diff_snapshot`. To avoid `/api/history`'s "newest 100 might all be the other system" gap while keeping the query cheap, order by `applied_at desc` and iterate rows one page at a time (e.g. re-using the existing 500-row chunking pattern seen elsewhere in the repository layer — see `lib/db/supabaseRepository.ts`), stopping at the *first* row whose resolved system matches, rather than fetching a fixed 100 and filtering afterward. In practice this is normally just the first row scanned, since most recent imports are for the currently-active system.
- Alternative considered: add a `system` column to `import_sessions` (denormalize `systemOf(diff_snapshot[0].business_chain)` at write time in `/api/import/apply`). This would make the query trivial and indexable, but it's a schema change requiring a migration for a single low-traffic read; deferred as a future optimization if this route ever needs to scale past occasional polling.

**3. `superadmin` still needs a well-defined effective system for this feature**, exactly as `getEffectiveSystem()` already resolves it elsewhere (bound system for `admin`/`system_admin`, cookie-selected system for `superadmin`). No new resolution logic — reuse `getEffectiveSystem()` as-is.

**4. Authentication: `checkAuth(request)`, not `requireManager(request)`.**
Any authenticated user should see data freshness, matching the audience of the existing "更新：" indicator it sits next to (which itself only requires `checkAuth`).

**5. Frontend: server returns a fixed ISO timestamp (or `null`); the client computes and re-renders the "距上次匯入 X 天 Y 小時" text on an interval timer, not via SWR re-fetching.**
Elapsed time only needs to change relative to wall-clock time, not because underlying data changed — recomputing from an already-fetched timestamp locally (e.g., a `setInterval` tick every 30–60s that forces a re-render) avoids unnecessary network calls compared to shrinking the existing SWR `refreshInterval`.
- Alternative considered: reduce SWR `refreshInterval` to something small (e.g., 60s) to force periodic re-fetch. Rejected — re-fetching the same timestamp repeatedly just to recompute a client-side diff is wasted network/server work for a value that only changes when a new import is applied (an infrequent event).

## Risks / Trade-offs

- [Risk] Scanning `import_sessions` row-by-row in JS to resolve system (Decision 2) is O(n) in the worst case (e.g., if the current system hasn't imported in a very long time while the other system imports frequently) → Mitigation: page through in bounded chunks (same chunking size already used elsewhere in the codebase) so a worst-case scan still completes in bounded batches rather than one unbounded query; this is a low-traffic, infrequently-polled endpoint (one fetch per page load, not per keystroke), so worst-case latency here is acceptable relative to the complexity of denormalizing a system column now.
- [Risk] Client-side interval timer could drift from actual elapsed time or keep running after the component unmounts → Mitigation: standard `useEffect` cleanup (`clearInterval` on unmount), same pattern already used for other polling/interval logic in this codebase (e.g., `useEffect` + `addEventListener`/`removeEventListener` pairs seen in the Grid components).
- [Risk] A session whose `diff_snapshot` is empty or malformed (edge case already handled defensively in `/api/history` by excluding it) could be skipped even if it's actually the most recent applied import for the system → Mitigation: same conservative behavior as `/api/history` — skip rows whose system can't be determined rather than guessing; this is an existing accepted trade-off in the codebase, not a new one introduced here.

## Migration Plan

No database schema changes. Additive only: new route file, new FilterBar UI addition. No rollback concerns beyond reverting the change — no existing data or endpoints are modified.
