import { useState } from 'react'
import { sb } from '../supabase'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('Nhập email và mật khẩu!'); return }
    setLoading(true)
    setError('')

    const { error: authError } = await sb.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email hoặc mật khẩu không đúng!')
      setLoading(false)
      return
    }

    const { data: user } = await sb.from('users').select('*').eq('email', email).single()
    if (!user) { setError('Tài khoản không tồn tại!'); setLoading(false); return }

    onLogin(user)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(168,85,247,0.06) 0%, transparent 60%)' }}>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">◈</div>
          <h1 className="text-3xl font-bold text-white tracking-wide">LevelUp</h1>
          <p className="text-gray-500 mt-2 text-sm">Hệ thống xét duyệt level kỹ sư</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white font-semibold text-lg mb-6">Đăng nhập</h2>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="email@example.com"
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition mt-2"
            >
              {loading ? 'Đang đăng nhập...' : 'Vào hệ thống →'}
            </button>
          </div>
        </div>

        {/* Flow diagram */}
        <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
          {[
            { label: 'Kỹ sư nhập', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
            { label: '⇄', color: 'text-gray-600', plain: true },
            { label: 'PO duyệt', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
            { label: '→', color: 'text-gray-600', plain: true },
            { label: 'GĐ chấm', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
            { label: '⇄', color: 'text-gray-600', plain: true },
            { label: 'Kỹ sư duyệt', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
            { label: '→', color: 'text-gray-600', plain: true },
            { label: '✓ Level', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
          ].map((s, i) => s.plain
            ? <span key={i} className={`text-sm ${s.color}`}>{s.label}</span>
            : <span key={i} className={`text-xs font-semibold px-3 py-1 rounded-lg border ${s.color}`}>{s.label}</span>
          )}
        </div>
      </div>
    </div>
  )
}