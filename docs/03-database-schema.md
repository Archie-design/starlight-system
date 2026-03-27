# 03 — 資料庫 Schema 與型別定義

## Migrations（依序套用）

| 檔案 | 內容 |
|------|------|
| `001_schema.sql` | `students`、`import_sessions` 表 + RLS policies |
| `002_import_logs.sql` | `import_logs` 表 |
| `003_counselor_groups.sql` | `counselor_groups` 表 + `students.group_leader` 欄位 |
| `004_spirit_ambassador_fields.sql` | `spirit_ambassador_join_date`、`love_giving_start_date`、`spirit_ambassador_group`、`cumulative_seniority` |
| `005_edit_logs.sql` | `edit_logs` 表 |

套用方式：在 Supabase SQL Editor 依序貼入執行。

---

## Tables

### `students`

主學員資料表。完整欄位見 `lib/supabase/types.ts` 的 `Student` interface：

**基本資料**
- `id` (number, PK) — 系統編號（SYSTEM_ID，來自 xlsx 第 2 欄）
- `name`、`name_with_id`（computed）、`gender`、`role`、`sheet_system`（`'星光' | '太陽'`）

**聯絡**
- `phone`、`line_id`

**關係鏈**
- `introducer`、`counselor`、`senior_counselor`、`little_angel`、`dream_interpreter`
- `business_chain`（傳愛體系）、`guidance_chain`（輔導體系）、`region`
- `group_leader`（computed at apply，不從 xlsx 讀）

**課程資料**（格式：`buildCourseValue` / `buildPaymentValue` 組合）
- `course_1~5`、`payment_1~5`、`parent_1`
- `course_wuyun`、`payment_wuyun`
- `wuyun_a~f`（五運班出席）
- `life_numbers`、`life_numbers_advanced`、`life_transform`、`debt_release`

**心之使者**
- `spirit_ambassador_join_date`、`love_giving_start_date`、`spirit_ambassador_group`、`cumulative_seniority`

**其他**
- `membership_expiry`（ISO date string `YYYY-MM-DD`）
- `system_id`、`last_synced_at`、`created_at`、`updated_at`

---

### `import_sessions`

| 欄位 | 說明 |
|------|------|
| `id` | UUID |
| `filename` | 上傳的檔名 |
| `source_rows` | xlsx 原始列數 |
| `rows_updated/inserted/unchanged` | 統計 |
| `diff_snapshot` | **`StudentInsert[]`**（非 FieldDiff[]，給 apply 用）|
| `applied` | 是否已 apply |
| `applied_at` | apply 時間 |

> ⚠️ `diff_snapshot` 存的是完整的 `StudentInsert[]`，不是 diff 列表。UI 的 preview diff 是 upload 時算完直接回傳，**不存進 DB**。

---

### `import_logs`

每次 apply 後每筆欄位變更的紀錄。`change_type`: `'insert' | 'update'`

### `counselor_groups`

8 組輔導長定義。

| 欄位 | 說明 |
|------|------|
| `id` | UUID |
| `name` | 組名 |
| `display_order` | 排序 |
| `root_student_ids` | `number[]` — 該組的根節點學員 ID 陣列 |

### `edit_logs`

手動編輯紀錄，紀錄 `student_id`、`field`、`old_value`、`new_value`、時間戳。

---

## 核心 TypeScript 型別（`lib/supabase/types.ts`）

```ts
Student          // 完整 DB row（含 name_with_id computed field）
StudentInsert    // Omit<Student, 'name_with_id' | 'created_at' | 'updated_at' | 'group_leader'>
StudentUpdate    // Partial<StudentInsert>

ImportSession    // import_sessions row
ImportLog        // import_logs row
FieldDiff        // { id, name, field, old_value, new_value, change_type }
CounselorGroup   // counselor_groups row（root_student_ids: number[]）
ImportPreviewResult  // POST /api/import 的回傳型別
```

**`StudentInsert` 排除 `group_leader` 的原因**：group_leader 不從 xlsx 讀取，而是在 apply 時由 `buildGroupAssignments()` 動態計算。
