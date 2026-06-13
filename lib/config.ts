/**
 * 部署設定（可因組織而異）。
 *
 * 複製此系統給新組織時，這些值透過環境變數設定，不需改程式碼。
 * 在 client 與 server 皆可使用（NEXT_PUBLIC_ 前綴）。
 */

/** 系統品牌名稱（顯示於標題列、登入頁、分頁標題、匯出檔作者等） */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || '星光超級表格系統'
