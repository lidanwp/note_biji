import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // 主题模式
  const theme = ref(localStorage.getItem('app_theme') || 'light')

  // 字体大小: small | medium | large
  const fontSize = ref(localStorage.getItem('app_font_size') || 'medium')

  // 行间距: compact | comfortable | relaxed
  const lineHeight = ref(localStorage.getItem('app_line_height') || 'comfortable')

  // 字体家族
  const fontFamily = ref(localStorage.getItem('app_font_family') || 'default')

  // 切换主题
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  const setTheme = (value) => {
    theme.value = value
  }

  const setFontSize = (value) => {
    fontSize.value = value
  }

  const setLineHeight = (value) => {
    lineHeight.value = value
  }

  const setFontFamily = (value) => {
    fontFamily.value = value
  }

  // 应用到 DOM
  const applyTheme = () => {
    document.documentElement.setAttribute('data-theme', theme.value)
    document.documentElement.setAttribute('data-font-size', fontSize.value)
    document.documentElement.setAttribute('data-line-height', lineHeight.value)
    document.documentElement.setAttribute('data-font-family', fontFamily.value)

    localStorage.setItem('app_theme', theme.value)
    localStorage.setItem('app_font_size', fontSize.value)
    localStorage.setItem('app_line_height', lineHeight.value)
    localStorage.setItem('app_font_family', fontFamily.value)
  }

  // 监听变化自动应用
  watch([theme, fontSize, lineHeight, fontFamily], applyTheme, { deep: true })

  // 初始化
  applyTheme()

  return {
    theme,
    fontSize,
    lineHeight,
    fontFamily,
    toggleTheme,
    setTheme,
    setFontSize,
    setLineHeight,
    setFontFamily,
    applyTheme
  }
})