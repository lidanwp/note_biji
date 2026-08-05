<template>
  <div class="viewer-panel">
    <!-- ===== 头部 ===== -->
    <header>
      <div class="header-left">
        <span class="app-logo">📖</span>
        <span class="app-name">知识分享</span>
      </div>
      <div class="header-right" ref="userMenuRef">
        <button @click="toggleUserMenu" class="user-btn" ref="userBtnRef">
          <span class="user-avatar">👤</span>
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
      <span class="stat-badge">
        <span class="badge-icon">📝</span>
        <span class="badge-num">{{ notesStore.notes.length }}</span>
        <span class="badge-label">笔记</span>
      </span>
      <span class="stat-badge">
        <span class="badge-icon">👁️</span>
        <span class="badge-num">{{ totalViews }}</span>
        <span class="badge-label">浏览</span>
      </span>
      <span class="stat-badge">
        <span class="badge-icon">📄</span>
        <span class="badge-num">{{ formatNum(totalCharacters) }}</span>
        <span class="badge-label">字数</span>
      </span>
       <button 
        @click="showHistoryPanel = !showHistoryPanel" 
        class="stat-badge history-toggle"
        :class="{ active: showHistoryPanel }"
      >
        <span class="badge-icon">📜</span>
        <span class="badge-num">{{ historyStore.history.length }}</span>
        <span class="badge-label">历史</span>
      </button>
       <button 
        @click="showSettings = !showSettings" 
        class="stat-badge settings-toggle"
        :class="{ active: showSettings }"
      >
        <span class="badge-icon">⚙️</span>
        <span class="badge-label">设置</span>
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
        <CustomSelect v-model="notesStore.categoryFilter" :options="categoryFilterOptions" placeholder="📂 过程组" class="filter-cs" :class="{ 'is-active': notesStore.categoryFilter }" />
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
        <h4>📊 过程组分布</h4>
        <div v-for="(count, group) in processGroupStats" :key="group" class="progress-bar">
          <span>{{ group }}</span>
          <div class="bar"><div :style="{ width: count + '%' }"></div></div>
          <span class="bar-label">{{ count }}%</span>
        </div>
      </div>
    </div>

    <!-- ===== 笔记列表 ===== -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
    <div class="note-grid" v-show="!isLoading">
      <div
        v-for="note in paginatedNotes"
        :key="note.id"
        class="note-card"
        @click="viewDetail(note)"
      >
        <!-- 中间：标题 + 内容摘要 -->
        <h3 class="card-title">{{ note.title }}</h3>
        <p class="card-summary">
          {{ contentSummary(note.content) }}
        </p>

        <!-- 底部：分类（左）+ 日期 + 查看全文（右） -->
        <div class="card-footer">
          <span class="category-tag">{{ note.category || '未分类' }}</span>
          <div class="card-footer-right">
            <span class="card-date">📅 {{ note.date }}</span>
            <span class="view-link">查看全文 →</span>
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
          <div v-if="note.examScore != null" class="mastery-bar">
            <span>掌握度</span>
            <div class="bar"><div :style="{ width: note.examScore + '%' }"></div></div>
            <span class="score">{{ note.examScore }}%</span>
          </div>
        </div>
      </div>

      <div v-if="paginatedNotes.length === 0 && !isLoading" class="empty">
        <div class="empty-icon">📭</div>
        <p>暂无匹配的笔记</p>
        <span class="empty-hint">试试调整筛选条件</span>
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

    <!-- ===== 笔记详情弹窗 - 全屏铺开 ===== -->
    <div v-if="selectedNote" class="modal-overlay" @click="closeDetail">
      <div 
        class="modal-detail" 
        @click.stop
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        :style="{ transform: slideX !== 0 ? `translateX(${slideX}px)` : 'none', transition: isSliding ? 'none' : 'transform 0.3s ease' }"
      >
        <div class="detail-header">
          <button class="modal-back" @click="closeDetail">
            <svg viewBox="0 0 24 24" class="back-icon" aria-label="返回">
              <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
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
        
        <div class="detail-content markdown-body" v-html="renderMarkdown(selectedNote.content)"></div>
        
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
        
        <div v-if="selectedNote.examScore != null" class="detail-progress">
          <span class="progress-label">掌握度</span>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: (selectedNote.examScore || 0) + '%' }"></div>
          </div>
          <span class="progress-percent">{{ selectedNote.examScore || 0 }}%</span>
        </div>
        
        <div class="detail-actions">
          <button @click="markUseful(selectedNote)" class="btn-useful">
            👍 有用 ({{ selectedNote.usefulCount || 0 }})
          </button>
        </div>
        
        <CommentSection :noteId="String(selectedNote.id)" />
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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

// ===== 动效交互（鼠标光晕/3D倾斜 + 墨渍涟漪 + 滚动进度光带） =====
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
    // 用无单位 0-100，便于 tilt 计算；光晕位置用 calc(* 1%) 还原
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
  // 筛选标签点击 → 墨渍涟漪
  const fc = e.target.closest('.filter-cs')
  if (fc) { spawnInkRipple(e, fc); return }
  // 笔记卡片点击 → 彩色波纹（作为“查看全文”打开反馈）
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

// 滑动返回相关
const startX = ref(0)
const startY = ref(0)
const slideX = ref(0)
const isSliding = ref(false)

// ===== 下拉选项数据 =====
const categoryFilterOptions = computed(() => [
  { value: '', label: '📂 全部分类' },
  ...categories.value.map(c => ({ value: c, label: c }))
])

// 项目管理知识领域（概论、立项 + PMBOK 十大）
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

// 标签按知识领域分配颜色
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
const categories = computed(() => notesStore.categories)
const totalViews = computed(() => notesStore.totalViews)
const totalCharacters = computed(() => notesStore.totalCharacters)

// 数字格式化：超 1 万显示为 X.XW，超 1 千显示为 X.XK
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

const processGroupStats = computed(() => {
  const map = {}
  const groups = ['启动', '规划', '执行', '监控', '收尾']
  notesStore.notes.forEach(n => {
    const found = groups.find(g => n.category?.includes(g))
    if (found) map[found] = (map[found] || 0) + 1
  })
  const total = notesStore.notes.length || 1
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, Math.round(v / total * 100)])
  )
})

// ===== 方法 =====
const stripHtml = (content) => {
  if (!content) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = content
  return tmp.textContent || tmp.innerText || ''
}

const contentSummary = (content) => {
  const text = stripHtml(content)
  if (!text) return '暂无内容'
  return text.length > 100 ? text.slice(0, 100) + '...' : text
}

const renderMarkdown = (content) => {
  if (!content) return '<p>暂无内容</p>'
  try {
    if (content.includes('<p>') || content.includes('<div>') || content.includes('<h')) {
      return content
    }
    return md.render(content)
  } catch (e) {
    return content
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
  // 检查是否点击在触发器按钮上
  if (userBtnRef.value && userBtnRef.value.contains(e.target)) return
  // 检查是否点击在下拉菜单上（通过 Teleport 渲染到 body）
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

const viewDetail = (note) => {
  notesStore.incrementViewCount(note.id)
  selectedNote.value = notesStore.getNoteById(note.id) || note
  historyStore.addHistory(note)
  document.body.style.overflow = 'hidden'
}

const closeDetail = () => {
  selectedNote.value = null
  document.body.style.overflow = ''
  // 重置滑动状态
  slideX.value = 0
  isSliding.value = false
}

// 滑动返回处理
const handleTouchStart = (e) => {
  startX.value = e.touches[0].clientX
  startY.value = e.touches[0].clientY
  isSliding.value = false
}

const handleTouchMove = (e) => {
  const currentX = e.touches[0].clientX
  const currentY = e.touches[0].clientY
  const diffX = currentX - startX.value
  const diffY = currentY - startY.value
  
  // 只有从左侧边缘开始滑动才生效，且主要是水平滑动
  if (startX.value < 50 && diffX > 0 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
    isSliding.value = true
    // 限制最大滑动距离，添加阻尼效果
    slideX.value = Math.min(diffX * 0.5, window.innerWidth * 0.6)
  }
}

const handleTouchEnd = () => {
  if (!isSliding.value) return
  
  // 判断是否超过阈值（屏幕宽度的30%）
  if (slideX.value > window.innerWidth * 0.3) {
    closeDetail()
  } else {
    // 回弹
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

onMounted(async () => {
  if (authStore.user?.role !== 'viewer') {
    router.push('/admin')
    return
  }
  await loadNotes()
  
  const noteId = route.query.noteId
  if (noteId) {
    setTimeout(() => {
      openNoteById(noteId)
      router.replace({ query: {} })
    }, 100)
  }
  
  document.addEventListener('click', handleClickOutside)

  // 动效交互绑定（事件委托，避免逐卡片绑监听）
  const grid = document.querySelector('.note-grid')
  if (grid) {
    grid.addEventListener('mousemove', handleGridMouseMove)
    grid.addEventListener('mouseleave', handleGridMouseLeave)
  }
  document.addEventListener('click', handleListClickRipple)
  window.addEventListener('scroll', handleScroll, { passive: true })
  // 滚动时更新下拉菜单位置
  window.addEventListener('scroll', () => {
    if (showUserMenu.value) updateUserMenuPosition()
  }, { passive: true })
  window.addEventListener('resize', () => {
    if (showUserMenu.value) updateUserMenuPosition()
  })
  handleScroll() // 初始定位
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
  document.body.style.overflow = ''
})
</script>

<style scoped>
.viewer-panel {
  background: var(--bg-primary);
  padding: 16px;
}
/* 设置与历史按钮统一样式 */
.settings-toggle,
.history-toggle {
  cursor: pointer;
  background: var(--bg-secondary);
  border: none;
  transition: all 0.2s;
  padding: 6px 14px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.settings-toggle:hover,
.history-toggle:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.settings-toggle.active,
.history-toggle.active {
  background: #667eea;
  color: white;
}

.settings-toggle.active .badge-label,
.history-toggle.active .badge-label {
  color: rgba(255,255,255,0.8);
}

.history-toggle.active .badge-num {
  color: white;
}

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
  /* 高于筛选区 .filter-wrap(200)/.filter-cs(210)，保证 sticky header 始终在筛选项之上 */
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
  font-size: 20px;
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
  font-size: 16px;
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

/* ===== 统计徽章行 ===== */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-secondary);
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

/* 前 3 个数据徽章（笔记/浏览/字数）：心跳式呼吸脉动，错峰 */
.stat-badge:nth-child(-n+3) {
  animation: badge-breathe 3.2s var(--ease-in-out-soft) infinite;
}
.stat-badge:nth-child(2) { animation-delay: .4s; }
.stat-badge:nth-child(3) { animation-delay: .8s; }
@keyframes badge-breathe {
  0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 var(--ink-violet); }
  50%      { transform: scale(1.025); box-shadow: 0 0 0 6px transparent; }
}

.badge-icon {
  font-size: 14px;
}

.badge-num {
  font-size: 15px;
  font-weight: 700;
  color: #667eea;
}

.badge-label {
  font-size: 12px;
  color: var(--text-muted);
}

/* ===== 搜索 + 筛选 ===== */
.filter-wrap {
  margin-bottom: 16px;
  position: relative;
  z-index: 200;
}

/* 搜索框容器：承载底部极光光条（input 无 ::after，故包一层） */
.search-field {
  position: relative;
  margin-bottom: 8px;
}
.search-field::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: var(--aurora-grad);
  background-size: 200% 100%;
  background-position: 100% 0;
  opacity: 0;
  transition: opacity .35s var(--ease-soft);
  border-radius: 0 0 10px 10px;
  pointer-events: none;
}
/* 靠近即探索：hover 扫一次 */
.search-field:hover::after {
  opacity: .9;
  animation: aurora-sweep 1.4s var(--ease-out-quint) forwards;
}
/* 聚焦：常驻低亮度流动 */
.search-field:focus-within::after {
  opacity: .55;
  animation: aurora-flow 2.8s linear infinite;
}
@keyframes aurora-sweep {
  from { background-position: 100% 0; }
  to   { background-position: -100% 0; }
}
@keyframes aurora-flow {
  from { background-position: 0% 0; }
  to   { background-position: -200% 0; }
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid var(--border-color);
  border-radius: 10px;
  font-size: 14px;
  box-sizing: border-box;
  transition: border-color 0.2s;
  background: var(--bg-input);
  color: var(--text-primary);
}

.search-input:focus {
  border-color: #667eea;
  outline: none;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-row .filter-cs {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 210;
  /* 与 .cs-trigger 的 border-radius 对齐，让 :hover / .is-active 的 box-shadow 跟随圆角 */
  border-radius: 10px;
  transition: transform .3s var(--ease-out-quint),
              box-shadow .3s var(--ease-soft),
              margin-left .3s var(--ease-soft);
}

/* 悬停：上浮放大 + 兄弟间微微拉开 */
.filter-row:hover .filter-cs { margin-left: 4px; }
.filter-row .filter-cs:first-child { margin-left: 0; }
.filter-cs:hover {
  transform: translateY(-3px) scale(1.04);
  box-shadow: 0 6px 18px var(--ink-violet);
}

/* 选中态：发光胶囊高亮 */
.filter-cs.is-active {
  box-shadow: 0 0 0 2px var(--accent-color),
              0 0 16px var(--ink-violet);
}

/* 考试模式切换 */
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
  gap: 20px;
}

.note-card {
  background: var(--bg-secondary);
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: box-shadow .35s var(--ease-soft),
              transform .25s var(--ease-out-quint);
  overflow: hidden;
  cursor: pointer;
  position: relative;
  --mx: 50;
  --my: 50;
}

/* 鼠标光晕：跟随鼠标的柔和径向光 */
.note-card::before {
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

/* 悬停：朝鼠标方向 3D 倾斜（纸张被提起一角）+ 上浮 */
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

/* 卡片顶部：进度 */
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

/* 卡片中间：标题 + 摘要 */
.card-title {
  margin: 10px 16px 6px;
  color: var(--text-primary);
  font-size: 17px;
  font-weight: 600;
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
  margin: 0 16px 12px;
}

/* 卡片底部 */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.category-tag {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--border-color);
  padding: 4px 12px;
  border-radius: 12px;
}

.card-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-date {
  font-size: 12px;
  color: var(--text-muted);
}

.view-link {
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
}

/* 查看全文：悬停 ≥0.5s 渐显 + 帷幕细线从中间向两端展开（仅悬停设备） */
@media (hover: hover) {
  .view-link {
    position: relative;
    opacity: 0;
    transform: translateX(-6px);
    transition: opacity .4s var(--ease-soft) .5s,
                transform .4s var(--ease-out-quint) .5s;
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
  .note-card:hover .view-link {
    opacity: 1;
    transform: translateX(0);
  }
  .note-card:hover .view-link::before,
  .note-card:hover .view-link::after { width: 22px; }
}

/* ===== 考试模式附加详情 ===== */
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

/* ===== 空状态 ===== */
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

.loading-overlay {
  grid-column: 1/-1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 12px;
  color: #667eea;
}

.loading-overlay .loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(102, 126, 234, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-hint {
  color: var(--text-light);
  font-size: 14px;
}

/* ================================================================
   ===== 详情弹窗 - 全屏铺开版（核心修改） =====
   ================================================================ */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-secondary);
  z-index: 1000;
  padding: 0;
  display: block;
  overflow: hidden;
}

/* 整体容器：电脑端直接占满全屏，背景用次要色 */
.modal-detail {
  position: relative;
  background: var(--bg-secondary);
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  padding: 20px 24px 32px;
  border-radius: 0;
  box-shadow: none;
  box-sizing: border-box;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.modal-back {
  position: fixed;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  width: 48px;
  height: 48px;
  padding: 0;
  background: transparent;
  border-radius: 8px;
  transition: all 0.15s ease;
  z-index: 1100;
}

.modal-back:hover,
.modal-back:active {
  color: #6366f1;
  transform: translateX(-2px);
}

.back-icon {
  width: 32px;
  height: 32px;
}

/* 详情内容样式 */
.detail-header {
  margin-bottom: 24px;
}

/* 顶部元信息：分类胶囊 + 时间戳，flex 同行，下方分割线 */
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

/* 标题：32px / 700，底部留白 8px */
.detail-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-primary);
}

/* 掌握度进度条：6px 高，靛蓝→紫渐变，右侧百分比 */
.detail-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}

.progress-label {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.progress-track {
  flex: 1;
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-percent {
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
  white-space: nowrap;
}

.detail-case,
.detail-attachments,
.detail-exam {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.detail-case h4,
.detail-attachments h4,
.detail-exam h4 {
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

/* 核心要点：浅灰蓝卡片 + 左侧 4px 紫色竖条 + 菱形符号 */
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

/* 适用场景：浅黄卡片 + 黄边 + 深褐字 */
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

/* 正文区域：16px / 行高 1.9 / 段落间距 18px */
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

/* 二级标题：22px，底部 2px 浅灰分割线，上下 40/16 */
.detail-content :deep(h2) {
  font-size: 22px;
  margin: 40px 0 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--border-light);
  color: var(--text-primary);
  font-weight: 600;
}

/* 三级标题：18px，上下 28/12 */
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

/* 表格：宽度 100%，首列自然宽度不堆叠 */
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

/* 标签区域：底部，分割线隔开，胶囊样式 + 知识领域配色 + 悬停上浮 */
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

/* 知识领域配色 */
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

/* ===== 响应式 ===== */
@media (min-width: 768px) {
  .viewer-panel {
    padding: 24px;
  }

  .note-grid {
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 24px;
  }
}

/* ===== 右侧滚动进度光带 ===== */
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

/* ===== 无障碍：尊重「减少动态」偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .stat-badge:nth-child(-n+3),
  .search-field:hover::after,
  .search-field:focus-within::after,
  .scroll-knob.burst {
    animation: none !important;
  }
  .note-card,
  .filter-cs,
  .view-link,
  .scroll-knob {
    transition: none !important;
  }
}

/* 手机端：内容宽度自适应，阅读区内边距缩小 */
@media (max-width: 767px) {
  .viewer-panel {
    padding: 12px;
  }

  .exam-dashboard {
    grid-template-columns: 1fr;
  }

  .modal-detail {
    padding: 12px 12px 30px;
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

  .detail-case,
  .detail-attachments,
  .detail-exam {
    padding: 12px 14px;
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
}
</style>

<style>
/* ===== 墨渍涟漪（JS 动态创建，需放在非 scoped 块） ===== */
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

/* ===== 暗色模式：核心要点 & 适用场景卡片 ===== */
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