<template>
  <div class="comment-section">
    <div class="comment-header">
      <h4>💬 评论 <span class="comment-count">({{ totalComments }})</span></h4>
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

    <!-- 评论列表（树形） -->
    <div class="comment-list" ref="commentListRef">
      <CommentItem
        v-for="root in commentTree"
        :key="root.id"
        :comment="root"
        :depth="0"
      />

      <div v-if="comments.length === 0" class="empty-comments">
        <span>📝</span>
        <p>暂无评论，快来写下你的第一条评论吧！</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, provide, nextTick, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import MarkdownIt from 'markdown-it'
import CommentItem from './CommentItem.vue'

const props = defineProps({
  noteId: {
    type: String,
    required: true
  }
})

const authStore = useAuthStore()
const md = new MarkdownIt({ html: true, linkify: true })

const comments = ref([])              // 扁平评论数组（数据库原始结构）
const newComment = ref('')            // 顶层评论输入框内容
const replyContent = ref('')          // 内联回复输入框内容
const replyingTo = ref(null)          // 当前正在回复的评论 id
const commentListRef = ref(null)

const currentUserId = computed(() => authStore.user?.id)
const totalComments = computed(() => comments.value.length)

/**
 * 把扁平评论数组按 parent_id 构建成树形结构（支持任意层级嵌套）
 * 算法：两遍遍历
 *   1. 第一遍：为每条评论创建带 children 的节点，建立 id -> node 映射
 *   2. 第二遍：根据 parent_id 把节点挂到父节点的 children 上；无父节点的作为根
 * 边界处理：parent_id 指向不存在的评论（孤儿）自动降级为根节点
 */
const buildTree = (flatList) => {
  const map = new Map()
  const roots = []

  flatList.forEach(item => {
    map.set(item.id, { ...item, children: [] })
  })

  flatList.forEach(item => {
    const node = map.get(item.id)
    const parentId = item.parent_id
    if (parentId && map.has(parentId)) {
      map.get(parentId).children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

// 树形评论（顶层评论数组，每项含 children 递归结构）
const commentTree = computed(() => buildTree(comments.value))

// 邮箱脱敏：第 3~6 位字符替换为 *
const maskAuthor = (username) => {
  if (!username) return '匿名用户'
  if (username.length < 3) return username
  const maskLen = Math.min(4, username.length - 2)
  return username.slice(0, 2) + '*'.repeat(maskLen) + username.slice(2 + maskLen)
}

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

// 提交顶层评论
const submitComment = async () => {
  if (!newComment.value.trim()) return
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

// 开始回复：记录目标评论 id，清空输入框，自动聚焦
const onStartReply = (comment) => {
  replyingTo.value = comment.id
  replyContent.value = ''
  nextTick(() => {
    const textarea = document.querySelector('.reply-input-wrapper textarea')
    textarea?.focus()
  })
}

// 取消回复
const onCancelReply = () => {
  replyingTo.value = null
  replyContent.value = ''
}

// 提交回复：带上被回复评论的 id 作为 parent_id
const onSubmitReply = async (parentComment) => {
  if (!replyContent.value.trim()) return
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
        content: replyContent.value.trim(),
        parent_id: parentComment.id
      })
    })

    if (!response.ok) {
      throw new Error('提交回复失败')
    }

    replyContent.value = ''
    replyingTo.value = null
    await loadComments()   // 刷新列表，保持树形结构
    scrollToBottom()
  } catch (error) {
    console.error('❌ 提交回复失败:', error)
    alert('提交失败，请重试')
  }
}

// 删除评论
const onDelete = async (commentId) => {
  if (!confirm('确定要删除这条评论吗？')) return

  try {
    const response = await fetch('/api/comments/' + commentId, {
      method: 'DELETE',
      headers: getAuthHeader()
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

// 通过 provide 把回复状态和回调注入递归子组件 CommentItem
provide('commentContext', {
  replyingTo,
  replyContent,
  currentUserId,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onDelete,
  maskAuthor,
  formatTime,
  renderMarkdown
})

// 暴露加载方法给父组件
defineExpose({ loadComments })

/** 从 localStorage 取 token，构造请求头 */
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
  box-sizing: border-box;
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

/* 评论列表 */
.comment-list {
  max-height: 500px;
  overflow-y: auto;
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
