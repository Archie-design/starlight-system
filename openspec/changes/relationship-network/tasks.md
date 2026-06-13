## 1. 套件與檢視切換

- [x] 1.1 `npm install @xyflow/react`
- [x] 1.2 `store/useStudentStore.ts`：`view` 型別加入 `'network'`
- [x] 1.3 `components/StudentGrid/Toolbar.tsx`：VIEWS 加 `{ key: 'network', label: '關聯圖' }`
- [x] 1.4 `app/students/StudentsClient.tsx`：`view === 'network'` 渲染 `<RelationshipNetwork />`（建議 dynamic import）

## 2. 資料層

- [x] 2.1 `app/api/org/route.ts`：select 補上 `spirit_ambassador_group`
- [x] 2.2 `lib/utils/buildTree.ts`：`OrgStudent` 型別補 `spirit_ambassador_group?: string | null`
- [x] 2.3 確認 `useOrgData().students` 內含 course_1~5 與 spirit_ambassador_group

## 3. 關聯計算

- [x] 3.1 新增 `lib/utils/relations.ts`：`cohortKey(courseValue)`（用 parseCourseValue，無 batch 回 null）
- [x] 3.2 `buildRelations(students, centerId)`：算同期同學（任一階同 cohortKey、記錄階/梯 label）+ 同組組員（spirit group 相等），回傳聚合結構
- [x] 3.3 排除自己；一人多重關係聚合；無關聯時回空

## 4. 視覺化元件

- [x] 4.1 `components/RelationshipNetwork/index.tsx`：SearchBox 選中心（重用 OrgChart 模式）
- [x] 4.2 buildRelations → react-flow nodes/edges；確定性放射佈局（同期/同組分扇形）
- [~] 4.3 自訂節點元件：姓名 + 中心高亮；點節點切換中心（角色色標暫略，保持節點簡潔，後續可加）
- [x] 4.4 邊分色（同期 vs 同組）+ label（如「一階 83 梯」「容容組」）；一人雙關係畫雙邊
- [x] 4.5 圖例 + 中心資訊列 + 空狀態 + 未選中心提示
- [x] 4.6 大量節點控制：依階分群可摺疊 / 上限提示（D5）
- [x] 4.7 `import '@xyflow/react/dist/style.css'`

## 5. 體系隔離

- [x] 5.1 確認資料來自 useOrgData（已依登入體系）；superadmin 切體系時關聯圖隨之變

## 6. 驗證

- [x] 6.1 `npx tsc --noEmit` + `npm run build` 通過
- [x] 6.2 選有梯次的中心 → 同期同學與同組組員正確、邊 label/顏色正確
- [x] 6.3 選「待確認梯次」且無心之使者組者 → 顯示空狀態
- [x] 6.4 點關聯節點 → 中心切換、重繪
- [x] 6.5 太陽 admin 關聯圖僅含太陽學員；superadmin 切體系隨之變
- [x] 6.6 資料抽樣：挑梯次（如 1-83 約 78 人）核對同期數量合理
