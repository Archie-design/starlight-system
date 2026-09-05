# spirit-ambassador-hub Specification

## Purpose
提供心之使者專區（`/spirit`），彙總各體系心之使者的 KPI、圖表與分組總表，並支援管理層級直接在分組總表上調整分組、標記小隊長與補課狀態，取代原本仰賴 Excel/Google 表單手動維護分組名冊的做法。

## Requirements
### Requirement: 心之使者專區頁面

系統 SHALL 提供「心之使者專區」頁面（`/spirit`），與儀表板 / 資料維護 / 關懷長專區並列於各頁頂部導覽，且為受保護頁（未登入導向 /login、`must_change_password` 導向改密碼頁）。

#### Scenario: 進入心之使者專區
- **WHEN** 已登入使用者點選導覽「心之使者」
- **THEN** 開啟 `/spirit`，顯示心之使者的彙總統計

#### Scenario: 導覽互連
- **WHEN** 在 students / dashboard / maintenance / counselors 任一頁
- **THEN** 頂部導覽含可前往「心之使者」專區的連結

### Requirement: 心之使者判定與 KPI

心之使者定義為 `spirit_ambassador_join_date` 非空者。專區 SHALL 顯示 KPI 摘要：心之使者總數、組別數、平均累積年資、無組別人數。

#### Scenario: KPI 數字
- **WHEN** 開啟心之使者專區
- **THEN** 顯示該體系心之使者總數、不重複組別數、平均年資（由累積年資換算）、有加入日但無組別的人數

### Requirement: 累積年資解析

系統 SHALL 將累積年資文字「X 年 Y 個月」解析為總月數以供統計。無法解析者不計入年資相關統計。

#### Scenario: 解析年資
- **WHEN** 累積年資為「1 年 6 個月」
- **THEN** 解析為 18 個月

#### Scenario: 無年資資料
- **WHEN** 累積年資為空或格式不符
- **THEN** 不計入平均年資與年資分佈，並可被資料品質提醒列出

### Requirement: 統計長條圖

專區 SHALL 以長條圖呈現：各組人數、年資分佈（分桶 <1年 / 1-2年 / 2-3年 / 3-5年 / 5年+）、各組平均年資。

#### Scenario: 各組人數圖
- **WHEN** 開啟專區
- **THEN** 顯示各心之使者組別的人數長條（依人數排序）

#### Scenario: 年資分佈圖
- **WHEN** 開啟專區
- **THEN** 顯示各年資桶的人數長條

#### Scenario: 各組平均年資圖
- **WHEN** 開啟專區
- **THEN** 顯示各組的平均年資長條

### Requirement: 資料品質提醒

專區 SHALL 自動列出心之使者資料的待處理項，至少包含：有加入日但無組別、無累積年資、單人小組（組內僅 1 人）。

#### Scenario: 列出待修項
- **WHEN** 有心之使者缺組別或缺年資、或某組僅 1 人
- **THEN** 專區的資料品質區塊列出各類項目與其數量/對象

### Requirement: 體系隔離

專區的心之使者與所有統計 SHALL 僅限登入者有效體系（admin 為其體系、superadmin 為其當前選擇），MUST NOT 跨體系計入。體系判定依 `guidance_chain`（關懷脈/輔導體系），與全站其餘頁面一致。

#### Scenario: 太陽 admin 的專區
- **WHEN** 太陽 admin 開啟心之使者專區
- **THEN** 僅統計 `guidance_chain='太陽'` 的心之使者

#### Scenario: superadmin 切換體系
- **WHEN** superadmin 切換星光/太陽
- **THEN** KPI、所有圖表與分組總表隨該體系重新計算

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

### Requirement: 分組總表資料來源獨立於學員

系統 SHALL 提供獨立於 `students` 表的分組實體（記錄組名與所屬體系），分組總表 SHALL 依此實體決定顯示哪些組別欄位，而非僅依「目前是否有學員持有該組名」反推。目前無任何組員的組別（空組別）SHALL 仍出現在分組總表中，呈現為一個沒有組員列的空欄位。

#### Scenario: 空組別在重新整理後仍然存在
- **WHEN** 管理者新增一個目前無任何成員的組別，並重新整理頁面
- **THEN** 該組別欄位仍出現在分組總表中，顯示為空欄位（無組員列）

#### Scenario: 既有組別上線後不因新機制而消失
- **WHEN** 系統上線本次變更前，資料庫中已存在若干由學員資料反推得出的分組（例如「星光1」～「星光30」）
- **THEN** 上線後這些組別全部仍出現在分組總表中，顯示內容與上線前一致

### Requirement: 拖曳搬移組員

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色可將分組總表中的任一組員，拖曳到另一個屬於同一有效體系的分組欄位，放開後系統 SHALL 立即將該學員的 `spirit_ambassador_group` 更新為目標分組，無需額外確認步驟即生效。`system_admin` MUST 僅能對其有效體系內的學員與分組執行此操作，跨體系嘗試 MUST 被拒絕。一般 `admin` 角色與非登入者 MUST NOT 能執行此操作。

#### Scenario: 成功將組員拖曳到另一組
- **WHEN** superadmin 或 system_admin 將某組員從「星光3」拖曳並放開到「星光5」欄位
- **THEN** 系統將該學員的 `spirit_ambassador_group` 更新為「星光5」，分組總表重新整理後該學員出現在「星光5」欄位、不再出現在「星光3」

#### Scenario: 一般 admin 無法拖曳搬移組員
- **WHEN** 一般 `admin` 角色嘗試呼叫拖曳搬移對應的更新 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

#### Scenario: system_admin 跨體系拖曳被拒絕
- **WHEN** 太陽體系的 system_admin 嘗試透過 API 將一位星光體系學員的分組改為星光體系的某個分組
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 新增組別

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色在分組總表新增一個目前無任何組員的空組別。新組別的名稱 SHALL 由系統依「星光N」或「太陽N」格式（依操作者的有效體系）自動產生，取該體系目前已存在分組中最大編號加一，MUST NOT 開放使用者自訂組別名稱。一般 `admin` 角色 MUST NOT 能執行此操作。

#### Scenario: 新增組別自動編號
- **WHEN** superadmin 或 system_admin 在星光體系（目前已存在「星光1」～「星光30」）點選新增組別
- **THEN** 系統建立一個名為「星光31」的空組別，並出現在分組總表末端

#### Scenario: 一般 admin 無法新增組別
- **WHEN** 一般 `admin` 角色嘗試呼叫新增組別的 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 刪除組別

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色刪除一個目前沒有任何組員的分組。若該分組仍有至少一位組員，系統 MUST 拒絕刪除。一般 `admin` 角色 MUST NOT 能執行此操作。

#### Scenario: 成功刪除空組別
- **WHEN** superadmin 或 system_admin 對一個目前沒有任何組員的分組執行刪除
- **THEN** 系統刪除該分組，分組總表重新整理後不再顯示該欄位

#### Scenario: 拒絕刪除非空組別
- **WHEN** superadmin 或 system_admin 嘗試刪除一個仍有組員的分組
- **THEN** 系統拒絕該請求，資料庫狀態不變，並提示需先將組員移出該分組

#### Scenario: 一般 admin 無法刪除組別
- **WHEN** 一般 `admin` 角色嘗試呼叫刪除組別的 API
- **THEN** 系統拒絕該請求（401），資料庫狀態不變

### Requirement: 分組異動對照表匯出

系統 SHALL 追蹤使用者在當前頁面工作階段中透過拖曳實際變更過分組的學員，並提供介面讓使用者將這份異動清單（而非完整分組總表）匯出為可下載的檔案，供管理者依此清單逐筆至其他系統（無法批次匯入、僅能手動編輯的外部系統）手動同步對應人員的分組——匯出內容 SHALL 僅包含姓名、原分組、目前分組三欄，MUST NOT 包含未曾異動的學員，避免管理者需要自行比對完整名單找出變更之處。同一位學員在同一工作階段中被多次拖曳者，SHALL 僅呈現一筆記錄，其「原分組」為該學員進入頁面時的初始分組、「目前分組」為最新分組；若學員最終被拖回其初始分組，該學員 MUST NOT 出現在異動清單中。頁面重新整理（含 `router.refresh()` 觸發的重新整理）後，異動追蹤 SHALL 重新歸零，不與重新整理前的紀錄累加。若當前工作階段尚無任何異動，匯出入口 SHALL 停用或提示「尚無異動」。

#### Scenario: 匯出僅含本次異動的對照表
- **WHEN** 使用者在本次頁面工作階段中將學員甲從「星光3」拖曳到「星光5」、學員乙從「星光10」拖曳到「星光12」，其餘學員未異動，點選匯出
- **THEN** 系統下載一份僅含兩筆記錄的對照表：學員甲（原分組星光3、目前分組星光5）、學員乙（原分組星光10、目前分組星光12），未列出其餘未異動的學員

#### Scenario: 同一人多次拖曳僅呈現最終結果一筆
- **WHEN** 學員甲在本次工作階段中先被拖曳到「星光5」，之後又被拖曳到「星光8」
- **THEN** 匯出的對照表中學員甲僅出現一筆，原分組為其進入頁面時的初始分組、目前分組為「星光8」

#### Scenario: 拖回原分組視為無異動
- **WHEN** 學員甲從「星光3」被拖曳到「星光5」，之後又被拖曳回「星光3」
- **THEN** 學員甲不出現在異動對照表中

#### Scenario: 尚無異動時匯出入口停用
- **WHEN** 使用者進入分組總表後尚未進行任何拖曳操作
- **THEN** 匯出入口呈停用狀態或點選後提示「尚無異動」，不產生空白或無意義的下載檔案

#### Scenario: 重新整理後異動紀錄歸零
- **WHEN** 使用者完成若干筆拖曳後重新整理頁面
- **THEN** 系統重新載入的分組總表不再保留先前工作階段的異動紀錄，需重新開始追蹤

### Requirement: 匯入不得覆蓋分組手動異動

匯入套用（將 xlsx 資料寫入 `students` 表）時，`spirit_ambassador_group` 欄位 MUST NOT 直接以 xlsx 內容覆蓋資料庫現有值。若某學員的 xlsx 分組值與資料庫現有值不一致，系統 SHALL 保留資料庫現有值不變，並依「分組匯入衝突偵測」需求記錄一筆待處理衝突。若 xlsx 分組值與資料庫現有值相同、或 xlsx 未提供分組值，系統 SHALL 正常維持現有值，不視為衝突。

#### Scenario: 匯入不覆蓋已透過拖曳異動的分組
- **WHEN** 某學員先前已被拖曳搬移至「星光5」（資料庫現有值為「星光5」），管理者匯入一批 xlsx，其中該學員的分組欄位值為「星光3」
- **THEN** 套用後該學員的 `spirit_ambassador_group` 仍為「星光5」，不被 xlsx 的「星光3」覆蓋

#### Scenario: xlsx 分組值與現有值相同時不觸發衝突
- **WHEN** 某學員的 xlsx 分組值與資料庫現有值皆為「星光5」
- **THEN** 套用後該學員的分組維持「星光5」，不產生任何衝突記錄

### Requirement: 分組匯入衝突偵測

匯入套用時，若偵測到某學員的 xlsx 分組值與資料庫現有值不一致，系統 SHALL 記錄一筆待處理的分組衝突，包含該學員、資料庫現有值、xlsx 候選值、發生時間。xlsx 分組值即使是目前系統尚未登記的全新組別名稱，仍 SHALL 視為衝突，系統 MUST NOT 因此自動建立該組別。同一位學員 SHALL 至多同時存在一筆待處理衝突——若該學員已有一筆待處理衝突，本次匯入的新分組值 SHALL 取代既有衝突記錄中的 xlsx 候選值，資料庫現有值欄位維持不變，不新增第二筆衝突記錄。

#### Scenario: 產生新的分組衝突記錄
- **WHEN** 某學員先前沒有待處理衝突，匯入套用時偵測到其 xlsx 分組值與資料庫現有值不一致
- **THEN** 系統新增一筆待處理衝突記錄，包含該學員、資料庫現有值、xlsx 候選值

#### Scenario: xlsx 分組值為系統未知組名時仍視為衝突
- **WHEN** 某學員的 xlsx 分組值為目前系統尚未存在的組別名稱
- **THEN** 系統記錄一筆待處理衝突，且 MUST NOT 自動將該組別名稱新增為系統的分組

#### Scenario: 已有待處理衝突時，新匯入值取代候選值
- **WHEN** 某學員已存在一筆待處理衝突（資料庫現有值 A、xlsx 候選值 B），管理者尚未處理，此時又匯入一批新的 xlsx，其中該學員的分組值為 C（C 與 A 不同）
- **THEN** 系統更新既有衝突記錄的 xlsx 候選值為 C，資料庫現有值仍為 A，該學員仍只有一筆待處理衝突

### Requirement: 分組衝突處理

系統 SHALL 提供介面，讓 `superadmin` 或 `system_admin` 角色檢視所有待處理的分組衝突，並對每一筆衝突擇一保留：保留資料庫現有值，或改採 xlsx 候選值。選擇改採 xlsx 候選值時，系統 SHALL 將該學員的 `spirit_ambassador_group` 更新為該候選值。無論選擇何者，處理完成後該衝突記錄 SHALL 標記為已解決並保留歷史紀錄，不再出現於待處理清單。此操作 MUST 要求呼叫者確認後才生效，`system_admin` MUST 僅能處理其有效體系內學員的衝突，跨體系嘗試 MUST 被拒絕。一般 `admin` 角色 MUST NOT 能執行此操作。

#### Scenario: 選擇保留資料庫現有值
- **WHEN** superadmin 或 system_admin 對一筆待處理衝突選擇「保留現有值」
- **THEN** 該學員的 `spirit_ambassador_group` 不變，該筆衝突記錄標記為已解決，不再出現於待處理清單

#### Scenario: 選擇改採 xlsx 候選值
- **WHEN** superadmin 或 system_admin 對一筆待處理衝突選擇「改採 xlsx 值」
- **THEN** 該學員的 `spirit_ambassador_group` 更新為該筆衝突記錄的 xlsx 候選值，該筆衝突記錄標記為已解決，不再出現於待處理清單

#### Scenario: 一般 admin 無法處理分組衝突
- **WHEN** 一般 `admin` 角色嘗試呼叫分組衝突處理的 API
- **THEN** 系統拒絕該請求（401），衝突記錄與學員資料狀態皆不變

#### Scenario: system_admin 跨體系處理衝突被拒絕
- **WHEN** 太陽體系的 system_admin 嘗試處理一筆星光體系學員的分組衝突
- **THEN** 系統拒絕該請求（401），衝突記錄與學員資料狀態皆不變

### Requirement: 分組總表衝突警示標示

分組總表中，存在待處理分組衝突的學員格子 SHALL 顯示資料庫現有值（不顯示 xlsx 候選值），並附加視覺警示標示，提示該學員有待處理的分組衝突需要管理者至衝突清單處理。

#### Scenario: 有待處理衝突的學員顯示警示標示
- **WHEN** 某學員存在一筆待處理的分組衝突
- **THEN** 該學員在分組總表對應欄位的格子顯示警示標示，且顯示的分組仍為資料庫現有值

#### Scenario: 衝突解決後警示標示消失
- **WHEN** 某學員原有的待處理衝突被管理者處理完成（無論保留何者）
- **THEN** 該學員在分組總表中不再顯示警示標示
