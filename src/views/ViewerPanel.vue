<template>
  <div class="viewer-panel">
    <header>
      <h1>📖 知识分享</h1>
      <div class="header-right">
        <span class="user-info">👤 {{ authStore.user?.username }}</span>
        <button @click="logout" class="logout-btn">退出</button>
      </div>
    </header>

    <!-- 统计信息 -->
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
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <input 
        type="text" 
        v-model="search" 
        placeholder="🔍 搜索标题、内容、标签..."
        class="search-input"
      >
      <select v-model="categoryFilter" class="category-select">
        <option value="">📂 全部分类</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
      <select v-model="difficultyFilter" class="difficulty-select">
        <option value="">📊 全部难度</option>
        <option value="初级">🌱 初级</option>
        <option value="中级">🔥 中级</option>
        <option value="高级">🚀 高级</option>
      </select>
      <!-- 考试模式切换 -->
      <div class="exam-toggle">
        <label class="switch">
          <input type="checkbox" v-model="examMode">
          <span class="slider"></span>
        </label>
        <span class="toggle-label">🎯 考试模式</span>
      </div>
    </div>

    <!-- 考点看板（考试模式下显示） -->
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

    <!-- 笔记列表 -->
    <div class="note-grid">
      <div v-for="note in filteredNotes" :key="note.id" class="note-card">
        <!-- 难度标签 -->
        <div class="note-badges">
          <span v-if="note.difficulty" class="badge difficulty" 
                :class="note.difficulty">
            {{ note.difficulty }}
          </span>
          <span class="badge category">{{ note.category || '未分类' }}</span>
          <span v-if="note.examScore != null" class="badge mastery-badge">
            🎯 {{ note.examScore }}%
          </span>
        </div>

        <!-- 标题 -->
        <h3 class="note-title">{{ note.title }}</h3>

        <!-- 核心要点 -->
        <div v-if="note.keyPoints && note.keyPoints.length" class="key-points">
          <div class="key-points-label">💡 核心要点</div>
          <ul>
            <li v-for="(point, idx) in note.keyPoints" :key="idx">
              {{ point }}
            </li>
          </ul>
        </div>

        <!-- 内容预览（支持 Markdown） -->
        <div class="note-preview markdown-body" v-html="renderMarkdown(note.content)"></div>

        <!-- 标签 -->
        <div v-if="note.tags && note.tags.length" class="tags">
          <span v-for="tag in note.tags" :key="tag" class="tag">
            #{{ tag }}
          </span>
        </div>

        <!-- ===== 考试视图 ===== -->
        <div v-if="examMode && note.examMapping" class="exam-view">
          <!-- 过程组标签 -->
          <div v-if="note.examMapping.relatedProcesses?.length" class="exam-process">
            <span class="process-label">📋 关联：</span>
            <span class="process-tag" v-for="p in note.examMapping.relatedProcesses" :key="p">
              {{ p }}
            </span>
          </div>
          
          <!-- 典型考法 -->
          <div v-if="note.examMapping.typicalQuestions?.length" class="exam-section">
            <span class="section-label">📝 典型考法：</span>
            <ul>
              <li v-for="q in note.examMapping.typicalQuestions" :key="q">{{ q }}</li>
            </ul>
          </div>
          
          <!-- 常见陷阱 -->
          <div v-if="note.examMapping.commonPitfalls?.length" class="exam-section pitfall">
            <span class="section-label">⚠️ 常见陷阱：</span>
            <ul>
              <li v-for="p in note.examMapping.commonPitfalls" :key="p">{{ p }}</li>
            </ul>
          </div>
          
          <!-- 易混对比表 -->
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
          
          <!-- 记忆辅助 - 多行展示 -->
          <div v-if="note.memoryAids?.length" class="memory-box">
            <div v-for="(item, index) in note.memoryAids" :key="index" class="memory-item">
              {{ item }}
            </div>
          </div>
          
          <!-- 掌握度 -->
          <div v-if="note.examScore != null" class="mastery-bar">
            <span>掌握度</span>
            <div class="bar"><div :style="{ width: note.examScore + '%' }"></div></div>
            <span class="score">{{ note.examScore }}%</span>
          </div>
        </div>

        <!-- 底部信息 -->
        <div class="note-footer">
          <div class="footer-left">
            <span>📅 {{ note.date }}</span>
          </div>
          <div class="footer-right">
            <span class="stat">👁️ {{ note.viewCount || 0 }}</span>
            <span class="stat">👍 {{ note.usefulCount || 0 }}</span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="note-actions">
          <button @click="viewDetail(note)" class="btn-view">
            查看全文 →
          </button>
        </div>
      </div>

      <div v-if="filteredNotes.length === 0" class="empty">
        <div class="empty-icon">📭</div>
        <p>暂无匹配的笔记</p>
        <span class="empty-hint">试试调整筛选条件</span>
      </div>
    </div>

    <!-- 笔记详情弹窗 -->
    <div v-if="selectedNote" class="modal-overlay" @click="closeDetail">
      <div class="modal-detail" @click.stop>
        <button class="modal-close" @click="closeDetail">✕</button>
        
        <div class="detail-header">
          <span class="detail-category">{{ selectedNote.category }}</span>
          <h2>{{ selectedNote.title }}</h2>
          <div class="detail-meta">
            <span>📅 {{ selectedNote.date }}</span>
            <span>👁️ {{ selectedNote.viewCount || 0 }}次浏览</span>
            <span v-if="selectedNote.examScore != null" class="meta-score">🎯 掌握度 {{ selectedNote.examScore }}%</span>
          </div>
        </div>

        <!-- 核心要点 -->
        <div v-if="selectedNote.keyPoints?.length" class="detail-keypoints">
          <h4>💡 核心要点</h4>
          <ul>
            <li v-for="(point, idx) in selectedNote.keyPoints" :key="idx">
              {{ point }}
            </li>
          </ul>
        </div>

        <!-- 适用场景 -->
        <div v-if="selectedNote.scenario" class="detail-scenario">
          <h4>📌 适用场景</h4>
          <p>{{ selectedNote.scenario }}</p>
        </div>

        <!-- 详细内容（支持 Markdown） -->
        <div class="detail-content markdown-body" v-html="renderMarkdown(selectedNote.content)">
        </div>

        <!-- 实战案例 -->
        <div v-if="selectedNote.caseStudy" class="detail-case">
          <h4>💡 实战案例</h4>
          <div class="case-content">{{ selectedNote.caseStudy }}</div>
        </div>

        <!-- 考点专项（详情弹窗中） -->
        <div v-if="examMode && selectedNote.examMapping" class="detail-exam">
          <h4>🎯 考点专项</h4>
          <!-- 过程组 -->
          <div v-if="selectedNote.examMapping.relatedProcesses?.length" class="detail-exam-item">
            <span class="exam-label">📋 关联过程组：</span>
            <span class="process-tag" v-for="p in selectedNote.examMapping.relatedProcesses" :key="p">
              {{ p }}
            </span>
          </div>
          <!-- 典型考法 -->
          <div v-if="selectedNote.examMapping.typicalQuestions?.length" class="detail-exam-item">
            <span class="exam-label">📝 典型考法：</span>
            <ul>
              <li v-for="q in selectedNote.examMapping.typicalQuestions" :key="q">{{ q }}</li>
            </ul>
          </div>
          <!-- 常见陷阱 -->
          <div v-if="selectedNote.examMapping.commonPitfalls?.length" class="detail-exam-item pitfall">
            <span class="exam-label">⚠️ 常见陷阱：</span>
            <ul>
              <li v-for="p in selectedNote.examMapping.commonPitfalls" :key="p">{{ p }}</li>
            </ul>
          </div>
          <!-- 易混对比表 -->
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
          <!-- 记忆辅助 -->
          <div v-if="selectedNote.memoryAids?.length" class="memory-box">
            <div v-for="(item, index) in selectedNote.memoryAids" :key="index" class="memory-item">
              {{ item }}
            </div>
          </div>
        </div>

        <!-- 附件 -->
        <div v-if="selectedNote.attachments?.length" class="detail-attachments">
          <h4>📎 附件资源</h4>
          <ul>
            <li v-for="file in selectedNote.attachments" :key="file">
              <a href="#">{{ file }}</a>
            </li>
          </ul>
        </div>

        <!-- 标签 -->
        <div v-if="selectedNote.tags?.length" class="detail-tags">
          <span v-for="tag in selectedNote.tags" :key="tag" class="tag">
            #{{ tag }}
          </span>
        </div>

        <!-- 互动 -->
        <div class="detail-actions">
          <button @click="markUseful(selectedNote)" class="btn-useful">
            👍 有用 ({{ selectedNote.usefulCount || 0 }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import MarkdownIt from 'markdown-it'
import { loadNotesFromCloud, updateViewCount, updateUsefulCount } from '../services/supabase'

const router = useRouter()
const authStore = useAuthStore()

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

const loadNotes = async () => {
  try {
    const cloudData = await loadNotesFromCloud()
    notes.value = cloudData.map(n => ({
      ...n,
      keyPoints: n.keyPoints || [],
      tags: n.tags || [],
      difficulty: n.difficulty || '中级',
      viewCount: n.viewCount || 0,
      usefulCount: n.usefulCount || 0,
      examMapping: n.examMapping || { relatedProcesses: [], typicalQuestions: [], commonPitfalls: [] },
      comparisonTable: n.comparisonTable || { enabled: false, title: '', cols: [], rows: [] },
      memoryAids: (() => {
        if (Array.isArray(n.memoryAids)) return n.memoryAids
        if (n.memoryAids && typeof n.memoryAids === 'object') {
          const arr = []
          if (n.memoryAids.mnemonic) arr.push(`🧠 口诀：${n.memoryAids.mnemonic}`)
          if (n.memoryAids.formula) arr.push(`📐 公式：${n.memoryAids.formula}`)
          if (n.memoryAids.mindMap) arr.push(`🗺️ 脉络：${n.memoryAids.mindMap}`)
          return arr
        }
        return []
      })(),
      examScore: n.examScore != null ? Number(n.examScore) : 0
    }))
  } catch (e) {
    console.error('❌ 云端加载失败:', e.message)
    notes.value = []
  }
}

const viewDetail = async (note) => {
  // 更新本地
  const newViewCount = (note.viewCount || 0) + 1
  note.viewCount = newViewCount
  selectedNote.value = note
  
  // 同步到云端
  try {
    await updateViewCount(note.id, newViewCount)
  } catch (e) {
    console.error('❌ 更新浏览量失败:', e.message)
  }
}

const closeDetail = () => {
  selectedNote.value = null
}

const markUseful = async (note) => {
  // 更新本地
  const newUsefulCount = (note.usefulCount || 0) + 1
  note.usefulCount = newUsefulCount
  selectedNote.value = { ...note }
  
  // 同步到云端
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
  }
  await loadNotes()
})
</script>

<style scoped>
.viewer-panel {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 24px;
}

/* ===== 头部 ===== */
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

header h1 { 
  font-size: 24px; 
  color: #333;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-info {
  color: #666;
}

.logout-btn {
  padding: 8px 20px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.logout-btn:hover { background: #c0392b; }

/* ===== 统计栏 ===== */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  max-width: 600px;
}

.stat-item {
  background: white;
  padding: 16px;
  border-radius: 10px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.stat-number {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 4px;
}

/* ===== 筛选栏 ===== */
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  transition: border-color 0.2s;
}
.search-input:focus {
  border-color: #667eea;
  outline: none;
}

.category-select,
.difficulty-select {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 15px;
  background: white;
  min-width: 140px;
}

/* 考试模式切换 */
.exam-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  background: #f0f2ff;
  border-radius: 24px;
  border: 2px solid #e0e0e0;
}

.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #ccc;
  border-radius: 22px;
  transition: 0.3s;
}
.slider:before {
  content: "";
  position: absolute;
  height: 16px; width: 16px;
  left: 3px; bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}
.switch input:checked + .slider { background: #667eea; }
.switch input:checked + .slider:before { transform: translateX(18px); }

.toggle-label {
  font-size: 13px;
  color: #555;
  white-space: nowrap;
}

/* ===== 考点看板 ===== */
.exam-dashboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
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

/* ===== 笔记卡片 ===== */
.note-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
}

.note-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  transition: transform 0.3s, box-shadow 0.3s;
  display: flex;
  flex-direction: column;
}
.note-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);
}

/* 标签组 */
.note-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
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

.badge.difficulty {
  background: #d4edda;
  color: #155724;
}
.badge.difficulty.初级 { background: #d4edda; color: #155724; }
.badge.difficulty.中级 { background: #fff3cd; color: #856404; }
.badge.difficulty.高级 { background: #f8d7da; color: #721c24; }

.badge.mastery-badge {
  background: #e8ecf1;
  color: #667eea;
}

/* 标题 */
.note-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #333;
  line-height: 1.4;
}

/* 核心要点 */
.key-points {
  background: #f8f9fc;
  border-left: 3px solid #667eea;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 4px;
}

.key-points-label {
  font-size: 12px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 4px;
}

.key-points ul {
  margin: 0;
  padding-left: 18px;
}

.key-points li {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
}

/* 内容预览 */
.note-preview {
  color: #666;
  line-height: 1.7;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-clamp: 3;
  margin-bottom: 12px;
  flex: 1;
}

.note-preview :deep(h1),
.note-preview :deep(h2),
.note-preview :deep(h3) {
  margin: 4px 0;
}
.note-preview :deep(p) { margin: 4px 0; }
.note-preview :deep(ul) { padding-left: 18px; margin: 4px 0; }
.note-preview :deep(li) { margin-bottom: 2px; }

/* 标签 */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.tag {
  font-size: 12px;
  color: #667eea;
  background: #eef0ff;
  padding: 2px 10px;
  border-radius: 12px;
}

/* ===== 考试视图 ===== */
.exam-view {
  background: #f8f9fc;
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 4px;
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
  padding-left: 18px;
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
.comparison-box h4, .comparison-box h5 { margin: 0 0 6px 0; font-size: 14px; }
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
  padding: 8px 12px;
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

/* 底部 */
.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid #eee;
  font-size: 13px;
  color: #999;
}

.footer-left {
  display: flex;
  gap: 16px;
}

.footer-right {
  display: flex;
  gap: 12px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 操作按钮 */
.note-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.btn-view {
  flex: 1;
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
}
.btn-view:hover { opacity: 0.9; }

/* ===== 空状态 ===== */
.empty {
  grid-column: 1/-1;
  text-align: center;
  padding: 80px 0;
}

.empty-icon { font-size: 48px; }
.empty p { color: #999; font-size: 18px; margin: 12px 0; }
.empty-hint { color: #ccc; font-size: 14px; }

/* ===== 详情弹窗 ===== */
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

.modal-detail {
  background: white;
  padding: 40px;
  border-radius: 16px;
  width: 100%;
  max-width: 780px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-close {
  position: sticky;
  top: 0;
  float: right;
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  padding: 0 8px;
}
.modal-close:hover { color: #333; }

.detail-header { margin-bottom: 24px; }

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
.detail-exam-item.pitfall ul { color: #c0392b; }

.detail-content {
  line-height: 1.9;
  color: #444;
  margin-bottom: 24px;
  font-size: 15px;
}
.detail-content :deep(h1) { font-size: 26px; margin: 20px 0 10px; }
.detail-content :deep(h2) { font-size: 22px; margin: 18px 0 8px; }
.detail-content :deep(h3) { font-size: 18px; margin: 16px 0 8px; color: #333; }
.detail-content :deep(ul) { padding-left: 20px; }
.detail-content :deep(li) { margin-bottom: 6px; }
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
.detail-attachments a:hover { text-decoration: underline; }

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
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
.btn-useful:hover { background: #5a6fd6; }

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .viewer-panel { padding: 12px; }
  .stats-bar { grid-template-columns: 1fr; max-width: 100%; }
  .filter-bar { flex-direction: column; }
  .filter-bar .search-input { width: 100%; }
  .exam-dashboard { grid-template-columns: 1fr; }
  .modal-detail { padding: 20px; }
}
</style>