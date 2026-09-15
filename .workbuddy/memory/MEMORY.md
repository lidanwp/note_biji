# 项目长期备忘 — note_biji

## 本地开发的 API 拓扑（关键，排错必看）

**本地 dev 时没有本地后端。**

`vite.config.js` 的 `server.proxy` 把 `/api` 转发到**生产域名**：

```js
server: {
  port: 5173,
  proxy: {
    '/api': { target: 'https://bdxxg.asia', changeOrigin: true, secure: true }
  }
}
```

推论：
- `localhost:5173/api/*` 由线上 Vercel 后端处理，本地 `api/` 目录下的代码**在 `npm run dev` 时完全不执行**。
- 因此：**任何后端改动（api/ 下任意文件）必须部署到 Vercel 后才在本地 dev 生效**。前端改动热更新即时生效，容易造成"前端改了但后端行为是旧的"的错觉。
- 仓库 `origin = git@github.com:lidanwp/note_biji.git`，Vercel 与 GitHub 联动部署，`git push` 即触发。
- 项目未 `vercel link`（无 `.vercel/`），未安装 Vercel CLI，也没有任何 `.env*` 文件 —— `QIANFAN_API_KEY` 只存在于 Vercel 项目的环境变量里。若要跑真正的本地后端，需 `npm i -D vercel` → `npx vercel link` → `npx vercel env pull .env.local` → `npx vercel dev --listen 3000`，并把上面 proxy 的 target 改成 `http://localhost:3000`。

## 典型误判案例（已发生一次）

现象：前端 POST `localhost:5173/api/chat`，`{mode:'tts'}` 返回 400 `缺少必要参数: dataset_id, query`。

该错误文案全仓只在 `api/chat.js` 的**检索默认分支**（mode 判断全部落空后的兜底）出现一次。所以它意味着 `mode:'tts'` 没被识别 —— 但根因不是分流写错，而是**被调用的不是本地那份 chat.js**，而是线上未部署新分支的旧版本。

定位手法（可复用）：直接 curl 线上域名做对照 —— 用已知存在的 mode（如 `roundtable`）与怀疑缺失的 mode（如 `tts`）各打一次，看返回的错误文案分别来自哪个分支，即可判定线上代码的版本状态：
```
curl -s -X POST https://bdxxg.asia/api/chat -H "Content-Type: application/json" -d '{"mode":"tts"}'
# 返回 dataset_id 报错 -> 线上没有 tts 分支
curl -s -X POST https://bdxxg.asia/api/chat -H "Content-Type: application/json" -d '{"mode":"roundtable"}'
# 返回「缺少 topic 或 role」-> 线上有 roundtable 分支（handleRoundtable 的参数校验）
```
