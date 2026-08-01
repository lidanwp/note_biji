<template>
  <div class="audio-player" :class="{ 'is-dark': isDark }">
    <!-- 文件名 + 时间显示 -->
    <div class="ap-header">
      <span class="ap-name" :title="name">🎵 {{ name }}</span>
      <span class="ap-time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
    </div>

    <!-- 进度条（可点击/可拖动） -->
    <div
      class="ap-progress"
      ref="progressRef"
      @pointerdown="onPointerDown"
    >
      <div class="ap-progress-buffer" :style="{ width: bufferedPercent + '%' }"></div>
      <div class="ap-progress-filled" :style="{ width: progressPercent + '%' }"></div>
      <div class="ap-progress-thumb" :style="{ left: progressPercent + '%' }"></div>
    </div>

    <!-- 控制按钮 -->
    <div class="ap-controls">
      <button class="ap-btn ap-play-btn" @click="togglePlay" :aria-label="playing ? '暂停' : '播放'">
        <svg v-if="!playing" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
      </button>

      <!-- 后退 10s -->
      <button class="ap-btn ap-secondary" @click="seek(-10)" aria-label="后退10秒">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/></svg>
      </button>

      <!-- 前进 10s -->
      <button class="ap-btn ap-secondary" @click="seek(10)" aria-label="前进10秒">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z"/></svg>
      </button>

      <span class="ap-speed" @click="cycleSpeed">{{ speed }}x</span>

      <!-- 音量（移动端隐藏，太挤） -->
      <div class="ap-volume" v-if="!isMobile">
        <button class="ap-btn ap-secondary" @click="toggleMute" :aria-label="muted ? '取消静音' : '静音'">
          <svg v-if="!muted && volume > 0" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          v-model.number="volume"
          @input="onVolumeChange"
          class="ap-volume-slider"
          aria-label="音量"
        />
      </div>
    </div>

    <audio
      ref="audioRef"
      :src="src"
      preload="metadata"
      @loadedmetadata="onLoadedMetadata"
      @timeupdate="onTimeUpdate"
      @progress="onProgress"
      @ended="onEnded"
      @error="onError"
    ></audio>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  src: { type: String, required: true },
  name: { type: String, default: '录音文件' }
})

const audioRef = ref(null)
const progressRef = ref(null)

const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const buffered = ref(0)
const volume = ref(1)
const muted = ref(false)
const speed = ref(1)
const isDark = ref(false)
const isMobile = ref(false)

// 检测主题
const detectTheme = () => {
  isDark.value = document.documentElement.getAttribute('data-theme') === 'dark'
}

// 检测移动端
const detectMobile = () => {
  isMobile.value = window.matchMedia('(max-width: 768px)').matches
}

// 监听主题变化
let themeObserver = null
onMounted(() => {
  detectTheme()
  detectMobile()
  // 监听 data-theme 属性变化
  themeObserver = new MutationObserver(detectTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  window.addEventListener('resize', detectMobile)
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
  window.removeEventListener('resize', detectMobile)
})

// 进度百分比
const progressPercent = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0)
const bufferedPercent = computed(() => duration.value ? (buffered.value / duration.value) * 100 : 0)

// 格式化时间 mm:ss
const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 播放/暂停
const togglePlay = async () => {
  if (!audioRef.value) return
  try {
    if (playing.value) {
      audioRef.value.pause()
    } else {
      await audioRef.value.play()
    }
  } catch (e) {
    console.error('播放失败:', e)
  }
}

// 快进/后退
const seek = (delta) => {
  if (!audioRef.value) return
  audioRef.value.currentTime = Math.max(0, Math.min(duration.value, audioRef.value.currentTime + delta))
}

// 倍速循环
const speeds = [1, 1.25, 1.5, 2, 0.75]
const cycleSpeed = () => {
  const idx = speeds.indexOf(speed.value)
  speed.value = speeds[(idx + 1) % speeds.length]
  if (audioRef.value) audioRef.value.playbackRate = speed.value
}

// 音量
const onVolumeChange = () => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value
    muted.value = volume.value === 0
  }
}
const toggleMute = () => {
  muted.value = !muted.value
  if (audioRef.value) audioRef.value.muted = muted.value
}

// 进度条拖动
let isDragging = false
const updateProgressFromEvent = (clientX) => {
  if (!progressRef.value || !audioRef.value || !duration.value) return
  const rect = progressRef.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  audioRef.value.currentTime = percent * duration.value
  currentTime.value = audioRef.value.currentTime
}

const onPointerDown = (e) => {
  isDragging = true
  updateProgressFromEvent(e.clientX)
  // 捕获指针事件，移出元素也能继续接收
  e.target.setPointerCapture?.(e.pointerId)
}

const onPointerMove = (e) => {
  if (isDragging) updateProgressFromEvent(e.clientX)
}

const onPointerUp = (e) => {
  if (isDragging) {
    isDragging = false
    e.target.releasePointerCapture?.(e.pointerId)
  }
}

// 组件内监听 pointermove/up（挂到 window 以便拖动时鼠标移出元素也能响应）
onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})

// audio 事件
const onLoadedMetadata = () => {
  duration.value = audioRef.value?.duration || 0
}
const onTimeUpdate = () => {
  if (!isDragging) currentTime.value = audioRef.value?.currentTime || 0
}
const onProgress = () => {
  const a = audioRef.value
  if (a && a.buffered.length > 0) {
    buffered.value = a.buffered.end(a.buffered.length - 1)
  }
}
const onEnded = () => {
  playing.value = false
}
const onError = (e) => {
  console.error('音频加载失败:', e, props.src)
}

// 监听 audio 播放/暂停状态（兼容外部控制）
watch(() => audioRef.value, (el) => {
  if (!el) return
  el.addEventListener('play', () => { playing.value = true })
  el.addEventListener('pause', () => { playing.value = false })
})
</script>

<style scoped>
.audio-player {
  background: var(--bg-secondary, #f7f8fa);
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 10px;
  transition: background 0.3s, border-color 0.3s;
}

/* 暗色主题 */
.audio-player.is-dark {
  background: var(--bg-card, #1e1e32);
  border-color: var(--border-color, #2a2a42);
}

/* 头部：文件名 + 时间 */
.ap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}
.ap-name {
  font-size: 14px;
  color: var(--text-primary, #1a1a2e);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.ap-time {
  font-size: 12px;
  color: var(--text-muted, #888);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* 进度条 */
.ap-progress {
  position: relative;
  height: 24px;          /* 触屏友好高度 */
  margin-bottom: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
}
.ap-progress::before {
  content: '';
  position: absolute;
  left: 0; right: 0;
  height: 4px;
  background: var(--border-color, #e8ecf1);
  border-radius: 2px;
}
.is-dark .ap-progress::before {
  background: var(--border-color, #2a2a42);
}
.ap-progress-buffer {
  position: absolute;
  height: 4px;
  background: var(--text-light, #bbb);
  border-radius: 2px;
  opacity: 0.4;
}
.ap-progress-filled {
  position: absolute;
  height: 4px;
  background: var(--accent-color, #667eea);
  border-radius: 2px;
  transition: width 0.1s linear;
}
.ap-progress-thumb {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--accent-color, #667eea);
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translateX(-50%);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  transition: transform 0.15s;
}
.is-dark .ap-progress-thumb {
  border-color: var(--bg-card, #1e1e32);
}
.ap-progress:hover .ap-progress-thumb {
  transform: translateX(-50%) scale(1.2);
}

/* 控制按钮 */
.ap-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ap-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary, #444);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.2s, color 0.2s;
}
.is-dark .ap-btn {
  color: var(--text-secondary, #b0b0c0);
}
.ap-btn:hover {
  background: var(--bg-hover, #f0f2ff);
  color: var(--accent-color, #667eea);
}
.ap-btn svg {
  width: 20px;
  height: 20px;
}
.ap-play-btn {
  background: var(--accent-color, #667eea);
  color: #fff !important;
  width: 40px;
  height: 40px;
}
.ap-play-btn:hover {
  background: var(--accent-hover, #5a6fd6);
}
.ap-play-btn svg {
  width: 22px;
  height: 22px;
}
.ap-secondary svg {
  width: 18px;
  height: 18px;
}

/* 倍速 */
.ap-speed {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-muted, #888);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  transition: background 0.2s, color 0.2s;
}
.ap-speed:hover {
  background: var(--bg-hover, #f0f2ff);
  color: var(--accent-color, #667eea);
}

/* 音量 */
.ap-volume {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ap-volume-slider {
  width: 70px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border-color, #e8ecf1);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.ap-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--accent-color, #667eea);
  border-radius: 50%;
  cursor: pointer;
}
.ap-volume-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: var(--accent-color, #667eea);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* 移动端适配：按钮更大，间距更宽 */
@media (max-width: 768px) {
  .audio-player {
    padding: 10px 12px;
  }
  .ap-name {
    font-size: 13px;
  }
  .ap-time {
    font-size: 11px;
  }
  .ap-progress {
    height: 32px;        /* 更大的触控区域 */
  }
  .ap-progress::before,
  .ap-progress-buffer,
  .ap-progress-filled {
    height: 6px;         /* 更粗的进度条 */
  }
  .ap-progress-thumb {
    width: 18px;
    height: 18px;
  }
  .ap-play-btn {
    width: 44px;
    height: 44px;
  }
  .ap-play-btn svg {
    width: 24px;
    height: 24px;
  }
  .ap-secondary svg {
    width: 22px;
    height: 22px;
  }
  .ap-speed {
    font-size: 14px;
    padding: 6px 10px;
  }
}
</style>
