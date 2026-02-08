import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

function Dashboard({ user, onLogout }) {
  const [categories, setCategories] = useState([])
  const [links, setLinks] = useState([])
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
  const [newLink, setNewLink] = useState({ title: '', url: '', description: '' })
  const [editingLink, setEditingLink] = useState(null)
  const [editLink, setEditLink] = useState({ title: '', url: '', description: '' })

  const [newMemo, setNewMemo] = useState('')
  const [editingMemo, setEditingMemo] = useState(null)
  const [editMemoContent, setEditMemoContent] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      fetchLinks(selectedCategory.id)
    } else {
      setLinks([])
    }
    setSelectedLink(null)
    setMemos([])
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
      .order('sort_order', { ascending: true })
    if (!error) setCategories(data || [])
    setLoading(false)
  }

  const fetchLinks = async (categoryId) => {
    const { data, error } = await supabase
      .from('links')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true })
    if (!error) setLinks(data || [])
  }

  const fetchMemos = async (linkId) => {
    const { data, error } = await supabase
      .from('memos')
      .select('*')
      .eq('link_id', linkId)
      .order('created_at', { ascending: false })
    if (!error) setMemos(data || [])
  }

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
    const nextOrder = links.length > 0 ? Math.max(...links.map(l => l.sort_order ?? 0)) + 1 : 0
    const { error } = await supabase.from('links').insert({
      title: newLink.title.trim(),
      url: newLink.url.trim(),
      description: newLink.description.trim(),
      category_id: selectedCategory.id,
      user_id: user.id,
      sort_order: nextOrder
    })
    if (!error) {
      setNewLink({ title: '', url: '', description: '' })
      setShowLinkForm(false)
      fetchLinks(selectedCategory.id)
    }
  }

  const updateLink = async (id) => {
    if (!editLink.title.trim() || !editLink.url.trim()) return
    const { error } = await supabase
      .from('links')
      .update({
        title: editLink.title.trim(),
        url: editLink.url.trim(),
        description: editLink.description.trim()
      })
      .eq('id', id)
    if (!error) {
      setEditingLink(null)
      fetchLinks(selectedCategory.id)
    }
  }

  const deleteLink = async (id) => {
    if (!confirm('이 링크와 관련 메모가 모두 삭제됩니다. 계속하시겠습니까?')) return
    const { error } = await supabase.from('links').delete().eq('id', id)
    if (!error) {
      if (selectedLink?.id === id) setSelectedLink(null)
      fetchLinks(selectedCategory.id)
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

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') action()
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
        <h1><span style={{fontSize: '20px'}}>⭐ 즐순이</span> <span style={{fontSize: '12px', color: '#9ca3af', fontWeight: '400'}}>즐겨찾기 매니저</span></h1>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="btn-logout" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className="panel panel-categories">
          <div className="panel-header">
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

        <section className="panel panel-links">
          <div className="panel-header">
            <h2>🔗 {selectedCategory ? selectedCategory.name : '카테고리를 선택하세요'}</h2>
            {selectedCategory && (
              <button className="btn-add-link" onClick={() => setShowLinkForm(!showLinkForm)}>
                {showLinkForm ? '취소' : '+ 링크 추가'}
              </button>
            )}
          </div>

          {showLinkForm && selectedCategory && (
            <div className="link-form">
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
              <button className="btn-add" onClick={addLink}>링크 저장</button>
            </div>
          )}

          <ul className="item-list">
            {links.map((link, idx) => {
              const canMoveUp = idx > 0
              const canMoveDown = idx < links.length - 1
              return (
                <li
                  key={link.id}
                  className={`item link-item ${selectedLink?.id === link.id ? 'active' : ''}`}
                >
                  {editingLink === link.id ? (
                    <div className="edit-form link-edit-form">
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
                      <div className="edit-buttons">
                        <button className="btn-save" onClick={() => updateLink(link.id)}>저장</button>
                        <button className="btn-cancel" onClick={() => setEditingLink(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="link-info" onClick={() => setSelectedLink(link)}>
                        <strong>{link.title}</strong>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          {link.url.length > 50 ? link.url.substring(0, 50) + '...' : link.url}
                        </a>
                        {link.description && <p className="link-desc">{link.description}</p>}
                      </div>
                      <div className="item-actions">
                        {canMoveUp && <button title="위로" onClick={() => moveLink(link, 'up')}>⬆️</button>}
                        {canMoveDown && <button title="아래로" onClick={() => moveLink(link, 'down')}>⬇️</button>}
                        <button onClick={() => { setEditingLink(link.id); setEditLink({ title: link.title, url: link.url, description: link.description || '' }) }}>✏️</button>
                        <button onClick={() => deleteLink(link.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
            {selectedCategory && links.length === 0 && (
              <li className="empty-message">링크를 추가해보세요!</li>
            )}
            {!selectedCategory && (
              <li className="empty-message">왼쪽에서 카테고리를 선택하세요</li>
            )}
          </ul>
        </section>

        <aside className="panel panel-memos">
          <div className="panel-header">
            <h2>📝 {selectedLink ? selectedLink.title : '링크를 선택하세요'}</h2>
          </div>

          {selectedLink && (
            <div className="memo-form">
              <textarea
                placeholder="메모를 입력하세요..."
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                rows={3}
              />
              <button className="btn-add" onClick={addMemo}>메모 추가</button>
            </div>
          )}

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
                    <p className="memo-content">{memo.content}</p>
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
            {selectedLink && memos.length === 0 && (
              <li className="empty-message">메모를 추가해보세요!</li>
            )}
            {!selectedLink && (
              <li className="empty-message">가운데에서 링크를 선택하세요</li>
            )}
          </ul>
        </aside>
      </div>
    </div>
  )
}

export default Dashboard