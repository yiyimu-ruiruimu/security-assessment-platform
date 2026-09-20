/* =====================================================================
 * netlify/functions/progress-list.js — 教师查询所有学生技能闯关进度
 * 调用方：admin.html 的「🎮 技能闯关」卡片
 * 请求：GET
 *        Header Authorization: Bearer <Netlify Identity JWT>
 *        可选参数 email=xxx（按学生邮箱精确过滤）
 * 返回：{ ok, count, rows:[{user_id,email,case_id,total_attempts,
 *                          passed_levels,best_pct,last_attempt_at,
 *                          unlocked_level_idx,updated_at}] }
 * 鉴权：必须登录 + ADMIN_EMAILS 中的教师邮箱
 * ===================================================================== */
'use strict';

const B = require('./_shared/backend.js');

const TABLE = 'user_progress';

exports.handler = async function (event) {
    if (event.httpMethod !== 'GET') {
        return B.json(405, { ok: false, error: 'method_not_allowed' });
    }

    // 1) 校验登录令牌
    const user = await B.verifyUser(event);
    if (!user) return B.json(401, { ok: false, error: 'unauthorized' });

    // 2) 仅教师管理员可查
    const email = String(user.email || '').toLowerCase();
    if (!B.isAdminEmail(email)) {
        return B.json(403, { ok: false, error: 'forbidden', hint: '当前账号不是教师管理员' });
    }

    // 3) 组装筛选（仅 email 过滤；case_id 在前端按需筛）
    const q = (event.queryStringParameters || {});
    const emailFilter = q.email ? String(q.email).trim().slice(0, 200) : '';

    try {
        // 4) 读全部（或按邮箱筛的）进度行；显式给 select 字段，避免 sbSelect 默认按 created_at 排序
        const filters = emailFilter ? { email: emailFilter } : {};
        const rows = await B.sbSelect(TABLE, filters, 'user_id,email,data,updated_at');

        // 5) 聚合每个 caseId 的统计
        const out = [];
        rows.forEach(function (row) {
            let data = null;
            try {
                data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || null);
            } catch (e) { data = null; }
            const games = (data && data.games && typeof data.games === 'object') ? data.games : {};
            const userEmail = row.email || '';

            Object.keys(games).forEach(function (caseId) {
                const slot = games[caseId] || {};
                const attempts = Array.isArray(slot.attempts) ? slot.attempts : [];
                let totalAttempts = 0;
                const passedLevelSet = {};   // li -> true（同一关多次通过只计 1）
                let bestPct = 0;
                let lastAttemptAt = 0;

                attempts.forEach(function (arr, li) {
                    if (!Array.isArray(arr)) return;
                    arr.forEach(function (rec) {
                        if (!rec || typeof rec !== 'object') return;
                        totalAttempts++;
                        const pct = Number(rec.pct || 0);
                        if (pct >= 80) passedLevelSet[li] = true;
                        if (pct > bestPct) bestPct = pct;
                        const dt = Number(rec.date || 0);
                        if (dt > lastAttemptAt) lastAttemptAt = dt;
                    });
                });

                const passedLevels = Object.keys(passedLevelSet).length;
                out.push({
                    user_id: row.user_id || '',
                    email: userEmail,
                    case_id: caseId,
                    total_attempts: totalAttempts,
                    passed_levels: passedLevels,
                    best_pct: bestPct,
                    last_attempt_at: lastAttemptAt || null,
                    unlocked_level_idx: Number(slot.unlockedLevelIdx || 0),
                    updated_at: row.updated_at || null
                });
            });
        });

        // 6) 按最近尝试时间倒序，无记录排到最后
        out.sort(function (a, b) {
            return (b.last_attempt_at || 0) - (a.last_attempt_at || 0);
        });

        return B.json(200, { ok: true, count: out.length, rows: out });
    } catch (err) {
        const msg = String(err && err.message || 'unknown');
        if (msg === 'SUPABASE_ENV_MISSING') {
            return B.json(500, {
                ok: false,
                error: 'server_not_configured',
                hint: '请在 Netlify 后台配置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY'
            });
        }
        console.error('[progress-list.js]', msg);
        return B.json(500, { ok: false, error: 'db_error' });
    }
};