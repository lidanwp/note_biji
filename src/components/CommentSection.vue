<template>
  <div class="comment-section">
    <div class="comment-header">
      <h4>💬 评论 <span class="comment-count">({{ comments.length }})</span></h4>
    </div>

    <!-- 评论输入 -->
    <div class="comment-input-wrapper">
      <div class="comment-avatar">{{ authStore.user?.username?.charAt(0) || '👤' }}</div>
      <div class="comment-input-area">
        <textarea
          v-model="newComment"
          placeholder="写下你的想法... (支持 Markdown)"
          rows="2"
          @keydown.ctrl.enter="submitComment"
        ></textarea>
        <div class="input-actions">
          <span class="input-hint">Ctrl + Enter 快捷发送</span>
          <button @click="submitComment" :disabled="!newComment.trim()" class="btn-submit">
            发送评论
          </button>
        </div>
      </div>
    </div>

    <!-- 评论列表 -->
    <div class="comment-list" ref="commentListRef">
      <div
        v-for="comment in sortedComments"
        :key="comment.id"
        class="comment-item"
        :class="{ 'is-reply': comment.parentId }"
      >
        <div class="comment-avatar">
          {{ comment.username?.charAt(0) || '👤' }}
        </div>
        <div class="comment-body">
          <div class="comment-meta">
            <span class="comment-author">{{ comment.username || '匿名用户' }}</span>
            <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
            <button class="btn-reply" @click="startReply(comment)">回复</button>
            <button
              v-if="comment.userId === authStore.user?.id"
              class="btn-delete"
              @click="deleteComment(comment.id)"
            >
              删除
            </button>
          </div>
          <div class="comment-content" v-html="renderMarkdown(comment.content)"></div>

          <!-- 子评论（回复） -->
          <div v-if="comment.replies?.length" class="replies">
            <div
              v-for="reply in comment.replies"
              :key="reply.id"
              class="comment-item is-reply"
            >
              <div class="comment-avatar">{{ reply.username?.charAt(0) || '👤' }}</div>
              <div class="comment-body">
                <div class="comment-meta">
                  <span class="comment-author">{{ reply.username || '匿名用户' }}</span>
                  <span class="comment-time">{{ formatTime(reply.created_at) }}</span>
                  <span class="reply-to">回复 @{{ comment.username }}</span>
                  <button
                    v-if="reply.userId === authStore.user?.id"
                    class="btn-delete"
                    @click="deleteComment(reply.id)"
                  >
                    删除
                  </button>
                </div>
                <div class="comment-content" v-html="renderMarkdown(reply.content)"></div>
              </div>
            </div>
          </div>

          <!-- 内联回复输入框 -->
          <div v-if="replyingTo === comment.id" class="reply-input-wrapper">
            <textarea
              v-model="replyContent"
              placeholder="写下你的回复..."
              rows="2"
              @keydown.ctrl.enter="submitReply(comment)"
            ></textarea>
            <div class="input-actions">
              <button @click="cancelReply" class="btn-cancel">取消</button>
              <button @click="submitReply(comment)" :disabled="!replyContent.trim()" class="btn-submit">
                回复
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="comments.length === 0" class="empty-comments">
        <span>📝</span>
        <p>暂无评论，快来写下你的第一条评论吧！</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import MarkdownIt from 'markdown-it'

const props = defineProps({
  noteId: {
    type: String,
    required: true
  }
})

const authStore = useAuthStore()
const md = new MarkdownIt({ html: true, linkify: true })

const comments = ref([])
const newComment = ref('')
const replyContent = ref('')
const replyingTo = ref(null)
const commentListRef = ref(null)

// 排序：按时间升序，回复跟在父评论后面
const sortedComments = computed(() => {
  const top = comments.value.filter(c => !c.parentId)
  const replies = comments.value.filter(c => c.parentId)

  return top.map(parent => ({
    ...parent,
    replies: replies.filter(r => r.parentId === parent.id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  }))
})

const formatTime = (timestamp) => {
  if (!timestamp) return '刚刚'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)

  if (diff < 60) return diff + '秒前'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 604800) return Math.floor(diff / 86400) + '天前'
  return date.toLocaleDateString('zh-CN')
}

const renderMarkdown = (content) => {
  if (!content) return ''
  return md.render(content)
}

// 加载评论
const loadComments = async () => {
  try {
    const response = await fetch('/api/comments?noteId=' + props.noteId)
    if (!response.ok) {
      throw new Error('加载评论失败')
    }
    comments.value = await response.json()
  } catch (error) {
    console.error('❌ 加载评论失败:', error)
    comments.value = []
  }
}

// 提交评论
const submitComment = async () => {
  if (!newComment.value.trim()) return
  if (!authStore.user) {
    alert('请先登录')
    return
  }

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: Number(props.noteId),
        user_id: authStore.user.id || authStore.user.username,
        username: authStore.user.username,
        content: newComment.value.trim()
      })
    })

    if (!response.ok) {
      throw new Error('提交评论失败')
    }

    newComment.value = ''
    await loadComments()
    scrollToBottom()
  } catch (error) {
    console.error('❌ 提交评论失败:', error)
    alert('提交失败，请重试')
  }
}

// 开始回复
const startReply = (comment) => {
  replyingTo.value = comment.id
  replyContent.value = ''
  nextTick(() => {
    const textarea = document.querySelector('.reply-input-wrapper textarea')
    textarea?.focus()
  })
}

// 取消回复
const cancelReply = () => {
  replyingTo.value = null
  replyContent.value = ''
}

// 提交回复
const submitReply = async (parentComment) => {
  if (!replyContent.value.trim()) return
  if (!authStore.user) {
    alert('请先登录')
    return
  }

  try {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note_id: Number(props.noteId),
        user_id: authStore.user.id || authStore.user.username,
        username: authStore.user.username,
        content: replyContent.value.trim(),
        parent_id: parentComment.id
      })
    })

    if (!response.ok) {
      throw new Error('提交回复失败')
    }

    replyContent.value = ''
    replyingTo.value = null
    await loadComments()
    scrollToBottom()
  } catch (error) {
    console.error('❌ 提交回复失败:', error)
    alert('提交失败，请重试')
  }
}

// 删除评论
const deleteComment = async (commentId) => {
  if (!confirm('确定要删除这条评论吗？')) return

  try {
    const response = await fetch('/api/comments/' + commentId, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('删除评论失败')
    }

    await loadComments()
  } catch (error) {
    console.error('❌ 删除评论失败:', error)
    alert('删除失败，请重试')
  }
}

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (commentListRef.value) {
      commentListRef.value.scrollTop = commentListRef.value.scrollHeight
    }
  })
}

// 暴露加载方法给父组件
defineExpose({ loadComments })

onMounted(() => {
  loadComments()
})
</script>

<style scoped>
.comment-section {
  margin-top: 24px;
  padding: 20px;
  background: var(--bg-secondary, #f8f9fc);
  border-radius: 12px;
  border: 1px solid var(--border-color, #e8ecf1);
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.comment-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #333);
}

.comment-count {
  font-size: 14px;
  color: var(--text-muted, #999);
  font-weight: normal;
}

/* 评论输入 */
.comment-input-wrapper {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.comment-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #667eea;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.comment-input-area {
  flex: 1;
  background: var(--bg-input, #ffffff);
  border-radius: 10px;
  border: 1px solid var(--border-color, #e8ecf1);
  overflow: hidden;
}

.comment-input-area textarea {
  width: 100%;
  padding: 10px 14px;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 14px;
  font-family: inherit;
  min-height: 50px;
  background: transparent;
  color: var(--text-primary, #333);
}

.comment-input-area textarea::placeholder {
  color: var(--text-light, #bbb);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px 10px;
  border-top: 1px solid var(--border-light, #f0f0f0);
}

.input-hint {
  font-size: 12px;
  color: var(--text-muted, #bbb);
}

.btn-submit {
  padding: 6px 18px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-submit:hover:not(:disabled) {
  background: #5a6fd6;
}

.btn-submit:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 6px 16px;
  background: #f0f0f0;
  color: #666;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

/* 评论列表 */
.comment-list {
  max-height: 500px;
  overflow-y: auto;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-item.is-reply {
  padding-left: 48px;
  border-bottom: none;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.comment-author {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary, #333);
}

.comment-time {
  font-size: 12px;
  color: var(--text-muted, #bbb);
}

.reply-to {
  font-size: 12px;
  color: var(--accent-color, #667eea);
  background: var(--accent-light, #f0f2ff);
  padding: 0 8px;
  border-radius: 4px;
}

.btn-reply {
  font-size: 12px;
  color: var(--accent-color, #667eea);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.btn-reply:hover {
  text-decoration: underline;
}

.btn-delete {
  font-size: 12px;
  color: var(--danger-color, #e74c3c);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.btn-delete:hover {
  text-decoration: underline;
}

.comment-content {
  font-size: 14px;
  color: var(--text-secondary, #444);
  line-height: 1.7;
}

.comment-content :deep(p) {
  margin: 4px 0;
}

.comment-content :deep(code) {
  background: var(--bg-code, #f0f0f0);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-primary, #333);
}

.comment-content :deep(blockquote) {
  border-left: 3px solid var(--accent-color, #667eea);
  padding-left: 12px;
  margin: 4px 0;
  color: var(--text-secondary, #666);
}

/* 回复输入框 */
.reply-input-wrapper {
  margin-top: 8px;
  background: var(--bg-input, #ffffff);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e8ecf1);
  overflow: hidden;
}

.reply-input-wrapper textarea {
  width: 100%;
  padding: 8px 12px;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 14px;
  font-family: inherit;
  background: transparent;
  color: var(--text-primary, #333);
}

.reply-input-wrapper .input-actions {
  padding: 4px 10px 8px;
  border-top: 1px solid var(--border-light, #f0f0f0);
}

/* 空状态 */
.empty-comments {
  text-align: center;
  padding: 30px 0;
  color: var(--text-muted, #999);
}

.empty-comments span {
  font-size: 32px;
  display: block;
  margin-bottom: 8px;
}

.empty-comments p {
  margin: 0;
  font-size: 14px;
}
</style>