'use client'

import { useState } from 'react'
import { useGroupManagement } from '@/lib/hooks/useGroupManagement'
import { useAliasManagement } from '@/lib/hooks/useAliasManagement'
import { useOverrideManagement } from '@/lib/hooks/useOverrideManagement'
import { useBackfillProgress } from '@/lib/hooks/useBackfillProgress'
import { useModalDismiss } from '@/lib/hooks/useModalDismiss'

interface Props {
  onClose: () => void
}

export default function GroupManageModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'groups' | 'aliases' | 'overrides'>('groups')
  const groupMgmt = useGroupManagement()
  const aliasMgmt = useAliasManagement()
  const overrideMgmt = useOverrideManagement()
  const backfill = useBackfillProgress()
  const modalRef = useModalDismiss<HTMLDivElement>(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-manage-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-3 bg-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 id="group-manage-title" className="text-sm font-semibold">關懷系統設定</h2>
            <div className="flex bg-slate-700/50 p-0.5 rounded-lg border border-slate-600/50">
              <button
                onClick={() => setActiveTab('groups')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  activeTab === 'groups' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                分組管理
              </button>
              <button
                onClick={() => setActiveTab('aliases')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  activeTab === 'aliases' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                全脈代管
              </button>
              <button
                onClick={() => setActiveTab('overrides')}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  activeTab === 'overrides' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                白名單換線
              </button>
            </div>
          </div>
          <button onClick={onClose} aria-label="關閉" className="text-slate-300 hover:text-white text-lg leading-none transition-colors">✕</button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'groups' && (
            <div className="space-y-4">
              {/* 現有分組列表 */}
              <div className="space-y-2 mb-6">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">目前分組列表</p>
                {groupMgmt.groups.map((g, index) => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                    {groupMgmt.editId === g.id ? (
                      <>
                        <div className="flex-1 space-y-1">
                          <input
                            value={groupMgmt.editName}
                            onChange={e => groupMgmt.setEditName(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400"
                            placeholder="分組名稱"
                          />
                          <input
                            value={groupMgmt.editRoots}
                            onChange={e => groupMgmt.setEditRoots(e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800 placeholder:text-slate-400"
                            placeholder="根節點學員 ID（逗號分隔，例：3034, 2888）"
                          />
                        </div>
                        <button onClick={groupMgmt.handleUpdate} disabled={groupMgmt.saving} className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-bold shadow-sm">儲存</button>
                        <button onClick={() => groupMgmt.setEditId(null)} className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 font-medium">取消</button>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => groupMgmt.handleMove(index, 'up')}
                            disabled={index === 0 || groupMgmt.saving}
                            aria-label="向上移動"
                            className="p-0.5 text-slate-300 hover:text-blue-600 disabled:opacity-10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            onClick={() => groupMgmt.handleMove(index, 'down')}
                            disabled={index === groupMgmt.groups.length - 1 || groupMgmt.saving}
                            aria-label="向下移動"
                            className="p-0.5 text-slate-300 hover:text-blue-600 disabled:opacity-10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{g.name}</span>
                            <span className="text-[9px] px-1 bg-slate-200 text-slate-500 rounded font-mono">#{g.display_order}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">根節點: {g.root_student_ids.join(', ')}</div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => groupMgmt.startEdit(g)} className="text-[10px] text-slate-500 hover:text-blue-600 font-bold px-2 py-1 rounded bg-white border border-slate-200 shadow-sm">編輯</button>
                          <button onClick={() => groupMgmt.handleDeleteGroup(g.id, g.name)} className="text-[10px] text-slate-500 hover:text-red-500 font-bold px-2 py-1 rounded bg-white border border-slate-200 shadow-sm">刪除</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* 重新計算 */}
              <div className="border border-amber-200 bg-amber-50/30 rounded-xl p-4">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <span className="text-base">⚡</span> 批次重新計算歸屬
                </p>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">依介紹人鏈追溯，自動填入所有學員的所屬分組。初次建立或修改根節點後請執行一次。</p>
                <button
                  onClick={backfill.handleBackfill}
                  disabled={backfill.backfilling}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-40 transition-all shadow-sm active:scale-95"
                >
                  {backfill.backfilling ? '正在計算中...' : '開始重新執行計算'}
                </button>
                {backfill.backfillResult && (
                  <div className="mt-3 p-2 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
                    {backfill.backfillResult}
                  </div>
                )}
                {backfill.backfillProgress > 0 && (
                  <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full transition-all duration-200"
                      style={{ width: `${backfill.backfillProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* 新增分組表單 */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 mt-6">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">新增分組</p>
                <input
                  value={groupMgmt.newName}
                  onChange={e => groupMgmt.setNewName(e.target.value)}
                  placeholder="分組名稱（其餘同李雨珊）"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/30"
                />
                <input
                  value={groupMgmt.newRoots}
                  onChange={e => groupMgmt.setNewRoots(e.target.value)}
                  placeholder="根節點學員 ID（例如：3034）"
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/30"
                />
                <button
                  onClick={groupMgmt.handleCreateGroup}
                  disabled={groupMgmt.saving || !groupMgmt.newName.trim()}
                  className="w-full sm:w-auto px-6 py-2 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 transition-all shadow-sm"
                >
                  {groupMgmt.saving ? '儲存中...' : '確認新增分組'}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'aliases' && (
            <div className="space-y-6">
              {/* 代管列表 */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">目前代管對照表</p>
                {aliasMgmt.aliases && aliasMgmt.aliases.length > 0 ? (
                  aliasMgmt.aliases.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-200 group">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">原始 ID</span>
                          <span className="text-sm font-mono font-bold text-slate-700">{a.original_parent_id}</span>
                        </div>
                        <div className="text-slate-300 text-lg">→</div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">代理 ID</span>
                          <span className="text-sm font-mono font-bold text-blue-600">{a.proxy_parent_id}</span>
                        </div>
                        {a.note && <div className="ml-4 text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">{a.note}</div>}
                      </div>
                      <button onClick={() => aliasMgmt.handleDeleteAlias(a.id)} className="text-[10px] text-slate-400 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-all">移除</button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                    <p className="text-xs text-slate-400 italic">尚無代管設定</p>
                    <p className="text-[10px] text-blue-500 mt-1">↓ 使用下方表單新增第一筆代管關係</p>
                  </div>
                )}
              </div>

              {/* 新增代管表單 */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/20">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  新增上線代管關係
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">原始介紹人 ID</label>
                    <input
                      value={aliasMgmt.origId}
                      onChange={e => aliasMgmt.setOrigId(e.target.value)}
                      placeholder="例：7290"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">代理介紹人 ID</label>
                    <input
                      value={aliasMgmt.proxyId}
                      onChange={e => aliasMgmt.setProxyId(e.target.value)}
                      placeholder="例：10393"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">備註 (選填)</label>
                  <input
                    value={aliasMgmt.aliasNote}
                    onChange={e => aliasMgmt.setAliasNote(e.target.value)}
                    placeholder="例如：李雨珊不在星光時，劃給郭芷萱"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={aliasMgmt.handleCreateAlias}
                  disabled={aliasMgmt.saving || !aliasMgmt.origId || !aliasMgmt.proxyId}
                  className="w-full px-6 py-2.5 text-xs font-bold bg-slate-800 text-white rounded-md hover:bg-slate-900 active:scale-[0.98] disabled:opacity-40 transition-all shadow-md mt-2"
                >
                  確認建立代管
                </button>
              </div>
            </div>
          )}
          {activeTab === 'overrides' && (
            <div className="space-y-6">
              {/* 特定學員特例列表 */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">特定學員強制換線特例</p>
                {overrideMgmt.overrides && overrideMgmt.overrides.length > 0 ? (
                  overrideMgmt.overrides.map(o => (
                    <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-slate-200 group">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">學員 ({o.student_id})</span>
                          <span className="text-sm font-bold text-slate-700">{o.student_name}</span>
                        </div>
                        <div className="text-slate-300 text-lg">→</div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">新上線 ({o.override_parent_id})</span>
                          <span className="text-sm font-bold text-blue-600">{o.proxy_name}</span>
                        </div>

                        <div className="ml-4 flex-1">
                          {overrideMgmt.editingNoteId === o.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={overrideMgmt.editingNoteValue}
                                onChange={e => overrideMgmt.setEditingNoteValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && overrideMgmt.handleUpdateNote(o.id)}
                                onBlur={() => overrideMgmt.handleUpdateNote(o.id)}
                                className="w-full text-[10px] border border-blue-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <div
                              onClick={() => { overrideMgmt.setEditingNoteId(o.id); overrideMgmt.setEditingNoteValue(o.note || ''); }}
                              className="text-[10px] text-slate-400 bg-white px-2 py-1 rounded border border-slate-100 hover:border-blue-200 hover:text-slate-600 cursor-pointer min-w-[100px] transition-all italic"
                            >
                              {o.note || '點擊新增備註...'}
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => overrideMgmt.handleDeleteOverride(o.id)} className="text-[10px] text-slate-400 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-all">移除</button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                    <p className="text-xs text-slate-400 italic">尚無強制換線特例</p>
                    <p className="text-[10px] text-blue-500 mt-1">↓ 使用下方表單新增第一筆換線特例</p>
                  </div>
                )}
              </div>

              {/* 新增特例表單 */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-blue-50/20">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  新增白名單換線對象
                </p>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">先尋找原始上線 (獲得直屬名單)</label>
                  <input
                    value={overrideMgmt.overrideOrigId}
                    onChange={e => overrideMgmt.setOverrideOrigId(e.target.value)}
                    placeholder="輸入原始上線ID (如蕭琇方：4253)"
                    className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {overrideMgmt.overrideOrigId && (
                  <div className="mt-2 space-y-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none">🔍</span>
                      <input
                        type="text"
                        placeholder="搜尋下線姓名或 ID..."
                        value={overrideMgmt.downlineSearch}
                        onChange={e => overrideMgmt.setDownlineSearch(e.target.value)}
                        className="w-full border border-slate-200 rounded-md pl-6 pr-2 py-1.5 text-[11px] bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                      {overrideMgmt.downlines.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-bold text-slate-400 mb-2">請勾選要強制換線的學員 ({overrideMgmt.downlines.length}名)</p>
                          {overrideMgmt.downlines.map(s => (
                          <label key={s.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={overrideMgmt.selectedStudents.includes(s.id)}
                              onChange={() => {
                                overrideMgmt.setSelectedStudents(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])
                              }}
                              className="accent-blue-600 w-3.5 h-3.5"
                            />
                            <span className="font-mono text-slate-400 w-10">{s.id}</span>
                            <span className="font-medium">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-2">查無直屬下線資料</p>
                    )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">給予新代理上線 ID</label>
                    <input
                      value={overrideMgmt.overrideProxyId}
                      onChange={e => overrideMgmt.setOverrideProxyId(e.target.value)}
                      placeholder="例：4929"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono text-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">備註 (選填)</label>
                    <input
                      value={overrideMgmt.overrideNote}
                      onChange={e => overrideMgmt.setOverrideNote(e.target.value)}
                      placeholder="例如：游芳瑜特例"
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={overrideMgmt.handleCreateOverrides}
                  disabled={overrideMgmt.saving || !overrideMgmt.overrideProxyId || overrideMgmt.selectedStudents.length === 0}
                  className="w-full px-6 py-2.5 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 transition-all shadow-md mt-2"
                >
                  確認建立 {overrideMgmt.selectedStudents.length} 筆特例換線
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
