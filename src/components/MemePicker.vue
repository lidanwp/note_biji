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
            <img :src="meme.url" :alt="meme.name" loading="lazy" />
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
export const memeEmojis = [
  {
    id: 'meme_1',
    name: '表情包 1',
    url: 'https://oobypberpdpizktzlbph.supabase.co/storage/v1/object/public/meme/005PeXV6ly1h08k6aich8j30sf0r4guq.jpg'
  },
  {
    id: 'meme_2',
    name: '吃瓜群众',
    url: 'https://oobypberpdpizktzlbph.supabase.co/storage/v1/object/public/meme/005PeXV6ly1h08k6aqbk6j30sg0r4ajw.jpg'
  },
  {
    id: 'meme_3',
    name: '表情包 3',
    url: 'https://oobypberpdpizktzlbph.supabase.co/storage/v1/object/public/meme/ceeb653ely8hcteqnv7jsj20hs0ho3z8.jpg'
  }
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
    return `<img src="${meme.url}" alt="${meme.name}" class="meme-emoji" />`
  })
}

export default { name: 'MemePicker' }
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  // 父组件传入的 textarea DOM 元素引用，用于定位光标插入位置
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

// 点击表情包：在 textarea 光标位置插入占位符 [meme:id]
const insertMeme = (meme) => {
  const placeholder = `[meme:${meme.id}]`
  const textarea = props.textareaRef

  if (!textarea) {
    // 无 textarea 引用时，通知父组件追加（start/end = -1 表示末尾追加）
    emit('insert', { placeholder, start: -1, end: -1 })
    showPanel.value = false
    return
  }

  const start = textarea.selectionStart ?? 0
  const end = textarea.selectionEnd ?? 0

  emit('insert', { placeholder, start, end })

  showPanel.value = false

  // 重新聚焦并把光标移到占位符之后
  nextTick(() => {
    textarea.focus()
    const pos = start + placeholder.length
    textarea.setSelectionRange(pos, pos)
  })
}

// 点击外部关闭面板
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

/* 浮动面板 */
.meme-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 1000;
  width: 280px;
  background: var(--bg-secondary, #fff);
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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

/* 网格：每行 4 个 */
.meme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 10px;
  max-height: 240px;
  overflow-y: auto;
}

.meme-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1 / 1;
  padding: 2px;
  border: 1px solid var(--border-light, #f0f0f0);
  border-radius: 6px;
  background: var(--bg-primary, #f5f7fa);
  cursor: pointer;
  transition: transform 0.15s var(--ease-soft, ease),
              box-shadow 0.15s var(--ease-soft, ease),
              border-color 0.15s var(--ease-soft, ease);
}

.meme-item:hover {
  border-color: var(--accent-color, #667eea);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px var(--ink-violet, rgba(102, 126, 234, 0.35));
}

.meme-item img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  pointer-events: none;
}

/* 面板展开/收起动画 */
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
</style>