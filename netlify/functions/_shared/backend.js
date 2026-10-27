/* =====================================================================
 * netlify/functions/_shared/backend.js — Functions 共享后端逻辑
 * ---------------------------------------------------------------------
 * 提供：Netlify Identity 令牌校验、Supabase REST 写入/查询、时间归一化
 * 零 npm 依赖（使用 Node 18+ 原生 fetch）
 * 环境变量（在 Netlify 后台 Site settings → Environment variables 配置）：
 *   SUPABASE_URL                 例：https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    数据库 Service role key（仅后端使用，切勿暴露前端）
 *   ADMIN_EMAILS                 教师管理员邮箱，逗号分隔，例：teacher@school.edu.cn
 * ===================================================================== */
'use strict';

function requireEnv(name) {
    var v = process.env[name];
    if (!v) return '';
    return v.trim();
}

function getSiteBase(event) {
    if (process.env.URL) return process.env.URL.replace(/\/+$/, '');
    if (process.env.DEPLOY_URL) return process.env.DEPLOY_URL.replace(/\/+$/, '');
    var headers = (event && event.headers) || {};
    var host = headers['x-forwarded-host'] || headers.host || 'localhost:8888';
    var proto = (String(host).indexOf('localhost') === 0 || String(host).indexOf('127.0.0.1') === 0) ? 'http://' : 'https://';
    return proto + host;
}

/* ---------- 校验 Netlify Identity 令牌，返回用户信息或 null ---------- */
async function verifyUser(event) {
    var r = await verifyUserDetailed(event);
    return r.user;
}

/* 带诊断的令牌校验：把失败原因（有没有令牌 / Identity 返回什么状态码）一并交回，
 * 便于前端区分"没登录"（401）与"登录了但不是管理员"（403）。 */
async function verifyUserDetailed(event) {
    var headers = (event && event.headers) || {};
    var auth = headers.authorization || headers.Authorization || '';
    var base = getSiteBase(event);
    if (auth.indexOf('Bearer ') !== 0) {
        return { user: null, reason: 'no_token', hasToken: false, identityStatus: 0, base: base };
    }
    var token = auth.slice(7).trim();
    if (!token) {
        return { user: null, reason: 'empty_token', hasToken: false, identityStatus: 0, base: base };
    }
    try {
        var res = await fetch(base + '/.netlify/identity/user', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) {
            var body = await res.text().catch(function () { return ''; });
            return {
                user: null, reason: 'identity_' + res.status, hasToken: true,
                identityStatus: res.status, identityBody: String(body || '').slice(0, 300), base: base
            };
        }
        var u = await res.json();   // { id, email, app_metadata, user_metadata, ... }
        if (!u || !u.email) {
            return { user: null, reason: 'no_email_claim', hasToken: true, identityStatus: 200, base: base };
        }
        return { user: u, reason: 'ok', hasToken: true, identityStatus: 200, base: base };
    } catch (e) {
        return {
            user: null, reason: 'fetch_error', hasToken: true, identityStatus: 0,
            detail: String(e && e.message || e).slice(0, 200), base: base
        };
    }
}

/* ---------- 管理员邮箱名单 ----------
 * 容错设计：Netlify 环境变量名大小写/连字符敏感，历史上出现过 ADMIN-EMAILS、
 * admin-emails、ADMIN_EMAIL 等写法导致读取为空。这里统一收口：
 *   1) 先按常见写法逐个尝试；
 *   2) 再遍历全部环境变量，凡规范化后等于 adminemails / adminemail 的一并纳入；
 *   3) 值统一去引号、去 mailto:，支持英文/中文逗号、分号、换行、空格分隔。
 */
var ADMIN_VAR_CANDIDATES = [
    'ADMIN_EMAILS', 'ADMIN_EMAIL', 'ADMINEMAILS', 'ADMIN-EMAILS',
    'admin-emails', 'admin_emails', 'Admin_Emails', 'TEACHER_EMAILS'
];

function normEnvKey(k) {
    return String(k || '').toLowerCase().replace(/[^a-z]/g, '');
}

function adminEmailList() {
    var names = [], raw = [];
    ADMIN_VAR_CANDIDATES.forEach(function (n) {
        var v = process.env[n];
        if (v != null && String(v).trim() !== '') { names.push(n); raw.push(v); }
    });
    Object.keys(process.env).forEach(function (k) {
        if (names.indexOf(k) !== -1) return;
        var nk = normEnvKey(k);
        if (nk === 'adminemails' || nk === 'adminemail' || nk === 'teacheremails') {
            var v = process.env[k];
            if (v != null && String(v).trim() !== '') { names.push(k); raw.push(v); }
        }
    });
    var list = [];
    raw.forEach(function (v) {
        String(v)
            .replace(/[\u201c\u201d\u2018\u2019"']/g, '')   // 去各种引号
            .split(/[,\uff0c;\uff1b\s]+/)                    // 英/中文逗号、分号、空白
            .forEach(function (s) {
                s = String(s).trim().replace(/^mailto:/i, '').toLowerCase();
                if (s && s.indexOf('@') > 0 && s.length <= 200 && list.indexOf(s) === -1) list.push(s);
            });
    });
    return { list: list, names: names };
}

function isAdminEmail(email) {
    if (!email) return false;
    var list = adminEmailList().list;
    return list.indexOf(String(email).trim().toLowerCase()) !== -1;
}

/* 诊断信息：只暴露"变量名 + 邮箱条数 + 是否命中"，不泄露具体邮箱值 */
function adminDebug(email) {
    var r = adminEmailList();
    return {
        matched: !!email && r.list.indexOf(String(email).trim().toLowerCase()) !== -1,
        envVars: r.names,
        emailCount: r.list.length
    };
}

function json(status, obj) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(obj)
    };
}

/* ---------- 时间归一化：'2026-09-01' → ISO；否则原样 ---------- */
function normTime(s, endOfDay) {
    if (!s) return '';
    var t = String(s).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return endOfDay ? t + 'T23:59:59Z' : t + 'T00:00:00Z';
    }
    return t;
}

function getClientIp(event) {
    var headers = (event && event.headers) || {};
    var ip = headers['x-nf-client-connection-ip'] || '';
    if (!ip) {
        var fwd = headers['x-forwarded-for'] || '';
        if (fwd) ip = String(fwd).split(',')[0].trim();
    }
    return String(ip || '').slice(0, 64);
}

function getClientUa(event) {
    var headers = (event && event.headers) || {};
    return String(headers['user-agent'] || '').slice(0, 300);
}

/* ---------- Supabase REST 写入 ---------- */
async function sbInsert(table, row) {
    var url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    var key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_ENV_MISSING');
    var res = await fetch(url + '/rest/v1/' + table, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
        },
        body: JSON.stringify(row)
    });
    if (!res.ok) {
        var txt = await res.text().catch(function () { return ''; });
        throw new Error('SUPABASE_INSERT_' + res.status + '_' + txt.slice(0, 200));
    }
    return true;
}

/* ---------- Supabase REST 查询 ---------- */
async function sbSelect(table, filters, selectFields) {
    var url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    var key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_ENV_MISSING');
    var cols = selectFields || 'id,email,event_type,action,detail,ip,created_at';
    var parts = ['select=' + encodeURIComponent(cols)];
    filters = filters || {};
    if (filters.user_id) parts.push('user_id=eq.' + encodeURIComponent(filters.user_id));
    if (filters.email) parts.push('email=eq.' + encodeURIComponent(filters.email));
    if (filters.type) parts.push('event_type=eq.' + encodeURIComponent(filters.type));
    if (filters.quiz_id) parts.push('quiz_id=eq.' + encodeURIComponent(filters.quiz_id));
    if (filters.status) parts.push('status=eq.' + encodeURIComponent(filters.status));
    if (filters.from) parts.push('created_at=gte.' + encodeURIComponent(filters.from));
    if (filters.to) parts.push('created_at=lte.' + encodeURIComponent(filters.to));
    if (filters.order) parts.push('order=' + encodeURIComponent(filters.order));
    else if (!selectFields) parts.push('order=created_at.desc'); // 日志查询默认按时间倒序
    var limit = Math.min(parseInt(filters.limit || '200', 10) || 200, 500);
    var offset = parseInt(filters.offset || '0', 10) || 0;
    parts.push('limit=' + limit);
    if (offset) parts.push('offset=' + offset);
    var res = await fetch(url + '/rest/v1/' + table + '?' + parts.join('&'), {
        headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!res.ok) {
        var txt = await res.text().catch(function () { return ''; });
        throw new Error('SUPABASE_SELECT_' + res.status + '_' + txt.slice(0, 200));
    }
    return await res.json();
}

/* ---------- Supabase REST 插入/更新（按 onConflict 字段 upsert） ---------- */
async function sbUpsert(table, row, onConflict) {
    var url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    var key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_ENV_MISSING');
    var q = '/rest/v1/' + table + '?on_conflict=' + encodeURIComponent(onConflict);
    var res = await fetch(url + q, {
        method: 'POST',
        headers: {
            apikey: key,
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(row)
    });
    if (!res.ok) {
        var txt = await res.text().catch(function () { return ''; });
        throw new Error('SUPABASE_UPSERT_' + res.status + '_' + txt.slice(0, 200));
    }
    return true;
}

/* ---------- Supabase REST 删除（按 eq 条件，键值对全部 AND） ---------- */
async function sbDelete(table, filters) {
    var url = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
    var key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_ENV_MISSING');
    var parts = [];
    filters = filters || {};
    Object.keys(filters).forEach(function (k) {
        parts.push(encodeURIComponent(k) + '=eq.' + encodeURIComponent(filters[k]));
    });
    if (!parts.length) throw new Error('SB_DELETE_NO_FILTER'); // 防误删全表
    var res = await fetch(url + '/rest/v1/' + table + '?' + parts.join('&'), {
        method: 'DELETE',
        headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'return=minimal' }
    });
    if (!res.ok) {
        var txt = await res.text().catch(function () { return ''; });
        throw new Error('SUPABASE_DELETE_' + res.status + '_' + txt.slice(0, 200));
    }
    return true;
}

module.exports = {
    requireEnv: requireEnv,
    verifyUser: verifyUser,
    verifyUserDetailed: verifyUserDetailed,
    isAdminEmail: isAdminEmail,
    adminDebug: adminDebug,
    json: json,
    normTime: normTime,
    getClientIp: getClientIp,
    getClientUa: getClientUa,
    sbInsert: sbInsert,
    sbSelect: sbSelect,
    sbUpsert: sbUpsert,
    sbDelete: sbDelete
};
