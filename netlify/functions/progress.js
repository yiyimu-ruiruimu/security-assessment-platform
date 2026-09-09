/* =====================================================================
 * netlify/functions/progress.js — 学习进度云端存取（按账号）
 * 调用方：页面 auth-utils.js（前端不直连数据库，经本函数可信读写）
 * 请求：
 *   GET  /.netlify/functions/progress
 *        Header Authorization: Bearer <Netlify Identity JWT>
 *        返回当前账号进度行 data 或 null
 *   POST /.netlify/functions/progress
 *        Header Authorization: Bearer <JWT>
 *        Body: { progress: { v, updatedAt, quizPass, last, games } }
 *        按 user_id upsert 保存（localStorage 之外可跨设备恢复）
 * 依赖表：public.user_progress（见 supabase-setup.sql）
 * ===================================================================== */
'use strict';

const B = require('./_shared/backend.js');

const TABLE = 'user_progress';
const FIELD = 'data';

exports.handler = async function (event) {
    // 1) 校验登录令牌（必须登录，进度与账号一一对应）
    const user = await B.verifyUser(event);
    if (!user) return B.json(401, { ok: false, error: 'unauthorized' });

    const user_id = String(user.id || user.sub || '').slice(0, 64);
    const email = String(user.email || '').slice(0, 200);

    // 2) GET：读取该账号进度
    if (event.httpMethod === 'GET') {
        try {
            const rows = await B.sbSelect(TABLE, { user_id: user_id }, 'user_id,email,data,updated_at');
            const row = rows && rows.length ? rows[0] : null;
            let progress = null;
            if (row) {
                try { progress = JSON.parse(row[FIELD] || 'null'); } catch (e) { progress = null; }
            }
            return B.json(200, { ok: true, progress: progress });
        } catch (err) {
            const msg = String(err && err.message || 'unknown');
            if (msg === 'SUPABASE_ENV_MISSING') {
                return B.json(500, { ok: false, error: 'server_not_configured' });
            }
            console.error('[progress.js GET]', msg);
            return B.json(500, { ok: false, error: 'db_error' });
        }
    }

    // 3) POST：写入该账号进度（upsert）
    if (event.httpMethod === 'POST') {
        let body = {};
        try { body = JSON.parse(event.body || '{}'); } catch (e) {
            return B.json(400, { ok: false, error: 'bad_json' });
        }
        let progress = body.progress;
        if (!progress || typeof progress !== 'object') {
            return B.json(400, { ok: false, error: 'bad_progress' });
        }
        // 裁剪，防止异常大 payload
        const safe = {
            v: 2,
            updatedAt: Math.max(0, parseInt(progress.updatedAt, 10) || 0),
            quizPass: (progress.quizPass && typeof progress.quizPass === 'object') ? progress.quizPass : {},
            last: (progress.last && typeof progress.last === 'object') ? progress.last : null,
            games: (progress.games && typeof progress.games === 'object') ? progress.games : {},
            autoResume: progress.autoResume !== false
        };
        try {
            await B.sbUpsert(TABLE, {
                user_id: user_id,
                email: email,
                data: JSON.stringify(safe),
                updated_at: new Date().toISOString()
            }, 'user_id');
            return B.json(200, { ok: true });
        } catch (err) {
            const msg = String(err && err.message || 'unknown');
            if (msg === 'SUPABASE_ENV_MISSING') {
                return B.json(500, { ok: false, error: 'server_not_configured' });
            }
            console.error('[progress.js POST]', msg);
            return B.json(500, { ok: false, error: 'db_error' });
        }
    }

    return B.json(405, { ok: false, error: 'method_not_allowed' });
};
