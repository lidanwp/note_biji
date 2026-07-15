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
  </div>
</template>

<script setup>
import { useHistoryStore } from '@/stores/history'
import { useRouter } from 'vue-router'

// ===== 定义事件 =====
const emit = defineEmits(['close'])

// ===== Store =====
const historyStore = useHistoryStore()
const router = useRouter()

// ===== 方法 =====
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

const goToNote = (item) => {
  // 跳转到笔记详情页，并传递笔记数据
  // 方式一：通过路由 query 传递 id，在 ViewerPanel 中根据 id 查找
  router.push({ path: '/viewer', query: { noteId: item.id, from: 'history' } })
  
  // 方式二：如果 ViewerPanel 支持通过 id 加载，也可以用这种方式
  // 关闭面板
  emit('close')
}

const removeItem = (noteId) => {
  historyStore.removeHistory(noteId)
}

const clearAll = () => {
  if (confirm('确定要清空所有阅读历史吗？')) {
    historyStore.clearHistory()
  }
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
  color: var(--text-muted, #999);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.btn-clear:hover {
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.08);
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
  background: #d0d0d0;
  border-radius: 4px;
}

.history-list::-webkit-scrollbar-thumb:hover {
  background: #b0b0b0;
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

/* ===== 暗色主题适配 ===== */
@media (prefers-color-scheme: dark) {
  .history-panel {
    background: #1a1a2e;
    border-color: #2a2a42;
  }

  .history-item:hover {
    background: #2a2a42;
  }

  .item-category {
    background: #2a2a42;
    color: #888;
  }

  .group-date {
    border-bottom-color: #2a2a42;
  }

  .history-list::-webkit-scrollbar-thumb {
    background: #444;
  }

  .history-list::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
}
</style>