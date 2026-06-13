## Why

學員表格目前只有 5 個篩選器（姓名、關懷員、地區、角色、有五階），全部是「單一欄位 = 某值」的查詢。但探索資料後發現，營運上真正想回答的問題幾乎都是**跨欄位的衍生條件**，而現有篩選做不到：

- **續報潛力**（上完 N 階、未上 N+1 階）：**2237 人**散落在續報漏斗中，無法一鍵篩出
- **待催欠款**（已排梯次卻欠款）：**340 人 / 約 950 萬**真實應收，目前看不到
- **會籍快到期 / 已過期**：232 已過期、18 個 30 天內到期，催續會無從篩起
- **本月新生**：53 人，onboarding 無法快速鎖定

`students` 表有 50 個欄位，含豐富的課程進度、會籍、心之使者、建檔時間維度，但篩選欄只用到其中 4 個。使用者被迫用 Excel 匯出後自行處理，或逐頁翻找。

## What Changes

新增兩個層次的篩選能力，並讓篩選結果可直接匯出：

- **基礎篩選維度（下拉/選項）**：
  - 「課程進度」——最高上到第幾階（未上課 / 1~5 階），取代陽春的「有五階」單一勾選
  - 「會籍狀態」——已過期 / 30 天內 / 90 天內 / 有效 / 無資料
  - 「心之使者」——是否為心之使者
  - 「本月新生」——近 30 天建檔
- **情境快捷視圖（一鍵套用跨欄位條件）**：
  - 「續報潛力」——上完某階、未上下一階
  - 「待催欠款」——已排具體梯次（非「待確認梯次」）但付款欄為金額（=欠款）
  - 「會籍快到期」——會籍 30 天內到期或已過期
  - 「本月新生」——近 30 天建檔
- **匯出篩選結果**：套用任一篩選/快捷視圖後，可匯出當下的名單（沿用既有 `/api/export`，擴充其支援的篩選參數）。
- 體系隔離不變：所有篩選仍在登入者的有效體系內運作（superadmin 依切換體系）。

## Capabilities

### New Capabilities
- `smart-filters`: 學員表格的進階篩選 —— 基礎維度（課程進度 / 會籍狀態 / 心之使者 / 新生）、跨欄位情境快捷視圖（續報 / 欠款 / 會籍 / 新生），以及篩選結果匯出。

### Modified Capabilities
<!-- 篩選與匯出目前未有 openspec spec，視為新建 capability -->

## Impact

- **Store**：`store/useStudentStore.ts` 的 `StudentFilters` 擴充（新增 courseStage / membershipStatus / isSpirit / 等欄位，或新增 `activeView` 快捷視圖狀態）。
- **篩選 UI**：`components/StudentGrid/FilterBar.tsx`（新增下拉 + 快捷視圖按鈕列）。
- **查詢層**：`lib/db/types.ts` 的 `StudentFilters`、`lib/db/supabaseRepository.ts` 的 `applyCommonFilters`（加入新條件），以及 `lib/db/mockRepository.ts` 同步。跨欄位條件（續報、欠款）需要在 repository 用 `.or()`/多重條件表達，或在 server 端後處理。
- **匯出**：`app/api/export/route.ts` 擴充支援新篩選參數；`components/StudentGrid/Toolbar.tsx` 匯出時帶上當前篩選。
- **資料判定**：續報＝`course_N` 有且 `course_{N+1}` 空；欠款＝`payment` 為純數字（探索已確認「金額＝還欠」）且 `course` 非「待確認梯次」；會籍＝`membership_expiry` 與今日比較。建議集中為共用的判定工具（如 `lib/utils/studentStatus.ts`）。
- 無 DB schema 變更（全部用既有欄位）。
