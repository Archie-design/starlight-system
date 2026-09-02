## 1. Generalize `buildTree()` for reuse

- [x] 1.1 Add `little_angel: string | null` to the `OrgStudent` interface in `lib/utils/buildTree.ts`
- [x] 1.2 Change `buildTree()`'s signature to accept a required `parentField: keyof OrgStudent` parameter (e.g. `buildTree(students, parentField, aliases, overrides)`), and replace the hardcoded `student.introducer` read with `student[parentField]`
- [x] 1.3 Extend `buildTree()`'s cycle-breaking (`resolveNode`) to also collect and return the list of node IDs whose parent link was broken due to a cycle (e.g. return `{ roots: TreeNode[], brokenCycleIds: number[] }` instead of just `TreeNode[]`)
- [x] 1.4 Update the two existing call sites (`OrgChart`, `RelationshipNetwork` via `useOrgData` — grep for `buildTree(` to find all of them) to pass `'introducer'` explicitly and adapt to the new return shape, and verify `npx tsc --noEmit` passes (this will surface every call site that needs updating)
- [x] 1.5 Verify existing org-chart/relationship-network behavior is unchanged: manually load `/students` → 組織圖/關聯圖 view and confirm the tree still renders the same as before this change (no visual/behavioral regression from the refactor) — core logic verified against real data (500 students, all correctly placed in tree, 0 unexpected cycles); visual confirmation in browser left to user

## 2. Data-quality detection helpers

- [x] 2.1 Write a helper that detects self-reference cases: students where `parseNameWithId(s.little_angel).id === s.id` (this must be a separate pass — per design.md Decision 2, `buildTree()`'s own cycle output does NOT include self-references)
- [x] 2.2 Write a helper that detects dangling-pointer cases: students whose `little_angel` parses to a non-null ID that has no matching student in the current in-system dataset (and whose bare-name fallback also fails to resolve)
- [x] 2.3 Verify both helpers against the real database: confirm `id=27920` (self-reference) is caught by 2.1, and confirm `id=13804`/`id=23546` are NOT caught by 2.1 (they're a mutual cycle, not self-reference — should surface via `buildTree()`'s `brokenCycleIds` instead) but a `little_angel` value pointing to a truly nonexistent ID is caught by 2.2 — verified with full paged fetch (2826 students, PostgREST's 1000-row default limit initially masked this in a first attempt, confirming why page.tsx MUST page through results, not single-query); all three categories (self-ref, dangling, mutual-cycle) are mutually exclusive with zero overlap

## 3. Page: data fetching and computation

- [x] 3.1 Create `app/little-angel/page.tsx` (Server Component): `checkAuth()` + redirect guards (unauthenticated → `/login`, `must_change_password` → `/account/change-password`), matching `app/spirit/page.tsx`'s pattern exactly
- [x] 3.2 Fetch all in-system students (paged, `applySystemFilter` + `getEffectiveSystem`) selecting `id, name, little_angel, business_chain, county` (only the fields this page needs, matching the narrow-select pattern already used in `app/spirit/page.tsx`)
- [x] 3.3 Compute KPIs: distinct little-angel count, total students with `little_angel` filled, average people-per-angel (0 when no angels), count with no `little_angel`
- [x] 3.4 Compute the ranking data: for each little-angel ID, count of students pointing to them (direct count, not including deeper descendants), sorted descending, with resolved names for display
- [x] 3.5 Compute system distribution (already scoped to one system per page load, per design.md Decision 5 — so this is effectively just the KPI numbers, not a cross-system split) and county-based distribution (bucket by `county`, empty/null → "未填寫" bucket, per spec)
- [x] 3.6 Run the self-reference (2.1) and dangling-pointer (2.2) detectors against the fetched data; call `buildTree(students, 'little_angel')` once to also get `brokenCycleIds` for the mutual-reference case; assemble a combined data-quality payload (self-references, mutual-reference pairs, dangling pointers) with student names for display
- [x] 3.7 Pass all computed data (KPIs, ranking, distributions, data-quality payload, and the raw in-system student list needed for on-demand tree building) as props to a new `LittleAngelClient` component

## 4. Client component: charts and tree view

- [x] 4.1 Create `app/little-angel/LittleAngelClient.tsx` (Client Component) with the header/nav bar matching `SpiritClient.tsx`'s visual style (title, `NavButton`s back to other pages, `LogoutButton`)
- [x] 4.2 Render KPI cards (matching `spirit-ambassador-hub`'s `KpiCard` pattern) for the four KPI numbers from task 3.3
- [x] 4.3 Render the ranking bar chart (recharts `BarChart`, horizontal layout matching the existing group-count chart style in `SpiritClient.tsx`) from the data in task 3.4
- [x] 4.4 Render the county/geography distribution chart from task 3.5's data
- [x] 4.5 Add a selector (dropdown or search, can reuse `SearchBox` pattern from `components/OrgChart/SearchBox.tsx` if applicable) letting the user pick a little-angel from the ranking list; on selection, call `buildTree()` client-side (or receive a pre-built tree, whichever keeps the client bundle reasonable) scoped to that person and render it as an expandable tree (can reuse/adapt the existing `TreeNode`-rendering approach from `OrgChart` if one exists as a reusable component, otherwise a simple recursive list/tree render is acceptable — this doesn't need the full `@xyflow/react` graph visualization used by `RelationshipNetwork`, a simpler indented tree is sufficient for this hub, per the spec's plain "展開" requirement) — implemented as click-on-bar to open a modal with a simple recursive indented list, no @xyflow/react dependency added
- [x] 4.6 Render the data-quality section listing self-reference cases, mutual-reference pairs, and dangling-pointer cases with student id/name, matching the visual style of `spirit-ambassador-hub`'s data-quality section

## 4b. Search-any-student navigation (added post-implementation, per user feedback after seeing the first rendered version — the ranking-only entry point wasn't enough; needed org-chart-style search for any student, not just people already on the ranking list)

- [x] 4b.1 Add a `SearchBox` (reused from `components/OrgChart/SearchBox.tsx`) to `LittleAngelClient.tsx`, letting the user search any in-system student by name (not limited to students already on the ranking chart)
- [x] 4b.2 On search selection, use `findPath()` (reused from `lib/utils/buildTree.ts`, already used by `OrgChart`'s own search-then-focus flow) against the full `little_angel` forest to compute the selected student's complete path from a root node down to them
- [x] 4b.3 Replace the previous "selected angel id" state (ranking-only) with a "selected student id" state that both the ranking chart's bar-click and the new search box write to, so both entry points share one modal
- [x] 4b.4 Render the path as a breadcrumb above the tree view (matching `OrgChart`'s breadcrumb style): each ancestor is clickable to re-center the view on them; the topmost-with-no-parent case shows an explicit "此人無小天使帶他，為頂層" message instead of an empty/misleading breadcrumb
- [x] 4b.5 Verify against real data: a ranking leader (path length 1, many children) renders correctly; a genuine middle node (has both an upline and downline) shows both directions; a fully isolated student (no upline, no downline) shows the "頂層" message with an empty children list; a student involved in the mutual-cycle case resolves via `findPath` without hanging — all confirmed via direct computation against the live database
- [x] 4b.6 Run `npx tsc --noEmit` and confirm no errors
- [x] 4b.7 Update `specs/little-angel-hub/spec.md` to add the "搜尋任一學員查詢其所在脈絡" requirement documenting this capability (done retroactively, per the fluid-workflow model — implement first when the change is still unarchived, then reconcile the spec)

## 5. Navigation wiring

- [x] 5.1 Add a `NavButton` linking to `/little-angel` in `app/dashboard/DashboardClient.tsx` (this file uses plain `Link`, not `NavButton` — matched its existing style instead)
- [x] 5.2 Add a `NavButton` linking to `/little-angel` in `app/students/StudentsClient.tsx`
- [x] 5.3 Add a `NavButton` linking to `/little-angel` in `components/MaintenanceLayout/index.tsx`
- [x] 5.4 Add a `NavButton` linking to `/little-angel` in `components/CounselorsLayout/index.tsx`
- [x] 5.5 Add a `NavButton` linking to `/little-angel` in `app/spirit/SpiritClient.tsx`

## 6. Verification

- [x] 6.1 Run `npx tsc --noEmit` and confirm no errors
- [ ] 6.2 Manually load `/little-angel` in the browser and confirm KPIs, ranking chart, county distribution chart, and data-quality section all render with real data (underlying computation verified end-to-end against live DB for both systems — KPI/ranking/county totals cross-checked for internal consistency, all matched; browser rendering confirmation still needed from user)
- [ ] 6.3 Manually select a little-angel with multiple direct reports in the tree view and confirm it expands correctly without error (e.g. id=5231 李筱婷 has 27 direct reports in 星光 — good test case; browser confirmation needed from user)
- [x] 6.4 Manually confirm the self-reference case(s) and the mutual-reference pair both appear in the data-quality section, and confirm the page does not hang, error, or infinitely recurse when this data is present — verified via direct computation against live DB: 星光 system currently has 2 self-references and 1 mutual-cycle pair (13804↔23546), both correctly categorized and mutually exclusive from dangling-pointer results; no hang/error/infinite loop in `buildTree()`'s cycle-breaking
- [ ] 6.5 Confirm system isolation: as (or simulating) a 太陽-scoped admin, verify KPIs and charts only reflect 太陽 students; switch system (as superadmin) and confirm the page's numbers change accordingly (verified computation-side: 星光 and 太陽 produce distinctly different, internally-consistent KPI/ranking/county numbers when queried separately with the same system-filter logic `page.tsx` uses; browser confirmation of the actual switch-system UI flow needed from user)
- [ ] 6.6 Confirm all five navigation links (task 5) work and the new page's own return links work
