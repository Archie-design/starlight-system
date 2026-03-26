# 04 — 匯入 Pipeline（xlsx → DB）

## 兩步驟流程

```
[上傳 xlsx]
     ↓
POST /api/import          ← 第一步：解析 + 預覽
     ↓
     回傳 preview diffs（前 1000 筆）+ stats
     diff_snapshot（StudentInsert[]）存進 import_sessions
     ↓
[使用者確認]
     ↓
POST /api/import/apply    ← 第二步：執行寫入
     ↓
     從 diff_snapshot 取 importRows → buildGroupAssignments → upsert
```

---

## 第一步：`POST /api/import`

### 1. `parseXlsx.ts`

使用 ExcelJS 讀取 xlsx：

```ts
const rows = row.values.slice(1)  // ExcelJS row.values index 從 1 開始，slice(1) 後變 0-indexed
```

> ⚠️ **陷阱**：`get(col)` 內部是 `row[col - 1]`，因為 `DEFAULT_COL` 用 1-based，但 slice 後陣列是 0-indexed。

### 2. `transform.ts` — 欄位映射

**靜態映射**：`DEFAULT_COL`（1-based column index，對應最新 xlsx 格式）

```ts
export const DEFAULT_COL = {
  FULL_NAME: 1,    // 全名
  SYSTEM_ID: 2,    // 系統編號（學員的 PK）
  STUDENT_ID: 3,   // 學員編號
  ROLE: 4,
  GENDER: 6,
  PHONE: 10,
  // ... 共約 50 個欄位
}
```

**動態映射**：`HEADER_TO_COL_KEY`  
讀取 xlsx 標題列，若有匹配的中文標題則覆蓋 `DEFAULT_COL` 對應位置。用途是當來源檔 column 位置偏移時自動修正。

**學員 ID 解析**：
```ts
// id 優先從 SYSTEM_ID 欄位（col 2）取數字
// fallback：從 FULL_NAME 字串用 parseNameWithId() 解析
const id = rawSystemId ? Number(rawSystemId) : parsedId
```

**日期欄位**：統一用 `normalizeDate()` 處理，輸出 `YYYY-MM-DD` 字串。

**課程欄位**：用 `buildCourseValue(level, batch, status)` 和 `buildPaymentValue(payStatus, balance)` 組合成字串儲存。

### 3. `diff.ts` — 差異計算

- 查詢現有 DB 資料：用 500-ID chunks 分批 query，避免 IN clause 過長
- 比對每個欄位，輸出 `FieldDiff[]`
- **只回傳前 1000 筆 diffs** 給 UI preview

### 4. 儲存 session

```ts
// diff_snapshot 存 StudentInsert[]（完整資料，給 apply 用）
// preview diffs 直接回傳在 response body，不存 DB
await supabase.from('import_sessions').insert({
  diff_snapshot: importRows,  // StudentInsert[]
  ...stats
})
```

---

## 第二步：`POST /api/import/apply`

```ts
// 1. 從 diff_snapshot 取回 importRows
const { diff_snapshot: importRows } = session

// 2. 計算 group_leader
const groupAssignments = await buildGroupAssignments(importRows)

// 3. Upsert in batches of 100
for (const batch of chunks(importRows, 100)) {
  await supabase.from('students').upsert(batch.map(r => ({
    ...r,
    group_leader: groupAssignments[r.id] ?? null
  })))
}
```

---

## 新增 xlsx 欄位 SOP

1. 在 `lib/import/transform.ts` 的 `DEFAULT_COL` 加入 1-based 欄位索引
2. 在 `HEADER_TO_COL_KEY` 加入對應中文標題 → key 映射
3. 在 `transformSourceRow()` 的 return 物件加入該欄位（日期要用 `normalizeDate()`）
4. 在 `lib/supabase/types.ts` 的 `Student` interface 加入欄位
5. 建新 migration：`ALTER TABLE students ADD COLUMN IF NOT EXISTS ...`
6. 在 `components/StudentGrid/columns.tsx` 加入欄定義
7. 在 `components/StudentGrid/Toolbar.tsx` 和 `components/CounselorsLayout/index.tsx` 的 `COLUMN_GROUPS` 加入該欄
