<template>
  <div class="note-list">
    <!-- ===== 顶部 Header ===== -->
    <header class="header">
      <div class="header-row">
        <h1 class="app-title">知识分享</h1>
        <div class="user-area" ref="userMenuRef">
          <button class="user-btn" @click="showUserMenu = !showUserMenu">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15.5" fill="#E2E8F0"/>
              <circle cx="16" cy="13" r="5" fill="#94A3B8"/>
              <path d="M7 26c0-4.97 4.03-9 9-9s9 4.03 9 9" fill="#94A3B8"/>
            </svg>
          </button>
          <div v-if="showUserMenu" class="user-dropdown">
            <button class="dropdown-item">修改密码</button>
            <button class="dropdown-item danger">退出登录</button>
          </div>
        </div>
      </div>
      <div class="stats-row">
        <span class="stat-item">{{ mockData.length }} 笔记</span>
        <span class="stat-sep">·</span>
        <span class="stat-item">{{ totalViews }} 浏览</span>
        <span class="stat-sep">·</span>
        <span class="stat-item">{{ formatNum(totalChars) }} 字数</span>
      </div>
    </header>

    <!-- ===== 吸顶 Toolbar ===== -->
    <div class="toolbar" :class="{ 'is-stuck': isStuck }">
      <div class="search-box">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索笔记..."
        />
      </div>
      <div class="filter-bar">
        <div class="filter-left">
          <button class="filter-chip" @click="toggleProcessGroup">
            📂 过程组
            <span class="chev">▼</span>
          </button>
          <button class="filter-chip" @click="toggleKnowledge">
            📚 全部
            <span class="chev">▼</span>
          </button>
        </div>
        <div class="filter-right">
          <span class="exam-label">考试</span>
          <button class="toggle-switch" :class="{ on: examMode }" @click="examMode = !examMode">
            <span class="toggle-thumb"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 笔记列表 ===== -->
    <main class="list-area">
      <div
        v-for="(note, idx) in filteredNotes"
        :key="note.id"
        class="note-item"
        :class="{ last: idx === filteredNotes.length - 1 }"
        @click="openDetail(note)"
      >
        <div class="item-top">
          <h3 class="item-title">{{ note.title }}</h3>
          <div class="item-meta">
            <span class="item-date">{{ note.date }}</span>
            <span class="item-link">查看全文 →</span>
          </div>
        </div>
        <p class="item-summary">{{ cleanSummary(note.summary) }}</p>
        <div class="item-bottom">
          <span class="item-tag">{{ note.tag }}</span>
        </div>
      </div>

      <div v-if="filteredNotes.length === 0" class="empty-state">
        <p>暂无匹配的笔记</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const showUserMenu = ref(false)
const searchQuery = ref('')
const examMode = ref(false)
const isStuck = ref(false)

const mockData = ref([
  {
    id: 1,
    title: '项目整合管理：制定项目章程',
    summary: '项目整合管理是十大知识领域之首，涉及识别、定义、组合、统一和协调项目管理过程组中的各种过程和活动。制定项目章程是启动过程组的核心过程，旨在正式授权项目并赋予项目经理动用组织资源的权力。',
    tag: '项目管理 / 启动阶段',
    date: '2025-07-28',
    views: 156,
    chars: 18472
  },
  {
    id: 2,
    title: 'WBS分解结构：范围基准的核心',
    summary: '工作分解结构（WBS）是将项目可交付成果和项目工作分解成更小、更易于管理的组件的过程。WBS的编制遵循100%原则，所有工作必须在WBS中体现，包括项目管理本身。',
    tag: '范围管理 / 规划阶段',
    date: '2025-07-25',
    views: 203,
    chars: 12300
  },
  {
    id: 3,
    title: '挣值管理(EVM)：项目绩效的量化分析',
    summary: '挣值管理是一种将范围、进度和成本整合起来的项目绩效测量方法。通过计划价值PV、挣值EV和实际成本AC三个基本参数，可以计算进度偏差SV、成本偏差CV以及对应的绩效指数SPI和CPI。',
    tag: '成本管理 / 监控阶段',
    date: '2025-07-22',
    views: 312,
    chars: 9800
  },
  {
    id: 4,
    title: '关键路径法(CPM)与进度压缩技术',
    summary: '关键路径法是在进度模型中估算项目最短工期的技术。关键路径是网络图中最长的活动序列，决定了项目的最短完成时间。进度压缩技术包括赶工和快速跟进两种方式。',
    tag: '进度管理 / 规划阶段',
    date: '2025-07-20',
    views: 189,
    chars: 7600
  },
  {
    id: 5,
    title: '风险登记册与概率影响矩阵',
    summary: '风险管理的核心产出物是风险登记册，记录所有识别的风险及其分析结果。概率影响矩阵通过将风险发生的概率与对项目目标的影响程度相结合，帮助团队确定风险应对的优先级。',
    tag: '风险管理 / 规划阶段',
    date: '2025-07-18',
    views: 142,
    chars: 6200
  }
])

const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return mockData.value
  return mockData.value.filter(n =>
    n.title.toLowerCase().includes(q) ||
    n.summary.toLowerCase().includes(q) ||
    n.tag.toLowerCase().includes(q)
  )
})

const totalViews = computed(() =>
  mockData.value.reduce((s, n) => s + n.views, 0)
)

const totalChars = computed(() =>
  mockData.value.reduce((s, n) => s + n.chars, 0)
)

function formatNum(n) {
  if (n < 1000) return String(n)
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'W'
}

function cleanSummary(text) {
  if (!text) return ''
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!*\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~>|`-]{1,6}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function openDetail(note) {
  console.log('open detail:', note)
}

function toggleProcessGroup() {
  console.log('toggle process group')
}

function toggleKnowledge() {
  console.log('toggle knowledge area')
}

function handleScroll() {
  isStuck.value = window.scrollY > 80
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
/* ===== 基础布局 ===== */
.note-list {
  max-width: 640px;
  margin: 0 auto;
  padding: 0 16px;
  padding-bottom: 40px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background: #F8FAFC;
  min-height: 100vh;
}

/* ===== Header ===== */
.header {
  padding-top: 24px;
  padding-bottom: 12px;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-title {
  font-size: 22px;
  font-weight: 700;
  color: #1E293B;
  margin: 0;
  letter-spacing: -0.01em;
}

.user-area {
  position: relative;
}

.user-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.user-btn svg {
  display: block;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  min-width: 140px;
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  text-align: left;
  background: none;
  border: none;
  font-size: 14px;
  color: #1E293B;
  cursor: pointer;
}

.dropdown-item:hover {
  background: #F1F5F9;
}

.dropdown-item.danger {
  color: #EF4444;
}

.stats-row {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #94A3B8;
}

.stat-item {
  font-weight: 400;
}

.stat-sep {
  color: #CBD5E1;
}

/* ===== Toolbar (sticky) ===== */
.toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #F8FAFC;
  padding: 12px 0;
  transition: box-shadow 0.2s ease;
}

.toolbar.is-stuck {
  box-shadow: 0 1px 0 #E2E8F0;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  height: 40px;
  border: 1px solid #E2E8F0;
  border-radius: 999px;
  background: #fff;
  padding: 0 14px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.search-box:focus-within {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-icon {
  flex-shrink: 0;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: none;
  font-size: 15px;
  color: #1E293B;
  font-family: inherit;
}

.search-input::placeholder {
  color: #94A3B8;
}

.filter-bar {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-left {
  display: flex;
  gap: 8px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  background: #F1F5F9;
  border: none;
  border-radius: 999px;
  font-size: 13px;
  color: #1E293B;
  cursor: pointer;
  transition: background 0.15s ease;
  font-family: inherit;
}

.filter-chip:hover {
  background: #E2E8F0;
}

.filter-chip .chev {
  font-size: 9px;
  color: #94A3B8;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.exam-label {
  font-size: 13px;
  color: #94A3B8;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: #E2E8F0;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.2s ease;
}

.toggle-switch.on {
  background: #3B82F6;
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s ease;
}

.toggle-switch.on .toggle-thumb {
  transform: translateX(16px);
}

/* ===== 笔记列表 ===== */
.list-area {
  margin-top: 8px;
}

.note-item {
  padding: 16px 16px 16px 12px;
  border-bottom: 1px solid #E2E8F0;
  border-left: 4px solid #E2E8F0;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  margin-left: -12px;
}

.note-item:last-child {
  border-bottom: none;
}

.note-item:hover {
  background: rgba(59, 130, 246, 0.03);
  border-left-color: #3B82F6;
}

.item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.item-title {
  font-size: 17px;
  font-weight: 600;
  color: #1E293B;
  margin: 0;
  line-height: 1.4;
  flex: 1;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.item-date {
  font-size: 13px;
  color: #94A3B8;
}

.item-link {
  font-size: 13px;
  color: #3B82F6;
  white-space: nowrap;
}

.item-summary {
  margin: 8px 0 0;
  font-size: 14px;
  color: #64748B;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-bottom {
  margin-top: 8px;
}

.item-tag {
  display: inline-block;
  font-size: 12px;
  color: #94A3B8;
  background: #F1F5F9;
  padding: 3px 10px;
  border-radius: 6px;
}

/* ===== 空状态 ===== */
.empty-state {
  padding: 60px 0;
  text-align: center;
  color: #94A3B8;
  font-size: 14px;
}

/* ===== 手机适配 ===== */
@media (max-width: 480px) {
  .note-list {
    padding: 0 14px;
  }

  .app-title {
    font-size: 20px;
  }

  .item-title {
    font-size: 16px;
  }

  .item-summary {
    font-size: 13px;
  }

  .filter-bar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .filter-right {
    margin-left: auto;
  }
}
</style>
