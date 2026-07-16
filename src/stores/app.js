import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useAppStore = defineStore('app', () => {
  const theme = ref('light')
  const showSettings = ref(false)
  const showSidebar = ref(true)
  const currentView = ref('viewer')

  const isDark = computed(() => theme.value === 'dark')

  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme()
  }

  const setTheme = (newTheme) => {
    theme.value = newTheme
    applyTheme()
  }

  const applyTheme = () => {
    const root = document.documentElement
    if (theme.value === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme.value)
  }

  const loadTheme = () => {
    const saved = localStorage.getItem('theme')
    if (saved) {
      theme.value = saved
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  const toggleSettings = () => {
    showSettings.value = !showSettings.value
  }

  const closeSettings = () => {
    showSettings.value = false
  }

  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value
  }

  const setSidebar = (value) => {
    showSidebar.value = value
  }

  const setCurrentView = (view) => {
    currentView.value = view
  }

  watch(theme, (newTheme) => {
    applyTheme()
  })

  return {
    theme,
    isDark,
    showSettings,
    showSidebar,
    currentView,
    toggleTheme,
    setTheme,
    loadTheme,
    toggleSettings,
    closeSettings,
    toggleSidebar,
    setSidebar,
    setCurrentView
  }
})