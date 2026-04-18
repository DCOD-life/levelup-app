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

const ROLE_LABEL = {
  director:   'Giám Đốc',
  po:         'PO',
  engineer:   'Kỹ Sư',
  accountant: 'Kế Toán',
  partner:    'Đối tác 3D',
}

const ROLE_COLOR = {
  director:   'bg-orange-500/10 text-orange-400',
  po:         'bg-cyan-500/10 text-cyan-400',
  engineer:   'bg-violet-500/10 text-violet-400',
  accountant: 'bg-emerald-500/10 text-emerald-400',
  partner:    'bg-pink-500/10 text-pink-400',
}

const EMPTY_PROJECT = {
  name: '', phase: 'Pha 1 - Phát triển', status: 'active', owner_id: '',
  start_date: '', deadline: '', contract_price: '', paid_amount: '',
  description: '', acceptance_criteria: ''
}

const EMPTY_PARTNER = {
  name: '', phone: '', address: '', contact_person: '',
  technology: 'FDM', avg_price: '', notes: '',
  email: '', password: '', create_account: false,
}

// Hàm tạo acc (giữ session người đang đăng nhập)
async function createUserAccount({ email, password, name, role, team = null }) {
  const { data: sessionData } = await sb.auth.getSession()
  const currentSession = sessionData?.session

  const { error: authError } = await sb.auth.signUp({ email, password })
  if (authError) {
    if (currentSession) {
      await sb.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      })
    }
    return { error: 'Lỗi Auth: ' + authError.message }
  }

  const { data: newUser, error: dbError } = await sb.from('users').insert({
    name, email: email.toLowerCase(), password, role,
    team, current_level: 0,
  }).select().single()

  if (dbError) {
    if (currentSession) {
      await sb.auth.setSession({
        access_token: currentSession.access_token,
        refresh_token: currentSession.refresh_token,
      })
    }
    return { error: 'Lỗi DB: ' + dbError.message }
  }

  if (currentSession) {
    await sb.auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    })
  }

  return { success: true, user: newUser }
}

export default function CouncilPage({ user, onLogout }) {
  const [tab, setTab] = useState('queue')

  const [queue, setQueue] = useState([])
  const [appeals, setAppeals] = useState([])
  const [engineers, setEngineers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [partners, setPartners] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const [scoreModal, setScoreModal] = useState(null)
  const [scores, setScores] = useState({})
  const [proposedLv, setProposedLv] = useState('')
  const [decision, setDecision] = useState('')
  const [comment, setComment] = useState('')

  const [replyModal, setReplyModal] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyLv, setReplyLv] = useState('')

  const [projectModal, setProjectModal] = useState(null)
  const [projectEditing, setProjectEditing] = useState(false)
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT)

  const [partnerModal, setPartnerModal] = useState(null)
  const [partnerEditing, setPartnerEditing] = useState(false)
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER)

  const [showAddStaff, setShowAddStaff] = useState(false)
  const [staffForm, setStaffForm] = useState({
    name: '', email: '', password: '', role: 'engineer', team: ''
  })

  // Review modal
  const [reviewModal, setReviewModal] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewAction, setReviewAction] = useState('') // 'approve' | 'reject'

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
    const { data: prts } = await sb.from('printing_partners').select('*, users!created_by(name)').order('created_at', { ascending: false })

    // Lấy pending requests
    const { data: reqs } = await sb.from('pending_requests')
      .select('*, requester:requested_by(name, team)')
      .order('created_at', { ascending: false })

    setQueue((q || []).map(r => ({
      ...r, engName: r.users?.name, engTeam: r.users?.team,
      engLevel: r.users?.current_level, engId: r.users?.id,
    })))
    setAppeals((a || []).map(r => ({ ...r, engName: r.users?.name })))
    setEngineers((engs || []).map(e => {
      const rec = (recs || []).find(r => r.engineer_id === e.id)
      return { ...e, record: rec }
    }))
    setProjects(projs || [])
    setAllUsers(allU || [])
    setPartners(prts || [])
    setPendingRequests(reqs || [])
    setLoading(false)
  }

  async function submitScore() {
    if (!decision) { alert('Chọn kết quả!'); return }
    await sb.from('records').update({
      state: 'scored',
      scoring: {
        skillScores: scores, proposedLevel: proposedLv, decision, comment,
        scoredAt: new Date().toLocaleString('vi-VN'),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', scoreModal.id)
    setScoreModal(null)
    setScores({}); setProposedLv(''); setDecision(''); setComment('')
    loadData()
  }

  async function finalizeLevel(r) {
    if (!confirm(`Cập nhật level ${r.scoring?.proposedLevel} cho ${r.engName}?`)) return
    await sb.from('records').update({
      state: 'completed',
      scoring: { ...r.scoring, finalLevel: r.scoring?.proposedLevel, finalizedAt: new Date().toLocaleString('vi-VN') },
      updated_at: new Date().toISOString(),
    }).eq('id', r.id)
    await sb.from('users').update({ current_level: parseFloat(r.scoring?.proposedLevel) }).eq('id', r.engId)
    loadData()
  }

  async function submitReply() {
    if (!replyText.trim()) { alert('Nhập phản hồi!'); return }
    const rec = replyModal
    const newAppeals = [...(rec.appeals || [])]
    const lastRound = newAppeals[newAppeals.length - 1]?.round || 1
    newAppeals.push({ round: lastRound, from: 'C', text: replyText, at: new Date().toLocaleString('vi-VN') })
    const updatedScoring = { ...rec.scoring }
    if (replyLv) updatedScoring.proposedLevel = replyLv
    await sb.from('records').update({
      state: 'scored', scoring: updatedScoring, appeals: newAppeals,
      updated_at: new Date().toISOString(),
    }).eq('id', rec.id)
    setReplyModal(null); setReplyText(''); setReplyLv('')
    loadData()
  }

  function openCreateProject() {
    setProjectForm(EMPTY_PROJECT)
    setProjectEditing(true)
    setProjectModal('create')
  }

  function openViewProject(p) {
    setProjectForm({
      name: p.name || '', phase: p.phase || 'Pha 1 - Phát triển',
      status: p.status || 'active', owner_id: p.owner_id || '',
      start_date: p.start_date || '', deadline: p.deadline || '',
      contract_price: p.contract_price || '', paid_amount: p.paid_amount || '',
      description: p.description || '', acceptance_criteria: p.acceptance_criteria || '',
    })
    setProjectEditing(false)
    setProjectModal(p)
  }

  async function saveProject() {
    if (!projectForm.name.trim()) { alert('Vui lòng nhập tên dự án!'); return }
    if (!projectForm.owner_id) { alert('Vui lòng chọn chủ dự án!'); return }

    const payload = {
      name: projectForm.name, phase: projectForm.phase, status: projectForm.status,
      owner_id: projectForm.owner_id,
      start_date: projectForm.start_date || null, deadline: projectForm.deadline || null,
      contract_price: parseFloat(projectForm.contract_price) || 0,
      paid_amount: parseFloat(projectForm.paid_amount) || 0,
      description: projectForm.description || null,
      acceptance_criteria: projectForm.acceptance_criteria || null,
    }

    let error
    if (projectModal === 'create') {
      ({ error } = await sb.from('projects').insert(payload))
    } else {
      ({ error } = await sb.from('projects').update({
        ...payload, updated_at: new Date().toISOString()
      }).eq('id', projectModal.id))
    }

    if (error) { alert('❌ Lỗi: ' + error.message); return }
    alert(projectModal === 'create' ? `✅ Đã tạo dự án!` : `✅ Đã cập nhật!`)
    setProjectModal(null)
    setProjectEditing(false)
    loadData()
  }

  async function deleteProject() {
    if (!confirm(`Xóa dự án "${projectModal.name}"?`)) return
    const { error } = await sb.from('projects').delete().eq('id', projectModal.id)
    if (error) { alert('❌ Lỗi xóa: ' + error.message); return }
    alert('✅ Đã xóa!')
    setProjectModal(null)
    loadData()
  }

  function openCreatePartner() {
    setPartnerForm(EMPTY_PARTNER)
    setPartnerEditing(true)
    setPartnerModal('create')
  }

  function openViewPartner(p) {
    setPartnerForm({
      name: p.name || '', phone: p.phone || '',
      address: p.address || '', contact_person: p.contact_person || '',
      technology: p.technology || 'FDM', avg_price: p.avg_price || '',
      notes: p.notes || '',
      email: '', password: '', create_account: false,
    })
    setPartnerEditing(false)
    setPartnerModal(p)
  }

  async function savePartner() {
    if (!partnerForm.name.trim()) { alert('Vui lòng nhập tên xưởng!'); return }

    const isCreating = partnerModal === 'create'

    if (isCreating && partnerForm.create_account) {
      if (!partnerForm.email.trim()) { alert('Vui lòng nhập email đăng nhập!'); return }
      if (!partnerForm.password.trim() || partnerForm.password.length < 6) {
        alert('Mật khẩu phải có ít nhất 6 ký tự!'); return
      }
    }

    const payload = {
      name: partnerForm.name,
      phone: partnerForm.phone || null,
      address: partnerForm.address || null,
      contact_person: partnerForm.contact_person || null,
      technology: partnerForm.technology || null,
      avg_price: parseFloat(partnerForm.avg_price) || 0,
      notes: partnerForm.notes || null,
    }

    let error, newPartner
    if (isCreating) {
      const { data, error: e } = await sb.from('printing_partners')
        .insert({ ...payload, created_by: user.id })
        .select().single()
      newPartner = data
      error = e
    } else {
      ({ error } = await sb.from('printing_partners').update({
        ...payload, updated_at: new Date().toISOString()
      }).eq('id', partnerModal.id))
    }

    if (error) { alert('❌ Lỗi: ' + error.message); return }

    if (isCreating && partnerForm.create_account && newPartner) {
      const result = await createUserAccount({
        email: partnerForm.email.toLowerCase(),
        password: partnerForm.password,
        name: partnerForm.name,
        role: 'partner',
      })
      if (result.error) {
        alert(`⚠️ Đã tạo đối tác nhưng tạo acc thất bại!\n${result.error}`)
      } else {
        await sb.from('printing_partners').update({ user_id: result.user.id }).eq('id', newPartner.id)
        alert(`✅ Đã tạo đối tác + tài khoản!\n\nEmail: ${partnerForm.email.toLowerCase()}\nMật khẩu: ${partnerForm.password}`)
      }
    } else {
      alert(isCreating ? `✅ Đã thêm đối tác!` : `✅ Đã cập nhật!`)
    }

    setPartnerModal(null)
    setPartnerEditing(false)
    loadData()
  }

  async function deletePartner() {
    if (!confirm(`Xóa đối tác "${partnerModal.name}"?`)) return
    const { error } = await sb.from('printing_partners').delete().eq('id', partnerModal.id)
    if (error) { alert('❌ Lỗi xóa: ' + error.message); return }
    alert('✅ Đã xóa!')
    setPartnerModal(null)
    loadData()
  }

  // GĐ tự thêm nhân sự (không qua duyệt)
  async function addStaff() {
    if (!staffForm.name || !staffForm.email || !staffForm.password) {
      alert('Điền đầy đủ thông tin!'); return
    }

    const result = await createUserAccount({
      email: staffForm.email.toLowerCase(),
      password: staffForm.password,
      name: staffForm.name,
      role: staffForm.role,
      team: staffForm.team || null,
    })

    if (result.error) { alert('❌ ' + result.error); return }

    alert(`✅ Đã thêm ${staffForm.name}!`)
    setShowAddStaff(false)
    setStaffForm({ name: '', email: '', password: '', role: 'engineer', team: '' })
    loadData()
  }

  // ── Mở modal review yêu cầu ──
  function openReview(req, action) {
    setReviewModal(req)
    setReviewAction(action)
    setReviewNote('')
  }

  // ── Duyệt / Từ chối yêu cầu ──
  async function submitReview() {
    const req = reviewModal

    if (reviewAction === 'reject') {
      if (!reviewNote.trim()) {
        alert('Vui lòng nhập lý do từ chối!'); return
      }

      await sb.from('pending_requests').update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote,
      }).eq('id', req.id)

      alert('✅ Đã từ chối yêu cầu')
      setReviewModal(null)
      setReviewAction('')
      loadData()
      return
    }

    // Duyệt — thực thi theo type
    if (req.type === 'staff') {
      const p = req.payload
      const result = await createUserAccount({
        email: p.email.toLowerCase(),
        password: p.password,
        name: p.name,
        role: p.role,
        team: p.team || null,
      })

      if (result.error) {
        alert(`⚠️ Lỗi khi tạo nhân sự: ${result.error}\n\nYêu cầu chưa được duyệt.`)
        return
      }
    } else if (req.type === 'partner') {
      const p = req.payload

      // 1. Tạo đối tác
      const { data: newPartner, error: pErr } = await sb.from('printing_partners')
        .insert({
          name: p.name,
          phone: p.phone || null,
          address: p.address || null,
          contact_person: p.contact_person || null,
          technology: p.technology || null,
          avg_price: parseFloat(p.avg_price) || 0,
          notes: p.notes || null,
          created_by: req.requested_by,
        })
        .select().single()

      if (pErr) { alert('❌ Lỗi tạo đối tác: ' + pErr.message); return }

      // 2. Nếu có yêu cầu tạo acc → tạo
      if (p.create_account && p.email && p.password) {
        const result = await createUserAccount({
          email: p.email.toLowerCase(),
          password: p.password,
          name: p.name,
          role: 'partner',
        })

        if (result.error) {
          alert(`⚠️ Đã tạo đối tác nhưng lỗi tạo acc: ${result.error}`)
        } else {
          await sb.from('printing_partners').update({ user_id: result.user.id }).eq('id', newPartner.id)
        }
      }
    }

    // Update status
    await sb.from('pending_requests').update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    }).eq('id', req.id)

    alert('✅ Đã duyệt yêu cầu!')
    setReviewModal(null)
    setReviewAction('')
    loadData()
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Đang tải...</div>
  )

  const pendingCount = pendingRequests.filter(r => r.status === 'pending').length
  const pendingList = pendingRequests.filter(r => r.status === 'pending')
  const reviewedList = pendingRequests.filter(r => r.status !== 'pending')

  const TABS = [
    { id: 'queue',     icon: '⚖️', label: 'Hàng chờ chấm', count: queue.length },
    { id: 'appeals',   icon: '📢', label: 'Kháng cáo',     count: appeals.length },
    { id: 'approvals', icon: '🔔', label: 'Chờ duyệt',     count: pendingCount },
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'projects',  icon: '🗂',  label: 'Dự án' },
    { id: 'partners',  icon: '🏭', label: 'Đối tác in 3D' },
    { id: 'staff',     icon: '👥', label: 'Nhân sự' },
  ]

  const isCreatingProject = projectModal === 'create'
  const isCreatingPartner = partnerModal === 'create'
  const partnerHasAccount = partnerModal && partnerModal !== 'create' && partnerModal.user_id

  return (
    <div className="min-h-screen bg-gray-950 flex">
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
              {t.count > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm">
              {user.role === 'accountant' ? 'KT' : 'GĐ'}
            </div>
            <div>
              <div className="text-white text-sm font-semibold">{user.name}</div>
              <div className="text-gray-500 text-xs">{ROLE_LABEL[user.role] || 'Giám Đốc'}</div>
            </div>
          </div>
          <button onClick={async () => { await sb.auth.signOut(); onLogout() }}
            className="w-full text-gray-500 hover:text-red-400 text-xs py-2 border border-gray-800 hover:border-red-500/30 rounded-lg transition">
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="ml-56 flex-1 p-8">

        {tab === 'queue' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Hàng chờ chấm điểm</h2>
            <p className="text-gray-500 text-sm mb-6">Hồ sơ PO đã duyệt — chấm điểm và gửi kết quả cho Kỹ Sư</p>

            {queue.filter(r => r.state === 'accepted').map(r => (
              <div key={r.id} className="bg-gray-900 border border-green-500/30 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-bold">👨‍💻 {r.engName}</span>
                    <span className="ml-3 text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">Đã đồng ý kết quả</span>
                  </div>
                  <span className="text-gray-400 text-sm">Level đề xuất: <strong className="text-white">{r.scoring?.proposedLevel}</strong></span>
                </div>
                <button onClick={() => finalizeLevel(r)}
                  className="mt-4 bg-green-600 hover:bg-green-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                  ✅ Xác nhận cập nhật level
                </button>
              </div>
            ))}

            {queue.filter(r => r.state === 'approved_b').map(r => (
              <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-4 hover:border-gray-700 transition">
                <div className="flex items-center justify-between px-5 py-4 bg-gray-800/50 border-b border-gray-800">
                  <div>
                    <span className="text-white font-bold">👨‍💻 {r.engName}</span>
                    <span className="text-gray-500 text-sm ml-3">{r.engTeam} · Level hiện tại: {r.engLevel ?? 0}</span>
                  </div>
                  <button onClick={() => { setScoreModal(r); setScores({}); setProposedLv(''); setDecision(''); setComment('') }}
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
              <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">⚖️</div><p>Không có hồ sơ chờ chấm điểm</p></div>
            )}
          </div>
        )}

        {tab === 'appeals' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Xử lý kháng cáo</h2>
            {!appeals.length ? (
              <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">📢</div><p>Không có kháng cáo</p></div>
            ) : appeals.map(r => {
              const last = r.appeals?.[r.appeals.length - 1]
              return (
                <div key={r.id} className="bg-gray-900 border border-yellow-500/30 rounded-xl p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-bold">📢 {r.engName}</span>
                    <span className="text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">Kháng cáo vòng {last?.round}</span>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-sm px-4 py-3 rounded-lg mb-4">💬 "{last?.text}"</div>
                  <button onClick={() => { setReplyModal(r); setReplyText(''); setReplyLv('') }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                    📝 Phản hồi
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* TAB: Chờ duyệt */}
        {tab === 'approvals' && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Yêu cầu chờ duyệt</h2>
            <p className="text-gray-500 text-sm mb-6">PO gửi yêu cầu thêm nhân sự / đối tác → duyệt hoặc từ chối</p>

            {!pendingList.length && !reviewedList.length ? (
              <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">🔔</div><p>Không có yêu cầu nào</p></div>
            ) : (
              <>
                {pendingList.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-yellow-400 text-sm font-semibold mb-3">⏳ ĐANG CHỜ DUYỆT ({pendingList.length})</h3>
                    <div className="space-y-3">
                      {pendingList.map(req => (
                        <div key={req.id} className="bg-gray-900 border border-yellow-500/30 rounded-xl p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{req.type === 'staff' ? '👤' : '🏭'}</span>
                              <div>
                                <div className="text-white font-bold">{req.payload.name}</div>
                                <div className="text-gray-500 text-xs mt-1">
                                  {req.type === 'staff' ? `Nhân sự · ${ROLE_LABEL[req.payload.role]}${req.payload.team ? ' · ' + req.payload.team : ''}` : 'Đối tác in 3D'}
                                </div>
                                <div className="text-gray-500 text-xs mt-1">
                                  Người gửi: <span className="text-cyan-400">{req.requester?.name}</span>
                                  {req.requester?.team && <span> · {req.requester.team}</span>}
                                  <span> · {new Date(req.created_at).toLocaleString('vi-VN')}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Chi tiết payload */}
                          <div className="bg-gray-800/50 rounded-lg p-4 mb-4 space-y-2">
                            {req.type === 'staff' && (
                              <>
                                <DetailRow label="Email" value={req.payload.email} />
                                {req.payload.team && <DetailRow label="Team" value={req.payload.team} />}
                                <DetailRow label="Mật khẩu" value={req.payload.password} />
                              </>
                            )}
                            {req.type === 'partner' && (
                              <>
                                {req.payload.phone && <DetailRow label="SĐT" value={req.payload.phone} />}
                                {req.payload.contact_person && <DetailRow label="Liên hệ" value={req.payload.contact_person} />}
                                {req.payload.address && <DetailRow label="Địa chỉ" value={req.payload.address} />}
                                {req.payload.technology && <DetailRow label="Công nghệ" value={req.payload.technology} />}
                                {req.payload.avg_price > 0 && <DetailRow label="Giá TB" value={`${Number(req.payload.avg_price).toLocaleString()} USD`} />}
                                {req.payload.notes && <DetailRow label="Ghi chú" value={req.payload.notes} />}
                                {req.payload.create_account && (
                                  <>
                                    <DetailRow label="Email đăng nhập" value={req.payload.email} />
                                    <DetailRow label="Mật khẩu" value={req.payload.password} />
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          <div className="flex justify-end gap-3">
                            <button onClick={() => openReview(req, 'reject')}
                              className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition">
                              ❌ Từ chối
                            </button>
                            <button onClick={() => openReview(req, 'approve')}
                              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
                              ✅ Duyệt
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewedList.length > 0 && (
                  <div>
                    <h3 className="text-gray-500 text-sm font-semibold mb-3">📜 LỊCH SỬ ({reviewedList.length})</h3>
                    <div className="space-y-2">
                      {reviewedList.map(req => (
                        <div key={req.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{req.type === 'staff' ? '👤' : '🏭'}</span>
                              <div>
                                <div className="text-white text-sm font-semibold">{req.payload.name}</div>
                                <div className="text-gray-500 text-xs">
                                  {req.type === 'staff' ? 'Nhân sự' : 'Đối tác'} · Người gửi: {req.requester?.name}
                                </div>
                              </div>
                            </div>
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${req.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                              {req.status === 'approved' ? '✅ Đã duyệt' : '❌ Đã từ chối'}
                            </span>
                          </div>
                          {req.review_note && (
                            <div className="text-gray-400 text-xs mt-2 italic">💬 {req.review_note}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

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
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-800 text-gray-400">{e.record?.state || 'draft'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'projects' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Quản lý dự án</h2>
              <button onClick={openCreateProject}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                + Thêm dự án
              </button>
            </div>
            {!projects.length ? (
              <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">🗂</div><p>Chưa có dự án nào</p></div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {projects.map(p => (
                  <button key={p.id} onClick={() => openViewProject(p)}
                    className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-gray-900/80 transition cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-bold">🗂 {p.name}</div>
                      {p.phase && <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">{p.phase}</span>}
                    </div>
                    <div className="text-gray-500 text-sm mb-2">Chủ dự án: {p.users?.name || '?'}</div>
                    {(p.contract_price > 0 || p.paid_amount > 0) && (
                      <div className="text-gray-400 text-xs">💰 {Number(p.paid_amount).toLocaleString()} / {Number(p.contract_price).toLocaleString()} USD</div>
                    )}
                    {p.deadline && (<div className="text-gray-400 text-xs mt-1">📅 Deadline: {p.deadline}</div>)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'partners' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Đối tác in 3D</h2>
                <p className="text-gray-500 text-sm mt-1">Danh sách xưởng in 3D liên kết</p>
              </div>
              <button onClick={openCreatePartner}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-lg text-sm transition">
                + Thêm đối tác
              </button>
            </div>

            {!partners.length ? (
              <div className="text-center py-16 text-gray-600"><div className="text-5xl mb-3 opacity-40">🏭</div><p>Chưa có đối tác in 3D nào</p></div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {partners.map(p => (
                  <button key={p.id} onClick={() => openViewPartner(p)}
                    className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-gray-900/80 transition cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white font-bold">🏭 {p.name}</div>
                      <div className="flex gap-1">
                        {p.user_id && <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">🔑</span>}
                        {p.technology && <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">{p.technology}</span>}
                      </div>
                    </div>
                    {p.contact_person && <div className="text-gray-400 text-sm mb-1">👤 {p.contact_person}</div>}
                    {p.phone && <div className="text-gray-400 text-sm mb-1">📞 {p.phone}</div>}
                    {p.address && <div className="text-gray-500 text-xs mb-2">📍 {p.address}</div>}
                    {p.avg_price > 0 && <div className="text-gray-400 text-xs">💰 Giá TB: {Number(p.avg_price).toLocaleString()} USD</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
                    {['Họ tên', 'Email', 'Team', 'Vị trí', 'Level'].map(h => (
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
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLOR[u.role] || 'bg-gray-800 text-gray-400'}`}>
                          {ROLE_LABEL[u.role] || u.role}
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

      {/* MODAL: Chấm điểm */}
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
                    <input type="number" min="0" max="3" step="0.5" value={scores[s.id]?.score || ''}
                      onChange={e => setScores({ ...scores, [s.id]: { ...scores[s.id], score: e.target.value } })}
                      placeholder="0 – 3"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 text-center font-mono mb-2 transition"
                    />
                    <textarea value={scores[s.id]?.note || ''}
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
                  rows={3} placeholder="Nhận xét..."
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button onClick={() => setScoreModal(null)} className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">Hủy</button>
              <button onClick={submitScore} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">Gửi kết quả →</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Phản hồi kháng cáo */}
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
                        {a.from === 'A' ? '👨‍💻 Kỹ Sư' : '🏛 Giám Đốc'} — Vòng {a.round}
                      </span>
                      <span className="text-gray-600 text-xs">{a.at}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{a.text}</p>
                  </div>
                ))}
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Level đề xuất mới</label>
                <input type="number" min="0" max="4" step="0.5" value={replyLv}
                  onChange={e => setReplyLv(e.target.value)} placeholder="Giữ nguyên nếu không đổi"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Phản hồi của Giám Đốc</label>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  rows={3} placeholder="..."
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

      {/* MODAL: Review (Duyệt/Từ chối) */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h3 className="text-white font-bold text-lg">
                {reviewAction === 'approve' ? '✅ Duyệt yêu cầu' : '❌ Từ chối yêu cầu'}
              </h3>
              <button onClick={() => { setReviewModal(null); setReviewAction('') }}
                className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{reviewModal.type === 'staff' ? '👤' : '🏭'}</span>
                  <div>
                    <div className="text-white font-bold">{reviewModal.payload.name}</div>
                    <div className="text-gray-500 text-xs">
                      {reviewModal.type === 'staff' ? `Nhân sự · ${ROLE_LABEL[reviewModal.payload.role]}` : 'Đối tác in 3D'}
                    </div>
                  </div>
                </div>
              </div>

              {reviewAction === 'approve' ? (
                <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-3 rounded-lg">
                  Khi duyệt, hệ thống sẽ tự động tạo {reviewModal.type === 'staff' ? 'tài khoản nhân sự' : 'đối tác (và tài khoản nếu có)'} từ thông tin trên.
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                  ⚠️ Yêu cầu sẽ bị từ chối. PO sẽ thấy trạng thái "Đã từ chối" cùng lý do.
                </div>
              )}

              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  Ghi chú {reviewAction === 'reject' ? <span className="text-red-400">*</span> : '(tùy chọn)'}
                </label>
                <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  rows={3}
                  placeholder={reviewAction === 'reject' ? 'Vui lòng nhập lý do từ chối...' : 'Ghi chú cho PO (tùy chọn)...'}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800">
              <button onClick={() => { setReviewModal(null); setReviewAction('') }}
                className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">
                Hủy
              </button>
              <button onClick={submitReview}
                className={`font-semibold px-5 py-2 rounded-lg text-sm transition text-white ${
                  reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                }`}>
                {reviewAction === 'approve' ? '✅ Xác nhận duyệt' : '❌ Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dự án */}
      {projectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h3 className="text-white font-bold text-lg">
                {isCreatingProject ? 'Tạo dự án mới' : projectEditing ? `Chỉnh sửa: ${projectModal.name}` : `📋 ${projectModal.name}`}
              </h3>
              <button onClick={() => { setProjectModal(null); setProjectEditing(false) }}
                className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-6">
              <div>
                <h4 className="text-indigo-400 text-sm font-semibold mb-3 pb-2 border-b border-gray-800">Thông tin cơ bản</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tên dự án{(isCreatingProject || projectEditing) && <span className="text-red-400"> *</span>}</label>
                    <input value={projectForm.name} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, name: e.target.value })}
                      placeholder="VD: Ring Cleaner — Pha 1"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Loại pha</label>
                    <select value={projectForm.phase} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, phase: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70">
                      <option value="Pha 1 - Phát triển">Pha 1 — Phát triển</option>
                      <option value="Pha 2 - Sản xuất">Pha 2 — Sản xuất</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Trạng thái</label>
                    <select value={projectForm.status} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, status: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70">
                      <option value="active">Đang thực hiện</option>
                      <option value="paused">Tạm dừng</option>
                      <option value="completed">Hoàn thành</option>
                      <option value="cancelled">Huỷ</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Chủ dự án</label>
                    <select value={projectForm.owner_id} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, owner_id: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70">
                      <option value="">— Chọn chủ dự án —</option>
                      {allUsers.filter(u => u.role === 'director' || u.role === 'po').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({ROLE_LABEL[u.role]}{u.team ? ' · ' + u.team : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-indigo-400 text-sm font-semibold mb-3 pb-2 border-b border-gray-800">Thời gian & Tài chính</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Ngày bắt đầu</label>
                    <input type="date" value={projectForm.start_date} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, start_date: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Deadline</label>
                    <input type="date" value={projectForm.deadline} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, deadline: e.target.value })}
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Giá hợp đồng (USD)</label>
                    <input type="number" min="0" value={projectForm.contract_price} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, contract_price: e.target.value })}
                      placeholder="VD: 3000"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Đã thanh toán (USD)</label>
                    <input type="number" min="0" value={projectForm.paid_amount} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, paid_amount: e.target.value })}
                      placeholder="0"
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-indigo-400 text-sm font-semibold mb-3 pb-2 border-b border-gray-800">Mô tả & Nghiệm thu</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mô tả dự án</label>
                    <textarea value={projectForm.description} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, description: e.target.value })}
                      rows={3} placeholder="Mô tả..."
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition disabled:opacity-70"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tiêu chí nghiệm thu</label>
                    <textarea value={projectForm.acceptance_criteria} disabled={!isCreatingProject && !projectEditing}
                      onChange={e => setProjectForm({ ...projectForm, acceptance_criteria: e.target.value })}
                      rows={3} placeholder="Tiêu chí..."
                      className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition disabled:opacity-70"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <div>
                {!isCreatingProject && !projectEditing && user.role === 'director' && (
                  <button onClick={deleteProject}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition">
                    🗑 Xóa dự án
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setProjectModal(null); setProjectEditing(false) }}
                  className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">
                  {(isCreatingProject || projectEditing) ? 'Hủy' : 'Đóng'}
                </button>
                {!isCreatingProject && !projectEditing && user.role === 'director' && (
                  <button onClick={() => setProjectEditing(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                    ✏️ Chỉnh sửa
                  </button>
                )}
                {(isCreatingProject || projectEditing) && (
                  <button onClick={saveProject}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                    {isCreatingProject ? 'Lưu dự án' : 'Lưu thay đổi'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Đối tác */}
      {partnerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h3 className="text-white font-bold text-lg">
                {isCreatingPartner ? 'Thêm đối tác in 3D' : partnerEditing ? `Chỉnh sửa: ${partnerModal.name}` : `🏭 ${partnerModal.name}`}
              </h3>
              <button onClick={() => { setPartnerModal(null); setPartnerEditing(false) }}
                className="text-gray-500 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg border border-gray-700 transition">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Tên xưởng{(isCreatingPartner || partnerEditing) && <span className="text-red-400"> *</span>}</label>
                <input value={partnerForm.name} disabled={!isCreatingPartner && !partnerEditing}
                  onChange={e => setPartnerForm({ ...partnerForm, name: e.target.value })}
                  placeholder="VD: Xưởng 3D ABC"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Số điện thoại</label>
                  <input value={partnerForm.phone} disabled={!isCreatingPartner && !partnerEditing}
                    onChange={e => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                    placeholder="0912 345 678"
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Người liên hệ</label>
                  <input value={partnerForm.contact_person} disabled={!isCreatingPartner && !partnerEditing}
                    onChange={e => setPartnerForm({ ...partnerForm, contact_person: e.target.value })}
                    placeholder="VD: Anh Tuấn"
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Địa chỉ</label>
                <input value={partnerForm.address} disabled={!isCreatingPartner && !partnerEditing}
                  onChange={e => setPartnerForm({ ...partnerForm, address: e.target.value })}
                  placeholder="VD: 123 Nguyễn Trãi..."
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Công nghệ</label>
                  <select value={partnerForm.technology} disabled={!isCreatingPartner && !partnerEditing}
                    onChange={e => setPartnerForm({ ...partnerForm, technology: e.target.value })}
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70">
                    <option value="FDM">FDM</option>
                    <option value="SLA">SLA</option>
                    <option value="SLS">SLS</option>
                    <option value="DLP">DLP</option>
                    <option value="MJF">MJF</option>
                    <option value="Mixed">Nhiều công nghệ</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Giá TB (USD)</label>
                  <input type="number" min="0" value={partnerForm.avg_price} disabled={!isCreatingPartner && !partnerEditing}
                    onChange={e => setPartnerForm({ ...partnerForm, avg_price: e.target.value })}
                    placeholder="VD: 50"
                    className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition disabled:opacity-70"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Ghi chú</label>
                <textarea value={partnerForm.notes} disabled={!isCreatingPartner && !partnerEditing}
                  onChange={e => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                  rows={3} placeholder="Đánh giá..."
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 resize-none transition disabled:opacity-70"
                />
              </div>

              {!isCreatingPartner && !partnerEditing && partnerModal.users?.name && (
                <div className="text-gray-500 text-xs italic">Tạo bởi: {partnerModal.users.name}</div>
              )}

              {partnerHasAccount && !partnerEditing && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
                  <p className="text-green-400 text-sm">🔑 Đối tác này đã có tài khoản đăng nhập</p>
                </div>
              )}

              {isCreatingPartner && (
                <div className="pt-4 border-t border-gray-800 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={partnerForm.create_account}
                      onChange={e => setPartnerForm({ ...partnerForm, create_account: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span className="text-white text-sm font-semibold">🔑 Tạo tài khoản đăng nhập cho đối tác</span>
                  </label>

                  {partnerForm.create_account && (
                    <div className="grid grid-cols-2 gap-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-4">
                      <div className="col-span-2">
                        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Email <span className="text-red-400">*</span></label>
                        <input type="email" value={partnerForm.email}
                          onChange={e => setPartnerForm({ ...partnerForm, email: e.target.value })}
                          placeholder="partner@example.com"
                          className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mật khẩu <span className="text-red-400">*</span></label>
                        <input type="text" value={partnerForm.password}
                          onChange={e => setPartnerForm({ ...partnerForm, password: e.target.value })}
                          placeholder="Tối thiểu 6 ký tự"
                          className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <div>
                {!isCreatingPartner && !partnerEditing && user.role === 'director' && (
                  <button onClick={deletePartner}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-semibold transition">
                    🗑 Xóa đối tác
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setPartnerModal(null); setPartnerEditing(false) }}
                  className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">
                  {(isCreatingPartner || partnerEditing) ? 'Hủy' : 'Đóng'}
                </button>
                {!isCreatingPartner && !partnerEditing && user.role === 'director' && (
                  <button onClick={() => setPartnerEditing(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                    ✏️ Chỉnh sửa
                  </button>
                )}
                {(isCreatingPartner || partnerEditing) && (
                  <button onClick={savePartner}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                    {isCreatingPartner ? 'Thêm đối tác' : 'Lưu thay đổi'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Thêm nhân sự */}
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
                <input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="VD: Nguyễn Văn A"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Email</label>
                <input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  placeholder="email@gmail.com"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mật khẩu</label>
                <input type="text" value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                  placeholder="Tối thiểu 6 ký tự"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Vị trí</label>
                <select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 transition">
                  <option value="engineer">Kỹ Sư</option>
                  <option value="po">PO</option>
                  <option value="director">Giám Đốc</option>
                  <option value="accountant">Kế Toán</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Team</label>
                <select value={staffForm.team} onChange={e => setStaffForm({ ...staffForm, team: e.target.value })}
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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-gray-500 w-32 shrink-0">{label}:</span>
      <span className="text-white">{value}</span>
    </div>
  )
}