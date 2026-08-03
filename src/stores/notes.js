import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { 
  loadNotesFromCloud, 
  saveNotesToCloud, 
  deleteNoteFromCloud,
  updateViewCount,
  updateUsefulCount 
} from '../services/supabase'
import { migrateNote } from '../utils/noteMigrate'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  
  const search = ref('')
  const categoryFilter = ref('')
  const knowledgeAreaFilter = ref('')
  
  const currentPage = ref(1)
  const pageSize = ref(10)

  // 去除 HTML 标签，仅保留纯文本用于搜索
  const stripHtml = (html) => {
    if (!html) return ''
    return String(html).replace(/<[^>]*>/g, ' ')
  }

  // 笔记可检索的全文：标题、内容、分类、场景、案例、要点、标签、记忆口诀、考点关联
  const noteText = (note) => [
    note.title,
    stripHtml(note.content),
    note.category,
    note.scenario,
    stripHtml(note.caseStudy),
    (note.keyPoints || []).join(' '),
    (note.tags || []).join(' '),
    (note.memoryAids || []).join(' '),
    (note.examMapping?.relatedProcesses || []).join(' '),
    (note.examMapping?.typicalQuestions || []).join(' '),
    (note.examMapping?.commonPitfalls || []).join(' '),
  ].join(' ').toLowerCase()

  const filteredNotes = computed(() => {
    const q = search.value.trim().toLowerCase()
    const ka = knowledgeAreaFilter.value.trim().toLowerCase()
    return notes.value.filter(note => {
      const text = noteText(note)
      // 全面搜索：匹配笔记全文
      const matchSearch = !q || text.includes(q)

      const matchCategory = !categoryFilter.value || note.category === categoryFilter.value
      // 知识领域：匹配全文（含显式标签 + 标题/内容等隐式提及），覆盖未手动标注的已有笔记
      const matchKnowledgeArea = !ka || text.includes(ka)

      return matchSearch && matchCategory && matchKnowledgeArea
    })
  })

  const paginatedNotes = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return filteredNotes.value.slice(start, end)
  })

  const totalNotes = computed(() => filteredNotes.value.length)

  const categories = computed(() => {
    const cats = new Set(notes.value.map(n => n.category).filter(Boolean))
    return [...cats]
  })

  const totalViews = computed(() => {
    return notes.value.reduce((sum, n) => sum + (n.viewCount || 0), 0)
  })

  const totalCharacters = computed(() => {
    return notes.value.reduce((sum, n) => {
      const content = n.content || ''
      const caseStudy = n.caseStudy || ''
      // 去除HTML标签和markdown语法，只计算纯文本字数
      const cleanContent = content.replace(/<[^>]*>/g, '').replace(/[#*`>\-\[\]()]/g, '')
      const cleanCaseStudy = caseStudy.replace(/<[^>]*>/g, '').replace(/[#*`>\-\[\]()]/g, '')
      return sum + cleanContent.length + cleanCaseStudy.length
    }, 0)
  })

  const loadNotes = async () => {
    isLoading.value = true
    error.value = null
    try {
      const cloudData = await loadNotesFromCloud()
      notes.value = cloudData.map(migrateNote)
      return notes.value
    } catch (e) {
      console.error('❌ 云端加载失败:', e.message)
      error.value = e.message
      notes.value = []
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const saveNotes = async () => {
    isLoading.value = true
    error.value = null
    try {
      await saveNotesToCloud(notes.value)
    } catch (e) {
      console.error('❌ 云端保存失败:', e.message)
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const addNote = (noteData) => {
    notes.value.push(noteData)
  }

  const updateNote = (noteData) => {
    const index = notes.value.findIndex(n => n.id === noteData.id)
    if (index !== -1) {
      notes.value[index] = noteData
    }
  }

  const deleteNote = async (id) => {
    isLoading.value = true
    error.value = null
    try {
      notes.value = notes.value.filter(n => n.id !== id)
      await deleteNoteFromCloud(id)
    } catch (e) {
      console.error('❌ 云端删除失败:', e.message)
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const incrementViewCount = async (id) => {
    const note = notes.value.find(n => n.id === id)
    if (note) {
      note.viewCount = (note.viewCount || 0) + 1
      try {
        await updateViewCount(id, note.viewCount)
      } catch (e) {
        console.error('❌ 更新浏览量失败:', e.message)
      }
    }
  }

  const incrementUsefulCount = async (id) => {
    const note = notes.value.find(n => n.id === id)
    if (note) {
      note.usefulCount = (note.usefulCount || 0) + 1
      try {
        await updateUsefulCount(id, note.usefulCount)
      } catch (e) {
        console.error('❌ 更新有用数失败:', e.message)
      }
    }
  }

  const setSearch = (value) => {
    search.value = value
    currentPage.value = 1
  }

  const setCategoryFilter = (value) => {
    categoryFilter.value = value
    currentPage.value = 1
  }

  const setKnowledgeAreaFilter = (value) => {
    knowledgeAreaFilter.value = value
    currentPage.value = 1
  }

  const setCurrentPage = (page) => {
    currentPage.value = page
  }

  const setPageSize = (size) => {
    pageSize.value = size
    currentPage.value = 1
  }

  const resetFilters = () => {
    search.value = ''
    categoryFilter.value = ''
    knowledgeAreaFilter.value = ''
    currentPage.value = 1
  }

  const getNoteById = (id) => {
    return notes.value.find(n => n.id === id)
  }

  return {
    notes,
    isLoading,
    error,
    search,
    categoryFilter,
    knowledgeAreaFilter,
    currentPage,
    pageSize,
    filteredNotes,
    paginatedNotes,
    totalNotes,
    categories,
    totalViews,
    totalCharacters,
    loadNotes,
    saveNotes,
    addNote,
    updateNote,
    deleteNote,
    incrementViewCount,
    incrementUsefulCount,
    setSearch,
    setCategoryFilter,
    setKnowledgeAreaFilter,
    setCurrentPage,
    setPageSize,
    resetFilters,
    getNoteById
  }
})