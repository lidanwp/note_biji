-- ============================================================================
-- 007: 锁定数据库 —— 关闭匿名直连（修复 Supabase 安全告警）
-- 日期: 2026-09-16
-- ----------------------------------------------------------------------------
-- 【为什么要这么做】
-- 本项目的架构是：前端不直连数据库，所有数据访问都经 Vercel API（api/*.js）转发
-- （见 src/services/supabase.js 顶部注释：只用 Storage 签名 URL，数据操作全走 /api/*）。
-- 但 API 层此前用的是 anon key 直连 PostgREST，会受 RLS 约束；为了把功能跑通，
-- scripts/005 把 comments 的策略改成了 USING (true)（对所有人放行），
-- 效果等同于把数据库对全网开放 —— 这就是 Supabase 告警的来源。
--
-- 【正确的做法】
-- 既然服务端是唯一的数据库客户端，就应该：
--   1) API 层改用 service_role key（绕过 RLS，仅存于服务端环境变量，不下发浏览器）
--   2) 数据库开启 RLS 且【不给 anon / authenticated 任何策略】→ 匿名直连一律拒绝
-- 本次改动只做第 2 步（第 1 步已在代码里同步完成）。
--
-- 【执行前置条件（重要）】
-- Vercel 项目环境变量里必须存在 SUPABASE_SERVICE_ROLE_KEY。
-- 判断依据：api/audio.js 已经硬依赖它（缺了录音上传功能就直接 500），
--           api/comments.js / api/user-progress.js 也优先读它。
-- 请先在 Vercel → Settings → Environment Variables 确认它存在，再执行本脚本。
--
-- 【执行方式】Supabase 控制台 → SQL Editor → 整段粘贴 → Run
-- ============================================================================


-- ---------- 0. 执行前：看一眼当前状态（可选，仅查询） ----------
-- 期望看到：rls_enabled 大多为 false，或 policy_count 里有大量 USING(true) 的策略
select c.relname                                             as table_name,
       c.relrowsecurity                                      as rls_enabled,
       coalesce(count(p.policyname), 0)                      as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p
         on p.schemaname = 'public' and p.tablename = c.relname
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relname in ('users','sessions','notes','comments','user_note_progress','reading_history','bookmarks','notes_backup')
 group by 1, 2
 order by 1;


begin;

-- ---------- 1. 所有业务表开启 RLS ----------
-- 幂等：已开启的表再执行一次不会有副作用
alter table if exists public.users              enable row level security;
alter table if exists public.sessions           enable row level security;
alter table if exists public.notes              enable row level security;
alter table if exists public.comments           enable row level security;
alter table if exists public.user_note_progress enable row level security;
alter table if exists public.reading_history    enable row level security;
alter table if exists public.bookmarks          enable row level security;
alter table if exists public.notes_backup       enable row level security;

-- ---------- 2. 删掉「对所有人放行」的策略 ----------
-- 2.1 先精确删掉 005_comments_rls_simplified.sql 建的那 4 条
drop policy if exists "comments_select" on public.comments;
drop policy if exists "comments_insert" on public.comments;
drop policy if exists "comments_update" on public.comments;
drop policy if exists "comments_delete_own" on public.comments;
drop policy if exists "comments_delete" on public.comments;

-- 2.2 再兜底扫一遍：任何 USING/WITH CHECK 为 true 的策略（等于无条件放行）全部清掉
--     注意：user_note_progress 上那些 auth.uid() = user_id 的策略不匹配此条件，会被保留
--     （它们不会对匿名请求生效，留着无害，日后若改为前端直连可复用）
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('users','sessions','notes','comments','user_note_progress','reading_history','bookmarks','notes_backup')
       and coalesce(qual, 'true')       = 'true'
       and coalesce(with_check, 'true') = 'true'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice '已删除宽松策略: %.% -> %', p.schemaname, p.tablename, p.policyname;
  end loop;
end $$;

-- ---------- 3. 撤销 anon / authenticated 的表权限（双保险） ----------
-- 开启 RLS 已经能挡住匿名访问；这里再把角色权限也撤掉，
-- 即使日后有人误把 RLS 关掉（ALTER TABLE ... DISABLE ROW LEVEL SECURITY），
-- 匿名角色依然没有表权限，仍然读不到数据。
revoke all on public.users              from anon, authenticated;
revoke all on public.sessions           from anon, authenticated;
revoke all on public.notes              from anon, authenticated;
revoke all on public.comments           from anon, authenticated;
revoke all on public.user_note_progress from anon, authenticated;
revoke all on public.reading_history    from anon, authenticated;
revoke all on public.bookmarks          from anon, authenticated;
revoke all on public.notes_backup       from anon, authenticated;

-- 序列权限也撤掉：否则匿名角色仍可通过 sequence 探测行数/消耗 ID
revoke all on all sequences in schema public from anon, authenticated;

commit;


-- ---------- 4. 执行后：验证 ----------
-- 期望：rls_enabled 全为 true；comments / notes / sessions 的 policy_count 为 0
select c.relname                                             as table_name,
       c.relrowsecurity                                      as rls_enabled,
       coalesce(count(p.policyname), 0)                      as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policies p
         on p.schemaname = 'public' and p.tablename = c.relname
 where n.nspname = 'public'
   and c.relkind = 'r'
   and c.relname in ('users','sessions','notes','comments','user_note_progress','reading_history','bookmarks','notes_backup')
 group by 1, 2
 order by 1;

-- 期望：anon / authenticated 对角色的表级权限为空（只剩 service_role 等）
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('users','sessions','notes','comments','user_note_progress')
   and grantee in ('anon','authenticated')
 group by 1, 2
 order by 1, 2;
-- 上面这条查询「一行都不返回」= 匿名角色已无任何表权限，符合预期。


-- ============================================================================
-- 5.【可选清理】历史遗留对象 —— 删数据不可逆，请先备份、确认后再单独执行
-- ----------------------------------------------------------------------------
-- 以下对象全仓 grep 确认已无代码引用，且其中含曾经暴露过的敏感数据：
--   sessions        : 54 行历史会话 token（token 曾被匿名可读 → 一律视为已泄露）
--   notes_backup    : notes 表的整表副本
--   reading_history : 无任何引用
--   bookmarks       : 无任何引用
--   users.password  : 旧的 scrypt 口令散列列
--   users.username  : 旧的账号名列（现改用 Supabase Auth 的 email）
-- 注意：users 表本身不要删，登录流程仍会读它的 role / display_name。
-- ============================================================================

-- 5.1 备份（只建副本，不动原表）
create schema if not exists archive_20260916;
create table if not exists archive_20260916.sessions        as select * from public.sessions;
create table if not exists archive_20260916.notes_backup    as select * from public.notes_backup;
create table if not exists archive_20260916.reading_history as select * from public.reading_history;
create table if not exists archive_20260916.bookmarks       as select * from public.bookmarks;
create table if not exists archive_20260916.users           as select * from public.users;

-- 5.2 备份完成后，逐条手动执行下面的语句（默认注释掉，避免误删）
-- drop table if exists public.sessions;
-- drop table if exists public.notes_backup;
-- drop table if exists public.reading_history;
-- drop table if exists public.bookmarks;
-- alter table public.users drop column if exists password;
-- alter table public.users drop column if exists username;
