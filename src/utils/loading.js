import { ref } from 'vue'

const loadingState = ref(false)
const loadingMessage = ref('')

export function useLoading() {
  const startLoading = (message = '加载中...') => {
    loadingMessage.value = message
    loadingState.value = true
  }
  
  const stopLoading = () => {
    loadingState.value = false
    loadingMessage.value = ''
  }
  
  const isLoading = () => loadingState.value
  const getLoadingMessage = () => loadingMessage.value
  
  return {
    startLoading,
    stopLoading,
    isLoading,
    getLoadingMessage,
    loadingState,
    loadingMessage
  }
}

export { loadingState, loadingMessage }