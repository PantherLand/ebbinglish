# Ebbinglish

Ebbinglish 是一个基于 **Round（学习轮次）** 的英文单词复习应用，使用 Next.js App Router + Prisma + Auth.js。

当前主流程：

- 在 Library 管理单词与标签
- 从单词库创建 Round
- 在 Round 里按 Session 学习（Normal / Extra Practice）
- 在 Session 中打分（known / fuzzy / unknown）
- 在 Stats 查看掌握分布与近 7 天学习情况

## 当前已实现功能

- Google 登录（Auth.js v5 + Prisma Adapter）
- Library
- 手动加词（支持字典建议与释义拉取）
- 单词查重（按 user + language + text，大小写不敏感）
- 单词优先级（Priority）与手动分类（manualCategory / tags）
- 单词详情：字典内容、复习日志、记忆评分、热力图、遗忘曲线
- Round
- 创建 Round（支持 Search / Status / Tags / Priority 过滤）
- Round 详情进度、Normal Session、Extra Practice
- 单词状态手动编辑（first-try mastered / mastered / fuzzy / unknown）
- Session
- 按设置的 sessionSize 出题
- 结果实时保存到服务端 + 本地 localStorage，支持中途退出后恢复
- Session 完成页统计
- Stats
- Mastered / Learning / New 分布
- 最近 7 天复习量
- Settings
- sessionSize / freezeRounds / autoPlayAudio / requireConsecutiveKnown
- Dictionary 后端接入（`DICT_BACK_API`）
- YouGlish 嵌入组件（用于单词语境学习）

## 技术栈

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL
- Auth.js (next-auth v5 beta) + Google OAuth
- Zod

## 路由结构

- `/` 登录入口
- `/app/today` Today Dashboard
- `/app/library` 词库列表
- `/app/library/[wordId]` 单词详情
- `/app/rounds` Round 列表
- `/app/rounds/new` 创建 Round
- `/app/rounds/[id]` Round 详情
- `/app/session/[id]` Session 进行页
- `/app/session/[id]/summary` Session 总结页
- `/app/stats` 统计
- `/app/settings` 设置

受保护路由：

- 通过 `proxy.ts` 对 `/app/:path`* 做鉴权保护

## HTTP API 结构（`app/api/*`）

### 1) Dictionary Suggest

- `GET /api/dict/suggest?q=<word>&limit=<n>`
- 返回：
- 成功：`{ items: Array<{ headword: string; score: number }> }`
- 字典未配置：`{ items: [], disabled: true }`
- 失败：`502` + `{ items: [], error: string }`

### 2) Dictionary Meaning

- `GET /api/dict/meaning?headword=<word>`
- 返回：
- 成功：字典详情（含 `meaning`, `pronunciations`, `audioUrls`, `posBlocks`, `senses`, `idioms`）
- 参数缺失：`400` + `{ error: "headword is required" }`
- 字典未配置：`{ headword, meaning: null, disabled: true }`
- 失败：`502` + `{ error: string }`

### 3) Library Duplicate Check

- `GET /api/library/check?text=<word>&language=<lang>`
- 返回：`{ exists: boolean }`
- 未登录返回 `401`

### 4) Chrome Extension / External API

- `POST /api/ext/words`
- 需要 `Authorization: Bearer <token>`（在 Settings → API Token 中生成）
- 请求体：
  ```json
  { "word": "ephemeral", "meaning": "lasting for a very short time", "language": "en" }
  ```
  - `word`：必填，最长 100 字符
  - `meaning`：必填，最长 500 字符（保存为单词的 `note`）
  - `language`：可选，默认 `"en"`
- 返回：
  - 成功（新建）：`{ "ok": true, "wordId": "...", "created": true }`
  - 成功（已存在，更新 meaning）：`{ "ok": true, "wordId": "...", "created": false }`
  - Token 缺失或无效：`401` + `{ "ok": false, "error": "..." }`
  - 参数非法：`422` + `{ "ok": false, "error": "..." }`
  - 幂等性：按 `userId + language + word` 去重，重复调用只更新 `meaning`，不重复创建

### 5) Auth.js

- `GET/POST /api/auth/[...nextauth]`
- 由 Auth.js handlers 提供

## Server Actions（非公开 HTTP API）

这些动作在 App 内部通过 Server Actions 调用：

- `app/app/library/actions.ts`
- `createWordAction`
- `togglePriorityFromListAction`
- `deleteWordFromListAction`
- `app/app/library/[wordId]/actions.ts`
- `updateStudyConfigAction`
- `app/app/study-actions.ts`
- `createRoundAction`
- `deleteRoundAction`
- `updateRoundStatusAction`
- `editRoundWordStatusAction`
- `startSessionAction`
- `saveSessionProgressAction`
- `finishSessionAction`
- `updateStudySettingsAction`
- `app/app/today/actions.ts`（遗留/扩展流程）
- `submitReviewBatchAction`
- `advanceToNextSessionAction`
- `generatePracticeStoryAction`（调用 OpenAI Responses API）

## 数据模型（Prisma）

核心模型在 `prisma/schema.prisma`：

- `User`：用户与当前全局轮次
- `Word`：单词本体（`text`, `note`, `isPriority`, `manualCategory`）
- `ReviewState`：单词长期状态（`seenCount`, `freezeRounds`, `isMastered` 等）
- `ReviewLog`：每次复习记录（`grade`）
- `StudySettings`：学习参数
- `StudyRound`：轮次（`wordIds`, `completedWordIds`, `attemptedWordIds`）
- `StudySession`：轮次中的一次 session（`wordIds`, `results`, `completedAt`）

## 环境变量

在项目根目录创建 `.env`：

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/ebbinglish"

# Auth.js / NextAuth
AUTH_SECRET="<random-32+>"
AUTH_URL="http://localhost:3000"
# 可选兼容别名：
# NEXTAUTH_SECRET="<same-as-auth-secret>"
# NEXTAUTH_URL="http://localhost:3000"
# AUTH_TRUST_HOST="true"

GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Dictionary backend
DICT_BACK_API="http://localhost:8787"         # 可写带/不带 /v1，代码会统一成 /v1
DICT_BACK_API_DICT_ID="oxford-1"              # 可选，默认 oxford-1
DICT_BACK_API_KEY="..."                       # 可选

# AI practice story（用于 today/actions.ts）
OPENAI_API_KEY="sk-..."
# OPENAI_BASE_URL="https://api.openai.com"
# OPENAI_MODEL="gpt-4o-mini"
```

> 当配置了 `DICT_BACK_API_KEY` 时，后端请求 `DICT_BACK_API` 会自动携带：
>
> `Authorization: Bearer $DICT_BACK_API_KEY`

## 本地启动

1. 安装依赖

```bash
npm install
```

1. 生成 Prisma Client

```bash
npm run prisma:generate
```

1. 执行迁移

```bash
npm run prisma:migrate
```

1. 启动开发环境

```bash
npm run dev
```

## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run db:studio
```

## 测试

当前包含 Vitest 单测（示例）：

- `src/__tests__/memory-rating.test.ts`

## 常见问题

### 1) `Study models are unavailable in Prisma Client`

说明 Prisma Client 未同步最新 schema。

```bash
npm run prisma:generate
```

然后重启 `npm run dev`。

### 2) Google 登录失败

检查：

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- Google Console 回调地址是否包含：
- `http://localhost:3000/api/auth/callback/google`

### 3) 字典不可用

如果未设置 `DICT_BACK_API`，前端会显示 dictionary disabled，并降级为手动输入释义。