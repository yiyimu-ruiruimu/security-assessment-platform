
(function () {
    'use strict';

    var currentPage = 0;
    var currentRows = [];
    var maxRows = 0;                 // 已拉到的最大 offset（无总数列，用结果数判断是否还有下一页）
    var busy = false;

    var TYPE_LABEL = { login: '登录', entry: '进入平台', operation: '操作', logout: '登出' };

    function $(id) { return document.getElementById(id); }
    function onReady(cb) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb); else cb(); }

    function showMsg(kind, text) {
        var m = $('msgBox');
        m.className = 'msg ' + kind;
        m.textContent = text;
        m.style.display = 'block';
    }
    function clearMsg() { $('msgBox').style.display = 'none'; }

    function currentUser() {
        try { if (typeof netlifyIdentity !== 'undefined') return netlifyIdentity.currentUser() || null; } catch (e) { /* noop */ }
        return null;
    }

    function doLogin() {
        if (typeof netlifyIdentity === 'undefined') { showMsg('err', '登录组件未加载：请先部署到 Netlify 并开启 Identity 服务。'); return; }
        netlifyIdentity.open('login');
    }

    /* 401 时用：清掉本地过期令牌，重新拉起登录窗口 */
    function doRelogin() {
        try { if (typeof netlifyIdentity !== 'undefined') netlifyIdentity.logout(); } catch (e) { /* noop */ }
        setTimeout(function () {
            try { if (typeof netlifyIdentity !== 'undefined') netlifyIdentity.open('login'); } catch (e) { /* noop */ }
        }, 400);
    }

    function fmtTime(iso) {
        if (!iso) return '-';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            return d.toLocaleString('zh-CN', { hour12: false });
        } catch (e) { return iso; }
    }

    function badgeClass(t) {
        if (t === 'login') return 'b-login';
        if (t === 'entry') return 'b-entry';
        if (t === 'operation') return 'b-operation';
        if (t === 'logout') return 'b-logout';
        return 'b-other';
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function render(rows) {
        var tb = $('tbody');
        currentRows = rows || [];
        if (!currentRows.length) {
            tb.innerHTML = '<tr><td colspan="6" class="empty">暂无数据（可调整筛选条件）</td></tr>';
            $('statBadge').innerHTML = '';
            return;
        }
        var html = '';
        currentRows.forEach(function (r) {
            var email = r.email || '-';
            html += '<tr>'
                + '<td style="white-space:nowrap;">' + esc(fmtTime(r.created_at)) + '</td>'
                + '<td class="email-cell">' + esc(email) + '</td>'
                + '<td><span class="b ' + badgeClass(r.event_type) + '">' + esc(TYPE_LABEL[r.event_type] || r.event_type || '-') + '</span></td>'
                + '<td>' + esc(r.action || '-') + '</td>'
                + '<td class="detail-cell">' + esc(r.detail || '') + '</td>'
                + '<td style="white-space:nowrap;">' + esc(r.ip || '-') + '</td>'
                + '</tr>';
        });
        tb.innerHTML = html;

        // 类型分布
        var counts = {};
        currentRows.forEach(function (r) { counts[r.event_type] = (counts[r.event_type] || 0) + 1; });
        var badges = Object.keys(counts).map(function (k) {
            return '<span class="b ' + badgeClass(k) + '" style="margin-right:4px;">' + esc(TYPE_LABEL[k] || k) + ' ' + counts[k] + '</span>';
        }).join('');
        $('statBadge').innerHTML = badges;
    }

    function search(page) {
        if (busy) return;
        var limit = parseInt($('fLimit').value, 10) || 100;
        var offset = page * limit;
        if (offset < 0) return;

        busy = true;
        clearMsg();
        $('statInfo').textContent = '查询中……';

        var params = {
            limit: limit,
            offset: offset
        };
        var em = $('fEmail').value.trim();
        if (em) params.email = em;
        var tp = $('fType').value;
        if (tp) params.type = tp;
        var from = $('fFrom').value;
        if (from) params.from = from;
        var to = $('fTo').value;
        if (to) params.to = to;

        window.fetchLogs(params).then(function (data) {
            busy = false;
            currentPage = page;
            render(data.rows || []);
            var fromN = offset + 1;
            var toN = offset + (data.rows || []).length;
            $('statInfo').textContent = '显示第 ' + fromN + ' - ' + toN + ' 条（共拉取 ' + (data.rows || []).length + ' 条）';
            $('btnPrev').disabled = (currentPage === 0);
            $('btnNext').disabled = ((data.rows || []).length < limit);
        }).catch(function (err) {
            busy = false;
            render([]);
            $('statInfo').textContent = '';
            if (err && err.message === 'FORBIDDEN') showMsg('err', '无访问权限：当前账号不是教师管理员。');
            else if (err && err.message === 'NO_USER') showMsg('err', '登录已失效，请重新登录。');
            else showMsg('err', '查询失败：' + (err && err.message || '未知错误'));
        });
    }

    function exportCsv() {
        var params = { limit: 500 };
        var em = $('fEmail').value.trim();
        if (em) params.email = em;
        var tp = $('fType').value;
        if (tp) params.type = tp;
        var from = $('fFrom').value;
        if (from) params.from = from;
        var to = $('fTo').value;
        if (to) params.to = to;

        window.fetchLogs(params).then(function (data) {
            var rows = data.rows || [];
            if (!rows.length) { showMsg('info', '当前筛选条件下没有可导出的数据。'); return; }
            var head = ['时间', '邮箱', '类型', '动作', '明细', 'IP'];
            var lines = rows.map(function (r) {
                return [fmtTime(r.created_at), r.email, TYPE_LABEL[r.event_type] || r.event_type, r.action, r.detail, r.ip]
                    .map(function (v) {
                        var s = String(v == null ? '' : v);
                        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
                    }).join(',');
            });
            var csv = '\ufeff' + head.join(',') + '\n' + lines.join('\n');
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            var d = new Date();
            var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            a.download = '平台日志_' + stamp + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            showMsg('ok', '已导出 ' + rows.length + ' 条记录到 CSV 文件。');
        }).catch(function (err) {
            if (err && err.message === 'FORBIDDEN') showMsg('err', '无访问权限：当前账号不是教师管理员。');
            else showMsg('err', '导出失败：' + (err && err.message || '未知错误'));
        });
    }

    function checkAccess() {
        var u = currentUser();
        if (!u) {
            $('guestView').style.display = 'block';
            $('deniedView').style.display = 'none';
            $('mainView').style.display = 'none';
            $('barEmail').textContent = '';
            return;
        }
        $('barEmail').textContent = u.email;
        $('guestView').style.display = 'none';

        window.fetchSelf().then(function (info) {
            if (!info) { showMsg('err', '无法连接日志服务，请确认站点 Functions 已部署。'); return; }
            if (info.admin) {
                $('deniedView').style.display = 'none';
                $('mainView').style.display = 'block';
                $('quizCard').style.display = 'block';
                $('gameCard').style.display = 'block';
                clearMsg();
                search(0);
                if (window.qInit) window.qInit();
                if (window.gSearch) window.gSearch(0);
            } else {
                $('deniedView').style.display = 'block';
                $('mainView').style.display = 'none';
                $('quizCard').style.display = 'none';
                $('gameCard').style.display = 'none';
                var diag = $('deniedDiag');
                if (!diag) return;
                var reBtn = $('reloginBtn');
                if (reBtn) reBtn.style.display = 'none';
                if (info.ok === false) {
                    // 接口本身没通过：401 = 令牌失效/身份校验失败；403 = 登录正常但不在管理员名单
                    if (info.status === 401) {
                        diag.innerHTML = '诊断：身份校验未通过（HTTP 401，原因 ' + (info.reason || 'token 无效') +
                            '）。<b>不是管理员名单的问题</b>——点下方按钮重新登录后再刷新。';
                        if (reBtn) reBtn.style.display = 'inline-block';
                    } else if (info.status === 403) {
                        diag.innerHTML = '诊断：登录正常，但服务端没有把您识别为管理员（HTTP 403）。请退出重登后再看。';
                        if (reBtn) reBtn.style.display = 'inline-block';
                    } else {
                        diag.innerHTML = '诊断：日志服务返回 HTTP ' + info.status + '，请确认 Functions 已部署。';
                    }
                    return;
                }
                var vars = info.envVars || [];
                var n = (typeof info.emailCount === 'number') ? info.emailCount : 0;
                var masks = (info.emailMasks || []).join('、');
                if (!vars.length) {
                    diag.innerHTML = '诊断：服务端<b>没有读到</b>任何管理员变量（当前登录 ' + info.email +
                        '）。请确认变量名是 <b>ADMIN_EMAILS</b>（全大写 + 下划线），并已重新部署。';
                } else if (!n) {
                    diag.innerHTML = '诊断：已读到变量 ' + vars.join('、') + '，但<b>名单为空</b>（值可能为空或格式不对）。';
                } else {
                    diag.innerHTML = '诊断：已读到变量 ' + vars.join('、') + '，名单共 <b>' + n +
                        '</b> 条：<b>' + masks + '</b>；当前登录账号是 <b>' + info.email +
                        '</b>，两者不一致（请核对拼写、域名、是否有空格或引号）。';
                }
            }
        }).catch(function () {
            showMsg('err', '身份校验失败，请刷新重试。');
        });
    }

    onReady(function () {
        if (typeof netlifyIdentity === 'undefined') {
            showMsg('err', '当前为本地预览模式：日志后台需部署到 Netlify 并开启 Identity 服务后可用。');
            $('guestView').style.display = 'block';
            return;
        }
        netlifyIdentity.on('login', checkAccess);
        netlifyIdentity.on('logout', function () {
            $('mainView').style.display = 'none';
            $('deniedView').style.display = 'none';
            $('quizCard').style.display = 'none';
            $('gameCard').style.display = 'none';
            $('guestView').style.display = 'block';
            $('barEmail').textContent = '';
        });
        checkAccess();
    });

    window.doLogin = doLogin;
    window.search = search;
    window.exportCsv = exportCsv;
})();

;

/* ================= 互动答题 · 教师端逻辑 ================= */
(function () {
    'use strict';

    var qData = [];            // 编辑中的题目 [{q, opts:[], ans:0}]
    var qStatus = 'open';      // 编辑中题组当前状态
    var qListCache = [];       // 题组列表缓存
    var lastStats = null;      // 最近一次统计结果（导出用）
    var autoTimer = null;
    var LETTERS = 'ABCDEF';

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function msg(kind, text) { // 复用主脚本的消息条
        var m = $('msgBox');
        m.className = 'msg ' + kind;
        m.textContent = text;
        m.style.display = 'block';
        if (kind === 'ok' || kind === 'info') setTimeout(function () { m.style.display = 'none'; }, 4000);
    }

    function getToken() {
        try {
            var u = netlifyIdentity.currentUser();
            if (u && u.token && u.token.access_token) return u.token.access_token;
        } catch (e) { /* noop */ }
        return null;
    }

    function apiGet(params) {
        var token = getToken();
        if (!token) return Promise.reject(new Error('未登录'));
        var qs = [];
        Object.keys(params || {}).forEach(function (k) { qs.push(k + '=' + encodeURIComponent(params[k])); });
        return fetch('/.netlify/functions/quiz' + (qs.length ? '?' + qs.join('&') : ''), {
            headers: { 'Authorization': 'Bearer ' + token }
        }).then(function (r) {
            return r.json().then(function (b) {
                if (!r.ok) return Promise.reject(new Error(b.hint || b.error || ('HTTP_' + r.status)));
                return b;
            });
        });
    }

    function apiPost(body) {
        var token = getToken();
        if (!token) return Promise.reject(new Error('未登录'));
        return fetch('/.netlify/functions/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(body)
        }).then(function (r) {
            return r.json().then(function (b) {
                if (!r.ok || !b.ok) return Promise.reject(new Error(b.hint || b.error || ('HTTP_' + r.status)));
                return b;
            });
        });
    }

    /* ---------- 初始化：拉题组列表 ---------- */
    function qInit() {
        apiGet({ list: 1 }).then(function (data) {
            qListCache = data.rows || [];
            var optHtml = '<option value="">— 选择题组 —</option>';
            qListCache.forEach(function (r) {
                var label = r.title + '（' + r.count + '题 · ' + (r.status === 'open' ? '开放中' : '已关闭') + '）';
                optHtml += '<option value="' + esc(r.quiz_id) + '">' + esc(label) + '</option>';
            });
            $('qLoadSel').innerHTML = optHtml;
            $('qStatSel').innerHTML = optHtml;
        }).catch(function (err) {
            msg('err', '题组列表加载失败：' + (err && err.message || '未知错误'));
        });
    }

    function qSwitch(tab) {
        var edit = tab === 'edit';
        $('qtabEdit').className = 'qtab' + (edit ? ' on' : '');
        $('qtabStat').className = 'qtab' + (!edit ? ' on' : '');
        $('qpaneEdit').className = 'qpane' + (edit ? ' on' : '');
        $('qpaneStat').className = 'qpane' + (!edit ? ' on' : '');
        if (!edit) qInit();
    }

    /* ---------- 编辑器 ---------- */
    function suggestId() {
        var d = new Date();
        function p(n) { return String(n).padStart(2, '0'); }
        return 'quiz-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    }

    function qNewForm() {
        $('qId').value = suggestId();
        $('qTitle').value = '';
        qStatus = 'open';
        qData = [{ q: '', opts: ['', '', '', ''], ans: 0 }];
        renderEditor();
        msg('info', '已新建空白题组，填写题干与选项后保存。');
    }

    function qAddQuestion() {
        if (qData.length >= 30) { msg('err', '单题组最多 30 题。'); return; }
        collectEditor();
        qData.push({ q: '', opts: ['', '', '', ''], ans: 0 });
        renderEditor();
    }

    function collectEditor() {
        var items = $('qEditor').querySelectorAll('.qedit-item');
        qData.forEach(function (qd, i) {
            var it = items[i];
            if (!it) return;
            var ta = it.querySelector('textarea');
            qd.q = ta ? ta.value : qd.q;
            var optInputs = it.querySelectorAll('.opt-row input[type=text]');
            qd.opts = [];
            for (var j = 0; j < optInputs.length; j++) qd.opts.push(optInputs[j].value);
            var sel = it.querySelector('.opt-row select');
            qd.ans = sel ? parseInt(sel.value, 10) : 0;
        });
    }

    function renderEditor() {
        var html = '';
        qData.forEach(function (qd, i) {
            html += '<div class="qedit-item" data-idx="' + i + '">'
                + '<div class="qhead"><span class="qn">第 ' + (i + 1) + ' 题</span>'
                + '<button class="del" onclick="qDelQuestion(' + i + ')">删除本题</button></div>'
                + '<textarea rows="2" placeholder="题干，如：安全通信网络属于哪类安全指标？">' + esc(qd.q) + '</textarea>';
            var n = Math.max(qd.opts.length, 2);
            var opts = qd.opts.slice(0, n);
            while (opts.length < n) opts.push('');
            var letters = '';
            for (var j = 0; j < opts.length; j++) letters += '<option value="' + j + '"' + (qd.ans === j ? ' selected' : '') + '>' + LETTERS[j] + '</option>';
            opts.forEach(function (o, j) {
                html += '<div class="opt-row"><span class="ol">' + LETTERS[j] + '</span>'
                    + '<input type="text" value="' + esc(o) + '" placeholder="选项 ' + LETTERS[j] + ' 内容">'
                    + (j === opts.length - 1 && opts.length < 6 ? '<button class="add-opt" onclick="qAddOption(' + i + ')">＋选项</button>' : '')
                    + '</div>';
            });
            html += '<div class="opt-row" style="margin-top:10px;"><span style="font-size:.84rem;color:#6b7a8d;">正确答案</span>'
                + '<select onchange="qMarkAns(' + i + ', this.value)">' + letters + '</select>'
                + '<span style="font-size:.8rem;color:#95a5b6;">（统计中标绿显示）</span></div>'
                + '</div>';
        });
        $('qEditor').innerHTML = html || '<p class="muted" style="padding:12px 0;">暂无题目，点击「＋ 添加题目」开始出题。</p>';
    }

    function qAddOption(idx) {
        collectEditor();
        if ((qData[idx].opts || []).length >= 6) return;
        qData[idx].opts.push('');
        renderEditor();
    }

    function qDelQuestion(idx) {
        collectEditor();
        if (qData.length <= 1) { msg('err', '至少保留一道题目。'); return; }
        qData.splice(idx, 1);
        renderEditor();
    }

    function qMarkAns(idx, val) {
        qData[idx].ans = parseInt(val, 10) || 0;
    }

    function qSave(status) {
        collectEditor();
        var quizId = $('qId').value.trim();
        var title = $('qTitle').value.trim();
        if (!/^[A-Za-z0-9_-]{2,64}$/.test(quizId)) { msg('err', '题组 ID 不合法：仅限字母/数字/横线/下划线，2-64 位。'); return; }
        if (!qData.length) { msg('err', '请至少添加一道题目。'); return; }
        for (var i = 0; i < qData.length; i++) {
            if (!qData[i].q.trim()) { msg('err', '第 ' + (i + 1) + ' 题题干为空。'); return; }
            var nonEmpty = qData[i].opts.filter(function (o) { return o.trim(); });
            if (nonEmpty.length < 2) { msg('err', '第 ' + (i + 1) + ' 题至少需要两个非空选项。'); return; }
        }
        apiPost({
            op: 'save',
            quiz_id: quizId,
            title: title,
            status: status,
            questions: qData.map(function (qd, i) {
                var opts = qd.opts.map(function (o) { return o.trim(); }).filter(Boolean);
                return { id: 'q' + (i + 1), q: qd.q.trim(), opts: opts, ans: Math.min(qd.ans, opts.length - 1) };
            })
        }).then(function (b) {
            qStatus = status;
            msg('ok', '题组「' + quizId + '」已保存（' + b.count + ' 题），当前状态：' + (status === 'open' ? '开放作答' : '已关闭') + '。');
            qInit();
        }).catch(function (err) {
            msg('err', '保存失败：' + (err && err.message || '未知错误'));
        });
    }

    function qLoadSelected() {
        var id = $('qLoadSel').value;
        if (!id) { msg('info', '请先在下拉框选择题组。'); return; }
        apiGet({ quiz: id }).then(function (data) {
            var qz = data.quiz || {};
            $('qId').value = qz.quiz_id || id;
            $('qTitle').value = qz.title || '';
            qStatus = qz.status || 'open';
            qData = (qz.questions || []).map(function (x) {
                return { q: x.q || '', opts: (x.opts || []).slice(), ans: Math.max(0, LETTERS.indexOf(x.ans || 'A')) };
            });
            if (!qData.length) qData = [{ q: '', opts: ['', '', '', ''], ans: 0 }];
            renderEditor();
            msg('info', '已载入「' + (qz.title || id) + '」（' + (qz.status === 'open' ? '开放中' : '已关闭') + '），修改后保存即更新。');
        }).catch(function (err) {
            msg('err', '载入失败：' + (err && err.message || '未知错误'));
        });
    }

    function qCopyLink() {
        var quizId = $('qId').value.trim();
        if (!quizId) { msg('err', '请先填写题组 ID。'); return; }
        var url = location.origin + location.pathname.replace(/admin\.html.*$/, '') + 'quiz-live.html?quiz=' + encodeURIComponent(quizId);
        var done = function () { msg('ok', '学生答题链接已复制：' + url); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, function () { msg('info', '复制链接：' + url); });
        } else {
            msg('info', '复制链接：' + url);
        }
    }

    /* ---------- 统计 ---------- */
    function qStat() {
        var id = $('qStatSel').value;
        if (!id) { msg('info', '请先选择题组。'); return; }
        apiGet({ stats: id }).then(function (data) {
            lastStats = data;
            renderStats(data);
        }).catch(function (err) {
            $('qStatArea').innerHTML = '';
            msg('err', '统计加载失败：' + (err && err.message || '未知错误'));
        });
    }

    function renderStats(data) {
        var qz = data.quiz || {};
        var html = '<div class="qsum">题组：<b>' + esc(qz.title || qz.quiz_id) + '</b>（' + qz.quiz_id + '）· 状态：'
            + (qz.status === 'open' ? '<b style="color:#2e7d32">开放作答中</b>' : '<b style="color:#a93226">已关闭</b>')
            + ' · 参与：<b>' + data.respondents + '</b> 人 · 作答记录：<b>' + data.submissions + '</b> 条 · 刷新时间：' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + '</div>';
        (data.stats || []).forEach(function (s, i) {
            html += '<div class="qstat-card"><div class="qt">第 ' + (i + 1) + ' 题 · ' + esc(s.q)
                + '<span class="tag" style="background:#eef9ee;color:#1e7e34;">正确答案 ' + esc(s.ans || '—') + ' · 已答 ' + s.total + ' 人</span></div>';
            Object.keys(s.options).forEach(function (letter) {
                var o = s.options[letter];
                var right = letter === s.ans;
                var optText = (s.opts && s.opts[letter.charCodeAt(0) - 65]) || '';
                html += '<div class="bar-row"><span class="bl">' + letter + '</span>'
                    + '<div class="btrack"><div class="bfill' + (right ? ' right' : '') + '" style="width:' + Math.max(o.pct, o.count ? 2 : 0) + '%"></div>'
                    + '<span class="btxt">' + esc(optText) + '</span></div>'
                    + '<span class="bpct">' + o.count + ' 人 · ' + o.pct + '%</span></div>';
            });
            html += '</div>';
        });
        // 明细表
        if ((data.detail || []).length) {
            html += '<h4 style="color:#0c447c; margin:16px 0 8px;">学生作答明细</h4><table><thead><tr><th>邮箱</th>';
            (data.stats || []).forEach(function (s, i) { html += '<th>第' + (i + 1) + '题</th>'; });
            html += '<th>正确</th><th>提交时间</th></tr></thead><tbody>';
            data.detail.forEach(function (d) {
                html += '<tr><td class="email-cell">' + esc(d.email || '-') + '</td>';
                (data.stats || []).forEach(function (s) {
                    var a = d.answers[s.id] || '—';
                    var ok = a === s.ans;
                    html += '<td style="color:' + (a === '—' ? '#95a5b6' : ok ? '#1e7e34' : '#a93226') + ';font-weight:' + (ok ? '700' : '400') + '">' + esc(a) + '</td>';
                });
                html += '<td>' + d.correct + ' / ' + (data.stats || []).length + '</td>'
                    + '<td style="white-space:nowrap;">' + esc(fmtTime(d.at)) + '</td></tr>';
            });
            html += '</tbody></table>';
        } else {
            html += '<p class="muted center" style="padding:16px 0;">还没有学生提交作答</p>';
        }
        $('qStatArea').innerHTML = html;
    }

    function fmtTime(iso) {
        if (!iso) return '-';
        try { return new Date(iso).toLocaleString('zh-CN', { hour12: false }); } catch (e) { return iso; }
    }

    function qAutoToggle() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        if ($('qAuto').checked) {
            autoTimer = setInterval(function () {
                if ($('qStatSel').value && $('qpaneStat').className.indexOf('on') !== -1) qStat();
            }, 10000);
            msg('info', '已开启自动刷新：每 10 秒拉取一次最新统计。');
        }
    }

    function qExportCsv() {
        if (!lastStats || !lastStats.detail || !lastStats.detail.length) { msg('info', '暂无可导出的明细数据，请先查看统计。'); return; }
        var stats = lastStats.stats || [];
        var head = ['邮箱'];
        stats.forEach(function (s, i) { head.push('第' + (i + 1) + '题'); });
        head.push('正确题数', '总题数', '提交时间');
        var lines = lastStats.detail.map(function (d) {
            var row = [d.email];
            stats.forEach(function (s) { row.push(d.answers[s.id] || ''); });
            row.push(d.correct, stats.length, fmtTime(d.at));
            return row.map(function (v) {
                var s = String(v == null ? '' : v);
                return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            }).join(',');
        });
        var csv = '\ufeff' + head.join(',') + '\n' + lines.join('\n');
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '互动答题明细_' + (lastStats.quiz && lastStats.quiz.quiz_id || 'quiz') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        msg('ok', '已导出 ' + lastStats.detail.length + ' 名学生的作答明细。');
    }

    window.qInit = qInit;
    window.qSwitch = qSwitch;
    window.qNewForm = qNewForm;
    window.qAddQuestion = qAddQuestion;
    window.qAddOption = qAddOption;
    window.qDelQuestion = qDelQuestion;
    window.qMarkAns = qMarkAns;
    window.qSave = qSave;
    window.qLoadSelected = qLoadSelected;
    window.qCopyLink = qCopyLink;
    window.qStat = qStat;
    window.qAutoToggle = qAutoToggle;
    window.qExportCsv = qExportCsv;

    document.addEventListener('DOMContentLoaded', function () {
        qNewForm();   // 默认给一个可编辑的空白表单
    });
})();

;

/* ================= 技能闯关 · 教师统计 ================= */
(function () {
    'use strict';

    var gCurrentPage = 0;
    var gCurrentRows = [];
    var gBusy = false;
    var gCaseCache = [];

    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtTime(iso) {
        if (!iso) return '-';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleString('zh-CN', { hour12: false });
        } catch (e) { return iso; }
    }

    function getToken() {
        try {
            var u = netlifyIdentity.currentUser();
            if (u && u.token && u.token.access_token) return u.token.access_token;
        } catch (e) { /* noop */ }
        return null;
    }

    function gApi(params) {
        var token = getToken();
        if (!token) return Promise.reject(new Error('NO_TOKEN'));
        var qs = [];
        Object.keys(params || {}).forEach(function (k) { qs.push(k + '=' + encodeURIComponent(params[k])); });
        return fetch('/.netlify/functions/progress-list' + (qs.length ? '?' + qs.join('&') : ''), {
            headers: { 'Authorization': 'Bearer ' + token }
        }).then(function (r) {
            return r.json().then(function (b) {
                if (!r.ok) return Promise.reject(new Error(b.hint || b.error || ('HTTP_' + r.status)));
                return b;
            });
        });
    }

    function gFillCaseSelect(rows) {
        var sel = $('gCaseSel');
        var seen = {};
        gCaseCache.forEach(function (c) { seen[c] = 1; });
        (rows || []).forEach(function (r) { if (r && r.case_id && !seen[r.case_id]) { gCaseCache.push(r.case_id); seen[r.case_id] = 1; } });
        var cur = sel.value;
        var html = '<option value="">全部</option>';
        gCaseCache.slice().sort().forEach(function (c) {
            html += '<option value="' + esc(c) + '">' + esc(c) + '</option>';
        });
        sel.innerHTML = html;
        if (cur) sel.value = cur;
    }

    function gFilterByCase(rows) {
        var c = $('gCaseSel').value;
        if (!c) return rows;
        return rows.filter(function (r) { return r && r.case_id === c; });
    }

    function gRender(rows) {
        var tb = $('gTbody');
        var filtered = gFilterByCase(rows);
        gCurrentRows = filtered;
        if (!filtered.length) {
            tb.innerHTML = '<tr><td colspan="7" class="empty">暂无数据（可调整筛选条件）</td></tr>';
            $('gStatBadge').innerHTML = '';
            return;
        }
        var html = '';
        filtered.forEach(function (r) {
            var best = Number(r.best_pct || 0);
            html += '<tr>'
                + '<td class="email-cell">' + esc(r.email || '-') + '</td>'
                + '<td>' + esc(r.case_id || '-') + '</td>'
                + '<td style="text-align:center;">' + esc(r.passed_levels || 0) + '</td>'
                + '<td style="text-align:center;color:' + (best >= 80 ? '#1e7e34' : '#a93226') + ';font-weight:700;">' + esc(best + '%') + '</td>'
                + '<td style="text-align:center;">' + esc(r.total_attempts || 0) + '</td>'
                + '<td style="white-space:nowrap;">' + esc(fmtTime(r.last_attempt_at)) + '</td>'
                + '<td style="white-space:nowrap;">' + esc(fmtTime(r.updated_at)) + '</td>'
                + '</tr>';
        });
        tb.innerHTML = html;

        var total = filtered.length;
        var pass = filtered.filter(function (r) { return Number(r.best_pct || 0) >= 80; }).length;
        var sumAttempts = filtered.reduce(function (s, r) { return s + Number(r.total_attempts || 0); }, 0);
        $('gStatBadge').innerHTML =
            '<span class="b b-entry" style="margin-right:4px;">学生 ' + total + '</span>'
            + '<span class="b b-operation" style="margin-right:4px;">通关(≥80分) ' + pass + '</span>'
            + '<span class="b b-other">总尝试 ' + sumAttempts + '</span>';
    }

    function gSearch(page) {
        if (gBusy) return;
        var em = $('gEmail').value.trim();
        gBusy = true;
        $('gStatInfo').textContent = '查询中……';
        gApi({ email: em }).then(function (data) {
            gBusy = false;
            gCurrentPage = page;
            gFillCaseSelect(data.rows || []);
            gRender(data.rows || []);
            $('gStatInfo').textContent = '拉取 ' + (data.rows || []).length + ' 条记录（按最近尝试时间排序）';
        }).catch(function (err) {
            gBusy = false;
            gRender([]);
            $('gStatInfo').textContent = '';
            var msg = (err && err.message) || '未知错误';
            if (msg.indexOf('403') !== -1 || msg.indexOf('forbidden') !== -1) {
                $('gTbody').innerHTML = '<tr><td colspan="7" class="empty" style="color:#a93226;">无访问权限：当前账号不是教师管理员。</td></tr>';
            } else {
                $('gTbody').innerHTML = '<tr><td colspan="7" class="empty" style="color:#a93226;">查询失败：' + esc(msg) + '</td></tr>';
            }
        });
    }

    function gExportCsv() {
        var em = $('gEmail').value.trim();
        gApi({ email: em }).then(function (data) {
            var rows = gFilterByCase(data.rows || []);
            if (!rows.length) { alert('当前筛选条件下没有可导出的数据。'); return; }
            var head = ['邮箱', '闯关 case', '已通关(≥80分)', '最高分', '总尝试', '最近尝试', '最后更新'];
            var lines = rows.map(function (r) {
                return [
                    r.email || '',
                    r.case_id || '',
                    r.passed_levels || 0,
                    (Number(r.best_pct || 0)) + '%',
                    r.total_attempts || 0,
                    fmtTime(r.last_attempt_at),
                    fmtTime(r.updated_at)
                ].map(function (v) {
                    var s = String(v == null ? '' : v);
                    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
                }).join(',');
            });
            var csv = '\ufeff' + head.join(',') + '\n' + lines.join('\n');
            var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            var d = new Date();
            var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            a.download = '技能闯关_' + stamp + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        }).catch(function (err) {
            alert('导出失败：' + (err && err.message || '未知错误'));
        });
    }

    window.gSearch = gSearch;
    window.gExportCsv = gExportCsv;
})();
