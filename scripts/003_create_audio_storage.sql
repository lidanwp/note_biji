-- ============================================================================
-- 003: 录音文件存储桶配置（参考记录）
-- 状态：已通过 Supabase Dashboard 手动配置完成，此文件无需执行，仅作记录
-- 实际配置：
--   - 桶名：audio-files，类型：public（访客可通过公开URL播放）
--   - RLS SELECT：仅 authenticated 可读取（影响 list/signedUrl，不影响 publicURL 直读）
--   - 无 INSERT/UPDATE/DELETE 策略：普通用户无写入权限
-- 写入方案：上传/删除经后端 /api/upload-audio、/api/delete-audio 用 service_role 执行
-- ============================================================================

-- 1. 创建存储桶（public，访客可读）
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 启用 storage.objects 的 RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. SELECT 策略：任何人可读取 audio-files 桶（访客播放录音）
DROP POLICY IF EXISTS "audio_files_public_read" ON storage.objects;
CREATE POLICY "audio_files_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-files');

-- 4. INSERT 策略：登录用户可上传
DROP POLICY IF EXISTS "audio_files_auth_insert" ON storage.objects;
CREATE POLICY "audio_files_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'audio-files');

-- 5. UPDATE 策略：登录用户可修改
DROP POLICY IF EXISTS "audio_files_auth_update" ON storage.objects;
CREATE POLICY "audio_files_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'audio-files')
  WITH CHECK (bucket_id = 'audio-files');

-- 6. DELETE 策略：登录用户可删除（编辑端删除录音时同步清理 Storage）
DROP POLICY IF EXISTS "audio_files_auth_delete" ON storage.objects;
CREATE POLICY "audio_files_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'audio-files');

-- 验证：应返回 audio-files 一行，public = true
SELECT id, name, public FROM storage.buckets WHERE id = 'audio-files';

-- 验证：应返回 4 条策略
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname LIKE 'audio_files_%';
