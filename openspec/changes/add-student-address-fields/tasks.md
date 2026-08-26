## 1. Database

- [x] 1.1 Create `supabase/migrations/017_student_address_fields.sql` adding `county TEXT`, `district TEXT`, `address TEXT` (nullable, `IF NOT EXISTS`) to `students`, and verify the file follows the existing migration style (see e.g. `008_birthday_field.sql`)

## 2. Types

- [x] 2.1 Add `county`, `district`, `address` (all `string | null`) to the `Student` interface in `lib/supabase/types.ts` and verify `StudentInsert`/`StudentUpdate` pick these up automatically via the existing `Omit`/`Partial` derivation
- [x] 2.2 Run `npx tsc --noEmit` and confirm no errors before proceeding (fields not yet referenced anywhere else)

## 3. Import pipeline

- [x] 3.1 Add `COUNTY: 13`, `DISTRICT: 14`, `ADDRESS: 15` to `DEFAULT_COL` in `lib/import/transform.ts` (fallback indices matching the sample file's actual positions)
- [x] 3.2 Add `"縣市/州/省": "COUNTY"`, `"地區": "DISTRICT"`, `"地址": "ADDRESS"` to `HEADER_TO_COL_KEY` and verify none of these header strings collide with an existing key (cross-check against the current map)
- [x] 3.3 Add `county`, `district`, `address` fields to the returned object in `transformSourceRow()` (plain string mapping, same pattern as `little_angel`/`dream_interpreter` — no date normalization needed)
- [x] 3.4 Verify against the real sample file: parse `reference/學員資料庫 20260606.xlsx` with the updated import code (e.g. via a throwaway script calling `parseSourceXlsx`) and confirm several sample rows' county/district/address match what's visible in the spreadsheet, including at least one row where one of the three cells is blank

## 4. Grid columns and column-visibility settings

- [x] 4.1 Add three column definitions to `components/StudentGrid/columns.tsx`: `county` ("縣市"), `district` ("地區（地址）"), `address` ("地址"), each `editable(..., { filterable: 'text' })`, matching the existing pattern for other free-text columns
- [x] 4.2 Add a new `"地理位置"` group to `COLUMN_GROUPS` in `lib/constants/index.ts` containing the three new column ids, and verify the group renders in the column-settings panel (shared by all three grids)
- [x] 4.3 Set `county: false, district: false, address: false` in the initial `columnVisibility` state of `useStudentStore` (`store/useStudentStore.ts`) so the columns are hidden on first load
- [x] 4.4 Do the same for `useCounselorStore` (`store/useCounselorStore.ts`)
- [x] 4.5 Do the same for `useMaintenanceStore` (`store/useMaintenanceStore.ts`)
- [ ] 4.6 Verify in the browser (after migration is applied) that all three grids (`/students`, `/counselors`, `/maintenance`) load with the new columns hidden by default, and that toggling them on/off in the column-settings panel works and the label reads "地區（地址）" distinctly from the existing "地區" column

## 5. Export

- [x] 5.1 Add `'縣市', '地區（地址）', '地址'` to the `HEADERS` array in `lib/export/buildXlsx.ts`, positioned near the other organizational/location fields
- [x] 5.2 Add `s.county, s.district, s.address` to the corresponding row in `studentToRow()`, matching header order exactly
- [x] 5.3 Verify by exporting an xlsx (via the existing export flow or `buildStudentsXlsx()` directly against sample data) and confirming the new columns appear with correct header labels and values, including for a student with `null` values in these fields

## 6. Final verification

- [x] 6.1 Run `npx tsc --noEmit` and confirm no errors
- [x] 6.2 Confirm the existing `region`/"地區" column (organizational) is unaffected — same header text in `HEADER_TO_COL_KEY`, same displayed label, same values before and after this change, verified by reviewing the diff touches no `region`-related code
- [x] 6.3 Manually re-import `reference/學員資料庫 20260606.xlsx` end-to-end (preview + apply) in a non-production environment and confirm county/district/address are populated for imported students without affecting any other field's values (superseded by a newer sample file `學員資料庫 20260826 (1).xlsx` provided later — see note below)
