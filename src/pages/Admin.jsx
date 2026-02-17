import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Admin.css'

function Admin({ user, onLogout }) {
  const [stats, setStats] = useState({
    users: 0,
    usersWithCategory: 0,
    usersOnlyAccess: 0,
    categories: 0,
    links: 0,
    memos: 0
  })
  const [accessLogs, setAccessLogs] = useState([])
  const [userList, setUserList] = useState([])
  const [allCategories, setAllCategories] = useState([])
  const [allLinks, setAllLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [detailUserId, setDetailUserId] = useState(null)
  const [error, setError] = useState(null)
  const [userPageSize, setUserPageSize] = useState(10)
  const [userPage, setUserPage] = useState(1)
  const [logPageSize, setLogPageSize] = useState(10)
  const [logPage, setLogPage] = useState(1)
  const [schedules, setSchedules] = useState([])
  const [newSchedule, setNewSchedule] = useState({ title: '', event_date: '', event_time: '', description: '', is_notice: false, parent_id: null })
  const [editingScheduleId, setEditingScheduleId] = useState(null)
  const [editSchedule, setEditSchedule] = useState({ title: '', event_date: '', event_time: '', description: '', is_notice: false })
  const [boardCalendarMonth, setBoardCalendarMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [selectedPostId, setSelectedPostId] = useState(null)
  const [boardListPageSize, setBoardListPageSize] = useState(10)
  const [boardListPage, setBoardListPage] = useState(1)
  const [selectedBoardIds, setSelectedBoardIds] = useState([])
  const [boardSearchQuery, setBoardSearchQuery] = useState('')
  const editorBodyRef = useRef(null)
  const boardImageInputRef = useRef(null)
  const boardFileInputRef = useRef(null)
  const [boardUploading, setBoardUploading] = useState(false)
  const appliedSharePostRef = useRef(false)
  const [postComments, setPostComments] = useState([])
  const [commentInput, setCommentInput] = useState('')

  const BOARD_BUCKET = 'board-uploads'

  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isBoardView = location.pathname.includes('/board')

  // 공유 링크(?post=id)로 들어왔을 때 해당 게시글 열기
  useEffect(() => {
    if (!isBoardView || schedules.length === 0 || appliedSharePostRef.current) return
    const id = searchParams.get('post')
    if (id && schedules.some(s => s.id === id)) {
      setSelectedPostId(id)
      appliedSharePostRef.current = true
    }
  }, [isBoardView, schedules, searchParams])

  // 덧글 로드 (게시글 보기 시)
  useEffect(() => {
    if (!selectedPostId || selectedPostId === 'new' || !user?.id) {
      setPostComments([])
      return
    }
    let cancelled = false
    supabase
      .from('schedule_comments')
      .select('*')
      .eq('schedule_id', selectedPostId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setPostComments(data || [])
      })
    return () => { cancelled = true }
  }, [selectedPostId, user?.id])

  useEffect(() => {
    if (!selectedPostId) return
    const timer = setTimeout(() => {
      if (!editorBodyRef.current) return
      const html = selectedPostId === 'new' ? (newSchedule.description || '') : (editSchedule.description || '')
      editorBodyRef.current.innerHTML = html
    }, 0)
    return () => clearTimeout(timer)
  }, [selectedPostId, selectedPostId === 'new' ? newSchedule.description : editSchedule.description])

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!user?.id || !user?.email) return
    async function logAccess() {
      let ip = null
      const tryIp = async (url, getIp) => {
        try {
          const res = await fetch(url)
          if (res.ok) return getIp(await res.json())
        } catch (_) {}
        return null
      }
      ip = await tryIp('https://api.ipify.org?format=json', d => d.ip)
      if (!ip) ip = await tryIp('https://api64.ipify.org?format=json', d => d.ip)
      await supabase.from('access_logs').insert({
        user_id: user.id,
        email: user.email,
        ip: ip
      })
      loadAll()
    }
    logAccess()
  }, [user?.id, user?.email])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [logsRes, catRowsRes, catCountRes, catFullRes, linkCountRes, linkFullRes, memoRes, schedRes] = await Promise.all([
        supabase.from('access_logs').select('id, user_id, email, ip, accessed_at').order('accessed_at', { ascending: false }).limit(200),
        supabase.from('categories').select('user_id'),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id, user_id, name, parent_id, sort_order').order('sort_order', { ascending: true }),
        supabase.from('links').select('id', { count: 'exact', head: true }),
        supabase.from('links').select('id, category_id, user_id, title, url, sort_order').order('sort_order', { ascending: true }),
        supabase.from('memos').select('id', { count: 'exact', head: true }),
        user?.id ? supabase.from('schedules').select('*').eq('user_id', user.id).order('event_date', { ascending: true }).order('event_time', { ascending: true }) : Promise.resolve({ data: [] })
      ])

      if (logsRes.error) throw logsRes.error
      if (catRowsRes.error) throw catRowsRes.error
      if (catCountRes.error) throw catCountRes.error
      if (catFullRes.error) throw catFullRes.error
      if (linkCountRes.error) throw linkCountRes.error
      if (linkFullRes.error) throw linkFullRes.error
      if (memoRes.error) throw memoRes.error
      if (schedRes && schedRes.error) throw schedRes.error

      setAllCategories(catFullRes.data || [])
      setAllLinks(linkFullRes.data || [])

      const logs = logsRes.data || []
      setAccessLogs(logs)

      const categoryUserIds = new Set((catRowsRes.data || []).map(r => r.user_id).filter(Boolean))

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
      categoryUserIds.forEach(uid => {
        if (!byUser[uid]) {
          byUser[uid] = { user_id: uid, email: '(접속 기록 없음)', last_at: null, count: 0 }
        }
      })
      const catData = catFullRes.data || []
      const linkData = linkFullRes.data || []
      const list = Object.values(byUser).map(u => ({
        ...u,
        hasCategory: categoryUserIds.has(u.user_id),
        categoryCount: catData.filter(c => c.user_id === u.user_id).length,
        linkCount: linkData.filter(l => l.user_id === u.user_id).length
      })).sort((a, b) => {
        if (!a.last_at) return 1
        if (!b.last_at) return -1
        return new Date(b.last_at) - new Date(a.last_at)
      })
      setUserList(list)

      const usersOnlyAccess = list.filter(u => !u.hasCategory).length
      setStats({
        users: list.length,
        usersWithCategory: categoryUserIds.size,
        usersOnlyAccess,
        categories: catCountRes.count ?? 0,
        links: linkCountRes.count ?? 0,
        memos: memoRes.count ?? 0
      })
      setSchedules(schedRes?.data ?? [])
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

  async function fetchSchedules() {
    if (!user?.id) return
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true })
    setSchedules(data || [])
  }

  const addSchedule = async (bodyHtml) => {
    if (!newSchedule.title.trim() || !newSchedule.event_date) return
    const desc = (bodyHtml ?? newSchedule.description ?? '').trim() || null
    const { error } = await supabase.from('schedules').insert({
      user_id: user.id,
      title: newSchedule.title.trim(),
      event_date: newSchedule.event_date,
      event_time: newSchedule.event_time.trim() || null,
      description: desc,
      is_notice: Boolean(newSchedule.is_notice),
      parent_id: newSchedule.parent_id || null
    })
    if (!error) {
      const returnToParentId = newSchedule.parent_id || null
      setNewSchedule({ title: '', event_date: '', event_time: '', description: '', is_notice: false, parent_id: null })
      await fetchSchedules()
      if (returnToParentId) setSelectedPostId(returnToParentId)
    }
  }

  const startEditSchedule = (schedule) => {
    setEditingScheduleId(schedule.id)
    setEditSchedule({
      title: schedule.title || '',
      event_date: schedule.event_date || '',
      event_time: schedule.event_time || '',
      description: schedule.description || '',
      is_notice: Boolean(schedule.is_notice)
    })
  }

  const updateSchedule = async (id, bodyHtml) => {
    if (!editSchedule.title.trim() || !editSchedule.event_date) return
    const desc = (bodyHtml ?? editSchedule.description ?? '').trim() || null
    const { error } = await supabase
      .from('schedules')
      .update({
        title: editSchedule.title.trim(),
        event_date: editSchedule.event_date,
        event_time: editSchedule.event_time.trim() || null,
        description: desc,
        is_notice: Boolean(editSchedule.is_notice)
      })
      .eq('id', id)
    if (!error) {
      setEditingScheduleId(null)
      setEditSchedule({ title: '', event_date: '', event_time: '', description: '', is_notice: false })
      await fetchSchedules()
    }
  }

  const deleteSchedule = async (id) => {
    if (!confirm('이 일정을 삭제할까요?')) return
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (!error) {
      await fetchSchedules()
      if (selectedPostId === id) setSelectedPostId(null)
      setSelectedBoardIds(prev => prev.filter(x => x !== id))
    }
  }

  const toggleBoardSelection = (id, e) => {
    e.stopPropagation()
    setSelectedBoardIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const deleteSelectedBoardPosts = async () => {
    if (selectedBoardIds.length === 0) {
      alert('삭제할 게시물을 선택하세요.')
      return
    }
    if (!confirm(`선택한 ${selectedBoardIds.length}개 게시물을 삭제할까요?`)) return
    for (const id of selectedBoardIds) {
      await supabase.from('schedules').delete().eq('id', id)
    }
    setSelectedBoardIds([])
    if (selectedPostId && selectedBoardIds.includes(selectedPostId)) setSelectedPostId(null)
    await fetchSchedules()
  }

  function getBoardCalendarDays() {
    const { year, month } = boardCalendarMonth
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const startPad = first.getDay()
    const daysInMonth = last.getDate()
    const days = []
    const prevMonth = new Date(year, month - 1)
    const prevLast = new Date(year, month, 0).getDate()
    for (let i = startPad - 1; i >= 0; i--) {
      days.push({ day: prevLast - i, otherMonth: true, date: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(prevLast - i).padStart(2, '0')}` })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ day: d, otherMonth: false, date: dateStr })
    }
    const remaining = 42 - days.length
    const nextMonth = new Date(year, month + 1)
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, otherMonth: true, date: `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` })
    }
    return days
  }

  function getDaysWithPosts() {
    return [...new Set(schedules.filter(s => !s.parent_id).map(s => s.event_date).filter(Boolean))]
  }

  function formatSelectedDateLabel(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T12:00:00')
    const month = d.getMonth() + 1
    const date = d.getDate()
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const w = weekdays[d.getDay()]
    return `${month}월 ${date}일 (${w})`
  }

  const schedulesByDate = schedules.filter(s => s.event_date === selectedDate && !s.parent_id)
  const daysWithPosts = getDaysWithPosts()
  const boardCalendarDays = getBoardCalendarDays()
  const todayStr = new Date().toISOString().slice(0, 10)

  const topLevelSchedules = schedules.filter(s => !s.parent_id)
  const schedulesForList = [...topLevelSchedules].sort((a, b) => {
    const noticeA = Boolean(a.is_notice) ? 1 : 0
    const noticeB = Boolean(b.is_notice) ? 1 : 0
    if (noticeB !== noticeA) return noticeB - noticeA
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    if (ta || tb) return tb - ta
    const da = a.event_date || ''
    const db = b.event_date || ''
    if (da !== db) return db.localeCompare(da)
    return (b.event_time || '').localeCompare(a.event_time || '')
  })
  const boardSearchLower = boardSearchQuery.trim().toLowerCase()
  const schedulesFiltered = boardSearchLower
    ? schedulesForList.filter(s => {
        const title = (s.title || '').toLowerCase()
        const body = (s.description || '').replace(/<[^>]+>/g, ' ').toLowerCase()
        return title.includes(boardSearchLower) || body.includes(boardSearchLower)
      })
    : schedulesForList
  const boardListTotal = schedulesFiltered.length
  const boardListTotalPages = Math.max(1, Math.ceil(boardListTotal / boardListPageSize))
  const effectiveBoardListPage = Math.min(boardListPage, boardListTotalPages)
  const boardListPaginated = schedulesFiltered.slice((effectiveBoardListPage - 1) * boardListPageSize, effectiveBoardListPage * boardListPageSize)

  const openNewPost = () => {
    setSelectedPostId('new')
    setNewSchedule({ title: '', event_date: selectedDate, event_time: '', description: '', is_notice: false, parent_id: null })
  }

  const openViewPost = (sch) => {
    setSelectedPostId(sch.id)
    setEditingScheduleId(null)
  }

  const openEditPost = (sch) => {
    setSelectedPostId(sch.id)
    setEditingScheduleId(sch.id)
    setEditSchedule({
      title: sch.title || '',
      event_date: sch.event_date || '',
      event_time: sch.event_time || '',
      description: sch.description || '',
      is_notice: Boolean(sch.is_notice)
    })
  }

  const startEditFromView = () => {
    if (!selectedPostId || selectedPostId === 'new') return
    const sch = schedules.find(s => s.id === selectedPostId)
    if (sch) openEditPost(sch)
  }

  const copyBoardPostShareLink = async (postId) => {
    const url = new URL(window.location.href)
    url.searchParams.set('post', postId)
    try {
      await navigator.clipboard.writeText(url.toString())
      window.alert('공유 링크가 클립보드에 복사되었습니다.')
    } catch {
      window.alert('복사에 실패했습니다.')
    }
  }

  const closePostForm = () => {
    setSelectedPostId(null)
    setEditingScheduleId(null)
    setEditSchedule({ title: '', event_date: '', event_time: '', description: '', is_notice: false })
    setNewSchedule({ title: '', event_date: selectedDate, event_time: '', description: '', is_notice: false, parent_id: null })
  }

  const openReplyPost = (viewed) => {
    setSelectedPostId('new')
    setNewSchedule({
      title: '답변',
      event_date: viewed.event_date || selectedDate,
      event_time: '',
      description: '',
      is_notice: false,
      parent_id: viewed.id
    })
  }

  const addScheduleComment = async () => {
    const content = commentInput.trim()
    if (!content || !selectedPostId || selectedPostId === 'new' || !user?.id) return
    const { data, error } = await supabase
      .from('schedule_comments')
      .insert({ schedule_id: selectedPostId, user_id: user.id, content })
      .select()
      .single()
    if (!error && data) {
      setPostComments(prev => [...prev, data])
      setCommentInput('')
    }
  }

  const deleteScheduleComment = async (commentId) => {
    if (!confirm('이 덧글을 삭제할까요?')) return
    const { error } = await supabase.from('schedule_comments').delete().eq('id', commentId)
    if (!error) setPostComments(prev => prev.filter(c => c.id !== commentId))
  }

  const handleSaveNewSchedule = async () => {
    if (!newSchedule.title.trim() || !newSchedule.event_date) return
    const bodyHtml = editorBodyRef.current?.innerHTML ?? ''
    const wasReply = Boolean(newSchedule.parent_id)
    await addSchedule(bodyHtml)
    if (!wasReply) closePostForm()
  }

  function getStorageUrlsFromHtml(html) {
    if (!html) return []
    const urls = []
    const hrefRegex = /(?:href|src)=["']([^"']*board-uploads[^"']*)["']/gi
    let m
    while ((m = hrefRegex.exec(html)) !== null) urls.push(m[1].replace(/&quot;/g, '"'))
    return [...new Set(urls)]
  }

  function getStoragePathFromUrl(url) {
    const idx = url.indexOf('board-uploads/')
    if (idx === -1) return null
    const path = url.slice(idx + 'board-uploads/'.length).split('?')[0]
    return decodeURIComponent(path)
  }

  const handleSaveEditSchedule = async () => {
    if (!editingScheduleId || !editSchedule.title.trim() || !editSchedule.event_date) return
    const newHtml = editorBodyRef.current?.innerHTML ?? ''
    const oldHtml = editSchedule.description || ''
    const oldUrls = getStorageUrlsFromHtml(oldHtml)
    const newUrls = new Set(getStorageUrlsFromHtml(newHtml))
    const toRemove = oldUrls.filter(u => !newUrls.has(u))
    for (const url of toRemove) {
      const path = getStoragePathFromUrl(url)
      if (path) {
        try {
          await supabase.storage.from(BOARD_BUCKET).remove([path])
        } catch (_) {}
      }
    }
    await updateSchedule(editingScheduleId, newHtml)
    closePostForm()
  }

  function ensureLinksOpenInNewTab(html) {
    if (!html) return ''
    return html.replace(/<a (?![^>]*\btarget\s*=)/gi, '<a target="_blank" rel="noopener noreferrer" ')
  }

  function execEditorCommand(cmd, value = null) {
    document.execCommand(cmd, false, value)
    editorBodyRef.current?.focus()
  }

  function insertLink() {
    const url = prompt('링크 URL을 입력하세요:', 'https://')
    if (!url || !url.trim()) return
    const href = url.trim()
    editorBodyRef.current?.focus()
    const sel = window.getSelection()
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null
    if (range && sel.toString()) {
      document.execCommand('createLink', false, href)
    } else {
      document.execCommand('insertHTML', false, `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">${href}</a>`)
    }
  }

  async function uploadBoardFile(file, subPath = '') {
    const pathPrefix = `board/${user?.id || 'anon'}`
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = subPath ? `${pathPrefix}/${subPath}/${Date.now()}-${safeName}` : `${pathPrefix}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage.from(BOARD_BUCKET).upload(storagePath, file, { upsert: true })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from(BOARD_BUCKET).getPublicUrl(storagePath)
    return publicUrl
  }

  async function handleBoardImageUpload(e) {
    const file = e.target?.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      e.target.value = ''
      return
    }
    setBoardUploading(true)
    try {
      const url = await uploadBoardFile(file, 'images')
      editorBodyRef.current?.focus()
      document.execCommand('insertImage', false, url)
    } catch (err) {
      alert('이미지 업로드 실패: ' + (err.message || err))
    } finally {
      setBoardUploading(false)
      e.target.value = ''
    }
  }

  async function handleBoardFileAttach(e) {
    const file = e.target?.files?.[0]
    if (!file) {
      e.target.value = ''
      return
    }
    setBoardUploading(true)
    try {
      const url = await uploadBoardFile(file, 'files')
      editorBodyRef.current?.focus()
      const label = file.name
      const safeLabel = label.replace(/"/g, '&quot;')
      document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" download="${safeLabel}">📎 ${label}</a> `)
    } catch (err) {
      alert('파일 첨부 실패: ' + (err.message || err))
    } finally {
      setBoardUploading(false)
      e.target.value = ''
    }
  }

  function formatDate(iso) {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  }

  function getUserDetail(userId) {
    const cats = allCategories.filter(c => c.user_id === userId).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const linksByCat = {}
    allLinks.filter(l => l.user_id === userId).forEach(l => {
      if (!linksByCat[l.category_id]) linksByCat[l.category_id] = []
      linksByCat[l.category_id].push(l)
    })
    Object.keys(linksByCat).forEach(cid => {
      linksByCat[cid].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    })
    return { categories: cats, linksByCat }
  }

  const detailUser = detailUserId ? userList.find(u => u.user_id === detailUserId) : null
  const userDetail = detailUserId ? getUserDetail(detailUserId) : null

  const PAGE_SIZE_OPTS = [10, 20, 30]
  const totalUserPages = Math.max(1, Math.ceil(userList.length / userPageSize))
  const totalLogPages = Math.max(1, Math.ceil(accessLogs.length / logPageSize))
  const effectiveUserPage = Math.min(userPage, totalUserPages)
  const effectiveLogPage = Math.min(logPage, totalLogPages)
  const userListPaginated = userList.slice((effectiveUserPage - 1) * userPageSize, effectiveUserPage * userPageSize)
  const accessLogsPaginated = accessLogs.slice((effectiveLogPage - 1) * logPageSize, effectiveLogPage * logPageSize)

  function Pagination({ current, total, onPageChange, pageSize, pageSizeOpts, onPageSizeChange, totalItems, label, unit = '명' }) {
    const start = totalItems === 0 ? 0 : (current - 1) * pageSize + 1
    const end = Math.min(current * pageSize, totalItems)
    const totalLabel = unit === '명' ? `${totalItems}명` : `${totalItems}건`
    const pageNumbers = []
    if (total <= 7) {
      for (let p = 1; p <= total; p++) pageNumbers.push(p)
    } else {
      pageNumbers.push(1)
      if (current > 3) pageNumbers.push('...')
      for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
        if (!pageNumbers.includes(p)) pageNumbers.push(p)
      }
      if (current < total - 2) pageNumbers.push('...')
      if (total > 1) pageNumbers.push(total)
    }
    return (
      <div className="admin-pagination">
        <div className="admin-pagination-size">
          <span>{label} 표시:</span>
          <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1) }} aria-label="페이지당 개수">
            {pageSizeOpts.map(n => <option key={n} value={n}>{n}{unit}</option>)}
          </select>
        </div>
        <div className="admin-pagination-info">
          {totalItems === 0 ? (unit === '명' ? '0명' : '0건') : `${start}–${end} / 전체 ${totalLabel}`}
        </div>
        <div className="admin-pagination-pages">
          <button type="button" className="admin-page-btn" disabled={current <= 1} onClick={() => onPageChange(current - 1)} aria-label="이전 페이지">◀</button>
          {pageNumbers.map((p, i) =>
            p === '...' ? <span key={`ellipsis-${i}`} className="admin-page-ellipsis">…</span> : (
              <button key={p} type="button" className={`admin-page-btn ${p === current ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
            )
          )}
          <button type="button" className="admin-page-btn" disabled={current >= total} onClick={() => onPageChange(current + 1)} aria-label="다음 페이지">▶</button>
        </div>
      </div>
    )
  }

  if (user?.email !== 'jkseo1974@gmail.com') {
    return null
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <nav className="admin-nav-links">
            <Link to="/" className="admin-back">즐순이</Link>
            <Link to="/admin/board" className={isBoardView ? 'admin-nav-link active' : 'admin-nav-link'}>게시판</Link>
            <Link to="/admin" className={!isBoardView ? 'admin-nav-link active' : 'admin-nav-link'}>관리자</Link>
          </nav>
          <h1 className="admin-title">과거는 자산, 현재는 선물, 미래는 가능성</h1>
          <div className="admin-header-right">
            <span className="admin-user-email">{user.email}</span>
            <button type="button" className="btn-logout" onClick={onLogout}>로그아웃</button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        {loading ? (
          <p className="admin-loading">로딩 중...</p>
        ) : isBoardView ? (
          <>
            {error && <div className="admin-error">{error}</div>}
            <div className="admin-board-layout">
              {/* 좌측: 작은 달력 + 일자별 게시물 목록 */}
              <aside className="admin-board-calendar-panel">
                <div className="admin-board-cal-header">
                  <span className="admin-board-cal-month">{boardCalendarMonth.year}년 {boardCalendarMonth.month + 1}월</span>
                  <div className="admin-board-cal-nav">
                    <button type="button" className="admin-board-cal-btn" onClick={() => setBoardCalendarMonth(m => {
                      const d = new Date(m.year, m.month - 1)
                      return { year: d.getFullYear(), month: d.getMonth() }
                    })}>◀</button>
                    <button type="button" className="admin-board-cal-btn" onClick={() => {
                      const d = new Date()
                      setBoardCalendarMonth({ year: d.getFullYear(), month: d.getMonth() })
                      setSelectedDate(d.toISOString().slice(0, 10))
                    }}>오늘</button>
                    <button type="button" className="admin-board-cal-btn" onClick={() => setBoardCalendarMonth(m => {
                      const d = new Date(m.year, m.month + 1)
                      return { year: d.getFullYear(), month: d.getMonth() }
                    })}>▶</button>
                  </div>
                </div>
                <div className="admin-board-cal-grid">
                  <div className="admin-board-cal-weekdays">
                    {['일', '월', '화', '수', '목', '금', '토'].map(w => <div key={w} className="admin-board-cal-weekday">{w}</div>)}
                  </div>
                  <div className="admin-board-cal-days">
                    {boardCalendarDays.map((cell, i) => {
                      const isToday = cell.date === todayStr
                      const isSelected = cell.date === selectedDate
                      const hasPosts = daysWithPosts.includes(cell.date)
                      const dow = new Date(cell.date + 'T12:00:00').getDay()
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`admin-board-cal-day ${cell.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasPosts ? 'has-posts' : ''} ${dow === 0 ? 'sunday' : ''} ${dow === 6 ? 'saturday' : ''}`}
                          onClick={() => setSelectedDate(cell.date)}
                        >
                          {cell.day}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="admin-board-daily-summary">
                  <div className="admin-board-daily-title">
                    📋 일일 게시물 <span className="admin-board-daily-date">{formatSelectedDateLabel(selectedDate)}</span>
                  </div>
                  <div className="admin-board-daily-list">
                    {schedulesByDate.length === 0 ? (
                      <p className="admin-board-daily-empty">해당 날짜에 게시물이 없습니다.</p>
                    ) : (
                      schedulesByDate.map(sch => (
                        <div
                          key={sch.id}
                          className={`admin-board-daily-item ${selectedPostId === sch.id ? 'active' : ''}`}
                          onClick={() => openViewPost(sch)}
                        >
                          <div className="admin-board-daily-item-title">{sch.title || '(제목 없음)'}</div>
                          <div className="admin-board-daily-item-meta">{sch.event_time || '-'}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <button type="button" className="admin-board-btn-new" onClick={openNewPost}>✏️ 새 게시물 작성</button>
                </div>
              </aside>

              {/* 우측: 목록 / 뷰(본문 HTML) / 작성·수정 에디터 */}
              <div className={`admin-board-content-panel ${(selectedPostId === 'new' || selectedPostId) ? 'editor-only' : ''}`}>
                {!selectedPostId ? (
                  <div className="admin-board-list-section">
                    <div className="admin-board-list-header">
                      <h3 className="admin-board-list-title">전체 게시물 목록</h3>
                      <div className="admin-board-list-header-actions">
                        <input
                          type="search"
                          placeholder="제목·본문 검색"
                          value={boardSearchQuery}
                          onChange={(e) => { setBoardSearchQuery(e.target.value); setBoardListPage(1) }}
                          className="admin-board-search-input"
                          aria-label="게시물 검색"
                        />
                        <button type="button" className="admin-board-btn-delete-selected" onClick={deleteSelectedBoardPosts} disabled={selectedBoardIds.length === 0} title="선택 삭제">
                          🗑️ 선택 삭제
                        </button>
                        <button type="button" className="admin-board-btn-write" onClick={openNewPost}>✏️ 게시물 작성</button>
                      </div>
                    </div>
                    <div className="admin-board-list-wrap">
                      {boardListTotal === 0 ? (
                        <p className="admin-board-list-empty">등록된 게시물이 없습니다.</p>
                      ) : (
                        <ul className="admin-board-list">
                          {boardListPaginated.map((sch, idx) => {
                            const no = boardListTotal - (effectiveBoardListPage - 1) * boardListPageSize - idx
                            const isChecked = selectedBoardIds.includes(sch.id)
                            return (
                              <li
                                key={sch.id}
                                className={`admin-board-list-item ${selectedPostId === sch.id ? 'active' : ''}`}
                                onClick={() => openViewPost(sch)}
                              >
                                <label className="admin-board-list-item-check" onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={isChecked} onChange={e => toggleBoardSelection(sch.id, e)} />
                                </label>
                                <span className="admin-board-list-item-no">{no}</span>
                                <span className="admin-board-list-item-title">
                                  <span className="admin-board-list-item-title-text">{sch.title || '(제목 없음)'}</span>
                                  {sch.is_notice && <span className="admin-board-list-badge-notice">공지</span>}
                                </span>
                                <span className="admin-board-list-item-date">{sch.event_date} {sch.event_time || ''}</span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="admin-board-pagination">
                      <div className="admin-board-pagination-size">
                        <span>표시:</span>
                        <select value={boardListPageSize} onChange={(e) => { setBoardListPageSize(Number(e.target.value)); setBoardListPage(1) }} aria-label="페이지당 개수">
                          <option value={5}>5개</option>
                          <option value={10}>10개</option>
                          <option value={20}>20개</option>
                          <option value={30}>30개</option>
                        </select>
                      </div>
                      <div className="admin-board-pagination-info">
                        {boardListTotal === 0 ? '0건' : `${(effectiveBoardListPage - 1) * boardListPageSize + 1}–${Math.min(effectiveBoardListPage * boardListPageSize, boardListTotal)} / 전체 ${boardListTotal}건`}
                      </div>
                      <div className="admin-board-pagination-pages">
                        <button type="button" className="admin-board-page-btn" disabled={effectiveBoardListPage <= 1} onClick={() => setBoardListPage(p => p - 1)} aria-label="이전">◀</button>
                        {Array.from({ length: boardListTotalPages }, (_, i) => i + 1).map(p => (
                          <button key={p} type="button" className={`admin-board-page-btn ${p === effectiveBoardListPage ? 'active' : ''}`} onClick={() => setBoardListPage(p)}>{p}</button>
                        ))}
                        <button type="button" className="admin-board-page-btn" disabled={effectiveBoardListPage >= boardListTotalPages} onClick={() => setBoardListPage(p => p + 1)} aria-label="다음">▶</button>
                      </div>
                    </div>
                  </div>
                ) : selectedPostId === 'new' || editingScheduleId ? (
                  <div className="admin-board-editor-section admin-board-editor-full">
                    <h3 className="admin-board-form-title">{selectedPostId === 'new' ? '새 게시물 작성' : '게시물 수정'}</h3>
                    <div className="admin-board-editor-toolbar">
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('bold')} title="굵게"><b>B</b></button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('italic')} title="기울임"><i>I</i></button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('underline')} title="밑줄"><u>U</u></button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('strikeThrough')} title="취소선"><s>S</s></button>
                      <span className="admin-board-editor-divider" />
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('formatBlock', 'h1')} title="제목1">H1</button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('formatBlock', 'h2')} title="제목2">H2</button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('formatBlock', 'h3')} title="제목3">H3</button>
                      <span className="admin-board-editor-divider" />
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('insertUnorderedList')} title="글머리">•</button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('insertOrderedList')} title="번호">1.</button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('formatBlock', 'blockquote')} title="인용">❝</button>
                      <span className="admin-board-editor-divider" />
                      <button type="button" className="admin-board-editor-tool" onClick={() => execEditorCommand('insertHorizontalRule')} title="구분선">—</button>
                      <span className="admin-board-editor-divider" />
                      <button type="button" className="admin-board-editor-tool" onClick={insertLink} title="링크">🔗</button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => boardImageInputRef.current?.click()} title="이미지 삽입" disabled={boardUploading}>
                        🖼️
                      </button>
                      <button type="button" className="admin-board-editor-tool" onClick={() => boardFileInputRef.current?.click()} title="파일 첨부" disabled={boardUploading}>
                        📎
                      </button>
                    </div>
                    <input
                      ref={boardImageInputRef}
                      type="file"
                      accept="image/*"
                      className="admin-board-file-input-hidden"
                      onChange={handleBoardImageUpload}
                      aria-hidden
                    />
                    <input
                      ref={boardFileInputRef}
                      type="file"
                      className="admin-board-file-input-hidden"
                      onChange={handleBoardFileAttach}
                      aria-hidden
                    />
                    <div className="admin-board-editor-header">
                      <input
                        type="text"
                        className="admin-board-editor-title-input"
                        placeholder="제목을 입력하세요..."
                        value={selectedPostId === 'new' ? newSchedule.title : editSchedule.title}
                        onChange={(e) => selectedPostId === 'new' ? setNewSchedule({ ...newSchedule, title: e.target.value }) : setEditSchedule({ ...editSchedule, title: e.target.value })}
                      />
                      <div className="admin-board-editor-meta-row">
                        <input
                          type="date"
                          className="admin-schedule-input"
                          value={selectedPostId === 'new' ? newSchedule.event_date : editSchedule.event_date}
                          onChange={(e) => selectedPostId === 'new' ? setNewSchedule({ ...newSchedule, event_date: e.target.value }) : setEditSchedule({ ...editSchedule, event_date: e.target.value })}
                        />
                        <input
                          type="time"
                          className="admin-schedule-input"
                          value={selectedPostId === 'new' ? newSchedule.event_time : editSchedule.event_time}
                          onChange={(e) => selectedPostId === 'new' ? setNewSchedule({ ...newSchedule, event_time: e.target.value }) : setEditSchedule({ ...editSchedule, event_time: e.target.value })}
                        />
                        <label className="admin-board-notice-check">
                          <input
                            type="checkbox"
                            checked={selectedPostId === 'new' ? newSchedule.is_notice : editSchedule.is_notice}
                            onChange={(e) => selectedPostId === 'new' ? setNewSchedule({ ...newSchedule, is_notice: e.target.checked }) : setEditSchedule({ ...editSchedule, is_notice: e.target.checked })}
                          />
                          <span>공지</span>
                        </label>
                      </div>
                    </div>
                    <div className="admin-board-editor-body-wrap">
                      <div
                        ref={editorBodyRef}
                        className="admin-board-editor-body"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="내용을 입력하세요..."
                      />
                    </div>
                    <div className="admin-board-editor-footer">
                      <button type="button" className="admin-btn-cancel" onClick={closePostForm}>취소</button>
                      {selectedPostId !== 'new' && (
                        <button type="button" className="admin-btn-delete" onClick={() => deleteSchedule(editingScheduleId)}>삭제</button>
                      )}
                      <button type="button" className="admin-btn-schedule-add" onClick={selectedPostId === 'new' ? handleSaveNewSchedule : handleSaveEditSchedule}>💾 저장</button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-board-view-section admin-board-editor-full">
                    {(() => {
                      const viewed = schedules.find(s => s.id === selectedPostId)
                      if (!viewed) return null
                      const replies = schedules
                        .filter(s => s.parent_id === viewed.id)
                        .sort((a, b) => (new Date(b.created_at)).getTime() - (new Date(a.created_at)).getTime())
                      return (
                        <>
                          <div className="admin-board-view-header">
                            <h3 className="admin-board-view-title">{viewed.title || '(제목 없음)'}</h3>
                            <p className="admin-board-view-meta">{viewed.event_date} {viewed.event_time || ''}</p>
                          </div>
                          <div
                            className="admin-board-view-body"
                            dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(viewed.description || '') }}
                          />
                          <div className="admin-board-view-footer">
                            <button type="button" className="admin-btn-cancel" onClick={() => { setSelectedPostId(null) }}>목록</button>
                            <button type="button" className="admin-btn-share" onClick={() => copyBoardPostShareLink(viewed.id)} title="공유 링크 복사">🔗 공유</button>
                            <button type="button" className="admin-btn-reply" onClick={() => openReplyPost(viewed)}>✏️ 답변</button>
                            <button type="button" className="admin-btn-detail" onClick={startEditFromView}>수정</button>
                            <button type="button" className="admin-btn-delete" onClick={() => { deleteSchedule(viewed.id); setSelectedPostId(null) }}>삭제</button>
                          </div>
                          {replies.length > 0 && (
                            <div className="admin-board-replies">
                              <h4 className="admin-board-replies-title">답변 ({replies.length})</h4>
                              <ul className="admin-board-replies-list">
                                {replies.map(r => (
                                  <li key={r.id} className="admin-board-reply-item">
                                    <div className="admin-board-reply-header">
                                      <span className="admin-board-reply-title">{r.title || '(제목 없음)'}</span>
                                      <span className="admin-board-reply-meta">{r.event_date} {r.event_time || ''}</span>
                                    </div>
                                    <div
                                      className="admin-board-reply-body"
                                      dangerouslySetInnerHTML={{ __html: ensureLinksOpenInNewTab(r.description || '') }}
                                    />
                                    <div className="admin-board-reply-actions">
                                      <button type="button" className="admin-board-reply-btn-edit" onClick={() => openEditPost(r)}>수정</button>
                                      <button type="button" className="admin-board-reply-btn-delete" onClick={() => deleteSchedule(r.id)}>삭제</button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="admin-board-comments">
                            <h4 className="admin-board-comments-title">덧글 ({postComments.length})</h4>
                            <ul className="admin-board-comments-list">
                              {postComments.map(c => (
                                <li key={c.id} className="admin-board-comment-item">
                                  <span className="admin-board-comment-content">{c.content}</span>
                                  <span className="admin-board-comment-meta">{c.created_at ? new Date(c.created_at).toLocaleString('ko-KR') : ''}</span>
                                  <button type="button" className="admin-board-comment-delete" onClick={() => deleteScheduleComment(c.id)} aria-label="덧글 삭제">삭제</button>
                                </li>
                              ))}
                            </ul>
                            <div className="admin-board-comment-form">
                              <input
                                type="text"
                                className="admin-board-comment-input"
                                placeholder="덧글을 입력하세요..."
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addScheduleComment()}
                              />
                              <button type="button" className="admin-board-comment-submit" onClick={addScheduleComment} disabled={!commentInput.trim()}>등록</button>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {error && <div className="admin-error">{error}</div>}

            <section className="admin-section admin-stats">
              <h2>현황 요약</h2>
              <p className="admin-hint">카테고리 보유 = 카테고리를 1개 이상 만든 사용자, 접속만 = 접속 기록만 있고 카테고리는 없는 사용자입니다.</p>
              <div className="admin-stat-cards">
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.users}</span>
                  <span className="admin-stat-label">사용자 수(총)</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.usersWithCategory}</span>
                  <span className="admin-stat-label">카테고리 보유</span>
                </div>
                <div className="admin-stat-card">
                  <span className="admin-stat-value">{stats.usersOnlyAccess}</span>
                  <span className="admin-stat-label">접속만</span>
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

            <section className="admin-section admin-board-section">
              <h2>게시판</h2>
              <p className="admin-hint">캘린더 일정과 연동됩니다. 메인 화면의 일정을 목록으로 확인할 수 있습니다.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>제목</th>
                      <th>날짜</th>
                      <th>시간</th>
                      <th>설명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="admin-board-empty">등록된 일정이 없습니다.</td>
                      </tr>
                    ) : (
                      schedules.map(sch => (
                        <tr key={sch.id}>
                          <td>{sch.title || '-'}</td>
                          <td>{sch.event_date || '-'}</td>
                          <td>{sch.event_time || '-'}</td>
                          <td>{sch.description ? String(sch.description).slice(0, 80) + (String(sch.description).length > 80 ? '…' : '') : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-section">
              <h2>사용자 현황</h2>
              <p className="admin-hint">회원 삭제 시 해당 사용자의 모든 카테고리·링크·메모가 삭제됩니다. Supabase Auth 계정 삭제는 Supabase 대시보드에서 진행하세요.</p>
              <Pagination
                current={effectiveUserPage}
                total={totalUserPages}
                onPageChange={setUserPage}
                pageSize={userPageSize}
                pageSizeOpts={PAGE_SIZE_OPTS}
                onPageSizeChange={setUserPageSize}
                totalItems={userList.length}
                label="한 페이지에"
                unit="명"
              />
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이메일</th>
                      <th>구분</th>
                      <th>카테고리 수</th>
                      <th>링크 수</th>
                      <th>접속 횟수</th>
                      <th>마지막 접속</th>
                      <th>동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userListPaginated.map(u => (
                      <tr key={u.user_id}>
                        <td>{u.email}</td>
                        <td>
                          <span className={`admin-badge ${u.hasCategory ? 'admin-badge-category' : 'admin-badge-access'}`}>
                            {u.hasCategory ? '카테고리 보유' : '접속만'}
                          </span>
                        </td>
                        <td>{u.categoryCount ?? 0}</td>
                        <td>{u.linkCount ?? 0}</td>
                        <td>{u.count}</td>
                        <td>{formatDate(u.last_at)}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              type="button"
                              className="admin-btn-detail"
                              onClick={() => setDetailUserId(u.user_id)}
                            >
                              내역 보기
                            </button>
                            <button
                              type="button"
                              className="admin-btn-delete"
                              disabled={deletingId === u.user_id || u.user_id === user.id}
                              onClick={() => deleteUserData(u.user_id)}
                            >
                              {deletingId === u.user_id ? '삭제 중…' : '회원 삭제'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-section">
              <h2>접속 로그</h2>
              <Pagination
                current={effectiveLogPage}
                total={totalLogPages}
                onPageChange={setLogPage}
                pageSize={logPageSize}
                pageSizeOpts={PAGE_SIZE_OPTS}
                onPageSizeChange={setLogPageSize}
                totalItems={accessLogs.length}
                label="한 페이지에"
                unit="건"
              />
              <div className="admin-table-wrap admin-log-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이메일</th>
                      <th>접속 IP</th>
                      <th>접속 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogsPaginated.map(log => (
                      <tr key={log.id}>
                        <td>{log.email || '-'}</td>
                        <td>{log.ip || '-'}</td>
                        <td>{formatDate(log.accessed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {detailUser && userDetail && (
              <div className="admin-modal-overlay" onClick={() => setDetailUserId(null)} role="presentation">
                <div className="admin-modal" onClick={e => e.stopPropagation()}>
                  <div className="admin-modal-header">
                    <h3>카테고리·링크 내역 — {detailUser.email}</h3>
                    <button type="button" className="admin-modal-close" onClick={() => setDetailUserId(null)} aria-label="닫기">×</button>
                  </div>
                  <div className="admin-modal-body">
                    {userDetail.categories.length === 0 ? (
                      <p className="admin-modal-empty">카테고리·링크 없음</p>
                    ) : (
                      <ul className="admin-detail-list">
                        {userDetail.categories.map(cat => (
                          <li key={cat.id} className="admin-detail-category">
                            <span className="admin-detail-cat-name">📁 {cat.name}</span>
                            <ul className="admin-detail-links">
                              {(userDetail.linksByCat[cat.id] || []).map(link => (
                                <li key={link.id}>
                                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="admin-detail-link">
                                    {link.title || '(제목 없음)'}
                                  </a>
                                  {link.url && <span className="admin-detail-url">{link.url}</span>}
                                </li>
                              ))}
                              {(userDetail.linksByCat[cat.id] || []).length === 0 && (
                                <li className="admin-detail-empty">링크 없음</li>
                              )}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default Admin
