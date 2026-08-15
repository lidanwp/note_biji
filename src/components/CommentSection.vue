<template>
  <div class="comment-section">
    <!-- 评论列表 -->
    <div v-if="comments.length > 0" class="comment-list">
      <div
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item"
      >
        <div class="comment-header">
          <span class="comment-author">{{ maskAuthor(comment.username) }}</span>
          <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
          <button
            v-if="canDelete(comment)"
            @click="deleteComment(comment.id)"
            class="comment-delete"
            title="删除评论"
          >
            ×
          </button>
        </div>
        <!-- 评论内容 - 表情包在这里渲染，自然换行 -->
        <div class="comment-text" v-html="renderMeme(comment.content)"></div>
        <button
          @click="replyToComment(comment)"
          class="comment-reply-btn"
        >
          💬 回复
        </button>
      </div>
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
          :disabled="!newComment.trim()"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
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

// ===== 从 localStorage 取 token，构造请求头 =====
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

// ===== 用户名脱敏：第 3~6 位字符替换为 * =====
const maskAuthor = (username) => {
  if (!username) return '匿名用户'
  if (username.length < 3) return username
  const maskLen = Math.min(4, username.length - 2)
  return username.slice(0, 2) + '*'.repeat(maskLen) + username.slice(2 + maskLen)
}

// ===== 从后端 API 加载评论 =====
const loadComments = async () => {
  isLoading.value = true
  try {
    const response = await fetch('/api/comments?noteId=' + props.noteId)
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

// ===== 提交评论到后端 API =====
const submitComment = async () => {
  const content = newComment.value.trim()
  if (!content) return

  if (!authStore.user) {
    alert('请先登录')
    return
  }

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
  }
}

// ===== 删除评论 =====
const deleteComment = async (commentId) => {
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

// ===== 判断是否有权限删除 =====
const canDelete = (comment) => {
  const userId = authStore.user?.id
  return userId && (String(comment.user_id) === String(userId) || authStore.user?.role === 'admin')
}

// ===== 回复评论 =====
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

// ===== 暴露加载方法给父组件 =====
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
  gap: 16px;
  margin-bottom: 20px;
}

.comment-item {
  padding: 14px 16px;
  background: var(--bg-primary, #f8f9fa);
  border-radius: 10px;
  border: 1px solid var(--border-light, #f0f0f0);
  transition: background 0.2s;
}

.comment-item:hover {
  background: var(--bg-secondary, #fff);
}

/* ===== 评论头部 ===== */
.comment-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.comment-author {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary, #333);
}

.comment-time {
  font-size: 12px;
  color: var(--text-muted, #999);
  margin-left: auto;
}

.comment-delete {
  background: none;
  border: none;
  color: var(--text-muted, #999);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
  border-radius: 4px;
  transition: all 0.2s;
}

.comment-delete:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.1);
}

/* ===== 评论内容 ===== */
.comment-text {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-primary, #333);
  word-wrap: break-word;
  word-break: break-word;
  white-space: normal;
  overflow-wrap: break-word;
}

/* ===== 关键修复：评论中的表情包（v-html 内容需用 :deep） ===== */
.comment-text :deep(.meme-emoji) {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  vertical-align: middle;
  display: inline-block;
  margin: 2px 4px;
  border: 1px solid var(--border-light, #f0f0f0);
  background: var(--bg-primary, #f8f9fa);
}

/* 确保所有图片不超过容器 */
.comment-text :deep(img) {
  max-width: 100%;
  height: auto;
}

/* ===== 回复按钮 ===== */
.comment-reply-btn {
  margin-top: 8px;
  padding: 4px 12px;
  background: none;
  border: none;
  color: var(--accent-color, #667eea);
  cursor: pointer;
  font-size: 12px;
  border-radius: 4px;
  transition: background 0.2s;
}

.comment-reply-btn:hover {
  background: rgba(102, 126, 234, 0.1);
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

.comment-input-area:focus-within {

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
[data-theme="dark"] .comment-item {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.06);
}

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

[data-theme="dark"] .comment-text :deep(.meme-emoji) {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .comment-item {
    padding: 10px 12px;
  }

  .comment-text {
    font-size: 14px;
    line-height: 1.7;
  }

  /* 手机端表情包 */
  .comment-text :deep(.meme-emoji) {
    width: 64px;
    height: 64px;
    margin: 1px 3px;
  }

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
  .comment-item,
  .comment-submit,
  .comment-text :deep(.meme-emoji) {
    transition: none !important;
  }
}
</style>