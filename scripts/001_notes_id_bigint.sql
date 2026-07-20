-- ===== 迁移脚本：将 notes 表的 id 列从 integer 改为 bigint =====
-- 原因：Date.now() 生成的 ID（如 1784084481096）超过了 PostgreSQL integer 的最大值（2147483647）

-- 1. 创建临时表备份数据
CREATE TABLE IF NOT EXISTS notes_backup AS SELECT * FROM notes;

-- 2. 删除依赖于 notes_pkey 的外键约束
ALTER TABLE IF EXISTS reading_history DROP CONSTRAINT IF EXISTS fk_history_note;
ALTER TABLE IF EXISTS bookmarks DROP CONSTRAINT IF EXISTS fk_bookmark_note;
ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS fk_comments_note;

-- 3. 删除原表的主键约束
ALTER TABLE IF EXISTS notes DROP CONSTRAINT IF EXISTS notes_pkey;

-- 4. 将 notes 表的 id 列改为 bigint
ALTER TABLE IF EXISTS notes ALTER COLUMN id TYPE bigint;

-- 5. 更新引用 notes.id 的外键列类型
ALTER TABLE IF EXISTS reading_history ALTER COLUMN note_id TYPE bigint;
ALTER TABLE IF EXISTS bookmarks ALTER COLUMN note_id TYPE bigint;
ALTER TABLE IF EXISTS comments ALTER COLUMN note_id TYPE bigint;

-- 6. 重新添加主键约束
ALTER TABLE IF EXISTS notes ADD CONSTRAINT notes_pkey PRIMARY KEY (id);

-- 7. 重新创建外键约束
ALTER TABLE IF EXISTS reading_history ADD CONSTRAINT fk_history_note FOREIGN KEY (note_id) REFERENCES notes(id);
ALTER TABLE IF EXISTS bookmarks ADD CONSTRAINT fk_bookmark_note FOREIGN KEY (note_id) REFERENCES notes(id);
ALTER TABLE IF EXISTS comments ADD CONSTRAINT fk_comments_note FOREIGN KEY (note_id) REFERENCES notes(id);

-- 验证迁移
SELECT 'notes 表 id 列类型迁移完成' AS result;
SELECT data_type FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'id';
