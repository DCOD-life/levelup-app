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

const TEAMS = ['Team Duy', 'Team Đức Anh', 'Team Khải', 'Team Linh']

export default function CouncilPage({ user, onLogout }) {
  const [tab, setTab] = useState('queue')

  // Data
  const [queue, setQueue] = useState([])
  const [appeals, setAppeals] = useState([])
  const [engineers, setEngineers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  // Score modal
  const [scoreModal, setScoreModal] = useState(null)
  const [scores, setScores] = useState({})
  const [proposedLv, setProposedLv] = useState('')
  const [decision, setDecision] = useState('')
  const [comment, setComment] = useState('')

  // Reply modal
  const [replyModal, setReplyModal] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyLv, setReplyLv] = useState('')

  // Project modal
  const [showAddProject, setShowAddProject] = useState(false)
  const [projectForm, setProjectForm] = useState({
    name: '', phase: 'Pha 1 - Phát triển', status: 'active', owner_id: '',
    start_date: '', deadline: '', contract_price: '', paid_amount: '',
    description: '', acceptance_criteria: ''
  })

  // Staff modal
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [staffForm, setStaffForm] = useState({
    name: '', email: '', password: '', role: 'engineer', team: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const { data: q } = await sb.from('records')
      .select('*, users!engineer_id(id, name, team, current_level)')
      .in('state', ['approved_b', 'accepted'])

    const { data: a } = await sb.from('records')
      .select('*, users!engineer_id(id, name, team)')
      .eq('state', 'appealed')

    const { data: engs } = await sb.from('users').select('*').eq('role', 'engineer')
    const { data: recs } = await sb.from('records').select('*')
    const { data: projs } = await sb.from('projects').select('*, users!owner_id(name)').eq('status', 'active')
    const { data: allU } = await sb.from('users').select('*').order('name')

    setQueue((q || []).map(r => ({
      ...r,
      engName: r.users?.name,
      engTeam: r.users?.team,
      engLevel: r.users?.current_level,
      engId: r.users?.id,
    })))

    setAppeals((a || []).map(r => ({ ...r, engName: r.users?.name })))

    setEngineers((engs || []).map(e => {
      const rec = (recs || []).find(r => r.engineer_id === e.id)
      return { ...e, record: rec }
    }))

    setProjects(projs || [])
    setAllUsers(allU || [])
    setLoading(false)
  }

  // ── Chấm điểm ──
  async function submitScore() {
    if (!decision) { alert('Chọn kết quả!'); return }
    await sb.from('records').update({
      state: 'scored',
      scoring: {
        skillScores: scores,
        proposedLevel: proposedLv,
        decision,
        comment,
        scoredAt: new Date().toLocaleString('vi-VN'),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', scoreModal.id)
    setScoreModal(null)
    setScores({}); setProposedLv(''); setDecision(''); setComment('')
    loadData()
  }

  // ── Xác nhận level ──
  async function finalizeLevel(r) {
    if (!confirm(`Cập nhật level ${r.scoring?.proposedLevel} cho ${r.engName}?`)) return
    await sb.from('records').update({
      state: 'completed',
      scoring: {
        ...r.scoring,
        finalLevel: r.scoring?.proposedLevel,
        finalizedAt: new Date().toLocaleString('vi-VN'),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', r.id)
    await sb.from('users').update({ current_level: parseFloat(r.scoring?.proposedLevel) }).eq('id', r.engId)
    loadData()
  }

  // ── Phản hồi kháng cáo ──
  async function submitReply() {
    if (!replyText.trim()) { alert('Nhập phản hồi!'); return }
    const rec = replyModal
    const newAppeals = [...(rec.appeals || [])]
    const lastRound = newAppeals[newAppeals.length - 1]?.round || 1
    newAppeals.push({ round: lastRound, from: 'C', text: replyText, at: new Date().toLocaleString('vi-VN') })
    const updatedScoring = { ...rec.scoring }
    if (replyLv) updatedScoring.proposedLevel = replyLv
    await sb.from('records').update({
      state: 'scored',
      scoring: updatedScoring,
      appeals: newAppeals,
      updated_at: new Date().toISOString(),
    }).eq('id', rec.id)
    setReplyModal(null); setReplyText(''); setReplyLv('')
    loadData()
  }

  // ── Thêm dự án ──
  async function addProject() {
    if (!projectForm.name.trim()) { alert('Vui lòng nhập tên dự án!'); return }
    if (!projectForm.owner_id) { alert('Vui lòng chọn chủ dự án!'); return }

    const { error } = await sb.from('projects').insert({
      name: projectForm.name,
      phase: projectForm.phase,
      status: projectForm.status,
      owner_id: projectForm.owner_id,
      start_date: projectForm.start_date || null,
      deadline: projectForm.deadline || null,
      contract_price: parseFloat(projectForm.contract_price) || 0,
      paid_amount: parseFloat(projectForm.paid_amount) || 0,
      description: projectForm.description || null,
      acceptance_criteria: projectForm.acceptance_criteria || null,
    })

    if (error) {
      alert('❌ Lỗi khi tạo dự án: ' + error.message)
      return
    }

    alert(`✅ Đã tạo dự án "${projectForm.name}" thành công!`)
    setProjectForm({
      name: '', phase: 'Pha 1 - Phát triển', status: 'active', owner_id: '',
      start_date: '', deadline: '', contract_price: '', paid_amount: '',
      description: '', acceptance_criteria: ''
    })
    setShowAddProject(false)
    loadData()
  }

  // ── Thêm nhân sự ──
  async function addStaff() {
    if (!staffForm.name || !staffForm.email || !staffForm.password) {
      alert('Điền đầy đủ thông tin!'); return
    }
    try {
      // Tạo tài khoản Auth
      const { error: authError } = await sb.auth.signUp({
        email: staffForm.email,
        password: staffForm.password,
      })

      if (authError) { alert('❌ Lỗi tạo Auth: ' + authError.message); return }

      // Thêm vào bảng users
      const { error: dbError } = await sb.from('users').insert({
        name: staffForm.name,
        email: staffForm.email,
        password: staffForm.password,
        role: staffForm.role,
        team: staffForm.team || null,
        current_level: 0,
      })

      if (dbError) {
        alert(`⚠️ Đã tạo Auth nhưng không lưu được vào bảng users!\n\nLỗi: ${dbError.message}\n\nCode: ${dbError.code}`)
        return
      }

      alert(`✅ Đã thêm ${staffForm.name} thành công!\n\nTài khoản có thể đăng nhập ngay.`)
      setShowAddStaff(false)
      setStaffForm({ name: '', email: '', password: '', role: 'engineer', team: '' })
      loadData()
    } catch (e) {
      alert('Lỗi: ' + e.message)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      Đang tải...
    </div>
  )

  const TABS = [
    { id: 'queue',     icon: '⚖️', label: 'Hàng chờ chấm', count: queue.length },
    { id: 'appeals',   icon: '📢', label: 'Kháng cáo',     count: appeals.length },
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'projects',  icon: '🗂',  label: 'Dự án' },
    { id: 'staff',     icon: '👥', label: 'Nhân sự' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* ── Sidebar ── */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-5 border-b border-gray-800">
          <span className="text-white font-bold text-lg">◈ LevelUp</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition
                ${tab === t.id ? 'bg-indigo-500/10 text-indigo-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
              <span>{t.icon}</span>
              <span className="flex-1 text-left">{t.label}</span>
              {t.count > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{t.count}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">C</div>
            <div>
              <div className="text-white text-sm font-semibold">{user.name}</div>
              <div className="text-gray-500 text-xs">Hội Đồng</div>
            </div>
          </div>
          <button onClick={async () => { await sb.auth.signOut(); onLogout() }}
            className="w-full text-gray-500 hover:text-red-400 text-xs py-2 border border-gray-800 hover:border-red-500/30 rounded-lg transition">
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="ml-56 flex-1 p-8">

        {/* TAB: Hàng chờ chấm */}
        {tab === 'queue' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Hàng chờ chấm điểm</h2>
            <p className="text-gray-500 text-sm mb-6">Hồ sơ Lead đã duyệt — chấm điểm và gửi kết quả cho Kỹ Sư</p>

            {/* Cần xác nhận level */}
            {queue.filter(r => r.state === 'accepted').map(r => (
              <div key={r.id} className="bg-gray-900 border border-green-500/30 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold">👨‍💻 {r.engName}</span>
                    <span className="ml-3 text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                      Đã đồng ý kết quả
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">
                    Level đề xuất: <strong className="text-white">{r.scoring?.proposedLevel}</strong>
                  </span>
                </div>
                <button onClick={() => finalizeLevel(r)}
                  className="mt-4 bg-green-600 hover:bg-green-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                  ✅ Xác nhận cập nhật level lên hệ thống
                </button>
              </div>
            ))}

            {/* Chờ chấm */}
            {queue.filter(r => r.state === 'approved_b').map(r => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4 hover:border-gray-700 transition">
                <div className="flex items-center justify-between px-5 py-4 bg-gray-800/50 border-b border-gray-800">
                  <div>
                    <span className="text-white font-bold">👨‍💻 {r.engName}</span>
                    <span className="text-gray-500 text-sm ml-3">
                      {r.engTeam} · Level hiện tại: {r.engLevel ?? 0}
                    </span>
                  </div>
                  <button onClick={() => {
                    setScoreModal(r)
                    setScores({}); setProposedLv(''); setDecision(''); setComment('')
                  }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                    ⚖️ Chấm điểm
                  </button>
                </div>
                <div className="px-5 py-4">
                  {r.months?.map((m, idx) => (
                    <div key={idx} className="mb-3">
                      <div className="text-indigo-400 text-sm font-semibold mb-2">🗂 {m.projectName}</div>
                      {SKILLS.map(s => {
                        const sk = m.skills?.[s.id]
                        if (!sk?.note) return null
                        return (
                          <div key={s.id} className="flex gap-3 py-1.5 border-b border-gray-800/50 last:border-0">
                            <span className="text-gray-500 text-xs w-44">{s.icon} {s.name}</span>
                            <span className="text-gray-300 text-xs">{sk.note}</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!queue.length && (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">⚖️</div>
                <p>Không có hồ sơ chờ chấm điểm</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: Kháng cáo */}
        {tab === 'appeals' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Xử lý kháng cáo</h2>
            {!appeals.length ? (
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">📢</div>
                <p>Không có kháng cáo</p>
              </div>
            ) : appeals.map(r => {
              const last = r.appeals?.[r.appeals.length - 1]
              return (
                <div key={r.id} className="bg-gray-900 border border-yellow-500/30 rounded-xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-bold">📢 {r.engName}</span>
                    <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
                      Kháng cáo vòng {last?.round}
                    </span>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm px-4 py-3 rounded-lg mb-4">
                    💬 "{last?.text}"
                  </div>
                  <button onClick={() => { setReplyModal(r); setReplyText(''); setReplyLv('') }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                    📝 Phản hồi kháng cáo
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: Dashboard */}
        {tab === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Dashboard tổng hợp</h2>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Tổng kỹ sư',  value: engineers.length, color: 'text-white' },
                { label: 'Hoàn tất',     value: engineers.filter(e => e.record?.state === 'completed').length, color: 'text-green-400' },
                { label: 'Kháng cáo',   value: appeals.length, color: 'text-yellow-400' },
                { label: 'Đang xử lý',  value: engineers.filter(e => ['approved_b','scored','accepted'].includes(e.record?.state)).length, color: 'text-blue-400' },
              ].map((s, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">{s.label}</div>
                  <div className={`text-4xl font-bold font-mono ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50 border-b border-gray-800">
                    {['Kỹ sư', 'Team', 'Level hiện tại', 'Level đề xuất', 'Trạng thái'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {engineers.map(e => (
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-5 py-3 text-white font-semibold text-sm">{e.name}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{e.team || '—'}</td>
                      <td className="px-5 py-3 text-white font-mono text-sm">{e.current_level ?? '—'}</td>
                      <td className="px-5 py-3 text-white font-mono text-sm">{e.record?.scoring?.proposedLevel || '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-800 text-gray-400">
                          {e.record?.state || 'draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Dự án */}
        {tab === 'projects' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Quản lý dự án</h2>
              <button onClick={() => setShowAddProject(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                + Thêm dự án
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {projects.map(p => (
                <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition">
                  <div className="text-white font-bold mb-1">🗂 {p.name}</div>
                  <div className="text-gray-500 text-sm">Chủ dự án: {p.users?.name || '?'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Nhân sự */}
        {tab === 'staff' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Quản lý nhân sự</h2>
                <p className="text-gray-500 text-sm mt-1">Thêm và quản lý thành viên trong hệ thống</p>
              </div>
              <button onClick={() => setShowAddStaff(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                + Thêm nhân sự
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50 border-b border-gray-800">
                    {['Họ tên', 'Email', 'Team', 'Vai trò', 'Level'].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-gray-400 text-xs font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="px-5 py-3 text-white font-semibold text-sm">{u.name}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{u.email}</td>
                      <td className="px-5 py-3 text-gray-400 text-sm">{u.team || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          u.role === 'engineer' ? 'bg-violet-500/10 text-violet-400' :
                          u.role === 'lead'     ? 'bg-cyan-500/10 text-cyan-400' :
                                                  'bg-orange-500/10 text-orange-400'
                        }`}>
                          {u.role === 'engineer' ? 'Kỹ Sư' : u.role === 'lead' ? 'Lead' : 'Hội Đồng'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-white font-mono text-sm">{u.current_level ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* ══ MODAL: Chấm điểm ══ */}
      {scoreModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h3 className="text-white font-bold text-lg">Chấm điểm — {scoreModal.engName}</h3>
              <button onClick={() => setScoreModal(null)} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {SKILLS.map(s => (
                  <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
                    <div className="text-gray-300 text-xs font-semibold mb-2">{s.icon} {s.name}</div>
                    <input type="number" min="0" max="3" step="0.5"
                      value={scores[s.id]?.score || ''}
                      onChange={e => setScores({ ...scores, [s.id]: { ...scores[s.id], score: e.target.value } })}
                      placeholder="0 – 3"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 text-center font-mono mb-2 transition"
                    />
                    <textarea
                      value={scores[s.id]?.note || ''}
                      onChange={e => setScores({ ...scores, [s.id]: { ...scores[s.id], note: e.target.value } })}
                      rows={1} placeholder="Nhận xét..."
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-indigo-500 resize-none transition"
                    />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Level đề xuất</label>
                  <input type="number" min="0" max="4" step="0.5" value={proposedLv}
                    onChange={e => setProposedLv(e.target.value)} placeholder="0 – 4"
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Quyết định</label>
                  <select value={decision} onChange={e => setDecision(e.target.value)}
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                    <option value="">— Chọn —</option>
                    <option value="pass">✅ ĐẠT — Lên level</option>
                    <option value="fail">❌ KHÔNG ĐẠT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Nhận xét tổng hợp</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  rows={3} placeholder="Nhận xét và hướng phát triển..."
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button onClick={() => setScoreModal(null)} className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">Hủy</button>
              <button onClick={submitScore} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Gửi kết quả cho Kỹ Sư →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Phản hồi kháng cáo ══ */}
      {replyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h3 className="text-white font-bold">Phản hồi kháng cáo — {replyModal.engName}</h3>
              <button onClick={() => setReplyModal(null)} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {replyModal.appeals?.map((a, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${a.from === 'A' ? 'text-violet-400' : 'text-orange-400'}`}>
                        {a.from === 'A' ? '👨‍💻 Kỹ Sư' : '🏛 Hội Đồng'} — Vòng {a.round}
                      </span>
                      <span className="text-gray-600 text-xs">{a.at}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{a.text}</p>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Level đề xuất mới (bỏ trống = giữ nguyên)</label>
                <input type="number" min="0" max="4" step="0.5" value={replyLv}
                  onChange={e => setReplyLv(e.target.value)} placeholder="Giữ nguyên nếu không đổi"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Phản hồi của Hội Đồng</label>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  rows={3} placeholder="Giải thích lý do hoặc ghi nhận điều chỉnh..."
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setReplyModal(null)} className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">Hủy</button>
              <button onClick={submitReply} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Gửi phản hồi →</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Thêm dự án ══ */}
      {/* ══ MODAL: Thêm dự án ══ */}
      {showAddProject && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h3 className="text-white font-bold text-lg">Tạo dự án mới</h3>
              <button onClick={() => setShowAddProject(false)} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>

            <div className="px-6 py-5 space-y-6">

              {/* Nhóm 1: Thông tin cơ bản */}
              <div>
                <h4 className="text-indigo-400 text-sm font-semibold mb-3 pb-2 border-b border-gray-800">Thông tin cơ bản</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tên dự án <span className="text-red-400">*</span></label>
                    <input value={projectForm.name}
                      onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                      placeholder="VD: Ring Cleaner — Pha 1"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Loại pha</label>
                    <select value={projectForm.phase}
                      onChange={e => setProjectForm({ ...projectForm, phase: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                      <option value="Pha 1 - Phát triển">Pha 1 — Phát triển</option>
                      <option value="Pha 2 - Sản xuất">Pha 2 — Sản xuất</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Trạng thái</label>
                    <select value={projectForm.status}
                      onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                      <option value="active">Đang thực hiện</option>
                      <option value="paused">Tạm dừng</option>
                      <option value="completed">Hoàn thành</option>
                      <option value="cancelled">Huỷ</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Chủ dự án</label>
                    <select value={projectForm.owner_id}
                      onChange={e => setProjectForm({ ...projectForm, owner_id: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                      <option value="">— Chọn chủ dự án —</option>
                      {allUsers.filter(u => u.role === 'council' || u.role === 'lead').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role === 'council' ? 'Hội Đồng' : 'Lead'}{u.team ? ' · ' + u.team : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Nhóm 2: Thời gian & Tài chính */}
              <div>
                <h4 className="text-indigo-400 text-sm font-semibold mb-3 pb-2 border-b border-gray-800">Thời gian & Tài chính</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Ngày bắt đầu</label>
                    <input type="date" value={projectForm.start_date}
                      onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Deadline</label>
                    <input type="date" value={projectForm.deadline}
                      onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Giá hợp đồng (USD)</label>
                    <input type="number" min="0" value={projectForm.contract_price}
                      onChange={e => setProjectForm({ ...projectForm, contract_price: e.target.value })}
                      placeholder="VD: 3000"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Đã thanh toán (USD)</label>
                    <input type="number" min="0" value={projectForm.paid_amount}
                      onChange={e => setProjectForm({ ...projectForm, paid_amount: e.target.value })}
                      placeholder="0"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Nhóm 3: Mô tả & Nghiệm thu */}
              <div>
                <h4 className="text-indigo-400 text-sm font-semibold mb-3 pb-2 border-b border-gray-800">Mô tả & Nghiệm thu</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mô tả dự án</label>
                    <textarea value={projectForm.description}
                      onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                      rows={3} placeholder="Mô tả chi tiết dự án, mục tiêu, yêu cầu kỹ thuật..."
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tiêu chí nghiệm thu</label>
                    <textarea value={projectForm.acceptance_criteria}
                      onChange={e => setProjectForm({ ...projectForm, acceptance_criteria: e.target.value })}
                      rows={3} placeholder="Các tiêu chí để đánh giá dự án hoàn thành..."
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button onClick={() => setShowAddProject(false)} className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">Hủy</button>
              <button onClick={addProject} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Lưu dự án</button>
            </div>
          </div>
        </div>
      )}
      

      {/* ══ MODAL: Thêm nhân sự ══ */}
      {showAddStaff && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h3 className="text-white font-bold text-lg">Thêm nhân sự mới</h3>
              <button onClick={() => setShowAddStaff(false)} className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Họ và tên</label>
                <input value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Email</label>
                <input type="email" value={staffForm.email}
                  onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="email@gmail.com"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mật khẩu</label>
                <input type="text" value={staffForm.password}
                  onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="VD: TenNguoi@123"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Vai trò</label>
                <select value={staffForm.role}
                  onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                  <option value="engineer">Kỹ Sư</option>
                  <option value="lead">Lead</option>
                  <option value="council">Hội Đồng</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Team</label>
                <select value={staffForm.team}
                  onChange={e => setStaffForm({ ...staffForm, team: e.target.value })}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                  <option value="">— Chọn team —</option>
                  {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => setShowAddStaff(false)} className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">Hủy</button>
              <button onClick={addStaff} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Thêm nhân sự</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}