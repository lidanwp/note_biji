<template>
  <div class="comment-item" :class="{ 'is-top': depth === 0 }">
    <div class="comment-row" :style="{ marginLeft: depth * 20 + 'px' }">
      <!-- ===== 🎯 头像：本地 SVG ===== -->
      <img 
        :src="avatarUrl" 
        class="avatar-icon" 
        alt="头像"
      />

      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author">{{ displayName }}</span>
          <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
          <button class="btn-reply" @click="handleReply">回复</button>
          <button
            v-if="isOwner"
            class="btn-delete"
            @click="handleDelete($event)"
          >
            删除
          </button>
        </div>

        <div class="comment-content" v-html="renderContent(comment.content)"></div>

        <!-- 内联回复输入框 -->
        <div v-if="localReplying" class="reply-input-wrapper">
          <textarea
            ref="replyTextareaRef"
            v-model="localReplyContent"
            :placeholder="replyPlaceholder"
            rows="2"
            @keydown.ctrl.enter="submitReply"
          ></textarea>
          <div class="input-actions">
            <div class="input-actions-left">
              <MemePicker :textarea-ref="replyTextareaRef" @insert="onReplyMemeInsert" />
              <button @click="cancelReply" class="btn-cancel">取消</button>
            </div>
            <button
              @click="submitReply"
              :disabled="!localReplyContent.trim()"
              class="btn-submit"
            >
              回复
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 递归渲染子评论 ===== -->
    <div v-if="comment.children && comment.children.length" class="comment-children">
      <CommentItem
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :depth="depth + 1"
        :parent-author="comment.username"
        :current-user-id="currentUserId"
        @reply="handleReplyFromChild"
        @delete="handleDeleteFromChild"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import MemePicker, { renderMeme } from './MemePicker.vue'

// ===== Props =====
const props = defineProps({
  comment: {
    type: Object,
    required: true
  },
  depth: {
    type: Number,
    default: 0
  },
  parentAuthor: {
    type: String,
    default: ''
  },
  currentUserId: {
    type: String,
    default: ''
  }
})

// ===== Emits =====
const emit = defineEmits(['reply', 'delete'])

// ===== 本地回复状态 =====
const localReplying = ref(false)
const localReplyContent = ref('')
const replyTextareaRef = ref(null)

// ============ 🎯 头像分配逻辑 ============
const avatarFiles = [
  '圣诞雪人.svg',
  '魔鬼.svg',
  '神秘.svg',
  '酷.svg',
  '圣诞麋鹿.svg',
  '唱歌.svg',
  '猫咪.svg',
  '猴子.svg',
  '考拉.svg',
  '老鼠.svg',
  '卡通鱼.svg',
  '青蛙.svg',
  '螃蟹.svg',
  '太阳.svg',
  '苹果.svg',
  '动物园.svg',
  '卡通人像.svg',
  '动物.svg',
  '动物1.svg',
  '红猴子.svg'
]

function getAvatarIndex(email) {
  if (!email) return 0
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % avatarFiles.length
}

const avatarUrl = computed(function() {
  const index = getAvatarIndex(props.comment.user_id)
  return '/' + avatarFiles[index]
})

// ===== 计算属性 =====
const displayName = computed(function() {
  return maskAuthor(props.comment.username)
})

const parentAuthorDisplay = computed(function() {
  return maskAuthor(props.parentAuthor)
})

const replyPlaceholder = computed(function() {
  return '回复 @' + maskAuthor(props.comment.username) + '...'
})

// ===== 工具函数 =====
function maskAuthor(username) {
  if (!username) return '匿名用户'
  if (username.length < 3) return username
  var maskLen = Math.min(4, username.length - 2)
  return username.slice(0, 2) + '*'.repeat(maskLen) + username.slice(2 + maskLen)
}

function formatTime(isoString) {
  if (!isoString) return '刚刚'
  var date = new Date(isoString)
  var now = new Date()
  var diff = Math.floor((now - date) / 1000)

  if (diff < 60) return '刚刚'
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前'
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前'
  if (diff < 604800) return Math.floor(diff / 86400) + '天前'
  return date.toLocaleDateString('zh-CN')
}

// ===== 表情包渲染 =====
function renderContent(content) {
  if (!content) return ''
  return renderMeme(content)
}

// ===== 权限判断 =====
var isOwner = computed(function() {
  var uid = props.currentUserId
  if (!uid) return false
  if (!props.comment || !props.comment.user_id) return false
  return String(props.comment.user_id) === String(uid)
})

// ===== 回复逻辑 =====
function handleReply() {
  localReplying.value = true
  localReplyContent.value = ''
  nextTick(function() {
    if (replyTextareaRef.value) {
      replyTextareaRef.value.focus()
    }
  })
}

function handleReplyFromChild(data) {
  emit('reply', data)
}

function handleDeleteFromChild(data) {
  emit('delete', data)
}

function cancelReply() {
  localReplying.value = false
  localReplyContent.value = ''
}

function submitReply() {
  var content = localReplyContent.value.trim()
  if (!content) return
  emit('reply', {
    parentId: props.comment.id,
    content: content
  })
  localReplying.value = false
  localReplyContent.value = ''
}

function onReplyMemeInsert(_ref) {
  var placeholder = _ref.placeholder
  var start = _ref.start
  var end = _ref.end
  var text = localReplyContent.value
  if (start < 0) {
    localReplyContent.value = text + placeholder
  } else {
    localReplyContent.value = text.slice(0, start) + placeholder + text.slice(end)
  }
}

function handleDelete(event) {
  var rect = null
  try {
    var el = event.currentTarget || event.target
    rect = el.getBoundingClientRect()
  } catch (_) {
    rect = null
  }
  emit('delete', { commentId: props.comment.id, rect })
}
</script>

<style scoped>
.comment-item {
  padding: 8px 0;
}
.comment-item.is-top {
  border-bottom: 1px solid #f0f0f0;
}
.comment-item.is-top:last-child {
  border-bottom: none;
}
.comment-row {
  display: flex;
  gap: 12px;
}

/* ===== 🎯 头像样式 ===== */
.avatar-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  margin-top: 2px;
  display: block;
}

.comment-body {
  flex: 1;
  min-width: 0;
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
  color: #333;
}
.comment-time {
  font-size: 12px;
  color: #bbb;
}
.reply-to {
  font-size: 12px;
  color: #667eea;
  background: #f0f2ff;
  padding: 0 8px;
  border-radius: 4px;
}
.btn-reply {
  font-size: 12px;
  color: #667eea;
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
  color: #e74c3c;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.btn-delete:hover {
  text-decoration: underline;
}

/* ===== 评论内容 + 表情包 ===== */
.comment-content {
  font-size: 14px;
  color: #444;
  line-height: 1.7;
  word-break: break-word;
}

.comment-content :deep(.meme-emoji) {
  display: inline-block;
  width: 60px;
  height: 60px;
  vertical-align: middle;
  border-radius: 6px;
  margin: 0 2px;
  object-fit: cover;
}

/* ===== 回复输入框 ===== */
.reply-input-wrapper {
  margin-top: 8px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8ecf1;
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
  color: #333;
  box-sizing: border-box;
}
.reply-input-wrapper .input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 8px;
  border-top: 1px solid #f0f0f0;
}
.reply-input-wrapper .input-actions-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
</style>