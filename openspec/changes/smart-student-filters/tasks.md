## 1. 判定邏輯（共用工具）

- [x] 1.1 新增 `lib/utils/studentStatus.ts`：`highestStage`、`membershipStatus`、`isResubscribeCandidate`、`owesPayment`、`isNewbie` 純函式
- [x] 1.2 欄位語意對齊探索結論（付款數字=還欠、課程「待確認梯次」=未排課），加註解與單元可測性

## 2. 型別與 Store

- [x] 2.1 `lib/db/types.ts`：`StudentFilters` 擴充 courseStage / membershipStatus / isSpirit / isNewbie / view
- [x] 2.2 `store/useStudentStore.ts`：同步擴充 filters 與 setter；快捷視圖 view 互斥邏輯（套用/取消）；變更時 page 歸 0
- [x] 2.3 確認 SWR cache key（`useStudents`）納入所有新 filter 欄位與 view

## 3. 查詢層

- [x] 3.1 `lib/db/supabaseRepository.ts`：`applyCommonFilters` 加入可下推的單欄位條件（courseStage / membershipStatus / isSpirit / isNewbie）
- [x] 3.2 跨欄位 view（resubscribe / owing）：repository 改為「取體系全量 → 用 studentStatus 過濾 → slice 分頁 + 正確 count」
- [x] 3.3 `lib/db/mockRepository.ts`：同步所有新條件與 view 過濾邏輯
- [x] 3.4 維持 `applySystemFilter` 套用於所有路徑（體系隔離不破）

## 4. 篩選 UI

- [x] 4.1 `components/StudentGrid/FilterBar.tsx`：新增「課程進度」「會籍狀態」下拉；以「課程進度」取代或並存舊「有五階」
- [x] 4.2 FilterBar 新增快捷視圖按鈕列（續報潛力 / 待催欠款 / 會籍快到期 / 本月新生），active 高亮、再點取消
- [x] 4.3 文案區隔「課程進度（靜態）」與「續報潛力（跨階衍生）」避免混淆

## 5. 匯出

- [x] 5.1 `app/api/export/route.ts`：擴充接受完整篩選集合（含 view），server 重跑 studentStatus 過濾，維持 session 體系
- [x] 5.2 `components/StudentGrid/Toolbar.tsx`：匯出時帶上當前 filters + view

## 6. 驗證

- [x] 6.1 `npx tsc --noEmit` + `npm run build` 通過
- [x] 6.2 課程進度/會籍/心之使者/新生 各篩出正確子集（對照探索數據：未上課72、上到5階531、會籍過期232、心之使者388、新生53）
- [x] 6.3 續報潛力 ≈ 2237、待催欠款 ≈ 340（已排梯次欠款）符合探索
- [x] 6.4 太陽 admin 套用各視圖只見太陽資料；superadmin 切體系結果隨之變
- [x] 6.5 套用視圖後匯出，xlsx 內容 = 畫面所見、且僅本體系
