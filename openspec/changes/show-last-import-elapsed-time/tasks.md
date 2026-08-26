## 1. Backend: last-import endpoint

- [x] 1.1 Create `app/api/last-import/route.ts` with `GET` handler using `checkAuth(request)` (not `requireManager`) and verify unauthenticated requests are rejected with 401
- [x] 1.2 Implement chunked query against `import_sessions` (`applied = true`, ordered by `applied_at desc`) that pages through rows selecting `id, applied_at, diff_snapshot`, resolves each candidate's system via `systemOf(diff_snapshot[0].business_chain)` (skip rows with empty/malformed `diff_snapshot`), and stops at the first row matching `getEffectiveSystem(user)` — verify by seeding sessions for both systems and confirming the correct one is returned regardless of which system is "newest" overall
- [x] 1.3 Return `{ lastImportAt: string | null }` (`null` when no applied import exists yet for the system) and verify via manual request that the "no import yet" case returns `null` rather than an error or 404
- [x] 1.4 Verify a superadmin's response changes correctly when switching the active system cookie between 星光 and 太陽 (mirrors existing `getEffectiveSystem` behavior used by `/api/last-updated`)

## 2. Frontend: elapsed-time display

- [x] 2.1 Add an SWR hook/fetcher for `/api/last-import` in `components/StudentGrid/FilterBar.tsx` using `csrfFetch` (not plain `fetch`) and verify the request succeeds in a production-like build (see prior CSRF-header fix for `/api/last-updated` in this same file)
- [x] 2.2 Implement a pure function that formats a millisecond duration into the required display forms (days+hours when ≥ 24h, minutes when < 1h) and verify with unit-level checks (or an inline manual test script) covering: exactly 24h boundary, under 1 minute, several days, and the "no import yet" case
- [x] 2.3 Render the formatted elapsed-time text adjacent to the existing "更新：" text in FilterBar, sourced from `lastImportAt` returned by the new endpoint
- [x] 2.4 Add a client-side interval (with proper `useEffect` cleanup on unmount) that re-renders the elapsed-time text periodically without re-fetching `/api/last-import`, and verify by observing the displayed value advance while the page stays open without a network request firing each tick

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit` and confirm no errors
- [x] 3.2 Manually verify in the browser: FilterBar shows both "更新：{time}" and the new elapsed-time text side by side, the elapsed-time text updates over time without a page reload, and switching system (as superadmin) updates it correctly
- [x] 3.3 Confirm `/api/last-import` is reachable by a non-manager `admin` role (not just `system_admin`/`superadmin`), matching the spec's "visible to any authenticated user" requirement
