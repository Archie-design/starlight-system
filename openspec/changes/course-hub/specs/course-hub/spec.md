## Purpose

Lets counselors drill into course enrollment and payment status at a finer grain than the existing dashboard's system-wide summary charts — down to individual batches (梯次) and specific unpaid amounts — so they can see, for example, exactly who in a given batch still owes money, without having to scan the raw grid row by row.

## ADDED Requirements

### Requirement: 課程專區頁面
系統 SHALL 提供「課程專區」頁面（`/courses`），與儀表板 / 資料維護 / 關懷長專區 / 心之使者專區 / 小天使專區並列於各頁頂部導覽，且為受保護頁（未登入導向 `/login`、`must_change_password` 導向改密碼頁）。

#### Scenario: 進入課程專區
- **WHEN** 已登入使用者點選導覽「課程」
- **THEN** 開啟 `/courses`，顯示課程報名與完款狀況的彙總統計

#### Scenario: 導覽互連
- **WHEN** 在 students / dashboard / maintenance / counselors / spirit / little-angel 任一頁
- **THEN** 頂部導覽含可前往「課程」專區的連結；課程專區本身也含返回這些頁面的連結

### Requirement: 涵蓋範圍
課程專區 SHALL 涵蓋一階至五階（`course_1` ~ `course_5`）與五運班（`course_wuyun`）。特殊課程（生命數字、生命數字實戰班、生命蛻變、生生世世告別負債）MUST NOT 納入本專區的統計範圍。

#### Scenario: 特殊課程不出現在專區中
- **WHEN** 使用者瀏覽課程專區的任何統計或圖表
- **THEN** 特殊課程（生命數字系列、生命蛻變、告別負債）的資料不會出現在其中

### Requirement: 各階梯次分布
系統 SHALL 針對一階至五階中的任一階，顯示該階底下各梯次（依 `parseCourseValue()` 解析出的 batch）的人數分布。五運班因資料無梯次概念，MUST NOT 要求梯次層級分析，僅需人數與付款統計（見「五運班付款統計」需求）。

#### Scenario: 選定某一階顯示梯次分布
- **WHEN** 使用者在專區選定「一階」
- **THEN** 顯示一階底下所有梯次的人數長條圖，依人數或梯次排序

#### Scenario: 尚未排定梯次的報名者不計入梯次分布
- **WHEN** 某學員在該階的狀態解析為「待確認梯次」（無具體梯次編號）
- **THEN** 該學員不出現在梯次分布圖中，但計入該階的總報名人數

### Requirement: 欠款金額統計
系統 SHALL 顯示各階（含五運班）的欠款人數與欠款金額總和，欠款判定依付款欄位是否為純數字（代表尚欠的金額）。

#### Scenario: 顯示各階欠款總覽
- **WHEN** 使用者瀏覽課程專區
- **THEN** 顯示一階至五階與五運班各自的欠款人數與欠款金額加總

#### Scenario: 選定梯次顯示該梯次欠款金額
- **WHEN** 使用者選定某一階的特定梯次
- **THEN** 顯示該梯次內的欠款人數與欠款金額加總，範圍僅限該梯次內的學員

### Requirement: 五運班付款統計
系統 SHALL 顯示五運班的報名人數、完款人數、欠款人數與欠款金額，不要求梯次層級的細分。

#### Scenario: 五運班統計獨立顯示
- **WHEN** 使用者瀏覽課程專區
- **THEN** 五運班的統計以獨立區塊呈現，不與一階至五階的梯次分布圖混在一起

### Requirement: 選定階別或梯次檢視學員名單
使用者 SHALL 能點選任一階別或該階的特定梯次，檢視對應的學員名單，並可從名單連結至 `/students` 進一步操作。

#### Scenario: 點選階別看名單
- **WHEN** 使用者點選「一階」的統計項目
- **THEN** 顯示該階所有報名學員的名單（含姓名、梯次或狀態、付款狀態）

#### Scenario: 點選梯次看名單
- **WHEN** 使用者點選一階底下某個具體梯次
- **THEN** 顯示僅該梯次內的學員名單，不含同階其他梯次的學員

#### Scenario: 名單連結至學員管理
- **WHEN** 使用者在名單中點選某位學員
- **THEN** 導向 `/students` 並帶入該學員的搜尋條件，與既有心之使者專區、小天使專區的名單連結行為一致

### Requirement: 課後課完課狀況
系統 SHALL 針對一階至五階中的任一階，顯示該階課後課（`l{level}_makeup_{n}` 欄位）的完課狀況。統計母體為該階已上主課者（`course_N` 有值）；每堂課後課 SHALL 顯示出席率（出席人數/統計母體人數），並顯示所有堂數皆已出席的人數。各階課後課堂數不對稱（一階6堂、二階5堂、三/四階各3堂、五階1堂），系統 SHALL 依各階實際堂數呈現，不強求對齊。

#### Scenario: 顯示某階完課率
- **WHEN** 使用者選定「一階」
- **THEN** 顯示一階每一堂課後課的出席率，以及全部6堂皆已出席的人數，統計母體為已上一階主課的學員

#### Scenario: 展開查看某堂課的出席與缺席名單
- **WHEN** 使用者點選某一堂課後課的出席或缺席數字
- **THEN** 顯示對應的學員名單（出席者或缺席者），並可從名單連結至 `/students`

#### Scenario: 尚未上主課者不列入完課率統計
- **WHEN** 某學員尚未上該階主課（`course_N` 為空）
- **THEN** 該學員不計入該階完課率的統計母體，即使其課後課欄位可能有值

### Requirement: 聯誼會報名統計
系統 SHALL 顯示聯誼會報名人數與未報名人數，報名判定依「聯誼會加入日」欄位是否有值（比照既有「是否為心之使者」的判定模式）。系統 SHALL 顯示報名者的組別分布。聯誼會報名與課程階別為各自獨立的統計維度，不侷限於特定階別的報名者。

#### Scenario: 顯示聯誼會報名總覽
- **WHEN** 使用者瀏覽課程專區
- **THEN** 顯示本體系已報名聯誼會的人數、未報名人數，以及依組別的人數分布

#### Scenario: 查看已報名學員名單
- **WHEN** 使用者點選「已報名人數」
- **THEN** 顯示已報名聯誼會的學員名單，並可從名單連結至 `/students`

#### Scenario: 未分組的已報名學員
- **WHEN** 某學員已報名聯誼會（加入日有值）但組別欄位為空
- **THEN** 該學員計入已報名人數，並在組別分布中歸類為「未分組」，不遺漏亦不誤植入其他組別

### Requirement: 體系隔離
專區的所有統計、圖表與名單 SHALL 僅限登入者有效體系（admin 為其體系、superadmin 為其當前選擇），MUST NOT 跨體系計入。

#### Scenario: 太陽 admin 的專區
- **WHEN** 太陽 admin 開啟課程專區
- **THEN** 僅統計 `business_chain` 解析為太陽體系的學員課程與付款資料

#### Scenario: superadmin 切換體系
- **WHEN** superadmin 切換星光/太陽
- **THEN** 梯次分布、欠款統計、學員名單皆隨該體系重新計算
