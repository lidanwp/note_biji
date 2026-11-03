<template>
  <div class="side-rail" :class="{ 'is-open': open }">
    <div class="rail-panel" :id="panelId" role="group" aria-label="快捷入口">
      <button
        v-if="aiReady"
        type="button"
        class="rail-btn rail-btn-ai"
        title="AI 助手"
        aria-label="打开 AI 助手"
        @click="openAi"
      >
        <img v-if="aiAvatar" :src="aiAvatar" alt="" class="rail-avatar" />
        <span v-else class="rail-avatar rail-avatar-fallback" aria-hidden="true">AI</span>
      </button>

      <button
        v-if="detailOpen"
        type="button"
        class="rail-btn rail-btn-tag"
        title="跳到标签/评论区"
        aria-label="跳到标签与评论区"
        @click="jumpToTags"
      >
        <svg
          class="rail-tag-icon"
          viewBox="0 0 128 128"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="railTag_1" x1="28.9966" y1="29.955" x2="79.1021" y2="114.2471"
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(0.9993 0.0371 -0.0371 0.9993 2.7779 -2.0068)">
              <stop offset="0.0104" stop-color="#FFC107"/>
              <stop offset="0.9966" stop-color="#FF6F00"/>
            </linearGradient>
            <linearGradient id="railTag_3" x1="29.3002" y1="28.833" x2="100.7614" y2="106.4682"
              gradientUnits="userSpaceOnUse">
              <stop offset="4.499847e-03" stop-color="#FFEB3B"/>
              <stop offset="1" stop-color="#FBC02D"/>
            </linearGradient>
            <linearGradient id="railTag_4" x1="12.4879" y1="25.6928" x2="48.0903" y2="25.6928"
              gradientUnits="userSpaceOnUse">
              <stop offset="0.0126" stop-color="#C79F62"/>
              <stop offset="1" stop-color="#804F21"/>
            </linearGradient>
          </defs>
          <path fill="url(#railTag_1)" d="M29.89,30.91l-9.2,19.88c-0.6,1.8-0.35,4.67,0.53,6.35l33.88,64.58c0.88,1.69,3.05,2.37,4.77,1.52l33.78-16.69c1.73-0.85,2.43-2.95,1.54-4.64L61.31,37.34c-0.89-1.68-3.14-3.56-4.99-4.15l-21.97-4.46C32.49,28.13,30.49,29.11,29.89,30.91z"/>
          <path fill="url(#railTag_3)" d="M115,88.25L63.47,29.96c-1.35-1.51-4.13-2.87-6.16-3l-23.46,1.18c-2.03-0.13-3.8,1.43-3.93,3.46l-4.04,23.15c-0.13,2.03,0.88,4.96,2.23,6.48l51.52,58.29c1.34,1.52,3.72,1.66,5.24,0.32l29.8-26.35C116.2,92.15,116.35,89.78,115,88.25z"/>
          <path fill="url(#railTag_4)" d="M43.92,20.12c-4.28-9.4-10.63-15.13-17.44-15.73c-4.62-0.41-8.92,1.62-11.54,5.42c-3.12,4.52-3.27,10.74-0.4,16.65c2.94,6.06,6.33,10.99,10.07,14.64l0.5,0.48l1.66-2.92l-0.3-0.29c-3.41-3.32-6.29-7.55-9.08-13.3c-2.39-4.94-2.34-9.84,0.16-13.46c1.96-2.85,5.19-4.36,8.65-4.06c5.64,0.5,11.05,5.56,14.84,13.89c3.84,8.42,4.92,15.76,2.9,19.62c-0.9,1.72-1.86,2.37-4.12,2.79l-0.45,0.08l0.01,0.46c0,0.03,0.02,0.7,0.2,1.3c0.18,0.59,0.44,1.04,0.46,1.06l0.19,0.32l0.36-0.07c3.08-0.56,4.75-1.77,6.16-4.46C49.25,37.73,48.22,29.57,43.92,20.12z"/>
          <circle cx="44.68" cy="44.19" r="6.85" fill="url(#railTag_3)" stroke="#E6A700" stroke-width="1.4"/>
          <circle cx="44.68" cy="44.19" r="5.25" fill="#ffffff" fill-opacity="0.92"/>
          <circle cx="35.65" cy="44.00" r="5.50" fill="url(#railTag_1)" stroke="#C75B00" stroke-width="1.0"/>
          <circle cx="35.65" cy="44.00" r="4.20" fill="#ffffff" fill-opacity="0.88"/>
        </svg>
      </button>
    </div>

    <button
      type="button"
      class="rail-handle"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="open ? '收起快捷入口' : '展开快捷入口'"
      :title="open ? '收起' : '更多'"
      @click="toggle"
    >
      <svg class="rail-handle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const open = ref(false)
const detailOpen = ref(false)
const aiReady = ref(false)
const aiAvatar = ref('')
const panelId = 'side-rail-panel'

let observer = null
let rootEl = null

const toggle = () => {
  open.value = !open.value
}

const close = () => {
  open.value = false
}

// 千帆 SDK 会在运行时插入 <img id="embed-lite-bubble-image">，这里读取它的头像并代理点击
const syncAiBubble = () => {
  const img = document.getElementById('embed-lite-bubble-image')
  if (!img) return
  if (!aiReady.value) aiReady.value = true
  if (img.currentSrc && img.currentSrc !== aiAvatar.value) {
    aiAvatar.value = img.currentSrc
  } else if (img.src && img.src !== aiAvatar.value) {
    aiAvatar.value = img.src
  }
}

// 千帆聊天窗是否真的可见：SDK 关闭时常常只是隐藏节点而不移除，
// 必须连祖先链一起查 display/visibility/opacity + 实际尺寸 + 是否在视口内，
// 否则会被误判为“已打开”而不去触发点击
const isConvVisible = () => {
  const conv = document.querySelector('.appbuilder-bubbleContent')
  if (!conv) return false
  let visible = false
  if (typeof conv.checkVisibility === 'function') {
    visible = conv.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
  } else {
    const style = window.getComputedStyle(conv)
    visible = style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) !== 0
  }
  if (!visible) return false
  const rect = conv.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return false
  // 关闭状态下可能被 transform 移出视口
  if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false
  return true
}

const openAi = () => {
  close()
  const img = document.getElementById('embed-lite-bubble-image')
  if (!img) return

  if (isConvVisible()) {
    // 聊天窗开着 → 交给 SDK 自己切换为关闭
    img.click()
    return
  }

  img.click()
  // 兜底：350ms 后仍未出现可见聊天窗（SDK 内部状态不同步/节点重建后未绑定），
  // 再点一次 —— toggle 语义下“无效的第一次点击”正好把状态拨回可打开位
  setTimeout(() => {
    if (isConvVisible()) return
    const retryImg = document.getElementById('embed-lite-bubble-image')
    if (retryImg) retryImg.click()
  }, 350)
}

const jumpToTags = () => {
  close()
  window.dispatchEvent(new CustomEvent('note:scroll-to-tags'))
}

const onDetailState = (e) => {
  detailOpen.value = !!e.detail?.open
  if (!detailOpen.value) close()
}

const onKeydown = (e) => {
  if (e.key === 'Escape' && open.value) close()
}

const onDocPointerDown = (e) => {
  if (!open.value) return
  if (rootEl && !rootEl.contains(e.target)) close()
}

onMounted(() => {
  rootEl = document.querySelector('.side-rail')
  syncAiBubble()
  observer = new MutationObserver(syncAiBubble)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
  window.addEventListener('note:detail-state', onDetailState)
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onDocPointerDown, true)
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  window.removeEventListener('note:detail-state', onDetailState)
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
})
</script>

<style scoped>
.side-rail {
  position: fixed;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  z-index: 1200;
  pointer-events: none;
}

.rail-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-right: 8px;
  padding: 8px;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(17, 24, 39, 0.1);
  opacity: 0;
  transform: translateX(16px);
  pointer-events: none;
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.side-rail.is-open .rail-panel {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.rail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.2s ease, transform 0.2s ease;
}

.rail-btn:hover {
  background: #f5f7ff;
  transform: scale(1.06);
}

.rail-btn:active {
  transform: scale(0.94);
}

.rail-btn:focus-visible,
.rail-handle:focus-visible {
  outline: 2px solid #667eea;
  outline-offset: 2px;
}

.rail-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.rail-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.rail-tag-icon {
  width: 30px;
  height: 30px;
}

.rail-handle {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 64px;
  padding: 0;
  border: 1px solid #eef0f4;
  border-right: none;
  border-radius: 10px 0 0 10px;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  box-shadow: -2px 2px 10px rgba(17, 24, 39, 0.06);
  transition: color 0.2s ease, background 0.2s ease;
}

.rail-handle:hover {
  color: #4f46e5;
  background: #f8f9ff;
}

.rail-handle-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.22s ease;
}

.side-rail.is-open .rail-handle-icon {
  transform: rotate(180deg);
}

@media (max-width: 767px) {
  .rail-handle {
    width: 18px;
    height: 56px;
  }
  .rail-btn {
    width: 36px;
    height: 36px;
  }
  .rail-avatar {
    width: 30px;
    height: 30px;
  }
  .rail-tag-icon {
    width: 26px;
    height: 26px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rail-panel,
  .rail-btn,
  .rail-handle,
  .rail-handle-icon {
    transition: none;
  }
}
</style>
