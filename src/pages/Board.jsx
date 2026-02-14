import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Board.css'

function Board({ user, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [posts, setPosts] = useState([])
  const [selectedPost, setSelectedPost] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editPostId, setEditPostId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const editorRef = useRef(null)
  const [commentsByPost, setCommentsByPost] = useState({})
  const [replyToId, setReplyToId] = useState(null)
  const [commentContent, setCommentContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const fetchPosts = async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('board_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('post_date', selectedDate)
      .order('created_at', { ascending: false })
    if (!error) setPosts(data || [])
  }

  useEffect(() => {
    fetchPosts()
  }, [user?.id, selectedDate])

  const fetchComments = async (postId) => {
    const { data, error } = await supabase
      .from('board_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (error) return
    setCommentsByPost(prev => ({ ...prev, [postId]: data || [] }))
  }

  useEffect(() => {
    if (selectedPost) fetchComments(selectedPost.id)
  }, [selectedPost?.id])

  useEffect(() => {
    setLoading(false)
  }, [])

  const getCalendarDays = () => {
    const { year, month } = calendarMonth
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = first.getDay()
    const days = []
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }

  const addPost = () => {
    setEditPostId(null)
    setEditTitle('')
    if (editorRef.current) editorRef.current.innerHTML = ''
    setShowEditor(true)
  }

  const savePost = async () => {
    const content = editorRef.current?.innerHTML ?? ''
    if (!editTitle.trim() && !content.trim()) return
    if (editPostId) {
      const { error } = await supabase
        .from('board_posts')
        .update({ title: editTitle.trim(), content, updated_at: new Date().toISOString() })
        .eq('id', editPostId)
      if (!error) {
        setShowEditor(false)
        setSelectedPost(null)
        fetchPosts()
      }
    } else {
      const { data, error } = await supabase
        .from('board_posts')
        .insert({
          user_id: user.id,
          post_date: selectedDate,
          title: editTitle.trim(),
          content
        })
        .select('id')
        .single()
      if (!error) {
        setShowEditor(false)
        fetchPosts()
        setSelectedPost(data ? { id: data.id, post_date: selectedDate, title: editTitle.trim(), content } : null)
      }
    }
  }

  const deletePost = async (id) => {
    if (!confirm('이 게시물을 삭제할까요?')) return
    const { error } = await supabase.from('board_posts').delete().eq('id', id)
    if (!error) {
      setSelectedPost(null)
      setShowEditor(false)
      fetchPosts()
    }
  }

  const openPost = (post) => {
    setSelectedPost(post)
    setShowEditor(false)
  }

  const startEditPost = (post) => {
    setEditPostId(post.id)
    setEditTitle(post.title || '')
    if (editorRef.current) editorRef.current.innerHTML = post.content || ''
    setShowEditor(true)
  }

  const cancelEdit = () => {
    setShowEditor(false)
    setEditPostId(null)
    setEditTitle('')
    if (editorRef.current) editorRef.current.innerHTML = ''
  }

  const execEditorCommand = (cmd, value = null) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }

  const submitComment = async (parentId = null) => {
    if (!commentContent.trim() || !selectedPost) return
    const { error } = await supabase.from('board_comments').insert({
      post_id: selectedPost.id,
      user_id: user.id,
      parent_id: parentId || null,
      content: commentContent.trim()
    })
    if (!error) {
      setCommentContent('')
      setReplyToId(null)
      fetchComments(selectedPost.id)
    }
  }

  const deleteComment = async (id) => {
    if (!confirm('댓글을 삭제할까요?')) return
    const { error } = await supabase.from('board_comments').delete().eq('id', id)
    if (!error) fetchComments(selectedPost.id)
  }

  const renderComments = (list, parentId = null) => {
    const roots = list.filter(c => (c.parent_id || null) === parentId)
    return roots.map(c => (
      <div key={c.id} className="board-comment" data-depth={parentId ? 1 : 0}>
        <div className="board-comment-body">
          <span className="board-comment-content">{c.content}</span>
          <span className="board-comment-meta">
            {new Date(c.created_at).toLocaleString('ko-KR')}
            <button type="button" className="board-comment-reply" onClick={() => setReplyToId(c.id)}>답글</button>
            <button type="button" className="board-comment-delete" onClick={() => deleteComment(c.id)}>삭제</button>
          </span>
        </div>
        {replyToId === c.id && (
          <div className="board-comment-form">
            <input
              type="text"
              value={commentContent}
              onChange={e => setCommentContent(e.target.value)}
              placeholder="답글 입력..."
              onKeyDown={e => e.key === 'Enter' && submitComment(c.id)}
            />
            <button type="button" onClick={() => submitComment(c.id)}>등록</button>
            <button type="button" onClick={() => { setReplyToId(null); setCommentContent('') }}>취소</button>
          </div>
        )}
        <div className="board-comment-children">
          {renderComments(list, c.id)}
        </div>
      </div>
    ))
  }

  const comments = selectedPost ? (commentsByPost[selectedPost.id] || []) : []

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
          <span className="board-board-link"> : BOARD</span>
          <button type="button" className="board-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <div className="board-body">
        <section className="board-center panel-links">
          <div className="board-toolbar">
            <div className="board-calendar-wrap">
              <div className="board-calendar-nav">
                <button type="button" onClick={() => setCalendarMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}>◀</button>
                <span>{calendarMonth.year}년 {calendarMonth.month + 1}월</span>
                <button type="button" onClick={() => setCalendarMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}>▶</button>
              </div>
              <div className="board-calendar-grid">
                {['일','월','화','수','목','금','토'].map(d => <div key={d} className="board-calendar-dow">{d}</div>)}
                {getCalendarDays().map((d, i) => (
                  d ? (
                    <button
                      key={i}
                      type="button"
                      className={`board-calendar-day ${d.toISOString().slice(0, 10) === selectedDate ? 'selected' : ''}`}
                      onClick={() => setSelectedDate(d.toISOString().slice(0, 10))}
                    >
                      {d.getDate()}
                    </button>
                  ) : <div key={i} className="board-calendar-day empty" />
                ))}
              </div>
            </div>
          </div>

          {showEditor ? (
            <div className="board-editor-block">
              <div className="board-editor-toolbar">
                <button type="button" onClick={() => execEditorCommand('bold')}>B</button>
                <button type="button" onClick={() => execEditorCommand('italic')}>I</button>
                <button type="button" onClick={() => execEditorCommand('underline')}>U</button>
                <button type="button" onClick={() => execEditorCommand('insertUnorderedList')}>목록</button>
              </div>
              <input
                type="text"
                className="board-editor-title"
                placeholder="제목"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
              />
              <div
                ref={editorRef}
                className="board-editor-content"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="내용을 입력하세요..."
              />
              <div className="board-editor-actions">
                <button type="button" className="btn-save" onClick={savePost}>저장</button>
                <button type="button" className="btn-cancel" onClick={cancelEdit}>취소</button>
                {editPostId && (
                  <button type="button" className="btn-delete" onClick={() => deletePost(editPostId)}>삭제</button>
                )}
              </div>
            </div>
          ) : selectedPost ? (
            <div className="board-post-detail">
              <div className="board-post-detail-header">
                <h2>{selectedPost.title || '(제목 없음)'}</h2>
                <span className="board-post-date">{selectedPost.post_date}</span>
                <button type="button" onClick={() => startEditPost(selectedPost)}>수정</button>
                <button type="button" onClick={() => { if (confirm('삭제할까요?')) deletePost(selectedPost.id); setSelectedPost(null); }}>삭제</button>
              </div>
              <div
                className="board-post-body"
                dangerouslySetInnerHTML={{ __html: selectedPost.content || '' }}
              />
              <div className="board-comments-section">
                <h3>댓글</h3>
                {replyToId === 'new' ? null : (
                  <div className="board-comment-form top">
                    <input
                      type="text"
                      value={commentContent}
                      onChange={e => setCommentContent(e.target.value)}
                      placeholder="댓글 입력..."
                      onKeyDown={e => e.key === 'Enter' && submitComment(null)}
                    />
                    <button type="button" onClick={() => submitComment(null)}>등록</button>
                  </div>
                )}
                <div className="board-comment-list">
                  {renderComments(comments)}
                </div>
              </div>
            </div>
          ) : (
            <div className="board-list-wrap">
              <div className="board-list-header">
                <span>{selectedDate} 게시물</span>
                <button type="button" className="btn-add" onClick={addPost}>새 글</button>
              </div>
              <ul className="board-post-list">
                {posts.length === 0 ? (
                  <li className="board-empty">이 날짜에 작성된 글이 없습니다.</li>
                ) : (
                  posts.map(p => (
                    <li key={p.id} className="board-post-item" onClick={() => openPost(p)}>
                      <span className="board-post-item-title">{p.title || '(제목 없음)'}</span>
                      <span className="board-post-item-date">{p.post_date}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Board
