-- ===== 迁移脚本：为 notes 表新增 phase 与 related_notes 字段 =====
-- 目的：支持「阶段上下文感知」与「知识图谱依赖推理」检索
--   phase          : 该笔记所属主要阶段 启动/规划/执行/监控/收尾
--   related_notes  : 关联笔记数组，每项 {targetId, relation, description}
--                    relation 可为 depends_on / produces / precedes / contrasts_with / supports
--
-- 执行方式：在 Supabase Dashboard 的 SQL Editor 中运行

-- 1. 新增 phase 字段（允许为空，便于历史笔记渐进补全）
ALTER TABLE IF EXISTS notes
  ADD COLUMN IF NOT EXISTS phase TEXT;

-- 可选：加 CHECK 约束限定取值（注释保留，如需启用取消注释）
-- ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_phase_check;
-- ALTER TABLE notes ADD CONSTRAINT notes_phase_check
--   CHECK (phase IS NULL OR phase IN ('启动','规划','执行','监控','收尾'));

-- 2. 新增 related_notes 字段（JSONB 数组，默认空数组）
ALTER TABLE IF EXISTS notes
  ADD COLUMN IF NOT EXISTS related_notes JSONB DEFAULT '[]'::jsonb;

-- 3. 为历史数据回填默认值（NULL -> 空数组，避免检索时判空麻烦）
UPDATE notes SET related_notes = '[]'::jsonb WHERE related_notes IS NULL;

-- 4. 为 phase 建索引（阶段定向检索会按 phase 过滤）
CREATE INDEX IF NOT EXISTS idx_notes_phase ON notes(phase);

-- 验证
SELECT 'notes 表已新增 phase / related_notes 字段' AS result;
SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_name = 'notes' AND column_name IN ('phase','related_notes');
