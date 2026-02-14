import { Link } from 'react-router-dom'
import BoardContent from '../components/BoardContent'
import './Board.css'

function Board({ user, onLogout }) {
  if (user?.email !== 'jkseo1974@gmail.com') {
    return (
      <div className="board-forbidden">
        <p>게시판은 관리자만 이용할 수 있습니다.</p>
        <Link to="/">메인으로</Link>
      </div>
    )
  }

  return (
    <div className="board-page">
      <header className="board-header">
        <h1 className="board-logo">
          <Link to="/" className="board-logo-btn">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="즐순이" />
          </Link>
        </h1>
        <div className="board-header-right">
          <span className="board-user-email">{user?.email}</span>
          <Link to="/admin" className="board-admin-link">ADMIN</Link>
          <Link to="/board" className="board-board-link">BOARD</Link>
          <button type="button" className="board-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <div className="board-body">
        <section className="board-center panel-links">
          <BoardContent user={user} embedded={false} />
        </section>
      </div>
    </div>
  )
}

export default Board
