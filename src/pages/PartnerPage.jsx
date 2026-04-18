import { useState, useEffect } from 'react'
import { sb } from '../supabase'

export default function PartnerPage({ user, onLogout }) {
  const [partner, setPartner] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    // Tìm thông tin đối tác theo user_id
    const { data } = await sb.from('printing_partners')
      .select('*, users!created_by(name)')
      .eq('user_id', user.id)
      .single()
    setPartner(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
      Đang tải...
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 flex">

      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="p-5 border-b border-gray-800">
          <span className="text-white font-bold text-lg">◈ LevelUp</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-500/10 text-indigo-400">
            <span>🏭</span>
            <span className="flex-1 text-left">Hồ sơ của tôi</span>
          </div>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">🏭</div>
            <div>
              <div className="text-white text-sm font-semibold">{user.name}</div>
              <div className="text-gray-500 text-xs">Đối tác in 3D</div>
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
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-white mb-2">Chào mừng, {user.name}! 👋</h2>
          <p className="text-gray-500 text-sm mb-8">Trang dành riêng cho đối tác in 3D</p>

          {/* Banner tạm */}
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚧</span>
              <div>
                <div className="text-indigo-300 font-semibold mb-1">Tính năng đang phát triển</div>
                <p className="text-indigo-400/80 text-sm">
                  Các tính năng sẽ sớm ra mắt: xem đơn in được giao, cập nhật tiến độ (đang in / đã in xong),
                  xác nhận đơn đặt, xác nhận đơn đã in, tổng kết số tiền.
                </p>
              </div>
            </div>
          </div>

          {/* Thông tin đối tác */}
          {partner ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-bold text-lg">🏭 {partner.name}</h3>
                {partner.technology && (
                  <span className="text-xs bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full">
                    {partner.technology}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {partner.contact_person && (
                  <InfoRow label="Người liên hệ" value={partner.contact_person} />
                )}
                {partner.phone && (
                  <InfoRow label="Số điện thoại" value={partner.phone} />
                )}
                {partner.address && (
                  <InfoRow label="Địa chỉ" value={partner.address} />
                )}
                {partner.avg_price > 0 && (
                  <InfoRow label="Giá trung bình" value={`${Number(partner.avg_price).toLocaleString()} USD`} />
                )}
                {partner.notes && (
                  <InfoRow label="Ghi chú" value={partner.notes} />
                )}
                {partner.users?.name && (
                  <InfoRow label="Tạo bởi" value={partner.users.name} />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5">
              <p className="text-yellow-400 text-sm">
                ⚠️ Không tìm thấy thông tin đối tác liên kết với tài khoản này.
                Vui lòng liên hệ Giám Đốc hoặc PO để được hỗ trợ.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex gap-4 py-2 border-b border-gray-800/50 last:border-0">
      <div className="text-gray-500 text-sm w-36 shrink-0">{label}</div>
      <div className="text-white text-sm">{value}</div>
    </div>
  )
}