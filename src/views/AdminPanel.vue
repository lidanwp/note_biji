<template>
  <div class="admin-panel">
    <header>
      <h1>📚 笔记管理</h1>
      <div>
        <span>👋 {{ authStore.user?.username }} (管理员)</span>
        <button @click="logout" class="logout-btn">退出</button>
      </div>
    </header>

    <!-- 统计栏 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-number">{{ notes.length }}</span>
        <span class="stat-label">总笔记</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ categories.length }}</span>
        <span class="stat-label">分类</span>
      </div>
      <div class="stat-item">
        <span class="stat-number">{{ totalViews }}</span>
        <span class="stat-label">总浏览</span>
      </div>
      <button @click="exportData" class="btn-export">📤 导出数据</button>
      <button @click="importData" class="btn-import">📥 导入数据</button>
    </div>

    <!-- 考试模式切换 -->
    <div class="exam-mode-bar">
      <div class="exam-toggle">
        <span>📖 学习模式</span>
        <label class="switch">
          <input type="checkbox" v-model="examMode">
          <span class="slider"></span>
        </label>
        <span>🎯 考试模式</span>
      </div>
      
      <div v-if="examMode" class="exam-stats">
        <span>📊 掌握度：{{ avgMastery }}%</span>
        <span>📌 考点笔记：{{ examNotesCount }}条</span>
      </div>
    </div>

    <!-- 考点看板 -->
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
      
      <div class="dashboard-card">
        <h4>📈 掌握度分布</h4>
        <div class="mastery-distribution">
          <span>✅ 已掌握 (≥80%)</span>
          <span>{{ masteryDistribution.high }}条</span>
        </div>
        <div class="mastery-distribution">
          <span>📖 学习中 (40-79%)</span>
          <span>{{ masteryDistribution.mid }}条</span>
        </div>
        <div class="mastery-distribution">
          <span>🔴 待加强 (&lt;40%)</span>
          <span>{{ masteryDistribution.low }}条</span>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <button @click="openAddModal" class="btn-primary">+ 新建笔记</button>
      <input 
        type="text" 
        v-model="search" 
        placeholder="搜索笔记..."
        class="search-input"
      >
      <select v-model="categoryFilter" class="filter-select">
        <option value="">全部分类</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
    </div>

    <div class="note-list">
      <div v-for="note in filteredNotes" :key="note.id" class="note-card">
        <div class="note-badges">
          <span v-if="note.difficulty" class="badge" :class="note.difficulty">
            {{ note.difficulty }}
          </span>
          <span class="badge category">{{ note.category || '未分类' }}</span>
          <span v-if="note.examScore != null" class="badge mastery-badge">
            🎯 {{ note.examScore }}%
          </span>
        </div>

        <div class="note-header">
          <h3>{{ note.title }}</h3>
          <div class="note-actions">
            <button @click="editNote(note)" class="btn-edit" title="编辑">✏️</button>
            <button @click="deleteNote(note.id)" class="btn-delete" title="删除">🗑️</button>
          </div>
        </div>

        <!-- 核心要点预览 -->
        <div v-if="note.keyPoints?.length" class="preview-keypoints">
          <ul>
            <li v-for="(p, i) in note.keyPoints.slice(0, 2)" :key="i">{{ p }}</li>
            <li v-if="note.keyPoints.length > 2" class="more">+ {{ note.keyPoints.length - 2 }} 更多</li>
          </ul>
        </div>

        <!-- 内容预览 - 支持 Markdown 渲染 -->
        <div class="note-content markdown-body" v-html="renderMarkdown(note.content)"></div>
        
        <div v-if="note.tags?.length" class="tags">
          <span v-for="tag in note.tags" :key="tag" class="tag">#{{ tag }}</span>
        </div>

        <!-- ===== 考试视图 ===== -->
        <div v-if="examMode && note.examMapping" class="exam-view">
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

        <div class="note-meta">
          <span>📅 {{ note.date }}</span>
          <span>👁️ {{ note.viewCount || 0 }}</span>
          <span>👍 {{ note.usefulCount || 0 }}</span>
        </div>
      </div>

      <div v-if="filteredNotes.length === 0" class="empty">
        <p>暂无笔记，点击「新建笔记」开始记录</p>
      </div>
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
                <select v-model="form.category" @change="autoSaveDraft" class="form-select">
                  <option value="">请选择分类</option>
                  <optgroup label="项目管理">
                    <option value="项目管理/启动阶段">启动阶段</option>
                    <option value="项目管理/规划阶段">规划阶段</option>
                    <option value="项目管理/执行监控">执行与监控</option>
                    <option value="项目管理/收尾阶段">收尾阶段</option>
                  </optgroup>
                  <optgroup label="系统集成">
                    <option value="系统集成/技术架构">技术架构</option>
                    <option value="系统集成/集成方案">集成方案</option>
                    <option value="系统集成/实施经验">实施经验</option>
                    <option value="系统集成/运维保障">运维保障</option>
                  </optgroup>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div class="form-group flex-1">
                <label>📊 难度</label>
                <select v-model="form.difficulty" @change="autoSaveDraft" class="form-select">
                  <option value="初级">🌱 初级</option>
                  <option value="中级" selected>🔥 中级</option>
                  <option value="高级">🚀 高级</option>
                </select>
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
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { loadNotesFromCloud, saveNotesToCloud, deleteNoteFromCloud } from '../services/supabase'

const router = useRouter()
const authStore = useAuthStore()
const fileInput = ref(null)

// ===== 数据 =====
const notes = ref([])
const search = ref('')
const categoryFilter = ref('')
const showModal = ref(false)
const isEditMode = ref(false)
const examMode = ref(false)
const activeTab = ref('basic')

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
    
    return matchSearch && matchCategory
  })
})

// ===== 考试模式计算属性 =====
const avgMastery = computed(() => {
  const scored = notes.value.filter(n => n.examScore != null)
  if (!scored.length) return 0
  return Math.round(scored.reduce((s, n) => s + n.examScore, 0) / scored.length)
})

const examNotesCount = computed(() => {
  return notes.value.filter(n => 
    n.examMapping?.typicalQuestions?.length || 
    n.examMapping?.commonPitfalls?.length ||
    n.comparisonTable?.enabled ||
    n.memoryAids?.length
  ).length
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

const masteryDistribution = computed(() => {
  const scores = notes.value.filter(n => n.examScore != null).map(n => n.examScore)
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
    const cloudData = await loadNotesFromCloud()
    if (cloudData && cloudData.length > 0) {
      notes.value = cloudData.map(migrateNote)
      console.log('✅ 从云端加载了', cloudData.length, '条笔记')
    } else {
      notes.value = []
    }
  } catch (e) {
    console.error('❌ 云端加载失败:', e.message)
    notes.value = []
  }
}

const migrateNote = (note) => {
  if (!note.examMapping) {
    note.examMapping = { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] }
  }
  if (!note.comparisonTable) {
    note.comparisonTable = { enabled: false, title: '', cols: [], rows: [] }
  }
  if (note.memoryAids && !Array.isArray(note.memoryAids)) {
    const old = note.memoryAids
    const newArray = []
    if (old.mnemonic) newArray.push(`🧠 口诀：${old.mnemonic}`)
    if (old.formula) newArray.push(`📐 公式：${old.formula}`)
    if (old.mindMap) newArray.push(`🗺️ 脉络：${old.mindMap}`)
    note.memoryAids = newArray
  }
  if (!note.memoryAids || !Array.isArray(note.memoryAids)) {
    note.memoryAids = []
  }
  if (note.examScore != null && typeof note.examScore === 'string') {
    note.examScore = parseInt(note.examScore, 10) || 0
  }
  if (note.examScore == null) {
    note.examScore = 0
  }
  return note
}

const saveNotes = async () => {
  try {
    await saveNotesToCloud(notes.value)
  } catch (e) {
    console.error('❌ 云端保存失败:', e.message)
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
    alert('请输入标题')
    return
  }
  if (!form.category) {
    alert('请选择分类')
    return
  }
  if (!form.content || !form.content.trim()) {
    alert('请输入内容')
    return
  }
  if (form.keyPoints.length === 0 || form.keyPoints.every(p => !p.trim())) {
    alert('请至少添加1条核心要点')
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
    tagsInput: form.tagsInput || '',
    attachments: form.attachments || [],
    newAttachment: '',
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
    const index = notes.value.findIndex(n => n.id === noteData.id)
    if (index !== -1) {
      notes.value[index] = noteData
    }
  } else {
    notes.value.push(noteData)
  }

  await saveNotes()
  clearDraft()
  closeModal()
  resetForm()
  alert('保存成功！')
}

// ===== 删除笔记 =====
const deleteNote = async (id) => {
  if (confirm('确定要删除这条笔记吗？')) {
    notes.value = notes.value.filter(n => n.id !== id)
    try {
      await deleteNoteFromCloud(id)
    } catch (e) {
      console.error('❌ 云端删除失败:', e.message)
      alert('删除失败，请重试')
    }
  }
}

const exportData = () => {
  const data = JSON.stringify(notes.value, null, 2)
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
          notes.value = data.map(migrateNote)
        } else {
          notes.value = [...notes.value, ...data.map(migrateNote)]
        }
        await saveNotes()
        alert('导入成功！')
      } else {
        alert('数据格式错误')
      }
    } catch (err) {
      alert('文件解析失败，请确认是有效的 JSON 文件')
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
  padding: 24px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  margin-bottom: 20px;
}

header h1 { font-size: 24px; color: #333; }
header div { display: flex; align-items: center; gap: 16px; }

.logout-btn {
  padding: 8px 20px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.logout-btn:hover { background: #c0392b; }

.stats-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.stat-item {
  background: white;
  padding: 12px 20px;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-number {
  font-size: 22px;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.btn-export, .btn-import {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 14px;
}

.btn-export {
  background: #28a745;
  color: white;
}
.btn-export:hover { background: #218838; }

.btn-import {
  background: #17a2b8;
  color: white;
}
.btn-import:hover { background: #138496; }

.exam-mode-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  background: white;
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  flex-wrap: wrap;
}

.exam-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #555;
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #ccc;
  border-radius: 26px;
  transition: 0.3s;
}
.slider:before {
  content: "";
  position: absolute;
  height: 20px; width: 20px;
  left: 3px; bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}
.switch input:checked + .slider { background: #667eea; }
.switch input:checked + .slider:before { transform: translateX(22px); }

.exam-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #555;
}
.exam-stats span { background: #f0f2ff; padding: 4px 12px; border-radius: 12px; }

.exam-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.dashboard-card {
  background: white;
  padding: 14px 18px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.dashboard-card h4 { margin: 0 0 10px 0; font-size: 14px; }
.dashboard-card ul { padding: 0; list-style: none; margin: 0; }
.dashboard-card li {
  display: flex;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 14px;
  border-bottom: 1px solid #f5f7fa;
}
.dashboard-card li:last-child { border-bottom: none; }
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
.progress-bar .bar-label { font-size: 12px; color: #999; min-width: 32px; }

.mastery-distribution {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 14px;
  border-bottom: 1px solid #f5f7fa;
}
.mastery-distribution:last-child { border-bottom: none; }

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.btn-primary {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}
.btn-primary:hover { opacity: 0.9; }

.search-input {
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  flex: 1;
  min-width: 200px;
}
.search-input:focus {
  border-color: #667eea;
  outline: none;
}

.filter-select {
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  min-width: 140px;
}

.note-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.note-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.2s;
}

.note-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.note-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.badge {
  padding: 2px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge.category {
  background: #e8ecf1;
  color: #666;
}

.badge.初级 { background: #d4edda; color: #155724; }
.badge.中级 { background: #fff3cd; color: #856404; }
.badge.高级 { background: #f8d7da; color: #721c24; }

.badge.mastery-badge {
  background: #e8ecf1;
  color: #667eea;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 8px;
}

.note-header h3 { 
  margin: 0; 
  color: #333;
  font-size: 17px;
  flex: 1;
}

.note-actions { display: flex; gap: 4px; flex-shrink: 0; }

.note-actions button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  border-radius: 4px;
}
.btn-edit:hover { background: #e3f2fd; }
.btn-delete:hover { background: #fce4ec; }

.preview-keypoints {
  background: #f8f9fc;
  border-left: 3px solid #667eea;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.preview-keypoints ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #555;
}

.preview-keypoints li {
  line-height: 1.6;
}

.preview-keypoints .more {
  color: #667eea;
  list-style: none;
  font-weight: 500;
}

.note-content {
  color: #333;
  line-height: 1.8;
  font-size: 14px;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 5;
  line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.note-content :deep(h1),
.note-content :deep(h2),
.note-content :deep(h3) {
  margin: 8px 0 4px 0;
}
.note-content :deep(p) { margin: 4px 0; }
.note-content :deep(ul) { padding-left: 20px; margin: 4px 0; }
.note-content :deep(li) { margin-bottom: 2px; }
.note-content :deep(strong) { font-weight: 600; }
.note-content :deep(pre) {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px;
  overflow-x: auto;
}
.note-content :deep(code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.note-content :deep(blockquote) {
  border-left: 4px solid #667eea;
  padding-left: 12px;
  margin: 6px 0;
  color: #666;
}
.note-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-size: 13px;
}
.note-content :deep(th),
.note-content :deep(td) {
  border: 1px solid #e0e0e0;
  padding: 4px 8px;
  text-align: left;
}
.note-content :deep(th) {
  background: #f0f2ff;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.tag {
  font-size: 12px;
  color: #667eea;
  background: #eef0ff;
  padding: 1px 10px;
  border-radius: 12px;
}

.note-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #999;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.empty {
  grid-column: 1/-1;
  text-align: center;
  color: #999;
  padding: 60px 0;
}

.exam-view {
  background: #f8f9fc;
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 10px;
  border: 1px solid #e8ecf1;
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
.form-group textarea,
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus,
.form-select:focus {
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

@media (max-width: 768px) {
  .admin-panel { padding: 12px; }
  .form-row { flex-direction: column; }
  .modal-body { padding: 16px; }
  .modal-header { padding: 16px; flex-wrap: wrap; }
  .modal-footer { padding: 12px 16px; flex-wrap: wrap; }
  .exam-dashboard { grid-template-columns: 1fr; }
  .note-list { grid-template-columns: 1fr; }
}
</style>