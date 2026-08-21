<template>
  <div class="viewer-panel" :class="{ 'detail-open': !!selectedNote }">
    <!-- ===== 头部 ===== -->
    <header>
      <div class="header-left">
        <span class="app-logo">
          <img src="/书本.svg" alt="书本" />
        </span>
        <span class="app-name">知识分享</span>
      </div>
      <!-- ===== 无缝滚动公告条 ===== -->
      <div class="header-ticker" ref="tickerRef">
        <div class="ticker-track" ref="tickerTrackRef">
          <span class="ticker-content">🤝 非盈利 · 纯干货 | 抱团取暖，共享笔记，互帮互助 | <span class="ticker-highlight">2026 软考集成，我们一起拿下！</span></span>
          <span class="ticker-content" aria-hidden="true">🤝 非盈利 · 纯干货 | 抱团取暖，共享笔记，互帮互助 | <span class="ticker-highlight">2026 软考集成，我们一起拿下！</span></span>
        </div>
      </div>
      <div class="header-right" ref="userMenuRef">
        <button @click="toggleUserMenu" class="user-btn" ref="userBtnRef">
          <span class="user-avatar">
            <img src="/退出.svg" alt="退出" />
          </span>
          <span class="user-name">{{ authStore.user?.username }}</span>
          <span class="menu-arrow">{{ showUserMenu ? '▲' : '▼' }}</span>
        </button>
        <Teleport to="body">
          <Transition name="menu-fade">
            <div v-if="showUserMenu" class="dropdown-menu" :style="userMenuStyle" ref="dropdownMenuRef">
              <button @click="openChangePassword" class="dropdown-item">
                <span class="item-icon">🔐</span>
                <span>修改密码</span>
              </button>
              <button @click="logout" class="dropdown-item danger">
                <span class="item-icon">🚪</span>
                <span>退出登录</span>
              </button>
            </div>
          </Transition>
        </Teleport>
      </div>
    </header>

    <!-- ===== 统计徽章 ===== -->
    <div class="stats-bar">
      <span class="stat-mini">
        <span class="stat-val">{{ notesStore.notes.length }}</span>
        <span class="stat-label">笔记</span>
      </span>
      <span class="stat-dot">·</span>
      <span class="stat-mini">
        <span class="stat-val">{{ totalViews }}</span>
        <span class="stat-label">浏览</span>
      </span>
      <span class="stat-dot">·</span>
      <span class="stat-mini">
        <span class="stat-val">{{ formatNum(totalCharacters) }}</span>
        <span class="stat-label">字数</span>
      </span>
      <span class="stat-spacer"></span>
       <button 
        @click="showHistoryPanel = !showHistoryPanel" 
        class="stat-icon-btn"
        :class="{ active: showHistoryPanel }"
      >
        <span>📜</span>
        <span>{{ historyStore.history.length }}</span>
      </button>
       <button 
        @click="showSettings = !showSettings" 
        class="stat-icon-btn"
        :class="{ active: showSettings }"
      >
        <span>⚙️</span>
      </button>
    </div>
    <!-- 设置面板 -->
    <SettingsPanel 
      v-if="showSettings" 
      @close="showSettings = false" 
    />
    <!-- 👇 历史记录面板 -->
    <HistoryPanel 
      v-if="showHistoryPanel" 
      @close="showHistoryPanel = false" 
      class="history-section"
    />
    <!-- ===== 搜索 + 筛选行 ===== -->
    <div class="filter-wrap">
      <div class="search-field">
        <input
          type="text"
          v-model="notesStore.search"
          placeholder="🔍 搜索标题、内容、标签..."
          class="search-input"
        />
      </div>
      <div class="filter-row">
        <CustomSelect v-model="notesStore.knowledgeAreaFilter" :options="knowledgeAreaOptions" placeholder="📚 全部知识领域" class="filter-cs" :class="{ 'is-active': notesStore.knowledgeAreaFilter }" />
        <div class="exam-toggle">
          <label class="switch">
            <input type="checkbox" v-model="examMode" />
            <span class="slider"></span>
          </label>
          <span class="toggle-label">🎯 考试</span>
        </div>
      </div>
    </div>

    <!-- ===== 考点看板（考试模式下显示） ===== -->
    <div v-if="examMode" class="exam-dashboard">
      <div class="dashboard-card">
        <h4>🔥 高频考点 TOP5</h4>
        <ul>
          <li v-for="topic in hotTopics" :key="topic.name">
            <span class="topic-name">{{ topic.name }}</span>
            <span class="topic-count">{{ topic.count }}次</span>
          </li>
        </ul>
      </div>
      <div class="dashboard-card">
        <h4>📊 学习掌握度</h4>
        <div v-for="(count, group) in learningMasteryStats" :key="group" class="progress-bar">
          <span>{{ group }}</span>
          <div class="bar"><div :style="{ width: count + '%' }"></div></div>
          <span class="bar-label">{{ count }}%</span>
        </div>
      </div>
    </div>

    <!-- ===== 笔记列表 ===== -->
    <div class="note-grid" v-if="!isLoading">
      <div
        v-for="note in paginatedNotes"
        :key="note.id"
        class="note-card"
        @click="viewDetail(note)"
      >
        <h3 class="card-title">{{ note.title }}</h3>
        <!-- ===== 修复：卡片摘要显示 ===== -->
        <p class="card-summary">
          {{ getNoteSummary(note) }}
        </p>

        <!-- 底部：分类 + 日期 + 查看全文 -->
        <div class="card-footer">
          <div class="card-footer-left">
            <span class="cat-dot"></span>
            <span class="cat-name">{{ note.category || '未分类' }}</span>
          </div>
          <div class="card-footer-right">
            <span class="card-date">{{ note.date || '未知日期' }}</span>
            <span class="view-link">查看全文 <span class="arrow-icon">→</span></span>
          </div>
        </div>

        <!-- ===== 考试模式附加内容 ===== -->
        <div v-if="examMode && note.examMapping" class="card-exam-details">
          <div v-if="note.examMapping.relatedProcesses?.length" class="exam-process">
            <span class="process-label">📋 关联：</span>
            <span class="process-tag" v-for="p in note.examMapping.relatedProcesses" :key="p">
              {{ p }}
            </span>
          </div>
          <div v-if="note.examMapping.typicalQuestions?.length" class="exam-section">
            <span class="section-label">📝 典型考法：</span>
            <ul>
              <li v-for="q in note.examMapping.typicalQuestions" :key="q">{{ q }}</li>
            </ul>
          </div>
          <div v-if="note.examMapping.commonPitfalls?.length" class="exam-section pitfall">
            <span class="section-label">⚠️ 常见陷阱：</span>
            <ul>
              <li v-for="p in note.examMapping.commonPitfalls" :key="p">{{ p }}</li>
            </ul>
          </div>
          <div v-if="note.comparisonTable?.enabled" class="comparison-box">
            <h4>📊 {{ note.comparisonTable.title || '易混对比' }}</h4>
            <table>
              <thead>
                <tr>
                  <th>对比项</th>
                  <th v-for="col in note.comparisonTable.cols" :key="col">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in note.comparisonTable.rows" :key="row.label">
                  <td><strong>{{ row.label }}</strong></td>
                  <td v-for="col in note.comparisonTable.cols" :key="col">{{ row.values[col] || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="note.memoryAids?.length" class="memory-box">
            <div v-for="(item, index) in note.memoryAids" :key="index" class="memory-item">
              {{ item }}
            </div>
          </div>
          <div v-if="getUserExamScore(note) != null" class="mastery-bar">
            <span>掌握度</span>
            <div class="bar"><div :style="{ width: getUserExamScore(note) + '%' }"></div></div>
            <span class="score">{{ getUserExamScore(note) }}%</span>
          </div>
        </div>
      </div>

      <div v-if="paginatedNotes.length === 0 && !isLoading" class="empty">
        <div class="empty-icon">📭</div>
        <p>暂无匹配的笔记</p>
        <span class="empty-hint">试试调整筛选条件</span>
      </div>
    </div>

    <!-- ===== 骨架屏加载占位 ===== -->
    <div class="skeleton-grid" v-if="isLoading">
      <div class="skeleton-card" v-for="n in 4" :key="n">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-short"></div>
        <div class="skeleton-footer">
          <div class="skeleton-line skeleton-mini"></div>
          <div class="skeleton-line skeleton-mini"></div>
        </div>
      </div>
    </div>
    
    <Pagination
      v-model:currentPage="notesStore.currentPage"
      v-model:pageSize="notesStore.pageSize"
      :total="totalNotes"
      v-show="!isLoading"
    />

    <!-- ===== 右侧滚动进度光带 ===== -->
    <div class="scroll-rail" v-show="!selectedNote">
      <span class="scroll-knob" ref="scrollKnob"></span>
    </div>

    <!-- ===== 返回按钮 ===== -->
    <Teleport to="body">
      <button 
        v-if="selectedNote" 
        class="modal-back" 
        @click="closeDetail(true)"
      >
        <svg viewBox="0 0 1024 1024" class="back-icon" aria-label="返回" xmlns="http://www.w3.org/2000/svg">
          <path d="M477.867 307.2V186.027c-10.24-51.2-52.907-20.48-52.907-20.48L139.947 414.72c-63.147 44.373-5.12 76.8-5.12 76.8l281.6 245.76c56.32 40.96 61.44-22.187 61.44-22.187V604.16C764.587 512 880.64 872.107 880.64 872.107c10.24 20.48 17.067 0 17.067 0C1008.64 332.8 477.867 307.2 477.867 307.2z" fill="#cdcdcd"/>
        </svg>
      </button>
    </Teleport>

    <!-- ===== 笔记详情弹窗 ===== -->
    <div v-if="selectedNote" class="modal-overlay" @click="closeDetail">
      <div 
        class="modal-detail" 
        @click.stop
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @touchcancel="handleTouchEnd"
        :style="{
          transform: `translateX(${slideX}px)`,
          opacity: panelOpacity,
          transition: isSliding ? 'none' : 'transform 0.42s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.42s cubic-bezier(0.32, 0.72, 0, 1)'
        }"
      >
        <template v-if="selectedNote">
          <div class="detail-header">
            <div class="detail-meta-row">
              <span class="detail-category">{{ selectedNote.category }}</span>
              <span class="detail-time">
                📅 {{ selectedNote.date }}<template v-if="selectedNote.viewCount"> · 👁️ {{ selectedNote.viewCount }}次</template>
              </span>
            </div>
            <h2 class="detail-title">{{ selectedNote.title }}</h2>
          </div>
          
          <div v-if="selectedNote.keyPoints?.length" class="detail-keypoints">
            <h4>💡 核心要点</h4>
            <ul>
              <li v-for="(point, idx) in selectedNote.keyPoints" :key="idx">{{ point }}</li>
            </ul>
          </div>
          
          <div v-if="selectedNote.scenario" class="detail-scenario">
            <h4>📌 适用场景</h4>
            <p>{{ selectedNote.scenario }}</p>
          </div>
          
          <div class="detail-content markdown-body" v-html="renderMarkdown(selectedNote.content, selectedNote.scenario)"></div>
          
          <div v-if="selectedNote.caseStudy" class="detail-case">
            <h4>💡 实战案例</h4>
            <div class="case-content markdown-body" v-html="renderMarkdown(selectedNote.caseStudy)"></div>
          </div>
          
          <div v-if="examMode && selectedNote.examMapping" class="detail-exam">
            <h4>🎯 考点专项</h4>
            <div v-if="selectedNote.examMapping.relatedProcesses?.length" class="detail-exam-item">
              <span class="exam-label">📋 关联过程组：</span>
              <span class="process-tag" v-for="p in selectedNote.examMapping.relatedProcesses" :key="p">{{ p }}</span>
            </div>
            <div v-if="selectedNote.examMapping.typicalQuestions?.length" class="detail-exam-item">
              <span class="exam-label">📝 典型考法：</span>
              <ul>
                <li v-for="q in selectedNote.examMapping.typicalQuestions" :key="q">{{ q }}</li>
              </ul>
            </div>
            <div v-if="selectedNote.examMapping.commonPitfalls?.length" class="detail-exam-item pitfall">
              <span class="exam-label">⚠️ 常见陷阱：</span>
              <ul>
                <li v-for="p in selectedNote.examMapping.commonPitfalls" :key="p">{{ p }}</li>
              </ul>
            </div>
            <div v-if="selectedNote.comparisonTable?.enabled" class="comparison-box">
              <h5>📊 {{ selectedNote.comparisonTable.title || '易混对比' }}</h5>
              <table>
                <thead>
                  <tr>
                    <th>对比项</th>
                    <th v-for="col in selectedNote.comparisonTable.cols" :key="col">{{ col }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in selectedNote.comparisonTable.rows" :key="row.label">
                    <td><strong>{{ row.label }}</strong></td>
                    <td v-for="col in selectedNote.comparisonTable.cols" :key="col">{{ row.values[col] || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="selectedNote.memoryAids?.length" class="memory-box">
              <div v-for="(item, index) in selectedNote.memoryAids" :key="index" class="memory-item">{{ item }}</div>
            </div>
          </div>
          
          <div v-if="selectedNote.attachments?.length" class="detail-attachments">
            <h4>🎵 录音文件</h4>
            <div class="audio-list">
              <AudioPlayer
                v-for="(file, idx) in selectedNote.attachments"
                :key="idx"
                :src="file.url"
                :name="file.name"
              />
            </div>
          </div>
          
          <div v-if="selectedNote.tags?.length" class="detail-tags">
            <span v-for="tag in selectedNote.tags" :key="tag" :class="['tag', tagColorClass(tag)]">#{{ tag }}</span>
          </div>
          
          <div
            v-if="selectedNote && (selectedNote.examScore != null || authStore.user)"
            class="detail-progress"
          >
            <div class="progress-header">
              <span class="progress-label">掌握度</span>
              <span class="progress-number">{{ getUserExamScore(selectedNote) }}%</span>
            </div>
            <div class="progress-meter">
              <div class="progress-track">
                <div class="progress-fill" :style="{ width: getUserExamScore(selectedNote) + '%' }"></div>
              </div>
            </div>
            <div class="detail-score-slider">
              <input type="range" min="0" max="100" :value="getUserExamScore(selectedNote)" @input="handleExamScoreInput" />
            </div>
          </div>
          
          <div class="detail-actions">
            <button @click="markUseful(selectedNote)" class="btn-useful">
              👍 有用 ({{ selectedNote.usefulCount || 0 }})
            </button>
          </div>
          
          <CommentSection :noteId="selectedNote ? String(selectedNote.id) : ''" />
        </template>
      </div>
    </div>
    
    <ChangePasswordModal 
      v-model:visible="showChangePassword" 
      :user-id="authStore.user?.id" 
      @success="handlePasswordChangeSuccess" 
    />
  </div>
</template>

<script setup>
import SettingsPanel from '@/components/SettingsPanel.vue'
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotesStore } from '../stores/notes'
import MarkdownIt from 'markdown-it'
import CustomSelect from '../components/CustomSelect.vue'
import Pagination from '../components/Pagination.vue'
import { useHistoryStore } from '@/stores/history'
import HistoryPanel from '@/components/HistoryPanel.vue'
import CommentSection from '../components/CommentSection.vue'
import AudioPlayer from '../components/AudioPlayer.vue'
import { toastSuccess, toastError, toastInfo, toastWarning } from '../utils/toast'
import ChangePasswordModal from '../components/ChangePasswordModal.vue'

const showSettings = ref(false)
const showHistoryPanel = ref(false)
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const notesStore = useNotesStore()
const historyStore = useHistoryStore()

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// ===== 数据 =====
const selectedNote = ref(null)
const examMode = ref(false)
const showUserMenu = ref(false)
const showChangePassword = ref(false)
const userMenuRef = ref(null)
const userBtnRef = ref(null)
const dropdownMenuRef = ref(null)
const userMenuStyle = ref({})
const scrollKnob = ref(null)
const tickerRef = ref(null)
const tickerTrackRef = ref(null)

// ===== 动效交互 =====
let rafPending = false
let lastHoverCard = null
let burstLocked = false

function spawnInkRipple(e, target) {
  const r = target.getBoundingClientRect()
  const el = document.createElement('span')
  el.className = 'ink-ripple'
  el.style.left = (e.clientX - r.left) + 'px'
  el.style.top = (e.clientY - r.top) + 'px'
  target.appendChild(el)
  el.addEventListener('animationend', () => el.remove(), { once: true })
}

function handleGridMouseMove(e) {
  const card = e.target.closest('.note-card')
  if (!card) return
  if (card !== lastHoverCard && lastHoverCard) {
    lastHoverCard.style.setProperty('--mx', '50')
    lastHoverCard.style.setProperty('--my', '50')
  }
  lastHoverCard = card
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    if (!lastHoverCard) return
    const r = lastHoverCard.getBoundingClientRect()
    lastHoverCard.style.setProperty('--mx', String((e.clientX - r.left) / r.width * 100))
    lastHoverCard.style.setProperty('--my', String((e.clientY - r.top) / r.height * 100))
  })
}

function handleGridMouseLeave() {
  if (lastHoverCard) {
    lastHoverCard.style.setProperty('--mx', '50')
    lastHoverCard.style.setProperty('--my', '50')
    lastHoverCard = null
  }
}

function handleListClickRipple(e) {
  const fc = e.target.closest('.filter-cs')
  if (fc) { spawnInkRipple(e, fc); return }
  const card = e.target.closest('.note-card')
  if (card) spawnInkRipple(e, card)
}

function handleScroll() {
  const h = document.documentElement
  const max = h.scrollHeight - h.clientHeight
  const pct = max > 0 ? h.scrollTop / max : 0
  const knob = scrollKnob.value
  if (!knob) return
  knob.style.top = (pct * 100) + '%'
  if (pct > 0.985 && !burstLocked) {
    burstLocked = true
    knob.classList.add('burst')
    setTimeout(() => {
      knob.classList.remove('burst')
      burstLocked = false
    }, 900)
  }
}

function syncTicker() {
  const box = tickerRef.value
  const track = tickerTrackRef.value
  if (!box || !track) return
  const containerW = box.clientWidth
  const trackW = track.scrollWidth
  box.style.setProperty('--ticker-from', containerW + 'px')
  box.style.setProperty('--ticker-to', (containerW - trackW) + 'px')
}

// 滑动返回相关
const startX = ref(0)
const startY = ref(0)
const slideX = ref(0)
const isSliding = ref(false)

const panelOpacity = computed(() => {
  const width = window.innerWidth || 1
  return 1 - Math.min(Math.abs(slideX.value) / width, 1) * 0.9
})

// ===== 下拉选项数据 =====
const knowledgeAreaOptions = [
  { value: '', label: '📚 全部知识领域' },
  { value: '项目管理概论', label: '📖 项目管理概论' },
  { value: '项目立项管理', label: '📋 项目立项管理' },
  { value: '整合管理', label: '🔗 整合管理' },
  { value: '范围管理', label: '📐 范围管理' },
  { value: '进度管理', label: '⏱️ 进度管理' },
  { value: '成本管理', label: '💰 成本管理' },
  { value: '质量管理', label: '✅ 质量管理' },
  { value: '资源管理', label: '👥 资源管理' },
  { value: '沟通管理', label: '💬 沟通管理' },
  { value: '风险管理', label: '⚠️ 风险管理' },
  { value: '采购管理', label: '🛒 采购管理' },
  { value: '干系人管理', label: '🤝 干系人管理' },
]

const TAG_COLOR_MAP = {
  '整合管理': 'tag-green',
  '范围管理': 'tag-blue',
  '进度管理': 'tag-cyan',
  '成本管理': 'tag-amber',
  '质量管理': 'tag-teal',
  '资源管理': 'tag-purple',
  '沟通管理': 'tag-sky',
  '风险管理': 'tag-pink',
  '采购管理': 'tag-orange',
  '干系人管理': 'tag-rose',
  '项目管理概论': 'tag-indigo',
  '项目立项管理': 'tag-slate',
}
const tagColorClass = (tag) => TAG_COLOR_MAP[tag] || 'tag-default'

// ===== 计算属性 =====
const totalViews = computed(() => notesStore.totalViews)
const totalCharacters = computed(() => notesStore.totalCharacters)

const formatNum = (n) => {
  if (!n) return '0'
  if (n >= 10000) return (n / 10000).toFixed(1) + 'W'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}
const filteredNotes = computed(() => notesStore.filteredNotes)
const paginatedNotes = computed(() => notesStore.paginatedNotes)
const totalNotes = computed(() => notesStore.totalNotes)
const isLoading = computed(() => notesStore.isLoading)

const resetPage = () => {
  notesStore.currentPage = 1
}

const hotTopics = computed(() => {
  const map = {}
  notesStore.notes.forEach(n => {
    ;(n.tags || []).forEach(t => {
      map[t] = (map[t] || 0) + 1
    })
  })
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
})

// 知识领域固定展示顺序（概论、立项 + PMBOK 十大，与 AdminPanel 保存口径一致）
const KNOWLEDGE_AREAS = [
  '项目管理概论', '项目立项管理',
  '整合管理', '范围管理', '进度管理', '成本管理', '质量管理',
  '资源管理', '沟通管理', '风险管理', '采购管理', '干系人管理'
]

// 从笔记 tags 中识别知识领域（AdminPanel 保存时把知识领域写入 tags）
// 注意：category 存的是过程组（如"项目管理/执行阶段"），不能用于知识领域聚合
const getNoteKnowledgeArea = (note) => {
  const tags = note.tags || []
  return tags.find(t => KNOWLEDGE_AREAS.includes(t)) || null
}

const learningMasteryStats = computed(() => {
  const stats = {}

  // 遍历全部笔记（不限数量），按知识领域（tags 中识别）聚合
  notesStore.notes.forEach(note => {
    if (!note) return

    const area = getNoteKnowledgeArea(note)
    if (!area) return  // 未标注知识领域的笔记不参与聚合

    // 与详情滑块/列表卡统一口径：个人掌握度优先，兜底全局 examScore，都没有记 0
    const rawScore = getUserExamScore(note)
    const score = rawScore != null ? rawScore : 0

    if (!stats[area]) {
      stats[area] = { total: 0, count: 0 }
    }
    stats[area].total += score
    stats[area].count += 1
  })

  // 按知识领域固定顺序输出；只显示有笔记的领域
  const result = {}
  KNOWLEDGE_AREAS.forEach(area => {
    if (stats[area] && stats[area].count > 0) {
      result[area] = Math.round(stats[area].total / stats[area].count)
    }
  })

  return result
})

// ===== 新增：获取卡片摘要 =====
const getNoteSummary = (note) => {
  // 1. 优先使用 scenario
  if (note.scenario && note.scenario.trim()) {
    const cleanText = note.scenario.replace(/^#{1,6}\s+/gm, '').trim()
    return cleanText.length > 120 ? cleanText.slice(0, 120) + '...' : cleanText
  }
  
  // 2. 其次使用 content 提取纯文本
  if (note.content && note.content.trim()) {
    const cleanText = stripHtml(note.content)
      .replace(/^#{1,6}\s+/gm, '')
      .trim()
    if (cleanText) {
      return cleanText.length > 120 ? cleanText.slice(0, 120) + '...' : cleanText
    }
  }
  
  // 3. 最后使用 keyPoints 或 fallback
  if (note.keyPoints && note.keyPoints.length > 0) {
    return note.keyPoints[0].length > 120 ? note.keyPoints[0].slice(0, 120) + '...' : note.keyPoints[0]
  }
  
  return '暂无内容摘要'
}

// ===== 方法 =====
const stripHtml = (content) => {
  if (!content) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = content
  return tmp.textContent || tmp.innerText || ''
}

const contentSummary = (content, fallback = '') => {
  const fallbackText = stripHtml(fallback)
  if (!fallbackText) return '暂无内容'
  const cleanText = fallbackText.replace(/^#{1,6}\s+/gm, '').trim()
  return cleanText.length > 100 ? cleanText.slice(0, 100) + '...' : cleanText
}

const renderMarkdown = (content, fallback = '') => {
  const resolved = content && String(content).trim() ? content : fallback
  if (!resolved) return '<p>暂无内容</p>'
  try {
    if (String(resolved).includes('<p>') || String(resolved).includes('<div>') || String(resolved).includes('<h')) {
      return resolved
    }
    return md.render(resolved)
  } catch (e) {
    return resolved
  }
}

const updateUserMenuPosition = () => {
  if (!userBtnRef.value) return
  const rect = userBtnRef.value.getBoundingClientRect()
  userMenuStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.right - 160}px`,
    zIndex: 9999
  }
}

const toggleUserMenu = () => {
  if (!showUserMenu.value) {
    updateUserMenuPosition()
  }
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleClickOutside = (e) => {
  if (userBtnRef.value && userBtnRef.value.contains(e.target)) return
  if (dropdownMenuRef.value && dropdownMenuRef.value.contains(e.target)) return
  showUserMenu.value = false
}

const loadNotes = async () => {
  try {
    const data = await notesStore.loadNotes()
    if (data && Array.isArray(data)) {
      toastSuccess(`成功加载 ${data.length} 条笔记`)
    } else {
      toastWarning('未加载到笔记数据')
    }
  } catch (e) {
    console.error('加载笔记失败:', e)
    toastError('加载笔记失败，请稍后重试')
  }
}

const loadNoteContent = async (noteId) => {
  const response = await fetch(`/api/notes/${noteId}`)
  return response.json()
}

const loadUserProgress = async (noteId) => {
  if (!authStore.user?.id) return null
  try {
    const response = await fetch(`/api/user-progress?noteId=${encodeURIComponent(noteId)}`, {
      headers: {
        'Authorization': `Bearer ${authStore.token || ''}`
      }
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.score != null ? Number(data.score) : null
  } catch (e) {
    console.error('加载用户掌握度失败:', e)
    return null
  }
}

// 批量拉取当前用户所有笔记的掌握度，并合并进 notesStore.notes
// 解决：列表接口不带个人掌握度，导致 Dashboard/列表卡只显示全局 examScore 的问题
const loadAllUserProgress = async () => {
  if (!authStore.user?.id) return
  try {
    const response = await fetch('/api/user-progress?all=true', {
      headers: {
        'Authorization': `Bearer ${authStore.token || ''}`
      }
    })
    if (!response.ok) return
    const data = await response.json()
    const scores = data.scores || {}
    const currentUserId = authStore.user.id

    notesStore.notes.forEach(note => {
      const score = scores[String(note.id)]
      if (score != null && !isNaN(Number(score))) {
        note.userExamScores = {
          ...(note.userExamScores || {}),
          [currentUserId]: Number(score)
        }
      }
    })
  } catch (e) {
    console.error('批量加载用户掌握度失败:', e)
  }
}

// ===== 滚动到顶部 =====
const scrollDetailToTop = () => {
  nextTick(() => {
    const detailEl = document.querySelector('.modal-detail')
    if (detailEl) {
      detailEl.scrollTop = 0
    }
  })
}

// ===== viewDetail =====
const viewDetail = async (note) => {
  if (selectedNote.value && selectedNote.value.id === note.id) {
    return
  }

  if (selectedNote.value) {
    selectedNote.value = null
    document.body.style.overflow = ''
    slideX.value = 0
    isSliding.value = false
    await new Promise(resolve => requestAnimationFrame(resolve))
  }

  selectedNote.value = { ...note, content: '加载中...', userExamScores: note.userExamScores || {} }
  document.body.style.overflow = 'hidden'

  await nextTick()
  scrollDetailToTop()

  // ==== 并行加载：用户掌握度 + 笔记完整内容（如果需要） ====
  const needFullContent = !note.content || String(note.content).length < 200
  const hasUser = !!authStore.user?.id

  const progressPromise = hasUser ? loadUserProgress(note.id) : Promise.resolve(null)
  const contentPromise = needFullContent ? loadNoteContent(note.id) : Promise.resolve(null)

  try {
    // 两个请求并行执行
    const [myScore, fullNote] = await Promise.all([progressPromise, contentPromise])

    if (!selectedNote.value) return

    // 合并掌握度：先保存待合并的个人分，避免 fullNote 展开后把 examScore 冲掉
    const mergedUserExamScores = {
      ...(selectedNote.value.userExamScores || {}),
      ...(myScore != null ? { [authStore.user.id]: myScore } : {})
    }
    const personalExamScore =
      (authStore.user?.id && mergedUserExamScores[authStore.user.id] != null)
        ? Number(mergedUserExamScores[authStore.user.id])
        : null

    if (myScore != null) {
      selectedNote.value.userExamScores = mergedUserExamScores
      selectedNote.value.examScore = personalExamScore
    }

    // 合并完整内容：显式保留已合并的 userExamScores 与个人 examScore
    if (fullNote) {
      selectedNote.value = {
        ...fullNote,
        userExamScores: {
          ...(fullNote.userExamScores || {}),
          ...mergedUserExamScores
        },
        // 个人掌握度优先，无个人分才退回全局默认 examScore
        examScore: personalExamScore != null ? personalExamScore : fullNote.examScore
      }
      await nextTick()
      scrollDetailToTop()
    }
  } catch (e) {
    console.error('加载笔记内容失败:', e)
    toastError('加载内容失败，请稍后重试')
    if (!selectedNote.value) return
    selectedNote.value = note
    await nextTick()
    scrollDetailToTop()
  }

  notesStore.incrementViewCount(note.id)
  historyStore.addHistory(note)
}

// ===== closeDetail =====
const closeDetail = (useAnimation = true) => {
  if (!selectedNote.value) return

  if (useAnimation) {
    isSliding.value = true
    slideX.value = window.innerWidth
    setTimeout(() => {
      selectedNote.value = null
      slideX.value = 0
      isSliding.value = false
      document.body.style.overflow = ''
    }, 420)
    return
  }

  selectedNote.value = null
  slideX.value = 0
  isSliding.value = false
  document.body.style.overflow = ''
}

/**
 * 获取笔记展示用的掌握度分数（列表卡 / 详情滑块共用）。
 * 优先级：
 *  1. 已登录且有个人掌握度 → 返回 userExamScores[uid]
 *  2. 笔记自带全局 examScore（notes 表默认值）→ 返回 examScore
 *  3. 以上都没有 → 返回 null（调用方 v-if 判断后不渲染 mastery-bar）
 */
const getUserExamScore = (note) => {
  if (!note || typeof note !== 'object') return null

  const currentUserId = authStore.user?.id
  if (currentUserId) {
    const userExamScores = note.userExamScores || {}
    const personalScore = userExamScores[currentUserId]
    if (personalScore != null && !isNaN(Number(personalScore))) {
      return Number(personalScore)
    }
  }

  const globalScore = note.examScore
  if (globalScore != null && !isNaN(Number(globalScore))) {
    return Number(globalScore)
  }

  return null
}

const handleExamScoreInput = async (event) => {
  if (!selectedNote.value) return
  const score = Number(event.target.value)

  const currentUserId = authStore.user?.id
  if (!currentUserId) {
    toastWarning('请先登录后再记录自己的掌握度')
    return
  }

  const nextUserScores = {
    ...(selectedNote.value.userExamScores || {}),
    [currentUserId]: score
  }
  selectedNote.value.userExamScores = nextUserScores
  selectedNote.value.examScore = score

  const noteIndex = notesStore.notes.findIndex(n => n.id === selectedNote.value.id)
  if (noteIndex !== -1) {
    notesStore.notes[noteIndex].userExamScores = nextUserScores
    // 列表卡片的 examScore 改为显示当前用户的个人掌握度（与 getUserExamScore 一致），
    // 不再清零（清零会破坏未登录用户看到的全局 examScore）。
    notesStore.notes[noteIndex].examScore = score
  }

  try {
    const response = await fetch('/api/user-progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token || ''}`
      },
      body: JSON.stringify({
        noteId: selectedNote.value.id,
        userId: currentUserId,
        score
      })
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '更新掌握度失败' }))
      throw new Error(errorData.error || '更新掌握度失败')
    }
  } catch (e) {
    console.error('更新掌握度失败:', e)
    toastError('掌握度更新失败，请稍后重试')
  }
}

// iOS 侧滑返回
const handleTouchStart = (e) => {
  const touch = e.touches[0]
  startX.value = touch.clientX
  startY.value = touch.clientY
  if (touch.clientX <= 30) {
    isSliding.value = true
  } else {
    isSliding.value = false
  }
}

const handleTouchMove = (e) => {
  if (!isSliding.value) return
  const touch = e.touches[0]
  const diffX = touch.clientX - startX.value
  const diffY = touch.clientY - startY.value
  if (diffX <= 0 || Math.abs(diffX) <= Math.abs(diffY) * 1.15) {
    return
  }
  const maxOffset = Math.min(window.innerWidth * 0.96, 420)
  slideX.value = Math.min(diffX * 0.72, maxOffset)
  if (e.cancelable) e.preventDefault()
}

const handleTouchEnd = () => {
  if (!isSliding.value) return
  const threshold = window.innerWidth * 0.35
  if (slideX.value >= threshold) {
    closeDetail(true)
  } else {
    isSliding.value = false
    slideX.value = 0
  }
}

const markUseful = (note) => {
  notesStore.incrementUsefulCount(note.id)
  selectedNote.value = notesStore.getNoteById(note.id) || note
}

const openNoteById = (noteId) => {
  if (!noteId || notesStore.notes.length === 0) return
  const note = notesStore.getNoteById(parseInt(noteId)) || notesStore.notes.find(n => String(n.id) === String(noteId))
  if (note) {
    viewDetail(note)
    showHistoryPanel.value = false
  }
}

const openChangePassword = () => {
  showUserMenu.value = false
  showChangePassword.value = true
}

const handlePasswordChangeSuccess = () => {
  toastSuccess('密码修改成功，请重新登录')
  setTimeout(() => {
    authStore.logout()
    router.push('/login')
  }, 2000)
}

const logout = () => {
  authStore.logout()
  router.push('/login')
}

onBeforeRouteLeave(() => {
  selectedNote.value = null
  document.body.style.overflow = ''
  slideX.value = 0
  isSliding.value = false
})

onMounted(async () => {
  // 冷启动（未登录但 localStorage 有 token）：并行校验会话 + 加载笔记
  // 登录后直接进入：isLoggedIn 已为 true，跳过校验只加载笔记
  if (!authStore.isLoggedIn) {
    const [authOk] = await Promise.all([
      authStore.checkAuth(),
      loadNotes().catch(() => {})  // 显式吞错：loadNotes 失败不应中断角色校验
    ])
    if (!authOk) {
      router.push('/login')
      return
    }
  } else {
    await loadNotes().catch(() => {})
  }

  // 角色校验（保证执行，即使 loadNotes 失败）
  if (authStore.user?.role !== 'viewer') {
    router.push('/admin')
    return
  }

  // 批量拉取个人掌握度并合并进列表（Dashboard/列表卡展示真实个人分数）
  await loadAllUserProgress()

  const noteId = route.query.noteId
  if (noteId) {
    setTimeout(() => {
      openNoteById(noteId)
      router.replace({ query: {} })
    }, 100)
  }

  document.addEventListener('click', handleClickOutside)

  const grid = document.querySelector('.note-grid')
  if (grid) {
    grid.addEventListener('mousemove', handleGridMouseMove)
    grid.addEventListener('mouseleave', handleGridMouseLeave)
  }
  document.addEventListener('click', handleListClickRipple)
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('scroll', () => {
    if (showUserMenu.value) updateUserMenuPosition()
  }, { passive: true })
  window.addEventListener('resize', () => {
    if (showUserMenu.value) updateUserMenuPosition()
  })
  syncTicker()
  window.addEventListener('resize', syncTicker)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(syncTicker)
  }
  handleScroll()
})

watch(() => route.query.noteId, (newNoteId) => {
  if (newNoteId && notesStore.notes.length > 0) {
    openNoteById(newNoteId)
    router.replace({ query: {} })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  const grid = document.querySelector('.note-grid')
  if (grid) {
    grid.removeEventListener('mousemove', handleGridMouseMove)
    grid.removeEventListener('mouseleave', handleGridMouseLeave)
  }
  document.removeEventListener('click', handleListClickRipple)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('resize', syncTicker)
  document.body.style.overflow = ''
  
  selectedNote.value = null
  slideX.value = 0
  isSliding.value = false
})
</script>

<style scoped>
.viewer-panel {
  background: var(--bg-primary);
  padding: 20px 18px;
  min-height: 100vh;
  transition: filter 0.25s ease, transform 0.25s ease;
}

/* 已移除 detail-open 的 transform 缩放：
 * transform 会让 .viewer-panel 成为其内部 position:fixed 后代(.modal-overlay)的包含块，
 * 导致手机端全屏详情弹窗脱离视口定位，长内容滚动时底部被裁切、显示不完全 */

/* ===== 头部 ===== */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  z-index: 500;
}

.history-section {
  margin-bottom: 16px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.app-logo {
  display: flex;
  align-items: center;
}

.app-logo img {
  display: block;
  width: 20px;
  height: 20px;
}

.app-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-right {
  position: relative;
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  border-radius: 8px;
  transition: background 0.2s;
}

.user-btn:hover {
  background: var(--bg-primary);
}

.user-avatar {
  display: flex;
  align-items: center;
}

.user-avatar img {
  display: block;
  width: 16px;
  height: 16px;
}

.user-name {
  font-weight: 500;
}

.menu-arrow {
  font-size: 10px;
  color: var(--text-muted);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--bg-secondary);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 6px 0;
  min-width: 140px;
  z-index: 200;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  text-align: left;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: var(--bg-hover);
}

.dropdown-item.danger {
  color: #e74c3c;
}

.item-icon {
  font-size: 14px;
}

/* ===== 无缝滚动公告条 ===== */
.header-ticker {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  height: 26px;
  display: flex;
  align-items: center;
  margin: 0 14px;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
}

.ticker-track {
  display: inline-flex;
  white-space: nowrap;
  will-change: transform;
  animation: ticker-scroll 20s linear infinite;
}

.ticker-content {
  font-size: 13px;
  color: var(--text-secondary);
}

.ticker-highlight {
  color: #6366f1;
  font-weight: 600;
}

@keyframes ticker-scroll {
  from { transform: translateX(var(--ticker-from, 100%)); }
  to { transform: translateX(var(--ticker-to, -100%)); }
}

/* ===== 统计徽章行 ===== */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-mini {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  font-size: 12px;
  color: #999;
}

.stat-mini .stat-val {
  font-size: 14px;
  font-weight: 600;
  color: #6366f1;
}

.stat-mini .stat-label {
  font-size: 12px;
  color: #999;
}

.stat-dot {
  color: #ccc;
  font-size: 12px;
}

.stat-spacer {
  flex: 1;
}

.stat-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  border: 1px solid #e5e5e5;
  background: transparent;
  font-size: 12px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.stat-icon-btn:hover {
  background: #f5f5f5;
  border-color: #ccc;
}

.stat-icon-btn.active {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
}

.stat-mini:nth-child(-n+3) .stat-val {
  animation: val-pulse 3.2s ease-in-out infinite;
}

@keyframes val-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ===== 搜索 + 筛选 ===== */
.filter-wrap {
  margin-bottom: 16px;
  position: relative;
  z-index: 200;
}

.search-field {
  position: relative;
  margin-bottom: 8px;
}

.filter-wrap::after {
  content: "";
  display: block;
  height: 1px;
  background: #f0f0f0;
  margin: 4px 0 0;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid transparent;
  border-radius: 24px;
  font-size: 14px;
  box-sizing: border-box;
  transition: all 0.25s var(--ease-soft);
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.search-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
  outline: none;
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.filter-row::before,
.filter-row::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 20px;
  pointer-events: none;
  z-index: 220;
}

.filter-row::before {
  left: -4px;
  background: linear-gradient(to right, var(--bg-primary), transparent);
}

.filter-row::after {
  right: -4px;
  background: linear-gradient(to left, var(--bg-primary), transparent);
}

.filter-row .filter-cs {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 210;
  border-radius: 10px;
  transition: transform .3s var(--ease-out-quint),
              box-shadow .3s var(--ease-soft),
              margin-left .3s var(--ease-soft);
}

.filter-row:hover .filter-cs { margin-left: 4px; }
.filter-row .filter-cs:first-child { margin-left: 0; }
.filter-cs:hover {
  transform: translateY(-3px) scale(1.01);
  box-shadow: 0 3px 10px var(--ink-violet);
}

.filter-cs.is-active {
  box-shadow: 0 0 0 2px var(--accent-color),
              0 0 16px var(--ink-violet);
}

.exam-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 10px 4px 4px;
  background: var(--accent-light);
  border-radius: 24px;
  border: 2px solid var(--border-color);
}

.switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ccc;
  border-radius: 20px;
  transition: 0.3s;
}

.slider:before {
  content: "";
  position: absolute;
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

.switch input:checked + .slider {
  background: #667eea;
}

.switch input:checked + .slider:before {
  transform: translateX(16px);
}

.toggle-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ===== 考点看板 ===== */
.exam-dashboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.dashboard-card {
  background: var(--bg-secondary);
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.dashboard-card h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.dashboard-card ul {
  padding: 0;
  list-style: none;
  margin: 0;
}

.dashboard-card li {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 14px;
  border-bottom: 1px solid var(--border-light);
  color: var(--text-secondary);
}

.dashboard-card li:last-child {
  border-bottom: none;
}

.topic-count {
  background: #667eea20;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #667eea;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 3px 0;
  font-size: 13px;
}

.progress-bar .bar {
  flex: 1;
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar .bar div {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
}

.progress-bar .bar-label {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 32px;
}

/* ===== 笔记卡片网格 ===== */
.note-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 4px 0;
}

.note-card {
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: box-shadow .35s var(--ease-soft),
              transform .25s var(--ease-out-quint);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  --mx: 50;
  --my: 50;
  border: 1px solid rgba(0,0,0,0.04);
}

.note-card::before {
  content: "";
  position: absolute;
  left: 0;
  top: 14px;
  bottom: 14px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%);
  opacity: 0.8;
  transition: opacity 0.3s, width 0.3s;
  z-index: 1;
}

.note-card:hover::before {
  opacity: 1;
  width: 5px;
}

.note-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(180px circle at calc(var(--mx) * 1%) calc(var(--my) * 1%),
              var(--ink-violet), transparent 60%);
  opacity: 0;
  transition: opacity .35s var(--ease-soft);
  pointer-events: none;
  z-index: 0;
}

.note-card:hover {
  transform: perspective(900px)
             rotateX(calc((var(--my) - 50) / 12 * -1deg))
             rotateY(calc((var(--mx) - 50) / 12 * 1deg))
             translateY(-4px);
  box-shadow: 0 16px 40px var(--ink-violet);
}
.note-card:hover::before { opacity: .6; }

.note-card:active {
  transform: scale(0.98);
}

.card-header-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 14px 16px 0;
}

.card-header-left {
  display: flex;
  align-items: center;
}

.card-header-right {
  display: flex;
  align-items: center;
}

.difficulty-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.difficulty-badge.初级 {
  background: #d4edda;
  color: #155724;
}

.difficulty-badge.中级 {
  background: #fff3cd;
  color: #856404;
}

.difficulty-badge.高级 {
  background: #f8d7da;
  color: #721c24;
}

.progress-badge {
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  background: #f0f2ff;
  padding: 4px 10px;
  border-radius: 12px;
}

.card-title {
  margin: 14px 16px 8px 20px;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

.card-summary {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0 16px 14px 20px;
  min-height: 44px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px 12px 20px;
  background: transparent;
}

.card-footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6366f1;
  flex-shrink: 0;
}

.cat-name {
  font-size: 12px;
  color: #999;
}

.category-tag {
  display: none;
}

.card-footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-date {
  font-size: 12px;
  color: #bbb;
}

.view-link {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: gap 0.2s;
}

.view-link:hover {
  gap: 6px;
}

.arrow-icon {
  font-size: 12px;
  transition: transform 0.2s;
}

@media (hover: hover) {
  .view-link {
    position: relative;
  }
  .view-link::before,
  .view-link::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 0;
    height: 1px;
    background: linear-gradient(90deg, var(--accent-color), var(--gold));
    transition: width .45s var(--ease-out-quint) .55s;
  }
  .view-link::before { right: 50%; }
  .view-link::after  { left: 50%; }
  .note-card:hover .view-link::before,
  .note-card:hover .view-link::after { width: 22px; }
}

.card-exam-details {
  padding: 12px 16px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
}

.process-label,
.section-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
}

.process-tag {
  display: inline-block;
  padding: 2px 10px;
  background: #667eea20;
  color: #667eea;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 6px;
}

.exam-section {
  margin-top: 6px;
}

.exam-section ul {
  margin: 2px 0 0 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.exam-section.pitfall ul {
  color: #c0392b;
}

.comparison-box {
  margin-top: 8px;
  background: var(--bg-secondary, #ffffff);
  border-radius: 6px;
  border-left: 3px solid #667eea;
  padding: 10px 12px;
  overflow-x: auto;
}

.comparison-box h4,
.comparison-box h5 {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: var(--text-primary, #333);
}

.comparison-box table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.comparison-box th,
.comparison-box td {
  padding: 4px 10px;
  border: 1px solid var(--border-color, #e8ecf1);
  text-align: left;
}

.comparison-box th {
  background: var(--accent-light, #f0f2ff);
  font-weight: 600;
}

.comparison-box td:first-child {
  font-weight: 500;
}

.memory-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--memory-box-bg, #fffbeb);
  border-radius: 6px;
  padding: 10px 14px;
  border: 1px solid var(--memory-box-border, #fde68a);
}

.memory-box .memory-item {
  font-size: 13px;
  color: var(--memory-box-text, #92400e);
  padding: 2px 0;
}

.mastery-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
}

.mastery-bar .bar {
  flex: 1;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}

.mastery-bar .bar div {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #f97316, #22c55e);
}

.mastery-bar .score {
  font-weight: 600;
  color: #667eea;
}

.empty {
  grid-column: 1/-1;
  text-align: center;
  padding: 80px 0;
}

.empty-icon {
  font-size: 48px;
}

.empty p {
  color: var(--text-muted);
  font-size: 18px;
  margin: 12px 0;
}

.empty-hint {
  color: var(--text-light);
  font-size: 14px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 4px 0;
}

.skeleton-card {
  background: var(--bg-primary);
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(0,0,0,0.04);
  position: relative;
  overflow: hidden;
}

.skeleton-card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255,255,255,0.6) 50%,
    transparent 100%);
  animation: skeleton-shimmer 1.5s infinite;
}

@keyframes skeleton-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.skeleton-line {
  height: 14px;
  margin-bottom: 10px;
  background: linear-gradient(90deg, #f0f0f0 0%, #e8e8e8 50%, #f0f0f0 100%);
  border-radius: 4px;
}

.skeleton-title {
  height: 18px;
  width: 60%;
  margin-bottom: 14px;
}

.skeleton-short {
  width: 70%;
}

.skeleton-footer {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(0,0,0,0.04);
}

.skeleton-mini {
  height: 10px;
  width: 40px;
  margin: 0;
  background: linear-gradient(90deg, #f0f0f0 0%, #e8e8e8 50%, #f0f0f0 100%);
}

/* ================================================================
   ===== 详情弹窗 - 全屏铺开版 =====
   ================================================================ */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  padding: 0;
  display: block;
  overflow: hidden;
}

.modal-detail {
  position: relative;
  background: var(--bg-secondary);
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  padding: 0;
  border-radius: 0;
  box-shadow: none;
  transition: all 0.15s ease;
  z-index: 1100;
  border-left: 1px solid rgba(148, 163, 184, 0.18);
}

/* ================================================================
    .modal-back 样式 - 独立于任何父级，固定在视口，纯图标
   ================================================================ */
.modal-back {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 1200;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  height: auto;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-back:hover {
  opacity: 0.7;
  transform: translateX(-4px);
}

.modal-back:active {
  transform: scale(0.92);
}

.back-icon {
  width: 32px;
  height: 32px;
  display: block;
}

/* 详情内容样式 */
.detail-header {
  padding-top: 20px;
  margin-bottom: 24px;
}

.detail-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.detail-category {
  display: inline-block;
  background: #ede9fe;
  color: #6d28d9;
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
}

.detail-time {
  font-size: 13px;
  color: var(--text-muted);
}

.detail-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

.detail-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.progress-label {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.progress-number {
  font-size: 13px;
  font-weight: 700;
  color: #4f46e5;
  white-space: nowrap;
}

.progress-meter {
  display: flex;
  align-items: center;
  width: 100%;
}

.progress-track {
  position: relative;
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 999px;
  transition: width 0.12s ease-out;
}

.detail-score-slider {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  margin-top: 2px;
}

.detail-score-slider input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 25%;
  min-width: 110px;
  max-width: 160px;
  height: 28px;
  background: transparent;
  cursor: pointer;
}

.detail-score-slider input[type="range"]::-webkit-slider-runnable-track {
  height: 7px;
  background: linear-gradient(90deg, #dfe3f9, #e9e7ff);
  border-radius: 999px;
}

.detail-score-slider input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  margin-top: -6px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #6366f1;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.18);
}

.detail-score-slider input[type="range"]::-moz-range-track {
  height: 7px;
  background: linear-gradient(90deg, #dfe3f9, #e9e7ff);
  border-radius: 999px;
  border: none;
}

.detail-score-slider input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #6366f1;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.18);
}

.detail-score-slider input[type="range"]:focus {
  outline: none;
}

@media (max-width: 640px) {
  .detail-progress {
    margin-top: 10px;
    gap: 6px;
  }

  .progress-track {
    height: 7px;
  }

  .detail-score-slider {
    width: 100%;
  }

  .detail-score-slider input[type="range"] {
    width: 40%;
    min-width: 100px;
  }
}

.detail-case,
.detail-attachments,
.detail-exam {
  margin-bottom: 24px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.detail-case h4,
.detail-attachments h4,
.detail-exam h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.detail-keypoints {
  background: #eef2ff;
  border-left: 4px solid #667eea;
  padding: 24px 28px;
  margin: 32px 0 28px;
  border-radius: 8px;
}

.detail-keypoints h4 {
  margin: 0 0 12px 0;
  color: #312e81;
}

.detail-keypoints ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.detail-keypoints li {
  position: relative;
  padding-left: 22px;
  margin-bottom: 10px;
  line-height: 1.7;
  color: #475569;
}

.detail-keypoints li:last-child {
  margin-bottom: 0;
}

.detail-keypoints li::before {
  content: "◆";
  position: absolute;
  left: 0;
  top: 0;
  color: #667eea;
  font-size: 12px;
  line-height: 1.7;
}

.detail-scenario {
  background: #fffbeb;
  border: 1px solid #fde68a;
  padding: 20px 24px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.detail-scenario h4 {
  margin: 0 0 8px 0;
  color: #92400e;
}

.detail-scenario p {
  margin: 0;
  color: #78350f;
  line-height: 1.8;
}

.detail-exam-item {
  margin-top: 8px;
}

.detail-exam-item .exam-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-exam-item ul {
  margin: 2px 0 0 0;
  padding-left: 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.detail-exam-item.pitfall ul {
  color: #c0392b;
}

.detail-content {
  font-size: 16px;
  line-height: 1.9;
  color: var(--text-secondary);
  margin-bottom: 24px;
  padding: 0;
}

.detail-content :deep(p) {
  margin: 0 0 18px;
}

.detail-content :deep(h1) {
  font-size: 26px;
  margin: 28px 0 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.detail-content :deep(h2) {
  font-size: 22px;
  margin: 40px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border-light);
  color: var(--text-primary);
  font-weight: 600;
}

.detail-content :deep(h3) {
  font-size: 18px;
  margin: 28px 0 12px;
  color: var(--text-primary);
  font-weight: 600;
}

.detail-content :deep(ul) {
  padding-left: 20px;
}

.detail-content :deep(ol) {
  padding-left: 13px;
}

.detail-content :deep(li) {
  margin-bottom: 6px;
}

.detail-content :deep(pre) {
  background: var(--bg-code);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}

.detail-content :deep(code) {
  background: var(--bg-code);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.detail-content :deep(blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 16px;
  margin: 8px 0;
  color: var(--text-muted);
}

.detail-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  table-layout: auto;
}

.detail-content :deep(th),
.detail-content :deep(td) {
  border: 1px solid var(--border-color);
  padding: 12px 16px;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-align: center;
  vertical-align: middle;
}

.detail-content :deep(td:first-child),
.detail-content :deep(th:first-child) {
  white-space: normal;
  min-width: 0;
}

.detail-content :deep(td:last-child),
.detail-content :deep(th:last-child) {
  white-space: normal;
  min-width: 0;
}

.detail-content :deep(th) {
  background: var(--border-light);
  color: var(--text-primary);
  font-weight: 600;
}

.case-content {
  background: var(--bg-primary);
  padding: 12px 16px;
  border-radius: 6px;
  color: var(--text-secondary);
  line-height: 1.9;
  font-size: 15px;
  overflow-x: auto;
}

.case-content :deep(h1) {
  font-size: 22px;
  margin: 16px 0 8px;
  color: var(--text-primary);
}

.case-content :deep(h2) {
  font-size: 19px;
  margin: 14px 0 6px;
  color: var(--text-primary);
}

.case-content :deep(h3) {
  font-size: 17px;
  margin: 12px 0 6px;
  color: var(--text-primary);
}

.case-content :deep(ul) {
  padding-left: 20px;
}

.case-content :deep(ol) {
  padding-left: 13px;
}

.case-content :deep(li) {
  margin-bottom: 6px;
}

.case-content :deep(pre) {
  background: var(--bg-code);
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}

.case-content :deep(code) {
  background: var(--bg-code);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.case-content :deep(blockquote) {
  border-left: 4px solid #f97316;
  padding-left: 16px;
  margin: 8px 0;
  color: var(--text-muted);
}

.case-content :deep(table) {
  border-collapse: collapse !important;
  border-spacing: 0 !important;
  width: 100%;
  table-layout: auto;
}

.case-content :deep(th),
.case-content :deep(td) {
  border: 1px solid var(--border-color);
  padding: 12px 16px;
  word-break: break-word;
  overflow-wrap: anywhere;
  text-align: center;
  vertical-align: middle;
  white-space: normal;
}

.case-content :deep(td:first-child),
.case-content :deep(th:first-child) {
  white-space: normal;
  min-width: 0;
}

.case-content :deep(td:last-child),
.case-content :deep(th:last-child) {
  white-space: normal;
  min-width: 0;
}

.case-content :deep(th) {
  background: var(--border-light);
  color: var(--text-primary);
  font-weight: 600;
}

.case-content :deep(a) {
  color: #667eea;
  text-decoration: none;
}

.case-content :deep(a:hover) {
  text-decoration: underline;
}

.detail-attachments ul {
  margin: 0;
  padding-left: 20px;
}

.detail-attachments a {
  color: #667eea;
  text-decoration: none;
}

.detail-attachments a:hover {
  text-decoration: underline;
}

.detail-attachments .audio-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 40px;
  padding-top: 28px;
  border-top: 1px solid var(--border-light);
}

.detail-tags .tag {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  cursor: default;
}

.detail-tags .tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.tag-default { background: var(--border-color); color: var(--text-secondary); }
.tag-green { background: #dcfce7; color: #166534; }
.tag-blue { background: #dbeafe; color: #1e40af; }
.tag-cyan { background: #cffafe; color: #155e75; }
.tag-amber { background: #fef3c7; color: #92400e; }
.tag-teal { background: #ccfbf1; color: #115e59; }
.tag-purple { background: #ede9fe; color: #5b21b6; }
.tag-sky { background: #e0f2fe; color: #075985; }
.tag-pink { background: #fce7f3; color: #9d174d; }
.tag-orange { background: #ffedd5; color: #9a3412; }
.tag-rose { background: #ffe4e6; color: #9f1239; }
.tag-indigo { background: #e0e7ff; color: #3730a3; }
.tag-slate { background: #e2e8f0; color: #334155; }

.detail-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--border-light);
}

.btn-useful {
  padding: 10px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
}

.btn-useful:hover {
  background: #5a6fd6;
}

@media (min-width: 768px) {
  .viewer-panel {
    padding: 24px;
  }

  .note-grid {
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 24px;
  }

  .detail-header {
    padding-top: 32px;
    padding-left: 24px;
    padding-right: 24px;
  }

  .modal-detail {
    padding: 0 24px 40px;
    width: 100%;
    max-width: 100%;
  }

  .modal-back {
    top: 24px;
    left: 24px;
  }

  .back-icon {
    width: 32px;
    height: 32px;
  }
}

.scroll-rail {
  position: fixed;
  right: 10px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-light);
  opacity: .6;
  z-index: 900;
  pointer-events: none;
}
.scroll-knob {
  position: absolute;
  left: 50%;
  top: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--accent-color);
  box-shadow: 0 0 10px var(--accent-color), 0 0 18px var(--gold-soft);
  transition: top .1s linear;
}
.scroll-knob.burst {
  animation: starburst .9s var(--ease-out-quint) forwards;
}
@keyframes starburst {
  0%   { box-shadow: 0 0 10px var(--accent-color); }
  60%  { box-shadow: 0 0 0 14px transparent, 0 0 24px 6px var(--gold); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2); }
}

@media (prefers-reduced-motion: reduce) {
  .stat-mini:nth-child(-n+3) .stat-val,
  .search-field:hover::after,
  .search-field:focus-within::after,
  .scroll-knob.burst,
  .ticker-track {
    animation: none !important;
  }
  .note-card,
  .filter-cs,
  .view-link,
  .scroll-knob,
  .skeleton-card::before {
    transition: none !important;
    animation: none !important;
  }
}

@media (max-width: 767px) {
  .viewer-panel {
    padding: 16px 14px;
  }

  .search-input {
    padding: 14px 18px;
    font-size: 15px;
  }

  .stats-bar {
    gap: 6px;
    margin-bottom: 12px;
  }

  .stat-mini .stat-val {
    font-size: 13px;
  }

  .stat-icon-btn {
    padding: 3px 8px;
    font-size: 11px;
  }

  .header-ticker {
    height: 22px;
    margin: 0 8px;
  }

  .ticker-content {
    font-size: 12px;
  }

  .filter-row {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 4px;
    margin-left: -14px;
    margin-right: -14px;
    padding-left: 14px;
    padding-right: 14px;
  }

  .filter-row::-webkit-scrollbar {
    display: none;
  }

  .note-grid {
    gap: 14px;
  }

  .note-card {
    border-radius: 14px;
  }

  .note-card::before {
    top: 12px;
    bottom: 12px;
    width: 3px;
  }

  .card-title {
    font-size: 17px;
    margin: 12px 14px 6px 18px;
  }

  .card-summary {
    font-size: 13px;
    margin: 0 14px 12px 18px;
  }

  .card-footer {
    padding: 10px 14px 10px 18px;
  }

  .exam-dashboard {
    grid-template-columns: 1fr;
  }

  /* ===== 移动端详情弹窗修复 ===== */
  .modal-detail {
    padding: 0 12px 30px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    height: 100vh;
    width: 100%;
    box-sizing: border-box;
  }

  /* 移动端返回按钮 - 纯SVG，无背景无圆角 */
  .modal-back {
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 1200;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    height: auto;
    border: none;
    background: transparent !important;
    box-shadow: none !important;
    cursor: pointer;
    padding: 0;
    transition: transform 0.2s ease, opacity 0.2s ease;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .modal-back:hover {
    opacity: 0.7;
    transform: translateX(-4px);
  }

  .modal-back:active {
    transform: scale(0.92);
  }

  .back-icon {
    width: 28px;
    height: 28px;
  }

  /* 详情内容顶部留出返回按钮空间 */
  .detail-header {
    padding-top: 50px;
    padding-left: 8px;
    padding-right: 8px;
  }

  .detail-title {
    font-size: 24px;
  }

  .detail-keypoints {
    padding: 14px 16px;
    margin: 20px 0 16px;
  }

  .detail-keypoints li {
    font-size: 14px;
    line-height: 1.6;
    padding-left: 18px;
    margin-bottom: 8px;
  }

  .detail-keypoints li::before {
    font-size: 10px;
  }

  .detail-scenario {
    padding: 12px 14px;
  }

  .detail-scenario p {
    font-size: 14px;
    line-height: 1.6;
  }

  .case-content {
    padding: 10px 12px;
    font-size: 16px;
    line-height: 1.7;
  }

  .case-content :deep(h1) {
    font-size: 21px;
    margin: 12px 0 6px;
  }

  .case-content :deep(h2) {
    font-size: 19px;
    margin: 12px 0 6px;
  }

  .case-content :deep(h3) {
    font-size: 18px;
    margin: 10px 0 4px;
  }

  .case-content :deep(table) {
    table-layout: auto;
  }

  .case-content :deep(th),
  .case-content :deep(td) {
    padding: 8px 10px;
    font-size: 16px;
    line-height: 1.5;
    text-align: center;
    vertical-align: middle;
  }

  .case-content :deep(td:first-child),
  .case-content :deep(th:first-child) {
    white-space: normal;
    min-width: 0;
  }

  .case-content :deep(td:last-child),
  .case-content :deep(th:last-child) {
    white-space: normal;
    min-width: 0;
  }

  .detail-content :deep(h2) {
    font-size: 20px;
    margin: 28px 0 12px;
  }

  .detail-content :deep(h3) {
    font-size: 17px;
    margin: 20px 0 10px;
  }

  .detail-content :deep(table),
  .case-content :deep(table),
  .comparison-box table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    white-space: nowrap;
    max-width: 100%;
  }

  .detail-content :deep(th),
  .detail-content :deep(td),
  .case-content :deep(th),
  .case-content :deep(td),
  .comparison-box th,
  .comparison-box td {
    white-space: normal;
    min-width: 80px;
    max-width: 200px;
    word-break: break-word;
  }

  .skeleton-grid {
    gap: 14px;
  }

  .skeleton-card {
    padding: 14px;
  }

  /* 确保所有内容块正常显示 */
  .detail-keypoints,
  .detail-scenario,
  .detail-content,
  .detail-case,
  .detail-exam,
  .detail-attachments,
  .detail-tags,
  .detail-actions,
  .detail-progress {
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
  }

  /* 评论组件容器确保可见 */
  .detail-actions + * {
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
    margin-top: 16px;
  }

  /* 修复掌握度滑块：手机端缩短至一半 */
  .detail-score-slider input[type="range"] {
    width: 50%;
    max-width: 50%;
    min-width: 80px;
  }

  /* 修复底部边距，确保评论可见 */
  .modal-detail > *:last-child {
    margin-bottom: 40px;
  }
}

/* 修复 iOS Safari 安全区域 */
@supports (padding: max(0px)) {
  .modal-detail {
    padding-left: max(12px, env(safe-area-inset-left));
    padding-right: max(12px, env(safe-area-inset-right));
    padding-bottom: max(30px, env(safe-area-inset-bottom));
  }

  @media (max-width: 767px) {
    .modal-back {
      top: max(12px, env(safe-area-inset-top));
      left: max(12px, env(safe-area-inset-left));
    }
  }
}

/* 小屏手机（< 380px） */
@media (max-width: 380px) {
  .detail-header {
    padding-top: 44px;
    padding-left: 4px;
    padding-right: 4px;
  }

  .detail-title {
    font-size: 20px;
  }

  .detail-keypoints {
    padding: 10px 12px;
    margin: 12px 0 12px;
  }

  .detail-keypoints li {
    font-size: 13px;
    padding-left: 16px;
  }

  .modal-back {
    top: 8px;
    left: 8px;
  }

  .back-icon {
    width: 24px;
    height: 24px;
  }
}

/* 修复弹窗打开时 body 滚动锁定 */
body:has(.modal-overlay) {
  overflow: hidden !important;
  position: fixed;
  width: 100%;
  height: 100%;
}

/* ===== 墨渍涟漪效果 ===== */
.ink-ripple {
  position: absolute;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0);
  background: radial-gradient(circle,
              rgba(102,126,234,.45) 0%,
              rgba(251,191,36,.35) 60%,
              transparent 70%);
  animation: ink-spread .7s cubic-bezier(.22,1,.36,1) forwards;
  z-index: 5;
}
@keyframes ink-spread {
  to { transform: translate(-50%, -50%) scale(14); opacity: 0; }
}

[data-theme="dark"] .detail-keypoints {
  background: rgba(102, 126, 234, 0.12);
  border-left-color: #818cf8;
}

[data-theme="dark"] .detail-keypoints h4 {
  color: #c7d2fe;
}

[data-theme="dark"] .detail-keypoints li {
  color: #c0c0d0;
}

[data-theme="dark"] .detail-keypoints li::before {
  color: #818cf8;
}

[data-theme="dark"] .detail-scenario {
  background: rgba(245, 158, 11, 0.12);
  border-color: #92400e;
}

[data-theme="dark"] .detail-scenario h4 {
  color: #fbbf24;
}

[data-theme="dark"] .detail-scenario p {
  color: #d4c5a0;
}
</style>