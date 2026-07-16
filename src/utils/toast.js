let toastInstance = null

export function setToastInstance(instance) {
  toastInstance = instance
}

export function showToast(message, type = 'info', duration = 3000) {
  if (toastInstance) {
    return toastInstance.addToast(message, type, duration)
  }
  console.warn('Toast instance not initialized')
  return null
}

export function toastSuccess(message, duration = 3000) {
  return showToast(message, 'success', duration)
}

export function toastError(message, duration = 4000) {
  return showToast(message, 'error', duration)
}

export function toastWarning(message, duration = 3500) {
  return showToast(message, 'warning', duration)
}

export function toastInfo(message, duration = 3000) {
  return showToast(message, 'info', duration)
}

export function toastLoading(message) {
  return showToast(message, 'loading', 0)
}

export function removeToast(id) {
  if (toastInstance) {
    toastInstance.removeToast(id)
  }
}