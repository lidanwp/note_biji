<template>
  <div class="admin-panel">
    <header>
      <div class="header-left">
        <span class="app-logo">📚</span>
        <span class="app-name">笔记管理</span>
      </div>
      <div class="header-right">
        <div class="user-menu" ref="userMenuRef">
          <button @click="toggleUserMenu" class="user-btn">
            <span class="user-avatar">�</span>
            <span class="user-name">{{ authStore.user?.username }}</span>
            <span class="user-role">(管理员)</span>
            <span class="menu-arrow">{{ showUserMenu ? '▲' : '▼' }}</span>
          </button>
          <div v-if="showUserMenu" class="dropdown-menu">
            <button @click="importData" class="dropdown-item">
              <span class="item-icon">⬇</span>
              <span>导入数据</span>
            </button>
            <button @click="exportData" class="dropdown-item">
              <span class="item-icon">⬆</span>
              <span>导出数据</span>
            </button>
            <div class="dropdown-divider"></div>
            <button @click="logout" class="dropdown-item danger">
              <span class="item-icon">🚪</span>
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-badge">
        <span class="badge-icon">📝</span>
        <span class="badge-num">{{ notesStore.notes.length }}</span>
        <span class="badge-label">笔记</span>
      </div>
      <div class="stat-badge">
        <span class="badge-icon">📂</span>
        <span class="badge-num">{{ categories.length }}</span>
        <span class="badge-label">分类</span>
      </div>
      <div class="stat-badge">
        <span class="badge-icon">👁️</span>
        <span class="badge-num">{{ totalViews }}</span>
        <span class="badge-label">浏览</span>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <input 
        type="text" 
        v-model="notesStore.search" 
        placeholder="搜索笔记..."
        class="search-input"
      >
      <button @click="openAddModal" class="btn-primary">+ 新建笔记</button>
    </div>

    <!-- 筛选行 -->
    <div class="filter-bar">
      <CustomSelect v-model="notesStore.categoryFilter" :options="categoryFilterOptions" placeholder="全部分类" class="filter-cs" />
      <CustomSelect v-model="notesStore.difficultyFilter" :options="difficultyFilterOptions" placeholder="全部难度" class="filter-cs" />
      <div class="mode-switch">
        <button 
          @click="examMode = false" 
          :class="{ active: !examMode }"
          class="mode-btn"
        >
          📖 学习
        </button>
        <button 
          @click="examMode = true" 
          :class="{ active: examMode }"
          class="mode-btn"
        >
          🎯 考试
        </button>
      </div>
      <span v-if="examMode" class="mastery-indicator">
        📊 掌握度：{{ avgMastery }}%
      </span>
    </div>

    <div class="main-content">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>
      <div class="note-grid" v-show="!isLoading">
        <div v-for="note in paginatedNotes" :key="note.id" class="note-card" @click="editNote(note)">
          <div class="card-header">
            <div class="card-top-left">
              <span v-if="note.difficulty" class="difficulty-badge" :class="note.difficulty">
                {{ note.difficulty }}
              </span>
            </div>
            <div class="card-top-right">
              <span v-if="note.examScore != null" class="progress-badge">
                📊 {{ note.examScore }}%
              </span>
            </div>
          </div>

          <div class="card-body">
            <h3 class="card-title">{{ note.title }}</h3>
            <p class="card-summary">{{ note.content ? stripHtml(note.content).slice(0, 100) + ((note.content?.length || 0) > 100 ? '...' : '') : '暂无内容' }}</p>
            
            <div v-if="note.tags?.length" class="card-tags">
              <span v-for="tag in note.tags.slice(0, 3)" :key="tag" class="tag">#{{ tag }}</span>
              <span v-if="(note.tags?.length || 0) > 3" class="tag more-tag">+{{ (note.tags?.length || 0) - 3 }}</span>
            </div>
          </div>

          <div class="card-footer">
            <span class="category-tag">{{ note.category || '未分类' }}</span>
            <div class="card-footer-right">
              <span class="card-date">📅 {{ note.date }}</span>
              <span class="view-link">查看全文 →</span>
            </div>
          </div>

          <div class="card-actions">
            <button @click.stop="editNote(note)" class="btn-edit" title="编辑">✏️</button>
            <button @click.stop="deleteNote(note.id)" class="btn-delete" title="删除">🗑️</button>
          </div>

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
          </div>
        </div>

        <div v-if="paginatedNotes.length === 0 && !isLoading" class="empty">
          <p>暂无笔记，点击「新建笔记」开始记录</p>
        </div>
      </div>
      
      <Pagination 
        v-model:currentPage="notesStore.currentPage" 
        v-model:pageSize="notesStore.pageSize"
        :total="totalNotes"
        v-show="!isLoading"
      />

      <!-- 侧边面板 - 考试模式统计 -->
      <aside v-if="examMode" class="side-panel">
        <div class="panel-card">
          <h4>🔥 高频考点 TOP5</h4>
          <ul>
            <li v-for="topic in hotTopics" :key="topic.name">
              <span class="topic-name">{{ topic.name }}</span>
              <span class="topic-count">{{ topic.count }}次</span>
            </li>
          </ul>
        </div>
        
        <div class="panel-card">
          <h4>📊 过程组分布</h4>
          <div v-for="(count, group) in processGroupStats" :key="group" class="process-bar">
            <span>{{ group }}</span>
            <div class="bar-track"><div class="bar-fill" :style="{ width: count + '%' }"></div></div>
            <span class="bar-label">{{ count }}%</span>
          </div>
        </div>
        
        <div class="panel-card">
          <h4>📈 掌握度分布</h4>
          <div class="mastery-item">
            <span>✅ 已掌握 (≥80%)</span>
            <span class="mastery-count">{{ masteryDistribution.high }}条</span>
          </div>
          <div class="mastery-item">
            <span>📖 学习中 (40-79%)</span>
            <span class="mastery-count">{{ masteryDistribution.mid }}条</span>
          </div>
          <div class="mastery-item">
            <span>🔴 待加强 (&lt;40%)</span>
            <span class="mastery-count">{{ masteryDistribution.low }}条</span>
          </div>
        </div>
      </aside>
    </div>

    <!-- ===== 新建/编辑模态框 ===== -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal modal-large" @click.stop>
        <div class="modal-header">
          <h2>{{ isEditMode ? '✏️ 编辑笔记' : '📝 新建笔记' }}</h2>
          <div class="modal-header-right">
            <span v-if="isSaving" class="draft-status saving">⏳ 保存中...</span>
            <span v-else-if="hasDraft" class="draft-status saved">💾 已自动保存</span>
            <button @click="closeModal" class="modal-close">✕</button>
          </div>
        </div>

        <div class="modal-body">
          <div class="tabs">
            <button 
              v-for="tab in tabs" 
              :key="tab.key" 
              @click="activeTab = tab.key"
              :class="{ active: activeTab === tab.key }"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- ===== Tab: 基础信息 ===== -->
          <div v-if="activeTab === 'basic'">
            <div class="form-row">
              <div class="form-group flex-2">
                <label>📌 标题 <span class="required">*</span></label>
                <input v-model="form.title" @input="autoSaveDraft" placeholder="如：WBS工作分解 - 快速拆解大型项目">
              </div>
              <div class="form-group flex-1">
                <label>📂 分类 <span class="required">*</span></label>
                <CustomSelect v-model="form.category" :options="formCategoryOptions" placeholder="请选择分类" @change="autoSaveDraft" />
              </div>
              <div class="form-group flex-1">
                <label>📊 难度</label>
                <CustomSelect v-model="form.difficulty" :options="formDifficultyOptions" placeholder="请选择难度" @change="autoSaveDraft" />
              </div>
            </div>

            <div class="form-group">
              <label>💡 核心要点 <span class="required">*</span></label>
              <div class="keypoints-editor">
                <div v-for="(point, index) in form.keyPoints" :key="index" class="keypoint-item">
                  <input 
                    v-model="form.keyPoints[index]" 
                    @input="autoSaveDraft"
                    :placeholder="`要点 ${index + 1}`"
                    class="keypoint-input"
                  >
                  <button @click="removeKeyPoint(index)" class="btn-remove">✕</button>
                </div>
                <button @click="addKeyPoint" class="btn-add-keypoint">+ 添加要点（3-5条最佳）</button>
              </div>
            </div>

            <div class="form-group">
              <label>📌 适用场景</label>
              <input v-model="form.scenario" @input="autoSaveDraft" placeholder="什么时候用？解决什么问题？">
            </div>

            <div class="form-group">
              <label>🏷️ 标签（逗号分隔）</label>
              <input v-model="form.tagsInput" @input="autoSaveDraft" placeholder="如：WBS, 范围管理, 工具方法">
            </div>

            <div class="form-group">
              <label>📖 详细内容 <span class="required">*</span></label>
              <div class="editor-hint">支持 Markdown 语法，右侧可实时预览</div>
              <MdEditor 
                v-model="form.content" 
                @change="autoSaveDraft"
                :toolbars="toolbars"
                :theme="'light'"
                class="md-editor"
                placeholder="请输入笔记内容，支持 Markdown 格式..."
                style="min-height: 400px;"
              />
            </div>

            <div class="form-group">
              <label>💼 实战案例</label>
              <textarea 
                v-model="form.caseStudy" 
                @input="autoSaveDraft"
                rows="3" 
                placeholder="背景 → 问题 → 解决方案 → 效果"
                class="case-editor"
              ></textarea>
            </div>

            <div class="form-group">
              <label>📎 附件资源</label>
              <div class="attachment-list">
                <div v-for="(file, index) in form.attachments" :key="index" class="attachment-item">
                  <span>📄 {{ file }}</span>
                  <button @click="removeAttachment(index)" class="btn-remove">✕</button>
                </div>
              </div>
              <div class="attachment-upload">
                <input 
                  v-model="form.newAttachment" 
                  placeholder="输入文件名（如：WBS模板.xlsx）"
                  class="attachment-input"
                  @keyup.enter="addAttachment"
                >
                <button @click="addAttachment" class="btn-add">添加</button>
              </div>
            </div>
          </div>

          <!-- ===== Tab: 考点专项 ===== -->
          <div v-if="activeTab === 'exam'" class="exam-tab">
            <div class="form-group">
              <label>📋 关联过程组</label>
              <div class="hint">选择该知识点所属的过程组（可多选）</div>
              <div class="process-checkboxes">
                <label v-for="p in processGroups" :key="p">
                  <input type="checkbox" v-model="form.examMapping.relatedProcesses" :value="p" @change="autoSaveDraft">
                  {{ p }}
                </label>
              </div>
            </div>
            
            <div class="form-group">
              <label>📝 典型考法</label>
              <div class="hint">描述这个知识点在考试中通常怎么考</div>
              <div v-for="(q, i) in form.examMapping.typicalQuestions" :key="i" class="question-item">
                <input v-model="form.examMapping.typicalQuestions[i]" @input="autoSaveDraft" placeholder="如：考范围管理计划与项目计划的区别">
                <button @click="removeQuestion(i)" class="btn-remove">✕</button>
              </div>
              <button @click="addQuestion" class="btn-add-keypoint">+ 添加考法</button>
            </div>
            
            <div class="form-group">
              <label>⚠️ 常见陷阱</label>
              <div class="hint">容易混淆或出错的概念点</div>
              <div v-for="(p, i) in form.examMapping.commonPitfalls" :key="i" class="pitfall-item">
                <input v-model="form.examMapping.commonPitfalls[i]" @input="autoSaveDraft" placeholder="如：范围蔓延 vs 镀金（镀金是主动增加，蔓延是被动扩展）">
                <button @click="removePitfall(i)" class="btn-remove">✕</button>
              </div>
              <button @click="addPitfall" class="btn-add-keypoint">+ 添加陷阱</button>
            </div>
            
            <div class="form-group">
              <label>📊 易混对比</label>
              <div class="hint">用表格对比容易混淆的概念，考试最爱考</div>
              <label><input type="checkbox" v-model="form.comparisonTable.enabled" @change="autoSaveDraft"> 启用对比表</label>
              <div v-if="form.comparisonTable.enabled" class="comparison-editor">
                <input v-model="form.comparisonTable.title" @input="autoSaveDraft" placeholder="对比标题，如：范围管理计划 vs 需求管理计划" class="comparison-title">
                
                <div class="cols-editor">
                  <span class="cols-label">列名：</span>
                  <div v-for="(col, i) in form.comparisonTable.cols" :key="i" class="col-input">
                    <input v-model="form.comparisonTable.cols[i]" @input="autoSaveDraft" placeholder="列名">
                    <button @click="removeCol(i)" class="btn-remove">✕</button>
                  </div>
                  <button @click="addCol" class="btn-add-small">+ 添加列</button>
                </div>
                
                <div v-for="(row, i) in form.comparisonTable.rows" :key="i" class="comparison-row">
                  <input v-model="row.label" @input="autoSaveDraft" placeholder="对比项" class="row-label">
                  <div v-for="col in form.comparisonTable.cols" :key="col" class="col-value">
                    <input v-model="row.values[col]" @input="autoSaveDraft" :placeholder="col">
                  </div>
                  <button @click="removeComparisonRow(i)" class="btn-remove">✕</button>
                </div>
                <button @click="addComparisonRow" class="btn-add-keypoint">+ 添加对比行</button>
              </div>
            </div>
            
            <div class="form-group">
              <label>🧠 记忆辅助</label>
              <div class="hint">自由添加口诀、公式、思维导图等，帮助快速回忆</div>
              <div class="memory-editor">
                <div v-for="(item, index) in form.memoryAids" :key="index" class="memory-item">
                  <input 
                    v-model="form.memoryAids[index]" 
                    @input="autoSaveDraft"
                    placeholder="如：🧠 口诀：SMART + MoSCoW + WBS = 三大法宝"
                    class="memory-input"
                  >
                  <button @click="removeMemoryAid(index)" class="btn-remove">✕</button>
                </div>
                <button @click="addMemoryAid" class="btn-add-keypoint">+ 添加记忆辅助</button>
              </div>
            </div>
            
            <div class="form-group">
              <label>🎯 掌握度自评</label>
              <div class="hint">根据做题正确率自评，用于复习优先级参考</div>
              <div class="score-slider">
                <input type="range" v-model="form.examScore" @input="autoSaveDraft" min="0" max="100">
                <span class="score-value">{{ form.examScore }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">取消</button>
          <button @click="saveNote" class="btn-primary">💾 保存笔记</button>
        </div>
      </div>
    </div>

    <input type="file" ref="fileInput" accept=".json" style="display:none" @change="handleImport">
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotesStore } from '../stores/notes'
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import CustomSelect from '../components/CustomSelect.vue'
import Pagination from '../components/Pagination.vue'
import { toastSuccess, toastError, toastInfo, toastWarning } from '../utils/toast'

const router = useRouter()
const authStore = useAuthStore()
const notesStore = useNotesStore()
const fileInput = ref(null)

// ===== 数据 =====
const showModal = ref(false)
const isEditMode = ref(false)
const examMode = ref(false)
const activeTab = ref('basic')
const showUserMenu = ref(false)
const userMenuRef = ref(null)

// ===== 草稿相关 =====
const draftKey = ref('note_draft')
const hasDraft = ref(false)
const saveTimer = ref(null)
const isSaving = ref(false)

const tabs = [
  { key: 'basic', label: '📝 基础信息' },
  { key: 'exam', label: '🎯 考点专项' }
]

const processGroups = ['启动过程组', '规划过程组', '执行过程组', '监控过程组', '收尾过程组']

const toolbars = [
  'bold', 'underline', 'italic', 'strikeThrough', 'title',
  'sub', 'sup', 'quote', 'unorderedList', 'orderedList',
  'task', 'codeRow', 'code', 'link', 'image', 'table',
  'split', 'preview', 'htmlPreview', 'catalog', 'github'
]

const form = reactive({
  id: null,
  title: '',
  category: '',
  difficulty: '中级',
  keyPoints: [],
  scenario: '',
  content: '',
  caseStudy: '',
  tags: [],
  tagsInput: '',
  attachments: [],
  newAttachment: '',
  date: '',
  viewCount: 0,
  usefulCount: 0,
  examMapping: {
    relatedProcesses: [],
    typicalQuestions: [],
    commonPitfalls: []
  },
  comparisonTable: {
    enabled: false,
    title: '',
    cols: [],
    rows: []
  },
  memoryAids: [],
  examScore: 0
})

// ===== 下拉选项数据 =====
const categoryFilterOptions = computed(() => [
  { value: '', label: '全部分类' },
  ...categories.value.map(c => ({ value: c, label: c }))
])

const difficultyFilterOptions = [
  { value: '', label: '全部难度' },
  { value: '初级', label: '🌱 初级' },
  { value: '中级', label: '🔥 中级' },
  { value: '高级', label: '🚀 高级' },
]

const formCategoryOptions = [
  { value: '', label: '请选择分类' },
  {
    group: '项目管理',
    items: [
      { value: '项目管理/启动阶段', label: '启动阶段' },
      { value: '项目管理/规划阶段', label: '规划阶段' },
      { value: '项目管理/执行阶段', label: '执行阶段' },
      { value: '项目管理/监控阶段', label: '监控阶段' },
      { value: '项目管理/收尾阶段', label: '收尾阶段' },
    ],
  },
  {
    group: '系统集成',
    items: [
      { value: '系统集成/技术架构', label: '技术架构' },
      { value: '系统集成/集成方案', label: '集成方案' },
      { value: '系统集成/实施经验', label: '实施经验' },
      { value: '系统集成/运维保障', label: '运维保障' },
    ],
  },
  { value: '其他', label: '其他' },
]

const formDifficultyOptions = [
  { value: '初级', label: '🌱 初级' },
  { value: '中级', label: '🔥 中级' },
  { value: '高级', label: '🚀 高级' },
]

// ===== 计算属性 =====
const categories = computed(() => notesStore.categories)
const totalViews = computed(() => notesStore.totalViews)
const filteredNotes = computed(() => notesStore.filteredNotes)
const paginatedNotes = computed(() => notesStore.paginatedNotes)
const totalNotes = computed(() => notesStore.totalNotes)
const isLoading = computed(() => notesStore.isLoading)

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const closeUserMenu = () => {
  showUserMenu.value = false
}

// ===== 考试模式计算属性 =====
const avgMastery = computed(() => {
  const scored = notesStore.notes.filter(n => n.examScore != null)
  if (!scored.length) return 0
  return Math.round(scored.reduce((s, n) => s + n.examScore, 0) / scored.length)
})

const examNotesCount = computed(() => {
  return notesStore.notes.filter(n => 
    n.examMapping?.typicalQuestions?.length || 
    n.examMapping?.commonPitfalls?.length ||
    n.comparisonTable?.enabled ||
    n.memoryAids?.length
  ).length
})

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

const masteryDistribution = computed(() => {
  const scores = notesStore.notes.filter(n => n.examScore != null).map(n => n.examScore)
  return {
    high: scores.filter(s => s >= 80).length,
    mid: scores.filter(s => s >= 40 && s < 80).length,
    low: scores.filter(s => s < 40).length
  }
})

// ===== Markdown 渲染（用于预览） =====
const renderMarkdown = (content) => {
  if (!content) return ''
  if (content.includes('<p>') || content.includes('<div>')) {
    return content
  }
  return content
}

const stripHtml = (content) => {
  if (!content) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = content
  return tmp.textContent || tmp.innerText || ''
}

// ===== 草稿自动保存 =====
const autoSaveDraft = () => {
  if (!showModal.value) return
  
  if (saveTimer.value) {
    clearTimeout(saveTimer.value)
  }
  
  saveTimer.value = setTimeout(() => {
    if (form.title.trim() || (form.content && form.content.trim())) {
      const draftData = {
        ...form,
        _draftTime: new Date().toISOString(),
        _isDraft: true
      }
      localStorage.setItem(draftKey.value, JSON.stringify(draftData))
      hasDraft.value = true
      isSaving.value = true
      
      setTimeout(() => {
        isSaving.value = false
      }, 500)
    }
  }, 300)
}

const restoreDraft = () => {
  const stored = localStorage.getItem(draftKey.value)
  if (!stored) return false
  
  try {
    const draft = JSON.parse(stored)
    if (draft._isDraft) {
      Object.assign(form, {
        id: draft.id || null,
        title: draft.title || '',
        category: draft.category || '',
        difficulty: draft.difficulty || '中级',
        keyPoints: draft.keyPoints || [],
        scenario: draft.scenario || '',
        content: draft.content || '',
        caseStudy: draft.caseStudy || '',
        tags: draft.tags || [],
        tagsInput: draft.tagsInput || '',
        attachments: draft.attachments || [],
        newAttachment: '',
        date: draft.date || '',
        viewCount: draft.viewCount || 0,
        usefulCount: draft.usefulCount || 0,
        examMapping: draft.examMapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
        comparisonTable: draft.comparisonTable || { enabled: false, title: '', cols: [], rows: [] },
        memoryAids: draft.memoryAids || [],
        examScore: draft.examScore || 0
      })
      
      if (draft.id) {
        isEditMode.value = true
      }
      
      hasDraft.value = true
      return true
    }
  } catch (e) {
    console.warn('草稿恢复失败:', e)
  }
  return false
}

const clearDraft = () => {
  localStorage.removeItem(draftKey.value)
  hasDraft.value = false
}

const getDraftTime = () => {
  const stored = localStorage.getItem(draftKey.value)
  if (!stored) return null
  try {
    const draft = JSON.parse(stored)
    return draft._draftTime || null
  } catch {
    return null
  }
}

// ===== 方法 =====
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

const saveNotes = async () => {
  try {
    await notesStore.saveNotes()
    toastSuccess('保存成功')
  } catch (e) {
    toastError('保存失败，请稍后重试')
    throw e
  }
}

const openAddModal = () => {
  const draftTime = getDraftTime()
  if (draftTime) {
    const timeStr = new Date(draftTime).toLocaleString()
    if (confirm(`检测到未完成的笔记草稿（保存于 ${timeStr}），是否恢复？\n（点击"确定"恢复，点击"取消"放弃草稿）`)) {
      restoreDraft()
      isEditMode.value = false
      showModal.value = true
      activeTab.value = 'basic'
      return
    } else {
      clearDraft()
    }
  }
  
  isEditMode.value = false
  resetForm()
  showModal.value = true
  activeTab.value = 'basic'
}

const editNote = (note) => {
  const draftTime = getDraftTime()
  if (draftTime) {
    const stored = localStorage.getItem(draftKey.value)
    if (stored) {
      try {
        const draft = JSON.parse(stored)
        if (draft._isDraft && draft.id !== note.id) {
          const timeStr = new Date(draftTime).toLocaleString()
          if (confirm(`检测到未完成的笔记草稿（保存于 ${timeStr}），是否恢复？\n（点击"确定"恢复，点击"取消"放弃草稿）`)) {
            restoreDraft()
            showModal.value = true
            activeTab.value = 'basic'
            return
          } else {
            clearDraft()
          }
        } else if (draft._isDraft && draft.id === note.id) {
          restoreDraft()
          showModal.value = true
          activeTab.value = 'basic'
          return
        }
      } catch (e) {}
    }
  }
  
  isEditMode.value = true
  const noteData = JSON.parse(JSON.stringify(note))
  
  if (!noteData.examMapping) {
    noteData.examMapping = { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] }
  }
  if (!noteData.comparisonTable) {
    noteData.comparisonTable = { enabled: false, title: '', cols: [], rows: [] }
  }
  if (!noteData.memoryAids || !Array.isArray(noteData.memoryAids)) {
    noteData.memoryAids = []
  }
  if (noteData.examScore == null) {
    noteData.examScore = 0
  }
  
  form.id = noteData.id
  form.title = noteData.title || ''
  form.category = noteData.category || ''
  form.difficulty = noteData.difficulty || '中级'
  form.keyPoints = noteData.keyPoints || []
  form.scenario = noteData.scenario || ''
  form.content = noteData.content || ''
  form.caseStudy = noteData.caseStudy || ''
  form.tags = noteData.tags || []
  form.tagsInput = noteData.tags?.join(', ') || ''
  form.attachments = noteData.attachments || []
  form.newAttachment = ''
  form.date = noteData.date || ''
  form.viewCount = noteData.viewCount || 0
  form.usefulCount = noteData.usefulCount || 0
  form.examMapping = noteData.examMapping
  form.comparisonTable = noteData.comparisonTable
  form.memoryAids = noteData.memoryAids || []
  form.examScore = noteData.examScore
  
  showModal.value = true
  activeTab.value = 'basic'
}

const resetForm = () => {
  form.id = null
  form.title = ''
  form.category = ''
  form.difficulty = '中级'
  form.keyPoints = []
  form.scenario = ''
  form.content = ''
  form.caseStudy = ''
  form.tags = []
  form.tagsInput = ''
  form.attachments = []
  form.newAttachment = ''
  form.date = ''
  form.viewCount = 0
  form.usefulCount = 0
  form.examMapping = {
    relatedProcesses: [],
    typicalQuestions: [],
    commonPitfalls: []
  }
  form.comparisonTable = {
    enabled: false,
    title: '',
    cols: [],
    rows: []
  }
  form.memoryAids = []
  form.examScore = 0
}

const closeModal = () => {
  showModal.value = false
}

// ===== 核心要点方法 =====
const addKeyPoint = async () => {
  form.keyPoints.push('')
  await nextTick()
  const inputs = document.querySelectorAll('.keypoint-item .keypoint-input')
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus()
  }
  autoSaveDraft()
}

const removeKeyPoint = (index) => {
  form.keyPoints.splice(index, 1)
  autoSaveDraft()
}

// ===== 附件方法 =====
const addAttachment = () => {
  if (form.newAttachment.trim()) {
    form.attachments.push(form.newAttachment.trim())
    form.newAttachment = ''
    autoSaveDraft()
  }
}

const removeAttachment = (index) => {
  form.attachments.splice(index, 1)
  autoSaveDraft()
}

// ===== 考试专项方法 =====
const addQuestion = async () => {
  form.examMapping.typicalQuestions.push('')
  await nextTick()
  const inputs = document.querySelectorAll('.question-item input')
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus()
  }
  autoSaveDraft()
}

const removeQuestion = (i) => {
  form.examMapping.typicalQuestions.splice(i, 1)
  autoSaveDraft()
}

const addPitfall = async () => {
  form.examMapping.commonPitfalls.push('')
  await nextTick()
  const inputs = document.querySelectorAll('.pitfall-item input')
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus()
  }
  autoSaveDraft()
}

const removePitfall = (i) => {
  form.examMapping.commonPitfalls.splice(i, 1)
  autoSaveDraft()
}

const addCol = async () => {
  const newCol = `概念${form.comparisonTable.cols.length + 1}`
  form.comparisonTable.cols.push(newCol)
  form.comparisonTable.rows.forEach(row => {
    row.values[newCol] = ''
  })
  await nextTick()
  const inputs = document.querySelectorAll('.cols-editor .col-input input')
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus()
  }
  autoSaveDraft()
}

const removeCol = (i) => {
  const col = form.comparisonTable.cols[i]
  form.comparisonTable.cols.splice(i, 1)
  form.comparisonTable.rows.forEach(row => {
    delete row.values[col]
  })
  autoSaveDraft()
}

const addComparisonRow = async () => {
  const values = {}
  form.comparisonTable.cols.forEach(c => { values[c] = '' })
  form.comparisonTable.rows.push({ label: '', values })
  await nextTick()
  const inputs = document.querySelectorAll('.comparison-row .row-label')
  if (inputs.length > 0) {
    inputs[inputs.length - 1].focus()
  }
  autoSaveDraft()
}

const removeComparisonRow = (i) => {
  form.comparisonTable.rows.splice(i, 1)
  autoSaveDraft()
}

// ===== 记忆辅助方法 =====
const addMemoryAid = async () => {
  form.memoryAids.push('')
  await nextTick()
  const inputs = document.querySelectorAll('.memory-item .memory-input')
  if (inputs.length > 0) {
    const lastInput = inputs[inputs.length - 1]
    lastInput.focus()
    lastInput.setSelectionRange(lastInput.value.length, lastInput.value.length)
  }
  autoSaveDraft()
}

const removeMemoryAid = (index) => {
  form.memoryAids.splice(index, 1)
  autoSaveDraft()
}

// ===== 保存笔记 =====
const saveNote = async () => {
  if (!form.title.trim()) {
    toastWarning('请输入标题')
    return
  }
  if (!form.category) {
    toastWarning('请选择分类')
    return
  }
  if (!form.content || !form.content.trim()) {
    toastWarning('请输入内容')
    return
  }
  if (form.keyPoints.length === 0 || form.keyPoints.every(p => !p.trim())) {
    toastWarning('请至少添加1条核心要点')
    return
  }

  const tags = form.tagsInput
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  const keyPoints = form.keyPoints.filter(p => p.trim())

  const noteData = {
    id: form.id || Date.now(),
    title: form.title.trim(),
    category: form.category,
    difficulty: form.difficulty || '中级',
    keyPoints: keyPoints,
    scenario: form.scenario || '',
    content: form.content.trim(),
    caseStudy: form.caseStudy || '',
    tags: tags,
    attachments: form.attachments || [],
    date: form.date || new Date().toISOString().split('T')[0],
    viewCount: form.viewCount || 0,
    usefulCount: form.usefulCount || 0,
    examMapping: {
      relatedProcesses: [...(form.examMapping?.relatedProcesses || [])],
      typicalQuestions: [...(form.examMapping?.typicalQuestions || [])],
      commonPitfalls: [...(form.examMapping?.commonPitfalls || [])]
    },
    comparisonTable: {
      enabled: form.comparisonTable?.enabled || false,
      title: form.comparisonTable?.title || '',
      cols: [...(form.comparisonTable?.cols || [])],
      rows: JSON.parse(JSON.stringify(form.comparisonTable?.rows || []))
    },
    memoryAids: [...(form.memoryAids || [])].filter(item => item.trim()),
    examScore: Number(form.examScore) || 0
  }

  if (isEditMode.value) {
    notesStore.updateNote(noteData)
  } else {
    notesStore.addNote(noteData)
  }

  await saveNotes()
  clearDraft()
  closeModal()
  resetForm()
}

// ===== 删除笔记 =====
const deleteNote = async (id) => {
  const noteTitle = notesStore.getNoteById(id)?.title || '该笔记'
  if (confirm(`确定要删除「${noteTitle}」吗？`)) {
    try {
      await notesStore.deleteNote(id)
      toastSuccess('删除成功')
    } catch (e) {
      toastError('删除失败，请重试')
    }
  }
}

const exportData = () => {
  const data = JSON.stringify(filteredNotes.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `笔记备份_${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importData = () => {
  fileInput.value?.click()
}

const handleImport = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (Array.isArray(data) && data.length) {
        if (confirm(`将导入 ${data.length} 条笔记，是否覆盖现有数据？\n（取消则追加）`)) {
          notesStore.notes = data.map(migrateNote)
        } else {
          notesStore.notes = [...notesStore.notes, ...data.map(migrateNote)]
        }
        await saveNotes()
        toastSuccess(`成功导入 ${data.length} 条笔记`)
      } else {
        toastWarning('数据格式错误')
      }
    } catch (err) {
      toastError('文件解析失败，请确认是有效的 JSON 文件')
    }
  }
  reader.readAsText(file)
  event.target.value = ''
}

const logout = () => {
  authStore.logout()
  router.push('/login')
}

// ===== 生命周期 =====
onMounted(async () => {
  if (authStore.user?.role !== 'admin') {
    router.push('/viewer')
  }
  await loadNotes()
})
</script>

<style scoped>
.admin-panel {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 16px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 16px;
  position: sticky;
  top: 0;
  z-index: 100;
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

.user-menu {
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

.user-role {
  color: #999;
  font-size: 12px;
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
  min-width: 160px;
  z-index: 200;
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

.dropdown-divider {
  height: 1px;
  background: #eee;
  margin: 6px 0;
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  background: white;
  padding: 6px 12px;
  border-radius: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.badge-icon {
  font-size: 14px;
}

.badge-num {
  font-size: 16px;
  font-weight: 700;
  color: #667eea;
}

.badge-label {
  font-size: 12px;
  color: #999;
}

.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.search-bar .search-input {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
}

.search-bar .search-input:focus {
  border-color: #667eea;
  outline: none;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-secondary, white);
  padding: 10px 14px;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-bar .filter-cs {
  min-width: 120px;
  flex: 0 0 auto;
}

.mode-switch {
  display: flex;
  background: var(--bg-hover, #f5f7fa);
  border-radius: 8px;
  padding: 2px;
}

.mode-btn {
  padding: 6px 14px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted, #666);
  transition: all 0.2s;
}

.mode-btn.active {
  background: var(--bg-secondary, white);
  color: var(--accent-color, #667eea);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.btn-primary {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
  font-size: 14px;
}
.btn-primary:hover { opacity: 0.9; }

.main-content {
  display: block;
}

.note-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.side-panel {
  display: none;
}

.panel-card {
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.panel-card h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.panel-card ul {
  padding: 0;
  list-style: none;
  margin: 0;
}

.panel-card li {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f7fa;
}

.panel-card li:last-child { border-bottom: none; }

.process-bar .bar-track {
  flex: 1;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}

.process-bar .bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
}

.process-bar .bar-label {
  font-size: 12px;
  color: #999;
  min-width: 32px;
}

.mastery-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f7fa;
}

.mastery-item:last-child { border-bottom: none; }

.mastery-count {
  font-weight: 600;
  color: #667eea;
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}

.card-top-left {
  display: flex;
  align-items: center;
}

.card-top-right {
  display: flex;
  align-items: center;
}

.difficulty-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.difficulty-badge.初级 { background: #d4edda; color: #155724; }
.difficulty-badge.中级 { background: #fff3cd; color: #856404; }
.difficulty-badge.高级 { background: #f8d7da; color: #721c24; }

.progress-badge {
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  background: #f0f2ff;
  padding: 4px 10px;
  border-radius: 12px;
}

.card-body {
  padding: 0 16px 14px;
}

.card-title {
  margin: 0 0 8px 0;
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
  margin: 0 0 10px 0;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: 12px;
  color: #667eea;
  background: #eef0ff;
  padding: 2px 10px;
  border-radius: 12px;
}

.more-tag {
  background: #f5f7fa;
  color: #999;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #f5f7fa;
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
  font-size: 13px;
  color: #999;
}

.view-link {
  font-size: 13px;
  color: #667eea;
  font-weight: 500;
}

.card-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 4px;
}

.card-actions button {
  background: rgba(255,255,255,0.9);
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 6px;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}

.btn-edit:hover { background: #e3f2fd; }
.btn-delete:hover { background: #fce4ec; }

.card-exam-details {
  padding: 12px 16px;
  background: #f8f9fc;
  border-top: 1px solid #e8ecf1;
}

.empty {
  grid-column: 1/-1;
  text-align: center;
  color: #999;
  padding: 60px 0;
}

.loading-overlay {
  grid-column: 1/-1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
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

.process-label, .section-label {
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
.exam-section.pitfall ul { color: #c0392b; }

.comparison-box {
  margin-top: 8px;
  background: white;
  border-radius: 6px;
  border-left: 3px solid #667eea;
  padding: 10px 12px;
  overflow-x: auto;
}
.comparison-box h4 { margin: 0 0 6px 0; font-size: 14px; }
.comparison-box table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}
.comparison-box th, .comparison-box td {
  padding: 4px 10px;
  border: 1px solid #e8ecf1;
  text-align: left;
}
.comparison-box th { background: #f0f2ff; font-weight: 600; }
.comparison-box td:first-child { font-weight: 500; }

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
.mastery-bar .score { font-weight: 600; color: #667eea; }

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-large {
  background: white;
  padding: 0;
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 32px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.modal-header h2 { margin: 0; }

.modal-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.draft-status {
  font-size: 13px;
  color: #999;
  padding: 4px 12px;
  border-radius: 12px;
  background: #f0f2ff;
}

.draft-status.saving {
  color: #f59e0b;
  background: #fef3c7;
}

.draft-status.saved {
  color: #22c55e;
  background: #dcfce7;
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}
.modal-close:hover { color: #333; }

.modal-body {
  padding: 24px 32px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 32px;
  border-top: 1px solid #eee;
  background: #f8f9fc;
  border-radius: 0 0 16px 16px;
  flex-shrink: 0;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 2px solid #eee;
}
.tabs button {
  padding: 8px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #999;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.tabs button.active {
  color: #667eea;
  border-bottom-color: #667eea;
}
.tabs button:hover { color: #667eea; }

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: #333;
}

.required { color: #e74c3c; }

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #667eea;
  outline: none;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }

.editor-hint {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.md-editor {
  border-radius: 8px;
  overflow: hidden;
}

.md-editor :deep(.md-editor-toolbar) {
  border: 2px solid #e0e0e0;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: #f8f9fc;
  padding: 4px 8px;
  flex-wrap: wrap;
  gap: 2px;
}

.md-editor :deep(.md-editor-toolbar .toolbar-item) {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.md-editor :deep(.md-editor-toolbar .toolbar-item:hover) {
  background: #e8ecf1;
}

.md-editor :deep(.md-editor-content) {
  border: 2px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  min-height: 300px;
}

.md-editor :deep(.md-editor-content textarea) {
  font-size: 14px;
  line-height: 1.8;
  padding: 16px;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
}

.md-editor :deep(.md-editor-preview) {
  padding: 16px;
  font-size: 14px;
  line-height: 1.8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.md-editor :deep(.md-editor-preview h1),
.md-editor :deep(.md-editor-preview h2),
.md-editor :deep(.md-editor-preview h3) {
  margin: 16px 0 8px 0;
}

.md-editor :deep(.md-editor-preview pre) {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
}

.md-editor :deep(.md-editor-preview code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.md-editor :deep(.md-editor-preview blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 16px;
  margin: 8px 0;
  color: #666;
}

.md-editor :deep(.md-editor-preview table) {
  border-collapse: collapse;
  width: 100%;
}

.md-editor :deep(.md-editor-preview th),
.md-editor :deep(.md-editor-preview td) {
  border: 1px solid #e0e0e0;
  padding: 6px 12px;
}

.md-editor :deep(.md-editor-preview th) {
  background: #f0f2ff;
}

.keypoints-editor {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
}

.keypoint-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.keypoint-item:last-child { margin-bottom: 0; }

.keypoint-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.keypoint-input:focus {
  border-color: #667eea;
  outline: none;
}

.btn-remove {
  padding: 0 10px;
  background: none;
  border: none;
  color: #e74c3c;
  cursor: pointer;
  font-size: 18px;
}

.btn-add-keypoint {
  margin-top: 8px;
  padding: 6px 16px;
  background: #e8ecf1;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
}
.btn-add-keypoint:hover { background: #d5d9e0; }

.case-editor {
  resize: vertical;
  font-family: inherit;
}

.attachment-list {
  margin-bottom: 8px;
}

.attachment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: #f8f9fc;
  border-radius: 6px;
  margin-bottom: 4px;
}

.attachment-upload {
  display: flex;
  gap: 8px;
}

.attachment-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.btn-add {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.btn-add:hover { background: #5a6fd6; }

.btn-cancel {
  padding: 10px 24px;
  background: #eee;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.btn-cancel:hover { background: #ddd; }

.exam-tab .hint {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.process-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
}
.process-checkboxes label {
  font-size: 14px;
  cursor: pointer;
}
.process-checkboxes input[type="checkbox"] {
  margin-right: 4px;
}

.question-item, .pitfall-item {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.question-item input, .pitfall-item input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
}

.comparison-editor {
  border: 1px solid #e8ecf1;
  border-radius: 8px;
  padding: 12px;
  margin-top: 6px;
}

.comparison-title {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 8px;
}

.cols-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 8px 0;
}
.cols-label { font-size: 13px; color: #555; }
.cols-editor .col-input {
  display: flex;
  align-items: center;
  gap: 2px;
}
.cols-editor .col-input input { 
  width: 80px; 
  padding: 4px 6px; 
  border: 1px solid #ddd; 
  border-radius: 4px; 
  font-size: 13px;
}

.btn-add-small {
  padding: 2px 12px;
  background: #e8ecf1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.btn-add-small:hover { background: #d5d9e0; }

.comparison-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 4px 0;
}
.comparison-row .row-label { 
  width: 100px; 
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
}
.comparison-row .col-value input { 
  width: 80px; 
  padding: 4px 6px; 
  border: 1px solid #ddd; 
  border-radius: 4px; 
  font-size: 13px;
}

.memory-editor {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 12px;
}

.memory-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.memory-item:last-child { margin-bottom: 0; }

.memory-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.memory-input:focus {
  border-color: #667eea;
  outline: none;
}

.score-slider {
  display: flex;
  align-items: center;
  gap: 12px;
}
.score-slider input[type="range"] {
  flex: 1;
  max-width: 300px;
}
.score-value {
  font-weight: 600;
  color: #667eea;
  font-size: 16px;
  min-width: 48px;
}

@media (min-width: 768px) and (max-width: 1023px) {
  .admin-panel { padding: 16px; }
  .note-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  .main-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .side-panel {
    display: flex;
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 12px;
  }
  .panel-card {
    flex: 1;
    min-width: 200px;
  }
  .header-right {
    gap: 16px;
  }
}

@media (min-width: 1024px) {
  .admin-panel { padding: 24px; }
  .note-grid {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 20px;
  }
  .main-content {
    display: flex;
    gap: 24px;
  }
  .side-panel {
    display: flex;
    width: 280px;
    flex-shrink: 0;
    flex-direction: column;
    gap: 16px;
  }
  .header-right {
    gap: 20px;
  }
}

@media (max-width: 767px) {
  .admin-panel { padding: 12px; }
  .header-right {
    gap: 12px;
  }
  .header-left .app-name {
    font-size: 16px;
  }
  .stats-bar {
    gap: 8px;
  }
  .stat-badge {
    padding: 4px 10px;
  }
  .badge-num {
    font-size: 14px;
  }
  .badge-label {
    font-size: 11px;
  }
  .search-bar {
    flex-direction: column;
  }
  .search-bar .search-input {
    font-size: 14px;
    padding: 10px 12px;
    min-width: auto;
  }
  .filter-bar {
    padding: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .filter-bar .filter-cs {
    min-width: 100px;
  }
  .mode-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
  .form-row { flex-direction: column; }
  .modal-body { padding: 16px; }
  .modal-header { padding: 16px; flex-wrap: wrap; }
  .modal-footer { padding: 12px 16px; flex-wrap: wrap; }
}
</style>