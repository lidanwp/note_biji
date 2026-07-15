export function migrateNote(note) {
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
  if (!note.keyPoints) {
    note.keyPoints = []
  }
  if (!note.tags) {
    note.tags = []
  }
  if (!note.difficulty) {
    note.difficulty = '中级'
  }
  if (!note.viewCount) {
    note.viewCount = 0
  }
  if (!note.usefulCount) {
    note.usefulCount = 0
  }
  return note
}