-- ============================================================================
-- 003: 录音文件存储桶配置（参考记录）
-- 状态：桶已通过 Supabase Dashboard 手动建好（public）
--       需执行下方 INSERT 策略，让前端签名URL直传可用
-- ============================================================================

-- 1. 创建存储桶（public，访客可通过公开URL播放）
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 启用 storage.objects 的 RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. SELECT 策略：任何人可读取（访客播放录音走 publicURL，不经过RLS）
DROP POLICY IF EXISTS "audio_files_select" ON storage.objects;
CREATE POLICY "audio_files_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-files');

-- 4. INSERT 策略：允许上传（前端无supabase session，用anon身份+签名URL）
--    安全性靠签名URL的path+token保证（后端service_role生成，前端无法伪造路径）
DROP POLICY IF EXISTS "audio_files_insert" ON storage.objects;
CREATE POLICY "audio_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio-files');

-- 5. DELETE 策略：仅 service_role 可删（前端删除走后端 /api/delete-audio 代理）
--    不给普通用户 DELETE 权限，防止前端直接删除
--    （service_role 绕过 RLS，无需策略）

-- 验证：应返回 audio-files 一行，public = true
SELECT id, name, public FROM storage.buckets WHERE id = 'audio-files';

-- 验证：应返回 SELECT + INSERT 两条策略
SELECT policyname, cmd FROM pg_policies
 WHERE tablename = 'objects' AND schemaname = 'storage'
   AND policyname LIKE 'audio_files_%';
