# 07 — Components 目錄

## `StudentGrid`（`components/StudentGrid/`）

主學員管理表格（`/students` 使用）。

| 檔案 | 功能 |
|------|------|
| `index.tsx` | 主容器，整合表格邏輯、分頁、modal |
| `columns.tsx` | 欄位定義（使用 TanStack Table 格式），每欄含 header、render 邏輯 |
| `EditableCell.tsx` | 可編輯 cell，double-click 進入編輯，blur/Enter 送出 |
| `FilterBar.tsx` | 搜尋與篩選列，同步 URL query string |
| `Toolbar.tsx` | 工具列，含 `COLUMN_GROUPS`（欄位分組顯示切換）、匯入/匯出/新增按鈕 |

---

## `CounselorsLayout`（`components/CounselorsLayout/`）

愛心顧問視圖（`/counselors` 使用）。

| 檔案 | 功能 |
|------|------|
| `index.tsx` | 主容器，群組選擇 sidebar + 學員表格，含 `COLUMN_GROUPS` |
| `CounselorStudentGrid.tsx` | 顧問用的學員表格（精簡版欄位） |
| `GroupManageModal.tsx` | 新增/編輯/刪除顧問群組，設定 `root_student_ids` |

---

## `OrgChart`（`components/OrgChart/`）

組織圖視圖（`viewMode = 'org'` 時顯示）。  
使用 `useOrgData` 取得樹狀資料，hover tooltip 顯示學員課程資訊。

---

## `ImportWizard`（`components/ImportWizard/`）

多步驟匯入精靈：

1. 上傳 xlsx 檔
2. 顯示 preview diff（有哪些欄位將被更新/新增）
3. 確認後呼叫 `POST /api/import/apply`

---

## `NewStudentModal`（`components/NewStudentModal/`）

新增單一學員的 Modal，使用 `StudentForm` 作為表單基礎。

---

## `StudentForm`（`components/StudentForm/`）

學員資料表單元件，供 `NewStudentModal` 和編輯使用。

---

## 新增欄位到 UI 的步驟

1. `columns.tsx`：加入欄位定義（含 `accessorKey`、`header`、`cell`）
2. `Toolbar.tsx` → `COLUMN_GROUPS`：決定欄位歸屬哪個分組
3. `CounselorsLayout/index.tsx` → `COLUMN_GROUPS`：顧問視圖是否也顯示
