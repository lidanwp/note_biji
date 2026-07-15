import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useHistoryStore = defineStore('history', () => {
  const MAX_HISTORY = 50
  const history = ref([])

  // 从 localStorage 加载
  const loadHistory = () => {
    try {
      const data = localStorage.getItem('reading_history')
      if (data) {
        history.value = JSON.parse(data)
      }
    } catch (e) {
      console.warn('加载历史记录失败:', e)
    }
  }

  // 保存到 localStorage
  const saveHistory = () => {
    try {
      localStorage.setItem('reading_history', JSON.stringify(history.value))
    } catch (e) {
      console.warn('保存历史记录失败:', e)
    }
  }

  // 添加一条历史记录
  const addHistory = (note) => {
    // 移除已存在的相同笔记（避免重复）
    history.value = history.value.filter(h => h.id !== note.id)

    // 添加到最前面
    history.value.unshift({
      id: note.id,
      title: note.title,
      category: note.category,
      difficulty: note.difficulty,
      visitedAt: new Date().toISOString(),
      viewCount: note.viewCount || 0
    })

    // 限制数量
    if (history.value.length > MAX_HISTORY) {
      history.value = history.value.slice(0, MAX_HISTORY)
    }

    saveHistory()
  }

  // 删除单条历史
  const removeHistory = (noteId) => {
    history.value = history.value.filter(h => h.id !== noteId)
    saveHistory()
  }

  // 清空所有历史
  const clearHistory = () => {
    history.value = []
    saveHistory()
  }

  // 获取最近浏览（按时间倒序）
  const getRecentHistory = computed(() => history.value)

  // 按日期分组
  const groupByDate = computed(() => {
    const groups = {}
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    history.value.forEach(item => {
      const date = new Date(item.visitedAt)
      const dateKey = date >= today ? '今天' : date.toLocaleDateString('zh-CN')
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(item)
    })

    return groups
  })

  // 初始化
  loadHistory()

  return {
    history,
    addHistory,
    removeHistory,
    clearHistory,
    getRecentHistory,
    groupByDate
  }
})