<template>
  <div class="comment-section">
    <!-- 评论列表 - 使用递归组件 -->
    <div v-if="comments.length > 0" class="comment-list">
      <CommentItem
        v-for="comment in topLevelComments"
        :key="comment.id"
        :comment="comment"
        :depth="0"
        :current-user-id="authStore.user?.id || ''"
        @reply="handleReplySubmit"
        @delete="handleDelete"
      />
    </div>

    <!-- 空状态 -->
    <div v-else class="comment-empty">
      <span class="empty-icon">💬</span>
      <p>暂无评论，来说点什么吧</p>
    </div>

    <!-- 回复目标提示 -->
    <div v-if="replyTarget" class="reply-target">
      <span>回复 @{{ maskAuthor(replyTarget.username) }}</span>
      <button @click="cancelReply" class="reply-cancel">取消</button>
    </div>

    <!-- 评论输入区域 -->
    <div class="comment-input-area">
      <textarea
        ref="textareaRef"
        v-model="newComment"
        placeholder="写下你的评论... (Ctrl+Enter 快捷发送)"
        class="comment-textarea"
        @keydown.ctrl.enter="submitComment"
        @keydown.meta.enter="submitComment"
      />
      <div class="comment-toolbar">
        <MemePicker :textareaRef="textareaRef" @insert="insertMeme" />
        <button
          @click="submitComment"
          class="comment-submit"
          :disabled="!newComment.trim() || isSubmitting"
        >
          {{ isSubmitting ? '发送中...' : '发送' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '@/stores/auth'
import CommentItem from './CommentItem.vue'
import MemePicker, { renderMeme } from './MemePicker.vue'

// ===== Props =====
const props = defineProps({
  noteId: {
    type: String,
    required: true
  }
})

// ===== Stores =====
const authStore = useAuthStore()

// ===== 响应式数据 =====
const comments = ref([])
const newComment = ref('')
const textareaRef = ref(null)
const replyTarget = ref(null) // { id, username }
const isLoading = ref(false)
const isSubmitting = ref(false)

// ===== 计算属性：构建树形结构（楼中楼） =====
const topLevelComments = computed(() => {
  const map = new Map()
  const roots = []

  // 先建立映射
  comments.value.forEach(c => {
    map.set(c.id, { ...c, children: [] })
  })

  // 构建父子关系
  comments.value.forEach(c => {
    const node = map.get(c.id)
    if (c.parent_id && map.has(c.parent_id)) {
      const parent = map.get(c.parent_id)
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // 按时间排序（最新的在前）
  roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  roots.forEach(root => {
    if (root.children?.length) {
      root.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    }
  })

  return roots
})

// ===== 从 localStorage 取 token =====
function getAuthHeader() {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const stored = localStorage.getItem('auth')
    if (stored) {
      const { token } = JSON.parse(stored)
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
  } catch (_) {}
  return headers
}

// ===== 用户名脱敏 =====
const maskAuthor = (username) => {
  if (!username) return '匿名用户'
  if (username.length < 3) return username
  const maskLen = Math.min(4, username.length - 2)
  return username.slice(0, 2) + '*'.repeat(maskLen) + username.slice(2 + maskLen)
}

// ===== 加载评论 =====
const loadComments = async () => {
  isLoading.value = true
  try {
    const response = await fetch(`/api/comments?noteId=${props.noteId}`)
    if (!response.ok) throw new Error('加载评论失败')
    const data = await response.json()
    comments.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('加载评论失败:', e)
    comments.value = []
  } finally {
    isLoading.value = false
  }
}

// ===== 提交评论 =====
const submitComment = async () => {
  const content = newComment.value.trim()
  if (!content || isSubmitting.value) return

  if (!authStore.user) {
    alert('请先登录')
    return
  }

  isSubmitting.value = true

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({
        note_id: Number(props.noteId),
        content: content,
        parent_id: replyTarget.value?.id || null
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || '提交评论失败')
    }

    newComment.value = ''
    replyTarget.value = null
    await loadComments()
    textareaRef.value?.focus()
  } catch (e) {
    console.error('提交评论失败:', e)
    alert('提交失败：' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

// ===== 处理子评论的回复事件 =====
const handleReplySubmit = async ({ parentId, content }) => {
  if (!authStore.user) {
    alert('请先登录')
    return
  }

  if (isSubmitting.value) return
  isSubmitting.value = true

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({
        note_id: Number(props.noteId),
        content: content,
        parent_id: parentId
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || '回复失败')
    }

    await loadComments()
  } catch (e) {
    console.error('回复失败:', e)
    alert('回复失败：' + e.message)
  } finally {
    isSubmitting.value = false
  }
}

// ===== 删除评论 =====
const handleDelete = async ({ commentId }) => {
  if (!confirm('确定要删除这条评论吗？')) return

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ action: 'delete', id: commentId })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || '删除失败')
    }

    await loadComments()
  } catch (e) {
    console.error('删除评论失败:', e)
    alert('删除失败：' + e.message)
  }
}

// ===== 回复评论（顶层回复） =====
const replyToComment = (comment) => {
  replyTarget.value = { id: comment.id, username: comment.username }
  textareaRef.value?.focus()
}

const cancelReply = () => {
  replyTarget.value = null
}

// ===== 插入表情包 =====
const insertMeme = ({ placeholder, start, end }) => {
  if (start >= 0 && end >= 0) {
    const before = newComment.value.slice(0, start)
    const after = newComment.value.slice(end)
    newComment.value = before + placeholder + after
  } else {
    newComment.value += placeholder
  }
}

// ===== 格式化时间 =====
const formatTime = (isoString) => {
  if (!isoString) return '刚刚'
  const date = new Date(isoString)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}天前`
  return date.toLocaleDateString('zh-CN')
}

// ===== 渲染内容（含表情包） =====
const renderContent = (content) => {
  return renderMeme(content)
}

// ===== 暴露方法给父组件 =====
defineExpose({ loadComments })

// ===== 生命周期 =====
onMounted(() => {
  loadComments()
})
</script>

<style scoped>
/* ===== 评论容器 ===== */
.comment-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light, #f0f0f0);
}

/* ===== 评论列表 ===== */
.comment-list {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

/* ===== 空状态 ===== */
.comment-empty {
  text-align: center;
  padding: 30px 0;
  color: var(--text-muted, #999);
}

.comment-empty .empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 8px;
}

.comment-empty p {
  font-size: 14px;
  margin: 0;
}

/* ===== 回复目标提示 ===== */
.reply-target {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: rgba(102, 126, 234, 0.08);
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--accent-color, #667eea);
}

.reply-cancel {
  background: none;
  border: none;
  color: var(--text-muted, #999);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.reply-cancel:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* ===== 评论输入区域 ===== */
.comment-input-area {
  margin-top: 12px;
  padding: 14px 16px 12px;
  background: var(--bg-primary, #f8f9fa);
  border-radius: 12px;
  border: 1px solid var(--border-light, #f0f0f0);
  transition: border-color 0.3s, box-shadow 0.3s;
}

.comment-textarea {
  width: 100%;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 8px;
  resize: vertical;
  font-size: 14px;
  font-family: inherit;
  background: var(--bg-secondary, #fff);
  color: var(--text-primary, #333);
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.comment-textarea:focus {
  outline: none;
  border-color: var(--accent-color, #667eea);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

.comment-textarea::placeholder {
  color: var(--text-muted, #aaa);
}

.comment-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ===== 工具栏 ===== */
.comment-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  gap: 8px;
}

.comment-toolbar .meme-picker {
  flex-shrink: 0;
}

.comment-submit {
  padding: 6px 20px;
  background: var(--accent-color, #667eea);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.comment-submit:hover:not(:disabled) {
  background: #5a6fd6;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35);
}

.comment-submit:active:not(:disabled) {
  transform: translateY(0);
}

.comment-submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* ===== 暗色模式适配 ===== */
[data-theme="dark"] .comment-input-area {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .comment-textarea {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

[data-theme="dark"] .comment-textarea:focus {
  border-color: var(--accent-color, #818cf8);
}

[data-theme="dark"] .reply-target {
  background: rgba(102, 126, 234, 0.15);
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .comment-input-area {
    padding: 10px 12px;
  }

  .comment-textarea {
    min-height: 44px;
    font-size: 15px;
  }

  .comment-toolbar {
    flex-wrap: wrap;
  }

  .comment-submit {
    flex: 1;
    text-align: center;
    padding: 6px 12px;
  }
}

/* ===== 减少动画偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .comment-submit {
    transition: none !important;
  }
}
</style>