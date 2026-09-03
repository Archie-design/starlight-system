## 1. Shared utility export

- [x] 1.1 Export the `NUMERIC` regex from `lib/utils/studentStatus.ts` (rename to `NUMERIC_PAYMENT` if that reads clearer at the export boundary, or keep `NUMERIC` — either way it must become importable) and verify `owesPayment()`'s own behavior is unchanged (no logic edit, purely adding `export`) — kept the name `NUMERIC`, purely added `export` + a doc comment
- [x] 1.2 Run `npx tsc --noEmit` and confirm no errors from this change alone before proceeding

## 2. Page: data fetching and computation

- [x] 2.1 Create `app/courses/page.tsx` (Server Component): `checkAuth()` + redirect guards (unauthenticated → `/login`, `must_change_password` → `/account/change-password`), matching `app/spirit/page.tsx` and `app/little-angel/page.tsx`'s pattern exactly
- [x] 2.2 Fetch all in-system students (paged, `applySystemFilter` + `getEffectiveSystem`) selecting `id, name, business_chain, course_1, payment_1, course_2, payment_2, course_3, payment_3, course_4, payment_4, course_5, payment_5, course_wuyun, payment_wuyun` (only the fields this page needs)
- [x] 2.3 For each of course_1~course_5, use `parseCourseValue()` to compute: total enrolled count, per-batch enrollment distribution (grouped by `${level}-${batch}` key per design.md Decision 3, excluding students whose status parses with `batch === null` e.g. "待確認梯次" from the batch chart but still counting them in the stage total), and owed-count/owed-amount totals (using the exported `NUMERIC` check against the corresponding `payment_N` field)
- [x] 2.4 For course_wuyun, compute enrollment count, completed-payment count, owed count, and owed amount total — no batch breakdown (per spec's "五運班付款統計" requirement)
- [x] 2.5 Build a per-stage-and-batch student roster lookup (so the client can request "show me everyone in 一階 第83梯" or "show me everyone in 一階" without re-fetching) — pass as structured data down to the client component, keeping only the fields needed for display (id, name, batch/status label, payment status)
- [x] 2.6 Pass all computed data (per-stage summaries, batch distributions, owed totals, wuyun stats, roster lookup) as props to a new `CourseClient` component

## 3. Client component: stage selector, charts, roster drill-down

- [x] 3.1 Create `app/courses/CourseClient.tsx` (Client Component) with the header/nav bar matching the established hub visual style (title, system-switch control for superadmin per design.md Decision 5, `NavButton`s back to other pages, `LogoutButton`)
- [x] 3.2 Render a stage selector (一階/二階/三階/四階/五階/五運班) and, for the selected main-course stage, a batch distribution bar chart (horizontal, scrollable container with height cap per design.md Risk mitigation, matching `spirit-ambassador-hub`/`little-angel-hub`'s existing chart-height calculation pattern) — implemented as tab buttons (一階~五階) plus a separate always-visible 五運班 section below, rather than folding 五運班 into the same tab set (its stats have a different shape — no batch chart — so a dedicated section reads clearer than a tab that renders differently from the other five)
- [x] 3.3 Render owed-amount summary (count + total owed) for the selected stage, and separately for course_wuyun in its own section (not mixed into the batch chart, per spec)
- [x] 3.4 Implement roster drill-down: clicking a stage-level summary or a specific batch bar opens a modal (matching the existing hub modal pattern) listing matching students (name, batch/status, payment status), each linking to `/students?search=...`
- [x] 3.5 Run `npx tsc --noEmit` and confirm no errors

## 4. Navigation wiring

- [x] 4.1 Add a nav link to `/courses` in `app/dashboard/DashboardClient.tsx` (matches this file's existing `Link`-based style, not `NavButton` — see prior hub pages' precedent)
- [x] 4.2 Add a `NavButton` linking to `/courses` in `app/students/StudentsClient.tsx`
- [x] 4.3 Add a `NavButton` linking to `/courses` in `components/MaintenanceLayout/index.tsx`
- [x] 4.4 Add a `NavButton` linking to `/courses` in `components/CounselorsLayout/index.tsx`
- [x] 4.5 Add a `NavButton` linking to `/courses` in `app/spirit/SpiritClient.tsx`
- [x] 4.6 Add a `NavButton` linking to `/courses` in `app/little-angel/LittleAngelClient.tsx`

## 4b. Makeup-class attendance and club registration (added post-implementation, per user feedback after seeing the first rendered version)

- [x] 4b.1 Create `supabase/migrations/018_course_makeup_and_club.sql` adding 18 makeup-class columns (`l1_makeup_1`..`l1_makeup_6`, `l2_makeup_1`..`l2_makeup_5`, `l3_makeup_1`..`l3_makeup_3`, `l4_makeup_1`..`l4_makeup_3`, `l5_makeup_1`) and 2 club columns (`club_join_date DATE`, `club_group TEXT`), all nullable
- [x] 4b.2 Add the 20 new fields to the `Student` interface in `lib/supabase/types.ts`
- [x] 4b.3 Update `lib/import/transform.ts`: add `DEFAULT_COL` fallback indices, `HEADER_TO_COL_KEY` exact-text mappings for all 18 makeup-class headers plus "聯誼會加入日"/"聯誼會組別" (verified the actual header text against the sample file — wording is inconsistent across stages, e.g. "一階課程 - X" vs "三階 - X", so each had to be matched exactly), and extraction logic in `transformSourceRow()`
- [x] 4b.4 Update `lib/import/diff.ts`'s `COMPARABLE_FIELDS` to include the 20 new fields (lesson learned from the address-fields change earlier in this session — this must be done immediately, not left for a later bug report)
- [x] 4b.5 Update `supabase/seed/migrate.ts` to fill the 20 new fields with `null` (source spreadsheet for that one-time seed script has no corresponding data)
- [x] 4b.6 Run `npx tsc --noEmit` and confirm no errors
- [x] 4b.7 Verify import parsing against the real sample file (`reference/學員資料庫 20260826 (1).xlsx`): confirm all rows parse successfully, spot-check several students' makeup-class values and club join dates against expectations, confirm existing fields (course_1, address, etc.) are unaffected
- [x] 4b.8 Extend `app/courses/page.tsx`: compute per-stage makeup-class completion (denominator = students who've taken that stage's main course), per-class attendance/absence rosters, and club registration stats (joined/not-joined counts, group distribution)
- [x] 4b.9 Extend `app/courses/CourseClient.tsx`: render a "課後課完課狀況" card per stage (progress bar + attended/absent counts per class, clickable to open roster modals) and a "聯誼會報名" card (joined/not-joined counts, group distribution, clickable roster)
- [x] 4b.10 Run `npx tsc --noEmit` and confirm no errors
- [x] 4b.11 End-to-end verification against the live database — migration 018 applied by user. Confirmed all 20 new columns exist and are queryable; confirmed attendance+absence sums equal enrollment counts for all 5 stages × both systems (10 combinations, all consistent) against current (currently-null, pre-reimport) data; additionally simulated the post-reimport numbers using the real sample file (in-memory parse only, not written to DB) to sanity-check completion rates look reasonable (11%–39% per-class attendance, 5階's single-class rate exactly matches its "fully attended" count as expected) and club stats (510/2096 joined, group distribution sensible) — actual live numbers will populate on the next real xlsx import
- [x] 4b.12 Update `proposal.md`, `design.md`, and `specs/course-hub/spec.md` to document this addition (done retroactively, per the fluid-workflow model established earlier in this session)

## 4c. Aggregate incomplete roster, l2/club gap roster, and CSV export (added post-implementation, per user feedback after seeing real data on the live page)

- [x] 4c.1 Extend `app/courses/page.tsx`: add `incompleteMakeupCount` to `StageSummary` and build `roster[\`incomplete-makeup-${level}\`]` (students who've taken the stage's main course but haven't attended every makeup class, `statusLabel` = "已上 X / Y 堂") in the same per-stage loop that builds the per-class attendance/absence rosters
- [x] 4c.2 Extend `app/courses/page.tsx`: add `L2ClubGap` interface and computation — `course_2` students whose `parseCourseValue().status === '已上課'` (confirmed with user: strict status match, not just "course_2 has a value") filtered further by `!club_join_date`, stored as `roster['club-not-joined-l2']`
- [x] 4c.3 Extend `app/courses/CourseClient.tsx`: import `L2ClubGap` type, add `l2ClubGap` to `Props`, add UI button in the existing "課後課完課狀況" card linking to the incomplete roster, add a new "二階已完課未報聯誼會" card linking to the l2-club-gap roster, extend `rosterTitle`'s `useMemo` with branches for both new roster key formats
- [x] 4c.4 Add `csvEscape()` and `downloadRosterCsv(title, rows)` helper functions to `app/courses/CourseClient.tsx` — client-side only (`Blob` + `URL.createObjectURL` + synthetic `<a download>` click), UTF-8 BOM prefix, 3-column (姓名/狀態/備註) CSV shape reusing `RosterStudent`'s existing fields, no new server API route
- [x] 4c.5 Wire a "匯出 CSV" button into the shared roster Modal header (not per-roster-type) so it covers every roster type at once per user's explicit requirement ("所有名單 Modal 都加上匯出按鈕") — disabled when the open roster list is empty
- [x] 4c.6 Run `npx tsc --noEmit` and confirm no errors
- [x] 4c.7 Verify against the live database (real data present post-migration-018): confirmed `fullyAttendedMakeupCount + incompleteMakeupCount === completedMainCourseCount` for all 5 stages; confirmed `course_2` status distribution (已上課=1242, 待確認梯次=293, 正取=278, 候補=49, 中離=3) shows the strict "已上課" filter meaningfully excludes non-attended statuses; sampled several l2-club-gap roster entries against raw `course_2`/`club_join_date` values
- [x] 4c.8 Verify CSV escaping (comma/quote/newline handling) and BOM prefix in isolation with representative Chinese-text and special-character inputs
- [x] 4c.9 Update `proposal.md`, `design.md`, and `specs/course-hub/spec.md` to document this addition (done retroactively, per the fluid-workflow model established earlier for this same change and for `little-angel-hub`)

## 4d. CSV export contact columns (added post-implementation, per user feedback after seeing the CSV export in real use)

- [x] 4d.1 Add `phone: string | null` and `lineId: string | null` to the `RosterStudent` interface in `app/courses/page.tsx`; add `phone`/`line_id` to the `Row` type and the Supabase `.select()` column list
- [x] 4d.2 Populate `phone`/`lineId` at all six `RosterStudent` construction sites in `app/courses/page.tsx` (per-stage roster, per-makeup-class attended/absent rosters, incomplete-makeup roster, wuyun roster, club-joined roster, l2-club-gap roster)
- [x] 4d.3 Extend `downloadRosterCsv()` in `app/courses/CourseClient.tsx` to a 6-column CSV (ID, 姓名, 手機, LINE ID, 狀態, 備註); missing phone/line_id render as an empty field, not a placeholder
- [x] 4d.4 Run `npx tsc --noEmit` and confirm no errors
- [x] 4d.5 Verify against the live database: sampled the l2-club-gap roster (435 of 1000-row sample) — 433 had phone, 425 had line_id, 423 had both, 0 had neither, confirming real coverage; re-verified CSV escaping/BOM with the new 6-column shape including a null-line_id row
- [x] 4d.6 Update `proposal.md`, `design.md`, and `specs/course-hub/spec.md` to document this addition

## 5. Verification

- [x] 5.1 Run `npx tsc --noEmit` and confirm no errors
- [x] 5.2 Verify computation against the live database: for at least one stage (e.g. 一階), confirm the sum of all batch counts plus the "unscheduled/待確認梯次" count equals the stage's total enrollment count reported elsewhere (e.g. cross-check against dashboard's existing course funnel number for internal consistency) — verified for all 5 stages × both systems (10 combinations): batch-count sums exactly equal "已排梯次" counts in every case, no missing/duplicate students
- [x] 5.3 Verify owed-amount totals: for a sample stage, manually cross-check a handful of individual student payment values against the computed total to confirm the numeric-owed detection and summation are correct — sampled 3 students per stage per system (30 total), each individual payment value confirmed to match its raw `payment_N` field value and correctly included in the stage's owed total
- [ ] 5.4 Manually load `/courses` in the browser and confirm the stage selector, batch chart, owed-amount summary, and wuyun section all render with real data
- [ ] 5.5 Manually click into a batch and confirm the roster modal shows only that batch's students, and that clicking a student links correctly to `/students`
- [ ] 5.6 Confirm system isolation: as (or simulating) a 太陽-scoped admin, verify stats only reflect 太陽 students; switch system (as superadmin) and confirm the page's numbers change accordingly (computation-side verified: 星光 and 太陽 produce distinctly different, internally-consistent stage/batch/owed numbers when queried separately with the same system-filter logic `page.tsx` uses; browser confirmation of the actual switch-system UI flow still needed from user)
- [ ] 5.7 Confirm all six navigation links (task 4) work and the new page's own return links work
