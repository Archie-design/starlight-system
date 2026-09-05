## ADDED Requirements

### Requirement: 分組總表

心之使者專區最上方 SHALL 顯示「分組總表」：以網格呈現目前有效體系內的所有分組，每組一欄、組員垂直排列。組內排序：`spirit_ambassador_is_leader` 為 `true` 者 SHALL 優先置頂；其餘組員依累積年資由高到低排序；若某組沒有任何人被標記小隊長，排序退回「累積年資最長者置頂」作為 fallback。各欄 SHALL 以自動換行（不寫死列數）方式排列，MUST NOT 要求橫向捲動才能看到全部分組。分組欄位 SHALL 依資料庫實際分組動態產生，不得寫死固定欄數——`spirit_ambassador_group` 值符合「星光N」或「太陽N」格式者依 N 由小到大排序在前，非此格式的組別名稱接續排在後面。完全未分組者（`spirit_ambassador_group` 為空）MUST NOT 出現在分組總表的任何欄位格子中，且 MUST NOT 另外呈現未分組名單——未分組統計已由既有的「有加入日但無組別」資料品質提醒涵蓋正式心之使者的部分，這次新增的分組總表僅聚焦已分組成員的呈現。

#### Scenario: 依實際分組動態產生總表欄位
- **WHEN** 目前有效體系內共有 29 個「星光N」格式分組與 1 個非數字命名分組（例如「小兔組」）
- **THEN** 總表依序顯示星光1~星光29共29欄，「小兔組」接續顯示在第30欄，欄數與順序完全依當下資料庫內容計算，不受任何寫死清單限制

#### Scenario: 新增或移除分組後總表自動反映
- **WHEN** 資料庫中新增一個「星光30」分組並有成員加入
- **THEN** 總表無需修改程式碼即顯示新增的「星光30」欄

#### Scenario: 分組數量多時自動換行呈現
- **WHEN** 目前有效體系內的分組數量多（例如星光體系實測 30 組）
- **THEN** 各組欄位依可視寬度自動換行排列成多行，使用者不需要橫向捲動即可看到全部分組

#### Scenario: 未分組者完全不出現在分組總表區塊
- **WHEN** 某學員的 `spirit_ambassador_group` 為空（不論是否已是心之使者）
- **THEN** 該學員不出現在分組總表的任何欄位格子中，分組總表區塊也不另外呈現未分組名單或清單

#### Scenario: 已標記小隊長者優先置頂
- **WHEN** 某組有一位成員的 `spirit_ambassador_is_leader` 為 `true`，該成員的累積年資並非全組最長
- **THEN** 該成員仍排在該組欄位的第一位，不因年資較短而排到其他成員之後

#### Scenario: 未標記小隊長時退回年資排序
- **WHEN** 某組所有成員的 `spirit_ambassador_is_leader` 皆非 `true`
- **THEN** 該組排序退回既有規則：依累積年資由高到低排序，年資最長者置頂

### Requirement: 補課狀態標示

系統 SHALL 提供 `spirit_ambassador_makeup_completed`（布林，可為空）欄位，記錄該學員是否已完成心之使者補課。此欄位與「是否為心之使者」（`spirit_ambassador_join_date` 是否有值）為獨立判定，不互相影響——`spirit_ambassador_makeup_completed` MUST NOT 用於推斷或覆蓋 `spirit_ambassador_join_date` 的值，反之亦然。分組總表中，`spirit_ambassador_makeup_completed !== true` 且已分組者的格子 SHALL 以淺綠底標示，其餘格子維持預設樣式。

#### Scenario: 已分組但未完成補課者標示為綠底
- **WHEN** 某學員 `spirit_ambassador_group` 有值、`spirit_ambassador_makeup_completed` 為 `false` 或 `null`、且 `spirit_ambassador_join_date` 為空
- **THEN** 該學員在分組總表對應欄位的格子顯示為淺綠底，且不因此被計入「心之使者總數」等既有 KPI（因為 `join_date` 仍為空）

#### Scenario: 已完成補課者不再標示為綠底
- **WHEN** 某學員的 `spirit_ambassador_makeup_completed` 為 `true`
- **THEN** 該學員在分組總表對應欄位的格子維持預設樣式，不論其 `spirit_ambassador_join_date` 是否已補上

### Requirement: 補課狀態編輯

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色可雙向切換某學員的 `spirit_ambassador_makeup_completed`（標記為 `true`，或改回 `false`）——編輯入口 MUST NOT 只在其中一個方向可用，避免操作後無法復原。此操作 MUST 要求呼叫者確認後才生效，`system_admin` MUST 僅能修改其有效體系內的學員，跨體系嘗試 MUST 被拒絕。一般 `admin` 角色 MUST NOT 能執行此操作。此編輯入口 SHALL 僅對「尚未是正式心之使者」（`spirit_ambassador_join_date` 為空）的已分組學員顯示，已轉正者不提供編輯入口。

#### Scenario: 管理層級標記完成補課
- **WHEN** superadmin 或 system_admin 在分組總表點選某位已分組未完課學員的補課標記
- **THEN** 系統要求確認，確認後將該學員的 `spirit_ambassador_makeup_completed` 更新為 `true`，該學員在總表中不再顯示綠底

#### Scenario: 管理層級將已標記完成者改回未完成
- **WHEN** superadmin 或 system_admin 對一位 `spirit_ambassador_makeup_completed` 已為 `true`、但 `spirit_ambassador_join_date` 仍為空的已分組學員，點選其補課狀態的編輯入口
- **THEN** 系統要求確認，確認後將該學員的 `spirit_ambassador_makeup_completed` 更新為 `false`，該學員在總表中重新顯示綠底

#### Scenario: 一般 admin 無法標記
- **WHEN** 一般 `admin` 角色嘗試呼叫補課狀態更新的 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

#### Scenario: system_admin 跨體系嘗試被拒絕
- **WHEN** 太陽體系的 system_admin 嘗試標記一位星光體系學員的補課狀態
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 小隊長標示

系統 SHALL 提供 `spirit_ambassador_is_leader`（布林，可為空）欄位，記錄該學員是否為所屬分組的小隊長。此欄位為任命制標記，MUST NOT 由系統依累積年資或其他資料自動推斷或覆蓋。分組總表中，`spirit_ambassador_is_leader` 為 `true` 的格子 SHALL 以獨立於補課狀態綠底的視覺樣式標示（例如紅底、粗體、徽章），且此樣式 SHALL 優先於補課狀態的綠底顯示。

#### Scenario: 小隊長格子的視覺標示
- **WHEN** 某學員的 `spirit_ambassador_is_leader` 為 `true`
- **THEN** 該學員在分組總表對應欄位的格子以小隊長專屬樣式顯示（不論其補課狀態或是否已是正式心之使者）

#### Scenario: 小隊長樣式優先於補課狀態綠底
- **WHEN** 某學員同時符合「小隊長」與「已分組但尚未完成補課」兩個條件
- **THEN** 格子顯示小隊長樣式，不顯示補課狀態的淺綠底

### Requirement: 小隊長標記編輯

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色可雙向切換某學員的 `spirit_ambassador_is_leader`（標記為 `true`，或改回 `false`／一般組員）——編輯入口 MUST NOT 只在其中一個方向可用。標記某學員為小隊長時，若該學員所屬分組（`spirit_ambassador_group`）已有其他成員的 `spirit_ambassador_is_leader` 為 `true`，系統 SHALL 自動將該組其餘成員的標記改回 `false`，確保任一分組同一時間最多僅有一位小隊長。取消標記（改回一般組員）MUST NOT 影響同組其他成員的標記。此操作 MUST 要求呼叫者確認後才生效，`system_admin` MUST 僅能修改其有效體系內的學員，跨體系嘗試 MUST 被拒絕。一般 `admin` 角色 MUST NOT 能執行此操作。

#### Scenario: 標記新小隊長時自動降級同組舊小隊長
- **WHEN** superadmin 或 system_admin 將某學員標記為小隊長，且該學員所屬分組已有另一位成員的 `spirit_ambassador_is_leader` 為 `true`
- **THEN** 系統將舊小隊長的 `spirit_ambassador_is_leader` 改回 `false`，並將新指定的學員設為 `true`，該分組最終僅有一位小隊長

#### Scenario: 取消小隊長標記不影響同組其他人
- **WHEN** superadmin 或 system_admin 將現任小隊長的標記改回一般組員
- **THEN** 系統將該學員的 `spirit_ambassador_is_leader` 更新為 `false`，同組其他成員的標記不受影響（該組暫時無人被標記為小隊長，排序退回年資 fallback）

#### Scenario: 一般 admin 無法標記小隊長
- **WHEN** 一般 `admin` 角色嘗試呼叫小隊長標記更新的 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

#### Scenario: system_admin 跨體系標記小隊長被拒絕
- **WHEN** 太陽體系的 system_admin 嘗試標記一位星光體系學員為小隊長
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

## MODIFIED Requirements

### Requirement: 體系隔離

專區的心之使者與所有統計 SHALL 僅限登入者有效體系（admin 為其體系、superadmin 為其當前選擇），MUST NOT 跨體系計入。體系判定依 `guidance_chain`（關懷脈/輔導體系），與全站其餘頁面一致。

#### Scenario: 太陽 admin 的專區
- **WHEN** 太陽 admin 開啟心之使者專區
- **THEN** 僅統計 `guidance_chain='太陽'` 的心之使者

#### Scenario: superadmin 切換體系
- **WHEN** superadmin 切換星光/太陽
- **THEN** KPI、所有圖表與分組總表隨該體系重新計算
