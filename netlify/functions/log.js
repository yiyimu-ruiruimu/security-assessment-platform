/* =====================================================================
 * netlify/functions/log.js — 写入日志（登录/进入/操作/登出）
 * 调用方：页面 auth-utils.js（前端不直连数据库，经本函数可信写入）
 * 请求：POST，Header Authorization: Bearer <Netlify Identity JWT>
 *       Body: { type, action, detail }
 * ===================================================================== */
'use strict';

const B = require('./_shared/backend.js');

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return B.json(405, { ok: false, error: 'method_not_allowed' });
    }

    // 1) 校验登录令牌
    const user = await B.verifyUser(event);
    if (!user) return B.json(401, { ok: false, error: 'unauthorized' });

    // 2) 解析参数
    let payload = {};
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {
        return B.json(400, { ok: false, error: 'bad_json' });
    }

    const row = {
        user_id: String(user.id || user.sub || '').slice(0, 64),
        email: String(user.email || '').slice(0, 200),
        event_type: String(payload.type || 'operation').slice(0, 20),
        action: String(payload.action || '').slice(0, 120),
        detail: String(payload.detail || '').slice(0, 1000),
        ip: B.getClientIp(event),
        user_agent: B.getClientUa(event),
        created_at: new Date().toISOString()
    };

    // 3) 写入 Supabase
    try {
        await B.sbInsert('user_logs', row);
        return B.json(200, { ok: true });
    } catch (err) {
        const msg = String(err && err.message || 'unknown');
        if (msg === 'SUPABASE_ENV_MISSING') {
            return B.json(500, {
                ok: false,
                error: 'server_not_configured',
                hint: '请在 Netlify 后台配置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY'
            });
        }
        console.error('[log.js]', msg);
        return B.json(500, { ok: false, error: 'db_error' });
    }
};
