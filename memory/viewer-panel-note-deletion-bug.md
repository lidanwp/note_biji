---
name: viewer-panel-note-deletion-bug
description: ViewerPanel 查看笔记时触发内容清空的 Bug 根因与修复
metadata:
  type: project
---

# ViewerPanel 笔记误删 Bug 修复

**Bug:** ViewerPanel.vue 中 `viewDetail()` 调用 `updateViewCount()`，发送 POST `/api/notes` 仅携带 `{id, viewCount}`，服务端将所有缺失字段补空值后 upsert 到 Supabase，导致笔记 title/content 被清空。

**根因:**
1. `api/notes.js` POST 处理器一直对所有请求构建「完整 noteData」，缺失字段填 `''` / `[]`
2. `updateViewCount` / `updateUsefulCount` 复用了同一个 POST 端点
3. Supabase `resolution=merge-duplicates` 接收空值后直接覆盖已有字段
4. 数据库中的 2 条笔记已被完全清空（title: "", content: ""）

**修复方案 (api/notes.js):**
- 检测「部分更新」请求（仅有 `viewCount`/`usefulCount`，无 `title`/`content`）
- 部分更新 → 使用 Supabase **PATCH**（`id=eq.{id}`），只发送传入的字段
- 完整保存 → 继续使用 POST + `resolution=merge-duplicates`

**验证:**
- 创建测试笔记 → PATCH 更新 view_count → 确认 title/content 保持完整
- 创建测试笔记 → PATCH 更新 useful_count → 确认其他字段不受影响
- 数据库已有笔记已被清空，需要管理员重新录入

**How to apply:** 这是服务器端修复，发布到 Vercel 后立即生效，无需修改客户端代码。
