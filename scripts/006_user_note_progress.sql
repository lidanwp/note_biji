-- 用户 - 笔记掌握度进度表
-- 目标：每个用户对每个章节的掌握度独立存储，不能互相覆盖

CREATE TABLE IF NOT EXISTS user_note_progress (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  note_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, note_id)
);

CREATE INDEX IF NOT EXISTS idx_user_note_progress_user_id
  ON user_note_progress (user_id);

CREATE INDEX IF NOT EXISTS idx_user_note_progress_note_id
  ON user_note_progress (note_id);

ALTER TABLE user_note_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_note_progress_select_own" ON user_note_progress;
CREATE POLICY "user_note_progress_select_own"
  ON user_note_progress
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_note_progress_insert_own" ON user_note_progress;
CREATE POLICY "user_note_progress_insert_own"
  ON user_note_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_note_progress_update_own" ON user_note_progress;
CREATE POLICY "user_note_progress_update_own"
  ON user_note_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_note_progress_delete_own" ON user_note_progress;
CREATE POLICY "user_note_progress_delete_own"
  ON user_note_progress
  FOR DELETE
  USING (auth.uid() = user_id);
