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
    try {
        var headers = (event && event.headers) || {};
        var auth = headers.authorization || headers.Authorization || '';
        if (auth.indexOf('Bearer ') !== 0) return null;
        var token = auth.slice(7).trim();
        if (!token) return null;
        var base = getSiteBase(event);
        var res = await fetch(base + '/.netlify/identity/user', {
            headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) return null;
        return await res.json();   // { id, email, app_metadata, user_metadata, ... }
    } catch (e) {
        return null;
    }
}

function isAdminEmail(email) {
    if (!email) return false;
    var list = requireEnv('ADMIN_EMAILS').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    return list.indexOf(String(email).toLowerCase()) !== -1;
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

module.exports = {
    requireEnv: requireEnv,
    verifyUser: verifyUser,
    isAdminEmail: isAdminEmail,
    json: json,
    normTime: normTime,
    getClientIp: getClientIp,
    getClientUa: getClientUa,
    sbInsert: sbInsert,
    sbSelect: sbSelect,
    sbUpsert: sbUpsert
};
