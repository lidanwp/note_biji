<template>
  <div class="history-panel">
    <div class="history-header">
      <h4>📜 阅读历史</h4>
      <div class="header-actions">
        <button
          v-if="historyStore.history.length > 0"
          @click="clearAll"
          class="btn-clear"
        >
          清空全部
        </button>
        <button @click="emit('close')" class="btn-close">✕</button>
      </div>
    </div>

    <div v-if="historyStore.history.length === 0" class="empty-history">
      <span>📭</span>
      <p>还没有阅读记录，快去浏览笔记吧！</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="(items, date) in historyStore.groupByDate"
        :key="date"
        class="history-group"
      >
        <div class="group-date">{{ date }}</div>
        <div
          v-for="item in items"
          :key="item.id"
          class="history-item"
          @click="goToNote(item)"
        >
          <div class="item-info">
            <span class="item-title">{{ item.title }}</span>
            <span class="item-category">{{ item.category || '未分类' }}</span>
          </div>
          <div class="item-actions">
            <span class="item-time">{{ formatTime(item.visitedAt) }}</span>
            <button @click.stop="removeItem(item.id)" class="btn-remove" title="移除">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义确认弹窗：teleport 到 body，带模糊遮罩 -->
    <teleport to="body" v-if="confirmState.visible">
      <div class="confirm-overlay" @click.self="closeConfirm">
        <div class="confirm-dialog" role="dialog" aria-modal="true">
          <div class="confirm-title">{{ confirmState.title }}</div>
          <div class="confirm-message">{{ confirmState.message }}</div>
          <div class="confirm-actions">
            <button class="confirm-cancel" @click="closeConfirm">取消</button>
            <button class="confirm-ok" @click="confirmAction">确认</button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { useRouter } from 'vue-router'

// ===== 定义事件 =====
const emit = defineEmits(['close'])

// ===== Store =====
const historyStore = useHistoryStore()
const router = useRouter()

// ===== 自定义确认弹窗状态 =====
const confirmState = ref({
  visible: false,
  title: '确认操作',
  message: '',
  action: null
})

const openConfirm = (title, message, action) => {
  confirmState.value = {
    visible: true,
    title,
    message,
    action
  }
}

const closeConfirm = () => {
  confirmState.value = {
    visible: false,
    title: '确认操作',
    message: '',
    action: null
  }
}

const confirmAction = () => {
  const action = confirmState.value.action
  closeConfirm()
  if (typeof action === 'function') {
    action()
  }
}

// ===== 方法 =====
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const goToNote = (item) => {
  // 跳转到笔记详情页，并传递笔记数据
  router.push({ path: '/viewer', query: { noteId: item.id, from: 'history' } })
  emit('close')
}

const removeItem = (noteId) => {
  openConfirm('移除记录', '确定要移除这条阅读历史吗？', () => {
    historyStore.removeHistory(noteId)
  })
}

const clearAll = () => {
  openConfirm('清空历史', '确定要清空所有阅读历史吗？', () => {
    historyStore.clearHistory()
  })
}
</script>

<style scoped>
.history-panel {
  padding: 16px 20px;
  background: var(--bg-secondary, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-color, #e8ecf1);
  animation: slideDown 0.3s ease;
}

/* ===== 动画 ===== */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ===== 头部 ===== */
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.history-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-clear {
  font-size: 12px;
  line-height: 1;
  color: #d14a34;
  background: transparent;
  border: 1px solid rgba(209, 74, 52, 0.12);
  cursor: pointer;
  padding: 5px 9px;
  border-radius: 999px;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  font-weight: 500;
}

.btn-clear:hover {
  color: #b73c2d;
  background: rgba(209, 74, 52, 0.04);
  border-color: rgba(209, 74, 52, 0.2);
}

.btn-close {
  font-size: 16px;
  color: var(--text-muted, #999);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--text-primary, #333);
}

/* ===== 空状态 ===== */
.empty-history {
  text-align: center;
  padding: 30px 0 20px;
  color: var(--text-muted, #999);
}

.empty-history span {
  font-size: 36px;
  display: block;
  margin-bottom: 10px;
}

.empty-history p {
  margin: 0;
  font-size: 14px;
}

/* ===== 历史列表 ===== */
.history-list {
  max-height: 380px;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

/* 自定义滚动条 */
.history-list::-webkit-scrollbar {
  width: 4px;
}

.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-list::-webkit-scrollbar-thumb {
  background: var(--text-light, #d0d0d0);
  border-radius: 4px;
}

.history-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted, #b0b0b0);
}

/* ===== 分组 ===== */
.history-group {
  margin-bottom: 12px;
}

.history-group:last-child {
  margin-bottom: 0;
}

.group-date {
  font-size: 12px;
  color: var(--text-muted, #bbb);
  padding: 6px 0 4px 4px;
  border-bottom: 1px solid var(--border-light, #f5f5f5);
  margin-bottom: 4px;
  font-weight: 500;
}

/* ===== 历史项 ===== */
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.history-item:hover {
  background: var(--bg-hover, #f5f7fa);
}

.history-item:active {
  transform: scale(0.98);
}

.item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.item-title {
  font-size: 14px;
  color: var(--text-primary, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.item-category {
  font-size: 11px;
  color: var(--text-muted, #999);
  background: var(--bg-hover, #f0f0f0);
  padding: 1px 10px;
  border-radius: 10px;
  flex-shrink: 0;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.item-time {
  font-size: 12px;
  color: var(--text-light, #ccc);
}

.btn-remove {
  background: none;
  border: none;
  color: var(--text-light, #ccc);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  transition: color 0.2s;
  line-height: 1;
}

.btn-remove:hover {
  color: #e74c3c;
}

/* ===== 自定义确认弹窗 ===== */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.confirm-dialog {
  width: min(92vw, 420px);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 22px;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.18);
  padding: 22px 20px 18px;
  animation: dialogIn 0.18s ease-out;
}

@keyframes dialogIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 10px;
  text-align: center;
}

.confirm-message {
  font-size: 14px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 22px;
  text-align: center;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.confirm-cancel {
  flex: 1;
  padding: 11px 16px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.05s;
}

.confirm-cancel:hover {
  background: #f1f5f9;
}

.confirm-cancel:active {
  transform: scale(0.97);
}

.confirm-ok {
  flex: 1;
  padding: 11px 16px;
  border-radius: 14px;
  border: none;
  background: #d14a34;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.05s;
}

.confirm-ok:hover {
  background: #b73c2d;
}

.confirm-ok:active {
  transform: scale(0.97);
}

/* ===== 暗色主题适配 ===== */
[data-theme="dark"] .history-panel {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

[data-theme="dark"] .history-item:hover {
  background: var(--bg-hover);
}

[data-theme="dark"] .item-category {
  background: var(--bg-hover);
  color: var(--text-muted);
}

[data-theme="dark"] .group-date {
  border-bottom-color: var(--border-light);
}

[data-theme="dark"] .history-list::-webkit-scrollbar-thumb {
  background: var(--text-light);
}

[data-theme="dark"] .history-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
