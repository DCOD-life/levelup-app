import { useState, useEffect } from 'react'
import { sb } from './supabase'
import LoginPage from './pages/LoginPage'
import EngineerPage from './pages/EngineerPage'
import LeadPage from './pages/LeadPage'
import CouncilPage from './pages/CouncilPage'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Kiểm tra session hiện tại
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) loadUser(session.user.email)
      else setLoading(false)
    })

    // Lắng nghe thay đổi auth
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) loadUser(session.user.email)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadUser(email) {
    const { data } = await sb.from('users').select('*').eq('email', email).single()
    setUser(data)
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-lg">Đang tải...</div>
    </div>
  )

  if (!user) return <LoginPage onLogin={setUser} />

  if (user.role === 'engineer') return <EngineerPage user={user} onLogout={() => setUser(null)} />
  if (user.role === 'lead')     return <LeadPage user={user} onLogout={() => setUser(null)} />
  if (user.role === 'council')  return <CouncilPage user={user} onLogout={() => setUser(null)} />
}