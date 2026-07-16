<template>
  <div class="pagination" v-if="total > pageSize">
    <div class="pagination-info">
      <span>显示 {{ Math.min((currentPage - 1) * pageSize + 1, total) }} - {{ Math.min(currentPage * pageSize, total) }} 条</span>
      <span class="pagination-total">共 {{ total }} 条</span>
    </div>
    
    <div class="pagination-controls">
      <button 
        class="pagination-btn" 
        :disabled="currentPage <= 1"
        @click="$emit('update:currentPage', currentPage - 1)"
      >
        ←
      </button>
      
      <div class="page-numbers">
        <button 
          v-for="page in visiblePages" 
          :key="page"
          class="page-btn"
          :class="{ active: page === currentPage, dots: page === '...' }"
          @click="page !== '...' && $emit('update:currentPage', page)"
        >
          {{ page }}
        </button>
      </div>
      
      <button 
        class="pagination-btn" 
        :disabled="currentPage >= totalPages"
        @click="$emit('update:currentPage', currentPage + 1)"
      >
        →
      </button>
    </div>
    
    <div class="pagination-size">
      <span>每页</span>
      <select :value="pageSize" @change="$emit('update:pageSize', Number($event.target.value))">
        <option :value="10">10条</option>
        <option :value="20">20条</option>
        <option :value="50">50条</option>
        <option :value="100">100条</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  pageSize: {
    type: Number,
    default: 10
  },
  total: {
    type: Number,
    required: true
  }
})

defineEmits(['update:currentPage', 'update:pageSize'])

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = props.currentPage
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }
  
  if (current <= 3) {
    pages.push(1, 2, 3, '...', total)
  } else if (current >= total - 2) {
    pages.push(1, '...', total - 2, total - 1, total)
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total)
  }
  
  return pages
})
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 20px 0;
  flex-wrap: wrap;
}

.pagination-info {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: #666;
}

.pagination-total {
  color: #999;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 2px;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  transition: all 0.2s;
}

.page-btn:hover:not(.dots) {
  background: #f0f2ff;
  color: #667eea;
}

.page-btn.active {
  background: #667eea;
  color: white;
}

.page-btn.dots {
  cursor: default;
  color: #999;
}

.page-btn.dots:hover {
  background: transparent;
  color: #999;
}

.pagination-size {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.pagination-size select {
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  cursor: pointer;
}

.pagination-size select:focus {
  outline: none;
  border-color: #667eea;
}
</style>