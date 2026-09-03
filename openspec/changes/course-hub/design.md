## Context

See proposal.md - Why for motivation. This follows the same established page shape as `app/spirit/page.tsx` and `app/little-angel/page.tsx`: a Server Component fetches all in-system students (paged, `applySystemFilter` + `getEffectiveSystem`), computes aggregates in plain JS, and passes serializable data down to a Client Component that renders `recharts` charts plus interactive drill-down UI.

Two existing utilities this reuses directly:
- `lib/utils/courseUtils.ts`'s `parseCourseValue(value)` — parses a stored course string like `"1-88-正取"` into `{ level, batch, status }`, or `{ level: null, batch: null, status: value }` for non-batch values like `"待確認梯次"`. Verified against live data: `course_1` alone has 67 distinct batches across 2738 enrolled students, confirming batch-level analysis is meaningful (not sparse/trivial).
- The "owes money" numeric check currently lives as a private, unexported `NUMERIC = /^\d+(\.\d+)?$/` regex inside `lib/utils/studentStatus.ts`, used internally by `owesPayment()`. This change needs the same definition to compute per-batch/per-stage owed amounts (not just a boolean "owes or not" — the proposal explicitly asked for actual summed amounts), which `owesPayment()` itself doesn't expose (it only returns a boolean for the *whole student*, not per-field amounts).

Verified data shape for scope decisions:
- `course_1` through `course_5`: enrollment counts step down as expected (2738 → 1866 → 1036 → 664 → 591), each with a healthy spread of distinct batches (67, 41, 21, 16, 16 respectively) — batch-level charts will have real, non-trivial data to show at every stage.
- `course_wuyun`: all 640 non-null values are the literal string `"五運"` — `parseCourseValue()` on this returns `{ level: null, batch: null, status: "五運" }` (no digit-dash-digit pattern to match), confirming there is no batch structure to analyze; only enrollment/payment counts make sense here, per the user's explicit scoping decision.
- The four "special courses" (`life_numbers`, `life_numbers_advanced`, `life_transform`, `debt_release`) are simple non-null/null flags with no paired payment field — structurally different from the six fields this hub covers, and explicitly out of scope per the user's decision.

## Goals / Non-Goals

**Goals:**
- Batch-level (梯次) enrollment distribution for course_1 through course_5, reusing `parseCourseValue()`.
- Owed-amount totals (not just counts) per stage and per batch, computed with the same numeric-string definition `owesPayment()` already uses internally.
- Drill-down: select a stage or a specific batch → see the matching student roster, linking out to `/students`, matching the interaction pattern already established by `spirit-ambassador-hub` (click a group bar → member list) and `little-angel-hub` (click a ranking bar / search → tree modal).
- Course_wuyun included for payment stats only, no batch breakdown.

**Non-Goals:**
- Not touching `/dashboard`'s existing course-related charts (course funnel, payment distribution) — those stay as the system-wide summary view; this hub is an additional, deeper view, not a replacement.
- Not including the four special courses (`life_numbers`/`life_numbers_advanced`/`life_transform`/`debt_release`) — explicitly descoped by the user; their data shape (flag-only, no payment pairing) doesn't fit this hub's "enrollment + payment" theme anyway.
- Not building a "待確認梯次" (unscheduled) tracking/alert feature — the user explicitly did not select this option when scoping the hub; those students still count toward each stage's total enrollment count, but get no dedicated attention section (unlike, say, `spirit-ambassador-hub`'s data-quality alerts, which *were* explicitly requested there).
- Not adding new database columns, migrations, or changes to the import/export pipeline — this is a pure read-only aggregation view over existing `course_N`/`payment_N`/`course_wuyun`/`payment_wuyun` columns.

## Decisions

**1. Export `NUMERIC` from `lib/utils/studentStatus.ts` (or an equivalent shared definition) rather than duplicating the regex in a new file.**
The "is this payment value a still-owed amount" check must stay in exactly one place — `owesPayment()`'s per-student boolean logic and this hub's per-batch/per-stage amount-summing logic need to agree on what counts as "owed" (a bare numeric string) or the two views of the same data could silently disagree (e.g. dashboard says student X owes money, course hub's stage total doesn't include them, or vice versa). Renaming the constant to `export const NUMERIC_PAYMENT = /^\d+(\.\d+)?$/` (or exporting the existing name) and importing it from the new aggregation code keeps a single source of truth.
- Alternative considered: copy the regex literal into the new course-hub code. Rejected — this is exactly the kind of small duplicated business rule that drifts silently over time (the codebase's own review history already flagged this pattern as a recurring risk elsewhere — see the parallel-whitelist case for filterable columns).

**2. Compute owed amounts by parsing `payment_N` as a number when it matches the numeric-string pattern, summing per stage and per batch — payment amount is NOT a separate stored field, it *is* the payment string itself when numeric** (per `lib/import/transform.ts`'s `buildPaymentValue()`: a numeric payment value already means "this is the remaining balance owed", not "this is some other amount that happens to look numeric").
No new parsing logic needed beyond `Number(paymentValue)` after the `NUMERIC` regex test — this mirrors `buildPaymentValue()`'s own inverse operation (the import pipeline already treats a numeric string in this field as literally the owed balance).

**3. Batch key for grouping is `${level}-${batch}` from `parseCourseValue()`'s output** (matching the existing `cohortKey()` convention in `lib/utils/relations.ts`, which already builds this exact key format for its own "same cohort" relationship feature) — reusing an established key format rather than inventing a new one.

**4. Drill-down UI: a stage selector (tabs or buttons for 一階~五運) plus, within a selected stage, a clickable batch bar chart; clicking either level opens a roster panel** (modal, matching `spirit-ambassador-hub`'s and `little-angel-hub`'s existing modal-on-click pattern) **listing students with name, batch/status, and payment status, each linking to `/students?search=...`** (identical link pattern already used by both existing hubs' roster items).
- Alternative considered: a single mega-chart with all five stages stacked. Rejected — batch counts vary wildly by stage (67 batches for 一階 vs 16 for 四/五階), a single combined chart would either be unreadable at 一階's scale or waste space at 五階's scale; a per-stage selector keeps each chart's scale appropriate to its own data.

**5. System scoping and navigation wiring follow the exact same pattern as `little-angel-hub`**: Server Component computes everything scoped to `getEffectiveSystem(user)`, superadmin gets a system-switch control that sets the `sl_view_system` cookie and calls `router.refresh()`, and the same six existing hub-style pages (dashboard, students, maintenance, counselors, spirit, little-angel) each gain one more nav link — no new navigation pattern introduced, this is now the sixth page following that convention.

## Risks / Trade-offs

- [Risk] Renaming/exporting the private `NUMERIC` constant in `studentStatus.ts` touches a file used by several existing features (`owesPayment()`, `membershipStatus()` lives in the same file) → Mitigation: this is an additive export, not a behavior change to any existing function — `owesPayment()`'s own logic is untouched, only its previously-private regex becomes importable elsewhere; `npx tsc --noEmit` will catch any accidental signature change.
- [Risk] Owed-amount totals could be misread as "money actually collectible" when in practice some of these balances may already be in dispute, written off, or otherwise not simply collectible — this is a display/labeling concern, not a computation risk → Mitigation: label the figure clearly as "帳面欠款金額" (book-value owed amount) or similar in the UI, consistent with how the rest of the app already treats payment fields as raw recorded values rather than a settled ledger.
- [Risk] A stage with very high batch cardinality (67 for 一階) rendered as a horizontal bar chart could get visually crowded → Mitigation: same scrollable-container-with-height-cap pattern already used by `spirit-ambassador-hub`'s "各組人數" chart and `little-angel-hub`'s ranking chart (fixed max-height, internal scroll, `Math.min(Math.max(count * rowHeight, min), max)` height calculation) — no new pattern needed, directly reuse the existing one.

## Migration Plan

No database schema changes — this is entirely new read-only code (one new page, one new client component, one additive export from an existing utility file). No migration to run, no rollback complexity: reverting the code change fully removes the feature with no lingering state.
