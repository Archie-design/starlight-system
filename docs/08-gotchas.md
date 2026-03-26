# 08 — 已知陷阱與注意事項

## 1. `diff_snapshot` 存的是 `StudentInsert[]` 不是 `FieldDiff[]`

```ts
// ✅ 正確理解
diff_snapshot: StudentInsert[]  // 完整學員資料，給 apply 步驟用

// ❌ 錯誤理解
diff_snapshot: FieldDiff[]  // 這只存在 response body，不存 DB
```

UI 的 preview diff（`FieldDiff[]`）是在 upload 時計算完直接回傳，**不存進資料庫**。

---

## 2. ExcelJS row.values 的 index 陷阱

```ts
const row = row.values.slice(1)  // ExcelJS 原始 Array 從 index 1 開始，slice(1) 後變 0-indexed

// transform.ts 的 get() helper：
const get = (col: number) => row[col - 1]  // col 是 1-based（DEFAULT_COL 的值），所以要 -1
```

---

## 3. Turbopack 不能用

Next.js 16 的 Turbopack 在含中文字元的路徑下有 bug，必須用：

```bash
npm run dev  # ← 確認 package.json 裡是 "next dev"，不是 "next dev --turbopack"
```

---

## 4. `group_leader` 不從 xlsx 讀取

`StudentInsert` 型別刻意排除 `group_leader`：

```ts
type StudentInsert = Omit<Student, 'name_with_id' | 'created_at' | 'updated_at' | 'group_leader'>
```

`group_leader` 在 `apply` 時由 `buildGroupAssignments()` 計算，不應從 xlsx 欄位賦值。

---

## 5. Supabase 查詢預設 limit 1000 筆

任何需要全表遍歷的操作（如 backfill）都要分頁：

```ts
// ✅ 正確做法（backfill endpoint）
let page = 0
while (true) {
  const { data } = await supabase
    .from('students')
    .select('...')
    .range(page * 1000, (page + 1) * 1000 - 1)

  if (!data?.length) break
  // process...
  page++
}
```

---

## 6. `name_with_id` 是 DB computed column

不需要在 insert/update 時提供，Supabase 自動計算。

---

## 7. Service role key 只能在 server-side 用

```ts
// ✅ OK：在 /api/* route 中
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// ❌ 絕對不可以用在 'use client' 的元件或 hooks
```

---

## 8. Diff 比對用 500-ID chunks

```ts
// 避免 SQL IN clause 過長導致 query 失敗
const chunks = chunkArray(allIds, 500)
for (const chunk of chunks) {
  const { data } = await supabase.from('students').select('*').in('id', chunk)
}
```
