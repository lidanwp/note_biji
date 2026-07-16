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
  const difficultyFilter = ref('')
  
  const currentPage = ref(1)
  const pageSize = ref(10)

  const filteredNotes = computed(() => {
    return notes.value.filter(note => {
      const matchSearch = !search.value ||
        note.title?.toLowerCase().includes(search.value.toLowerCase()) ||
        note.content?.toLowerCase().includes(search.value.toLowerCase()) ||
        note.tags?.some(tag => tag.toLowerCase().includes(search.value.toLowerCase()))

      const matchCategory = !categoryFilter.value || note.category === categoryFilter.value
      const matchDifficulty = !difficultyFilter.value || note.difficulty === difficultyFilter.value

      return matchSearch && matchCategory && matchDifficulty
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

  const setDifficultyFilter = (value) => {
    difficultyFilter.value = value
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
    difficultyFilter.value = ''
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
    difficultyFilter,
    currentPage,
    pageSize,
    filteredNotes,
    paginatedNotes,
    totalNotes,
    categories,
    totalViews,
    loadNotes,
    saveNotes,
    addNote,
    updateNote,
    deleteNote,
    incrementViewCount,
    incrementUsefulCount,
    setSearch,
    setCategoryFilter,
    setDifficultyFilter,
    setCurrentPage,
    setPageSize,
    resetFilters,
    getNoteById
  }
})