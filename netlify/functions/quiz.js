/* =====================================================================
 * netlify/functions/quiz.js — 互动答题（在线选择题 + 教师端统计）
 * ---------------------------------------------------------------------
 * 调用方：quiz-live.html（学生作答）、admin.html（教师出题与统计）
 * 依赖表：public.quiz_questions / public.quiz_answers（见 supabase-setup.sql）
 *
 * 请求（Header 均需 Authorization: Bearer <Netlify Identity JWT>）：
 *   GET ?list=1                题组列表（教师=全部；学生=仅开放中的）
 *   GET ?quiz=<quiz_id>        题组内容（学生不返回正确答案 ans）
 *   GET ?mine=<quiz_id>        本人该题组的作答记录
 *   GET ?stats=<quiz_id>       统计（仅教师）：每题各选项人数/百分比 + 明细
 *   POST op=save      (教师)   Body: { quiz_id, title, status, questions }
 *   POST op=submit    (学生)   Body: { quiz_id, answers:[{question_id, answer}] }
 * ===================================================================== */
'use strict';

const B = require('./_shared/backend.js');

exports.handler = async function (event) {
    try {
        if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
            return B.json(405, { ok: false, error: 'method_not_allowed' });
        }

        // 1) 校验登录令牌
        const user = await B.verifyUser(event);
        if (!user) return B.json(401, { ok: false, error: 'unauthorized' });

        const email = String(user.email || '').toLowerCase();
        const userId = String(user.id || user.sub || '').slice(0, 64);
        const isAdmin = B.isAdminEmail(email);
        const q = (event.queryStringParameters || {});

        if (event.httpMethod === 'GET') {
            if (q.list === '1' || q.list === 'true') return await handleList(isAdmin);
            if (q.quiz) return await handleLoad(String(q.quiz).trim(), isAdmin);
            if (q.mine) return await handleMine(String(q.mine).trim(), userId);
            if (q.stats) {
                if (!isAdmin) return B.json(403, { ok: false, error: 'forbidden', hint: '仅教师管理员可查看统计' });
                return await handleStats(String(q.stats).trim());
            }
            return B.json(400, { ok: false, error: 'bad_params' });
        }

        // POST
        let payload = {};
        try { payload = JSON.parse(event.body || '{}'); } catch (e) {
            return B.json(400, { ok: false, error: 'bad_json' });
        }
        const op = String(payload.op || '');
        if (op === 'save') {
            if (!isAdmin) return B.json(403, { ok: false, error: 'forbidden', hint: '仅教师管理员可保存题组' });
            return await handleSave(payload, email);
        }
        if (op === 'submit') {
            return await handleSubmit(payload, userId, email);
        }
        return B.json(400, { ok: false, error: 'bad_op' });
    } catch (err) {
        const msg = String(err && err.message || 'unknown');
        if (msg === 'SUPABASE_ENV_MISSING') {
            return B.json(500, { ok: false, error: 'server_not_configured', hint: '请在 Netlify 后台配置 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY' });
        }
        console.error('[quiz.js]', msg);
        return B.json(500, { ok: false, error: 'db_error' });
    }
};

/* ---------- 分页取全量行（sbSelect 单页上限 500） ---------- */
async function sbSelectAll(table, filters, cols, maxRows) {
    const cap = maxRows || 5000;
    let out = [];
    let offset = 0;
    while (out.length < cap) {
        const rows = await B.sbSelect(table, Object.assign({}, filters, { limit: 500, offset: offset, order: 'created_at.asc' }), cols);
        if (!rows || !rows.length) break;
        out = out.concat(rows);
        if (rows.length < 500) break;
        offset += 500;
    }
    return out;
}

/* ---------- GET ?list=1：题组列表 ---------- */
async function handleList(isAdmin) {
    if (isAdmin) {
        const rows = await B.sbSelect('quiz_questions', { order: 'updated_at.desc' }, 'quiz_id,title,status,questions,updated_at');
        const list = (rows || []).map(function (r) {
            let qs = [];
            try { qs = JSON.parse(r.questions || '[]'); } catch (e) { qs = []; }
            return { quiz_id: r.quiz_id, title: r.title, status: r.status, updated_at: r.updated_at, count: (qs && qs.length) || 0 };
        });
        return B.json(200, { ok: true, rows: list });
    }
    const rows = await B.sbSelect('quiz_questions', { status: 'open', order: 'updated_at.desc' }, 'quiz_id,title,updated_at');
    const list = (rows || []).map(function (r) { return { quiz_id: r.quiz_id, title: r.title, updated_at: r.updated_at }; });
    return B.json(200, { ok: true, rows: list });
}

/* ---------- GET ?quiz=id：题组内容（学生隐藏正确答案） ---------- */
async function handleLoad(quizId, isAdmin) {
    const rows = await B.sbSelect('quiz_questions', { quiz_id: quizId }, 'quiz_id,title,status,questions,updated_at');
    if (!rows || !rows.length) return B.json(404, { ok: false, error: 'quiz_not_found' });
    const row = rows[0];
    let qs = [];
    try { qs = JSON.parse(row.questions || '[]'); } catch (e) { qs = []; }
    qs = (Array.isArray(qs) ? qs : []).filter(function (x) { return x && x.q; });
    if (!isAdmin) {
        qs = qs.map(function (x) { return { id: x.id, q: x.q, opts: x.opts }; }); // 去 ans
    }
    return B.json(200, { ok: true, quiz: { quiz_id: row.quiz_id, title: row.title, status: row.status, updated_at: row.updated_at, questions: qs } });
}

/* ---------- GET ?mine=id：本人作答 ---------- */
async function handleMine(quizId, userId) {
    const rows = await B.sbSelect('quiz_answers', { quiz_id: quizId, user_id: userId }, 'question_id,answer,is_correct,created_at');
    return B.json(200, { ok: true, rows: rows || [] });
}

/* ---------- GET ?stats=id：教师统计 ---------- */
async function handleStats(quizId) {
    // 1) 题组
    const qRows = await B.sbSelect('quiz_questions', { quiz_id: quizId }, 'quiz_id,title,status,questions,updated_at');
    if (!qRows || !qRows.length) return B.json(404, { ok: false, error: 'quiz_not_found' });
    let qs = [];
    try { qs = JSON.parse(qRows[0].questions || '[]'); } catch (e) { qs = []; }
    qs = Array.isArray(qs) ? qs : [];

    // 2) 作答（分页取全量，每题每选项计数）
    const aRows = await sbSelectAll('quiz_answers', { quiz_id: quizId }, 'question_id,user_id,email,answer,is_correct,created_at');

    const perStudent = {};   // email -> { answers:{qid:ans}, correct, at }
    const counts = {};       // qid -> { A:n, B:n, ... }
    const answered = {};     // qid -> 提交人数
    (aRows || []).forEach(function (r) {
        const qid = String(r.question_id || '');
        const ans = String(r.answer || '').slice(0, 2).toUpperCase();
        if (!counts[qid]) counts[qid] = {};
        counts[qid][ans] = (counts[qid][ans] || 0) + 1;
        answered[qid] = (answered[qid] || 0) + 1;
        const key = r.email || r.user_id || 'unknown';
        if (!perStudent[key]) perStudent[key] = { email: r.email || '', answers: {}, correct: 0, total: 0, at: r.created_at };
        perStudent[key].answers[qid] = ans;
        perStudent[key].total += 1;
        if (r.is_correct) perStudent[key].correct += 1;
        if (r.created_at > perStudent[key].at) perStudent[key].at = r.created_at;
    });

    // 3) 组装每题统计（含百分比）
    const stats = qs.map(function (x, idx) {
        const qid = String(x.id || ('q' + (idx + 1)));
        const total = answered[qid] || 0;
        const opts = {};
        (x.opts || []).forEach(function (_, i) {
            const letter = String.fromCharCode(65 + i);
            const n = (counts[qid] && counts[qid][letter]) || 0;
            opts[letter] = { count: n, pct: total ? Math.round(n * 1000 / total) / 10 : 0 };
        });
        return { id: qid, q: x.q, opts: x.opts, ans: x.ans, total: total, options: opts };
    });

    const detail = Object.keys(perStudent).map(function (k) {
        const s = perStudent[k];
        return { email: s.email || k, answers: s.answers, correct: s.correct, total: s.total, at: s.at };
    }).sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });

    return B.json(200, {
        ok: true,
        quiz: { quiz_id: qRows[0].quiz_id, title: qRows[0].title, status: qRows[0].status, updated_at: qRows[0].updated_at },
        respondents: detail.length,
        submissions: (aRows || []).length,
        stats: stats,
        detail: detail
    });
}

/* ---------- POST op=save：教师保存题组 ---------- */
async function handleSave(payload, email) {
    const quizId = String(payload.quiz_id || '').trim().slice(0, 64);
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(quizId)) {
        return B.json(400, { ok: false, error: 'bad_quiz_id', hint: '题组 ID 仅限字母/数字/横线/下划线，2-64 位' });
    }
    const title = String(payload.title || '').trim().slice(0, 120);
    const status = payload.status === 'closed' ? 'closed' : 'open';
    let qs = payload.questions;
    if (typeof qs === 'string') { try { qs = JSON.parse(qs); } catch (e) { qs = null; } }
    if (!Array.isArray(qs) || !qs.length) return B.json(400, { ok: false, error: 'bad_questions', hint: '至少需要一道题目' });
    if (qs.length > 30) return B.json(400, { ok: false, error: 'too_many_questions', hint: '单题组最多 30 题' });

    // 清洗题目：id / q / opts(2-6 个) / ans
    const letters = 'ABCDEF';
    const cleaned = [];
    for (let i = 0; i < qs.length; i++) {
        const x = qs[i] || {};
        const q = String(x.q || '').trim().slice(0, 300);
        let opts = (Array.isArray(x.opts) ? x.opts : []).map(function (o) { return String(o || '').trim().slice(0, 200); });
        opts = opts.filter(Boolean);
        if (!q || opts.length < 2) return B.json(400, { ok: false, error: 'bad_question', hint: '第 ' + (i + 1) + ' 题需要题干和至少两个非空选项' });
        if (opts.length > 6) opts = opts.slice(0, 6);
        const ansIdx = parseInt(x.ans, 10);
        if (!(ansIdx >= 0 && ansIdx < opts.length)) return B.json(400, { ok: false, error: 'bad_answer', hint: '第 ' + (i + 1) + ' 题未指定正确答案' });
        cleaned.push({ id: String(x.id || ('q' + (i + 1))).slice(0, 20), q: q, opts: opts, ans: letters[ansIdx] });
    }

    await B.sbUpsert('quiz_questions', {
        quiz_id: quizId,
        title: title || ('互动答题 ' + quizId),
        status: status,
        questions: JSON.stringify(cleaned),
        updated_by: email,
        updated_at: new Date().toISOString()
    }, 'quiz_id');

    return B.json(200, { ok: true, quiz_id: quizId, count: cleaned.length });
}

/* ---------- POST op=submit：学生提交作答 ---------- */
async function handleSubmit(payload, userId, email) {
    const quizId = String(payload.quiz_id || '').trim().slice(0, 64);
    if (!quizId) return B.json(400, { ok: false, error: 'bad_quiz_id' });

    let answers = payload.answers;
    if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch (e) { answers = null; } }
    if (!Array.isArray(answers) || !answers.length) return B.json(400, { ok: false, error: 'bad_answers' });

    // 1) 题组须存在且开放
    const qRows = await B.sbSelect('quiz_questions', { quiz_id: quizId }, 'quiz_id,status,questions');
    if (!qRows || !qRows.length) return B.json(404, { ok: false, error: 'quiz_not_found' });
    if (qRows[0].status !== 'open') return B.json(403, { ok: false, error: 'quiz_closed', hint: '该题组已关闭作答' });

    let qs = [];
    try { qs = JSON.parse(qRows[0].questions || '[]'); } catch (e) { qs = []; }
    const ansMap = {};
    (Array.isArray(qs) ? qs : []).forEach(function (x, i) { ansMap[String(x.id || ('q' + (i + 1)))] = x; });

    // 2) 清洗作答（限本题组题目，每题一个 A-F 选项）
    const cleaned = [];
    const seen = {};
    for (let i = 0; i < answers.length && i < 30; i++) {
        const a = answers[i] || {};
        const qid = String(a.question_id || '').trim().slice(0, 20);
        const ans = String(a.answer || '').trim().slice(0, 1).toUpperCase();
        if (!qid || !ansMap[qid] || !/^[A-F]$/.test(ans)) continue;
        if (seen[qid]) continue;
        seen[qid] = true;
        cleaned.push({ question_id: qid, answer: ans, is_correct: ansMap[qid].ans === ans });
    }
    if (!cleaned.length) return B.json(400, { ok: false, error: 'no_valid_answers' });

    // 3) 覆盖式提交：先删本人旧作答，再插入
    await B.sbDelete('quiz_answers', { quiz_id: quizId, user_id: userId });
    for (const row of cleaned) {
        await B.sbInsert('quiz_answers', {
            quiz_id: quizId,
            question_id: row.question_id,
            user_id: userId,
            email: email,
            answer: row.answer,
            is_correct: row.is_correct,
            created_at: new Date().toISOString()
        });
    }

    return B.json(200, { ok: true, saved: cleaned.length });
}
