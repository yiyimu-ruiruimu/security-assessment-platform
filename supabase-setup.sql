-- =====================================================================
-- 信息安全测评实践教学平台 · Supabase 初始化脚本
-- 用途：创建平台日志表（登录/进入/操作/登出统一落库）
-- 执行位置：Supabase 控制台 → SQL Editor → New query → 粘贴执行
-- 安全模型：本表只允许后端 Netlify Functions 通过 service_role 密钥读写，
--           已启用 RLS 且不创建任何公开策略，anon / 浏览器直连一律无权限。
-- =====================================================================

-- 1) 日志主表
create table if not exists public.user_logs (
    id          bigint generated always as identity primary key,
    user_id     text        not null default '',          -- Netlify Identity 用户 id
    email       text        not null default '',          -- 登录邮箱（检索学生用）
    event_type  text        not null default 'operation', -- login / entry / operation / logout
    action      text        not null default '',          -- 动作（进入平台 / 切换学习任务 / 开始单元测评 …）
    detail      text        not null default '',          -- 明细（任务名、得分等）
    ip          text        not null default '',          -- 客户端 IP（后端取）
    user_agent  text        not null default '',          -- 浏览器 UA（后端取，截断 300）
    created_at  timestamptz not null default now()
);

-- 2) 常用查询索引（按人查、按时间查）
create index if not exists idx_user_logs_email_time on public.user_logs (email, created_at desc);
create index if not exists idx_user_logs_time      on public.user_logs (created_at desc);
create index if not exists idx_user_logs_type      on public.user_logs (event_type);

-- 3) 开启行级安全（不建任何策略 = 默认全部拒绝；service_role 密钥不受影响）
alter table public.user_logs enable row level security;

-- 4) 可选：给"某天某事件总数"这类统计视图（管理页暂不用，可跳过）
-- create view if not exists public.v_log_daily as
--   select date(created_at) as day, event_type, count(*) as cnt
--   from public.user_logs group by 1, 2;
