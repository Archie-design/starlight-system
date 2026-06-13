## Why

學員管理頁目前有「表格」「組織圖」兩種檢視。組織圖呈現**上下線（介紹人鏈）的縱向關係**，但營運上還想看**橫向關係**：各階同期一起上課的同學、以及同一心之使者組別的組員。這些橫向連結對「同期揪團續報」「心之使者組內經營」很有價值，縱向樹狀的組織圖表達不出來。

## What Changes

- 學員管理頁新增第三種檢視「**關聯圖**」（與「表格」「組織圖」並列）。
- 關聯圖以**選定一位學員為中心**，向外放射展開兩種橫向關聯：
  - **各階同期同學**：與中心在某一階、同一梯次（如一階 83 梯）一起上課的人
  - **同一心之使者組員**：與中心 `spirit_ambassador_group` 相同的人
- 同期判定**解析課程值「階-梯次」**（如 `1-83`），排除無梯次的值（「待確認梯次」「正取」「五運」）。
- 點關聯圖上的節點可切換成新的中心，重新展開其關係網。
- 以 `@xyflow/react`（react-flow）繪製；節點即 React 元件，重用既有角色色標。
- 體系隔離：沿用既有 org 資料流（已依登入體系篩選），關聯只在同體系內計算。

## Capabilities

### New Capabilities
- `relationship-network`: 學員橫向關聯圖 —— 以選定學員為中心，視覺化其「各階同期同學」與「同心之使者組員」，可切換中心，依登入體系隔離。

### Modified Capabilities
<!-- 無既有 spec 需改 -->

## Impact

- **新依賴**：`@xyflow/react`（支援 React 19）。
- **檢視切換**：`store/useStudentStore.ts`（`view` 加 `'network'`）、`components/StudentGrid/Toolbar.tsx`（VIEWS 加「關聯圖」）、`app/students/StudentsClient.tsx`（渲染分支）。
- **資料**：`app/api/org/route.ts` select 補 `spirit_ambassador_group`；`lib/utils/buildTree.ts` 的 `OrgStudent` 型別補同欄位。重用 `hooks/useOrgData.ts`（已含全體系學員平面陣列），無需新 API。
- **新檔案**：`lib/utils/relations.ts`（關聯計算）、`components/RelationshipNetwork/`（視覺化元件）。
- **重用**：`lib/utils/courseUtils.ts` 的 `parseCourseValue()`、OrgChart 的 SearchBox 模式、`roleColor`。
- 無 DB schema 變更（全部用既有欄位）。
