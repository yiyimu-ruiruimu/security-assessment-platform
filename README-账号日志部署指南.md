# 账号注册 / 登录 / 日志功能 — 部署与配置指南

> 适用站点：https://wlxxaq.netlify.app（GitHub: yiyimu-ruiruimu/security-assessment-platform）
> 技术栈：**Netlify Identity**（账号体系）+ **Supabase Postgres**（日志存储）+ **Netlify Functions**（可信日志写入/查询）

## 一、这次我改了什么 / 新增了什么

| 文件 | 说明 |
|---|---|
| `index.html` | 登录拦截 + 行为记账调用点；**测评整改**：单元测评按单元顺序串行解锁、每单元 10 题（知识3·技能4·素养3，满分100通过）、账号学习位置记忆（登录自动续学）、实践闯关统一入口横幅（时间线正下方） |
| `auth-utils.js`（**新增，原来缺失导致线上 404**） | 登录初始化、登出、考勤打卡、操作日志上报、管理员身份查询。本地打开自动降级不报错。**学习进度层 v2**：`loadProgress/saveProgress/mergeProgress` 按账号（id/email 哈希）在 localStorage + 云端之间合并 quizPass/last/games |
| `login.html`（**新增**） | 公开登录门户：学生登录/注册、教师后台入口、登录成功回跳原页面 |
| `admin.html`（**新增**） | 教师日志后台：按 邮箱/事件类型/日期 筛选，分页表格，类型统计，CSV 导出 |
| `netlify/functions/log.js` | 后端写日志 API（校验登录令牌后才写入，日志不可伪造） |
| `netlify/functions/logs.js` | 后端查日志 API（仅 `ADMIN_EMAILS` 中的教师账号可查） |
| `netlify/functions/progress.js`（**整改新增**） | 学习进度云端读写 API：GET/POST `/.netlify/functions/progress`，按登录账号 upsert 到 `user_progress.data`（JSONB） |
| `netlify/functions/_shared/backend.js` | 共享逻辑（令牌校验 / Supabase REST / 时间归一化），**零 npm 依赖** |
| `netlify.toml` | Netlify 构建配置（Functions 目录） |
| `supabase-setup.sql` | 建表脚本：`user_logs`（日志）+ `user_progress`（账号进度），在 Supabase SQL Editor 执行一次 |
| `实践测试/denbao-pm-game/index.html`（**整改新增**） | 实践闯关子项目：存档从旧 `etcpm-save-*` 迁移为账号进度 `games[caseId]`，云端+本地双写，登录后换设备可续玩；旧档首次进入自动导入 |

日志表记录四类事件：`login`(账号登录)、`entry`(进入平台=考勤打卡，5分钟内去重)、`operation`(切换任务/分类/开始测评/测评通过等)、`logout`(登出)。

---

### 本次一并上线的「测评与进度整改」速览（v2）

1. **单元测评串行解锁**：10 个单元按 `1.1 → 1.2 → 2.1 → 2.2 → 3 → 4 → 5 → 6 → 7 → 8` 顺序解锁；前一单元**满分 100 通过**后下一单元测评按钮才可点。已通过单元可随时复习/重测，解锁状态不受影响。
2. **每单元 10 题**：知识 3 题 + 技能 4 题 + 素养 3 题，每题 10 分，满分 100；旧版 6 题存档自动兼容（首次登录迁移，不丢历史）。
3. **账号进度云端为主**：每个账号的 `quizPass`（测评通过）、`last`（学习位置）、`games`（闯关存档）保存在 Supabase `user_progress`，本地 localStorage 按账号哈希隔离做离线兜底，双端按时间戳合并；登录后换电脑/浏览器也能接上。
4. **自动续学**：再次登录自动回到上次学到的任务/子任务，并弹出"已接续进度"提示条（可关闭/返回首页；同一账号每会话只续学一次，避免刷新反复跳转）。
5. **实践闯关入口上移**：从任务 2.2 右侧面板移到任务 1-8 进度条正下方的统一横幅（首页与各任务页均可见），闯关进度按账号保存、可随时续玩。

## 二、部署步骤（按顺序执行，约 20 分钟）

### 第 1 步：推送代码
```bash
cd D:\信息安全测评实践教学平台
git add -A
git commit -m "账号日志 + 测评整改：串行解锁/10题题库/进度续学/闯关存档云端化"
git push
```
Netlify 检测到 GitHub 推送会自动构建部署（本次新增 Functions，首次部署时间会长一些）。

### 第 2 步：开启 Netlify Identity（注册/登录账号体系）
1. Netlify 后台 → 你的站点 `wlxxaq` → **Identity** → **Enable Identity**。
2. 进入 **Identity → Registration → Registration preferences**：
   - 建议 **Registration preferences = Open**(默认即可,学生可自助注册)。
   - **External providers** 可加 GitHub/Google(可选,加后该途径免邮件确认,见末尾"可选升级")。
3. **(免费档限制)** Netlify Identity 的"邮件模板自定义 / 免邮箱确认"开关已移到 Pro 付费版,免费档的 **Emails** 标签下只有 Pro 升级提示,**没有**"Allow users to sign up without verifying their email address"入口。
   因此学生注册后必须打开注册邮箱点击确认链接才能登录——login.html 已内置明显提示。如需免邮件确认,见本文末尾"可选升级"小节。

### 第 3 步：创建 Supabase 项目（免费）并建表
1. 打开 https://supabase.com → **New project**（免费 Free 档即可，选一个海外区域）。
2. 创建成功后进入 **SQL Editor**，粘贴 `supabase-setup.sql` 全部内容执行 → 生成 `user_logs`（操作日志）与 `user_progress`（账号学习进度，含测评通过/学习位置/闯关存档）两张表。
3. 左侧 **Project Settings → API** 记录两个值：
   - `Project URL`（形如 `https://xxxx.supabase.co`）
   - `service_role` secret（**只可复制一次，妥善保存**）

### 第 4 步：在 Netlify 配置环境变量
Netlify 后台 → **Site configuration → Environment variables** → 新增三个：

| Key | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `ADMIN_EMAILS` | 教师邮箱，多个用英文逗号，如 `teacher@school.edu.cn, wang@xx.cn` |

> `service_role` 密钥**只能**放在后端环境变量，绝不能写进任何前端页面代码。

配置后 **Trigger deploy**（或推送一次提交）让新环境变量与 Functions 生效。

### 第 5 步：验证
1. 打开 `https://wlxxaq.netlify.app/login.html` → 用学生邮箱注册 → 自动进入平台；
2. 页面右上角应显示当前邮箱与“教师后台/退出”；
3. 用教师邮箱（在 ADMIN_EMAILS 中）登录 `admin.html` → 能看到学生注册/进入/操作记录；
4. **验证进度续学**：完成任务 1.1 的单元测评（满分 100）→ 任务 1.2 测评按钮解锁；退出后用同一账号重新登录 → 应自动回到上次学习位置；换一台电脑登录 → 测评通过记录与闯关存档应仍在（云端生效）；
5. 没配 Supabase 或没开 Identity 时页面不会报错，只是跳转/日志/云端进度不生效——按上面步骤补齐即可。

---

## 三、日常使用

- **学生**：访问站点任意内容页会被引导到 `login.html`；注册邮箱即登录（具体以你 Identity 邮箱确认设置而定）。
- **教师**：`login.html` → 教师后台，或在任意页面右上角点“教师后台”。
- **查看考勤**：`admin.html` 筛“事件类型 = 进入平台” + 日期区间，即可统计哪天谁上了课。
- **导出**：CSV 按钮直接下载（Excel 打开不乱码，已带 UTF-8 BOM）。

## 四、常见问题

- **本地双击打开 html**：会跳过登录与日志（设计如此），部署到 Netlify 才生效。
- **单元测评按钮显示 🔒 / 点不了**：测评按单元顺序串行解锁——先以 100 分通过上一单元的测评，下一单元测评按钮才会亮起；已通过单元显示“✅ 已通过 · 可复习”，随时可重测。
- **换设备/浏览器后进度没回来**：确认使用**同一个已登录账号**访问（进度按账号 id 隔离并云端保存）；本地直接双击 html（file:// 或非 8888 端口的 localhost）属离线预览，不会读云端，属设计如此。
- **`admin.html` 提示无权限**：把你邮箱加进 `ADMIN_EMAILS` 并重新部署。
- **日志没写入**：检查 Netlify 环境变量是否配置且已重新部署；或访问 `/.netlify/functions/log` 看是否 500（返回 JSON 带 `server_not_configured` 即环境变量缺失）。
- **想换主页**：Netlify 默认把仓库根 `index.html` 作为首页。本次已把最新教学版（原 main-page.html）同步为 `index.html`，两文件内容一致；**以后请只维护 `index.html`**，`main-page.html` 可自行删除以免改混。
- **免费额度**：Netlify Identity 免费；Supabase Free 档足够教学实验使用,日志量大后可加保留策略(定期 DELETE 旧数据)。
- **学生注册后登录提示"账号或密码错误"**:99% 是没点邮件里的确认链接。让对方去邮箱(可能含垃圾邮件夹)找 "Confirm your account" 或发件人为 Netlify 的邮件,点链接后再登录。
- **邮件模板自定义/免确认开关**:Netlify 已移入 Pro 付费版,免费档在 Identity → Emails 只能看到 Pro 升级提示。详见下一节"可选升级"。

## 五、可选升级:免费档下如何去掉邮箱确认步骤(无需升级 Pro)

**A. 教师批量邀请学生(适合教学班)**
1. **Identity → Users → Invite users**；
2. 把全班邮箱一次性粘贴进去,邀请邮件同时完成"邮箱确认 + 设密码"两步,学生点链接 = 一次完成验证并登录进平台;
3. 一次性流程,后续开放注册的新生仍走邮件确认(可重复邀请)。

**B. 接入外部登录(适合学生有 Google/GitHub 账号的场景)**
1. **Identity → Registration → External providers → Add provider**,按提示填 GitHub 或 Google 的 Client ID / Secret(免费,几分钟配好);
2. **走外部 provider 注册的用户,Netlify 官方明确免邮件确认**;
3. 学生点"用 GitHub 登录"即一键进平台,零邮件步骤。

> 这两条都是**免费档可用**的功能,代码无需改动(External providers 配好后 Netlify Identity Widget 会自动出现对应按钮);仅在 Netlify 后台点几下即可启用。

## 六、安全说明

- 日志写入与查询全部经过 Netlify Functions 做身份校验，浏览器无法直连数据库伪造记录；
- `user_logs` 与 `user_progress` 均已启用行级安全（RLS）且无公开策略，即使 anon key 泄露也无法读取；进度读写仅经 `/.netlify/functions/progress` 按登录账号 upsert；
- `service_role` 密钥仅存于 Netlify 环境变量，不进入前端代码与 GitHub。
