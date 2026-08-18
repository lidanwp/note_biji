<template>
  <div class="meme-picker" ref="pickerRef">
    <button
      type="button"
      class="meme-trigger"
      :class="{ 'is-active': showPanel }"
      @click="togglePanel"
    >
      😜 表情包
    </button>

    <transition name="meme-panel">
      <div v-if="showPanel" class="meme-panel">
        <div class="meme-panel-header">
          <span>搞笑表情包</span>
          <button type="button" class="meme-close" @click="showPanel = false">×</button>
        </div>
        <div class="meme-grid">
          <button
            v-for="meme in memeEmojis"
            :key="meme.id"
            type="button"
            class="meme-item"
            :title="meme.name"
            @click="insertMeme(meme)"
          >
            <img :src="meme.url" :alt="meme.name" loading="lazy" referrerpolicy="no-referrer" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
/**
 * 表情包数据 + 渲染函数
 * 通过命名导出供父组件（CommentSection 等）共享使用
 */
const supabaseUrl = 'https://oobypberpdpizktzlbph.supabase.co/storage/v1/object/public/meme'

export const memeEmojis = [
  { id: 'meme_01', name: '然后这又有什么卵用呢', url: `${supabaseUrl}/ff4608be7b001da624bdd4d076fe90d5.jpg` },
  { id: 'meme_02', name: '表情包 2', url: `${supabaseUrl}/f5a44c4fa04bdfb0925238123da4bc66.jpg` },
  { id: 'meme_03', name: '表情包 3', url: `${supabaseUrl}/e56d136230791d4e1ea2c5ec3c251d04.gif` },
  { id: 'meme_04', name: '表情包 4', url: `${supabaseUrl}/dbb57a8a6364decda4c481834e55d41d.jpg` },
  { id: 'meme_05', name: '表情包 5', url: `${supabaseUrl}/d4279a976f570199d361ec59c03fe6f1.jpg` },
  { id: 'meme_06', name: '表情包 6', url: `${supabaseUrl}/786e55bed2bdf42068c6fb39bfda501d.gif` },
  { id: 'meme_07', name: '表情包 7', url: `${supabaseUrl}/72d130b4074f74b9969aa421acda6f48.jpg` },
  { id: 'meme_08', name: '表情包 8', url: `${supabaseUrl}/36107a539902b795e4bdde3a81c01326.jpg` },
  { id: 'meme_09', name: '表情包 9', url: `${supabaseUrl}/2de502de9a0a26422116f05c77335dfc.jpg` },
  { id: 'meme_10', name: '表情包 10', url: `${supabaseUrl}/22347a459ff127ea6e128a653ee2392c.gif` },
  { id: 'meme_11', name: '表情包 11', url: `${supabaseUrl}/1a85cb72b7646a120aabc4c9549b52ed.jpg` },
  { id: 'meme_12', name: '表情包 12', url: `${supabaseUrl}/14db09ffd83ffcca1b1a9f655c6ff569.jpg` },
  { id: 'meme_13', name: '疯狂践踏偷懒的你', url: `${supabaseUrl}/053e7ebaa9b78d8ae48f2a1d5118cfe5.jpg` },
  { id: 'meme_14', name: '表情包 14', url: `${supabaseUrl}/01bdb922f9f40f8ed1a0422fd4760801.gif` },
]

/**
 * 把文本中的 [meme:id] 占位符替换为 <img class="meme-emoji" /> 标签
 * 用于评论内容渲染前预处理
 */
export const renderMeme = (text) => {
  if (!text) return ''
  return text.replace(/\[meme:([a-zA-Z0-9_]+)\]/g, (match, id) => {
    const meme = memeEmojis.find(m => m.id === id)
    if (!meme) return match
    return `<img src="${meme.url}" alt="${meme.name}" class="meme-emoji" referrerpolicy="no-referrer" />`
  })
}

export default { name: 'MemePicker' }
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  textareaRef: {
    type: [Object, null],
    default: null
  }
})

const emit = defineEmits(['insert'])

const pickerRef = ref(null)
const showPanel = ref(false)

const togglePanel = () => {
  showPanel.value = !showPanel.value
}

const insertMeme = (meme) => {
  const placeholder = `[meme:${meme.id}]`
  const textarea = props.textareaRef

  if (!textarea) {
    emit('insert', { placeholder, start: -1, end: -1 })
    showPanel.value = false
    return
  }

  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0

  emit('insert', { placeholder, start, end })

  showPanel.value = false

  nextTick(() => {
    textarea.focus()
    const pos = start + placeholder.length
    textarea.setSelectionRange(pos, pos)
  })
}

const handleClickOutside = (e) => {
  if (!pickerRef.value) return
  if (!pickerRef.value.contains(e.target)) {
    showPanel.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.meme-picker {
  position: relative;
  display: inline-block;
}

.meme-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  font-size: 13px;
  color: var(--text-secondary, #444);
  background: var(--bg-secondary, #fff);
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s var(--ease-soft, ease);
}

.meme-trigger:hover,
.meme-trigger.is-active {
  border-color: var(--accent-color, #667eea);
  color: var(--accent-color, #667eea);
}

.meme-trigger.is-active {
  background: var(--accent-light, rgba(102, 126, 234, 0.12));
}

.meme-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 2000;
  width: 280px;
  max-height: min(52vh, 300px);
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 10px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}

.meme-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-muted, #888);
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.meme-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--text-muted, #999);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  border-radius: 4px;
}

.meme-close:hover {
  background: var(--bg-hover, #f0f2ff);
  color: var(--text-primary, #333);
}

.meme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 8px;
  max-height: min(46vh, 240px);
  overflow-y: auto;
  background: #fff;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.7) transparent;
}

.meme-grid::-webkit-scrollbar {
  width: 6px;
}

.meme-grid::-webkit-scrollbar-track {
  background: transparent;
}

.meme-grid::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.6);
  border-radius: 999px;
}

.meme-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}

.meme-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  padding: 2px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  background: #f8fafc;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.meme-item:hover {
  border-color: rgba(148, 163, 184, 0.45);
  background: #f1f5f9;
}

.meme-item img {
  width: 58px;
  height: 58px;
  object-fit: cover;
  border-radius: 4px;
  pointer-events: none;
}

.meme-panel-enter-active,
.meme-panel-leave-active {
  transition: opacity 0.2s var(--ease-soft, ease),
              transform 0.2s var(--ease-soft, ease);
}

.meme-panel-enter-from,
.meme-panel-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}

/* ============================================
   关键修复：评论中显示的表情包大小
   ============================================ */
.meme-emoji {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 4px;
  vertical-align: middle;
  display: inline-block;
}

/* 可选：悬停效果 */
.meme-emoji:hover {
  transform: scale(1.08);
  transition: transform 0.2s ease;
}

/* 可选：在小屏幕上调整大小 */
@media (max-width: 480px) {
  .meme-emoji {
    width: 36px;
    height: 36px;
  }
}
</style>