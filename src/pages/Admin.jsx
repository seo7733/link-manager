import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Admin.css'

function Admin({ user, onLogout }) {
  const [stats, setStats] = useState({
    users: 0,
    categories: 0,
    links: 0,
    memos: 0
  })
  const [accessLogs, setAccessLogs] = useState([])
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [logsRes, catRes, linkRes, memoRes] = await Promise.all([
        supabase.from('access_logs').select('id, user_id, email, accessed_at').order('accessed_at', { ascending: false }).limit(200),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('links').select('id', { count: 'exact', head: true }),
        supabase.from('memos').select('id', { count: 'exact', head: true })
      ])

      if (logsRes.error) throw logsRes.error
      if (catRes.error) throw catRes.error
      if (linkRes.error) throw linkRes.error
      if (memoRes.error) throw memoRes.error

      const logs = logsRes.data || []
      setAccessLogs(logs)

      const byUser = {}
      logs.forEach(row => {
        if (!byUser[row.user_id]) {
          byUser[row.user_id] = { user_id: row.user_id, email: row.email || '(알 수 없음)', last_at: row.accessed_at, count: 0 }
        }
        byUser[row.user_id].count++
        if (new Date(row.accessed_at) > new Date(byUser[row.user_id].last_at)) {
          byUser[row.user_id].last_at = row.accessed_at
        }
      })
      setUserList(Object.values(byUser).sort((a, b) => new Date(b.last_at) - new Date(a.last_at)))

      setStats({
        users: Object.keys(byUser).length,
        categories: catRes.count ?? 0,
        links: linkRes.count ?? 0,
        memos: memoRes.count ?? 0
      })
    } catch (e) {
      setError(e.message || '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteUserData(targetUserId) {
    if (!targetUserId) return
    if (targetUserId === user.id) {
      alert('자기 자신은 삭제할 수 없습니다.')
      return
    }
    if (!confirm('해당 사용자의 모든 카테고리·링크·메모를 삭제합니다. 계속하시겠습니까?')) return

    setDeletingId(targetUserId)
    setError(null)
    try {
      const { error: e1 } = await supabase.from('memos').delete().eq('user_id', targetUserId)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('links').delete().eq('user_id', targetUserId)
      if (e2) throw e2
      const { error: e3 } = await supabase.from('categories').delete().eq('user_id', targetUserId)
      if (e3) throw e3
      await loadAll()
    } catch (e) {
      setError(e.message || '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  function formatDate(iso) {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  }

  if (user?.email !== 'jkseo1974@gmail.com') {
    return null
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link to="/" className="admin-back">← 대시보드</Link>
          <h1 className="admin-title">관리자</h1>
          <div className="admin-header-right">
            <span className="admin-user-email">{user.email}</span>
            <button type="button" className="btn-logout" onClick={onLogout}>로그아웃</button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {loading ? (
          <p className="admin-loading">로딩 중...</p>
        ) : (
          <>
            {error && <div className="admin-error">{error}</div>}

            <section className="admin-section admin-stats">
              <h2>현황 요약</h2>
              <div className="admin-stat-cards">
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.users}</span>
                  <span className="admin-stat-label">사용자 수</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.categories}</span>
                  <span className="admin-stat-label">카테고리 수</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.links}</span>
                  <span className="admin-stat-label">링크 수</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.memos}</span>
                  <span className="admin-stat-label">메모 수</span>
                </div>
              </div>
            </section>

            <section className="admin-section">
              <h2>사용자 현황</h2>
              <p className="admin-hint">회원 삭제 시 해당 사용자의 모든 카테고리·링크·메모가 삭제됩니다. Supabase Auth 계정 삭제는 Supabase 대시보드에서 진행하세요.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이메일</th>
                      <th>접속 횟수</th>
                      <th>마지막 접속</th>
                      <th>동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userList.map(u => (
                      <tr key={u.user_id}>
                        <td>{u.email}</td>
                        <td>{u.count}</td>
                        <td>{formatDate(u.last_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn-delete"
                            disabled={deletingId === u.user_id || u.user_id === user.id}
                            onClick={() => deleteUserData(u.user_id)}
                          >
                            {deletingId === u.user_id ? '삭제 중…' : '회원 삭제'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-section">
              <h2>접속 로그</h2>
              <div className="admin-table-wrap admin-log-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이메일</th>
                      <th>접속 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.map(log => (
                      <tr key={log.id}>
                        <td>{log.email || '-'}</td>
                        <td>{formatDate(log.accessed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default Admin
