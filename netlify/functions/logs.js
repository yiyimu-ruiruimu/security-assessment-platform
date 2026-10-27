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

    const q = (event.queryStringParameters || {});

    // 0) 公开自检探针：?diag=1
    //    不需要令牌，只回报"读到哪些管理员变量名、名单几条、Identity 是否可达"，
    //    不泄露任何邮箱值。用于在浏览器/命令行直接确认环境变量是否生效。
    if (q.diag === '1') {
        const v = await B.verifyUserDetailed(event);
        const dbg = B.adminDebug('');
        // 用一次捏造的令牌探测 Identity 服务是否可用（应返回 401，而非 5xx/超时）
        let idProbe = 0;
        try {
            const r = await fetch(v.base + '/.netlify/identity/settings');
            idProbe = r.status;
        } catch (e) {
            idProbe = -1;
        }
        return B.json(200, {
            ok: true,
            diag: true,
            adminEnvVars: dbg.envVars,          // ['ADMIN_EMAILS'] 说明变量已被读到
            adminEmailCount: dbg.emailCount,     // >0 说明名单解析出了邮箱
            adminEmailMasks: dbg.emailMasks,      // 脱敏后的名单，用于比对拼写
            identitySettingsStatus: idProbe,     // 200 说明 Identity 服务正常
            siteBase: v.base,
            token: { hasToken: v.hasToken, reason: v.reason, identityStatus: v.identityStatus }
        });
    }

    // 1) 校验登录令牌
    const vd = await B.verifyUserDetailed(event);
    const user = vd.user;
    if (!user) {
        return B.json(401, {
            ok: false,
            error: 'unauthorized',
            reason: vd.reason,
            identityStatus: vd.identityStatus
        });
    }

    const email = String(user.email || '').toLowerCase();
    const isAdmin = B.isAdminEmail(email);

    // 2) 身份探测：?self=1（附带 env 诊断：读到了哪些变量名、名单里有几条邮箱）
    if (q.self === '1' || q.self === 'true') {
        const dbg = B.adminDebug(email);
        return B.json(200, {
            email: email,
            admin: isAdmin,
            envVars: dbg.envVars,
            emailCount: dbg.emailCount,
            emailMasks: dbg.emailMasks
        });
    }

    // 3) 仅管理员可查
    if (!isAdmin) {
        const dbg = B.adminDebug(email);
        return B.json(403, {
            ok: false,
            error: 'forbidden',
            hint: '当前账号不是教师管理员',
            email: email,
            envVars: dbg.envVars,
            emailCount: dbg.emailCount,
            emailMasks: dbg.emailMasks
        });
    }

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
