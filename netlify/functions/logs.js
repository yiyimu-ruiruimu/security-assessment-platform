/* =====================================================================
 * netlify/functions/logs.js — 查询日志（仅教师管理员）
 * 调用方：admin.html（前端不直连数据库）
 * 请求：GET，Header Authorization: Bearer <Netlify Identity JWT>
 * 支持参数：self（返回当前身份）、email、type、from、to、limit、offset
 * 管理员判定：ADMIN_EMAILS 环境变量（逗号分隔邮箱）
 * ===================================================================== */
'use strict';

const B = require('./_shared/backend.js');

exports.handler = async function (event) {
    if (event.httpMethod !== 'GET') {
        return B.json(405, { ok: false, error: 'method_not_allowed' });
    }

    // 1) 校验登录令牌
    const user = await B.verifyUser(event);
    if (!user) return B.json(401, { ok: false, error: 'unauthorized' });

    const email = String(user.email || '').toLowerCase();
    const isAdmin = B.isAdminEmail(email);

    // 2) 身份探测：?self=1
    const q = (event.queryStringParameters || {});
    if (q.self === '1' || q.self === 'true') {
        return B.json(200, { email: email, admin: isAdmin });
    }

    // 3) 仅管理员可查
    if (!isAdmin) return B.json(403, { ok: false, error: 'forbidden', hint: '当前账号不是教师管理员' });

    // 4) 组装查询
    const filters = {
        email: q.email ? String(q.email).trim().slice(0, 200) : '',
        type: q.type ? String(q.type).trim().slice(0, 20) : '',
        from: B.normTime(q.from || '', false),
        to: B.normTime(q.to || '', true),
        limit: q.limit,
        offset: q.offset
    };

    try {
        const rows = await B.sbSelect('user_logs', filters);
        return B.json(200, { ok: true, count: rows.length, rows: rows });
    } catch (err) {
        const msg = String(err && err.message || 'unknown');
        if (msg === 'SUPABASE_ENV_MISSING') {
            return B.json(500, {
                ok: false,
                error: 'server_not_configured',
                hint: '请在 Netlify 后台配置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY'
            });
        }
        console.error('[logs.js]', msg);
        return B.json(500, { ok: false, error: 'db_error' });
    }
};
