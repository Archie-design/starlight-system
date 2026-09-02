## Purpose

Lets counselors see the "little angel" (小天使) mentoring relationships across the student base as a coherent whole — who mentors whom, how deep the chains run, and where the underlying data is inconsistent — instead of piecing it together row by row from the main grid.

## ADDED Requirements

### Requirement: 小天使專區頁面
系統 SHALL 提供「小天使專區」頁面（`/little-angel`），與儀表板 / 資料維護 / 關懷長專區 / 心之使者專區並列於各頁頂部導覽，且為受保護頁（未登入導向 `/login`、`must_change_password` 導向改密碼頁）。

#### Scenario: 進入小天使專區
- **WHEN** 已登入使用者點選導覽「小天使」
- **THEN** 開啟 `/little-angel`，顯示小天使從屬關係的彙總統計

#### Scenario: 導覽互連
- **WHEN** 在 students / dashboard / maintenance / counselors / spirit 任一頁
- **THEN** 頂部導覽含可前往「小天使」專區的連結；小天使專區本身也含返回這些頁面的連結

### Requirement: 從屬關係定義與 KPI
小天使從屬關係定義為 `little_angel` 欄位非空的學員——該欄位值（格式 `"ID_姓名"`）指向其被指派的小天使。專區 SHALL 顯示 KPI 摘要：不重複小天使人數、被帶學員總人數、平均每位小天使帶人數、無小天使（`little_angel` 為空）人數。

#### Scenario: KPI 數字
- **WHEN** 開啟小天使專區
- **THEN** 顯示該體系內不重複小天使人數、`little_angel` 非空的學員總數、平均每位小天使帶人數（無帶人時該項計為 0）、`little_angel` 為空的學員人數

### Requirement: 小天使人數排行榜
專區 SHALL 以長條圖呈現各小天使所帶學員人數排行（依人數由高到低排序）。

#### Scenario: 排行榜圖
- **WHEN** 開啟專區
- **THEN** 顯示各小天使（依 `little_angel` 指向的 ID）帶的學員人數長條圖，由多到少排序

### Requirement: 從屬樹狀圖
系統 SHALL 支援以任一小天使為根節點，展開其完整從屬樹狀結構（含多層——一位小天使自己也可能被另一位小天使帶，形成鏈狀/樹狀關係）。使用者 SHALL 能從排行榜或搜尋選擇欲檢視的小天使。

#### Scenario: 選擇小天使展開樹狀圖
- **WHEN** 使用者在專區選擇一位有帶學員的小天使
- **THEN** 顯示以該小天使為根節點的樹狀結構，包含其直接與間接（多層）帶領的所有學員

#### Scenario: 單層小天使（無下線的下線）
- **WHEN** 選擇的小天使所帶學員都沒有再各自帶其他學員
- **THEN** 樹狀圖僅顯示一層子節點，不誤增不存在的層級

### Requirement: 搜尋任一學員查詢其所在脈絡
系統 SHALL 提供搜尋介面（比照既有組織圖的搜尋方式），讓使用者查詢**任一學員**（不限於排行榜上、本身是小天使的人）在小天使從屬關係中的完整位置，包含往上（誰的小天使帶了他）與往下（他自己帶了哪些學員）兩個方向。

#### Scenario: 搜尋一般學員查看其上線
- **WHEN** 使用者搜尋一位「被某小天使帶、但自己沒有再帶任何人」的學員
- **THEN** 顯示從頂層小天使一路到該學員的完整路徑（麵包屑），且往下沒有任何子節點

#### Scenario: 搜尋中間節點查看完整脈絡
- **WHEN** 使用者搜尋一位「自己被某小天使帶、同時自己也帶了其他學員」的學員
- **THEN** 同時顯示他的往上路徑（麵包屑）與往下的樹狀子節點

#### Scenario: 搜尋頂層或孤立學員
- **WHEN** 使用者搜尋一位沒有任何人帶他的學員（無論他是否有帶其他學員）
- **THEN** 明確標示此人無上線、為頂層，不誤顯示不存在的往上路徑

#### Scenario: 點選麵包屑切換查看對象
- **WHEN** 使用者在麵包屑路徑上點選非目前選定對象的節點
- **THEN** 切換為以該節點為查詢對象，重新顯示其對應的往上路徑與往下子節點

### Requirement: 循環引用防護
`little_angel` 欄位資料可能存在循環引用（例如某學員的 `little_angel` 指向自己，或兩名學員互相指向對方）。建構從屬樹狀結構時 SHALL 偵測並中止沿循環路徑繼續展開，MUST NOT 因循環導致頁面無回應、當機或無限迴圈。

#### Scenario: 自我指向
- **WHEN** 某學員的 `little_angel` 解析出的 ID 等於自己的 ID
- **THEN** 樹狀圖建構在該節點處停止展開，不將自己列為自己的下線，且此案例被記錄供資料品質提醒使用

#### Scenario: 雙向互指
- **WHEN** 學員 A 的 `little_angel` 指向學員 B，且學員 B 的 `little_angel` 也指向學員 A
- **THEN** 無論從 A 或 B 何者為根節點展開樹狀圖，系統偵測到重複造訪同一節點時停止該路徑的展開，不產生無限層級，且此案例被記錄供資料品質提醒使用

### Requirement: 體系與地理位置分布圖
專區 SHALL 顯示小天使從屬關係在星光／太陽兩體系的分布概況，並顯示依地理位置（縣市，沿用 `county` 欄位）的分布概況。

#### Scenario: 體系分布
- **WHEN** 使用者身分為 superadmin 且可檢視跨體系彙總（或分別查看各體系）
- **THEN** 顯示星光／太陽各自的小天使人數與被帶人數統計

#### Scenario: 地區分布
- **WHEN** 開啟專區
- **THEN** 顯示依 `county`（縣市）分組的小天使或被帶學員人數分布；`county` 為空者歸類為「未填寫」，不遺漏亦不誤植入其他縣市

### Requirement: 資料品質提醒
專區 SHALL 自動列出小天使從屬資料的待處理項，至少包含：循環引用（自我指向、雙向互指等）案例、`little_angel` 指向的 ID 在資料庫中不存在的案例。

#### Scenario: 列出循環引用
- **WHEN** 資料中存在循環引用的 `little_angel` 關係
- **THEN** 專區的資料品質區塊列出涉及的學員 ID 與姓名，供人工核對修正

#### Scenario: 列出無效指向
- **WHEN** 某學員的 `little_angel` 解析出的 ID 在目前體系（或全體系）內查無對應學員
- **THEN** 專區的資料品質區塊列出該學員與其填寫的無效 `little_angel` 值

### Requirement: 體系隔離
專區的所有統計與圖表 SHALL 僅限登入者有效體系（admin 為其體系、superadmin 為其當前選擇），MUST NOT 跨體系計入，與既有心之使者專區、學員管理頁面的體系隔離規則一致。

#### Scenario: 太陽 admin 的專區
- **WHEN** 太陽 admin 開啟小天使專區
- **THEN** 僅統計 `business_chain` 解析為太陽體系的學員與其小天使從屬關係

#### Scenario: superadmin 切換體系
- **WHEN** superadmin 切換星光/太陽
- **THEN** KPI、排行榜、樹狀圖選項、地區分布圖皆隨該體系重新計算
