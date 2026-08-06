<template>
  <div class="comment-item" :class="{ 'is-top': depth === 0 }">
    <div class="comment-row" :style="{ marginLeft: depth * 20 + 'px' }">
      <div class="comment-avatar">{{ comment.username?.charAt(0) || '👤' }}</div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author">{{ ctx.maskAuthor(comment.username) }}</span>
          <span class="comment-time">{{ ctx.formatTime(comment.created_at) }}</span>
          <span v-if="parentAuthor" class="reply-to">回复 @{{ ctx.maskAuthor(parentAuthor) }}</span>
          <button class="btn-reply" @click="ctx.onStartReply(comment)">回复</button>
          <button
            v-if="isOwner"
            class="btn-delete"
            @click="handleDelete"
          >
            删除
          </button>
        </div>

        <div class="comment-content" v-html="ctx.renderMarkdown(comment.content)"></div>

        <!-- 内联回复输入框 -->
        <div v-if="replyingTo === comment.id" class="reply-input-wrapper">
          <textarea
            v-model="replyContent"
            :placeholder="`回复 @${ctx.maskAuthor(comment.username)}...`"
            rows="2"
            @keydown.ctrl.enter="ctx.onSubmitReply(comment)"
          ></textarea>
          <div class="input-actions">
            <button @click="ctx.onCancelReply" class="btn-cancel">取消</button>
            <button
              @click="ctx.onSubmitReply(comment)"
              :disabled="!replyContent.trim()"
              class="btn-submit"
            >
              回复
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 递归渲染子评论 -->
    <div v-if="comment.children?.length" class="comment-children">
      <CommentItem
        v-for="child in comment.children"
        :key="child.id"
        :comment="child"
        :depth="depth + 1"
        :parent-author="comment.username"
        :current-user-id="currentUserId"
      />
    </div>
  </div>
</template>

<script setup>
import { inject, computed } from 'vue'

defineOptions({ name: 'CommentItem' })

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

const ctx = inject('commentContext')

const replyingTo = computed(() => ctx.replyingTo.value)
const replyContent = computed({
  get: () => ctx.replyContent.value,
  set: (val) => { ctx.replyContent.value = val }
})

// 当前用户 id 直接从 prop 读取（简单可靠，无响应式链问题）
const isOwner = computed(() => {
  const uid = props.currentUserId
  if (!uid) return false
  if (!props.comment?.user_id) return false
  return String(props.comment.user_id) === String(uid)
})

const handleDelete = () => {
  ctx.onDelete(props.comment.id)
}
</script>

<style scoped>
.comment-item {
  padding: 12px 0;
}

.comment-item.is-top {
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.comment-item.is-top:last-child {
  border-bottom: none;
}

.comment-row {
  display: flex;
  gap: 12px;
  transition: margin-left 0.2s ease;
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
  word-break: break-word;
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
  box-sizing: border-box;
}

.reply-input-wrapper .input-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 4px 10px 8px;
  border-top: 1px solid var(--border-light, #f0f0f0);
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

.comment-children {
  /* 子评论容器无额外样式，缩进由子项的 marginLeft 控制 */
}
</style>
