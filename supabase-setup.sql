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

-- =====================================================================
-- 【二、学习进度表 user_progress】（账号进度云端存取，配合
--     /.netlify/functions/progress 使用；整改新增）
-- 用途：每个账号保存——单元测评通过记录 quizPass、学习位置 last、
--       实践闯关存档 games。登录后换设备/浏览器也能接上上次进度。
-- 安全模型：与 user_logs 相同，仅后端 Functions 经 service_role 读写，
--           已启用 RLS 且不建公开策略。
-- =====================================================================

create table if not exists public.user_progress (
    user_id     text primary key,                 -- Netlify Identity 用户 id
    email       text        not null default '',  -- 登录邮箱
    data        jsonb       not null default '{}'::jsonb,  -- {v, updatedAt, quizPass, last, games}
    updated_at  timestamptz not null default now()
);

alter table public.user_progress enable row level security;


-- =====================================================================
-- 【三、互动答题（在线选择题 + 教师端统计）】
--     配合 /.netlify/functions/quiz、quiz-live.html（学生作答）、
--     admin.html（教师出题与统计）使用。
-- 安全模型：与前两表相同，仅后端 Functions 经 service_role 读写，
--           已启用 RLS 且不建公开策略。
-- =====================================================================

-- 1) 题组表：教师保存的一套选择题（含正确答案，仅教师端可见）
create table if not exists public.quiz_questions (
    quiz_id     text primary key,                 -- 题组标识，如 quiz-20260915-01
    title       text        not null default '',  -- 题组标题，如「任务3 课堂互动」
    status      text        not null default 'open',   -- open=开放作答 / closed=关闭
    questions   jsonb       not null default '[]'::jsonb, -- [{id,q,opts:[A..D文案],ans:'A'}]
    updated_by  text        not null default '',  -- 最后编辑的管理员邮箱
    updated_at  timestamptz not null default now()
);

-- 2) 作答表：每个学生每道题一行（重复提交覆盖：先删后插）
create table if not exists public.quiz_answers (
    id          bigint generated always as identity primary key,
    quiz_id     text        not null,             -- 所属题组
    question_id text        not null,             -- 题目 id（题组内唯一，如 q1）
    user_id     text        not null default '',  -- Netlify Identity 用户 id
    email       text        not null default '',  -- 学生邮箱
    answer      text        not null default '',  -- 学生所选选项 A/B/C/D
    is_correct  boolean     not null default false,
    created_at  timestamptz not null default now()
);

-- 3) 查询索引（按题组查、按人查）
create index if not exists idx_quiz_answers_quiz   on public.quiz_answers (quiz_id, created_at desc);
create index if not exists idx_quiz_answers_user   on public.quiz_answers (user_id, quiz_id);

-- 4) 行级安全：不建公开策略 = 浏览器/anon 直连一律拒绝
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers   enable row level security;
