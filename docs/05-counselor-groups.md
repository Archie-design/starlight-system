# 05 — 愛心顧問群組指派

## 概念

每個學員有一個 `group_leader` 欄位，代表他屬於哪個愛心顧問組。  
這個值**不從 xlsx 讀取**，而是在 `POST /api/import/apply` 時由 `buildGroupAssignments()` 動態計算。

---

## `buildGroupAssignments()`（`lib/import/assignGroup.ts`）

### 演算法

對每個學員，沿人際關係鏈向上追溯，直到找到 `counselor_groups` 中某組的 `root_student_ids` 為止：

```
優先：counselor 欄位鏈
         ↓（若找不到）
Fallback：introducer 欄位鏈
         ↓（找到 root_student_id）
         → 指派對應 group 的 name 為 group_leader
```

- **最多追溯 25 跳**，超過視為無法指派
- 欄位格式為 `"ID_姓名"`，用 `parseNameWithId()`（`lib/utils/nameUtils.ts`）解析出 ID 數字

### 8 組根節點

定義在 `supabase/migrations/003_counselor_groups.sql`，可透過 Supabase dashboard 查看 `counselor_groups` 表的 `root_student_ids` 欄位。

---

## Backfill

當群組根節點變更、或有大量學員 `group_leader` 需重算時，呼叫：

```
POST /api/counselor-groups/backfill
```

實作分頁每次 1000 筆，繞過 Supabase 預設 query limit，直到處理完所有學員。

---

## Group 管理（UI）

`components/CounselorsLayout/GroupManageModal.tsx`  
提供新增/編輯/刪除群組，以及設定 `root_student_ids` 的介面。

對應 API：
- `GET/POST /api/counselor-groups`
- `PATCH/DELETE /api/counselor-groups/[id]`
