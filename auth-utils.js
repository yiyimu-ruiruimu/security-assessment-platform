/* =====================================================================
 * auth-utils.js — 信息安全测评实践教学平台 · 账号与日志工具库
 * ---------------------------------------------------------------------
 * 设计说明：
 *   1. 本文件必须与页面同目录部署（Netlify 站点根），页面通过
 *      <script src="auth-utils.js"></script> 引用。
 *   2. 依赖页面已加载的 Netlify Identity 官方组件
 *      （https://identity.netlify.com/v1/netlify-identity-widget.js）。
 *   3. 本地直接打开（file:// 或普通 localhost）时全部功能安全降级：
 *      initIdentity() 返回 null，登录拦截与日志上报自动跳过，不报错。
 *   4. 日志统一经 /.netlify/functions/log 后端写入 Supabase，前端不直连数据库，
 *      由后端校验 Netlify Identity 令牌，保证日志可信、不可伪造。
 * ===================================================================== */

(function () {
    'use strict';

    var DEBUG = false;              // 置 true 可在控制台看到上报细节
    var ENTRY_COOLDOWN_MS = 5 * 60 * 1000;   // “进入平台”5 分钟内只记一次，防刷新刷屏
    var _identityReady = null;

    function logDebug() {
        if (DEBUG) {
            try { console.log.apply(console, ['[auth-utils]'].concat([].slice.call(arguments))); }
            catch (e) { /* noop */ }
        }
    }

    function isLocalPreview() {
        var p = window.location.protocol || '';
        if (p === 'file:') return true;
        var h = window.location.hostname || '';
        var port = window.location.port || '';
        if ((h === 'localhost' || h === '127.0.0.1') && port !== '8888') return true;
        return false;
    }

    /* ---------- 初始化：返回可用的 netlifyIdentity 实例，否则返回 null ---------- */
    function initIdentity() {
        if (_identityReady) return _identityReady;
        _identityReady = new Promise(function (resolve) {
            if (isLocalPreview() || typeof netlifyIdentity === 'undefined') {
                logDebug('本地预览或无 Netlify Identity 组件，跳过登录');
                resolve(null);
                return;
            }
            var ni = netlifyIdentity;
            var settled = false;
            var done = function () {
                if (settled) return;
                settled = true;
                logDebug('Identity 初始化完成');
                resolve(ni);
            };
            try { ni.on('init', done); } catch (e) { /* 组件异常 */ }
            setTimeout(done, 3000);      // 兜底：3 秒内未 init 也放行（currentUser 可能为空）
            try { if (typeof ni.init === 'function') ni.init(); } catch (e) { /* noop */ }
        });
        return _identityReady;
    }

    /* ---------- 登出 ---------- */
    function logout() {
        initIdentity().then(function (ni) {
            if (ni) { try { ni.logout(); } catch (e) { /* noop */ } }
        });
    }

    /* ---------- 取当前登录用户 ---------- */
    function getCurrentUser() {
        var ni = null;
        if (typeof netlifyIdentity !== 'undefined') ni = netlifyIdentity;
        if (!ni) return null;
        try { return ni.currentUser() || null; } catch (e) { return null; }
    }

    /* ---------- 取访问令牌 ---------- */
    function getAccessToken(user) {
        try {
            if (user && user.token && user.token.access_token) return user.token.access_token;
        } catch (e) { /* noop */ }
        return null;
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ---------- 日志上报（后端校验身份后写入 Supabase） ---------- */
    function sendLog(payload) {
        return initIdentity().then(function (ni) {
            if (!ni) return;                 // 本地预览不记录
            var u = getCurrentUser();
            if (!u) return;
            var token = getAccessToken(u);
            if (!token) return;
            var body = {
                type: String(payload.type || 'operation').slice(0, 20),
                action: String(payload.action || '').slice(0, 120),
                detail: String(payload.detail || '').slice(0, 1000)
            };
            logDebug('上报日志', body);
            try {
                fetch('/.netlify/functions/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify(body),
                    keepalive: true            // 页面跳转/关闭时也尽量送达
                }).catch(function () { /* 静默失败，不打扰学生 */ });
            } catch (e) { /* noop */ }
        });
    }

    /* ---------- 考勤打卡：进入平台（带限频） ---------- */
    function trackLogin() {
        var now = Date.now();
        try {
            var last = parseInt(localStorage.getItem('wb_entry_last') || '0', 10);
            if (now - last < ENTRY_COOLDOWN_MS) {
                logDebug('进入平台日志已记录过，跳过（限频）');
                return;
            }
            localStorage.setItem('wb_entry_last', String(now));
        } catch (e) { /* localStorage 不可用时仍上报 */ }
        sendLog({ type: 'entry', action: '进入平台', detail: location.pathname });
    }

    /* ---------- 操作日志 ---------- */
    function trackOperation(action, detail) {
        sendLog({ type: 'operation', action: action, detail: detail });
    }

    /* ---------- 查询当前账号是否教师管理员（admin.html 用） ---------- */
    function fetchSelf() {
        return initIdentity().then(function (ni) {
            if (!ni) return null;
            var u = getCurrentUser();
            if (!u) return null;
            var token = getAccessToken(u);
            if (!token) return null;
            return fetch('/.netlify/functions/logs?self=1', {
                headers: { 'Authorization': 'Bearer ' + token }
            }).then(function (r) {
                if (!r.ok) return { ok: false, status: r.status };
                return r.json();
            }).catch(function () { return null; });
        });
    }

    /* ---------- 查询日志（admin.html 用，后端校验管理员身份） ---------- */
    function fetchLogs(params) {
        return initIdentity().then(function (ni) {
            if (!ni) return Promise.reject(new Error('NO_IDENTITY'));
            var u = getCurrentUser();
            if (!u) return Promise.reject(new Error('NO_USER'));
            var token = getAccessToken(u);
            if (!token) return Promise.reject(new Error('NO_TOKEN'));
            var qs = [];
            params = params || {};
            if (params.email) qs.push('email=' + encodeURIComponent(params.email));
            if (params.type) qs.push('type=' + encodeURIComponent(params.type));
            if (params.from) qs.push('from=' + encodeURIComponent(params.from));
            if (params.to) qs.push('to=' + encodeURIComponent(params.to));
            if (params.limit) qs.push('limit=' + parseInt(params.limit, 10));
            if (params.offset) qs.push('offset=' + parseInt(params.offset, 10));
            var url = '/.netlify/functions/logs' + (qs.length ? '?' + qs.join('&') : '');
            return fetch(url, { headers: { 'Authorization': 'Bearer ' + token } }).then(function (r) {
                if (r.status === 403) return Promise.reject(new Error('FORBIDDEN'));
                if (!r.ok) return Promise.reject(new Error('HTTP_' + r.status));
                return r.json();
            });
        });
    }

    /* ---------- 挂全局事件：登录成功 / 登出时自动记账 ---------- */
    function registerIdentityHooks() {
        initIdentity().then(function (ni) {
            if (!ni) return;
            try {
                ni.on('login', function (user) {
                    logDebug('检测到登录事件');
                    sendLog({ type: 'login', action: '账号登录', detail: user && user.email });
                });
                ni.on('logout', function () {
                    logDebug('检测到登出事件');
                    // 登出令牌即将失效，用 keepalive 尽力上报
                    try {
                        fetch('/.netlify/functions/log', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'logout', action: '账号登出', detail: '' }),
                            keepalive: true
                        }).catch(function () { /* noop */ });
                    } catch (e) { /* noop */ }
                });
            } catch (e) { /* noop */ }
        });
    }

    /* ---------- 通用：页面上方渲染用户信息栏 ---------- */
    function renderUserBar(containerId) {
        var wrap = document.getElementById(containerId || 'userBar');
        if (!wrap) return;
        var u = getCurrentUser();
        if (!u) return;
        var letter = (u.email || '?').charAt(0).toUpperCase();
        wrap.innerHTML =
            '<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;border-radius:50%;' +
            'background:#0d47a1;color:#fff;font-size:13px;margin-right:8px;vertical-align:middle;">' + esc(letter) + '</span>' +
            '<span style="vertical-align:middle;">' + esc(u.email) + '</span>' +
            '<span style="color:#ccd3dc;margin:0 8px;">|</span>' +
            '<a href="admin.html" style="color:#1565c0;text-decoration:none;">教师后台</a>' +
            '<span style="color:#ccd3dc;margin:0 8px;">|</span>' +
            '<a href="#" onclick="logout();return false;" style="color:#e53e3e;text-decoration:none;">退出</a>';
    }

    /* ===== 暴露到全局（兼容页面里已有的函数名调用） ===== */
    window.initIdentity = initIdentity;
    window.logout = logout;
    window.getCurrentUser = getCurrentUser;
    window.trackLogin = trackLogin;
    window.trackOperation = trackOperation;
    window.fetchSelf = fetchSelf;
    window.fetchLogs = fetchLogs;
    window.renderUserBar = renderUserBar;
    window.__authDebug = function (on) { DEBUG = !!on; };

    /* 页面加载后自动挂登录/登出事件 */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerIdentityHooks);
    } else {
        registerIdentityHooks();
    }
})();
