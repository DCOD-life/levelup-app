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

const ROLE_LABEL = {
  director:   'Giám Đốc',
  po:         'PO',
  engineer:   'Kỹ Sư',
  accountant: 'Kế Toán',
  partner:    'Đối tác 3D',
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

async function createPartnerAccount({ email, password, name, partnerId }) {
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
    name, email, password, role: 'partner', current_level: 0,
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

  await sb.from('printing_partners').update({ user_id: newUser.id }).eq('id', partnerId)

  if (currentSession) {
    await sb.auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    })
  }

  return { success: true }
}

export default function LeadPage({ user, onLogout }) {
  const [tab, setTab] = useState('inbox')

  const [inbox, setInbox] = useState([])
  const [done, setDone] = useState([])
  const [projects, setProjects] = useState([])
  const [partners, setPartners] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const [returnModal, setReturnModal] = useState(null)
  const [returnReason, setReturnReason] = useState('')

  const [projectModal, setProjectModal] = useState(null)
  const [projectEditing, setProjectEditing] = useState(false)
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT)

  const [partnerModal, setPartnerModal] = useState(null)
  const [partnerEditing, setPartnerEditing] = useState(false)
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const { data: myProjects } = await sb.from('projects')
      .select('id').eq('owner_id', user.id)
    const myProjectIds = (myProjects || []).map(p => p.id)

    const { data: records } = await sb.from('records')
      .select('*, users!engineer_id(name, team)')
      .in('state', ['submitted', 'returned', 'approved_b', 'scored', 'appealed', 'accepted', 'completed'])

    const filtered = (records || []).filter(r =>
      r.months?.some(m => myProjectIds.includes(m.projectId))
    ).map(r => ({
      ...r, name: r.users?.name, team: r.users?.team,
      filteredMonths: r.months?.filter(m => myProjectIds.includes(m.projectId))
    }))

    const { data: allProjs } = await sb.from('projects')
      .select('*, users!owner_id(name)').eq('status', 'active')

    const { data: prts } = await sb.from('printing_partners')
      .select('*, users!created_by(name)').order('created_at', { ascending: false })

    const { data: allU } = await sb.from('users').select('*').order('name')

    setInbox(filtered.filter(r => r.state === 'submitted'))
    setDone(filtered.filter(r => r.state !== 'submitted'))
    setProjects(allProjs || [])
    setPartners(prts || [])
    setAllUsers(allU || [])
    setLoading(false)
  }

  async function approve(recordId, name) {
    if (!confirm(`Duyệt hồ sơ của ${name} và gửi lên Giám Đốc?`)) return
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
      const result = await createPartnerAccount({
        email: partnerForm.email,
        password: partnerForm.password,
        name: partnerForm.name,
        partnerId: newPartner.id,
      })
      if (result.error) {
        alert(`⚠️ Đã tạo đối tác nhưng tạo acc thất bại!\n${result.error}`)
      } else {
        alert(`✅ Đã tạo đối tác "${partnerForm.name}" + tài khoản đăng nhập!\n\nEmail: ${partnerForm.email}\nMật khẩu: ${partnerForm.password}`)
      }
    } else {
      alert(isCreating ? `✅ Đã thêm đối tác!` : `✅ Đã cập nhật!`)
    }

    setPartnerModal(null)
    setPartnerEditing(false)
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
    submitted: 'Chờ xác nhận', returned: 'Đã trả về',
    approved_b: 'Đã duyệt', scored: 'GĐ đã chấm',
    appealed: 'Kháng cáo', completed: 'Hoàn tất',
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
              ✅ Duyệt → Gửi GĐ
            </button>
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Đang tải...</div>

  const TABS = [
    { id: 'inbox',    icon: '📥', label: 'Chờ xác nhận', count: inbox.length },
    { id: 'done',     icon: '✅', label: 'Đã xử lý' },
    { id: 'projects', icon: '🗂', label: 'Dự án' },
    { id: 'partners', icon: '🏭', label: 'Đối tác in 3D' },
  ]

  const isCreatingProject = projectModal === 'create'
  const isCreatingPartner = partnerModal === 'create'
  const partnerHasAccount = partnerModal && partnerModal !== 'create' && partnerModal.user_id

  const canEditCurrentProject = !isCreatingProject && projectModal && projectModal.owner_id === user.id
  const canEditCurrentPartner = !isCreatingPartner && partnerModal && partnerModal.created_by === user.id

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
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">PO</div>
            <div>
              <div className="text-white text-sm font-semibold">{user.name}</div>
              <div className="text-gray-500 text-xs">PO / Chủ dự án</div>
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
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">🗂</div>
                <p>Chưa có dự án nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {projects.map(p => (
                  <button key={p.id} onClick={() => openViewProject(p)}
                    className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-gray-900/80 transition cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-bold">🗂 {p.name}</div>
                      {p.phase && <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">{p.phase}</span>}
                    </div>
                    <div className="text-gray-500 text-sm mb-2">
                      Chủ dự án: {p.users?.name || '?'}
                      {p.owner_id === user.id && <span className="ml-2 text-xs text-cyan-400">(Tôi)</span>}
                    </div>
                    {(p.contract_price > 0 || p.paid_amount > 0) && (
                      <div className="text-gray-400 text-xs">
                        💰 {Number(p.paid_amount).toLocaleString()} / {Number(p.contract_price).toLocaleString()} USD
                      </div>
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
              <div className="text-center py-16 text-gray-600">
                <div className="text-5xl mb-3 opacity-40">🏭</div>
                <p>Chưa có đối tác in 3D nào</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {partners.map(p => (
                  <button key={p.id} onClick={() => openViewPartner(p)}
                    className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-500/50 hover:bg-gray-900/80 transition cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-white font-bold">🏭 {p.name}</div>
                      <div className="flex gap-1">
                        {p.user_id && (
                          <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full" title="Đã có tài khoản">🔑</span>
                        )}
                        {p.technology && (
                          <span className="text-xs bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full">{p.technology}</span>
                        )}
                      </div>
                    </div>
                    {p.contact_person && <div className="text-gray-400 text-sm mb-1">👤 {p.contact_person}</div>}
                    {p.phone && <div className="text-gray-400 text-sm mb-1">📞 {p.phone}</div>}
                    {p.address && <div className="text-gray-500 text-xs mb-2">📍 {p.address}</div>}
                    {p.avg_price > 0 && (
                      <div className="text-gray-400 text-xs">💰 Giá TB: {Number(p.avg_price).toLocaleString()} USD</div>
                    )}
                    {p.created_by === user.id && (
                      <div className="text-cyan-400 text-xs mt-2">(Tôi tạo)</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL: Trả về */}
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
                rows={4} placeholder="Nêu rõ điểm cần bổ sung..."
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
                          {u.name} ({ROLE_LABEL[u.role]}{u.team ? ' · ' + u.team : ''}){u.id === user.id ? ' — Tôi' : ''}
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

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button onClick={() => { setProjectModal(null); setProjectEditing(false) }}
                className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">
                {(isCreatingProject || projectEditing) ? 'Hủy' : 'Đóng'}
              </button>
              {!isCreatingProject && !projectEditing && canEditCurrentProject && (
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
                  <p className="text-gray-500 text-xs -mt-2 ml-7">
                    Đối tác sẽ đăng nhập để xem thông tin, đơn in, tiến độ...
                  </p>

                  {partnerForm.create_account && (
                    <div className="grid grid-cols-2 gap-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-4">
                      <div className="col-span-2">
                        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Email đăng nhập <span className="text-red-400">*</span></label>
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

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 sticky bottom-0 bg-gray-900">
              <button onClick={() => { setPartnerModal(null); setPartnerEditing(false) }}
                className="text-gray-400 border border-gray-700 px-5 py-2 rounded-lg text-sm hover:text-white transition">
                {(isCreatingPartner || partnerEditing) ? 'Hủy' : 'Đóng'}
              </button>
              {!isCreatingPartner && !partnerEditing && canEditCurrentPartner && (
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
      )}

    </div>
  )
}