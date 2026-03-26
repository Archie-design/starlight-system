# 06 — 前端狀態管理

## 架構概覽

```
Zustand stores       → UI 狀態（tab、filter、page、modal）
SWR hooks            → 伺服器資料抓取 + cache + optimistic update
useSearchParams      → URL filter sync（FilterBar.tsx）
```

---

## Zustand Stores

### `useStudentStore`（`store/useStudentStore.ts`）

管理 `/students` 頁面的所有 UI 狀態：

| 狀態 | 說明 |
|------|------|
| `activeTab` | 目前選取的分頁/系統 |
| `filters` | 篩選條件物件 |
| `page` | 目前分頁（0-indexed） |
| `isImportModalOpen` | 匯入精靈開關 |
| `isNewStudentModalOpen` | 新增學員 modal 開關 |
| `columnVisibility` | 欄位顯示/隱藏狀態 |
| `viewMode` | `'grid' \| 'org'`（表格或組織圖） |

**重要行為**：tab 或 filter 切換時，page 自動重置為 0。

### `useCounselorStore`（`store/useCounselorStore.ts`）

管理 `/counselors` 頁面的 UI 狀態：

| 狀態 | 說明 |
|------|------|
| `activeGroup` | 目前選取的顧問組 |
| `filters` | 篩選條件 |
| `page` | 分頁（group 或 filter 切換時重置為 0） |
| `columnVisibility` | 欄位顯示/隱藏 |

---

## SWR Hooks（`hooks/`）

### `useStudents`

```ts
// SWR key 包含 filters + page，自動 refetch 當 key 改變
// optimistic update: updateCell(studentId, field, value)
```

- anon key + Supabase JS client
- 500 行分頁
- cell 編輯：呼叫 PATCH API，同時 SWR optimistic update

### `useCounselorStudents`

同 `useStudents`，但查詢條件加上 `group_leader = activeGroup`。

### `useCounselorGroups`

```ts
// GET /api/counselor-groups
// revalidateOnFocus: false
export function useCounselorGroups() {
  const { data, isLoading, error, mutate } = useSWR<{ groups: CounselorGroup[] }>(
    '/api/counselor-groups', fetcher, { revalidateOnFocus: false }
  )
  return { groups: data?.groups ?? [], isLoading, error, mutate }
}
```

### `useOrgData`

- `GET /api/org`
- 回傳組織圖所需的樹狀結構
- 供 `OrgChart` component 使用

---

## URL Filter Sync

`FilterBar.tsx` 用 `useSearchParams` 讀取 URL query string，並在 filter 變更時更新 URL。  
這讓使用者可以直接分享帶篩選條件的連結。

---

## Server-side 驗證流程

每個受保護頁面的 `page.tsx`（Server Component）：

```ts
const { data: { session } } = await supabase.auth.getSession()
if (!session) redirect('/login')
```

Supabase Auth 使用 cookie-based session，server component 可直接讀取。
