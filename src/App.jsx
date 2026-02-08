import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import './App.css'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#94a3b8'
      }}>
        로딩 중...
      </div>
    )
  }

  return (
    <>
      {user ? <Dashboard user={user} onLogout={handleLogout} /> : <Login />}
      <footer className="app-footer">
        © 2026 Seo Jongkeun. All rights reserved.
      </footer>
    </>
  )
}

export default App