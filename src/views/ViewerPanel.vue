<template>
  <div class="viewer-panel">
    <!-- ===== 头部 ===== -->
    <header>
      <div class="header-left">
        <span class="app-logo">📖</span>
        <span class="app-name">知识分享</span>
      </div>
      <div class="header-right" ref="userMenuRef">
        <button @click="toggleUserMenu" class="user-btn">
          <span class="user-avatar">👤</span>
          <span class="user-name">{{ authStore.user?.username }}</span>
          <span class="menu-arrow">{{ showUserMenu ? '▲' : '▼' }}</span>
        </button>
        <Transition name="menu-fade">
          <div v-if="showUserMenu" class="dropdown-menu">
            <button @click="logout" class="dropdown-item danger">
              <span class="item-icon">🚪</span>
              <span>退出登录</span>
            </button>
          </div>
        </Transition>
      </div>
    </header>

    <!-- ===== 统计徽章 ===== -->
    <div class="stats-bar">
      <span class="stat-badge">
        <span class="badge-icon">📝</span>
        <span class="badge-num">{{ notes.length }}</span>
        <span class="badge-label">笔记</span>
      </span>
      <span class="stat-badge">
        <span class="badge-icon">📂</span>
        <span class="badge-num">{{ categories.length }}</span>
        <span class="badge-label">分类</span>
      </span>
      <span class="stat-badge">
        <span class="badge-icon">👁️</span>
        <span class="badge-num">{{ totalViews }}</span>
        <span class="badge-label">浏览</span>
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
      <input
        type="text"
        v-model="search"
        placeholder="🔍 搜索标题、内容、标签..."
        class="search-input"
      />
      <div class="filter-row">
        <CustomSelect v-model="categoryFilter" :options="categoryFilterOptions" placeholder="📂 全部分类" class="filter-cs" />
        <CustomSelect v-model="difficultyFilter" :options="difficultyFilterOptions" placeholder="📊 全部难度" class="filter-cs" />
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
    <div class="note-grid">
      <div
        v-for="note in filteredNotes"
        :key="note.id"
        class="note-card"
        @click="viewDetail(note)"
      >
        <!-- 顶部：难度（左）+ 进度（右） -->
        <div class="card-header-row">
          <div class="card-header-left">
            <span v-if="note.difficulty" class="difficulty-badge" :class="note.difficulty">
              {{ note.difficulty }}
            </span>
          </div>
          <div class="card-header-right">
            <span v-if="note.examScore != null" class="progress-badge">
              📊 {{ note.examScore }}%
            </span>
          </div>
        </div>

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

      <div v-if="filteredNotes.length === 0" class="empty">
        <div class="empty-icon">📭</div>
        <p>暂无匹配的笔记</p>
        <span class="empty-hint">试试调整筛选条件</span>
      </div>
    </div>

    <!-- ===== 笔记详情弹窗 - 全屏铺开 ===== -->
    <div v-if="selectedNote" class="modal-overlay" @click="closeDetail">
      <div class="modal-detail" @click.stop>
        <!-- 关闭按钮 - 固定在顶部 -->
        <button class="modal-close" @click="closeDetail">✕ 关闭</button>
        
        <div class="detail-header">
          <span class="detail-category">{{ selectedNote.category }}</span>
          <h2>{{ selectedNote.title }}</h2>
          <div class="detail-meta">
            <span>📅 {{ selectedNote.date }}</span>
            <span>👁️ {{ selectedNote.viewCount || 0 }}次浏览</span>
            <span v-if="selectedNote.examScore != null" class="meta-score">🎯 掌握度 {{ selectedNote.examScore }}%</span>
          </div>
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
          <div class="case-content">{{ selectedNote.caseStudy }}</div>
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
          <h4>📎 附件资源</h4>
          <ul>
            <li v-for="file in selectedNote.attachments" :key="file"><a href="#">{{ file }}</a></li>
          </ul>
        </div>
        
        <div v-if="selectedNote.tags?.length" class="detail-tags">
          <span v-for="tag in selectedNote.tags" :key="tag" class="tag">#{{ tag }}</span>
        </div>
        
        <div class="detail-actions">
          <button @click="markUseful(selectedNote)" class="btn-useful">
            👍 有用 ({{ selectedNote.usefulCount || 0 }})
          </button>
        </div>
        
        <CommentSection :noteId="String(selectedNote.id)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import SettingsPanel from '@/components/SettingsPanel.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import MarkdownIt from 'markdown-it'
import { loadNotesFromCloud, updateViewCount, updateUsefulCount } from '../services/supabase'
import CustomSelect from '../components/CustomSelect.vue'
import { migrateNote } from '../utils/noteMigrate'
import { useHistoryStore } from '@/stores/history'
import HistoryPanel from '@/components/HistoryPanel.vue'
import CommentSection from '../components/CommentSection.vue'

const showSettings = ref(false)
const showHistoryPanel = ref(false)
const router = useRouter()
const authStore = useAuthStore()
const historyStore = useHistoryStore()

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
})

// ===== 数据 =====
const notes = ref([])
const search = ref('')
const categoryFilter = ref('')
const difficultyFilter = ref('')
const selectedNote = ref(null)
const examMode = ref(false)
const showUserMenu = ref(false)
const userMenuRef = ref(null)

// ===== 下拉选项数据 =====
const categoryFilterOptions = computed(() => [
  { value: '', label: '📂 全部分类' },
  ...categories.value.map(c => ({ value: c, label: c }))
])

const difficultyFilterOptions = [
  { value: '', label: '📊 全部难度' },
  { value: '初级', label: '🌱 初级' },
  { value: '中级', label: '🔥 中级' },
  { value: '高级', label: '🚀 高级' },
]

// ===== 计算属性 =====
const categories = computed(() => {
  const cats = new Set(notes.value.map(n => n.category).filter(Boolean))
  return [...cats]
})

const totalViews = computed(() => {
  return notes.value.reduce((sum, n) => sum + (n.viewCount || 0), 0)
})

const filteredNotes = computed(() => {
  return notes.value.filter(n => {
    const matchSearch = !search.value ||
      n.title?.toLowerCase().includes(search.value.toLowerCase()) ||
      n.content?.toLowerCase().includes(search.value.toLowerCase()) ||
      n.tags?.some(t => t.toLowerCase().includes(search.value.toLowerCase()))

    const matchCategory = !categoryFilter.value || n.category === categoryFilter.value
    const matchDifficulty = !difficultyFilter.value || n.difficulty === difficultyFilter.value

    return matchSearch && matchCategory && matchDifficulty
  })
})

const hotTopics = computed(() => {
  const map = {}
  notes.value.forEach(n => {
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
  notes.value.forEach(n => {
    const found = groups.find(g => n.category?.includes(g))
    if (found) map[found] = (map[found] || 0) + 1
  })
  const total = notes.value.length || 1
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

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

const handleClickOutside = (e) => {
  if (userMenuRef.value && !userMenuRef.value.contains(e.target)) {
    showUserMenu.value = false
  }
}

const loadNotes = async () => {
  try {
    const cloudData = await loadNotesFromCloud()
    notes.value = cloudData.map(migrateNote)
  } catch (e) {
    console.error('❌ 云端加载失败:', e.message)
    notes.value = []
  }
}

const viewDetail = async (note) => {
  const newViewCount = (note.viewCount || 0) + 1
  note.viewCount = newViewCount
  selectedNote.value = note
  historyStore.addHistory(note)
  // 阻止页面滚动穿透
  document.body.style.overflow = 'hidden'
  try {
    await updateViewCount(note.id, newViewCount)
  } catch (e) {
    console.error('❌ 更新浏览量失败:', e.message)
  }
}

const closeDetail = () => {
  selectedNote.value = null
  // 恢复页面滚动
  document.body.style.overflow = ''
}

const markUseful = async (note) => {
  const newUsefulCount = (note.usefulCount || 0) + 1
  note.usefulCount = newUsefulCount
  selectedNote.value = { ...note }
  try {
    await updateUsefulCount(note.id, newUsefulCount)
  } catch (e) {
    console.error('❌ 更新有用数失败:', e.message)
  }
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
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  // 组件卸载时恢复滚动
  document.body.style.overflow = ''
})
</script>

<style scoped>
.viewer-panel {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 16px;
}
.settings-toggle {
  cursor: pointer;
  background: white;
  border: none;
  transition: all 0.2s;
  padding: 6px 14px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.settings-toggle:hover {
  background: #f0f2ff;
  transform: translateY(-1px);
}

.settings-toggle.active {
  background: #667eea;
  color: white;
}

.settings-toggle.active .badge-label {
  color: rgba(255,255,255,0.8);
}

/* ===== 头部 ===== */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 12px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.history-toggle {
  cursor: pointer;
  background: white;
  border: none;
  transition: all 0.2s;
}

.history-toggle:hover {
  background: #f0f2ff;
  transform: translateY(-1px);
}

.history-toggle.active {
  background: #667eea;
  color: white;
}

.history-toggle.active .badge-num {
  color: white;
}

.history-toggle.active .badge-label {
  color: rgba(255,255,255,0.8);
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
  color: #333;
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
  color: #555;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-btn:hover {
  background: #f5f7fa;
}

.user-avatar {
  font-size: 16px;
}

.user-name {
  font-weight: 500;
}

.menu-arrow {
  font-size: 10px;
  color: #999;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: white;
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
  color: #333;
  text-align: left;
  transition: background 0.2s;
}

.dropdown-item:hover {
  background: #f5f7fa;
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
  background: white;
  padding: 6px 14px;
  border-radius: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
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
  color: #999;
}

/* ===== 搜索 + 筛选 ===== */
.filter-wrap {
  margin-bottom: 16px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid #e8ecf1;
  border-radius: 10px;
  font-size: 14px;
  box-sizing: border-box;
  margin-bottom: 8px;
  transition: border-color 0.2s;
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
}

/* 考试模式切换 */
.exam-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 10px 4px 4px;
  background: #f0f2ff;
  border-radius: 24px;
  border: 2px solid #e0e0e0;
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
  color: #555;
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
  background: white;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.dashboard-card h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
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
  border-bottom: 1px solid #f5f7fa;
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
  background: #eee;
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
  color: #999;
  min-width: 32px;
}

/* ===== 笔记卡片网格 ===== */
.note-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}

.note-card {
  background: white;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: all 0.25s ease;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.note-card:active {
  transform: scale(0.98);
}

/* 卡片顶部：难度 + 进度 */
.card-header-row {
  display: flex;
  justify-content: space-between;
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
  color: #333;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
}

.card-summary {
  color: #666;
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
  border-top: 1px solid #f0f0f0;
  background: #fafbfc;
}

.category-tag {
  font-size: 12px;
  color: #666;
  background: #e8ecf1;
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
  color: #999;
}

.view-link {
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
}

/* ===== 考试模式附加详情 ===== */
.card-exam-details {
  padding: 12px 16px;
  background: #f8f9fc;
  border-top: 1px solid #e8ecf1;
}

.process-label,
.section-label {
  font-weight: 600;
  font-size: 13px;
  color: #555;
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
  color: #555;
}

.exam-section.pitfall ul {
  color: #c0392b;
}

.comparison-box {
  margin-top: 8px;
  background: white;
  border-radius: 6px;
  border-left: 3px solid #667eea;
  padding: 10px 12px;
  overflow-x: auto;
}

.comparison-box h4,
.comparison-box h5 {
  margin: 0 0 6px 0;
  font-size: 14px;
}

.comparison-box table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.comparison-box th,
.comparison-box td {
  padding: 4px 10px;
  border: 1px solid #e8ecf1;
  text-align: left;
}

.comparison-box th {
  background: #f0f2ff;
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
  background: #fffbeb;
  border-radius: 6px;
  padding: 10px 14px;
  border: 1px solid #fde68a;
}

.memory-box .memory-item {
  font-size: 13px;
  color: #92400e;
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
  color: #999;
  font-size: 18px;
  margin: 12px 0;
}

.empty-hint {
  color: #ccc;
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
  background: #f5f7fa;  /* 浅灰背景，和列表页一致 */
  z-index: 1000;
  padding: 0;
  display: block;
  overflow: hidden;
}

.modal-detail {
  background: white;
  padding: 20px 20px 40px;
  border-radius: 0;
  width: 100%;
  height: 100%;
  max-height: 100%;
  max-width: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-sizing: border-box;
}

/* 关闭按钮 - 悬浮固定在顶部 */
.modal-close {
  position: sticky;
  top: 12px;
  float: right;
  background: rgba(102, 126, 234, 0.12);
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  color: #667eea;
  padding: 8px 18px;
  border-radius: 20px;
  z-index: 10;
  margin-bottom: 8px;
  backdrop-filter: blur(4px);
  transition: background 0.2s;
}

.modal-close:hover {
  background: rgba(102, 126, 234, 0.25);
}

/* 详情内容样式 */
.detail-header {
  margin-bottom: 24px;
  padding-top: 4px;
}

.detail-category {
  display: inline-block;
  background: #e8ecf1;
  padding: 2px 16px;
  border-radius: 12px;
  font-size: 13px;
  color: #666;
}

.detail-header h2 {
  margin: 8px 0;
  font-size: 26px;
  color: #333;
}

.detail-meta {
  display: flex;
  gap: 20px;
  font-size: 14px;
  color: #999;
  flex-wrap: wrap;
}

.meta-score {
  color: #667eea;
  font-weight: 500;
}

.detail-keypoints,
.detail-scenario,
.detail-case,
.detail-attachments,
.detail-exam {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #f8f9fc;
  border-radius: 8px;
}

.detail-keypoints h4,
.detail-scenario h4,
.detail-case h4,
.detail-attachments h4,
.detail-exam h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.detail-keypoints ul {
  margin: 0;
  padding-left: 20px;
}

.detail-keypoints li {
  line-height: 1.8;
  color: #555;
}

.detail-exam-item {
  margin-top: 8px;
}

.detail-exam-item .exam-label {
  font-weight: 600;
  font-size: 13px;
  color: #555;
}

.detail-exam-item ul {
  margin: 2px 0 0 0;
  padding-left: 20px;
  font-size: 14px;
  color: #555;
}

.detail-exam-item.pitfall ul {
  color: #c0392b;
}

.detail-content {
  line-height: 1.9;
  color: #444;
  margin-bottom: 24px;
  font-size: 15px;
}

.detail-content :deep(h1) {
  font-size: 26px;
  margin: 20px 0 10px;
}

.detail-content :deep(h2) {
  font-size: 22px;
  margin: 18px 0 8px;
}

.detail-content :deep(h3) {
  font-size: 18px;
  margin: 16px 0 8px;
  color: #333;
}

.detail-content :deep(ul) {
  padding-left: 20px;
}

.detail-content :deep(li) {
  margin-bottom: 6px;
}

.detail-content :deep(pre) {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}

.detail-content :deep(code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.detail-content :deep(blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 16px;
  margin: 8px 0;
  color: #666;
}

.detail-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.detail-content :deep(th),
.detail-content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 6px 12px;
}

.detail-content :deep(th) {
  background: #f0f2ff;
}

.case-content {
  background: white;
  padding: 16px;
  border-radius: 6px;
  color: #555;
  line-height: 1.8;
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

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.detail-tags .tag {
  display: inline-block;
  background: #e8ecf1;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  color: #555;
}

.detail-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #eee;
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

  .modal-detail {
    padding: 30px 40px 50px;
  }
}

@media (max-width: 767px) {
  .viewer-panel {
    padding: 12px;
  }

  .exam-dashboard {
    grid-template-columns: 1fr;
  }

  .modal-detail {
    padding: 16px 16px 30px;
  }

  .detail-header h2 {
    font-size: 20px;
  }
}
</style>