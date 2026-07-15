<template>
  <div class="cs-wrapper" ref="wrapperRef">
    <!-- Trigger -->
    <div
      class="cs-trigger"
      :class="{ 'cs-open': isOpen, 'cs-disabled': disabled }"
      @click="toggle"
      role="combobox"
      :aria-expanded="isOpen"
      tabindex="0"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
      @keydown.escape.prevent="close"
    >
      <span class="cs-value" :class="{ 'cs-placeholder': !selectedLabel }">
        {{ selectedLabel || placeholder }}
      </span>
      <svg
        class="cs-arrow"
        :class="{ 'cs-arrow-open': isOpen }"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>

    <!-- PC Dropdown -->
    <Transition name="cs-dropdown">
      <div v-if="isOpen && !isMobile" class="cs-dropdown" @click.stop>
        <template v-for="item in flatOptions" :key="item.__isGroup ? `g-${item.label}` : item.value">
          <div v-if="item.__isGroup" class="cs-optgroup">
            {{ item.label }}
          </div>
          <div
            v-else
            class="cs-option"
            :class="{ 'cs-option-selected': modelValue === item.value }"
            @click="select(item.value)"
          >
            <span>{{ item.label }}</span>
            <span v-if="modelValue === item.value" class="cs-check">✓</span>
          </div>
        </template>
      </div>
    </Transition>

    <!-- Mobile Bottom Sheet -->
    <Teleport to="body">
      <Transition name="cs-mobile">
        <div v-if="isOpen && isMobile" class="cs-overlay" @click="close">
          <div class="cs-sheet" @click.stop>
            <div class="cs-sheet-handle"></div>
            <div class="cs-sheet-header">{{ placeholder }}</div>
            <div class="cs-sheet-body">
              <template v-for="item in flatOptions" :key="item.__isGroup ? `g-${item.label}` : item.value">
                <div v-if="item.__isGroup" class="cs-sheet-optgroup">
                  {{ item.label }}
                </div>
                <div
                  v-else
                  class="cs-sheet-option"
                  :class="{ 'cs-option-selected': modelValue === item.value }"
                  @click="select(item.value)"
                >
                  <span>{{ item.label }}</span>
                  <span v-if="modelValue === item.value" class="cs-check">✓</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const isMobile = ref(false)
const wrapperRef = ref(null)
let mql = null

const flatOptions = computed(() => {
  const result = []
  for (const opt of props.options) {
    if (opt.group && Array.isArray(opt.items)) {
      result.push({ __isGroup: true, label: opt.group })
      for (const item of opt.items) {
        result.push({ __isGroup: false, value: item.value, label: item.label })
      }
    } else {
      result.push({ __isGroup: false, value: opt.value, label: opt.label })
    }
  }
  return result
})

const selectedLabel = computed(() => {
  if (!props.modelValue && props.modelValue !== 0) return ''
  for (const opt of flatOptions.value) {
    if (opt.__isGroup) continue
    if (opt.value === props.modelValue) return opt.label
  }
  return ''
})

const toggle = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

const select = (value) => {
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

const close = () => {
  isOpen.value = false
}

const handleClickOutside = (e) => {
  if (!isOpen.value) return
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    // Don't close if clicking on the teleported overlay
    const isOverlay = e.target.closest('.cs-overlay')
    if (!isOverlay) {
      isOpen.value = false
    }
  }
}

// Lock body scroll when mobile sheet is open
watch(isOpen, (val) => {
  if (val && isMobile.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  mql = window.matchMedia('(max-width: 768px)')
  isMobile.value = mql.matches
  mql.addEventListener('change', handleMediaChange)
  document.addEventListener('click', handleClickOutside, true)
})

onUnmounted(() => {
  document.body.style.overflow = ''
  if (mql) {
    mql.removeEventListener('change', handleMediaChange)
  }
  document.removeEventListener('click', handleClickOutside, true)
})

const handleMediaChange = (e) => {
  isMobile.value = e.matches
  if (!e.matches) {
    // Closing mobile sheet when resizing to desktop
    // But keep isOpen if it was open — user may have been interacting
  }
}
</script>

<style>
/* ===== Wrapper ===== */
.cs-wrapper {
  position: relative;
  width: 100%;
  min-width: 0;
}

/* ===== Trigger ===== */
.cs-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 2px solid var(--border-color, #e8ecf1);
  border-radius: 8px;
  background: var(--bg-input, #fff);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary, #333);
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
  user-select: none;
  -webkit-user-select: none;
}

.cs-trigger:hover {
  border-color: var(--border-color, #d0d5dd);
}

.cs-trigger:focus,
.cs-trigger:focus-visible,
.cs-trigger.cs-open {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
  outline: none;
}

.cs-trigger.cs-disabled {
  background: var(--bg-hover, #f5f7fa);
  cursor: not-allowed;
  opacity: 0.6;
}

.cs-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-value.cs-placeholder {
  color: var(--text-muted, #999);
}

/* ===== Arrow ===== */
.cs-arrow {
  flex-shrink: 0;
  color: var(--text-muted, #999);
  transition: transform 0.25s ease;
}

.cs-arrow-open {
  transform: rotate(180deg);
}

/* ===== PC Dropdown ===== */
.cs-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-secondary, #fff);
  border: 1px solid var(--border-color, #e8ecf1);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  z-index: 100;
  max-height: 280px;
  overflow-y: auto;
  padding: 6px 0;
}

.cs-dropdown-enter-active,
.cs-dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.cs-dropdown-enter-from,
.cs-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ===== PC Option ===== */
.cs-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary, #333);
  cursor: pointer;
  transition: background 0.15s;
}

.cs-option:hover {
  background: var(--bg-hover, #f5f7fa);
}

.cs-option:active {
  background: var(--accent-light, #eef0ff);
}

.cs-option-selected {
  color: #667eea;
  font-weight: 500;
}

.cs-check {
  color: #667eea;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

/* ===== Optgroup ===== */
.cs-optgroup {
  padding: 8px 14px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #999);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* ===== Mobile Overlay ===== */
.cs-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.cs-mobile-enter-active {
  transition: opacity 0.25s ease;
}
.cs-mobile-leave-active {
  transition: opacity 0.2s ease;
}
.cs-mobile-enter-from,
.cs-mobile-leave-to {
  opacity: 0;
}

.cs-mobile-enter-active .cs-sheet {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.cs-mobile-enter-to .cs-sheet {
  transform: translateY(0);
}
.cs-mobile-enter-from .cs-sheet {
  transform: translateY(100%);
}

.cs-mobile-leave-active .cs-sheet {
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.cs-mobile-leave-to .cs-sheet {
  transform: translateY(100%);
}
.cs-mobile-leave-from .cs-sheet {
  transform: translateY(0);
}

/* ===== Bottom Sheet ===== */
.cs-sheet {
  width: 100%;
  max-width: 100%;
  background: var(--bg-secondary, #fff);
  border-radius: 20px 20px 0 0;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 12px);
}

.cs-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-color, #ddd);
  margin: 10px auto 4px;
  flex-shrink: 0;
}

.cs-sheet-header {
  padding: 8px 20px 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #333);
  text-align: center;
  border-bottom: 1px solid var(--border-light, #f0f0f0);
  flex-shrink: 0;
}

.cs-sheet-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 0;
}

/* ===== Mobile Option ===== */
.cs-sheet-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  font-size: 16px;
  color: var(--text-primary, #333);
  cursor: pointer;
  transition: background 0.15s;
}

.cs-sheet-option:hover,
.cs-sheet-option:active {
  background: var(--bg-hover, #f5f7fa);
}

.cs-sheet-option.cs-option-selected {
  color: #667eea;
  font-weight: 600;
}

.cs-sheet-option .cs-check {
  font-size: 16px;
}

/* ===== Mobile Optgroup ===== */
.cs-sheet-optgroup {
  padding: 12px 20px 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted, #999);
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .cs-trigger {
    min-height: 48px;
    font-size: 15px;
    padding: 10px 14px;
  }
}

@media (min-width: 769px) {
  .cs-trigger {
    font-size: 14px;
  }
}
</style>
