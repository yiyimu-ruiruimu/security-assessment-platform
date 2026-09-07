# 账号注册 / 登录 / 日志功能 — 部署与配置指南

> 适用站点：https://wlxxaq.netlify.app（GitHub: yiyimu-ruiruimu/security-assessment-platform）
> 技术栈：**Netlify Identity**（账号体系）+ **Supabase Postgres**（日志存储）+ **Netlify Functions**（可信日志写入/查询）

## 一、这次我改了什么 / 新增了什么

| 文件 | 说明 |
|---|---|
| `index.html` / `main-page.html` | 登录拦截修正：未登录自动跳 `login.html`；右上角用户栏显示邮箱 + “教师后台/退出”；保留并完善全部行为记账调用点 |
| `auth-utils.js`（**新增，原来缺失导致线上 404**） | 登录初始化、登出、考勤打卡、操作日志上报、管理员身份查询。本地打开自动降级不报错 |
| `login.html`（**新增**） | 公开登录门户：学生登录/注册、教师后台入口、登录成功回跳原页面 |
| `admin.html`（**新增**） | 教师日志后台：按 邮箱/事件类型/日期 筛选，分页表格，类型统计，CSV 导出 |
| `netlify/functions/log.js` | 后端写日志 API（校验登录令牌后才写入，日志不可伪造） |
| `netlify/functions/logs.js` | 后端查日志 API（仅 `ADMIN_EMAILS` 中的教师账号可查） |
| `netlify/functions/_shared/backend.js` | 共享逻辑（令牌校验 / Supabase REST / 时间归一化），**零 npm 依赖** |
| `netlify.toml` | Netlify 构建配置（Functions 目录） |
| `supabase-setup.sql` | 日志表建表脚本（在 Supabase SQL Editor 执行一次） |

日志表记录四类事件：`login`(账号登录)、`entry`(进入平台=考勤打卡，5分钟内去重)、`operation`(切换任务/分类/开始测评/测评通过等)、`logout`(登出)。

---

## 二、部署步骤（按顺序执行，约 20 分钟）

### 第 1 步：推送代码
```bash
cd D:\信息安全测评实践教学平台
git add -A
git commit -m "新增账号注册登录与日志系统（Identity + Supabase + Functions）"
git push
```
Netlify 检测到 GitHub 推送会自动构建部署（本次新增 Functions，首次部署时间会长一些）。

### 第 2 步：开启 Netlify Identity（注册/登录账号体系）
1. Netlify 后台 → 你的站点 `wlxxaq` → **Identity** → **Enable Identity**。
2. 进入 **Settings → Identity → Registration**：
   - 建议 **Registration preferences = Open**（学生可自助注册）。
   - **External providers** 可加 GitHub/Google（可选）。
   - 邮箱确认（Confirm email）：教学场景若想学生注册即用，可关闭；若开启，学生需点邮件链接激活。
3. **Settings → Identity → Services**：`External auth` 等保持默认即可。

> ⚠️ 站点正在被访问时开启后，`/.netlify/identity` 才会可用，登录组件才能工作。

### 第 3 步：创建 Supabase 项目（免费）并建表
1. 打开 https://supabase.com → **New project**（免费 Free 档即可，选一个海外区域）。
2. 创建成功后进入 **SQL Editor**，粘贴 `supabase-setup.sql` 全部内容执行 → 生成 `user_logs` 表。
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
4. 没配 Supabase 或没开 Identity 时页面不会报错，只是跳转/日志不生效——按上面步骤补齐即可。

---

## 三、日常使用

- **学生**：访问站点任意内容页会被引导到 `login.html`；注册邮箱即登录（具体以你 Identity 邮箱确认设置而定）。
- **教师**：`login.html` → 教师后台，或在任意页面右上角点“教师后台”。
- **查看考勤**：`admin.html` 筛“事件类型 = 进入平台” + 日期区间，即可统计哪天谁上了课。
- **导出**：CSV 按钮直接下载（Excel 打开不乱码，已带 UTF-8 BOM）。

## 四、常见问题

- **本地双击打开 html**：会跳过登录与日志（设计如此），部署到 Netlify 才生效。
- **`admin.html` 提示无权限**：把你邮箱加进 `ADMIN_EMAILS` 并重新部署。
- **日志没写入**：检查 Netlify 环境变量是否配置且已重新部署；或访问 `/.netlify/functions/log` 看是否 500（返回 JSON 带 `server_not_configured` 即环境变量缺失）。
- **想换主页**：Netlify 默认把仓库根 `index.html` 作为首页。本次已把最新教学版（原 main-page.html）同步为 `index.html`，两文件内容一致；**以后请只维护 `index.html`**，`main-page.html` 可自行删除以免改混。
- **免费额度**：Netlify Identity 免费；Supabase Free 档足够教学实验使用，日志量大后可加保留策略（定期 DELETE 旧数据）。

## 五、安全说明

- 日志写入与查询全部经过 Netlify Functions 做身份校验，浏览器无法直连数据库伪造记录；
- 日志表已启用行级安全（RLS）且无公开策略，即使 anon key 泄露也无法读取；
- `service_role` 密钥仅存于 Netlify 环境变量，不进入前端代码与 GitHub。
