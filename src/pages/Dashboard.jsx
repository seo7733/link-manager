import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

const WELCOME_QUOTES = [
  { text: '오늘 할 일을 내일로 미루지 마라.', author: '벤자민 프랭클린' },
  { text: '시작이 반이다.', author: '플라톤' },
  { text: '배움에는 왕도가 없다.', author: '유클리드' },
  { text: '성공은 매일 반복한 작은 노력의 합이다.', author: '로버트 콜리어' },
  { text: '지금이 살기 가장 좋은 때다.', author: '월트 휘트먼' },
  { text: '실패는 성공의 어머니다.', author: '토마스 에디슨' },
  { text: '오늘 당신이 어디에 있든, 거기서 시작하라.', author: '아르투어 숀펜하우어' },
  { text: '노력은 배신하지 않는다.', author: '일본 속담' },
  { text: '작은 습관이 인생을 바꾼다.', author: '제임스 클리어' },
  { text: '당신이 생각하므로 당신이 된다.', author: '노르만 빈센트 필' },
  { text: '오늘 하루를 최선으로 살아라.', author: '랄프 왈도 에머슨' },
  { text: '끝이 좋으면 다 좋다.', author: '윌리엄 셰익스피어' },
  { text: '기회는 준비된 자에게만 온다.', author: '루이 파스퇴르' },
  { text: '한 걸음 한 걸음이 모여 길이 된다.', author: '속담' },
  { text: '오늘의 나는 어제의 나보다 나은 사람이 되자.', author: '칼 로저스' },
]

const ENABLE_LOCAL_SCHEDULES = false

// URL을 링크로 변환하는 함수
const convertUrlsToLinks = (text) => {
  if (!text) return null
  
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#6366f1', textDecoration: 'underline' }}
        >
          {part}
        </a>
      )
    }
    return <span key={index}>{part}</span>
  })
}

function Dashboard({ user, onLogout }) {
  const [categories, setCategories] = useState([])
  const [links, setLinks] = useState([])
  const [allLinks, setAllLinks] = useState([])
  const [memos, setMemos] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedLink, setSelectedLink] = useState(null)
  const [loading, setLoading] = useState(true)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [addingSubTo, setAddingSubTo] = useState(null)
  const [newSubCategoryName, setNewSubCategoryName] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})

  const [showLinkForm, setShowLinkForm] = useState(false)
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '', showOnMain: true })
  const [editingLink, setEditingLink] = useState(null)
  const [editLink, setEditLink] = useState({ title: '', url: '', description: '', category_id: null, show_on_main: true })

  const [newMemo, setNewMemo] = useState('')
  const [editingMemo, setEditingMemo] = useState(null)
  const [editMemoContent, setEditMemoContent] = useState('')

  const [stickerMemos, setStickerMemos] = useState([])
  const [stickerMemoFilesMap, setStickerMemoFilesMap] = useState({})
  const [newStickerMemoContent, setNewStickerMemoContent] = useState('')
  const [newStickerMemoFileList, setNewStickerMemoFileList] = useState([])
  const [editingStickerMemoId, setEditingStickerMemoId] = useState(null)
  const [editStickerMemoContent, setEditStickerMemoContent] = useState('')
  const [stickerMemoFileUrls, setStickerMemoFileUrls] = useState({})

  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')
  const [editingTodoId, setEditingTodoId] = useState(null)
  const [editTodoContent, setEditTodoContent] = useState('')
  const [todoPageSize, setTodoPageSize] = useState(() => {
    const saved = localStorage.getItem('todoPageSize')
    return saved ? parseInt(saved, 10) : 3
  })
  const [todoPage, setTodoPage] = useState(1)

  const calendarEmbedUrl = import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL || ''

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [externalSearchQuery, setExternalSearchQuery] = useState('')
  const [externalSearchEngine, setExternalSearchEngine] = useState('naver')
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * WELCOME_QUOTES.length))
  const [linkPageSize, setLinkPageSize] = useState(() => {
    const saved = localStorage.getItem('linkPageSize')
    return saved ? parseInt(saved, 10) : 10
  })
  const [linkPage, setLinkPage] = useState(1)
  const [favLinkPageSize, setFavLinkPageSize] = useState(() => {
    const saved = localStorage.getItem('favLinkPageSize')
    const n = saved ? parseInt(saved, 10) : 20
    return [20, 30, 40, 0].includes(n) ? n : 20
  })
  const [favLinkPage, setFavLinkPage] = useState(1)
  const linksPanelRef = useRef(null)
  const [memoPanelWidth, setMemoPanelWidth] = useState(() => {
    const saved = localStorage.getItem('memoPanelWidth')
    return saved ? parseInt(saved, 10) : 320
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizerRef = useRef(null)

  useEffect(() => {
    fetchCategories()
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
    }
    logAccess()
  }, [user?.id, user?.email])

  useEffect(() => {
    localStorage.setItem('memoPanelWidth', memoPanelWidth.toString())
  }, [memoPanelWidth])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX
      const minWidth = 200
      const maxWidth = Math.min(800, window.innerWidth - 300)
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setMemoPanelWidth(newWidth)
      }
    }
    const handleMouseUp = () => {
      setIsResizing(false)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  useEffect(() => {
    setSearchResults(null)
    if (selectedCategory) {
      fetchLinks(selectedCategory.id)
    } else {
      setLinks([])
    }
    // 카테고리 변경 시 선택된 링크/메모와 링크 등록 폼 초기화
    setSelectedLink(null)
    setMemos([])
    setShowLinkForm(false)
  }, [selectedCategory])

  useEffect(() => {
    if (selectedLink) {
      fetchMemos(selectedLink.id)
    } else {
      setMemos([])
    }
  }, [selectedLink])

  const fetchCategories = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    if (!error) setCategories(data || [])
    setLoading(false)
  }

  const fetchAllLinks = async () => {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id)
      .order('main_sort_order', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })
    if (!error) setAllLinks(data || [])
  }

  useEffect(() => {
    fetchAllLinks()
  }, [user?.id])

  const fetchLinks = async (categoryId) => {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true })
    if (!error) setLinks(data || [])
  }

  const fetchMemos = async (linkId) => {
    const { data, error } = await supabase
      .from('memos')
      .select('*')
      .eq('user_id', user.id)
      .eq('link_id', linkId)
      .order('created_at', { ascending: false })
    if (!error) setMemos(data || [])
  }

  const fetchTodos = async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
    if (!error) setTodos(data || [])
  }

  useEffect(() => {
    fetchTodos()
  }, [user?.id])

  useEffect(() => {
    localStorage.setItem('todoPageSize', todoPageSize.toString())
  }, [todoPageSize])

  useEffect(() => {
    localStorage.setItem('linkPageSize', linkPageSize.toString())
  }, [linkPageSize])

  useEffect(() => {
    setLinkPage(1)
  }, [selectedCategory?.id, searchResults, linkPageSize])

  useEffect(() => {
    localStorage.setItem('favLinkPageSize', favLinkPageSize.toString())
  }, [favLinkPageSize])

  useEffect(() => {
    setFavLinkPage(1)
  }, [favLinkPageSize])

  // 트리 구조 만들기 (형제는 sort_order로 정렬)
  const buildTree = (items, parentId = null) => {
    return items
      .filter(item => item.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(item => ({
        ...item,
        children: buildTree(items, item.id)
      }))
  }

  const categoryTree = buildTree(categories)

  const toggleExpand = (id) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const hasChildren = (id) => {
    return categories.some(cat => cat.parent_id === id)
  }

  // 같은 부모下的 형제 카테고리 목록 (sort_order 순)
  const getSiblingCategories = (parentId) => {
    return categories
      .filter(c => c.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  }

  // 카테고리 CRUD
  const addCategory = async (parentId = null) => {
    const name = parentId ? newSubCategoryName : newCategoryName
    if (!name.trim()) return
    const siblings = getSiblingCategories(parentId)
    const nextOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order ?? 0)) + 1 : 0
    const { error } = await supabase.from('categories').insert({
      name: name.trim(),
      user_id: user.id,
      parent_id: parentId,
      sort_order: nextOrder
    })
    if (!error) {
      if (parentId) {
        setNewSubCategoryName('')
        setAddingSubTo(null)
        setExpandedCategories(prev => ({ ...prev, [parentId]: true }))
      } else {
        setNewCategoryName('')
      }
      fetchCategories()
    }
  }

  const updateCategory = async (id) => {
    if (!editCategoryName.trim()) return
    const { error } = await supabase
      .from('categories')
      .update({ name: editCategoryName.trim() })
      .eq('id', id)
    if (!error) {
      setEditingCategory(null)
      fetchCategories()
    }
  }

  const deleteCategory = async (id) => {
    if (!confirm('이 카테고리와 포함된 모든 하위 카테고리/링크/메모가 삭제됩니다. 계속하시겠습니까?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (!error) {
      if (selectedCategory?.id === id) setSelectedCategory(null)
      fetchCategories()
    }
  }

  const moveCategory = async (cat, direction) => {
    const siblings = getSiblingCategories(cat.parent_id)
    const idx = siblings.findIndex(s => s.id === cat.id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return
    const other = siblings[swapIdx]
    const catOrder = cat.sort_order ?? 0
    const otherOrder = other.sort_order ?? 0
    const { error: e1 } = await supabase.from('categories').update({ sort_order: otherOrder }).eq('id', cat.id)
    const { error: e2 } = await supabase.from('categories').update({ sort_order: catOrder }).eq('id', other.id)
    if (!e1 && !e2) fetchCategories()
  }

  // 링크 CRUD
  const addLink = async () => {
    if (!newLink.title.trim() || !newLink.url.trim()) return
    const minOrder = links.length > 0 ? Math.min(...links.map(l => l.sort_order ?? 0)) : 0
    const nextOrder = minOrder - 1
    const { error } = await supabase.from('links').insert({
      title: newLink.title.trim(),
      url: newLink.url.trim(),
      description: newLink.description.trim(),
      category_id: selectedCategory.id,
      user_id: user.id,
      sort_order: nextOrder,
      show_on_main: !!newLink.showOnMain
    })
    if (!error) {
      setNewLink({ title: '', url: '', description: '', showOnMain: true })
      setShowLinkForm(false)
      fetchLinks(selectedCategory.id)
      fetchAllLinks()
    }
  }

  const updateLink = async (id) => {
    if (!editLink.title.trim() || !editLink.url.trim() || !editLink.category_id) return
    const oldCategoryId = links.find(l => l.id === id)?.category_id
    const { error } = await supabase
      .from('links')
      .update({
        title: editLink.title.trim(),
        url: editLink.url.trim(),
        description: editLink.description.trim(),
        category_id: editLink.category_id,
        show_on_main: !!editLink.show_on_main
      })
      .eq('id', id)
    if (!error) {
      setEditingLink(null)
      fetchAllLinks()
      if (editLink.category_id === selectedCategory?.id) {
        fetchLinks(selectedCategory.id)
      } else if (oldCategoryId === selectedCategory?.id) {
        fetchLinks(selectedCategory.id)
      }
    }
  }

  const getFaviconUrl = (url) => {
    try {
      const host = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${host}&sz=64`
    } catch {
      return ''
    }
  }

  const linksForGrid = searchResults === null
    ? (selectedCategory ? links : allLinks)
        .filter(l => l.show_on_main !== false)
        .sort((a, b) => (a.main_sort_order ?? 999999) - (b.main_sort_order ?? 999999))
    : []
  const showShortcutGrid = searchResults === null && linksForGrid.length > 0
  const favTotalPages = favLinkPageSize === 0 ? 1 : Math.max(1, Math.ceil(linksForGrid.length / favLinkPageSize))
  const paginatedFavLinks = favLinkPageSize === 0 ? linksForGrid : linksForGrid.slice((favLinkPage - 1) * favLinkPageSize, favLinkPage * favLinkPageSize)

  useEffect(() => {
    const total = favLinkPageSize === 0 ? 1 : Math.max(1, Math.ceil(linksForGrid.length / favLinkPageSize))
    if (favLinkPage > total) setFavLinkPage(total)
  }, [linksForGrid.length, favLinkPageSize])

  const updateMainSortOrder = async (orderedIds) => {
    const updates = orderedIds.map((id, index) => supabase.from('links').update({ main_sort_order: index }).eq('id', id))
    await Promise.all(updates)
    fetchAllLinks()
    if (selectedCategory) fetchLinks(selectedCategory.id)
  }

  const handleShortcutDragStart = (e, linkId) => {
    e.dataTransfer.setData('text/plain', linkId)
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.classList.add('link-shortcut-dragging')
  }

  const handleShortcutDragEnd = (e) => {
    e.currentTarget.classList.remove('link-shortcut-dragging')
  }

  const handleShortcutDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleShortcutDrop = (e, targetLinkId) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetLinkId) return
    const ids = linksForGrid.map(l => l.id)
    const fromIdx = ids.indexOf(sourceId)
    const toIdx = ids.indexOf(targetLinkId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, sourceId)
    updateMainSortOrder(reordered)
  }

  const flattenCategories = (items, parentId = null, level = 0) => {
    const result = []
    items
      .filter(item => item.parent_id === parentId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .forEach(item => {
        result.push({ ...item, level })
        result.push(...flattenCategories(items, item.id, level + 1))
      })
    return result
  }

  const deleteLink = async (id) => {
    if (!confirm('이 링크와 관련 메모가 모두 삭제됩니다. 계속하시겠습니까?')) return
    const { error } = await supabase.from('links').delete().eq('id', id)
    if (!error) {
      if (selectedLink?.id === id) setSelectedLink(null)
      fetchLinks(selectedCategory.id)
      fetchAllLinks()
    }
  }

  const moveLink = async (link, direction) => {
    const idx = links.findIndex(l => l.id === link.id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= links.length) return
    const other = links[swapIdx]
    const linkOrder = link.sort_order ?? 0
    const otherOrder = other.sort_order ?? 0
    const { error: e1 } = await supabase.from('links').update({ sort_order: otherOrder }).eq('id', link.id)
    const { error: e2 } = await supabase.from('links').update({ sort_order: linkOrder }).eq('id', other.id)
    if (!e1 && !e2) fetchLinks(selectedCategory.id)
  }

  // 할일 목록 CRUD
  const addTodo = async () => {
    if (!newTodo.trim()) return
    const minSortOrder = todos.length > 0 ? Math.min(...todos.map(t => t.sort_order ?? 0)) : 0
    const { error } = await supabase.from('todos').insert({
      content: newTodo.trim(),
      user_id: user.id,
      sort_order: minSortOrder - 1
    })
    if (!error) {
      setNewTodo('')
      fetchTodos()
      setTodoPage(1)
    }
  }

  const updateTodo = async (id) => {
    if (!editTodoContent.trim()) return
    const { error } = await supabase
      .from('todos')
      .update({ content: editTodoContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setEditingTodoId(null)
      setEditTodoContent('')
      fetchTodos()
    }
  }

  const deleteTodo = async (id) => {
    if (!confirm('이 할일을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (!error) {
      fetchTodos()
    }
  }

  const toggleTodoCompleted = async (id, completed) => {
    const { error } = await supabase
      .from('todos')
      .update({ completed: !completed, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      fetchTodos()
    }
  }

  const moveTodo = async (todo, direction) => {
    const sortedTodos = [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const idx = sortedTodos.findIndex(t => t.id === todo.id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedTodos.length) return
    const other = sortedTodos[swapIdx]
    const todoOrder = todo.sort_order ?? 0
    const otherOrder = other.sort_order ?? 0
    const { error: e1 } = await supabase.from('todos').update({ sort_order: otherOrder }).eq('id', todo.id)
    const { error: e2 } = await supabase.from('todos').update({ sort_order: todoOrder }).eq('id', other.id)
    if (!e1 && !e2) fetchTodos()
  }

  // 메모 CRUD
  const addMemo = async () => {
    if (!newMemo.trim()) return
    const { error } = await supabase.from('memos').insert({
      content: newMemo.trim(),
      link_id: selectedLink.id,
      user_id: user.id
    })
    if (!error) {
      setNewMemo('')
      fetchMemos(selectedLink.id)
    }
  }

  const updateMemo = async (id) => {
    if (!editMemoContent.trim()) return
    const { error } = await supabase
      .from('memos')
      .update({ content: editMemoContent.trim() })
      .eq('id', id)
    if (!error) {
      setEditingMemo(null)
      fetchMemos(selectedLink.id)
    }
  }

  const deleteMemo = async (id) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return
    const { error } = await supabase.from('memos').delete().eq('id', id)
    if (!error) {
      fetchMemos(selectedLink.id)
    }
  }

  const STICKER_BUCKET = 'sticker-memo-attachments'

  const fetchStickerMemos = async () => {
    if (!user?.id) return
    const { data: memosData, error: memosError } = await supabase
      .from('sticker_memos')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    if (memosError) return
    setStickerMemos(memosData || [])
    const memoIds = (memosData || []).map(m => m.id)
    if (memoIds.length === 0) {
      setStickerMemoFilesMap({})
      return
    }
    const { data: filesData, error: filesError } = await supabase
      .from('sticker_memo_files')
      .select('*')
      .in('sticker_memo_id', memoIds)
    if (filesError) return
    const byMemo = {}
    ;(filesData || []).forEach(f => {
      if (!byMemo[f.sticker_memo_id]) byMemo[f.sticker_memo_id] = []
      byMemo[f.sticker_memo_id].push(f)
    })
    setStickerMemoFilesMap(byMemo)
    const urlMap = {}
    for (const f of (filesData || [])) {
      const { data: urlData } = await supabase.storage.from(STICKER_BUCKET).createSignedUrl(f.storage_path, 3600)
      if (urlData?.signedUrl) urlMap[f.id] = urlData.signedUrl
    }
    setStickerMemoFileUrls(urlMap)
  }

  useEffect(() => {
    fetchStickerMemos()
  }, [user?.id])

  const addStickerMemo = async () => {
    if (!newStickerMemoContent.trim() && newStickerMemoFileList.length === 0) return
    const minSortOrder = stickerMemos.length > 0 ? Math.min(...stickerMemos.map(m => m.sort_order ?? 0)) : 0
    const { data: inserted, error: insertError } = await supabase
      .from('sticker_memos')
      .insert({ user_id: user.id, content: newStickerMemoContent.trim() || '', sort_order: minSortOrder - 1 })
      .select('id')
      .single()
    if (insertError || !inserted) return
    const memoId = inserted.id
    const pathPrefix = `${user.id}/${memoId}`
    for (let i = 0; i < newStickerMemoFileList.length; i++) {
      const file = newStickerMemoFileList[i]
      const safeName = `${Date.now()}_${i}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storagePath = `${pathPrefix}/${safeName}`
      const { error: uploadError } = await supabase.storage.from(STICKER_BUCKET).upload(storagePath, file, { upsert: false })
      if (!uploadError) {
        await supabase.from('sticker_memo_files').insert({
          sticker_memo_id: memoId,
          user_id: user.id,
          file_name: file.name,
          storage_path: storagePath,
          file_size: file.size
        })
      }
    }
    setNewStickerMemoContent('')
    setNewStickerMemoFileList([])
    if (document.getElementById('sticker-memo-file-input')) document.getElementById('sticker-memo-file-input').value = ''
    fetchStickerMemos()
  }

  const updateStickerMemo = async (id) => {
    const { error } = await supabase
      .from('sticker_memos')
      .update({ content: editStickerMemoContent.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) {
      setEditingStickerMemoId(null)
      setEditStickerMemoContent('')
      fetchStickerMemos()
    }
  }

  const moveStickerMemo = async (memo, direction) => {
    const sortedMemos = [...stickerMemos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const idx = sortedMemos.findIndex(m => m.id === memo.id)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sortedMemos.length) return
    const other = sortedMemos[swapIdx]
    const memoOrder = memo.sort_order ?? 0
    const otherOrder = other.sort_order ?? 0
    const { error: e1 } = await supabase.from('sticker_memos').update({ sort_order: otherOrder }).eq('id', memo.id)
    const { error: e2 } = await supabase.from('sticker_memos').update({ sort_order: memoOrder }).eq('id', other.id)
    if (!e1 && !e2) fetchStickerMemos()
  }

  const deleteStickerMemo = async (id) => {
    if (!confirm('이 스티커 메모를 삭제하시겠습니까? 첨부파일도 함께 삭제됩니다.')) return
    const files = stickerMemoFilesMap[id] || []
    for (const f of files) {
      await supabase.storage.from(STICKER_BUCKET).remove([f.storage_path])
    }
    await supabase.from('sticker_memo_files').delete().eq('sticker_memo_id', id)
    const { error } = await supabase.from('sticker_memos').delete().eq('id', id)
    if (!error) fetchStickerMemos()
  }

  const removeStickerMemoFile = async (fileId, storagePath) => {
    await supabase.storage.from(STICKER_BUCKET).remove([storagePath])
    await supabase.from('sticker_memo_files').delete().eq('id', fileId)
    fetchStickerMemos()
  }

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action()
  }

  const goToFirstScreen = () => {
    setSearchResults(null)
    setSelectedCategory(null)
    setSelectedLink(null)
    setQuoteIndex(Math.floor(Math.random() * WELCOME_QUOTES.length))
  }

  const handleExternalSearch = (e) => {
    e?.preventDefault()
    const q = externalSearchQuery?.trim()
    if (!q) return
    const url = externalSearchEngine === 'naver'
      ? `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`
      : `https://www.google.com/search?q=${encodeURIComponent(q)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const runSearch = async () => {
    const q = searchQuery?.trim().toLowerCase()
    if (!q) {
      setSearchResults(null)
      return
    }
    const { data: allLinks } = await supabase.from('links').select('*').eq('user_id', user.id)
    const linkIds = (allLinks || []).map(l => l.id)
    const { data: memosData } = linkIds.length > 0
      ? await supabase.from('memos').select('link_id, content').eq('user_id', user.id).in('link_id', linkIds)
      : { data: [] }
    const memosByLink = {}
    ;(memosData || []).forEach(m => {
      if (!memosByLink[m.link_id]) memosByLink[m.link_id] = []
      memosByLink[m.link_id].push(m.content || '')
    })
    const getCategoryName = (id) => (categories.find(c => c.id === id) || {}).name || ''
    const matched = (allLinks || []).filter(link => {
      const catName = getCategoryName(link.category_id).toLowerCase()
      const matchCat = catName.includes(q)
      const matchLink = [link.title, link.url, link.description].some(s => (s || '').toLowerCase().includes(q))
      const matchMemo = (memosByLink[link.id] || []).some(content => (content || '').toLowerCase().includes(q))
      return matchCat || matchLink || matchMemo
    }).map(link => ({ ...link, categoryName: getCategoryName(link.category_id) }))
    setSearchResults(matched)
    setSelectedLink(null)
  }

  // 카테고리 트리 렌더링
  const renderCategoryItem = (cat, depth = 0, siblingIndex = 0, siblingCount = 1) => {
    const isExpanded = expandedCategories[cat.id]
    const hasChild = hasChildren(cat.id)
    const canMoveUp = siblingIndex > 0
    const canMoveDown = siblingIndex < siblingCount - 1

    return (
      <div key={cat.id}>
        <li
          className={`item ${selectedCategory?.id === cat.id ? 'active' : ''}`}
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          {editingCategory === cat.id ? (
            <div className="edit-form">
              <input
                type="text"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => updateCategory(cat.id))}
                autoFocus
              />
              <button className="btn-save" onClick={() => updateCategory(cat.id)}>저장</button>
              <button className="btn-cancel" onClick={() => setEditingCategory(null)}>취소</button>
            </div>
          ) : (
            <>
              <div className="category-name-row" onClick={() => setSelectedCategory(cat)}>
                {hasChild && (
                  <span
                    className="expand-toggle"
                    onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id) }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </span>
                )}
                {!hasChild && <span className="expand-placeholder" />}
                <span className="item-name">
                  {depth > 0 ? '' : '📁 '}{cat.name}
                </span>
              </div>
              <div className="item-actions">
                {canMoveUp && <button title="위로" onClick={(e) => { e.stopPropagation(); moveCategory(cat, 'up') }}>⬆️</button>}
                {canMoveDown && <button title="아래로" onClick={(e) => { e.stopPropagation(); moveCategory(cat, 'down') }}>⬇️</button>}
                <button title="하위 카테고리 추가" onClick={(e) => { e.stopPropagation(); setAddingSubTo(cat.id); setNewSubCategoryName(''); setExpandedCategories(prev => ({ ...prev, [cat.id]: true })) }}>➕</button>
                <button onClick={(e) => { e.stopPropagation(); setEditingCategory(cat.id); setEditCategoryName(cat.name) }}>✏️</button>
                <button onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id) }}>🗑️</button>
              </div>
            </>
          )}
        </li>

        {addingSubTo === cat.id && (
          <li className="item sub-add-form" style={{ paddingLeft: `${36 + depth * 20}px` }}>
            <div className="edit-form">
              <input
                type="text"
                placeholder="하위 카테고리 이름"
                value={newSubCategoryName}
                onChange={(e) => setNewSubCategoryName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, () => addCategory(cat.id))}
                autoFocus
              />
              <button className="btn-save" onClick={() => addCategory(cat.id)}>추가</button>
              <button className="btn-cancel" onClick={() => setAddingSubTo(null)}>취소</button>
            </div>
          </li>
        )}

        {isExpanded && cat.children && cat.children.map((child, i) =>
          renderCategoryItem(child, depth + 1, i, cat.children.length)
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="loading">로딩 중...</div>
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left-wrap">
          {/* 헤더: 로고만 표시. 구글검색/북마크·일지 탭 없음 */}
          <h1 className="dashboard-logo">
            <button type="button" className="dashboard-logo-btn" onClick={goToFirstScreen} title="처음 화면으로">
              <span className="dashboard-logo-icon" aria-hidden>⭐</span>
              <span className="dashboard-logo-title">즐순이</span>
              <span className="dashboard-logo-sub"> 즐겨찾기 매니저</span>
            </button>
          </h1>
        </div>
        <div className="header-right">
          <div className="header-user-block">
            <span className="user-email">{user.email}</span>
            {user.email === 'jkseo1974@gmail.com' && (
              <Link to="/admin" className="admin-link">ADMIN</Link>
            )}
          </div>
          <button className="btn-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="panel panel-categories">
          <div className="panel-header" style={{ display: 'none' }}>
            <h2>📁 카테고리</h2>
          </div>
          <div className="add-form">
            <input
              type="text"
              placeholder="새 카테고리 이름"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, () => addCategory(null))}
            />
            <button className="btn-add" onClick={() => addCategory(null)}>추가</button>
          </div>
          <ul className="item-list">
            {categoryTree.map((cat, i) => renderCategoryItem(cat, 0, i, categoryTree.length))}
            {categories.length === 0 && (
              <li className="empty-message">카테고리를 추가해보세요!</li>
            )}
          </ul>
        </aside>

        <section ref={linksPanelRef} className="panel panel-links">
          <div className="links-panel-external-search">
            <form className="links-panel-external-search-form" onSubmit={handleExternalSearch}>
              <select
                value={externalSearchEngine}
                onChange={(e) => setExternalSearchEngine(e.target.value)}
                className="links-panel-search-select"
                aria-label="검색 엔진 선택"
              >
                <option value="naver">네이버</option>
                <option value="google">구글</option>
              </select>
              <input
                type="text"
                placeholder="검색어 입력..."
                value={externalSearchQuery}
                onChange={(e) => setExternalSearchQuery(e.target.value)}
                className="links-panel-search-input"
                aria-label="검색어"
              />
              <button type="submit" className="btn-search-icon" title="검색">🔍</button>
            </form>
          </div>
          {(searchResults !== null || selectedCategory) && (
            <div className="panel-header">
              <h2>🔗 {searchResults !== null ? `검색 결과: ${searchQuery}` : selectedCategory ? selectedCategory.name : ''}</h2>
              {searchResults !== null ? (
                <button type="button" className="btn-cancel" onClick={() => setSearchResults(null)}>검색 해제</button>
              ) : selectedCategory ? (
                <button className="btn-add-link" onClick={() => setShowLinkForm(!showLinkForm)}>
                  {showLinkForm ? '취소' : '+ 링크 추가'}
                </button>
              ) : null}
            </div>
          )}

          {showLinkForm && selectedCategory && (
            <div className="link-form">
              <label className="link-form-checkbox">
                <input
                  type="checkbox"
                  checked={!!newLink.showOnMain}
                  onChange={(e) => setNewLink({ ...newLink, showOnMain: e.target.checked })}
                />
                <span>메인 표출</span>
              </label>
              <input
                type="text"
                placeholder="링크 제목"
                value={newLink.title}
                onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
              />
              <input
                type="url"
                placeholder="URL (https://...)"
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              />
              <input
                type="text"
                placeholder="설명 (선택사항)"
                value={newLink.description}
                onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
              />
              <div className="link-form-actions">
                <button className="btn-add" onClick={addLink}>링크 저장</button>
              </div>
            </div>
          )}

          {searchResults === null && (
            <>
              {!selectedCategory && (
                <>
                  {showShortcutGrid && (
                    <>
                    <div className="link-shortcut-grid">
                      {paginatedFavLinks.map((link) => (
                        <div
                          key={link.id}
                          className="link-shortcut-tile-wrap"
                          data-link-id={link.id}
                          draggable
                          onDragStart={(e) => handleShortcutDragStart(e, link.id)}
                          onDragEnd={handleShortcutDragEnd}
                          onDragOver={handleShortcutDragOver}
                          onDrop={(e) => handleShortcutDrop(e, link.id)}
                        >
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-shortcut-tile"
                            title={link.title}
                          >
                            <span className="link-shortcut-icon">
                              <span className="link-shortcut-icon-fallback" aria-hidden>🔗</span>
                              <img src={getFaviconUrl(link.url)} alt="" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none' }} />
                            </span>
                            <span className="link-shortcut-label">{link.title || '링크'}</span>
                          </a>
                          <button
                            type="button"
                            className="link-shortcut-remove"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (confirm('메인 화면에서만 제거합니다. 링크는 카테고리에 그대로 남습니다.')) {
                                supabase.from('links').update({ show_on_main: false }).eq('id', link.id).then(({ error }) => {
                                  if (!error) {
                                    fetchAllLinks()
                                    if (selectedCategory?.id === link.category_id) fetchLinks(selectedCategory.id)
                                  }
                                })
                              }
                            }}
                            title="메인에서 제거"
                            aria-label="메인 화면에서 제거"
                          >
                            제거
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="fav-pagination-row">
                      <select
                        value={favLinkPageSize}
                        onChange={(e) => { setFavLinkPageSize(parseInt(e.target.value, 10)); setFavLinkPage(1) }}
                        className="fav-page-size-select"
                        aria-label="한 페이지에 표시할 개수"
                      >
                        <option value={20}>20개</option>
                        <option value={30}>30개</option>
                        <option value={40}>40개</option>
                        <option value={0}>전체</option>
                      </select>
                      <span className="fav-pagination-info">
                        {favLinkPageSize === 0
                          ? `${linksForGrid.length}개 표시`
                          : `${linksForGrid.length}개 중 ${Math.min((favLinkPage - 1) * favLinkPageSize + 1, linksForGrid.length)}-${Math.min(favLinkPage * favLinkPageSize, linksForGrid.length)}개 표시`}
                      </span>
                      {favTotalPages > 1 && (
                        <span className="fav-pagination-btns">
                          <button
                            type="button"
                            className="fav-page-btn"
                            disabled={favLinkPage <= 1}
                            onClick={() => setFavLinkPage(favLinkPage - 1)}
                            aria-label="이전 페이지"
                          >
                            ◀
                          </button>
                          {Array.from({ length: favTotalPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              className={`fav-page-btn ${p === favLinkPage ? 'active' : ''}`}
                              onClick={() => setFavLinkPage(p)}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="fav-page-btn"
                            disabled={favLinkPage >= favTotalPages}
                            onClick={() => setFavLinkPage(favLinkPage + 1)}
                            aria-label="다음 페이지"
                          >
                            ▶
                          </button>
                        </span>
                      )}
                    </div>
                    </>
                  )}
                  <div className="todo-section">
                    <div className="todo-form">
                      <input
                        type="text"
                        placeholder="할일을 입력하세요..."
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTodo())}
                      />
                      <button className="btn-add" onClick={addTodo}>추가</button>
                    </div>
                    {todos.length > 0 && (
                      <>
                        <ul className="todo-list">
                          {todos.slice((todoPage - 1) * todoPageSize, todoPage * todoPageSize).map((todo, pageIdx) => {
                            const sortedTodos = [...todos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                            const globalIdx = sortedTodos.findIndex(t => t.id === todo.id)
                            const canMoveUp = globalIdx > 0
                            const canMoveDown = globalIdx < sortedTodos.length - 1
                            return (
                              <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                                {editingTodoId === todo.id ? (
                                  <div className="todo-edit-form">
                                    <input
                                      type="text"
                                      value={editTodoContent}
                                      onChange={(e) => setEditTodoContent(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          updateTodo(todo.id)
                                        } else if (e.key === 'Escape') {
                                          setEditingTodoId(null)
                                          setEditTodoContent('')
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <button className="btn-save" onClick={() => updateTodo(todo.id)}>저장</button>
                                    <button className="btn-cancel" onClick={() => { setEditingTodoId(null); setEditTodoContent('') }}>취소</button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="todo-content-row">
                                      <input
                                        type="checkbox"
                                        checked={todo.completed}
                                        onChange={() => toggleTodoCompleted(todo.id, todo.completed)}
                                        className="todo-checkbox"
                                      />
                                      <span className="todo-text" onClick={() => { setEditingTodoId(todo.id); setEditTodoContent(todo.content) }}>
                                        {todo.content}
                                      </span>
                                    </div>
                                    <div className="todo-actions">
                                      {canMoveUp && <button title="위로" onClick={() => moveTodo(todo, 'up')}>⬆️</button>}
                                      {canMoveDown && <button title="아래로" onClick={() => moveTodo(todo, 'down')}>⬇️</button>}
                                      <button onClick={() => { setEditingTodoId(todo.id); setEditTodoContent(todo.content) }}>✏️</button>
                                      <button onClick={() => deleteTodo(todo.id)}>🗑️</button>
                                    </div>
                                  </>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                        <div className="todo-pagination-row">
                          <select
                            value={todoPageSize}
                            onChange={(e) => {
                              setTodoPageSize(parseInt(e.target.value, 10))
                              setTodoPage(1)
                            }}
                            className="todo-page-size-select"
                            aria-label="한 페이지에 보여질 할일 수"
                          >
                            <option value={3}>3개</option>
                            <option value={5}>5개</option>
                            <option value={10}>10개</option>
                            <option value={20}>20개</option>
                            <option value={30}>30개</option>
                          </select>
                          <span className="todo-pagination-info">
                            {todos.length}개 중 {Math.min((todoPage - 1) * todoPageSize + 1, todos.length)}-{Math.min(todoPage * todoPageSize, todos.length)}개 표시
                          </span>
                          {Math.ceil(todos.length / todoPageSize) > 1 && (
                            <span className="todo-pagination-btns">
                              <button
                                type="button"
                                className="todo-page-btn"
                                disabled={todoPage <= 1}
                                onClick={() => setTodoPage(todoPage - 1)}
                              >
                                ◀
                              </button>
                              {Array.from({ length: Math.ceil(todos.length / todoPageSize) }, (_, i) => i + 1).map((p) => (
                                <button
                                  key={p}
                                  type="button"
                                  className={`todo-page-btn ${p === todoPage ? 'active' : ''}`}
                                  onClick={() => setTodoPage(p)}
                                >
                                  {p}
                                </button>
                              ))}
                              <button
                                type="button"
                                className="todo-page-btn"
                                disabled={todoPage >= Math.ceil(todos.length / todoPageSize)}
                                onClick={() => setTodoPage(todoPage + 1)}
                              >
                                ▶
                              </button>
                            </span>
                          )}
                        </div>
                      </>
                    )}
                    {todos.length === 0 && (
                      <div className="todo-empty">할일을 추가해보세요!</div>
                    )}
                  </div>
                  <div className="main-calendar-wrap">
                    <h3 className="main-calendar-title">구글 캘린더</h3>
                    <div className="main-calendar-placeholder">
                      {calendarEmbedUrl ? (
                        <iframe
                          src={calendarEmbedUrl}
                          title="Google Calendar"
                          className="main-calendar-iframe"
                          frameBorder="0"
                          scrolling="no"
                        />
                      ) : (
                        <span className="main-calendar-label">
                          .env에 VITE_GOOGLE_CALENDAR_EMBED_URL 을 설정하면 여기에 캘린더가 표시됩니다.
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
              {!selectedCategory && (
                <div className="main-quote-block">
                  <div className="welcome-quote">
                    <p className="welcome-quote-text">"{WELCOME_QUOTES[quoteIndex].text}"</p>
                    <p className="welcome-quote-author">— {WELCOME_QUOTES[quoteIndex].author}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {(searchResults !== null || selectedCategory) && (searchResults !== null ? searchResults : links).length > 0 && (
            <div className="link-list-pagination-controls">
              <select
                value={linkPageSize}
                onChange={(e) => { setLinkPageSize(parseInt(e.target.value, 10)); setLinkPage(1) }}
                className="link-page-size-select"
                aria-label="한 페이지에 보여질 링크 수"
              >
                <option value={5}>5개</option>
                <option value={10}>10개</option>
                <option value={20}>20개</option>
                <option value={30}>30개</option>
              </select>
              <span className="link-pagination-info">
                {(searchResults !== null ? searchResults : links).length}개 중 {Math.min((linkPage - 1) * linkPageSize + 1, (searchResults !== null ? searchResults : links).length)}-{Math.min(linkPage * linkPageSize, (searchResults !== null ? searchResults : links).length)}개 표시
              </span>
            </div>
          )}
          <ul className="item-list">
            {(() => {
              const list = searchResults !== null ? searchResults : links
              const start = (linkPage - 1) * linkPageSize
              const pageList = list.slice(start, start + linkPageSize)
              return pageList.map((link, idx) => {
                const globalIdx = start + idx
                const canMoveUp = searchResults === null && globalIdx > 0
                const canMoveDown = searchResults === null && globalIdx < list.length - 1
                const isSearchMode = searchResults !== null
                return (
                <li
                  key={link.id}
                  className={`item link-item ${selectedLink?.id === link.id ? 'active' : ''}`}
                >
                  {editingLink === link.id ? (
                    <div className="link-form link-edit-form">
                      <label className="link-form-checkbox">
                        <input
                          type="checkbox"
                          checked={!!editLink.show_on_main}
                          onChange={(e) => setEditLink({ ...editLink, show_on_main: e.target.checked })}
                        />
                        <span>메인 표출</span>
                      </label>
                      <select
                        value={editLink.category_id || ''}
                        onChange={(e) => setEditLink({ ...editLink, category_id: e.target.value })}
                        className="edit-category-select"
                      >
                        <option value="">카테고리 선택</option>
                        {flattenCategories(categories).map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {'  '.repeat(cat.level)}{cat.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editLink.title}
                        onChange={(e) => setEditLink({ ...editLink, title: e.target.value })}
                        placeholder="제목"
                        autoFocus
                      />
                      <input
                        type="url"
                        value={editLink.url}
                        onChange={(e) => setEditLink({ ...editLink, url: e.target.value })}
                        placeholder="URL"
                      />
                      <input
                        type="text"
                        value={editLink.description}
                        onChange={(e) => setEditLink({ ...editLink, description: e.target.value })}
                        placeholder="설명"
                      />
                      <div className="edit-buttons edit-buttons-left">
                        <button className="btn-save" onClick={() => updateLink(link.id)}>저장</button>
                        <button className="btn-cancel" onClick={() => setEditingLink(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="link-info" onClick={() => setSelectedLink(link)}>
                        {isSearchMode && link.categoryName && (
                          <span className="link-category-badge">{link.categoryName}</span>
                        )}
                        <strong>{link.title}</strong>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          {link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url}
                        </a>
                        {link.description && <p className="link-desc">{link.description}</p>}
                      </div>
                      <div className="item-actions">
                        {canMoveUp && <button title="위로" onClick={() => moveLink(link, 'up')}>⬆️</button>}
                        {canMoveDown && <button title="아래로" onClick={() => moveLink(link, 'down')}>⬇️</button>}
                        <button onClick={() => { setEditingLink(link.id); setEditLink({ title: link.title, url: link.url, description: link.description || '', category_id: link.category_id, show_on_main: link.show_on_main !== false }) }}>✏️</button>
                        <button onClick={() => deleteLink(link.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              )
              })
            })()}
            {searchResults !== null && searchResults.length === 0 && (
              <li className="empty-message">검색 결과가 없습니다</li>
            )}
            {searchResults === null && selectedCategory && links.length === 0 && (
              <li className="empty-message">링크를 추가해보세요!</li>
            )}
          </ul>
          {(searchResults !== null || selectedCategory) && (() => {
            const list = searchResults !== null ? searchResults : links
            const totalPages = Math.max(1, Math.ceil(list.length / linkPageSize))
            if (totalPages <= 1) return null
            return (
              <div className="link-pagination">
                <button
                  type="button"
                  className="link-page-btn"
                  disabled={linkPage <= 1}
                  onClick={() => setLinkPage(linkPage - 1)}
                >
                  ◀
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`link-page-btn ${p === linkPage ? 'active' : ''}`}
                    onClick={() => setLinkPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="link-page-btn"
                  disabled={linkPage >= totalPages}
                  onClick={() => setLinkPage(linkPage + 1)}
                >
                  ▶
                </button>
              </div>
            )
          })()}
          <footer className="panel-links-footer">
            <a href={`${import.meta.env.BASE_URL}manual.html`} target="_blank" rel="noopener noreferrer" className="footer-manual-link">매뉴얼 PDF</a>
            <span>© 2026 Seo Jongkeun. All rights reserved.</span>
          </footer>
        </section>

        <div
          ref={resizerRef}
          className={`panel-resizer ${isResizing ? 'resizing' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault()
            setIsResizing(true)
          }}
          role="separator"
          aria-label="메모 패널 너비 조절"
          aria-orientation="vertical"
        />

        <aside className="panel panel-memos" style={{ width: `${memoPanelWidth}px`, minWidth: `${memoPanelWidth}px` }}>
          {selectedLink && (
            <div className="panel-header">
              <h2>📝 {selectedLink.title}</h2>
            </div>
          )}

          {selectedLink ? (
            <>
              <div className="memo-form">
                <textarea
                  placeholder="메모를 입력하세요..."
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  rows={3}
                />
                <button className="btn-add" onClick={addMemo}>메모 추가</button>
              </div>
              <ul className="item-list memo-list">
                {memos.map((memo) => (
                  <li key={memo.id} className="item memo-item">
                    {editingMemo === memo.id ? (
                      <div className="edit-form">
                        <textarea
                          value={editMemoContent}
                          onChange={(e) => setEditMemoContent(e.target.value)}
                          rows={3}
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button className="btn-save" onClick={() => updateMemo(memo.id)}>저장</button>
                          <button className="btn-cancel" onClick={() => setEditingMemo(null)}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="memo-content">{convertUrlsToLinks(memo.content)}</p>
                        <div className="memo-footer">
                          <span className="memo-date">
                            {new Date(memo.created_at).toLocaleDateString('ko-KR')}
                          </span>
                          <div className="item-actions">
                            <button onClick={() => { setEditingMemo(memo.id); setEditMemoContent(memo.content) }}>✏️</button>
                            <button onClick={() => deleteMemo(memo.id)}>🗑️</button>
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                ))}
                {memos.length === 0 && (
                  <li className="empty-message">메모를 추가해보세요!</li>
                )}
              </ul>
            </>
          ) : (
            <>
              <div className="memo-panel-search">
                <div className="category-search-row">
                  <input
                    type="text"
                    placeholder="카테고리·링크·메모 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), runSearch())}
                    aria-label="카테고리 링크 메모 검색"
                  />
                  <button type="button" className="btn-search-icon" onClick={runSearch} title="카테고리·링크·메모 검색">🔍</button>
                </div>
              </div>
              <div className="sticker-memo-form">
                <textarea
                  placeholder="스티커 메모 내용..."
                  value={newStickerMemoContent}
                  onChange={(e) => setNewStickerMemoContent(e.target.value)}
                  rows={3}
                />
                <div className="sticker-memo-file-row">
                  <label className="sticker-memo-file-label" title="파일 첨부">
                    <span className="sticker-memo-file-icon" aria-hidden>📎</span>
                    <span className="sticker-memo-file-text">
                      {newStickerMemoFileList.length > 0 
                        ? `${newStickerMemoFileList.length}개의 첨부 파일을 선택하셨습니다`
                        : '첨부할 파일을 선택합니다.'}
                    </span>
                    <input
                      id="sticker-memo-file-input"
                      type="file"
                      multiple
                      onChange={(e) => setNewStickerMemoFileList(Array.from(e.target.files || []))}
                      className="sticker-memo-file-input"
                      aria-label="파일 첨부"
                    />
                  </label>
                </div>
                <button className="btn-add" onClick={addStickerMemo}>스티커 메모 추가</button>
              </div>
              <ul className="item-list memo-list sticker-memo-list">
                {(() => {
                  const sortedMemos = [...stickerMemos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                  return sortedMemos.map((sm, idx) => {
                    const canMoveUp = idx > 0
                    const canMoveDown = idx < sortedMemos.length - 1
                    return (
                      <li key={sm.id} className="item memo-item sticker-memo-item">
                        {editingStickerMemoId === sm.id ? (
                          <div className="edit-form">
                            <textarea
                              value={editStickerMemoContent}
                              onChange={(e) => setEditStickerMemoContent(e.target.value)}
                              rows={3}
                              autoFocus
                            />
                            <div className="edit-buttons">
                              <button className="btn-save" onClick={() => updateStickerMemo(sm.id)}>저장</button>
                              <button className="btn-cancel" onClick={() => { setEditingStickerMemoId(null); setEditStickerMemoContent('') }}>취소</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {sm.content && <p className="memo-content">{convertUrlsToLinks(sm.content)}</p>}
                            {(stickerMemoFilesMap[sm.id] || []).length > 0 && (
                              <div className="sticker-memo-files">
                                {(stickerMemoFilesMap[sm.id] || []).map((f) => (
                                  <div key={f.id} className="sticker-memo-file-item">
                                    <a href={stickerMemoFileUrls[f.id]} target="_blank" rel="noopener noreferrer" className="sticker-memo-file-link">
                                      📎 {f.file_name}
                                    </a>
                                    <button type="button" className="sticker-memo-file-remove" onClick={() => removeStickerMemoFile(f.id, f.storage_path)} title="첨부 삭제">×</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="memo-footer">
                              <span className="memo-date">{new Date(sm.created_at).toLocaleDateString('ko-KR')}</span>
                              <div className="item-actions">
                                {canMoveUp && <button onClick={() => moveStickerMemo(sm, 'up')} title="위로">⬆️</button>}
                                {canMoveDown && <button onClick={() => moveStickerMemo(sm, 'down')} title="아래로">⬇️</button>}
                                <button onClick={() => { setEditingStickerMemoId(sm.id); setEditStickerMemoContent(sm.content || '') }}>✏️</button>
                                <button onClick={() => deleteStickerMemo(sm.id)}>🗑️</button>
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    )
                  })
                })()}
                {stickerMemos.length === 0 && (
                  <li className="empty-message">스티커 메모를 추가해보세요. 파일도 첨부할 수 있습니다.</li>
                )}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

export default Dashboard