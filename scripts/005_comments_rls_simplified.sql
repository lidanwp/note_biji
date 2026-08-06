-- ================================================
-- comments 表 RLS 策略 —— 简化版
-- 说明：API 层已自行鉴权，RLS 只需放行 API 请求
-- 执行方式：在 Supabase 控制台 → SQL Editor 中运行
-- ================================================

-- 启用 RLS
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;

-- 清除所有现有策略
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
DROP POLICY IF EXISTS "comments_delete_own" ON comments;

-- SELECT：所有人可读取
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  USING (true);

-- INSERT：API 层已自行鉴权，RLS 放行
CREATE POLICY "comments_insert"
  ON comments FOR INSERT
  USING (true);

-- UPDATE：API 层已自行鉴权，RLS 放行
CREATE POLICY "comments_update"
  ON comments FOR UPDATE
  USING (true);

-- DELETE：API 层已自行鉴权，RLS 放行
CREATE POLICY "comments_delete"
  ON comments FOR DELETE
  USING (true);

-- ================================================
-- 验证策略
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE tablename = 'comments';
-- ================================================
