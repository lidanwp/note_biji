-- ================================================
-- comments 表 RLS 策略配置
-- 执行方式：在 Supabase 控制台 → SQL Editor 中运行
-- 目的：确保用户只能删除自己的评论
-- ================================================

-- 1. 启用 RLS（如果尚未启用）
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;

-- 2. 删除所有现有策略（重新配置）
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;

-- 3. SELECT 策略：所有人可读取评论（包括访客）
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  USING (true);

-- 4. INSERT 策略：只有登录用户可插入评论
CREATE POLICY "comments_insert"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- 5. UPDATE 策略：只有作者本人可更新评论
CREATE POLICY "comments_update"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- 6. DELETE 策略：只有作者本人可删除自己的评论
CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- ================================================
-- 验证：查询所有策略
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'comments';
-- ================================================
