## Context

學員管理頁 view 切換（grid/org）走 `useStudentStore.view` → `StudentsClient` 條件渲染。組織圖（`components/OrgChart/`）為純 CSS 樹，資料來自 `useOrgData()`（org API + aliases + overrides，已依登入體系）。`useOrgData().students` 是全體系學員平面陣列，正是關聯圖所需。

課程值格式 `{階}-{梯次}-{狀態}`（如 `1-83-已上課`），`lib/utils/courseUtils.ts` 的 `parseCourseValue()` 可取 `{level, batch, status}`。`spirit_ambassador_group` 為 TEXT、62 組、值相等即同組。專案無圖形套件（組織圖純 CSS）。

## Goals / Non-Goals

**Goals:**
- 第三檢視「關聯圖」，以選定學員為中心，顯示同期同學 + 同組組員
- 同期 = 階+梯次相等（排除無梯次）；同組 = spirit group 相等
- 可點節點切換中心；兩類關聯視覺區分；體系隔離
- 重用既有資料流，最小化新查詢

**Non-Goals:**
- 不做「整體網絡圖」（一次畫全體系）——以中心放射為主，避免過載
- 不把「上下線」關係放進關聯圖（那是組織圖的職責）
- 不做關聯圖的匯出（本次聚焦視覺化）

## Decisions

### D1. 視覺化套件：`@xyflow/react`
- 支援 React 19 / Next 16；節點是 React 元件 → 可重用 `roleColor` 與卡片樣式。
- 替代方案：vis-network（非 React 原生）、自繪 SVG（力導向佈局自己寫成本高）。選 react-flow 最契合既有 React 元件生態。
- 佈局：不用力導向模擬，採**確定性放射佈局**（中心置中，同期同學在一側扇形、同組組員在另一側扇形，依數量均分角度）——可預測、效能好、無需模擬迴圈。

### D2. 重用 useOrgData，只補一個欄位
- 關聯圖用 `useOrgData().students`（已含全體系、依登入體系篩選）。
- org API select 補 `spirit_ambassador_group`；`OrgStudent` 型別補同欄位。其餘課程欄已在 select 內。
- 不新增 API、不新增 SWR；切換中心是純前端計算。

### D3. 關聯計算 `lib/utils/relations.ts`（純函式）
```
cohortKey(courseValue): string | null
  // parseCourseValue → batch 有值才回 `${level}-${batch}`，否則 null
buildRelations(students, centerId):
  center = students[centerId]
  // 同期：對中心每個 course_1..5，取 cohortKey；掃所有人同 key（排除自己）
  //       一個人可能多階同期 → 合併、記錄所有命中的階/梯 label
  // 同組：spirit_ambassador_group 非空且 == center → label = 組名
  回傳 { center, related: [{ student, types: {cohort?: string[], spirit?: string} }] }
```
- 同一人可能同時是同期又同組 → 用 `related` 聚合、節點上可標多重關係；邊以主要類型著色（或畫兩條邊）。design 採「一人一節點，邊依關係類型分色；若同時具兩種，畫兩條不同色邊」。

### D4. 元件結構 `components/RelationshipNetwork/`
- `index.tsx`：SearchBox（重用 OrgChart 模式）選中心 → `buildRelations` → 映射成 react-flow nodes/edges → `<ReactFlow>`。
- 節點：自訂 node 元件（姓名 + 角色色標 + 中心高亮）；onClick 設為新中心。
- 邊：cohort 一色、spirit 另色，`label` 顯示依據。
- 圖例、中心資訊列、空狀態。
- 需 `import '@xyflow/react/dist/style.css'`。

### D5. 效能 / 過載控制
- 大梯次（如 78 人）可能讓中心連出數十～上百節點。預設顯示全部，但：
  - 同期同學依「階」分群，節點過多時可摺疊某階（加 toggle）。
  - 設一個合理上限（如單類 > 60 提示「僅顯示前 N，請用搜尋縮小」），避免卡頓。
- 放射佈局以數量均分角度，半徑隨數量微調。

## Risks / Trade-offs

- [大梯次節點爆量] → 依階分群 + 上限提示（D5）；中心放射比全網絡可控。
- [一人多重關係的邊呈現] → 畫兩條不同色邊，或節點加雙色標記；以雙邊為主、清楚。
- [`@xyflow/react` bundle 體積] → 僅關聯圖該檢視才需要；考慮 dynamic import 避免拖累其他頁初載。
- [course 值殘缺（「正取」「待確認梯次」）] → cohortKey 回 null 自然排除，已驗證資料有 338 筆待確認。

## Open Questions

- 同期同學是否要進一步只取「同階且狀態=已上課」？目前納入同梯所有狀態（含候補）。先全納，未來可加篩選。
- 是否需要在關聯圖內直接顯示上下線（混合三種關係）？本次 Non-Goal，保持單純。
- 節點數上限的確切數字（60?）待實作時依實測手感調整。
