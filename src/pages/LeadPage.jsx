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

export default function LeadPage({ user, onLogout }) {
  const [tab, setTab] = useState('inbox')
  const [inbox, setInbox] = useState([])
  const [done, setDone] = useState([])
  const [loading, setLoading] = useState(true)
  const [returnModal, setReturnModal] = useState(null)
  const [returnReason, setReturnReason] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    // Lấy tất cả dự án mà lead này là chủ
    const { data: myProjects } = await sb.from('projects')
      .select('id').eq('owner_id', user.id)

    const myProjectIds = (myProjects || []).map(p => p.id)

    // Lấy records có thành tích thuộc dự án của lead này
    const { data: records } = await sb.from('records')
      .select('*, users!engineer_id(name, team)')
      .in('state', ['submitted', 'returned', 'approved_b', 'scored', 'appealed', 'accepted', 'completed'])

    // Lọc records có ít nhất 1 thành tích thuộc dự án của lead
    const filtered = (records || []).filter(r =>
      r.months?.some(m => myProjectIds.includes(m.projectId))
    ).map(r => ({
      ...r,
      name: r.users?.name,
      team: r.users?.team,
      // Chỉ lấy thành tích thuộc dự án của lead này
      filteredMonths: r.months?.filter(m => myProjectIds.includes(m.projectId))
    }))

    setInbox(filtered.filter(r => r.state === 'submitted'))
    setDone(filtered.filter(r => r.state !== 'submitted'))
    setLoading(false)
  }

  async function approve(recordId, name) {
    if (!confirm(`Duyệt hồ sơ của ${name} và gửi lên Hội Đồng?`)) return
    await sb.from('records').update({
      state: 'approved_b',
      lead_action: { action: 'approve', at: new Date().toLocaleString('vi-VN') },
      updated_at: new Date().toISOString()
    }).eq('id', recordId)
    loadData()
  }

  async function confirmReturn() {
    if (!returnReason.trim()) { alert('Nhập lý do!'); return }
    await sb.from('records').update({
      state: 'returned',
      lead_action: { action: 'return', reason: returnReason, at: new Date().toLocaleString('vi-VN') },
      updated_at: new Date().toISOString()
    }).eq('id', returnModal.id)
    setReturnModal(null)
    setReturnReason('')
    loadData()
  }

  const STATE_COLORS = {
    submitted: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    returned: 'bg-red-500/10 text-red-400 border-red-500/30',
    approved_b: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    scored: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    appealed: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    completed: 'bg-green-500/10 text-green-400 border-green-500/30',
  }

  const STATE_LABELS = {
    submitted: 'Chờ xác nhận',
    returned: 'Đã trả về',
    approved_b: 'Đã duyệt',
    scored: 'HĐ đã chấm',
    appealed: 'Kháng cáo',
    completed: 'Hoàn tất',
  }

  function RecordCard({ r, showActions }) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition mb-4">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800/50 border-b border-gray-800">
          <div>
            <span className="text-white font-bold text-base">👨‍💻 {r.name}</span>
            <span className="text-gray-500 text-sm ml-3">{r.team}</span>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATE_COLORS[r.state]}`}>
            {STATE_LABELS[r.state]}
          </span>
        </div>
        <div className="px-5 py-4">
          {r.filteredMonths?.map((m, idx) => (
            <div key={idx} className="mb-4 last:mb-0">
              <div className="text-indigo-400 font-semibold text-sm mb-2">🗂 {m.projectName}</div>
              {SKILLS.map(s => {
                const sk = m.skills?.[s.id]
                if (!sk?.note) return null
                return (
                  <div key={s.id} className="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
                    <span className="text-gray-500 text-xs w-44 shrink-0">{s.icon} {s.name}</span>
                    <span className="text-gray-300 text-xs">{sk.note}</span>
                  </div>
                )
              })}
              {m.notes && <p className="text-gray-500 text-xs mt-2 italic">📝 {m.notes}</p>}
            </div>
          ))}
        </div>
        {showActions && (
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-800 bg-gray-800/20">
            <button onClick={() => { setReturnModal(r); setReturnReason('') }}
              className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-500/30 text-sm font-semibold px-4 py-2 rounded-lg transition">
              ↩ Trả về KS
            </button>
            <button onClick={() => approve(r.id, r.name)}
              className="bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
              ✅ Duyệt → Gửi HĐ
            </button>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Đang tải...</div>

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-5 border-b border-gray-800">
          <span className="text-white font-bold text-lg">◈ LevelUp</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'inbox', icon: '📥', label: 'Chờ xác nhận', count: inbox.length },
            { id: 'done', icon: '✅', label: 'Đã xử lý' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{t.icon}</span>
              <span className="flex-1 text-left">{t.label}</span>
              {t.count > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">B</div>
            <div>
              <div className="text-white text-sm font-semibold">{user.name}</div>
              <div className="text-gray-500 text-xs">Lead / Chủ dự án</div>
            </div>
          </div>
          <button onClick={async () => { await sb.auth.signOut(); onLogout() }}
            className="w-full text-gray-500 hover:text-red-400 text-xs py-2 border border-gray-800 hover:border-red-500/30 rounded-lg transition">
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="ml-56 flex-1 p-8">
        {tab === 'inbox' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Hồ sơ chờ xác nhận</h2>
            <p className="text-gray-500 text-sm mb-6">Chỉ hiển thị thành tích thuộc dự án của bạn</p>
            {!inbox.length
              ? <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">📥</div><p>Không có hồ sơ chờ xác nhận</p></div>
              : inbox.map(r => <RecordCard key={r.id} r={r} showActions={true} />)
            }
          </div>
        )}

        {tab === 'done' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Hồ sơ đã xử lý</h2>
            {!done.length
              ? <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">✅</div><p>Chưa có hồ sơ đã xử lý</p></div>
              : done.map(r => <RecordCard key={r.id} r={r} showActions={false} />)
            }
          </div>
        )}
      </main>

      {/* Modal trả về */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Trả hồ sơ về cho Kỹ Sư</h3>
              <button onClick={() => setReturnModal(null)} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5">
              <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm px-4 py-3 rounded-lg mb-4">
                ⚠️ Kỹ Sư sẽ nhận được thông báo và phải chỉnh sửa lại.
              </div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Lý do trả về</label>
              <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)}
                rows={4} placeholder="Nêu rõ điểm cần bổ sung, sai sót cần sửa..."
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setReturnModal(null)} className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">Hủy</button>
              <button onClick={confirmReturn} className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Trả về →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}