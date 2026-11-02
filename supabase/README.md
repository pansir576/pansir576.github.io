# 厨友交流中心 Supabase 配置

项目默认以演示模式运行。配置 Supabase 后会启用匿名身份、实时大厅、讨论帖、图片上传和管理员后台。

## 1. 创建 Supabase 项目

1. 在 Supabase Dashboard 创建项目。
2. 在 Authentication → Providers 中启用 Anonymous Sign-Ins。
3. 依次在 SQL Editor 执行：

```text
supabase/migrations/202610240001_community.sql
supabase/migrations/202610250001_guided_ai_usage.sql
```

第一个 migration 创建社区数据表、RLS、限频 RPC、举报处理、Storage bucket、Realtime publication 和每小时大厅清理任务；第二个创建一人称厨房 AI 问答的匿名身份限频表与 RPC。

> 如果托管项目的 SQL Editor 不允许 `pg_cron`，删除 migration 末尾的 `cron.schedule`，改用 Supabase Cron 每小时执行：
>
> ```sql
> select public.community_prune_lobby();
> ```

## 2. 配置前端环境变量

复制 `.env.example` 为 `.env.local`，填写：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

anon key 可以公开，但不能使用 service_role key 作为前端环境变量。

## 3. 创建管理员账号

你提供的管理员邮箱：

```text
admin@example.com
```

操作步骤：

1. 在 Authentication → Users 中创建该邮箱用户并设置密码。
2. 在 SQL Editor 执行：

```sql
insert into public.community_profiles (
  id, nickname, avatar_color, is_admin
)
select id, '厨房主理人', '#39724b', true
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
set is_admin = true,
    nickname = excluded.nickname;
```

3. 打开 `/community/admin/`，使用该邮箱和密码登录。

匿名厨友不能自行获得管理员权限；`is_admin` 只能由数据库管理员修改。

## 4. 本地验证

```powershell
npm run dev
```

未设置环境变量时：

- `/community/` 显示示例消息和帖子。
- 发送、发帖、回复、点赞和举报按钮禁用。
- 不会向 `localStorage` 写入虚假聊天记录。

设置环境变量后：

- 匿名用户自动获得 Supabase匿名 session。
- 首次进入要求设置昵称。
- 大厅和帖子使用 Realtime 同步。
- 管理员后台可处理举报、隐藏/恢复/删除内容和禁言匿名身份。

## 5. 部署菜谱教练与一人称厨房 AI

Edge Function 位于 `supabase/functions/cooking-guide/index.ts`，同一个入口通过 `mode: "recipe"` 处理 2D 菜谱实训，并保持原有一人称厨房请求兼容。浏览器只持有 Supabase anon key，模型密钥不会进入前端。

```powershell
npx supabase functions deploy cooking-guide --project-ref <project-ref>
```

在 Supabase 项目 secrets 中配置：

```text
GUIDE_AI_BASE_URL=https://api.deepseek.com/v1
GUIDE_AI_API_KEY=<server-only-key>
GUIDE_AI_MODEL=deepseek-chat
GUIDE_AI_TIMEOUT_MS=15000
```

`GUIDE_AI_BASE_URL` 不应包含末尾的 `/chat/completions`，Function 会自动拼接。默认方案使用 DeepSeek，也可以替换为其他兼容 Chat Completions 的服务。

未设置 secrets、请求超时、断网或触发限频时，前端自动切换为本地知识库回答并明确标记来源，不会伪造在线 AI 消息。匿名用户每 10 分钟最多发起 20 次在线请求。

## 6. 安全与内容规则

- 发帖每 60 秒 1 次。
- 回复每 20 秒 1 次。
- 大厅每 10 秒最多 5 条。
- 大厅保留最近 24 小时或最近 500 条。
- 图片最多 3 张，每张 5 MB，仅支持 JPG、PNG 和 WebP。
- 敏感词先由数据库 RPC 拦截，管理员仍需处理用户举报。
- 禁止违法、暴力、色情、仇恨、隐私泄露、广告、诈骗和冒充他人。
