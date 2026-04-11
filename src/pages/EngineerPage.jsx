import { useState, useEffect } from 'react'
import { sb } from '../supabase'

const SKILLS = [
  { id: 's1', name: 'Thiết kế & Chế tạo 3D', icon: '📐' },
  { id: 's2', name: 'Thiết kế mạch, làm mạch', icon: '🔌' },
  { id: 's3', name: 'Lắp ráp & Hoàn thiện', icon: '🔧' },
  { id: 's4', name: 'Lập trình nhúng', icon: '💻' },
  { id: 's5', name: 'Kỹ năng quản trị', icon: '📋' },
  { id: 's6', name: 'Kỹ năng đặc biệt', icon: '⭐' },
]

export default function EngineerPage({ user, onLogout }) {
  const [tab, setTab] = useState('profile')
  const [record, setRecord] = useState(null)
  const [projects, setProjects] = useState([])
  const [period, setPeriod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editIdx, setEditIdx] = useState(-1)
  const [form, setForm] = useState({ projectId: '', skills: {}, notes: '' })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    // Load period
    const today = new Date().toISOString().split('T')[0]
    const { data: p } = await sb.from('evaluation_periods')
      .select('*').eq('status', 'open')
      .lte('start_date', today).gte('end_date', today).single()
    setPeriod(p)

    // Load projects
    const { data: proj } = await sb.from('projects').select('*, users!owner_id(name)').eq('status', 'active')
    setProjects(proj || [])

    // Load record
    const { data: rec } = await sb.from('records')
      .select('*').eq('engineer_id', user.id)
      .order('created_at', { ascending: false }).limit(1).single()

    if (!rec) {
      const { data: newRec } = await sb.from('records').insert({
        engineer_id: user.id,
        period_id: p?.id || null,
        state: 'draft', months: [], appeals: []
      }).select().single()
      setRecord(newRec)
    } else {
      setRecord(rec)
    }
    setLoading(false)
  }

  async function saveMonth() {
    if (!form.projectId) { alert('Chọn dự án!'); return }
    const months = [...(record?.months || [])]
    const entry = {
      projectId: form.projectId,
      projectName: projects.find(p => p.id === form.projectId)?.name || '',
      skills: form.skills,
      notes: form.notes,
      createdAt: new Date().toLocaleString('vi-VN'),
    }
    if (editIdx >= 0) months[editIdx] = entry
    else months.push(entry)

    const { data } = await sb.from('records')
      .update({ months, updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single()
    setRecord(data)
    setShowModal(false)
    setForm({ projectId: '', skills: {}, notes: '' })
    setEditIdx(-1)
  }

  async function submitToLead() {
    if (!record?.months?.length) { alert('Thêm ít nhất 1 thành tích!'); return }
    if (!period) { alert('Chưa đến đợt xét level!'); return }
    if (!confirm('Gửi hồ sơ cho Lead xác nhận?')) return
    const { data } = await sb.from('records')
      .update({ state: 'submitted', submission: { submittedAt: new Date().toLocaleString('vi-VN') }, updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single()
    setRecord(data)
  }

  async function acceptScore() {
    if (!confirm('Xác nhận đồng ý kết quả?')) return
    const { data } = await sb.from('records')
      .update({ state: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single()
    setRecord(data)
  }

  async function submitAppeal(reason) {
    const appeals = [...(record?.appeals || [])]
    appeals.push({ round: Math.floor(appeals.length / 2) + 1, from: 'A', text: reason, at: new Date().toLocaleString('vi-VN') })
    const { data } = await sb.from('records')
      .update({ state: 'appealed', appeals, updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single()
    setRecord(data)
  }

  function openAdd() {
    setEditIdx(-1)
    setForm({ projectId: '', skills: {}, notes: '' })
    setShowModal(true)
  }

  function openEdit(idx) {
    const m = record.months[idx]
    setEditIdx(idx)
    setForm({ projectId: m.projectId, skills: m.skills || {}, notes: m.notes || '' })
    setShowModal(true)
  }

  async function deleteMonth(idx) {
    if (!confirm('Xóa thành tích này?')) return
    const months = [...record.months]
    months.splice(idx, 1)
    const { data } = await sb.from('records')
      .update({ months, updated_at: new Date().toISOString() })
      .eq('id', record.id).select().single()
    setRecord(data)
  }

  const canEdit = record?.state === 'draft' || record?.state === 'returned'
  const canSubmit = canEdit && !!period

  const STATE_LABELS = {
    draft: { label: 'Bản nháp', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    submitted: { label: 'Chờ Lead xác nhận', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    returned: { label: 'Lead trả về', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
    approved_b: { label: 'Lead đã duyệt', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    scored: { label: 'Có kết quả chấm', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    appealed: { label: 'Đang kháng cáo', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
    accepted: { label: 'Đã đồng ý', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
    completed: { label: 'Hoàn tất ✓', color: 'bg-green-500/10 text-green-400 border-green-500/30' },
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Đang tải...</div>

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-5 border-b border-gray-800">
          <span className="text-white font-bold text-lg">◈ LevelUp</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'profile', icon: '📄', label: 'Hồ sơ của tôi' },
            { id: 'scoring', icon: '⭐', label: 'Kết quả chấm', dot: record?.state === 'scored' },
            { id: 'appeals', icon: '📢', label: 'Kháng cáo' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{t.icon}</span><span className="flex-1 text-left">{t.label}</span>
              {t.dot && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center font-bold text-sm">A</div>
            <div>
              <div className="text-white text-sm font-semibold">{user.name}</div>
              <div className="text-gray-500 text-xs">Kỹ Sư · Lv {user.current_level ?? 0}</div>
            </div>
          </div>
          <button onClick={async () => { await sb.auth.signOut(); onLogout() }}
            className="w-full text-gray-500 hover:text-red-400 text-xs py-2 border border-gray-800 hover:border-red-500/30 rounded-lg transition">
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-56 flex-1 p-8">
        {/* TAB: Hồ sơ */}
        {tab === 'profile' && (
          <div>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Hồ sơ thành tích</h2>
                <p className="text-gray-500 text-sm mt-1">Nhập thành tích theo dự án → Gửi Lead xác nhận</p>
              </div>
              <div className="flex items-center gap-3">
                {record?.state && (
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATE_LABELS[record.state]?.color}`}>
                    {STATE_LABELS[record.state]?.label}
                  </span>
                )}
                {canEdit && (
                  <button onClick={openAdd}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                    + Thêm thành tích
                  </button>
                )}
              </div>
            </div>

            {/* Pipeline */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex items-center gap-2 overflow-x-auto">
              {['A nhập hồ sơ', 'B xác nhận', 'C chấm điểm', 'A duyệt kết quả', 'Hoàn tất'].map((step, i) => (
                <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                  <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                  <span className={`text-xs ${i === 0 ? 'text-yellow-400 font-semibold' : 'text-gray-600'}`}>{step}</span>
                  {i < 4 && <span className="text-gray-700 text-xs">→</span>}
                </div>
              ))}
            </div>

            {/* Thông báo ngoài đợt */}
            {!period && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm px-4 py-3 rounded-lg mb-4">
                ⏳ Hiện không trong đợt xét level. Bạn có thể điền thành tích trước nhưng chưa gửi được. Đợt tiếp theo: 1/7/2026
              </div>
            )}

            {/* Thông báo bị trả về */}
            {record?.state === 'returned' && record?.lead_action?.reason && (
              <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm px-4 py-3 rounded-lg mb-4">
                <strong>🔄 Lead trả về:</strong> {record.lead_action.reason}
              </div>
            )}

            {/* Danh sách thành tích */}
            {!record?.months?.length ? (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">📄</div>
                <p>Chưa có thành tích nào. Nhấn "+ Thêm thành tích" để bắt đầu.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {record.months.map((m, idx) => (
                  <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition">
                    <div className="flex items-center justify-between px-5 py-4 bg-gray-800/50 border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-semibold">🗂 {m.projectName}</span>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(idx)} className="text-gray-400 hover:text-white text-sm px-3 py-1 border border-gray-700 hover:border-gray-500 rounded-lg transition">✏ Sửa</button>
                          <button onClick={() => deleteMonth(idx)} className="text-gray-400 hover:text-red-400 text-sm px-3 py-1 border border-gray-700 hover:border-red-500/30 rounded-lg transition">🗑</button>
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      {SKILLS.map(s => {
                        const sk = m.skills?.[s.id]
                        if (!sk?.note) return null
                        return (
                          <div key={s.id} className="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
                            <span className="text-gray-500 text-sm w-48 shrink-0">{s.icon} {s.name}</span>
                            <span className="text-gray-300 text-sm">{sk.note}</span>
                          </div>
                        )
                      })}
                      {m.notes && <p className="text-gray-500 text-sm mt-3 italic">📝 {m.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Submit dock */}
            {canEdit && record?.months?.length > 0 && (
              <div className="fixed bottom-6 right-8 bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 flex items-center gap-4 shadow-2xl">
                <span className="text-gray-400 text-sm"><strong className="text-white">{record.months.length} thành tích</strong> sẵn sàng gửi</span>
                <button onClick={submitToLead} disabled={!canSubmit}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-sm px-5 py-2 rounded-lg transition">
                  Gửi cho Lead →
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: Kết quả chấm */}
        {tab === 'scoring' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Kết quả chấm điểm</h2>
            {!record?.scoring ? (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">⭐</div>
                <p>Chưa có kết quả. Hội Đồng sẽ gửi sau khi Lead duyệt hồ sơ.</p>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 bg-gray-800/50 border-b border-gray-800">
                  <div>
                    <div className="text-white font-bold text-lg">Kết quả chấm điểm chính thức</div>
                    <div className="text-gray-500 text-sm mt-1">{record.scoring.scoredAt}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${record.scoring.decision === 'pass' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                      {record.scoring.decision === 'pass' ? '✅ ĐẠT' : '❌ KHÔNG ĐẠT'}
                    </span>
                    <span className="text-sm text-gray-400 border border-gray-700 px-3 py-1 rounded-full">Level đề xuất: {record.scoring.proposedLevel}</span>
                  </div>
                </div>
                <div className="px-6 py-5">
                  {SKILLS.map(s => {
                    const sc = record.scoring.skillScores?.[s.id]
                    if (!sc) return null
                    return (
                      <div key={s.id} className="flex items-center gap-4 py-3 border-b border-gray-800/50 last:border-0">
                        <span className="text-gray-400 text-sm w-52">{s.icon} {s.name}</span>
                        <span className={`font-bold font-mono ${parseFloat(sc.score) >= 2.5 ? 'text-green-400' : parseFloat(sc.score) >= 1.5 ? 'text-yellow-400' : 'text-red-400'}`}>{sc.score}</span>
                        {sc.note && <span className="text-gray-500 text-sm italic">{sc.note}</span>}
                      </div>
                    )
                  })}
                  {record.scoring.comment && (
                    <div className="mt-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm px-4 py-3 rounded-lg">
                      💬 {record.scoring.comment}
                    </div>
                  )}
                  {record.state === 'scored' && (
                    <div className="flex gap-3 mt-6">
                      <button onClick={acceptScore}
                        className="bg-green-600 hover:bg-green-500 text-white font-semibold px-5 py-2.5 rounded-lg transition">
                        ✅ Đồng ý kết quả
                      </button>
                      <button onClick={() => {
                        const reason = prompt('Lý do kháng cáo:')
                        if (reason) submitAppeal(reason)
                      }}
                        className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/30 font-semibold px-5 py-2.5 rounded-lg transition">
                        📢 Kháng cáo
                      </button>
                    </div>
                  )}
                  {record.state === 'completed' && (
                    <div className="mt-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
                      🎉 Hoàn tất! Level mới: <strong>{record.scoring.finalLevel}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: Kháng cáo */}
        {tab === 'appeals' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Lịch sử kháng cáo</h2>
            {!record?.appeals?.length ? (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">📢</div>
                <p>Chưa có kháng cáo nào.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {record.appeals.map((a, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`font-semibold text-sm ${a.from === 'A' ? 'text-violet-400' : 'text-orange-400'}`}>
                        {a.from === 'A' ? '👨‍💻 Kỹ Sư' : '🏛 Hội Đồng'} — Vòng {a.round}
                      </span>
                      <span className="text-gray-600 text-xs">{a.at}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{a.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal thêm thành tích */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h3 className="text-white font-bold text-lg">{editIdx >= 0 ? 'Sửa thành tích' : 'Thêm thành tích'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 hover:border-gray-500 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Chọn dự án */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Dự án</label>
                <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                  <option value="">— Chọn dự án —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Chủ: {p.users?.name || '?'})</option>
                  ))}
                </select>
              </div>

              {/* Mô tả từng kỹ năng */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 block">
                  Mô tả thành tích theo kỹ năng
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SKILLS.map(s => (
                    <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                      <div className="text-gray-300 text-xs font-semibold mb-2">{s.icon} {s.name}</div>
                      <textarea
                        value={form.skills[s.id]?.note || ''}
                        onChange={e => setForm({ ...form, skills: { ...form.skills, [s.id]: { note: e.target.value } } })}
                        rows={2}
                        placeholder="Mô tả việc đã làm..."
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 resize-none transition"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Ghi chú tổng hợp</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={3} placeholder="Thành tích nổi bật, lưu ý..."
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-5 py-2 rounded-lg text-sm transition">Hủy</button>
              <button onClick={saveMonth} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}