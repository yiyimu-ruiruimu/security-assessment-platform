

    (async function() {

        if (typeof initIdentity === 'undefined') return; // 本地预览时不做登录校验

        const identity = await initIdentity();

        if (!identity) return;

        const user = identity.currentUser();

        if (!user) {

            // 未登录：前往登录门户（login.html），登录成功后自动回到本页

            window.location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'index.html'));

            return;

        }



        // ===== 记账：进入平台（相当于考勤打卡，5 分钟内自动去重） =====

        if (typeof trackLogin === 'function') trackLogin();



        // ===== 记账：切换学习任务（点击上方时间线时记录） =====

        document.addEventListener('click', function(e) {

            var item = e.target.closest ? e.target.closest('.timeline-item') : null;

            if (item) {

                if (typeof trackOperation === 'function') trackOperation('切换学习任务', item.textContent.trim());

            }

        });



        function showUserInfo() {

            var existing = document.getElementById('userBar');

            if (existing) return;

            var u = identity.currentUser();

            if (!u) return;

            var bar = document.createElement('div');

            bar.id = 'userBar';

            bar.style.cssText = 'position:fixed;top:10px;right:15px;z-index:9999;background:#fff;padding:8px 14px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.18);font-size:14px;color:#333;line-height:26px;white-space:nowrap;';

            document.body.appendChild(bar);

            if (typeof renderUserBar === 'function') renderUserBar('userBar');

        }

        if (document.readyState === 'loading') {

            document.addEventListener('DOMContentLoaded', showUserInfo);

        } else {

            showUserInfo();

        }

        identity.on('logout', function() {

            window.location.href = 'login.html?loggedOut=1';

        });

    })();

    
;


        document.addEventListener('DOMContentLoaded', function() {

            const timelineItems = document.querySelectorAll('.timeline-item');

            const stages = document.querySelectorAll('.task-stage');

            const explanations = document.querySelectorAll('.exp-stage');

            const btnPrev = document.getElementById('btnPrev');

            const btnNext = document.getElementById('btnNext');

            const timelineProgress = document.getElementById('timelineProgress');

            let currentStage = 0; // 0 = 首页

            const totalStages = timelineItems.length;



            // ===== 内容分类切换：知识 / 实验 / 素养 =====

            // 每个任务（或子任务）页面的左侧内容按类型分为三组，通过顶部按钮切换；

            // 右侧说明面板为"单元简介"，始终直接显示。

            (function setupCategoryTabs() {

                const CAT_DEFS = [

                    { key: 'knowledge', label: '📖 知识' },

                    { key: 'lab', label: '🧪 实验' },

                    { key: 'ai', label: '🌟 素养' }

                ];



                // 内容块的分类规则

                function classify(el) {

                    if (el.classList.contains('lab-box')) return 'lab';

                    if (el.classList.contains('lab-shared')) return 'lab';

                    if (el.classList.contains('ai-tip-box')) return 'ai';

                    if (el.classList.contains('coming-soon')) return 'lab';

                    if (el.classList.contains('practice-box') && /实验任务/.test(el.textContent.slice(0, 80))) return 'lab';

                    return 'knowledge';

                }



                function buildTabsFor(container) {

                    const children = Array.from(container.children);

                    if (!children.length) return;

                    const catOf = children.map(el => classify(el));

                    // h3 小标题归入其后第一个内容块所属的分类

                    for (let i = 0; i < children.length; i++) {

                        if (children[i].tagName === 'H3') {

                            for (let j = i + 1; j < children.length; j++) {

                                if (children[j].tagName === 'H3') break;

                                if (catOf[j]) { catOf[i] = catOf[j]; break; }

                            }

                        }

                    }

                    const groups = { knowledge: [], lab: [], ai: [] };

                    children.forEach((el, i) => groups[catOf[i]].push(el));



                    // 生成分类按钮与三个内容组

                    const tabs = document.createElement('div');

                    tabs.className = 'cat-tabs';

                    const groupEls = {};

                    CAT_DEFS.forEach(def => {

                        const btn = document.createElement('button');

                        btn.type = 'button';

                        btn.className = 'cat-tab';

                        btn.dataset.cat = def.key;

                        btn.innerHTML = def.label;

                        tabs.appendChild(btn);

                        const g = document.createElement('div');

                        g.className = 'cat-group';

                        g.dataset.cat = def.key;

                        groupEls[def.key] = g;

                        groups[def.key].forEach(el => g.appendChild(el));

                    });



                    function activate(key) {

                        tabs.querySelectorAll('.cat-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === key));

                        Object.keys(groupEls).forEach(k => groupEls[k].classList.toggle('active', k === key));

                    }



                    tabs.addEventListener('click', function(e) {

                        const btn = e.target.closest('.cat-tab');

                        if (!btn) return;

                        const isReset = tabs.dataset.reset === '1';

                        activate(btn.dataset.cat);

                        if (!isReset) {

                            if (typeof trackOperation === 'function') trackOperation('切换内容分类', btn.textContent.trim());

                            container.scrollIntoView({ behavior: 'smooth', block: 'start' });

                        }

                    });



                    // 素养组：自动生成"AI 求助点速查"索引（指向各实验内的 AI 求助框）

                    let tipCount = 0;

                    groups.lab.forEach(lab => {

                        const labName = (lab.querySelector('.lab-head') || lab.querySelector('.concept-title') || { textContent: '实验' }).textContent.trim();

                        lab.querySelectorAll('.ai-tip-box').forEach(tip => {

                            if (tipCount === 0) {

                                const idx = document.createElement('div');

                                idx.className = 'ai-index';

                                idx.innerHTML = '<div class="ai-index-title">🤖 本任务 AI 求助点速查</div>' +

                                    '<div class="ai-index-note">点击任意条目，自动切换到"实验"分类并定位到对应的 AI 求助框。</div>';

                                groupEls.ai.appendChild(idx);

                            }

                            tipCount++;

                            const tipName = (tip.querySelector('.ai-tip-title') || { textContent: 'AI 求助' }).textContent.trim();

                            const btn = document.createElement('button');

                            btn.type = 'button';

                            btn.className = 'ai-index-item';

                            btn.innerHTML = '<span class="ai-index-lab">' + labName.replace(/^[🧪📄]+\s*/, '') + '</span> · ' + tipName;

                            btn.addEventListener('click', function() {

                                activate('lab');

                                setTimeout(function() {

                                    // 目标所在的实验块若处于收起状态，先展开，避免滚到一个空块

                                    if (typeof window.__labExpandFor === 'function') window.__labExpandFor(tip);

                                    if (typeof window.__aiTipExpandFor === 'function') window.__aiTipExpandFor(tip);

                                    tip.scrollIntoView({ behavior: 'smooth', block: 'center' });

                                    tip.classList.remove('flash');

                                    void tip.offsetWidth;

                                    tip.classList.add('flash');

                                }, 80);

                            });

                            groupEls.ai.appendChild(btn);

                        });

                    });



                    container.insertBefore(tabs, container.firstChild);

                    CAT_DEFS.forEach(def => container.appendChild(groupEls[def.key]));

                    activate('knowledge');

                }



                document.querySelectorAll('.task-stage').forEach(stageEl => {

                    if (stageEl.id === 'homepage-stage') return;

                    const substages = Array.from(stageEl.children).filter(el => el.classList.contains('substage'));

                    if (substages.length) {

                        // 含子任务的页面：散落在任务层的内容块归入它前面的子任务

                        let last = null;

                        Array.from(stageEl.children).forEach(el => {

                            if (el.classList.contains('substage')) { last = el; return; }

                            if (el.querySelector && el.querySelector('.substage-btn')) return; // 子任务切换按钮

                            if (last) last.appendChild(el);

                        });

                        substages.forEach(s => buildTabsFor(s));

                    } else {

                        buildTabsFor(stageEl);

                    }

                });

            })();



            // ===== 实验模块折叠面板 =====

            // 内容特别长的任务（如任务 4.1 的实验页共 5 大块、多处长表格）改成"点标题展开 / 收起"，

            // 默认只展开第一块，避免学生一进页面就要下滑很久。

            // 需要给其他任务也加上时，把子任务编号加进 ENABLE 数组即可（如 '4.5'）。

            (function setupLabAccordion() {

                var ENABLE = ['4.1', '4.2', '4.3', '4.4', '4.5', '5', '6', '7.1', '7.2', '7.3', '7.4'];

                var SUBSTAGE_PREFIX = 'substage';



                function isOpen(box) { return !box.classList.contains('is-collapsed'); }



                // 取直接子元素中带指定 class 的第一个（不走 :scope，兼容旧浏览器内核）

                function firstDirect(parent, cls) {

                    for (var i = 0; i < parent.children.length; i++) {

                        if (parent.children[i].classList.contains(cls)) return parent.children[i];

                    }

                    return null;

                }



                window.__labExpandFor = function (el) {

                    if (!el || !el.closest) return;

                    var box = el.closest('.lab-box.is-collapsed');

                    if (!box) return;

                    var head = firstDirect(box, 'lab-acc-head');

                    if (head && head.__labSetOpen) head.__labSetOpen(true, true);

                };



                // 容器：白名单内的子任务（.substage）；没有子任务的整任务页（如任务5 的 #stage5）用 task-stage 作容器

                var ACC_CONTAINERS = [];

                document.querySelectorAll('.substage').forEach(function (sub) {

                    var tid = sub.id.indexOf(SUBSTAGE_PREFIX) === 0 ? sub.id.slice(SUBSTAGE_PREFIX.length) : sub.id;

                    if (ENABLE.indexOf(tid) >= 0) ACC_CONTAINERS.push(sub);

                });

                document.querySelectorAll('.task-stage').forEach(function (st) {

                    var tid = st.id.indexOf('stage') === 0 ? st.id.slice('stage'.length) : st.id;

                    if (ENABLE.indexOf(tid) < 0) return;

                    if (st.querySelector('.substage')) return;   // 该任务已按子任务拆分，走上面的分支

                    ACC_CONTAINERS.push(st);

                });

                ACC_CONTAINERS.forEach(function (sub) {

                    var taskId = sub.id.indexOf(SUBSTAGE_PREFIX) === 0 ? sub.id.slice(SUBSTAGE_PREFIX.length) : sub.id.replace(/^stage/, '');



                    var grp = null;

                    for (var gi = 0; gi < sub.children.length; gi++) {

                        var cg = sub.children[gi];

                        if (cg.classList.contains('cat-group') && cg.getAttribute('data-cat') === 'lab') { grp = cg; break; }

                    }

                    if (!grp) return;



                    var boxes = Array.prototype.filter.call(grp.children, function (c) {

                        return c.classList.contains('lab-box') && firstDirect(c, 'lab-head');

                    });

                    if (boxes.length < 2) return;



                    var bar = document.createElement('div');

                    bar.className = 'lab-acc-bar';

                    bar.innerHTML =

                        '<span class="lab-acc-tip">💡 点击任意一块的蓝色标题即可展开 / 收起，默认展开第一块</span>' +

                        '<span class="lab-acc-cnt"></span>' +

                        '<button type="button" class="lab-acc-btn" data-act="toggle">📤 全部展开</button>';



                    function syncBar() {

                        var open = boxes.filter(isOpen).length;

                        bar.querySelector('.lab-acc-cnt').textContent = '已展开 ' + open + ' / ' + boxes.length;

                        bar.querySelector('[data-act="toggle"]').textContent = (open === boxes.length) ? '📥 全部收起' : '📤 全部展开';

                    }



                    boxes.forEach(function (box, i) {

                        var head = firstDirect(box, 'lab-head');

                        box.classList.add('lab-acc');

                        head.classList.add('lab-acc-head');

                        head.setAttribute('role', 'button');

                        head.setAttribute('tabindex', '0');

                        head.title = '点击展开 / 收起本块内容';



                        function setOpen(open, silent) {

                            box.classList.toggle('is-collapsed', !open);

                            head.setAttribute('aria-expanded', open ? 'true' : 'false');

                            syncBar();

                            if (!silent && typeof trackOperation === 'function') {

                                var name = head.textContent.replace(/^[^一-龥]+/, '').trim().slice(0, 20);

                                trackOperation(open ? '展开实验模块' : '收起实验模块', name);

                            }

                        }

                        head.__labSetOpen = setOpen;

                        setOpen(i === 0, true);   // 默认展开第一块，其余收起



                        head.addEventListener('click', function () { setOpen(!isOpen(box)); });

                        head.addEventListener('keydown', function (e) {

                            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {

                                e.preventDefault();

                                setOpen(!isOpen(box));

                            }

                        });

                    });



                    grp.insertBefore(bar, grp.firstChild);

                    syncBar();



                    bar.querySelector('[data-act="toggle"]').addEventListener('click', function () {

                        var target = boxes.filter(isOpen).length !== boxes.length;

                        boxes.forEach(function (b) {

                            var h = firstDirect(b, 'lab-acc-head');

                            if (h && h.__labSetOpen) h.__labSetOpen(target, true);

                        });

                        if (typeof trackOperation === 'function') {

                            trackOperation(target ? '展开全部实验模块' : '收起全部实验模块', taskId);

                        }

                    });

                });

            })();



            // ===== 素养培养案例（场景分析 + AI 点评） =====

            // 每个任务按其知识点涉及的素养数量配备对应数量的场景案例；

            // 学生阅读场景 → 写下分析 → "AI 点评"基于素养观察点做覆盖式即时点评，

            // 也可"深度点评"组装提示词交给等保小助教（腾讯元器）逐句分析。

var SUYANG_CASES = {

                '1.1': {

                    title: '任务1.1 等保2.0标准体系框架学习',

                    cases: [

                        {

                            id: 's11a', comp: '家国情怀 · 国家安全意识',

                            title: '「等保就是走形式？」——一次宿舍卧谈引发的争论',

                            scene: '宿舍夜谈时，学计算机的室友说："等级保护就是有关部门搞形式主义，企业花钱买个「牌照」而已，真出了事也没什么用。"另一位同学附和：新闻里的数据泄露事件没有一件是靠等保挡住的。你知道下周就要学习《网络安全法》和等保 2.0 标准体系，此刻你打算怎么回应？',

                            question: '请结合国家网络安全形势与等级保护制度的设计初衷，说说你会如何回应室友？回应要既有事实依据，又能体现你对这项制度的理解与认同。',

                            points: [

                                { label: '国家安全视角', method: '等保保的不是一家企业，关键信息基础设施（CII）一旦失守，影响的是能源、政务、民生、国计民生，是国家安全层面的事。', kws: ['国家安全', '关键信息基础设施', '网络强国', '总体国家安全', '国家战略', '数据泄露', '攻击', '威胁', '国计民生'] },

                                { label: '制度价值理解', method: '等保是"以测促防"——用一套统一标准倒逼运营者补齐防护能力，不是花钱买牌，而是把系统的安全水平真正拉上来。', kws: ['以测促防', '防线', '防护能力', '安全水平', '合规', '制度', '要求', '体系', '保障', '提升'] },

                                { label: '事实与理性表达', method: '用具体案例和数字说话（如 WannaCry、某地政务数据泄露事件），不要情绪化反驳，事实比嗓门更管用。', kws: ['案例', '数据', '新闻', '事实', '例如', '比如', '举例', '统计', '报告', '勒索'] },

                                { label: '职业认同与担当', method: '你将来就是干这行的——守护网络安全就是你的职业使命；制度建设越完善，从业者的价值越大。', kws: ['使命', '责任', '职业', '安全行业', '从业人员', '守护', '保障', '价值', '我们'] }

                            ]

                        },

                        {

                            id: 's11b', comp: '法律意识',

                            title: '「小公司内网系统不用备案？」——老板的法律盲区',

                            scene: '你在某测评机构实习，跟随师傅拜访一家做社区团购的小公司。老板听说要做等级保护，摆摆手："我们就十几个人用的内网订货系统，又不对公众开放，定什么级、备什么案？从来没部门来查过。"师傅让你先分析一下老板的说法错在哪里。',

                            question: '请依据《网络安全法》关于等级保护制度的条款精神，分析老板说法中的法律认识误区，并说明该公司若拒不履行定级备案义务可能面临什么后果。',

                            points: [

                                { label: '法律义务的普适性', method: '《网络安全法》第二十一条对所有网络运营者一视同仁——规模小不是免罪符，企业内网只要处理业务数据就要承担保护义务。', kws: ['网络安全法', '第二十一条', '法定义务', '义务', '网络运营者', '所有', '必须', '应当', '履行'] },

                                { label: '定级备案要求', method: '内网系统虽然不对公众开放，但只要处理业务数据就要定级备案（多数起步二级），向公安机关受理备案。', kws: ['定级', '备案', '公安机关', '二级', '等级', '分级', '保护', '内网'] },

                                { label: '违法后果', method: '不履行义务可被责令改正、警告、罚款；造成严重后果的，相关责任人还要承担更重的法律责任。', kws: ['处罚', '罚款', '责令改正', '警告', '法律责任', '违法', '监管', '处罚措施'] },

                                { label: '合规建议与沟通', method: '客户不懂法不奇怪——先帮他算清合规账和处罚账，比指责更有效。', kws: ['建议', '合规', '风险', '说明', '解释', '沟通', '帮助', '提醒'] }

                            ]

                        },

                        {

                            id: 's11c', comp: '标准规范意识',

                            title: '「凭经验就够了」——学长的一句"过来人"忠告',

                            scene: '实习时带你的学长说："标准条文又厚又绕，实际做项目没人真去翻 GB/T 28448，凭经验判断就行，客户也不懂。"你想了想课上学的"1+N"标准体系，对这句话产生了疑问。',

                            question: '请分析"凭经验、不依据标准"的测评做法可能带来哪些问题？并说明标准体系对测评工作的实际意义。',

                            points: [

                                { label: '判定依据意识', method: '测评报告里的"符合/不符合"必须对应到 GB/T 22239/28448 的具体条款，经验不是判定依据。', kws: ['依据', '标准', '条文', 'GB/T', '28448', '22239', '测评指标', '对照', '逐条'] },

                                { label: '质量与风险后果', method: '脱离标准的判定一旦漏测误判，机构要承担报告失实责任；严重的会被客户投诉、行业曝光。', kws: ['争议', '投诉', '责任', '漏测', '误判', '风险', '质量', '纠纷', '报告'] },

                                { label: '标准体系的价值', method: '"1+N"标准体系让全国测评机构在同一尺度上出具结论——结果可比、可信、有公信力。', kws: ['统一', '尺度', '可比', '规范', '一致', '权威', '1+N', '体系', '公信力'] }

                            ]

                        }

                    ]

                },

                '1.2': {

                    title: '任务1.2 安全等级识别与实验操作',

                    cases: [

                        {

                            id: 's12a', comp: '责任意识',

                            title: '「就定二级吧」——客户的一个"小要求"',

                            scene: '小组为"政务服务中心综合管理平台"做定级练习时，有同学提出："这个系统就定二级吧，三级测评项目多、费用高，案例里也没写清楚服务人群规模。"你注意到材料里提到该系统面向全区群众办理各类政务服务。',

                            question: '请分析"图省事定低级"的做法有什么危害？作为参与定级的人员，你认为正确的做法是什么？',

                            points: [

                                { label: '定级要素运用', method: '定级看的是"受侵害客体 + 危害程度"两要素，不是项目费用。面向全区群众的政务系统一般不低于三级。', kws: ['受侵害客体', '公民', '法人', '公共利益', '社会秩序', '国家安全', '危害程度', '严重损害', '业务信息', '系统服务'] },

                                { label: '责任与后果意识', method: '防护等级定低了，真出了安全事件，定级人也要承担失职责任——不能为了省事糊弄。', kws: ['责任', '保护不足', '防护', '风险', '危害', '后果', '安全事件', '失职'] },

                                { label: '实事求是处理', method: '材料信息不全时，回去找受测方核实、补充证据，再做定级——而不是拍脑袋定级。', kws: ['核实', '调查', '证据', '材料', '依据', '如实', '客观', '重新', '梳理'] }

                            ]

                        },

                        {

                            id: 's12b', comp: '严谨求实',

                            title: '「差不多先定上」——定级材料缺项时的选择',

                            scene: '定级作业提交前 20 分钟，你们组发现"业务信息安全保护等级"和"系统服务安全保护等级"两栏还空着——大家对业务信息丢失后"侵害客体是谁"争执不下。组长说："差不多得了，都填二级，先交作业再说。"',

                            question: '请分析"差不多"心态在定级工作中的隐患，并给出你们组此时更严谨的处理办法。',

                            points: [

                                { label: '定级严谨性', method: '定级结论直接决定后续测评深度和整改范围——"差不多"会让整套方案失真。', kws: ['逐项', '分析', '依据', '定级要素', '流程', '核对', '准确', '审查', '影响'] },

                                { label: '分歧的正确处理', method: '争执不下时回到 GB/T 22240 原文查依据，必要时请教老师或行业前辈，不要靠"投票"定级。', kws: ['讨论', '查标准', '咨询', '求证', '材料', '重新梳理', '证据', '请教', '原文'] },

                                { label: '职业习惯养成', method: '测评行业里"差不多"是大忌——每一步留痕、每一项核实，从作业开始就要养成习惯。', kws: ['习惯', '养成', '记录', '留痕', '复核', '流程', '规范', '大忌'] }

                            ]

                        }

                    ]

                },

                '2.1': {

                    title: '任务2.1 测评方案结构学习',

                    cases: [

                        {

                            id: 's21a', comp: '保密意识',

                            title: '一份方案引发的"泄密风波"',

                            scene: '为了方便小组周末讨论，你把某单位测评方案的电子版（含网络拓扑图、IP 地址、安全设备部署位置、联系人手机号）发进了 30 人的班级 QQ 群，还上传到了一个公开的网盘分享链接。',

                            question: '请分析这一行为可能造成哪些危害？作为测评项目组成员，正确的做法应当是什么？',

                            points: [

                                { label: '敏感信息识别', method: '拓扑、IP、安全设备位置、联系人手机号是高敏感资产——对攻击者就是一份"踩点清单"。', kws: ['拓扑', 'IP', '敏感', '涉密', '个人信息', '泄露', '资产', '部署', '联系人'] },

                                { label: '泄露后果评估', method: '公开群和网盘一旦发出就收不回来——可能被爬取、被用来发起针对性攻击。', kws: ['攻击', '利用', '爬取', '风险', '危害', '扩散', '不可控', '安全事件', '收回'] },

                                { label: '正确保密做法', method: '小组讨论只用脱敏后的方案；知悉范围限定在项目组内，必要时签保密协议。', kws: ['脱敏', '授权', '最小', '范围', '权限', '删除', '撤回', '加密', '内部', '合规'] }

                            ]

                        },

                        {

                            id: 's21b', comp: '规范意识',

                            title: '「套模板五分钟搞定」——方案的"复制粘贴病"',

                            scene: '编制测评方案练习时，你发现上一届学长做的医院项目方案结构几乎一样。同组同学提议："直接套模板，把单位名一改、日期一改就交，五分钟搞定。"你翻到方案的"测评对象"章节，发现里面写的是病房呼叫系统和 PACS 影像系统。',

                            question: '请分析"只改名不改编"的套模板做法错在哪里，并说明测评方案中哪些内容必须结合本项目实际情况重新确定。',

                            points: [

                                { label: '模板复用的边界', method: '模板能借的是"结构/章节框架"，内容必须根据项目实际重新编写。', kws: ['结构', '框架', '复用', '内容', '实际情况', '逐项', '核对', '修改', '删减', '适配'] },

                                { label: '方案关键要素', method: '测评对象、范围、指标裁剪、测评方法、人员分工等都必须按本项目实际重新确定——这些不能照抄。', kws: ['测评对象', '范围', '指标', '裁剪', '方法', '人员', '工具', '系统构成', '资产'] },

                                { label: '后果意识', method: '留下"病房呼叫系统"这种张冠李戴的痕迹，评审一眼看穿，整份方案公信力归零。', kws: ['错误', '张冠李戴', '返工', '无效', '质量', '失实', '误导', '评审'] }

                            ]

                        }

                    ]

                },

                '2.2': {

                    title: '任务2.2 编制完整测评方案',

                    cases: [

                        {

                            id: 's22a', comp: '诚信意识',

                            title: '「买一份方案交差」——期末周的诱惑',

                            scene: '期末周，你们组要提交完整测评方案。有同学在群里发了个链接："网上有现成的等保测评方案，30 块一份，改改名字就能交，老师一个班几十份根本看不过来。"',

                            question: '请从课程考核诚信与职业风险两个层面，分析购买方案代交的行为，并说明如果确实时间紧张，哪些做法才是可接受的。',

                            points: [

                                { label: '诚信意识', method: '课程作业属于独立完成的考核内容——购买代交就是作弊，会按违纪处理。', kws: ['抄袭', '作弊', '诚信', '代写', '独立', '原创', '考核', '违纪', '处分'] },

                                { label: '职业风险推演', method: '这门课混过去不等于工作能混过去——真到岗位上，独立编方案、独立判定结论的能力是底子。', kws: ['能力', '胜任', '实际工作', '法律', '责任', '后果', '执业', '信任', '岗位'] },

                                { label: '合理求助的边界', method: '同学讨论、参考公开资料、用 AI 解释思路都可以接受——但 AI 不能替你判断、不能替你写结论。', kws: ['请教', '讨论', '参考', '公开资料', '模板', '标注', '引用', '求助', 'AI 辅助', '学习'] }

                            ]

                        },

                        {

                            id: 's22b', comp: '团队协作',

                            title: '「划水」的组员与全包的你',

                            scene: '小组编制测评方案分工后，负责"测评方法与工具"章节的同学一直说"在写了在写了"，直到截止前两天才承认基本没动。你能力强，自己重写这一章只要一个晚上。组长问你怎么办。',

                            question: '请分析"你全包"和"让他挂科"之外更好的处理方式，并说明团队协作中如何避免这种情况再次发生。',

                            points: [

                                { label: '沟通与责任界定', method: '先找对方了解原因、明确分工节点——不要直接"全包"养懒汉，也不要直接甩锅。', kws: ['沟通', '了解原因', '提醒', '责任', '明确', '分工', '督促', '反馈'] },

                                { label: '协作机制建设', method: '项目要设中间节点（里程碑）互相确认进度；任务分块后留"备份同学"，避免最后才发现没做。', kws: ['节点', '检查', '里程碑', '进度', '透明', '互相', '备份', '确认', '排期'] },

                                { label: '共同成长导向', method: '团队目标是"每个人都学会"——抽时间给对方讲一遍章节要点，作业帮他补上但能力要跟上。', kws: ['帮助', '辅导', '讲解', '一起', '成长', '团队', '目标', '补上'] }

                            ]

                        }

                    ]

                },

                '3.1': {

                    title: '任务3.1 物理安全核查',

                    cases: [

                        {

                            id: 's31a', comp: '严谨求实 · 证据意识',

                            title: '「记录坏了，你先写符合」——现场核查的第一道考验',

                            scene: '机房核查时你要查看机房出入登记记录，陪同的运维人员说："登记本是纸质的经常丢，门禁系统记录也导不出来，你就先写「符合」吧，我们回头补一份给你。"',

                            question: '请分析为什么不能按他说的"先写符合"？你应当如何处理才能既坚持原则又不失分寸？',

                            points: [

                                { label: '证据链原则', method: '"符合"必须有原始证据支撑（登记本扫描件、门禁日志导出），口头承诺不能作为判定依据。', kws: ['证据', '依据', '客观', '事实', '判定', '采信', '存疑', '不能', '没有'] },

                                { label: '规范处理方式', method: '取不到证据时应记录"部分符合"或"不适用"，注明原因，必要时改期补充核查。', kws: ['记录', '说明', '不符合', '部分符合', '备注', '标注', '复核', '改期', '情况说明'] },

                                { label: '原则与分寸并存', method: '礼貌说明测评取证规则，请对方协调提供——现场不要硬顶，但结论不能含糊。', kws: ['礼貌', '解释', '标准', '坚持', '立场', '专业', '说明理由', '规则'] }

                            ]

                        }

                    ]

                },

                '3.2': {

                    title: '任务3.2 网络架构合规性检查',

                    cases: [

                        {

                            id: 's32a', comp: '职业操守',

                            title: '「都是熟人，高抬贵手」——老关系户的暗示',

                            scene: '核查安全管理制度时，被测评单位的信息中心主任半开玩笑地说："咱们合作这么多年了，那几条不合规的你少记两条，年底续约我都跟你们老板打好招呼了。"',

                            question: '请分析如果你照做了，对客户、测评机构和你个人分别意味着什么？你的正确做法是什么？',

                            points: [

                                { label: '客观公正意识', method: '测评结论的依据是标准条款和客观证据——不能被人情、利益、改约承诺左右。', kws: ['拒绝', '底线', '如实', '真实', '违规', '失实', '原则', '独立', '客观'] },

                                { label: '连锁危害推演', method: '隐瞒的不符合项会让客户整改缺位，留下真实风险；事件爆发后机构要承担报告失实责任，严重的吊销资质。', kws: ['风险', '隐患', '整改', '事故', '责任', '机构', '资质', '信誉', '法律'] },

                                { label: '得体的应对路径', method: '私下不妥协——按机构流程上报组长/项目经理，由机构层与客户沟通，全程留痕。', kws: ['说明', '标准', '流程', '回避', '上报', '记录', '报告', '机构', '制度'] }

                            ]

                        }

                    ]

                },

                '4.1': {

                    title: '任务4.1 主机安全基线核查',

                    cases: [

                        {

                            id: 's41a', comp: '严谨求实 · 敬畏生命的社会责任感',

                            title: '「补丁两个字，等了 59 天」——WannaCry 与被取消的一万九千次门诊',

                            scene: '2017 年 5 月 12 日，WannaCry 勒索病毒一天内席卷全球上百个国家。它并没有用什么神秘的新漏洞：微软早在 3 月 14 日就发布了 MS17-010 安全公告并提供了补丁，距离病毒爆发相隔 59 天。受冲击最重的英国 NHS（国民保健署）事后由英国审计署（NAO）复盘：英格兰 236 家医院信托中至少 80 家受影响；NHS England 确认已取消的门诊与手术超过 6900 例，实际估计接近 2 万例；5 个地区的急诊不得不把病人转往别处。复盘结论很直白——所有受影响的机构都在使用已经过期或没有打补丁的操作系统，而这些本可以通过更好的补丁管理拦住。\n回到你的场景：某单位主机安全基线核查中，你发现 3 台服务器的关键补丁长期未安装。对方运维说：「这么多年都没出事，这条就写成建议吧，别写不符合了。」',

                            question: '请结合 WannaCry 事件回答两点：①「补丁管理」这条最不起眼的基线项，为什么偏偏关系着整个业务的生死？②如果你是主测人员，怎样把这条「不符合」写成客户愿意连夜整改的话，而不是一张随手丢在桌上的清单？',

                            points: [

                                { label: '技术归因：杀手不是未知漏洞，是拖延', method: 'WannaCry 不是被未知漏洞打穿的，而是被已知的、且补丁早就提供的漏洞打穿的——真正致命的是「补丁给了，但 59 天没人装」。核查时要盯的是补丁安装的时效与台账，不是有没有装这几个字。', kws: ['补丁', '59天', 'MS17-010', '已知漏洞', '未安装', '过期系统', '停止支持', '拖延', '时效', '台账', 'Windows XP', '滞后'] },

                                { label: '把技术项翻译成人的代价', method: '写「存在被勒索攻击风险」，没人会动；写成「同等条件下，英国 NHS 曾有近两万次门诊被取消」，负责人才会跳起来——测评不是抄条款，是让人听得懂自己处在什么处境里。', kws: ['门诊', '手术', '取消', '看病', '患者', '病床', '停诊', '业务中断', '代价', '听得懂', '影响', '损失', '转院', '感受'] },

                                { label: '由一台看到一整套', method: '从「这一台没打补丁」看到「整个单位缺少补丁管理机制」：隔离受影响端口做临时止血 → 排补丁上线窗口 → 建立长期补丁台账与周期复核，这才是测评该促成的闭环。', kws: ['闭环', '临时', '端口', '隔离', '止血', '排期', '窗口', '台账', '机制', '周期', '复核', '流程', '长期'] },

                                { label: '立场：不为敌，但也不替人抹平', method: '写「不符合」不是跟客户过不去，是替可能被波及的用户踩刹车。话说得可以得体、方法中肯给足，但结论本身不能因为人情被抹掉——这是职业分工给的底气。', kws: ['不符合', '部分符合', '如实', '证据', '坚持', '分寸', '沟通', '底线', '不能改', '抹掉', '抹平'] }

                            ],

                            ref: 'WannaCry 勒索病毒 / MS17-010 永恒之蓝 / NAO（英国审计署）NHS 网络攻击调查报告 / kill switch（终止开关）'

                        },

                        {

                            id: 's41b', comp: '科学精神 · 求真求证与终身学习',

                            title: '「她手写了 400 多页推导」——一位女院士与 MD5 的退场',

                            scene: '哈希算法你可能每天都在用：网站上你的口令被变成一串摘要存起来、下载的文件用校验值比对有没有被改过、证书签名……上世纪 90 年代，MD5 和 SHA-1 几乎是全球所有系统的标配。中国科学院院士、清华大学教授王小云带领团队花了整整十年攻克它们——据公开报道，破解 MD5 时她是手写推导，写了 400 多页纸、几百个方程，推导了两三个月才得到结果。2004 年她在国际密码大会上公布了对 MD5 等算法的攻击路径与完整验证，第二年又同团队攻破了被称为「白宫密码」的 SHA-1。这一成果直接推动了全球新一代哈希函数标准的制定进程；此后她没有去参与新国际标准的设计，而是转而主持设计我国自己的哈希算法标准 SM3。她说：「密码为国家服务，国家利益是放在第一位的。」\n回到你的场景：核查某业务系统时，你发现它仍在用 MD5 存储用户口令摘要、仍在签发 SHA-1 签名的证书。开发人员说：「 MD5 虽然上了年纪，但只是理论上不安全，我们这边从来没出过事。」',

                            question: '请回答两点：①「理论上被攻破」到「实际上必须换」之间到底隔着多远？②今天写在标准里的算法，明天可能作废——作为测评人员，你打算怎样跟踪标准与算法的迭代，以免拿着一把旧尺子去量新房子？',

                            points: [

                                { label: '求真本身就是目的', method: '科学家的价值不是让谁难堪，而是把「大家都以为很安全」的东西论证清楚：她说出来，产业界才会去换；没人去做这种坐冷板凳的事，所有人会一直睡在幻觉里。', kws: ['求真', '证明', '验证', '公开', '揭示', '十年', '四百多页', '冷板凳', '坚持', '严谨', '推理'] },

                                { label: '从实验室到标准的传导链', method: '理论突破 → 算法退役 → 标准修订 → 测评依据更新：你今天背的标准条文里，其实藏着某位研究者十年前的推导结果。理解这条链，才能理解标准为什么会改。', kws: ['标准', '修订', '退役', '更新', 'GB/T', '依据', '迭代', '替代', 'MD5', 'SHA-1', 'SM3', '演进'] },

                                { label: '把「理论上」当作业前台', method: '理论上被攻破，往往就是实际被大规模利用的前奏：攻击者永远比补丁勤快，等真实攻击出现了再改，代价由用户先付。', kws: ['提前', '预防', '滞后', '风险', '迁移', '替换', '升级', '加固', '代价', '窗口', '前奏'] },

                                { label: '跟踪是岗位要求，不是加分项', method: '算法在退役，标准在更新，后量子密码已经在路上——信息安全这行，「终身学习」不是一句漂亮的口号，而是岗位说明书里的硬条款。', kws: ['跟踪', '关注', '学习', '更新', '知识体系', '后量子', '持续', '习惯', '积累', '主动'] }

                            ],

                            ref: '王小云（中国科学院院士）/ MD5 碰撞 / SHA-1 / SM3 杂凑算法 / GB/T 22239-2019 身份鉴别与口令存储要求'

                        }

                    ]

                },

                '4.2': {

                    title: '任务4.2 网络设备配置核查',

                    cases: [

                        {

                            id: 's42a', comp: '工匠精神 · 敬畏每一条配置',

                            title: '「临时开一下」——躺了两年的那条放行规则',

                            scene: '2019 年，美国第一资本银行（Capital One）披露重大数据泄露：约 1 亿美国公民、600 万加拿大公民的信用卡申请数据被窃取。据事后披露，起点不是什么未知漏洞，而是运行在云上的一个 Web 应用防火墙配置不当（普遍认为攻击者借此发起了对云平台元数据服务的请求，拿到了云的临时凭据），而这套凭据背后的角色又权限过大，能大量列出并读取存储的数据。事件还有另一个细节：真正发现这件事的是一名外部安全研究人员，通过企业的漏洞报告渠道上报后才被确认。\n回到你的场景：核查某单位边界访问控制策略时，你发现第 3 条写着 permit ip any any，运维解释：「这是当年调试时开的，回头就删。」你翻了变更记录——这条规则已经躺了两年。',

                            question: '请结合上述事件回答两点：①为什么说「配置核查」与「漏洞扫描」同等重要？②如果你是主测人员，怎样写这条「临时规则」，才能让客户真正把隐患消掉（提示：给管理层听得懂的账，给运维能直接照着做的动作）。',

                            points: [

                                { label: '配置就是防线本身', method: '攻击者不一定需要 0day：一条 any any 的放行规则，等于把你所有边界防护的努力一笔勾销。设备买得再贵，策略写歪了也是白买。', kws: ['any', '放行', '策略', '规则', '边界', '最小', '默认拒绝', '收敛', '配置', '访问控制'] },

                                { label: '规则要有生命周期', method: '临时规则必须带审批、带有效期、带到期回收机制：没有生命周期管理的「临时」，最后都会变成永久漏洞。', kws: ['临时', '审批', '有效期', '回收', '变更', '台账', '定期', '清理', '复核', '过期', '流程'] },

                                { label: '权限过大才是放大器', method: '防火墙/代理这类组件本身的权限该只够干它的活——权限给多了，一次小小的配置错误就放大成全量数据暴露（最小权限原则）。', kws: ['权限', '最小', '角色', '凭据', '过度', '多余', '限制', '隔离', '分段', '收紧'] },

                                { label: '整改要写成两种语言', method: '一份报告两套说法：给管理层写「影响范围、罚款与声誉损失」，给运维写「删哪条、改成什么、怎么写回退」。只写策略配置不合理，第二周还是这样。', kws: ['整改', '具体', '命令', '步骤', '验证', '清单', '风险', '量化', '沟通', '成本', '管理层', '回退'] }

                            ],

                            ref: 'Capital One 数据泄露事件 / SSRF（服务端请求伪造）/ 云平台实例元数据服务 / 最小权限原则'

                        },

                        {

                            id: 's42b', comp: '德才兼备 · 技术向善',

                            title: '「几十万台摄像头把半个互联网打趴下」——Mirai 与一门落到歪处的才华',

                            scene: '2016 年 10 月 21 日，美国 DNS 服务商 Dyn 遭大规模 DDoS 攻击，Twitter、Reddit、Netflix、GitHub、PayPal 等一众知名服务在美国和欧洲多地长时间打不开。流量来自 Mirai 僵尸网络——它的手法说穿了并不高明：扫描互联网上还在用出厂默认用户名口令的摄像头、路由器、录像机，把它们一个个拉进自己的队伍（据安全厂商测量，规模达数十万台）。值得一提的是，据公开报道，Mirai 的作者是几位年轻人，最初写出来只为打击游戏服务器的竞争对手；后来随着源代码被公开，数以千计的衍生版本至今仍在活动。2017 年，相关被告认罪。\n回到你的场景：核查一台楼栋交换机时，你发现它还在用出厂用户名和 SNMP 默认团体名。厂商实施人员说：「这十几年不都这么装的吗？」',

                            question: '请从「技术能力」与「价值选择」两条线谈这个事件：①为什么「技术很强」从来不等于「可以放心」？②作为未来的测评人员，你打算靠什么让自己手里的技术始终落在正当的一侧（请给出具体的边界与程序，不要只喊口号）。',

                            points: [

                                { label: '能力与价值观不能缺一边', method: '同样的技术，转身就能用来害人——能力决定你能做什么，价值观决定你做什么。这行从不缺聪明人，缺的是用得其所的聪明人。', kws: ['价值观', '底线', '能力', '技术', '向善', '选择', '边界', '目的', '正当', '良知'] },

                                { label: '默认凭据是头号家常菜', method: '出厂账号、初始密码、SNMP 默认团体名（public/private）是最容易被搬走的钥匙：清点 → 改名 → 强制改成强口令 → 定期复核，是可以立刻做的事。', kws: ['默认口令', '出厂', '初始凭据', '弱口令', 'SNMP', '团体名', '改名', '禁用', '强制', '清点'] },

                                { label: '你的设备也是别人的台阶', method: '今天的受害者可能就是明天的加害者：把自己管着的设备管好（固件升级、关闭无用服务），也是在替别人挡刀——网络安全是连带责任。', kws: ['连累', '他人', '责任', '共同', '连带', '固件', '升级', '关闭', '服务', '减少', '公共'] },

                                { label: '边界写在手上，不是嘴上', method: '任何测试动作都要有明确书面授权与范围；遇到超出授权的事当场停下、询问、上报，绝不擅自扩大——「我是为了安全」不是越界的理由。', kws: ['授权', '范围', '书面', '审批', '上报', '留痕', '擅自', '边界', '停下', '同意'] }

                            ],

                            ref: 'Mirai 僵尸网络 / 2016 Dyn DNS 攻击 / IoT 设备默认凭据 / DDoS 攻击'

                        }

                    ]

                },

                '4.3': {

                    title: '任务4.3 数据库安全配置核查',

                    cases: [

                        {

                            id: 's43a', comp: '合规自觉 · 以身作则的数据敬畏',

                            title: '「为了核查方便，导点数据回去慢慢看」——你自己也是个人信息处理者',

                            scene: '明天你要进机房核查一台 MySQL 数据库：需要验证账号策略、口令复杂度、权限分配、审计日志是否开启。这个库里有几百万条真实用户记录（姓名、手机号、身份证号、住址），客户只给了一小时窗口，陪同人员说：「你们自己导吧，需要什么都行。」同行的同学觉得：「反正我们自己看看又不外传，导回去对着账号慢慢查更方便。」',

                            question: '请为这次核查设计一套数据处理方案（不要空谈原则，要具体到动作）：核查至少需要索取哪些数据、在客户现场如何操作、核查结束后样本如何处置、以及这一整套过程如何在报告中留痕说明。特别要注意一点：测评人员同样受法律约束，你不是豁免者。',

                            points: [

                                { label: '最小必要：只要配置状态', method: '核查要的是账号策略、权限、审计开关这些「配置状态」，不是数据本身——能只查账号表/权限表就别碰业务明细表，能用元数据和配置文件核对就别碰用户数据。', kws: ['最小', '必要', '脱敏', '抽样', '元数据', '账号表', '权限', '不需要', '导出', '只查'] },

                                { label: '现场操作与销毁证据', method: '在客户监督 + 双人见证下操作，执行的命令/SQL 留痕；核查完毕立即删除或当面移交，最好有一份「已清理」的书面确认。', kws: ['监督', '见证', '签字', '留痕', '记录', '删除', '销毁', '移交', '清理', '确认', '当场'] },

                                { label: '法律主体意识', method: '《个人信息保护法》对处理行为有明确目的、最小范围、安全保障等要求；测评人员也是个人信息处理者，同样需要客户内部的授权/审批，不是执法人员、没有豁免权。', kws: ['个保法', '个人信息保护法', '处理者', '目的', '范围', '安全义务', '审批', '授权', '合规', '法律'] },

                                { label: '替代方案往往不止一个', method: '优先选项应该是：在测试环境复现配置、用构造的样例数据验证、让客户截图或提供配置输出——「导出真实数据」很少是唯一解。', kws: ['测试环境', '构造数据', '样例', '截图', '配置输出', '替代', '复现', '优先', '方案', '选择'] }

                            ],

                            ref: '《中华人民共和国个人信息保护法》最小必要原则 / 数据脱敏 / 测评现场数据管理'

                        },

                        {

                            id: 's43b', comp: '长期主义 · 数据守护的耐心与警觉',

                            title: '「潜伏四年才被发现」——喜达屋预订库与 3.39 亿条客人记录',

                            scene: '2018 年，万豪国际集团披露旗下喜达屋（Starwood）的预订数据库遭未授权访问。据英国信息监管机构（ICO）的处罚通报与后来美国联邦贸易委员会的起诉材料：攻击者在 2014 年 7 月就已进入该系统，直到 2018 年 9 月才被发现，潜伏约四年；涉及客人记录约 3.39 亿条，其中包含约 525 万个未加密的护照号码。后续处置方面，ICO 于 2020 年最终处以 1840 万英镑罚款；2024 年万豪又与美国 50 个州及 FTC 达成 5200 万美元的和解。监管机构列出的失效项读起来像一张核查清单：缺乏适当的口令控制、访问控制与网络分段，未及时修补老旧系统，未充分记录与监控网络环境，未部署足够的多因素认证。\n回到你的场景：你在核查某业务数据库时发现 sa 这类超级账号仍在启用且从未改名、数据库审计未开启、备份也未加密。',

                            question: '请回答两点：①数据库层面的「账号权限、审计日志、加密存储、备份管理」，如何决定一次入侵是「当天就被发现」还是「潜伏四年无人知晓」？②如果预算只够先做三件事，你选哪三条，理由是什么？',

                            points: [

                                { label: '先看不看得见，再谈防御', method: '没有日志、没有异常告警，入侵就是静音的：先把「能看见」的能力装上（开启数据库审计、日志外送、异常访问告警），事件的发现时间才能从四年压到四分钟。', kws: ['审计', '日志', '告警', '监控', '静音', '看不见', '留痕', '追溯', '发现', '检测', '外送'] },

                                { label: '账号与权限收敛', method: 'sa、root 这类超级账号必须禁用或改名，按最小必要原则建角色，把管理、审计、业务权限分开，横向移动的空间才会变小。', kws: ['sa', 'root', '超级账号', '禁用', '改名', '分权', '最小', '角色', '回收', '限制', '横向'] },

                                { label: '数据本体与可恢复', method: '敏感字段加密或脱敏存储，备份介质加密并做恢复演练——备份的意义不是「拷了一份」，而是出事时能干净完整地恢复回来。', kws: ['加密', '脱敏', '备份', '介质', '恢复', '演练', '密钥', '字段', '验证', '完整性'] },

                                { label: '整改要排序：先堵口，再装眼', method: '先堵能被直接拿下的口子（超级账号、默认口令、未修补组件），再装看得见的能力（审计与监控），最后做撑得住的措施（加密、备份、多因素）——顺序错了，钱花在大门玻璃上。', kws: ['优先级', '排序', '顺序', '先', '第一步', '立即', '分期', '风险', '整改', '预算'] }

                            ],

                            ref: 'Marriott / Starwood 数据泄露事件 / ICO 处罚决定 / FTC 起诉与和解 / 数据库审计配置'

                        }

                    ]

                },

                '4.4': {

                    title: '任务4.4 应用系统安全功能验证',

                    cases: [

                        {

                            id: 's44a', comp: '系统思维 · 看见功能的两面性',

                            title: '「用来记录日志的东西，成了最大的后门」——Log4Shell 的反转',

                            scene: '2021 年底，一个几乎人人在用、专门用来「记录日志」的 Java 组件 Apache Log4j2 出了大问题（CVE-2021-44228，危害评级满分 10 分）。机理其实不难理解：为了让日志把变量展开得好看一点，组件会把日志里形如 ${jndi:…} 的字符串当作查询去执行——如果这条字符串能来自外部输入（比如用户名、请求头），攻击者就可以让它去访问外部服务器、加载远程代码，从而控制整台服务器。更值得琢磨的两点是：①漏洞在 2021 年 11 月 24 日被私下报告给 Apache，12 月 9 日细节与利用代码公开后，全球出现大范围扫描与利用尝试，而很多单位连夜追问的第一个问题竟然是「我们到底有没有用到它」——它经常嵌套在别人打好的包里，深达三四层；②第一个补丁并不彻底，Apache 随后又相继发布了 2.16.0、2.17.0、2.17.1。',

                            question: '请以「应用系统的日志审计功能」为例分析：①一个本来用于保障安全的「安全功能」，在什么条件下会反过来成为攻击入口？②作为测评人员验证「安全功能是否有效」时，除了确认「功能有没有开启」，还应当验证哪些东西？',

                            points: [

                                { label: '所有处理输入的功能都有反面', method: '日志、导入导出、搜索、在线预览、报错回显——凡是「把外部数据带进内部语境」的地方，都可能被反向利用；信任边界画在哪儿，决定了它是盾还是洞。', kws: ['外部输入', '解析', '展开', '变量', '注入', '拼接', '信任边界', '内部', '外部', '回显', '加载'] },

                                { label: '验证不止「开了没有」', method: '除了功能是否开启，还要验证处理对象的边界（能否传入恶意串）、依赖组件版本、出错时的响应是否泄露信息——「配了」不等于「生效了」。', kws: ['边界', '版本', '组件', '依赖', '嵌套', '测试', '构造', '响应', '配置', '生效', '参数'] },

                                { label: '先回答「我们有没有用到」', method: '一个组件嵌套在框架里、框架嵌套在厂商打好的包里——排查资产与依赖清单（含传递依赖）是整改的第一步，也是最容易糊弄的一步。', kws: ['清单', '资产', '依赖', '嵌套', '厂商', '版本', '摸清', '全景', 'SBOM', '传递依赖'] },

                                { label: '第一个补丁往往不是最后一个', method: '2.15.0 修漏 → 2.16.0 → 2.17.0 → 2.17.1：整改闭环的终点是「升级到能涵盖全部相关 CVE 的版本」，并且要回头再看几次公告。', kws: ['补丁', '首个补丁', '追加', '升级', '二次', '2.17.1', '公告', '复核', '版本', '完整'] }

                            ],

                            ref: 'CVE-2021-44228 / Log4Shell / CNVD-2021-95914 / 传递依赖与 SBOM（软件物料清单）'

                        },

                        {

                            id: 's44b', comp: '求真务实 · AI 素养与主体责任',

                            title: '「AI 说符合，你的截图说不符合」——把 AI 用成放大镜还是挡箭牌',

                            scene: '用 AI 辅助分析核查某应用系统的身份鉴别项时，AI 给出「符合」的建议，但你手工核对的截图显示：root 远程登录未禁用、口令策略也不满足要求。此时面前有两条路：A. 把截图和标准条目一起喂给 AI，让它帮忙逐条对照、列出差异点、生成还需要去现场补取的证据清单；B. 干脆以 AI 的结论为准，把自己这一段删掉——反正 AI 说得头头是道，还挺显得专业。',

                            question: '请回答两点：①这两条路的本质差别在哪里（想想谁在为结论负责）？②设计一套你自己的「人机协作流程」：哪些环节可以交给 AI 提效，哪些环节必须自己完成并签字负责，以及如何验证 AI 给出的每一条断言。',

                            points: [

                                { label: '判定权与签字人必须在你身上', method: 'AI 再强也只是工具：报告要你签字，责任就追到你——结论不能由别人（或别的什么）替你出具，这是职业底线不是习惯偏好。', kws: ['签字', '责任', '判定权', '转移', '不能', '最终', '由人', '负责', '替你', '自己做'] },

                                { label: 'AI 输出必须可验证', method: '模型会一本正经地说错：任何人给出的标准条款号、命令、CVE 编号都要回到标准原文/官方来源核实——查不出来的一句话，就不该出现在报告里。', kws: ['幻觉', '核实', '原文', '官方', '验证', '引用', '条款', '编号', '出处', '查证'] },

                                { label: '高杠杆用法：让 AI 出主意', method: '适合交给它的是：整理对照表、生成补证清单、写核查脚本草稿、把不懂的概念讲一遍；不适合交给它的是：替你下结论、替你判断客户的整改是否到位。', kws: ['清单', '对照', '脚本', '草稿', '解释', '整理', '启发', '辅助', '用它', '建议'] },

                                { label: '先有基本功，再谈提效', method: '先练出「没有 AI 也能做完一整遍」的本事，再让 AI 帮你提速：顺序反了，就会变成离开 AI 就不会干活的空心人。', kws: ['基本功', '手工', '练习', '沉淀', '独立', '能力', '依赖', '替我思考', '顺序', '先'] }

                            ],

                            ref: 'AI 幻觉（Hallucination）/ 大模型辅助判定 / 大模型辅助测评的边界'

                        }

                    ]

                },

                '4.5': {

                    title: '任务4.5 漏洞扫描与结果分析',

                    cases: [

                        {

                            id: 's45a', comp: '专业清醒 · 「准确」重于「多」与「少」',

                            title: '「公开后第二天就被偷了」——心脏滴血与 900 个社保号',

                            scene: '2014 年 4 月，OpenSSL 的「心脏滴血」（Heartbleed，CVE-2014-0160）被公开：一个源于代码实现阶段的缺陷，能让攻击者远程读取服务器内存中的数据片段——私钥、会话凭证、用户信息都可能在其间。真正让人后背发凉的是速度：漏洞公开后，加拿大税务局（CRA）虽随即关闭了对外网站，但据该机构与警方通报，攻击者仍在 4 月 8 日一个约六小时的窗口里拿走了约 900 名纳税人的社会保险号（SIN）；几天后加拿大警方逮捕了一名 19 岁嫌疑人。\n回到你的场景：某系统扫描结果里有 50 多条「高危」。你逐条核下来发现：12 条是补丁版本识别错误（补丁实际已打）、8 条是扫描器版本老旧导致的误判，真正必须连夜处理的只有 6 条。此刻销售希望「多写点，客户才会买单整改」，实施同事希望「少写点，别搞得太难看」。',

                            question: '请结合心脏滴血事件回答：①漏洞报告的价值为什么取决于「准确」而不是「多」或「少」？②如果你是主测人员，怎样组织这份报告的分档与优先级（包括：每条判定要留哪些依据、给管理层的三句话、给运维的执行清单）？',

                            points: [

                                { label: '扫描给的是「疑似」，人要的才是结论', method: '扫描器的输出只算线索：定稿前必须逐条复测核对（补丁号、版本、端口、实际利用条件），误报要剔除并说明剔除依据，不能照抄进报告。', kws: ['误报', '疑似', '复测', '核对', '剔除', '依据', '验证', '人工', '补丁号', '版本'] },

                                { label: '漏洞公开后的窗口就是生命线', method: '报告第一行该写「先做什么」：哪些 IP、哪几条、怎么临时缓解（关端口/下线/防火墙放规则），而不是从第一条编号念到最后一条——时间窗口按小时算。', kws: ['窗口', '应急', '抢时间', '先做什么', '优先', '临时', '隔离', '下线', '缓解', '顺序', '小时'] },

                                { label: '一份报告，两种语言', method: '给管理层三句话：影响多大、波及哪些业务、不整改的后果；给运维一份清单：补丁号、配置修改、验证方法。同一份报告，读者不同写法就要不同。', kws: ['摘要', '管理层', '三句话', '清单', '运维', '补丁号', '命令', '验证', '方法', '分层', '对象'] },

                                { label: '既不夸大，也不淡化', method: '夸大是自损信誉，淡化是替客户埋雷；只有经得起复核、且让人看得出你为什么这么判的结论，才签得下去。', kws: ['客观', '中立', '真实', '信誉', '埋雷', '留痕', '复核', '不夸大', '不缩小', '证据'] }

                            ],

                            ref: 'CVE-2014-0160 Heartbleed / 加拿大税务局（CRA）数据泄露通报 / 漏洞验证与误报识别'

                        },

                        {

                            id: 's45b', comp: '科技伦理 · 公共安全与职业立场',

                            title: '「我发现了一个漏洞，现在怎么办」——漏洞披露的伦理岔路',

                            scene: '你在一个练习用的测试环境里意外发现：某在用系统存在一个严重缺陷，而且利用起来并不困难。你查资料后得知，业界围绕「漏洞该怎么处理」争论多年：有人主张「限时披露」（先私下告知厂商并约定修复期限，到期未修才公开，以此倒逼厂商出补丁）；有人认为「发现即公开」最有利于用户知情；也有人认为漏洞信息本身就是危险品，应当严格管制。在我国，2021 年施行的《网络产品安全漏洞管理规定》已对漏洞的发布、修补、报送等作出了规范。',

                            question: '请分析这起伦理冲突并给出你的行动方案：①从「用户安全 / 厂商利益 / 研究者价值 / 公共秩序」多方角度权衡，有没有两全其美的解法？②列出你作为发现者会采取的行动顺序（向谁报告、证据如何留存、对外如何沟通、哪些事绝对不做）；③说说这与我们做漏洞扫描、整改跟踪之间的职业关联。',

                            points: [

                                { label: '权衡，而不是喊口号', method: '这不是简单的「公开还是保密」：公开早了可能被滥用、晚了可能让防护长期裸奔——成熟的判断是在多个受损方之间找支点，而不是站在道德高地上喊一句「为了用户」。', kws: ['权衡', '多方', '用户', '厂商', '期限', '知情', '缓冲', '过渡', '既', '研究', '取舍'] },

                                { label: '走正规渠道', method: '向厂商 SRC、本单位信息化部门、CNVD/CNCERT 等平台报告，不把可被当作武器的细节扩散出去——渠道本身就是为「两边兼顾」设计的。', kws: ['CNVD', 'CNCERT', 'SRC', '厂商', '渠道', '报告', '上报', '规范', '内部', '平台', '规定'] },

                                { label: '发现不等于拥有', method: '不下载数据、不改数据、不留后门、不在未授权范围内横向试探，只保留足以证明问题存在的证据——「我是为了安全」从来不是越界的理由。', kws: ['授权', '范围', '下载', '后门', '横向', '停下', '保留证据', '必要', '书面', '审批'] },

                                { label: '我们站在防御那一侧', method: '做漏洞扫描的目的是更早把隐患揪出来、帮对方补上——「以测促防」这个立场，决定了我们用什么样的手段、在什么范围内停下来。', kws: ['以测促防', '防御', '保护', '立场', '底线', '守护', '帮助', '整改', '用户优先'] }

                            ],

                            ref: '《网络产品安全漏洞管理规定》/ CNVD 国家信息安全漏洞共享平台 / 负责任披露 / 限时披露'

                        }

                    ]

                },

                '5': {

                    title: '任务5 安全管理测评',

                    cases: [

                        {

                            id: 's5a', comp: '沟通表达',

                            title: '紧张的安全管理员与"问不出"的访谈',

                            scene: '访谈安全管理员时，对方一问三不知，只会说"这个是外包公司弄的""我是新来的不清楚"。访谈 40 分钟毫无收获，记录几乎空白。同组建议："干脆按制度文档写了算，访谈走过场。"',

                            question: '请分析"走过场"的问题，并说明你会如何设计与实施这次访谈（准备、提问技巧、记录）。',

                            points: [

                                { label: '访谈的证据价值', method: '访谈是验证"制度是否真实执行"的关键环节——制度写了还得有人做，访谈走过场就丢了核心证据。', kws: ['访谈', '执行', '落地', '核实', '佐证', '证据', '真实', '制度'] },

                                { label: '提问与准备技巧', method: '提前发访谈提纲；用开放式问题（"最近一次怎么处理的？"）和具体化追问；必要时更换访谈对象。', kws: ['开放式', '具体', '场景', '举例', '最近', '逐条', '引导', '换人', '提前', '提纲'] },

                                { label: '记录规范', method: '访谈记录要如实整理、关键结论让受访人签字确认——不能凭空补写。', kws: ['记录', '如实', '签字', '确认', '整理', '要点', '留痕'] }

                            ]

                        },

                        {

                            id: 's5b', comp: '服务意识',

                            title: '「你们就是来找茬的」——被误解的测评',

                            scene: '整改沟通会上，被测评单位的信息主管情绪激动："你们出的报告 30 多条不符合，领导都找我谈话了！你们测评就是来找茬、卡我们脖子的！"现场气氛紧张。',

                            question: '请分析如何理解"以测促防"的服务定位，并说明你会如何回应这位主管、如何让后续整改沟通更顺畅。',

                            points: [

                                { label: '服务定位认知', method: '测评初心是"以测促防"——帮客户把风险看清、把防护做实，不是挑刺。', kws: ['以测促防', '帮助', '改进', '防线', '价值', '共同', '安全', '服务', '初心'] },

                                { label: '回应与共情技巧', method: '先共情对方的压力，再讲标准条款和判定客观性——耐心解释为什么这些项判"不符合"。', kws: ['共情', '理解', '解释', '依据', '标准', '客观', '协商', '耐心', '倾听'] },

                                { label: '整改支持行动', method: '报告之外，给客户整改建议、优先级排序、必要时配合辅导整改——把"找茬"变成"帮忙"。', kws: ['整改', '建议', '方案', '优先级', '辅导', '跟踪', '可行性', '配合'] }

                            ]

                        }

                    ]

                },

                '6': {

                    title: '任务6 测评报告编制',

                    cases: [

                        {

                            id: 's6a', comp: '诚信与责任',

                            title: '「改成符合，客户要拿去投标」——报告定稿前的最后压力',

                            scene: '测评报告定稿前，项目经理转达客户要求："把 6 条「部分符合」都改成「符合」，客户要拿这份报告去投标，不能有瑕疵。改动很小，没人会查到。"',

                            question: '请分析修改判定结论涉及的法律与职业风险，并说明你的应对步骤。',

                            points: [

                                { label: '法律后果认知', method: '出具失实测评报告是违法行为——机构和签字人员都会被处罚，严重的取消资质。', kws: ['虚假', '失实', '法律', '责任', '取消', '资质', '处罚', '投标', '违法', '弄虚作假'] },

                                { label: '客观立场', method: '判定结论的根据是标准条款和证据——不能被客户商业利益改写。', kws: ['拒绝', '底线', '如实', '原则', '不能', '独立', '客观', '真实', '证据'] },

                                { label: '应对路径', method: '按机构流程上报项目经理/技术负责人，由机构层与客户沟通——结论改不改要有书面依据。', kws: ['上报', '机构', '沟通', '说明', '留痕', '记录', '申诉', '制度', '流程'] }

                            ]

                        },

                        {

                            id: 's6b', comp: '保密意识 · 数据安全',

                            title: '把报告喂给公共 AI 的"高效"润色',

                            scene: '报告初稿文字粗糙，你想让它更专业，于是把报告整章（含客户单位名称、系统名称、IP 段、漏洞明细）粘贴到某个免费公共 AI 网页工具里"帮忙润色"。同组同学提醒你这可能有风险，你觉得"又没人看得到"。',

                            question: '请分析向公共 AI 工具提交客户敏感信息的风险，并说明在必须使用 AI 辅助时的正确做法。',

                            points: [

                                { label: '风险识别', method: '公共 AI 工具的隐私条款通常允许将输入内容用于训练或留存——敏感数据上传就可能扩散。', kws: ['敏感', '泄露', '公开', '上传', '第三方', '隐私', '条款', '留存', '滥用', '数据'] },

                                { label: '脱敏处理', method: '客户名称、系统名、IP 段、漏洞明细都要先脱敏（化名、占位、删除），再交给 AI 辅助。', kws: ['脱敏', '匿名', '代替', '删除', '遮蔽', '示例', '化名', '占位'] },

                                { label: '合规边界', method: '客户敏感数据属于保密协议范围——使用前要按制度审批，必要时使用机构指定的私有/脱敏 AI。', kws: ['制度', '授权', '同意', '审批', '机构', '红线', '规定', '保密协议'] }

                            ]

                        },



                        {

                            id: 's6c', comp: '客观公正 · 职业判断',

                            title: '「就 4 项不符合，当然是基本符合」——被复核人打回的整体结论',

                            scene: '项目复评会上，复核人把你写的整体结论打回："某政务系统共 46 个测评项，你数了数只有 4 项不符合，就直接写了『基本符合』。可这 4 项里，一项是『数据备份恢复——未做异地备份』，一项是管理类的『应急预案与事件处置——制度缺失』。你数了数量，却没看位置和权重。"你心里有点不服：4 项占比还不到 10%，真有那么严重吗？',

                            question: '请分析"只看不符合项数量、不看位置和权重"的判定方式问题出在哪里，并说明你会如何重写这段整体结论。',

                            points: [

                                { label: '位置与权重认知', method: '整体结论不是"数票"——要看不符合项是不是核心指标（如数据备份恢复、入侵防范、应急预案等），核心指标 1 项不符合也可能直接把整体结论拉到"不符合"。', kws: ['权重', '位置', '核心', '关键', '数据备份', '应急预案', '重要', '指标', '分布', '占比'] },

                                { label: '依据与证据意识', method: '整体结论必须由统计数据和标准条款支撑，并明确落到"符合/基本符合/不符合"三档之一——"尚可""总体不错"这类模糊表述都不合格。', kws: ['依据', '证据', '数据', '统计', '标准', '条款', '明确', '三档', '客观'] },

                                { label: '结论一致性', method: '结论必须与正文的风险描述一致：正文写"存在多项高危风险"，结论却写"基本符合"，自相矛盾的报告等于自己否定自己。', kws: ['一致', '矛盾', '风险描述', '对应', '自相', '相符'] },

                                { label: '客观公正与责任', method: '判定不因客户关系"放水"、也不因个人喜好"从严"——结论直接影响客户的整改投入与安全决策，写轻了会掩盖重大风险，写重了会造成不必要成本，都必须以证据为准。', kws: ['客观', '公正', '责任', '如实', '放水', '从严', '底线', '决策', '整改'] }

                            ]

                        }

                    ]

                },

                '7.1': {

                    title: '任务7.1 云计算安全测评（架构认知 + 配置核查）',

                    cases: [

                        {

                            id: 's7a', comp: '终身学习',

                            title: '「学不完的新技术」——云计算时代的本领恐慌',

                            scene: '学习扩展要求（云计算、移动互联、物联网、工控）时，你发现每个领域的安全架构和扩展指标都不一样，标准还隔几年就修订。你有点沮丧："刚学会的东西就过时了，这行是不是要一直被「追着跑」？"',

                            question: '请分析安全行业"知识快速迭代"的特点对从业者意味着什么，并制定你自己的持续学习策略。',

                            points: [

                                { label: '行业特性认知', method: '攻防对抗决定了安全行业知识必然快速迭代——这是常态不是例外。', kws: ['常态', '迭代', '更新', '变化', '快速', '演进', '攻防', '对抗'] },

                                { label: '学习方法构建', method: '跟踪标准修订（GB/T 22239 等）、关注权威资讯社区、用"原理不变"应对"形式万变"——搭自己的学习体系。', kws: ['标准', '跟踪', '关注', '社区', '资讯', '证书', '体系', '原理', '基础'] },

                                { label: '心态调适', method: '本领恐慌正常——先把基础打扎实，长期主义比短期焦虑管用。', kws: ['恐慌', '焦虑', '规划', '成长', '长期', '习惯', '扎实', '沉淀'] }

                            ]

                        },

                        {

                            id: 's7b', comp: '创新意识',

                            title: '从"人肉逐项"到"人机协同"——一次效率革命的机会',

                            scene: '实习时你发现师傅们仍在用 Excel 手工逐项核对几百条测评指标，一做就是一周。你想到课上用过的自动化核查和 AI 辅助分析，忍不住想："要是我来设计流程，能不能又快又稳？"',

                            question: '请提出你的创新改进思路，并说明在引入自动化/AI 时必须守住的边界，才能让创新真正安全落地。',

                            points: [

                                { label: '创新思路落地', method: '自动化核查脚本、批量比对工具、AI 辅助分析 + 人工复核模板——能把一周压缩到一两天。', kws: ['自动化', '工具', '脚本', '批量', '模板', '流程', '协同', '平台', '优化'] },

                                { label: '人机分工与责任', method: '机器负责执行和初筛，判定权和最终结论必须留给人——不能把责任甩给 AI。', kws: ['人工', '复核', '抽查', '验证', '责任', '判定', '红线', '监督', '不能'] },

                                { label: '稳妥推进', method: '先在小范围试点对比效果（人工 vs 自动化），验证准确率后再逐步推广。', kws: ['试点', '评估', '风险', '逐步', '验证', '质量', '对比', '反馈'] }

                            ]

                        },

                        {

                            id: 's72a', comp: '严谨求实 · 证据意识',

                            title: '「截图我 P 一下就行」——云平台取证的诚实底线',

                            scene: '配置核查实验快截止了，有同学提议："CloudLab 页面截图太麻烦了，我 P 几张"已加固镜像""源地址限定内网"的截图交上去，反正老师也不会一页页点开云平台核对。"你怎么看？',

                            question: '请分析"伪造核查证据"对测评工作的危害，并说明云平台配置核查中正确的取证做法。',

                            points: [

                                { label: '证据的真实性', method: '测评结论全部建立在证据之上——伪造截图等于伪造结论，比"没测出来"性质恶劣得多。', kws: ['证据', '真实', '伪造', '截图', '造假', '诚实', '底线', '可信'] },

                                { label: '可追溯的取证方法', method: '正确做法：登录 CloudLab 实际操作、导出配置与记录表、截图带页面时间戳、与记录表条目一一对应——证据要经得起复核。', kws: ['导出', '记录表', '对应', '复核', '时间戳', '留痕', '可追溯', '核对'] },

                                { label: '职业后果', method: '测评报告失实会让客户带着虚假安全感上线系统，出事后机构与测评师都要担责——诚信是这一行的立身之本。', kws: ['责任', '后果', '担责', '诚信', '职业', '机构', '失实', '安全'] }

                            ]

                        }

                    ]

                },

                '7.2': {

                    title: '任务7.2 移动互联安全测评（架构认知 + 配置核查）',

                    cases: [

                        {

                            id: 's73a', comp: '安全意识',

                            title: '「一个 App 要这么多权限？」——你手机里的架构课',

                            scene: '装一个手电筒 App，它却申请读取通讯录、定位和短信权限；办公 App 要求"允许读取应用列表"。同学说："都这样，习惯就好。"你刚学完"端-管-云"架构，意识到这正是移动端安全的第一课。',

                            question: '请用"端-管-云"的分析视角，说明过度索权 App 的安全风险，以及个人和机构各应采取什么防护措施。',

                            points: [

                                { label: '端侧风险识别', method: '过度索权意味着 App 可以在"端"侧把通讯录、位置等敏感数据悄悄带走——这是移动终端管控扩展要求要防的第一类风险。', kws: ['权限', '过度', '索权', '通讯录', '定位', '隐私', '数据', '端'] },

                                { label: '链路与云侧视角', method: '数据被收集后会经"管"传到"云"，传输是否加密、云端怎么存、接口谁能访问，都是架构认知要追问的环节。', kws: ['传输', '加密', '云端', '接口', '链路', '存储', '通信'] },

                                { label: '分层防护', method: '个人：按最小必要授权、用权限管理收权；机构：移动应用管控 + 终端准入 + 统一分发——分层设防。', kws: ['最小必要', '授权', '管控', '准入', '防护', '措施', '管理'] }

                            ]

                        },

                        {

                            id: 's74a', comp: '规则意识',

                            title: '「蹭个网怎么了」——办公区里的私接热点',

                            scene: '你在实习单位看到有员工用随身 WiFi 给办公笔记本"开热点"绕开公司网络管控，还觉得挺机智。你想到 7.4 核查的"无线接入控制"——办公区每一个来路不明的热点，都是绕过边界防护的一条暗道。',

                            question: '请分析私接热点对无线接入控制与整体网络安全的影响，并给单位提出可落地的管控建议。',

                            points: [

                                { label: '边界失守分析', method: '私接热点让数据绕过企业无线接入认证与监控直接出网——边界防护在它面前形同虚设。', kws: ['热点', '绕过', '边界', '管控', '接入', '失控', '风险'] },

                                { label: '规则的价值', method: '无线接入管控、终端准入这些"规矩"看似麻烦，实际是在替所有人守着数据出口——遵守规则本身就是安全能力。', kws: ['规则', '制度', '准入', '认证', '遵守', '管控', '意识'] },

                                { label: '可落地建议', method: '技术上：无线白名单+终端准入+定期扫描私建热点；管理上：制度明确+办公网满足合理上网需求，疏堵结合。', kws: ['扫描', '白名单', '准入', '制度', '发现', '处置', '建议'] }

                            ]

                        }

                    ]

                },

                '7.3': {

                    title: '任务7.3 物联网安全测评（架构认知 + 配置核查）',

                    cases: [

                        {

                            id: 's75a', comp: '家国情怀 · 国家安全意识',

                            title: '「几十万个摄像头被黑」——物联网失守的国家之痛',

                            scene: '你了解到某次大规模断网事件的起因：几十万个弱口令摄像头被组成僵尸网络，对目标发起流量洪峰。这些"不起眼"的小设备，居然能撬动半个互联网——你重新审视了感知层在物联网架构中的分量。',

                            question: '请结合该事件说明感知层安全对国家网络空间安全的影响，以及你在物联网架构认知中应有的责任意识。',

                            points: [

                                { label: '事件的架构解读', method: '感知层设备量大、分散、弱防护——单台无害，聚合起来就是国家级攻击武器；这正是物联网扩展要求强调设备标识与物理防护的原因。', kws: ['感知层', '僵尸网络', '摄像头', '弱口令', '规模', '聚合', '标识', '防护'] },

                                { label: '国家安全视角', method: '关键基础设施的摄像头、传感器一旦被控，影响的可能是电网、水务、交通——物联网安全直接连着国家安全。', kws: ['关键基础设施', '国家安全', '电网', '交通', '影响', '攻击', '责任'] },

                                { label: '从业者的责任', method: '未来你配置的每一台感知设备，都是在为国家的网络空间"上锁"——从现在起养成"弱口令零容忍"的习惯。', kws: ['责任', '习惯', '弱口令', '配置', '安全', '意识', '职业'] }

                            ]

                        },

                        {

                            id: 's76a', comp: '责任意识',

                            title: '「默认口令谁会去改？」——一次核查引发的整改',

                            scene: '你在配置核查练习中发现模拟物联网平台里 60% 的摄像头还在用 admin/admin 默认口令，且固件两年没升级。有人劝你："这是模拟环境，随便填个符合就行，何必较真。"',

                            question: '请说明默认口令与固件失管为什么是物联网核查的高危项，并给出规范的核查与整改流程。',

                            points: [

                                { label: '高危项判断', method: '默认口令等于"钥匙插在门上"；固件失管意味着已知漏洞长期敞开——两者都是物联网攻击的头号入口。', kws: ['默认口令', 'admin', '弱口令', '固件', '漏洞', '高危', '入口', '升级'] },

                                { label: '较真的意义', method: '模拟环境练的就是较真——现在放过"admin/admin"，将来实习面对真实设备也会"随便填"，核查记录就成了废纸。', kws: ['认真', '较真', '记录', '真实', '习惯', '练习', '态度'] },

                                { label: '规范流程', method: '核查：清点设备→核对口令策略→核对固件版本→对照记录表逐项判定；整改：改口令+定期升级+建立台账，闭环管理。', kws: ['清点', '台账', '闭环', '整改', '升级', '策略', '流程', '判定'] }

                            ]

                        }

                    ]

                },

                '7.4': {

                    title: '任务7.4 工控系统安全测评（架构认知 + 配置核查）',

                    cases: [

                        {

                            id: 's77a', comp: '职业使命 · 家国情怀',

                            title: '「一行代码，物理世界停摆」——工控安全为什么是国之重器',

                            scene: '课堂上老师讲了"震网"病毒：一段专门针对 PLC 的代码，让伊朗核设施的离心机在仪表显示一切正常的情况下自我损毁——网络攻击第一次造成了物理世界的破坏。你意识到工控安全的分量与 IT 安全完全不同。',

                            question: '请结合震网事件说明工控系统安全与国家命脉的关系，谈谈你作为未来的安全从业者应建立怎样的职业使命。',

                            points: [

                                { label: '物理后果认知', method: '工控攻击的后果不在屏幕上，而在现实中：停水、停电、停产甚至人员伤亡——可用性与生产安全永远第一。', kws: ['物理', '后果', '停产', '爆炸', '伤亡', '可用性', '生产', '震网'] },

                                { label: '关键设施分量', method: '电力、水务、化工、轨道交通都是工控系统，是国家的命脉——工控安全就是国家安全的一部分。', kws: ['关键基础设施', '命脉', '电力', '水务', '化工', '国家安全', '战略'] },

                                { label: '职业使命', method: '学好工控架构与安全机制，守住生产网络的每一道边界——这是网络强国建设者实实在在的责任。', kws: ['使命', '责任', '网络强国', '守护', '学习', '本领', '担当'] }

                            ]

                        },

                        {

                            id: 's78a', comp: '风险意识 · 稳健作风',

                            title: '「先扫描一遍再说？」——工控核查里的"不能急"',

                            scene: '实训中你迫不及待想对模拟工控网络来一次全量漏洞扫描，指导老师拦住你："真实工控环境里，一个扫描包就可能让老 PLC 死机停产，损失按小时算几十万。"你第一次理解了"先保生产、再谈安全"这八个字。',

                            question: '请分析工控环境下"直接照搬 IT 安全手段"的风险，并说明工控核查应遵循的稳健工作方式。',

                            points: [

                                { label: '可用性优先', method: '工控系统可用性压倒一切——扫描、打补丁、重启都可能中断生产，任何"安全动作"都要先评估生产影响。', kws: ['可用性', '生产', '影响', '评估', '中断', '优先', '停机'] },

                                { label: '稳健的工作方式', method: '核查以配置核对、日志分析等"被动"方式为主；确需测试时选生产影响最小的时段、先在测试区验证、有回退预案。', kws: ['被动', '核对', '日志', '测试区', '验证', '回退', '预案', '时段'] },

                                { label: '边界与敬畏', method: '知道哪些手段"不能用"与知道哪些"该用"同样重要——对生产系统的敬畏之心是工控测评师的必修素养。', kws: ['边界', '敬畏', '谨慎', '红线', '素养', '不能', '克制'] }

                            ]

                        }

                    ]

                },

                '8': {

                    title: '任务8 风险评估',

                    cases: [

                        {

                            id: 's8a', comp: '独立判断 · 批判性思维',

                            title: '「老师看不出来的」——AI 代做的风险评估表格',

                            scene: '风险评估要产出威胁识别表、脆弱性分析表、风险计算表。有同学把情景素材直接丢给 AI，五分钟生成一整套表格，还劝你："判断依据随便编两句就行，老师又看不出来。"',

                            question: '请分析"AI 代做全套表格"为什么被课程列为红线，以及你应如何正确借助 AI 完成这次评估作业。',

                            points: [

                                { label: '红线的原因', method: '这门课考的是"判断过程"——你怎么识别威胁、怎么分析脆弱性、怎么赋值，不是"表格长什么样"。', kws: ['判断', '过程', '核心', '考核', '能力', '替代', '思考', '分析', '空心'] },

                                { label: 'AI 的正确用法', method: 'AI 可以帮你查资料、解释概念、校对格式——但威胁识别、脆弱性赋值、风险判断必须你自己做。', kws: ['辅助', '解释', '查资料', '启发', '校对', '格式', '建议', '讨论', '边界', '不能代替'] },

                                { label: '失实的代价', method: 'AI 生成的赋值若脱离情景实际，结论就失真——作业会被判不及格，更严重的是养成"靠 AI 不动脑"的习惯。', kws: ['失真', '错误', '风险', '无效', '误导', '不实', '漏洞', '隐患'] }

                            ]

                        },

                        {

                            id: 's8b', comp: '职业道德',

                            title: '「把风险写低一点」——结论栏里的良心',

                            scene: '风险评估报告结论将直接影响客户今年的整改预算。客户安全负责人私下找到你："高风险改成中风险吧，预算审批太麻烦了，明年我们一定改。"你算了算，改成中风险确实能帮客户省下一大笔钱。',

                            question: '请分析风险等级结论被"人为调低"后的连锁后果，并说明你的职业立场与处理方式。',

                            points: [

                                { label: '客观公正立场', method: '风险等级是按方法（GB/T 20984）算出来的——不是"商量"出来的。', kws: ['客观', '如实', '依据', '计算', '数据', '不能', '独立', '真实', '方法'] },

                                { label: '连锁后果推演', method: '等级调低 → 整改预算压缩 → 隐患留存 → 出事后整改单位和测评机构都要担责。', kws: ['整改', '防护', '风险', '隐患', '事故', '责任', '误导', '决策', '预算'] },

                                { label: '得体的处理方式', method: '不篡改结论——可以帮客户想替代方案（分期整改、上云降险、申请专项预算等），但客观结论不能动。', kws: ['解释', '依据', '沟通', '上报', '原则', '分寸', '建议', '分期', '替代'] }

                            ]

                        }

                    ]

                }

            };



            (function setupSuyangCases() {

                function taskKeyOf(el) {

                    var id = el.id || '';

                    if (id.indexOf('substage') === 0) return id.slice(8);

                    if (id.indexOf('stage') === 0) return id.slice(5);

                    return '';

                }

                function userTag() {

                    try {

                        var u = (window.identity && typeof window.identity.currentUser === 'function') ? window.identity.currentUser() : null;

                        var id = u ? (u.id || u.email || '') : '';

                        if (!id) return 'anon';

                        var h = 5381;

                        for (var i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;

                        return (h >>> 0).toString(36);

                    } catch (e) { return 'anon'; }

                }

                function syKey(id) { return 'isec_sy_v1_' + userTag() + '_' + id; }

                function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ''); }

                function esc(t) {

                    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

                }

                function toast(msg) {

                    var t = document.getElementById('sy-toast');

                    if (!t) {

                        t = document.createElement('div');

                        t.id = 'sy-toast';

                        t.className = 'sy-toast';

                        document.body.appendChild(t);

                    }

                    t.textContent = msg;

                    t.classList.add('show');

                    clearTimeout(t._tm);

                    t._tm = setTimeout(function () { t.classList.remove('show'); }, 3200);

                }

                function copyText(text, done) {

                    function legacy() {

                        var ta = document.createElement('textarea');

                        ta.value = text;

                        ta.style.position = 'fixed';

                        ta.style.opacity = '0';

                        document.body.appendChild(ta);

                        ta.select();

                        try { document.execCommand('copy'); } catch (e) { /* noop */ }

                        document.body.removeChild(ta);

                        done();

                    }

                    if (navigator.clipboard && navigator.clipboard.writeText) {

                        navigator.clipboard.writeText(text).then(done, legacy);

                    } else { legacy(); }

                }

                function openAssistant() {

                    var panel = document.getElementById('db-assistant-panel');

                    var trigger = document.getElementById('db-assistant-trigger');

                    if (panel && trigger && !panel.classList.contains('open')) trigger.click();

                }



                // 判定"瞎填"：空、纯空白、极短（去掉标点<6字）、重复字符、测试串

                function isNonsenseAnswer(s) {

                    if (!s) return true;

                    var t = String(s).trim();

                    if (!t) return true;

                    var noPunc = t.replace(/[\s\p{P}\p{S}]/gu, '');

                    if (noPunc.length < 6) return true;

                    // 单一字符重复

                    if (/^(.)\1+$/.test(noPunc)) return true;

                    // 整串由"测试/随便/瞎/应付"等敷衍词组成

                    if (/^(test|测试|随便|瞎填|瞎写|敷衍|应付|asdf|qwerty|abc|一二三|啊啊啊|呵呵|不知道)+$/i.test(noPunc)) return true;

                    // 常见敷衍句式（短且明显没分析）

                    if (noPunc.length <= 10 && /(随便|瞎填|瞎写|应付|敷衍|不知道|不清楚|没想法|觉得.+?就行|凑合|无所谓)/.test(noPunc)) return true;

                    // 同一字符占比超过 60%

                    var cnt = {}, max = 0;

                    for (var i = 0; i < noPunc.length; i++) {

                        cnt[noPunc[i]] = (cnt[noPunc[i]] || 0) + 1;

                        if (cnt[noPunc[i]] > max) max = cnt[noPunc[i]];

                    }

                    if (max / noPunc.length > 0.6) return true;

                    return false;

                }



                // AI 即时点评：老师式直接点评 + 应当具备的素养 + 正确处理方式

                function analyze(caseData, answer) {

                    var s = (answer == null ? '' : String(answer)).trim();



                    // (1) 没作答

                    if (!s) {

                        return '<div class="sy-result-head">' +

                            '<span class="sy-level sy-level-c">✍️ 你还没作答</span>' +

                            '</div>' +

                            '<p>先把场景读一遍，把你真实的想法写下来——哪怕就几句也行。素养是在思考中长出来的，不写就没法判断你具备了什么。</p>';

                    }



                    // (2) 瞎填：老师语气驳回，要求重新思考

                    if (isNonsenseAnswer(s)) {

                        return '<div class="sy-result-head">' +

                            '<span class="sy-level sy-level-c">⚠️ 态度不认真</span>' +

                            '</div>' +

                            '<p>这一句话不像在分析问题——是在应付。素养的培养没法敷衍，请认真把场景读一遍，把你真实的想法（哪怕三五句也行，但要说人话、说具体）写下来，我再给你点评。</p>';

                    }



                    // (3) 正常作答：直接点评

                    var nAns = norm(s);

                    var hits = [], misses = [];

                    caseData.points.forEach(function (p) {

                        var ok = (p.kws || []).some(function (k) { return nAns.indexOf(norm(k)) !== -1; });

                        (ok ? hits : misses).push(p);

                    });

                    var total = caseData.points.length;

                    var cover = total ? hits.length / total : 0;



                    var opener;

                    if (cover >= 0.75) {

                        opener = '你这条分析挺到位的——' + caseData.comp + '的几个关键点都考虑到了，思路也比较清楚。下面把"已经体现的"和"还应该再补的"都列一下，你自己再回顾一下原话。';

                    } else if (cover >= 0.4) {

                        opener = '从你的回答里能看出 ' + hits.length + ' 个方面你已经考虑到了，方向对。但还有几个角度没讲到，素养不是空洞的概念，得落到具体做法上才算数。';

                    } else if (hits.length > 0) {

                        opener = '你提了一点，但还远远不够。"' + caseData.comp + '"在这件事上该怎么体现，下面把要点列出来，请你逐条对照补一下。';

                    } else {

                        opener = '这条回答基本没踩到点。"' + caseData.comp + '"在这件事上应该怎么想、怎么做，下面把要点一条条列出来，请你认真读完，再回头把自己的回答改一改。';

                    }



                    var html = '<div class="sy-result-head">' +

                        '<span class="sy-level sy-level-a">📝 老师点评</span>' +

                        '<span style="font-size:0.82rem;color:#888;">已体现 ' + hits.length + '/' + total + ' 项</span>' +

                        '</div>' +

                        '<p>' + opener + '</p>';



                    // 已体现

                    if (hits.length) {

                        html += '<p><strong>✅ 你已经体现的：</strong></p><ul class="sy-pts">' +

                            hits.map(function (p) {

                                return '<li class="hit"><span class="sy-pt-name">' + esc(p.label) + '</span>' +

                                    '<div class="sy-pt-method">' + esc(p.method || p.hint || '') + '</div></li>';

                            }).join('') + '</ul>';

                    }

                    // 还应具备 + 正确处理方式

                    if (misses.length) {

                        html += '<p><strong>📌 还应当具备 / 正确的处理方式：</strong></p><ul class="sy-pts">' +

                            misses.map(function (p) {

                                return '<li class="miss"><span class="sy-pt-name">' + esc(p.label) + '</span>' +

                                    '<div class="sy-pt-method">' + esc(p.method || p.hint || '') + '</div></li>';

                            }).join('') + '</ul>';

                    }



                    html += '<p style="font-size:0.82rem;color:#888;">想再深入一些，可以点「🛡️ 深度点评」把场景和你的回答交给等保小助教，获得逐句分析。</p>';

                    return html;

                }



                // 组装深度点评提示词

                function buildPrompt(caseData, unitTitle, answer) {

                    var pts = caseData.points.map(function (p, i) { return (i + 1) + '. ' + p.label + '：' + (p.method || p.hint); }).join('\n');

                    return '【素养培养案例 · 场景分析】' + unitTitle + '\n' +

                        '【案例】《' + caseData.title + '》（考察素养：' + caseData.comp + '）\n' +

                        '【场景】' + caseData.scene + '\n' +

                        '【问题】' + caseData.question + '\n' +

                        '【应当具备的素养与正确的处理方式】\n' + pts + '\n' +

                        '【我的回答】\n' + (answer || '（还没有作答）') + '\n\n' +

                        '请你作为《信息安全测评与风险评估》课程的一线老师，直接点评我这条回答：' +

                        '① 像我当面交作业一样，针对我的原话给出明确的看法——哪里想对了、哪里没想透、哪里是错的，别绕弯子；' +

                        '② 如果我写的是敷衍、瞎填、明显在应付，直接点出来并要求我重新思考作答；' +

                        '③ 告诉我这个场景下应该具备什么素养、正确的处理方式是什么；' +

                        '④ 就事论事把道理讲清楚，不要空泛说教、不要纠结我写了多少字。';

                }



                function buildCaseEl(caseData, idx, unitTitle) {

                    var el = document.createElement('div');

                    el.className = 'sy-case';

                    el.innerHTML =

                        '<div class="sy-case-head">' +

                        '<span class="sy-case-no">案例 ' + (idx + 1) + '</span>' +

                        '<span class="sy-comp">素养：' + esc(caseData.comp) + '</span>' +

                        '<span class="sy-case-title">' + esc(caseData.title) + '</span>' +

                        '</div>' +

                        '<div class="sy-scene"><strong>🎬 场景：</strong>' + esc(caseData.scene).replace(/\n/g, '<br>') + '</div>' +

                        (caseData.ref ? '<div class="sy-ref-note">🔎 <strong>延伸查证（建议自己动手搜一搜，别只读我写的）：</strong>' + esc(caseData.ref) + '</div>' : '') +

                        '<div class="sy-q"><strong>❓ 请分析：</strong>' + esc(caseData.question).replace(/\n/g, '<br>') + '</div>' +

                        '<textarea class="sy-answer" placeholder="结合场景写出你的真实想法（识别问题 → 分析依据 → 给出具体做法）。答案会自动保存在本机，换电脑请先复制备份。"></textarea>' +

                        '<div class="sy-actions">' +

                        '<button type="button" class="sy-btn">🤖 AI 点评我的答案</button>' +

                        '<button type="button" class="sy-btn-ghost">🛡️ 深度点评（等保小助教）</button>' +

                        '<span class="sy-draft-tip"></span>' +

                        '</div>' +

                        '<div class="sy-result"></div>' +

                        '<details class="sy-ref"><summary>👀 偷看一下：本案例考察哪些素养观察点？</summary>' +

                        '<div class="sy-ref-box">' + caseData.points.map(function (p) { return '· <strong>' + esc(p.label) + '</strong>：' + esc(p.hint || p.method || ''); }).join('<br>') + '</div>' +

                        '</details>';



                    var ta = el.querySelector('.sy-answer');

                    var result = el.querySelector('.sy-result');

                    var draftTip = el.querySelector('.sy-draft-tip');

                    var btnAI = el.querySelectorAll('.sy-actions button')[0];

                    var btnDeep = el.querySelectorAll('.sy-actions button')[1];



                    // 载入本地草稿

                    try {

                        var saved = localStorage.getItem(syKey(caseData.id));

                        if (saved) {

                            ta.value = saved;

                            draftTip.textContent = '已恢复上次草稿';

                        }

                    } catch (e) { /* noop */ }



                    var saveTm = null;

                    ta.addEventListener('input', function () {

                        draftTip.textContent = '草稿保存中…';

                        clearTimeout(saveTm);

                        saveTm = setTimeout(function () {

                            try { localStorage.setItem(syKey(caseData.id), ta.value); } catch (e) { /* noop */ }

                            draftTip.textContent = '草稿已自动保存';

                        }, 600);

                    });



                    btnAI.addEventListener('click', function () {

                        var ans = ta.value.trim();

                        result.innerHTML = analyze(caseData, ans);

                        result.classList.add('show');

                        result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

                        if (typeof trackOperation === 'function') trackOperation('素养案例AI点评', caseData.comp + ' · ' + caseData.title);

                    });



                    btnDeep.addEventListener('click', function () {

                        var ans = ta.value.trim();

                        if (!ans) { toast('请先写下你的分析，再请等保小助教深度点评～'); ta.focus(); return; }

                        copyText(buildPrompt(caseData, unitTitle, ans), function () {

                            openAssistant();

                            toast('提示词已复制 ✓ 请在等保小助教对话框中粘贴发送');

                        });

                        if (typeof trackOperation === 'function') trackOperation('素养案例深度点评', caseData.comp + ' · ' + caseData.title);

                    });



                    return el;

                }



                document.querySelectorAll('.task-stage').forEach(function (stageEl) {

                    if (stageEl.id === 'homepage-stage') return;

                    var substages = stageEl.querySelectorAll('.substage');

                    var containers = substages.length ? substages : [stageEl];

                    containers.forEach(function (container) {

                        var unit = SUYANG_CASES[taskKeyOf(container)];

                        if (!unit) return;

                        var aiGroup = container.querySelector('.cat-group[data-cat="ai"]');

                        if (!aiGroup) return;

                        var wrap = document.createElement('div');

                        wrap.className = 'sy-wrap';

                        wrap.innerHTML =

                            '<div class="sy-banner">' +

                            '<div class="sy-banner-title">🌟 素养培养案例 · 场景分析</div>' +

                            '<div class="sy-banner-note">本任务提炼出 <strong>' + unit.cases.length + ' 项核心素养</strong>，每项配一个真实场景：素材取自公开报道的网络安全事件、行业经典案例、领域内代表性人物的真实事迹，或需要你亲手设计的具体方案。做法建议：先读懂场景 → 顺着「延伸查证」自己搜一搜背景资料 → 独立写下你的真实判断 → 再点「AI 点评」获得老师式的即时反馈；想更深入可以请等保小助教深度点评。作答会按账号自动保存草稿。</div>' +

                            '</div>';

                        unit.cases.forEach(function (c, i) { wrap.appendChild(buildCaseEl(c, i, unit.title)); });

                        aiGroup.insertBefore(wrap, aiGroup.firstChild);

                    });

                });

            })();



            // ===== 知识模块中枢：PPT 课件 + 标准原文 + 知识模块导航 =====

            // 知识分类页重构为三段式：① 学习资源区（课件 PPT、标准原文，点击直接打开）

            // ② 知识结构图（模块节点点击直达对应内容，标准节点直接打开 PDF）

            // ③ 分模块内容面板（一次只显示一个模块，解决内容"散"的问题）

            (function setupKnowledgeHubs() {

                var STD_LIB = {

                    '22239':    { code: 'GB/T 22239-2019', name: '基本要求', file: '国标文件/GBT22239-2019信息安全技术网络安全等级保护基本要求.pdf' },

                    '28448':    { code: 'GB/T 28448-2019', name: '测评要求', file: '国标文件/GBT 28448-2019 信息安全技术 网络安全等级保护测评要求.pdf' },

                    '22240':    { code: 'GB/T 22240-2020', name: '定级指南', file: '国标文件/GBT 22240-2020 信息安全技术 网络安全等级保护定级指南.pdf' },

                    '20984':    { code: 'GB/T 20984-2022', name: '风险评估方法', file: '国标文件/GBT 20984-2022 信息安全技术 信息安全风险评估方法.pdf' },

                    'cyberlaw': { code: '网络安全法', name: '法律条文', file: '国标文件/中华人民共和国网络安全法.pdf' },

                    'datalaw':  { code: '数据安全法', name: '法律条文', file: '国标文件/中华人民共和国数据安全法.pdf' },

                    'report':   { code: '测评报告模板', name: '2025版', file: '国标文件/网络安全等级保护测评报告模板（2025版）.pdf' }

                };

                var KB_RES = {

                    '1.1': { ppts: ['1.1 等保2.0标准体系框架学习（理论版）.pptx'], stds: ['22239', '28448', '22240', '20984', 'cyberlaw', 'datalaw'] },

                    '1.2': { ppts: ['1.2 安全等级识别与实践操作（理论版）.pptx'], stds: ['22240', '22239', '28448'] },

                    '2.1': { ppts: ['2.1 测评方案结构学习（理论版）.pptx'], stds: ['28448', '22239'] },

                    '2.2': { ppts: ['2.2 编制完整测评方案（理论版）.pptx'], stds: ['28448', '22239'] },

                    '3.1': { ppts: ['3.1 物理安全核查.pptx'], stds: ['22239', '28448'] },

                    '3.2': { ppts: ['3.2 网络架构合规性检查.pptx'], stds: ['22239', '28448'] },

                    '4.1': { ppts: ['4.1 主机安全基线核查.pptx'], stds: ['22239', '28448'] },

                    '4.2': { ppts: ['4.2 网络设备配置核查.pptx'], stds: ['22239', '28448'] },

                    '4.3': { ppts: ['4.3 数据库安全配置核查.pptx'], stds: ['22239', '28448'] },

                    '4.4': { ppts: ['4.4 应用系统安全功能验证.pptx'], stds: ['22239', '28448'] },

                    '4.5': { ppts: ['4.5 漏洞扫描与结果分析.pptx'], stds: ['22239', '28448'] },

                    '5':   { ppts: ['5.1 安全管理文档核查.pptx', '5.2 模拟人员访谈.pptx'], stds: ['22239', '28448'] },

                    '6':   { ppts: [], stds: ['28448', '22239', 'report'] },

                    '7.1': { ppts: ['7.1.1 云平台架构认知.pptx', '7.1.2 云安全配置核查.pptx'], stds: ['22239', '28448'] },

                    '7.2': { ppts: ['7.2.1 移动互联架构认知.pptx', '7.2.2 移动安全配置核查.pptx'], stds: ['22239', '28448'] },

                    '7.3': { ppts: ['7.3.1 物联网架构认知.pptx', '7.3.2 物联网安全配置核查.pptx'], stds: ['22239', '28448'] },

                    '7.4': { ppts: ['7.4.1 工控系统架构认知.pptx', '7.4.2 工控安全配置核查.pptx'], stds: ['22239', '28448'] },

                    '8':   { ppts: [], stds: ['20984', '22239', 'datalaw'] }

                };

                // 知识结构图节点 → 模块标题关键词（点击节点激活对应模块面板）

                var KM_LINKS = {

                    '1.1': { what: '信息安全测评', sys: '等级保护制度', law: '等级保护制度', flow: '五步走', stage: '四个阶段', lv: '五级' },

                    '1.2': { obj: '情景分析', s: '定级方法', a: '定级方法', mx: '等级判定', lv1: '等级判定', lv2: '等级判定', lv3: '等级判定', lv4: '等级判定', lv5: '等级判定', ba: '等级判定' },

                    '2.1': { plan: '六要素', f1: '六要素', f2: '测评对象', f3: '裁剪', f4: '测评方法', f5: '六要素' },

                    '2.2': { p1: '六步法', p2: '示范场景', p3: '六步法', p4: '第四阶段', p5: '第五阶段', p6: '9个章节' },

                    '3.1': { top: '情景分析', ph: '3.1 物理安全核查', ph1: '3.1 物理安全核查', ph2: '3.1 物理安全核查' },

                    '3.2': { top: '情景分析', net: '3.2 网络架构合规性检查', net1: '3.2 网络架构合规性检查', net2: '3.2 网络架构合规性检查' },

                    '4.1': { top: '情景分析', ph: '4.1 主机安全基线核查', ph1: '4.1 主机安全基线核查', ph2: '4.1 主机安全基线核查' },

                    '4.2': { top: '情景分析', ne: '4.2 网络设备配置核查', ne1: '4.2 网络设备配置核查', ne2: '4.2 网络设备配置核查' },

                    '4.3': { top: '情景分析', db: '4.3 数据库安全配置核查', db1: '4.3 数据库安全配置核查', db2: '4.3 数据库安全配置核查' },

                    '4.4': { top: '情景分析', ap: '4.4 应用系统安全功能验证', ap1: '4.4 应用系统安全功能验证', ap2: '4.4 应用系统安全功能验证' },

                    '4.5': { top: '情景分析', vl: '4.5 漏洞扫描与结果分析', vl1: '4.5 漏洞扫描与结果分析', vl2: '4.5 漏洞扫描与结果分析' },

                    '5':   { top: '情景分析', m1: '5.1', m2: '5.1', m3: '5.1', m4: '5.1', m5: '5.1', ev: '5.1' },

                    '6':   { top: '情景分析', k1: '从证据到报告', k2: '单项测评结论判定', k3: '系统整体测评结论', k4: '测评报告编制' },

                    '7.1': { top: '情景分析', c1: '是什么', c2: '是什么', c3: '是什么', w1: '为什么', k1: '怎么做', k2: '怎么做', k3: '怎么做' },

                    '7.2': { top: '情景分析', a1: '是什么', a2: '为什么', b1: '怎么做' },

                    '7.3': { top: '情景分析', i1: '是什么', i2: '为什么', j1: '怎么做' },

                    '7.4': { top: '情景分析', g1: '是什么', g2: '为什么', w1: '怎么做' },

                    '8':   { top: '情景分析' }

                };

                // 特殊节点 → 直接打开文件（节点标签以 GB/T 开头的会自动按标准号匹配）

                var KM_FILES = { '1.1': { law: 'cyberlaw' } };



                var hubState = {};



                // 各单元"标准原文"融入的目标模块（按标题关键词匹配）

                var STD_TARGET = {

                    '1.1': '等级保护制度', '1.2': '定级方法', '2.1': '关键概念：测评方案', '2.2': '六步法',

                    '3.1': '为什么查', '3.2': '为什么查', '4.1': '为什么查', '4.2': '为什么查', '4.3': '为什么查', '4.4': '为什么查', '4.5': '为什么查', '5': '5.1', '6': '从证据到报告', '7.1': '责任共担', '7.2': '端—管—云', '7.3': '三层架构', '7.4': '工控四层架构'

                };



                function stdBlockHtml(stds) {

                    var h = '', n = 0;

                    (stds || []).forEach(function (k) {

                        var s = STD_LIB[k];

                        if (!s) return;

                        if (!n) h = '<div class="kb-std-block"><div class="kb-std-block-t">📚 相关标准原文 · 点击直接打开</div><div class="kb-std-list">';

                        n++;

                        h += '<a class="kb-std-btn" href="' + encodeURI(s.file) + '" target="_blank"><b>' + s.code + '</b><span>' + s.name + '</span><i>📄 打开原文</i></a>';

                    });

                    return n ? h + '</div></div>' : '';

                }



                function buildHub(unitKey, kg) {

                    var res = KB_RES[unitKey] || { ppts: [], stds: [] };

                    var kmBox = kg.querySelector(':scope > .km-box');



                    // ---- 1. 按小标题把知识内容切成模块 ----

                    var mods = [], cur = null;

                    Array.prototype.forEach.call(kg.children, function (el) {

                        if (el === kmBox) return; // 结构图单独处理

                        var isHead = el.tagName === 'H3' ||

                            (el.classList.contains('concept-box') && el.querySelector(':scope > .concept-title'));

                        if (isHead) {

                            var t = el.tagName === 'H3' ? el.textContent.trim()

                                : el.querySelector(':scope > .concept-title').textContent.trim();

                            cur = { title: t, els: [] };

                            mods.push(cur);

                        }

                        if (!cur) { cur = { title: '📌 导读', els: [] }; mods.push(cur); }

                        if (el.tagName === 'H3') el.setAttribute('data-kb-h3', '1'); // 标题进入面板头，不再单独展示

                        cur.els.push(el);

                    });

                    if (!mods.length) return;



                    // ---- 2. 情景分析不模块化：置顶常显（知识内容最上面） ----

                    var scBlock = null, scTitle = '';

                    for (var si = 0; si < mods.length; si++) {

                        if (/情景分析|导读/.test(mods[si].title)) {

                            var sm = mods.splice(si, 1)[0];

                            scTitle = sm.title;

                            scBlock = document.createElement('div');

                            scBlock.className = 'kb-scenario';

                            var scHead = document.createElement('div');

                            scHead.className = 'kb-scenario-head';

                            scHead.innerHTML = '<span>🔍</span><span>' + sm.title.replace(/^[^0-9A-Za-z\u4e00-\u9fa5]+/, '') + '</span>';

                            scBlock.appendChild(scHead);

                            sm.els.forEach(function (el) {

                                if (el.getAttribute && el.getAttribute('data-kb-h3')) return;

                                scBlock.appendChild(el);

                            });

                            if (sm.els[0] && sm.els[0].classList && sm.els[0].classList.contains('concept-box')) {

                                var st1 = sm.els[0].querySelector(':scope > .concept-title');

                                if (st1) st1.style.display = 'none';

                            }

                            break;

                        }

                    }

                    if (scBlock) kg.insertBefore(scBlock, kg.firstChild);

                    // 知识模块结构图紧随情景分析之下

                    if (kmBox && kmBox.parentElement === kg) {

                        kg.insertBefore(kmBox, scBlock ? scBlock.nextSibling : kg.firstChild);

                    }



                    // ---- 3. 只有情景分析的单元（如任务8）：标准原文直接挂到情景块 ----

                    if (!mods.length) {

                        if (scBlock) {

                            var sb0 = stdBlockHtml(res.stds);

                            if (sb0) scBlock.insertAdjacentHTML('beforeend', sb0);

                        }

                        hubState[unitKey] = { activate: null, mods: [], scenario: scBlock, scenarioTitle: scTitle };

                        return;

                    }



                    // ---- 4. 模块导航：PPT 独立模块（点击直接打开课件）+ 知识模块卡 ----

                    var nav = document.createElement('div');

                    nav.className = 'kb-mod-nav';

                    if (res.ppts.length) {

                        // 一个任务可能有多份课件（如任务5：5.1 文档核查 + 5.2 模拟人员访谈），逐份生成卡片

                        res.ppts.forEach(function (pptFile) {

                            var pLabel = pptFile.replace(/（理论版）/, '').replace(/\.pptx$/, '');

                            var pcard;

                            if (/^(4\.|5$|6$|7\.)/.test(unitKey) && res.pptOnline !== false) {

                                // 任务4 / 任务5 / 任务6：课件 PDF 已上线，点击直接打开（PPT/同名.pdf）

                                var pdfFile = 'PPT/' + pptFile.replace(/\.pptx$/, '.pdf');

                                pcard = document.createElement('a');

                                pcard.className = 'kb-mod-card kb-ppt-mod';

                                pcard.href = encodeURI(pdfFile);

                                pcard.target = '_blank';

                                pcard.rel = 'noopener';

                                pcard.title = '点击打开 PDF 课件：' + pLabel;

                                pcard.innerHTML =

                                    '<span class="kb-mod-no">📑</span>' +

                                    '<span class="kb-mod-name">' +

                                      '<span class="kb-ppt-badge">PDF</span>' +

                                      '<span class="kb-ppt-title">' + pLabel + '</span>' +

                                      '<span class="kb-ppt-status kb-ppt-status--open">点击打开</span>' +

                                    '</span>';

                                pcard.addEventListener('click', function () {

                                    if (typeof trackOperation === 'function') {

                                        trackOperation('打开课件PDF', pLabel);

                                    }

                                });

                            } else {

                                pcard = document.createElement('button');

                                pcard.type = 'button';

                                pcard.className = 'kb-mod-card kb-ppt-mod kb-ppt-mod--disabled';

                                pcard.setAttribute('aria-disabled', 'true');

                                pcard.title = '课件暂未提供在线浏览，请联系任课教师获取：' + pLabel;

                                pcard.innerHTML =

                                    '<span class="kb-mod-no">📑</span>' +

                                    '<span class="kb-mod-name">' +

                                      '<span class="kb-ppt-badge">PPT</span>' +

                                      '<span class="kb-ppt-title">' + pLabel + '</span>' +

                                      '<span class="kb-ppt-status">暂未开放</span>' +

                                    '</span>';

                                pcard.addEventListener('click', function (e) {

                                    e.preventDefault();

                                    // 课件下载入口已下线：不再打开 window.open / 跳转

                                    if (typeof trackOperation === 'function') {

                                        trackOperation('尝试访问课件（已下线）', pLabel);

                                    }

                                    alert('「' + pLabel + '」课件暂未提供在线浏览，请联系任课教师获取。');

                                });

                            }

                            nav.appendChild(pcard);

                        });

                        // （按老师要求：去掉"⬇ 原文件"小按钮，只保留课件入口）

                    }

                    // ---- 5. 模块卡片 + 内容面板（标准原文融入目标模块） ----

                    var wrap = document.createElement('div');

                    wrap.className = 'kb-mods';

                    var cards = [], panels = [];

                    var tgtKw = STD_TARGET[unitKey] || '';

                    var tgtIdx = -1;

                    mods.forEach(function (m, i) { if (tgtIdx < 0 && tgtKw && m.title.indexOf(tgtKw) >= 0) tgtIdx = i; });

                    if (tgtIdx < 0) tgtIdx = 0; // 找不到目标就融入第一个模块

                    var stdHtml = stdBlockHtml(res.stds);

                    mods.forEach(function (m, i) {

                        var short = m.title.replace(/^[^0-9A-Za-z\u4e00-\u9fa5]+/, '');

                        var card = document.createElement('button');

                        card.type = 'button';

                        card.className = 'kb-mod-card';

                        card.title = m.title;

                        card.innerHTML = '<span class="kb-mod-no">' + (i + 1) + '</span><span class="kb-mod-name">' + short + '</span>';

                        nav.appendChild(card);

                        cards.push(card);



                        var panel = document.createElement('div');

                        panel.className = 'kb-mod';

                        var head = document.createElement('div');

                        head.className = 'kb-mod-head';

                        head.innerHTML = '<span class="kb-mod-num">' + ('0' + (i + 1)).slice(-2) + '</span><span>' + m.title + '</span>';

                        panel.appendChild(head);

                        m.els.forEach(function (el) {

                            if (el.getAttribute && el.getAttribute('data-kb-h3')) return;

                            panel.appendChild(el);

                        });

                        // 模块首个元素是概念框时，其内部标题与面板头重复，隐藏之

                        if (m.els[0] && m.els[0].classList && m.els[0].classList.contains('concept-box')) {

                            var t1 = m.els[0].querySelector(':scope > .concept-title');

                            if (t1) t1.style.display = 'none';

                        }

                        // 标准原文融入本模块

                        if (i === tgtIdx && stdHtml) panel.insertAdjacentHTML('beforeend', stdHtml);

                        wrap.appendChild(panel);

                        panels.push(panel);

                    });

                    function activate(i, scroll) {

                        cards.forEach(function (c, j) { c.classList.toggle('active', j === i); });

                        panels.forEach(function (p, j) { p.classList.toggle('active', j === i); });

                        if (scroll) setTimeout(function () {

                            panels[i].scrollIntoView({ behavior: 'smooth', block: 'start' });

                        }, 60);

                    }

                    cards.forEach(function (c, i) {

                        c.addEventListener('click', function () {

                            activate(i, false);

                            if (typeof trackOperation === 'function') trackOperation('切换知识模块', mods[i].title);

                        });

                    });

                    kg.appendChild(nav);

                    kg.appendChild(wrap);

                    activate(0, false);

                    hubState[unitKey] = { activate: activate, mods: mods, scenario: scBlock, scenarioTitle: scTitle };

                }



                document.querySelectorAll('.task-stage').forEach(function (st) {

                    if (st.id === 'homepage-stage') return;

                    var subs = Array.prototype.slice.call(st.querySelectorAll(':scope > .substage'));

                    var targets = subs.length ? subs : [st];

                    targets.forEach(function (el) {

                        var key = subs.length ? el.id.replace('substage', '') : el.id.replace('stage', '');

                        var kg = el.querySelector(':scope > .cat-group[data-cat="knowledge"]');

                        if (kg) buildHub(key, kg);

                    });

                });



                // 供知识结构图点击调用；返回 true 表示已处理，不再弹默认讲解窗

                window.kmNodeAction = function (unitKey, nodeId) {

                    var d = window.KM_DATA && KM_DATA[unitKey];

                    if (!d || !d.nodes[nodeId]) return false;

                    var label = d.nodes[nodeId].label || '';

                    // ① 标准节点 → 直接打开标准原文 PDF

                    var m = label.match(/^GB\/T\s*(\d+)/);

                    var stdKey = m ? m[1] : (KM_FILES[unitKey] && KM_FILES[unitKey][nodeId]);

                    if (stdKey && STD_LIB[stdKey]) {

                        var s = STD_LIB[stdKey];

                        if (typeof trackOperation === 'function') trackOperation('打开标准原文', s.code + ' ' + s.name);

                        window.open(encodeURI(s.file), '_blank');

                        return true;

                    }

                    // ② 模块节点 → 激活对应模块面板并滚动到位；情景分析节点 → 滚动到顶部常显情景区

                    var kw = KM_LINKS[unitKey] && KM_LINKS[unitKey][nodeId];

                    if (kw && hubState[unitKey]) {

                        var hs = hubState[unitKey];

                        if (hs.scenarioTitle && hs.scenarioTitle.indexOf(kw) >= 0 && hs.scenario) {

                            hs.scenario.scrollIntoView({ behavior: 'smooth', block: 'start' });

                            if (typeof trackOperation === 'function') trackOperation('知识结构图跳转', d.nodes[nodeId].label);

                            return true;

                        }

                        var idx = -1;

                        hs.mods.forEach(function (mod, i) { if (idx < 0 && mod.title.indexOf(kw) >= 0) idx = i; });

                        if (idx >= 0 && hs.activate) {

                            hs.activate(idx, true);

                            if (typeof trackOperation === 'function') trackOperation('知识结构图跳转', d.nodes[nodeId].label);

                            return true;

                        }

                    }

                    return false; // 其余节点保留原"内容讲解"弹窗

                };

            })();



// ===== 配套表格与素材归入实验分类 =====

// 按老师要求：原本位于知识区（cat-group[knowledge]）的 .kb-st-tables 汇总块，

// 运行时统一迁移到同一子任务的 🧪实验 lab-box（cat-group[lab]）末尾，

// 视觉上与 PPT 课件（紫色）区分。

(function migrateTablesToLab() {

    document.querySelectorAll('.substage').forEach(function (sub) {

        var taskId = sub.id.replace('substage', '');

        // buildTabsFor 把所有内容块搬到 cat-group 里，所以要跨层找

        var tbl = sub.querySelector('.cat-group[data-cat="knowledge"] .kb-st-tables')

                  || sub.querySelector(':scope > .kb-st-tables');

        // 4.1 ~ 4.5 实验模块不展示该汇总块（其核心素材已在实验模块"怎么做"一节单独列出）

        if (taskId === '4.1' || taskId === '4.2' || taskId === '4.3' || taskId === '4.4' || taskId === '4.5') { if (tbl) tbl.remove(); return; }

        var lab = sub.querySelector('.cat-group[data-cat="lab"] .lab-box')

                  || sub.querySelector(':scope > .lab-box');

        if (tbl && lab) {

            // 标题微调：去掉"配套"二字，强调实验属性

            var t = tbl.querySelector('.kb-st-title');

            if (t) t.textContent = '🧰 实验用配套表格与素材（点击下载）';

            lab.appendChild(tbl);

        }

    });

})();



            // 切换任务/子任务后，内容分类默认回到"知识"（不计入操作日志）

            function resetStageTabs(stageEl) {

                if (!stageEl) return;

                const activeSub = stageEl.querySelector(':scope > .substage.active') || stageEl;

                const tabs = activeSub.querySelector(':scope > .cat-tabs');

                const tab = activeSub.querySelector(':scope > .cat-tabs .cat-tab[data-cat="knowledge"]');

                if (!tab) return;

                if (tabs) tabs.dataset.reset = '1';

                tab.click();

                if (tabs) delete tabs.dataset.reset;

            }



            function updateProgress() {

                // 顶部细进度条：按当前任务位置推进（任务1-8 线性，stage8 即 100%）

                var track = document.querySelector('.timeline');

                if (!track) return;

                var max = totalStages; // 8 个任务点

                var pct = Math.max(0, Math.min(1, currentStage / max));

                timelineProgress.style.width = (pct * (track.offsetWidth - 60)) + 'px';

            }



            /* ===== 学习位置记忆（整改新增）：切换任务/子任务时记录，下次登录自动接续 ===== */

            var _posTimer = null;

            function currentSubKey() {

                // 取当前激活说明面板中的子单元（如 1.2；无子单元的 stage 返回 null）

                var exp = document.querySelector('.exp-stage.active .exp-substage.active');

                if (!exp) return null;

                var id = exp.id.replace('exp-substage', '');

                return (id.indexOf('.') > 0) ? id : null;

            }

            function recordPosition(stage, substage) {

                if (typeof saveProgress !== 'function') return;

                if (_posTimer) clearTimeout(_posTimer);

                _posTimer = setTimeout(function () {

                    _posTimer = null;

                    try {

                        saveProgress(function (p) {

                            if (stage >= 1) {

                                p.last = { ts: Date.now(), stage: stage, substage: substage || null };

                                p.autoResume = true;

                            }

                            return p;

                        });

                    } catch (e) { /* noop */ }

                }, 300);

            }



            // 隐藏首页、显示对应任务

            function goToStage(stage) {

                const homepage = document.getElementById('homepage-stage');

                const contentEl = document.querySelector('.content');

                const btnHome = document.getElementById('btnHome');

                if (stage === 0) {

                    // 回到首页：先清除所有任务页激活状态，再激活首页（顺序不能颠倒，

                    // 因为首页块本身也是 .task-stage，会被清除逻辑误伤）

                    timelineItems.forEach(item => item.classList.remove('active'));

                    stages.forEach(s => s.classList.remove('active'));

                    explanations.forEach(e => e.classList.remove('active'));

                    homepage.classList.add('active');

                    contentEl.classList.add('home-mode');

                    if (btnHome) btnHome.style.display = 'none';

                    currentStage = 0;

                    updateProgress();

                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    return;

                }



                if (homepage) homepage.classList.remove('active');

                contentEl.classList.remove('home-mode');

                if (btnHome) btnHome.style.display = '';

                window.scrollTo({ top: 0, behavior: 'smooth' });



                const stageNumbers = Array.from(timelineItems)

                    .map(item => parseFloat(item.dataset.stage))

                    .filter(n => !isNaN(n));

                if (!stageNumbers.includes(stage)) return;

                currentStage = stage;



                // 1. 时间线激活状态

                timelineItems.forEach((item) => {

                    const itemStage = parseFloat(item.dataset.stage);

                    item.classList.toggle('active', itemStage === currentStage);

                });



                // 2. 任务内容区

                stages.forEach((stageEl) => {

                    if (stageEl.id === 'homepage-stage') return;

                    const stageId = parseFloat(stageEl.id.replace('stage', ''));

                    stageEl.classList.toggle('active', stageId === currentStage);

                });



                // 3. 说明区

                explanations.forEach((exp) => {

                    const expId = parseFloat(exp.id.replace('exp-stage', ''));

                    exp.classList.toggle('active', expId === currentStage);

                });



                // 4. 含子任务的页面：默认激活第一个子任务（任务1/2/3 均适用）

                if (document.querySelector('.substage-btn[data-substage="' + currentStage + '.1"]')) {

                    const prefix = currentStage;

                    document.querySelectorAll('.substage-btn[data-substage^="' + prefix + '."]').forEach(btn => btn.classList.remove('active'));

                    const firstBtn = document.querySelector('.substage-btn[data-substage="' + prefix + '.1"]');

                    if (firstBtn) firstBtn.classList.add('active');

                    document.querySelectorAll('.substage[id^="substage' + prefix + '."]').forEach(s => s.classList.remove('active'));

                    const firstSub = document.getElementById('substage' + prefix + '.1');

                    if (firstSub) firstSub.classList.add('active');

                    document.querySelectorAll('.exp-substage[id^="exp-substage' + prefix + '."]').forEach(es => es.classList.remove('active'));

                    const firstExp = document.getElementById('exp-substage' + prefix + '.1');

                    if (firstExp) firstExp.classList.add('active');

                }



                // 5. 任务切换后内容分类默认回到"知识"

                resetStageTabs(document.getElementById('stage' + currentStage));



                // 6. 按钮文本

                btnNext.textContent = currentStage === totalStages ? '技能之旅结束' : '下一任务';

                updateProgress();



                // 7. 记录学习位置（含默认激活的子任务），用于下次登录自动接续；回首页(stage 0)不覆盖

                if (stage >= 1) recordPosition(stage, currentSubKey());

            }



            // 时间线点击

            timelineItems.forEach((item) => {

                item.addEventListener('click', () => {

                    goToStage(parseFloat(item.dataset.stage));

                });

            });



            // 首页"开启技能之旅"

            const startBtn = document.getElementById('startPracticeBtn');

            if (startBtn) {

                startBtn.addEventListener('click', () => goToStage(1));

            }



            // 返回首页

            const btnHome = document.getElementById('btnHome');

            if (btnHome) {

                btnHome.addEventListener('click', () => goToStage(0));

            }



            // 上一任务

            btnPrev.addEventListener('click', () => {

                if (currentStage === 0) return;

                if (currentStage === 1) {

                    goToStage(0);

                } else {

                    goToStage(currentStage - 1);

                }

            });



            // 下一任务

            btnNext.addEventListener('click', () => {

                if (currentStage === 0) {

                    goToStage(1);

                    return;

                }

                if (currentStage === totalStages) {

                    alert('🎉 本次技能之旅结束！恭喜你完成信息安全测评与风险评估全部8个任务的学习～');

                    return;

                }

                goToStage(currentStage + 1);

            });



            // 子任务切换

            document.querySelectorAll('.substage-btn').forEach((btn) => {

                btn.addEventListener('click', function() {

                    const sub = this.dataset.substage; // 如 "1.2"

                    const main = sub.split('.')[0];     // 如 "1"

                    // 切换按钮激活

                    document.querySelectorAll('.substage-btn[data-substage^="' + main + '."]').forEach(b => b.classList.remove('active'));

                    this.classList.add('active');

                    // 切换左侧内容

                    document.querySelectorAll('.substage[id^="substage' + main + '."]').forEach(s => s.classList.remove('active'));

                    const target = document.getElementById('substage' + sub);

                    if (target) target.classList.add('active');

                    // 切换右侧说明

                    document.querySelectorAll('.exp-substage[id^="exp-substage' + main + '."]').forEach(es => es.classList.remove('active'));

                    const expTarget = document.getElementById('exp-substage' + sub);

                    if (expTarget) expTarget.classList.add('active');

                    // 内容分类默认回到"知识"

                    resetStageTabs(document.getElementById('stage' + main));



                    // 记录学习位置（子任务级，如 1.2）

                    recordPosition(parseFloat(main), sub);

                });

            });



            // 技能闯关统一入口（顶部时间线下方横幅）

            const btnPracticeGate = document.getElementById('btnPracticeGate');

            if (btnPracticeGate) {

                btnPracticeGate.addEventListener('click', () => {

                    if (typeof trackOperation === 'function') trackOperation('进入技能闯关', '测评指挥官 · 项目经理实战');

                    window.location.href = encodeURI('实践测试/denbao-pm-game/index.html');

                });

            }



            // 从技能闯关返回定位：#unit-2.2 直接切到对应任务/子任务

            (function () {

                const hm = location.hash.match(/^#unit-(\d+)\.(\d+)$/);

                if (!hm) return;

                goToStage(parseInt(hm[1], 10));

                const sBtn = document.querySelector('.substage-btn[data-substage="' + hm[1] + '.' + hm[2] + '"]');

                if (sBtn) sBtn.click();

            })();



            updateProgress();



            /* ===== 自动续学（整改新增）：登录态就绪后，若该账号有上次学习位置则自动跳回并轻提示 ===== */

            function resumeUnitLabel(last) {

                // 有子任务显示完整单元号（如 1.2）；无子任务显示任务号（如 5）

                return last.substage ? String(last.substage) : String(last.stage);

            }

            function showResumeBar(last) {

                try {

                    var old = document.getElementById('resumeBar');

                    if (old && old.parentNode) old.parentNode.removeChild(old);

                    var bar = document.createElement('div');

                    bar.id = 'resumeBar';

                    bar.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:10000;' +

                        'display:flex;align-items:center;gap:10px;background:#0a58ca;color:#fff;' +

                        'padding:8px 14px 8px 16px;border-radius:999px;box-shadow:0 6px 18px rgba(10,40,90,.22);' +

                        'font:14px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",sans-serif;max-width:92vw;';

                    var txt = document.createElement('span');

                    txt.textContent = '📌 已接续上次学习进度：任务 ' + resumeUnitLabel(last);

                    var homeBtn = document.createElement('button');

                    homeBtn.textContent = '返回首页';

                    homeBtn.style.cssText = 'border:1px solid rgba(255,255,255,.75);background:transparent;color:#fff;' +

                        'border-radius:999px;padding:2px 10px;font-size:12px;cursor:pointer;white-space:nowrap;';

                    homeBtn.addEventListener('click', function () {

                        goToStage(0);

                        if (bar.parentNode) bar.parentNode.removeChild(bar);

                    });

                    var closeBtn = document.createElement('button');

                    closeBtn.textContent = '✕';

                    closeBtn.setAttribute('aria-label', '关闭');

                    closeBtn.style.cssText = 'border:0;background:transparent;color:#fff;cursor:pointer;font-size:13px;padding:2px 4px;opacity:.85;';

                    closeBtn.addEventListener('click', function () { if (bar.parentNode) bar.parentNode.removeChild(bar); });

                    bar.appendChild(txt); bar.appendChild(homeBtn); bar.appendChild(closeBtn);

                    (document.body || document.documentElement).appendChild(bar);

                    setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 9000);

                } catch (e) { /* noop */ }

            }

            function resumeLastPosition() {

                // 从技能闯关返回（#unit-x.y）：以 URL 定位优先，不做自动续学

                if (location.hash && location.hash.indexOf('#unit-') === 0) return;

                var who = 'guest';

                try { who = (typeof accountTag === 'function' && accountTag()) || 'guest'; } catch (e) { /* noop */ }

                var flagKey = 'isec_resumed_' + who;   // 同一账号本会话只续学一次，避免刷新后反复跳转

                try { if (sessionStorage.getItem(flagKey)) return; } catch (e) { /* noop */ }

                var doResume = function () {

                    window.loadProgress(true).then(function (p) {

                        if (!p || !p.last || p.autoResume === false) return;

                        var last = p.last;

                        if (!(last.stage >= 1)) return;

                        try { sessionStorage.setItem(flagKey, '1'); } catch (e) { /* noop */ }

                        goToStage(last.stage);

                        if (last.substage) {

                            var sb = document.querySelector('.substage-btn[data-substage="' + last.substage + '"]');

                            if (sb) sb.click();   // 触发子任务激活 + 再次记录该位置

                        }

                        showResumeBar(last);

                    });

                };

                if (typeof initIdentity === 'function') initIdentity().then(doResume);

                else doResume();

            }

            resumeLastPosition();

        });

    
;


/* ================= 单元测评题库（第一部分：单元 1.1 / 1.2 / 2.1） =================

       整改后：每个单元 10 题 × 10 分 = 满分 100；

       维度配比 知识3 + 实验4 + 素养3（对应分值 30 / 40 / 30）。

       t: single单选 / multi多选；d: k知识 / s实验 / q素养（情景分析） */

    var QUIZ_DATA = {

    '1.1': { title: '1.1 等保2.0标准体系框架', qs: [

        { t:'single', d:'k', pts:10, q:'网络安全等级保护2.0制度直接的法律依据是？',

          o:['《网络安全法》第21条','《数据安全法》第27条','《保密法》','《电子签名法》'], a:[0],

          e:'《网络安全法》第21条规定"国家实行网络安全等级保护制度"，等保2.0标准体系由此而来。' },

        { t:'single', d:'k', pts:10, q:'等保2.0"一个中心、三重防护"中，"三重防护"指？',

          o:['安全通信网络、安全区域边界、安全计算环境','防火墙、入侵检测、杀毒软件','物理安全、网络安全、应用安全','加密、备份、审计'], a:[0],

          e:'一个中心=安全管理中心；三重防护=安全通信网络、安全区域边界、安全计算环境，这是等保2.0的总体防护思想。' },

        { t:'multi', d:'k', pts:10, q:'与等保1.0相比，等保2.0的主要变化包括？（多选）',

          o:['保护对象扩展到云计算、移动互联、物联网、工业控制系统','安全要求分为"通用要求+扩展要求"','强化了可信计算技术要求','取消了等级划分，只分合格与不合格'], a:[0,1,2],

          e:'等保2.0仍保留五个安全等级，"取消等级划分"是错误项；其余三项均为2.0的标志性变化。' },

        { t:'single', d:'s', pts:10, q:'想知道某三级系统"应该做到什么"，应查阅哪个标准？',

          o:['GB/T 22239《网络安全等级保护基本要求》','GB/T 28448《测评要求》','GB/T 22240《定级指南》','GB/T 20984《风险评估方法》'], a:[0],

          e:'GB/T 22239 规定"做到什么"，GB/T 28448 规定"怎么测"——两个标准要分清用途。' },

        { t:'single', d:'s', pts:10, q:'测评人员开展等级测评、判定达标与否，主要依据哪个标准？',

          o:['GB/T 28448《测评要求》','GB/T 22239 中只看第一级内容','测评机构自行制定的内部标准','客户的口头要求'], a:[0],

          e:'GB/T 28448 规定了测评方法、测评对象与判定准则，是测评活动的主要操作依据。' },

        { t:'single', d:'s', pts:10, q:'同一家机构同时受理政务云、高校、医院三个项目，为对象分配标准依据时，正确的做法是？',

          o:['以 GB/T 22239 通用要求为基础，按对象类型叠加对应扩展要求','三个项目都只按通用要求测，省事','让客户自己选择用哪个标准','只测扩展要求，通用要求略过'], a:[0],

          e:'云、移动互联等特殊对象在通用要求外还须叠加扩展要求，测评指标表要"通用+扩展"双轨裁剪。' },

        { t:'single', d:'s', pts:10, q:'现场核查中，访谈、核查、测试三种方法配合使用的主要目的是？',

          o:['让"人证、物证、实测"三类证据相互印证','三种方法各测一遍凑工作量','只测最便宜的一种','找最省事的证据'], a:[0],

          e:'访谈问人、核查看物与记录、测试验系统行为，三类证据交叉印证才能支撑测评结论。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】小李写课程作业时引用了一份网络上来路不明的"等保标准解读"，发现与教材表述冲突。最恰当的做法是？',

          o:['以官方发布的标准原文（GB/T 22239-2019 等）为准核对后修订笔记','网上阅读量高的内容一般是对的，按网上的改','两种说法都写上，让老师自己判断','凭印象写，差不多就行'], a:[0],

          e:'信息安全工作讲求"标准原文意识"：结论必须有权威来源支撑，这是测评职业素养的起点。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】客户问"等保测评是不是只要买一批防火墙、杀毒软件装上去就能过？"作为测评人员，你应？',

          o:['解释测评是按 GB/T 22239 逐项核查管理与技术落实情况，重"防护实效"而非设备堆砌','点头称是，设备买齐就行','建议客户多买设备保证通过','不正面回答'], a:[0],

          e:'等保测评看的是安全要求逐项落实的证据与效果，设备堆砌不等于合规达标；把理念讲清楚是测评人员的专业责任。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】测评完成后客户希望你顺手帮他做系统安全整改实施（属建设集成），并许诺额外费用。你应？',

          o:['说明测评与整改实施宜分离，避免"既当运动员又当裁判员"，如需实施按规范另立项目','欣然接受并马上动手','答应后私下做','先报价再悄悄做'], a:[0],

          e:'测评独立性与利益冲突管理是行业底线；同一机构既测评又包整改实施，会损害测评结论的客观公正。' }

    ]},

    '1.2': { title: '1.2 安全等级识别', qs: [

        { t:'single', d:'k', pts:10, q:'等保定级两要素 S 与 A 分别指？',

          o:['S=业务信息安全保护等级，A=系统服务安全保护等级','S=软件，A=硬件','S=保密性，A=可用性','S=静态要求，A=动态要求'], a:[0],

          e:'S 看业务信息（数据）被破坏的后果，A 看系统服务（功能）中断的后果。' },

        { t:'single', d:'k', pts:10, q:'某系统 S=3、A=2，其安全保护等级应定为？',

          o:['三级','二级','取平均值约二级半','一级'], a:[0],

          e:'定级取高原则：max(3,2)=3 → 三级。就高不就低，防护按更高一侧配置。' },

        { t:'single', d:'k', pts:10, q:'等级保护共分五级，级别最高、监管最严的是？',

          o:['第五级（专控保护）','第三级（监督保护）','第一级（自主保护）','各级无高低之分'], a:[0],

          e:'一级最低（自主保护），五级最高（专控保护）；常见政务、金融系统多为二、三级。' },

        { t:'single', d:'s', pts:10, q:'某医院挂号收费系统经分析 S=2、A=2，应定为？',

          o:['二级','三级','一级','四级'], a:[0],

          e:'取高 max(2,2)=2 → 二级。' },

        { t:'single', d:'s', pts:10, q:'关于定级"过高"与"过低"，下列说法正确的是？',

          o:['过低→防护不足埋下隐患，过高→成本浪费过度防护','定得越高越安全，一律就高不就低','定级只是形式，高低无所谓','定低了以后随时可改，无需重新备案'], a:[0],

          e:'定级不准需要重新定级备案；过低可能被监管通报，过高则造成资源浪费——科学定级才是目标。' },

        { t:'single', d:'s', pts:10, q:'某三级政务系统新上线一个仅面向内部的小功能模块（不承载新业务），按定级要求应？',

          o:['先判断是否构成独立定级对象；不构成则纳入原三级系统统一测评','把小功能模块单独定为一级','把整个系统降为二级','直接跳过该模块不测评'], a:[0],

          e:'定级对象是"承载独立业务的系统"，新增功能不构成独立对象时随原系统测评，不能随意改变系统等级。' },

        { t:'single', d:'s', pts:10, q:'客户称"去年已做过等保定级，今年不用再定级"，作为测评人员你应？',

          o:['核对其定级报告与备案证明是否有效、系统是否有重大变更，再决定是否需重新定级','完全听客户的不再核查','凭印象认为系统没有变化','直接按二级测省事'], a:[0],

          e:'系统发生重大变更（业务范围、处理数据变化等）时应重新定级；测评前核实定级材料是基本动作。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】某单位领导为节省安全建设费用，暗示你把实际 S=3 的系统"灵活"定为二级。恰当的做法是？',

          o:['如实定级并说明定级依据与低定级的合规风险，供单位决策','听领导的，定为二级','折中写成"二级半"','不与单位沟通，自己直接按三级出报告'], a:[0],

          e:'测评人员的立身之本是客观独立：如实定级、讲清风险，而不是迎合。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】负责评审定级结果的专家私下说"这种小系统定一级就行，备案麻烦"。你应？',

          o:['坚持按 S/A 两要素与 GB/T 22240 客观定级；若与材料不符须走正式变更程序','专家说了算，直接定一级','把系统"压"到不用备案的级别','先不定级，拖着再说'], a:[0],

          e:'定级不是人情，是依据 S/A 与标准的严肃判断；屈从压力乱定级会埋下防护与合规隐患。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】你完成定级表初稿后自查，发现某系统 S/A 的理由写反（张冠李戴），但初稿已提交。恰当的做法是？',

          o:['主动更正并说明原因，形成修订记录','等老师或客户发现后再改','删除重写不留修订痕迹','坚持说初稿是对的'], a:[0],

          e:'能自查自纠、坦诚修订，比"一次写对"更体现专业态度；测评文件讲求可追溯的修订留痕。' }

    ]},

    '2.1': { title: '2.1 测评方案结构', qs: [

        { t:'single', d:'k', pts:10, q:'下列不属于测评方案核心要素的是？',

          o:['系统整改建议','测评范围','测评指标','日程与人员安排'], a:[0],

          e:'方案要素围绕"测什么、怎么测"；整改建议是测评报告的输出，不属于方案要素。' },

        { t:'multi', d:'k', pts:10, q:'等级测评的三种基本方法是？（多选）',

          o:['访谈','核查','测试','无授权的渗透攻击'], a:[0,1,2],

          e:'访谈问"人"、核查看"物与记录"、测试验"系统行为"；渗透测试需单独授权，不是等级测评必选方法。' },

        { t:'single', d:'k', pts:10, q:'测评指标裁剪的正确做法是？',

          o:['依据对象特点裁剪不适用的指标，并说明裁剪理由','为省工期把难测的指标全部裁掉','客户说删哪个就删哪个','三级系统直接按二级指标测'], a:[0],

          e:'裁剪只能基于"不适用"，不能基于"难测/想过"——指标表中的"适用性"列就是裁剪落点。' },

        { t:'single', d:'s', pts:10, q:'某系统有 60 台同构应用服务器，按"抽样比例不低于30%"原则，至少应测？',

          o:['18 台','6 台','30 台','全部 60 台'], a:[0],

          e:'60×30%=18 台，同时兼顾关键性与代表性。' },

        { t:'single', d:'s', pts:10, q:'"应测尽测、关键性、代表性、抽样≥30%"属于哪方面的原则？',

          o:['测评对象选取','测评报告编制','风险计算','等级定级'], a:[0],

          e:'这是测评对象选取的四大原则，用于从测评范围内挑出具体核查对象。' },

        { t:'single', d:'s', pts:10, q:'编制方案时发现某设备"不在测评范围但与核心业务互通"，正确的处理是？',

          o:['在方案中明确其边界处理方式并说明不纳入原因','直接纳入一并测评','完全忽略不写','让客户自行决定范围外设备'], a:[0],

          e:'范围外设备不做测评对象，但涉及网络边界关联时应在方案里交代清楚，避免"测与不测"边界模糊。' },

        { t:'single', d:'s', pts:10, q:'方案评审会上有人建议"测评日程应避开客户业务高峰"，你的判断是？',

          o:['合理，尤其漏洞扫描/渗透测试类高风险操作应安排在授权窗口与低峰期','完全没必要，什么时候都一样','应把高风险测试放在白天高峰以证明系统可靠','日程应由客户随时插队调整'], a:[0],

          e:'风险操作的窗口安排是方案可执行性的关键，写入日程与人员安排是专业表现。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】为赶工期，组长说"机房里随便挑两台最新采购的服务器测就行"。更恰当的做法是？',

          o:['按"应测尽测+关键性+代表性"抽样，优先覆盖承载核心业务的关键设备','完全按组长说的办','只测最旧的设备','跳过服务器，只测网络设备'], a:[0],

          e:'新设备≠代表性设备；抽样要覆盖核心业务资产，否则结论以偏概全——敢于用专业依据说话，也是职业素养。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】项目经理为"展示能力"要求把方案写成 80 页，大量堆砌通用模板文字。你应？',

          o:['坚持方案贵在针对性：紧扣本系统范围、对象、指标，篇幅服从内容','照做，写越长越显专业','只写 2 页说明就算完成','复制其他项目内容快速凑页'], a:[0],

          e:'方案的评判标准是"测什么、怎么测"清晰可执行，不是篇幅；堆砌与复制都会损害方案质量与专业形象。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】编制方案时，你发现测评范围要覆盖一个从未接触过的业务系统。恰当的态度是？',

          o:['主动学习该业务与系统的技术资料，必要时请教同事或客户，弄懂后再确定范围与对象','不懂装懂，直接照抄通用模板','先划进范围再说，反正现场再改','让客户提供现成的测评结论'], a:[0],

          e:'测评范围圈错全盘皆错；面对陌生对象先学习后落笔，是专业与负责的表现。' }

    ]}};

    
;


    /* ================= 题库（第二部分：2.2 / 任务3 / 任务4） =================

       整改后：每个单元 10 题 × 10 分 = 满分 100；

       维度配比 知识3 + 实验4 + 素养3（对应分值 30 / 40 / 30）。

       t: single单选 / multi多选；d: k知识 / s实验 / q素养（情景分析） */

    QUIZ_DATA['2.2'] = { title: '2.2 编制完整测评方案', qs: [

        { t:'single', d:'k', pts:10, q:'方案编制"六步法"的正确顺序是？',

          o:['解读定级报告 → 分析架构 → 确定范围 → 选取对象 → 确定指标 → 日程与分工','直接选设备 → 写日程 → 再定范围','先排日程 → 再定指标 → 最后看架构','确定指标 → 选取对象 → 分析架构 → 解读定级'], a:[0],

          e:'先懂"定几级"，再懂"系统长什么样"，才能圈范围、挑对象、定指标、排日程——顺序不可颠倒。' },

        { t:'single', d:'k', pts:10, q:'正式开展等级测评的前提依据是？',

          o:['取得客户的定级报告与备案证明','客户口头委托即可','测评机构自行评估即可','无需任何前提'], a:[0],

          e:'等级测评以系统已定级备案为前提，方案编制第一步就是解读定级报告。' },

        { t:'single', d:'k', pts:10, q:'测评指标表中"适用性"列的作用是？',

          o:['标记该指标是否适用于被测对象，作为裁剪依据','标记该指标的难易程度','标记由谁负责填写','标记使用的测试工具'], a:[0],

          e:'"适用性"是指标裁剪的落点：不适用须写理由，适用则必须测。' },

        { t:'single', d:'s', pts:10, q:'编制方案时发现客户提供的网络拓扑图与现场实际不符，应？',

          o:['与客户核实并更新拓扑后再确定测评范围','以纸质拓扑为准，错了是客户的责任','跳过网络部分不测','自行修改拓扑不留记录'], a:[0],

          e:'方案基于错误拓扑=范围圈错。核实修正并留痕，是负责任的做法。' },

        { t:'single', d:'s', pts:10, q:'关于方案中的"日程安排"，较合理的做法是？',

          o:['现场测评、分析判定、报告初稿、终稿各阶段均明确时间节点','只写"尽快完成"','由客户随时通知，不写具体安排','所有工作压缩在一天完成'], a:[0],

          e:'可执行性是方案的核心质量：每个阶段有交付物与时间点。' },

        { t:'single', d:'s', pts:10, q:'某三级系统未部署无线网络，编制指标表时，GB/T 22239 中"无线接入安全"相关条款应标记为？',

          o:['不适用，并在适用性列注明"系统无无线接入"','符合','不符合','部分符合'], a:[0],

          e:'指标裁剪的落点是"适用性"列：没有无线网络，无线条款就不适用，而不是删掉或凭空判符合。' },

        { t:'single', d:'s', pts:10, q:'现场测评开始前，需要与客户确认的事项中，通常不包括？',

          o:['测评组成员当月的绩效考核指标','高风险测试（漏洞扫描/渗透）的窗口与书面授权','配合人员与联系人','远程/现场作业方式及网络条件'], a:[0],

          e:'授权窗口、配合人员、作业方式决定方案能否落地；绩效考核是机构内部管理，与客户无关。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】同学打算直接复制上学期的测评方案，改个项目名就提交。你对这种做法的判断是？',

          o:['不可取：方案必须与本项目的对象特点、架构、定级结果对应，参考也要消化重构','可以，方案都是八股文','只要字体格式好看就行','把模板里的日期改对就可以了'], a:[0],

          e:'方案的价值在于针对性——对象不同，范围、指标、日程全都不同。独立完成才是有效训练。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】客户技术负责人私下给你好处，希望把方案中测评范围"写得模糊些"，方便日后少测。你应？',

          o:['婉拒并说明范围必须清晰可核，范围模糊对测评质量与客户双方都是隐患','收下并按他说的写','不收好处但照做','先收下，现场再按实际测'], a:[0],

          e:'测评范围是合同级承诺，模糊化会损害结论公信力；面对利益诱惑守住独立底线是职业基本要求。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】客户一再压缩测评日程，组长打算把现场核查从 5 天压到 2 天（抽样与核查深度明显缩水）。你应？',

          o:['说明压缩将影响测评项覆盖与证据质量，建议按风险主次取舍并请客户书面确认','照办，反正有人负责','只测最容易取证的项目','压缩报告篇幅但不压缩现场'], a:[0],

          e:'进度压力不能以牺牲证据质量为代价；敢于就专业底线沟通并书面留痕，是方案阶段就要具备的素养。' }

    ]};

    QUIZ_DATA['3'] = { title: '任务3 安全物理环境与通信网络测评', qs: [

        { t:'single', d:'k', pts:10, q:'机房物理位置选择，正确的做法是？',

          o:['避开易积水、易受灾、振动和噪声强的区域','选顶楼视野好','选地下室省空间','离加油站越近越好'], a:[0],

          e:'物理位置核查关注自然环境与周边环境风险：水患、火灾、电磁干扰等。' },

        { t:'multi', d:'k', pts:10, q:'"安全物理环境"的核查项包括？（多选）',

          o:['物理访问控制（门禁、监控）','防火、防水、防潮、温湿度控制','电力供应（UPS、备用电源）','数据库账号口令复杂度'], a:[0,1,2],

          e:'口令复杂度属于"安全计算环境"，不属于物理环境。' },

        { t:'single', d:'k', pts:10, q:'"安全通信网络"核查的核心内容是？',

          o:['网络架构合理性与通信传输的保密性、完整性','机房温湿度','员工培训记录','灭火器有效期'], a:[0],

          e:'通信网络是系统的"马路"：架构（区域划分、冗余）+ 传输（加密、完整）。' },

        { t:'single', d:'s', pts:10, q:'核查机房"防火"措施时，除灭火器外还应关注？',

          o:['火灾自动报警、气体灭火系统、防火隔离','服务器 CPU 温度','门禁卡的类型','网络带宽大小'], a:[0],

          e:'三级机房要求火灾自动报警与气体灭火——水喷淋会损坏电子设备。' },

        { t:'single', d:'s', pts:10, q:'判断"通信传输保密性"达标，较为可靠的证据是？',

          o:['核查加密配置并实际验证（如确认 HTTPS 生效、抓包确认密文）','听管理员说"我们加密了"','看宣传材料上写了"加密"','机房里有防火墙就行'], a:[0],

          e:'测评讲证据：配置 + 实际验证，不能只听口说。' },

        { t:'single', d:'s', pts:10, q:'核查三级系统核心网络架构时，应重点确认？',

          o:['关键设备与链路具备冗余设计（如双机、双链路），避免单点故障','只有一台核心设备但宣称"够用"','设备数量越多越好','只要求带宽足够大'], a:[0],

          e:'冗余架构是三级网络架构的核查要点：核心节点单点故障要有冗余设计支撑，且最好有切换验证记录。' },

        { t:'single', d:'s', pts:10, q:'现场验证"网络区域划分"是否真实落地，最直接的核查方式是？',

          o:['查看防火墙/交换机上的区域与访问控制配置，结合拓扑核对实际流量路径','只看客户提供的拓扑图','询问员工知不知道分几个区','检查网线颜色是否一致'], a:[0],

          e:'区域划分是否落地要看设备配置与实际路径，"图纸"与"配置"必须交叉验证，防止纸面合规。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】你随测评组进入客户机房开展核查，正确的行为是？',

          o:['按客户规定登记、佩戴访客证，拍照取证前征得客户同意','机房反正是"参观"，随便拍照','好奇之下插拔网线看看效果','让客户帮自己刷卡开门代为进入'], a:[0],

          e:'现场作业规范、尊重客户管理制度，是测评人员最基本的职业素养。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】核查机房时发现温度显示 38℃，管理员说"空调坏了两天，凑合用"。你应？',

          o:['记录温湿度超限的事实与持续时间，评估对设备可用性的影响并写入核查记录','觉得与测评无关，忽略','当场帮管理员修空调','只在报告里写一句"机房较热"'], a:[0],

          e:'物理环境超限属于测评发现，如实记录并说明影响才是尽职；跳过或淡化都会埋下隐患。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】核查网络架构时发现，机房未经登记私装了一台无线 AP 并接入办公网。恰当的处理是？',

          o:['将"未受控无线接入"作为风险点如实记录，并提示其可能绕过边界防护','视而不见','当场剪断网线','只在闲聊中口头提醒'], a:[0],

          e:'未受管理的无线接入会旁路边界防护，是典型架构风险；如实记录并给出专业提示才是负责态度。' }

    ]};

    QUIZ_DATA['4'] = { title: '任务4 安全区域边界与计算环境测评', qs: [

        { t:'multi', d:'k', pts:10, q:'"安全区域边界"的典型防护措施包括？（多选）',

          o:['防火墙访问控制','入侵检测与防御（IDS/IPS）','恶意代码防范','员工生日福利制度'], a:[0,1,2],

          e:'区域边界是系统的"大门"：访问控制 + 入侵防范 + 恶意代码防范 + 边界审计。' },

        { t:'single', d:'k', pts:10, q:'主机"安全审计"核查要点包括日志的？',

          o:['覆盖范围与保留期限（不少于 6 个月）','字体是否美观','日志文件的颜色','服务器的品牌'], a:[0],

          e:'《网络安全法》要求留存相关网络日志不少于六个月。' },

        { t:'single', d:'k', pts:10, q:'身份鉴别的弱配置典型表现是？',

          o:['口令简单、长期不改、无登录失败处理','使用了双因素认证','口令 90 天强制更换','登录失败 5 次即锁定'], a:[0],

          e:'其余三项都是"符合"的表现；弱配置恰恰相反。' },

        { t:'single', d:'s', pts:10, q:'漏洞扫描发现高危漏洞后的正确流程是？',

          o:['验证漏洞真实性，结合资产重要性评估风险并如实记录','直接删掉扫描报告里的那条记录','借机吓唬客户多收费','不管它，等客户自己发现'], a:[0],

          e:'扫描结果须人工复核（排除误报）再定风险，如实记录是底线。' },

        { t:'single', d:'s', pts:10, q:'核查数据库访问控制合规性，应重点查看？',

          o:['账号权限是否最小化、有无特权滥用、审计是否开启','数据库机房的温度','数据库软件的价格','数据库图标的样式'], a:[0],

          e:'计算环境核查围绕"身份鉴别、访问控制、安全审计、入侵防范、数据保护"展开。' },

        { t:'single', d:'s', pts:10, q:'判断边界上的入侵检测/防御（IDS/IPS）是否真正生效，较可靠的核查方法是？',

          o:['核对检测策略已启用、规则库版本较新，并查看是否有真实告警记录（必要时做无害验证）','看设备指示灯是否亮着','听管理员口头保证','检查设备外壳的新旧程度'], a:[0],

          e:'生效性要证据支撑：策略开启 + 规则库更新 + 有告警记录，三者缺一都只能判"部分符合"。' },

        { t:'single', d:'s', pts:10, q:'核查主机访问控制时，"默认拒绝/最小权限"应重点落到哪些核查点上？',

          o:['账号与权限分配、共享目录权限、服务运行账号是否最小化','机箱是否上锁','显示器分辨率设置','操作系统的桌面主题'], a:[0],

          e:'访问控制最终落到账号、目录、服务账号等具体配置点，逐点核对权限与实际需要是否匹配。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】对客户核心业务系统做漏洞扫描可能影响业务。扫描前你的正确做法是？',

          o:['与客户确认扫描窗口与授权范围，避开业务高峰并写入方案','趁中午没人偷偷扫','让客户签字后就什么都不管','拒绝任何扫描，只做访谈'], a:[0],

          e:'授权范围内、窗口期内作业，是测评执业的红线——技术手段再有效也不能越界。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】测试中发现客户服务器存在可被远程利用的高危漏洞，若披露可能影响客户的年度考核。你应？',

          o:['如实记录并按流程告知客户（附临时缓解建议），不因顾虑而隐瞒','帮客户瞒下来','只记在自己的工作笔记里','拖到报告提交后再处理'], a:[0],

          e:'高危风险及时如实告知是测评人员的责任边界；为"照顾面子"隐瞒，可能给客户造成更大损失。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】客户为赶验收进度，要求把"测试发现问题的设备"直接判为"符合"，理由是"下个月就换新了"。你应？',

          o:['说明测评反映当前实际状态，设备将更换也应如实记录现状，整改计划可另列说明','照客户要求写"符合"','跳过这些设备不写','把这些设备从测评范围里悄悄删掉'], a:[0],

          e:'测评结论描述的是当下事实，不能拿"未来计划"顶替；客观呈现现状、整改另列，才是合规做法。' }

    ]};



    
;


    /* ================= 题库（第三部分：任务5 / 6 / 7 / 8） =================

       整改后：每个单元 10 题 × 10 分 = 满分 100；

       维度配比 知识3 + 实验4 + 素养3（对应分值 30 / 40 / 30）。

       t: single单选 / multi多选；d: k知识 / s实验 / q素养（情景分析） */

    QUIZ_DATA['5'] = { title: '任务5 安全管理测评', qs: [

        { t:'single', d:'k', pts:10, q:'安全管理五大类中，"人员录用、离岗、教育培训"属于？',

          o:['安全管理人员','安全管理制度','安全运维管理','安全物理环境'], a:[0],

          e:'人员安全管理涵盖录用审查、离岗权限回收、教育培训与外部人员访问管控。' },

        { t:'single', d:'k', pts:10, q:'管理类测评最主要的方法组合是？',

          o:['文档核查 + 人员访谈','漏洞扫描','渗透测试','流量抓包'], a:[0],

          e:'制度"写在纸上、落在人上"：看文本、问执行，技术工具只是辅助。' },

        { t:'single', d:'k', pts:10, q:'管理测评中的"证据链思维"指？',

          o:['结论要有制度文本、执行记录、访谈佐证等相互印证的证据','证据越多越好，不管相不相关','只听负责人口头说明','有截图即可，无需其他证据'], a:[0],

          e:'孤证不定案：文本 + 记录 + 口述三方印证，才能支撑"符合/部分符合"的判定。' },

        { t:'single', d:'s', pts:10, q:'核查"人员安全管理"时调阅的记录中，不应包括？',

          o:['服务器防火墙配置备份','人员录用审批记录','离岗权限回收/交接记录','安全培训签到与考核记录'], a:[0],

          e:'防火墙配置属于技术类核查证据，不是人员安全管理的记录。' },

        { t:'single', d:'s', pts:10, q:'访谈发现"有制度、无执行记录"（两张皮），单项结论应判？',

          o:['部分符合或不符合（依证据缺失程度），并如实记录','符合（毕竟有制度）','直接跳过不评','判符合，口头提醒一下就行'], a:[0],

          e:'有文本无执行=落空：一般判"部分符合"，完全没有执行则"不符合"。' },

        { t:'single', d:'s', pts:10, q:'核查"安全意识教育培训"是否落实，下列证据链最完整的是？',

          o:['年度培训计划 → 培训通知 → 签到表 → 考核/效果记录形成闭环','只有一张培训现场照片','只有一份培训课件','管理员口头说"培训过了"'], a:[0],

          e:'闭环证据才能支撑"符合"；照片、课件等孤证最多支撑"部分符合"，口说无凭。' },

        { t:'single', d:'s', pts:10, q:'核查"离岗人员权限回收"是否落地，最有效的核查方式是？',

          o:['抽取近期离岗员工名单，逐一核对账号是否停用及权限回收记录','只看制度文本里有没有"离岗回收"字样','询问在岗员工知不知道','查看离岗员工的工牌'], a:[0],

          e:'制度落地要看执行痕迹：名单与账号实际状态比对，是验证回收机制的直接手段。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】访谈时受访人员回答前后矛盾，你怀疑其隐瞒实情。恰当的做法是？',

          o:['换角度交叉验证，并调阅记录佐证，如实记录发现','当场指责他说谎','按他最新一次的说法写','不再访谈，直接判不符合'], a:[0],

          e:'用证据说话而不是情绪——保持客观、方法得当，是测评人员的基本功。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】管理员口头说"每季度都做安全培训"，但查阅记录只有去年一次。你应？',

          o:['以记录为准如实呈现频次不符，并可请对方核实是否有未归档的培训','按口头说法记录','不再深究，直接判"符合"','让对方补几张记录再判'], a:[0],

          e:'口说无凭、记录为准；可以再核实，但绝不能诱导或帮助补证造假。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】客户希望把某部门管理测评的"不符合"改为"部分符合"，理由是部门领导"面子挂不住"。你应？',

          o:['坚持按证据判定，同时建议客户限期整改后申请复核','改，与人方便自己方便','折中判"符合"','把该测评项整体删掉'], a:[0],

          e:'判定不受人情左右；对确有差距的项，引导客户整改后复测，才是合规又体面的出路。' }

    ]};

    QUIZ_DATA['6'] = { title: '任务6 测评报告编制', qs: [

        { t:'single', d:'k', pts:10, q:'单项测评结论的四种判定是？',

          o:['符合、部分符合、不符合、不适用','优、良、中、差','合格、不合格','高、中、低'], a:[0],

          e:'单项结论四选一；"优/良/中/差"是系统整体结论的档位，两者不要混淆。' },

        { t:'single', d:'k', pts:10, q:'系统整体测评结论的形成方式是？',

          o:['汇总所有单项结论，综合分析研判（优/良/中/差）','取所有单项结果的算术平均值','按客户希望填写','随机抽一个单项的结论'], a:[0],

          e:'整体结论是综合研判的结果，尤其要关注高风险项带来的影响。' },

        { t:'single', d:'k', pts:10, q:'对报告"整改建议"的基本要求是？',

          o:['具体可行：说明怎么改、改成什么样','写"建议加强管理"即可','越多越好，不需要优先级','让客户自己想办法'], a:[0],

          e:'"建议加强"式空话是报告大忌——可落地的建议才有价值。' },

        { t:'single', d:'s', pts:10, q:'某测评项"制度有、部分执行、记录不全"，结论应判？',

          o:['部分符合','符合','不符合','不适用'], a:[0],

          e:'做了但有差距、证据不全 → 部分符合，并在报告中说明差距点。' },

        { t:'single', d:'s', pts:10, q:'报告中每个测评结论与证据的正确关系是？',

          o:['结论须有对应证据支撑，可追溯到具体证据','结论写好后证据随意附','证据只放照片即可','结论可以凭经验写'], a:[0],

          e:'可追溯性是报告的公信力底线：每个判定都要指出依据。' },

        { t:'single', d:'s', pts:10, q:'编制报告"风险分析"部分时，正确的做法是？',

          o:['结合被测对象重要程度，对不符合/部分符合项逐项分析可能造成的风险与影响','笼统写一句"存在安全隐患"','只罗列问题不做分析','风险高低由客户说了算'], a:[0],

          e:'风险分析是单项结论通向整体评价的桥梁，须把每个问题与资产重要性、业务影响关联起来。' },

        { t:'single', d:'s', pts:10, q:'对报告中问题项的整改建议进行排序时，优先考虑的是？',

          o:['问题对应的风险等级与资产重要性（高危、高价值资产优先）','问题在报告正文中的出现顺序','客户整改起来是否省事','撰写人觉得哪个好写'], a:[0],

          e:'整改优先级应服从风险：高危险、高价值资产的问题排在最前，建议才具备可执行性。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】某项证据不足无法下结论，但报告明天就要交。正确的做法是？',

          o:['补测取证后再下结论，必要时与客户沟通延期','凭感觉判"符合"','该项留空不写','判"不适用"绕过去'], a:[0],

          e:'宁可延期，不可臆断——报告的公信力高于工期。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】报告审核阶段，同事建议"整体评价写高点，客户满意，下次项目还好谈"。你应？',

          o:['坚持依据测评结果客观评价，不因商业因素调高结论','采纳建议','把高风险项降级呈现','略去整体评价不写'], a:[0],

          e:'商业利益不能左右测评结论；客观公正是报告的生命线，也是机构长期信誉的来源。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】自查发现初稿中某项判定与证据不符——证据只支持"部分符合"却判了"符合"，且是客户反复强调的项。你应？',

          o:['主动修正判定并留存修订记录，必要时向客户说明原因','将错就错','改成"不适用"绕开','等客户发现后再改'], a:[0],

          e:'自查自纠、修订留痕，是报告质量与职业诚信的双重要求；知错即改远比文过饰非专业。' }

    ]};

    QUIZ_DATA['7'] = { title: '任务7 扩展要求测评', qs: [

        { t:'multi', d:'k', pts:10, q:'等保2.0 扩展要求覆盖的领域有？（多选）',

          o:['云计算','移动互联','物联网','工业控制系统'], a:[0,1,2,3],

          e:'四大扩展领域：云计算、移动互联、物联网、工业控制系统——同一安全理念，不同落地方式。' },

        { t:'single', d:'k', pts:10, q:'云计算安全责任的特点是？',

          o:['云服务商与云租户"责任共担"，各管各的层面','全部由云服务商负责','全部由云租户负责','由监管机构负责'], a:[0],

          e:'IaaS/PaaS/SaaS 模式下的分担界面不同，测评要分别核查双方的责任落实。' },

        { t:'single', d:'k', pts:10, q:'工业控制系统安全的基本原则是？',

          o:['生产网与管理网隔离，边界受控防护','工控网与互联网直接互联方便办公','可用性可以牺牲换取安全性','工控协议天生安全无需防护'], a:[0],

          e:'工控首要保生产连续性：隔离 + 边界防护是基本盘，且可用性优先于机密性。' },

        { t:'single', d:'s', pts:10, q:'物联网系统核查区别于传统系统的关注点是？',

          o:['感知层设备（传感器/摄像头）的物理防护与身份标识','机房桌椅的数量','员工着装规范','打印机墨盒型号'], a:[0],

          e:'海量感知设备物理暴露、难以逐一管理，是物联网特有的风险。' },

        { t:'single', d:'s', pts:10, q:'移动应用安全核查应覆盖？',

          o:['客户端安全（本地存储/反编译）、通信加密、服务端接口','只测客户端界面颜色','只测网速快慢','只看应用图标'], a:[0],

          e:'移动应用是"端-管-云"整体，三段都要核。' },

        { t:'single', d:'s', pts:10, q:'核查云上系统时，下列属于"租户侧"核查内容的是？',

          o:['租户自建业务系统的账号权限、数据加密与安全配置','云平台底层虚拟化安全（云服务商）','云机房物理环境（云服务商）','云平台管理面安全（云服务商）'], a:[0],

          e:'责任共担模型的核查关键是分清界面：租户侧管好自己在云上的系统、数据与账号，平台侧由云服务商负责。' },

        { t:'single', d:'s', pts:10, q:'某智慧园区物联网平台接入数千个传感器，核查其安全时，较恰当的做法是？',

          o:['先摸清设备资产清单与接入方式，再按风险分级抽查，并核查平台对设备的认证与控制','逐台人工核查每一台设备','只测平台 Web 界面','让设备厂商出具一份"安全证明"即可'], a:[0],

          e:'海量设备不可能也无需逐台测：资产摸底 + 分级抽查 + 核查集中管控点，是规模化场景下的可行方法。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】面对完全陌生的工控系统现场，恰当的职业姿态是？',

          o:['提前学习该领域知识、虚心请教现场工程师，不装懂','不懂装懂直接下结论','推给同事去做','按普通信息系统的结论直接套用'], a:[0],

          e:'跨领域测评的严谨性：先学习后结论，敢于承认"不知道"恰是专业的表现。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】测评云计算系统时，云服务商以"商业机密"为由拒绝提供其平台侧安全资料。你应？',

          o:['区分对象：租户侧照常测评；平台侧请其提供已通过测评/备案等合规证明，无法提供则如实记录核查受限','放弃整个测评项目','绕过租户强行索要平台配置','让客户随便写个说明就行'], a:[0],

          e:'跨责任主体的测评既要推进也要留痕：取不到证据就如实说明核查受限，不能默认其合规。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】工控现场工程师说"控制指令不能加密，加密会增大延迟影响生产"。你的专业处理是？',

          o:['理解工控对实时性的要求，核查其是否有隔离、边界防护等补偿性措施，再综合判定','立即要求全链路加密，否则判不符合','不懂也不追问，直接判"不适用"','同意"不用管"，跳过该项'], a:[0],

          e:'尊重行业特性不等于放弃核查：实时性要求下应检查补偿性防护是否到位，用适配的尺子量，而不是一刀切。' }

    ]};

    QUIZ_DATA['8'] = { title: '任务8 信息安全风险评估', qs: [

        { t:'single', d:'k', pts:10, q:'风险评估的三要素是？',

          o:['资产、威胁、脆弱性','防火墙、交换机、服务器','人、机、料','时间、成本、范围'], a:[0],

          e:'风险 = f(资产价值, 威胁, 脆弱性)，三者缺一不可。' },

        { t:'single', d:'k', pts:10, q:'资产 CIA 三性指？',

          o:['保密性、完整性、可用性','价格、数量、质量','CPU、内存、硬盘','创建、修改、删除'], a:[0],

          e:'CIA 是信息安全的基本属性，赋值 1~5 按"受损后的业务影响"打分。' },

        { t:'single', d:'k', pts:10, q:'信息安全风险评估依据的国家标准是？',

          o:['GB/T 20984','GB/T 22239','GB/T 28448','GB/T 22240'], a:[0],

          e:'GB/T 20984《信息安全技术 信息安全风险评估方法》是任务8的方法论来源。' },

        { t:'single', d:'s', pts:10, q:'资产等级的确定方法是？',

          o:['C、I、A 三值中取最高','三值相加除以三','取最低值','随机指定'], a:[0],

          e:'就高不就低——与等保定级 S/A 取高的思路如出一辙。' },

        { t:'single', d:'s', pts:10, q:'关键资产 + 威胁频率高 + 高危脆弱性同时存在时，风险等级应判？',

          o:['高风险','低风险','无风险','中低风险'], a:[0],

          e:'三要素都指向严重方向 → 高风险，优先处置。' },

        { t:'single', d:'s', pts:10, q:'某资产数据被篡改将导致严重后果，但对外泄露影响较小。按业务影响赋值，其 C（保密性）与 I（完整性）的取值关系应为？',

          o:['I 高于 C','C 高于 I','两者必须取值相同','取值与实际影响无关'], a:[0],

          e:'CIA 赋值要反映资产真实业务特性：重完整性的系统 I 高、C 相对低，赋值跟着业务影响走。' },

        { t:'single', d:'s', pts:10, q:'对评估出的"不可接受风险"，正确的后续处理是？',

          o:['提出处置建议（规避/降低/转移/接受），与责任方确认并跟踪闭环','只记录不跟进','一律判为可接受','把该风险项从报告里删除'], a:[0],

          e:'风险评估的落脚点是风险处置与跟踪闭环；只评估不处置，评估就失去了意义。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】风险评估报告涉及客户大量敏感数据，交付时应？',

          o:['控制知悉范围、加密传输、按保密约定交付与归档','发到公开网盘方便下载','打印后随手放在教室','发给所有同学传阅'], a:[0],

          e:'评估成果本身就是敏感资产——保密意识是本课程贯穿始终的底色。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】评估发现一项高风险源自领导特批的"快捷通道"（绕过了正常流程），如实写将涉及管理层。你应？',

          o:['如实评估并客观描述风险，不因涉及层级高而回避，处置责任交由管理层决策','顾及领导面子弱化该项','不在报告中呈现该风险','只在私下口头提醒一次'], a:[0],

          e:'风险面前没有"级别豁免"：如实呈现是评估师的本分，决策权在管理层，但呈现责任在自己。' },

        { t:'single', d:'q', pts:10, q:'【情景分析】被评估方希望你"把风险算低一点"，因为报告要用于向上级汇报成绩。你应？',

          o:['坚持按既定方法与数据计算，结果不受汇报需要影响；可解释算法但不能改结果','按对方要求调低参数','换一套更"宽松"的算法重新算','只呈现部分低风险项'], a:[0],

          e:'方法透明、结果可复算是风险评估的底线；结果被汇报压力绑架，评估就失去了公信力。' }

    ]};



    
;


    /* ================= 知识结构图数据（第一部分：1.1 / 1.2 / 2.1 / 2.2 / 任务3） ================= */

    var KM_DATA = {

    '1.1': { h: 310, nodes: {

        top:  { x:340, y:30,  label:'等保2.0核心知识', sub:'1.1 关键知识模块', info:'1.1 是"等保测评认知与标准体系"的理论起点：先弄清"什么是信息安全测评"，再理解"为什么必须做等保"，最后掌握"等保怎么落地、测评怎么开展、系统分几级"。下面 6 个模块就是本单元的关键知识内容，点击任一模块可直达对应讲解。' },

        what: { x:110, y:110, label:'信息安全测评', sub:'四问 · 四目的', info:'信息安全测评就像"给系统做安全体检"：由专业测评机构依据国家标准，对信息系统的安全状况进行检查、测试与评价，回答四个问题——系统安全吗？漏洞在哪？差距多大？怎么整改？四个目的：摸清现状、发现隐患、量化差距、指导整改。' },

        sys:  { x:340, y:110, label:'等级保护制度', sub:'分级保护 · 1.0→2.0', info:'《网络安全法》确立的网络安全等级保护制度，核心是"分等级保护、分等级监管"：不同重要程度的系统采用不同强度的防护要求，避免"一刀切"。2019 年进入"等保2.0"：保护对象从信息系统扩展到网络和信息系统（含云/移/物/工/大数据），标准体系变为"1+N"，核心理念由被动防御转向主动防御、动态防御。' },

        law:  { x:570, y:110, label:'网络安全法', sub:'第21条 · 法律依据', std:1, info:'《中华人民共和国网络安全法》第二十一条明确规定"国家实行网络安全等级保护制度"，这是等保2.0全部工作的法律基石——网络运营者必须履行安全保护义务，违者承担法律责任。点击本节点可直接打开法律原文 PDF。' },

        flow: { x:110, y:270, label:'五步走流程', sub:'定级·备案·整改·测评', info:'等保工作是一个闭环，共五步：① 定级（给系统定安全等级）→ ② 备案（到公安机关备案）→ ③ 建设整改（按等级配置防护）→ ④ 等级测评（本课程的核心环节）→ ⑤ 监督检查（形成管理闭环）。环环相扣，缺一不可。' },

        stage:{ x:340, y:270, label:'测评四阶段', sub:'准备·方案·现场·报告', info:'等级测评本身分四个阶段：① 测评准备（项目启动、收集资料）→ ② 方案编制（对应任务2）→ ③ 现场测评（对应任务3~5、7）→ ④ 报告编制（对应任务6）。本课程任务2~8 正对应这些环节。' },

        lv:   { x:570, y:270, label:'五级划分', sub:'一级~五级 · 测评周期', info:'等保2.0 把系统分为五级：一级用户自主保护（无需强制测评）、二级系统审计保护（每两年至少测评一次）、三级安全标记保护（每年至少一次，最常见的测评对象）、四级结构化保护（每半年至少一次）、五级访问验证保护（国家专控）。等级越高，要求越严、测评越频。' }

    }, edges: [

        // 以"等保2.0核心知识"为中枢，扇出到 1.1 的六个关键知识模块

        ['top','what'],['top','sys'],['top','law'],

        ['top','flow'],['top','stage'],['top','lv']

    ] },

    '1.2': { h: 490, nodes: {

        obj: { x:340, y:26,  label:'定级对象', sub:'先明确"给谁定级"', info:'定级对象是承载独立业务的信息系统（如某政务服务平台），而不是某台服务器或某个机房——先确定对象，定级才有意义。' },

        s:   { x:180, y:116, label:'S 业务信息安全', sub:'数据出事的后果', info:'S=业务信息安全保护等级：看"数据被泄露/篡改/破坏"后的受害程度。例如公民信息泄露、资金数据被篡改，S 值就高。' },

        a:   { x:500, y:116, label:'A 系统服务安全', sub:'服务中断的后果', info:'A=系统服务安全保护等级：看"服务中断或能力下降"的受害程度。例如挂号系统瘫痪、缴费业务中断，A 值就高。' },

        mx:  { x:340, y:216, label:'取高原则', sub:'max(S,A) · 就高不就低', info:'系统等级 = max(S, A)。因为短板决定整体安全水平，防护必须按更高一侧配置——这与任务8资产 CIA 赋值取高的思路一致。' },

        lv1: { x:72,  y:326, label:'一级', sub:'自主保护', info:'一般系统：用户自主保护，无强制要求，无需备案与测评。' },

        lv2: { x:206, y:326, label:'二级', sub:'指导保护', info:'一般重要系统：备案 + 每两年测评一次——大多数政企内网系统的常见起点。' },

        lv3: { x:340, y:326, label:'三级', sub:'监督保护', info:'重要系统：备案 + 每年测评 + 强制整改——本课程重点（三级系统是最常见的测评对象）。' },

        lv4: { x:474, y:326, label:'四级', sub:'强制保护', info:'关键系统：备案 + 每年测评 + 强制监管 + 应急预案；涉及国家安全、社会秩序等关键领域。' },

        lv5: { x:608, y:326, label:'五级', sub:'专控保护', info:'极关键系统：国家专控，涉及国家秘密的核心系统按对应等级执行（涉密系统另按分级保护标准执行）。' },

        ba:  { x:340, y:436, label:'定级备案', sub:'二级以上须备案', info:'二级及以上系统定级后须到公安机关办理备案手续、取得备案证明——这是后续开展等级测评的前提条件。一级系统无需备案。' }

    }, edges: [

        // 定级对象 → 两个损害维度

        ['obj','s'],['obj','a'],

        // S 与 A 共同决定系统等级（求最大）

        ['s','mx'],['a','mx'],

        // 取高原则 → 五个等级（扇出：max(S,A)落在哪一档就定哪一级）

        ['mx','lv1'],['mx','lv2'],['mx','lv3'],['mx','lv4'],['mx','lv5'],

        // 二级及以上 → 必须备案

        ['lv2','ba'],['lv3','ba'],['lv4','ba'],['lv5','ba']

    ] },

    '2.1': { h: 220, nodes: {

        plan:{ x:276, y:26,  label:'测评方案', sub:'测评工作的"施工蓝图"', info:'测评方案回答四个问题：测什么、怎么测、谁来测、何时测。方案编制好了再到现场执行，才不会乱。' },

        f1:  { x:66,  y:126, label:'测评范围', sub:'在哪测 · 测哪部分', info:'测评范围：明确被测系统的边界——物理位置、网络区域、业务范围。范围圈错，后面全错。' },

        f2:  { x:166, y:126, label:'测评对象', sub:'具体测哪些设备', info:'测评对象：范围内需要具体核查的设备与组件。选取遵循四大原则：应测尽测、关键性、代表性、抽样≥30%。' },

        f3:  { x:276, y:126, label:'测评指标', sub:'测哪些安全要求', info:'测评指标：以 GB/T 22239 相应等级要求为基础，结合对象特点裁剪——只能裁"不适用"，不能裁"难测"。' },

        f4:  { x:386, y:126, label:'测评方法', sub:'访谈 · 核查 · 测试', info:'三种基本方法：访谈（问人）、核查（看物与记录）、测试（验系统行为），三者证据互相印证。' },

        f5:  { x:496, y:126, label:'日程与人员', sub:'何时 · 何人 · 怎么分工', info:'日程与人员：现场测评、分析判定、报告编制各阶段的时间节点与人员分工，保证方案可执行、可追溯。' }

    }, edges: [['plan','f1'],['plan','f2'],['plan','f3'],['plan','f4'],['plan','f5']] },

    '2.2': { h: 240, nodes: {

        p1: { x:140, y:60,  label:'① 解读定级', sub:'读懂定级报告', info:'第一步：解读定级报告，确认系统等级与备案信息——等级决定指标基线，这是整个方案的起点。' },

        p2: { x:340, y:60,  label:'② 分析架构', sub:'拓扑 / 设备 / 数据流', info:'第二步：分析系统架构，收集拓扑图、设备清单、业务流程与数据流，弄清系统"长什么样"。' },

        p3: { x:540, y:60,  label:'③ 确定范围', sub:'位置 / 区域 / 边界', info:'第三步：结合物理位置、网络区域与业务边界，划出明确的"测与不测"分界线。' },

        p4: { x:540, y:170, label:'④ 选取对象', sub:'应测尽测 + 抽样', info:'第四步：按四大原则从范围内挑出具体核查对象，形成《测评对象清单表》。' },

        p5: { x:340, y:170, label:'⑤ 确定指标', sub:'通用要求 + 裁剪', info:'第五步：通用要求+扩展要求逐条对照，标注适用性与裁剪理由，形成《测评指标表》。' },

        p6: { x:140, y:170, label:'⑥ 日程分工', sub:'时间节点 / 人员安排', info:'第六步：编制现场作业与报告编制的日程安排、人员分工，最终形成完整方案文档。' }

    }, edges: [['p1','p2'],['p2','p3'],['p3','p4'],['p4','p5'],['p5','p6']] },

    '3.1': { h: 250, nodes: {

        top: { x:340, y:30,  label:'物理安全核查', sub:'3.1 机房"十查"', info:'物理安全是测评的第一站——按 GB/T 22239 "安全物理环境"对机房进行 10 个子类核查：物理位置选择、物理访问控制、防盗窃防破坏、防雷击、防火、防水防潮、防静电、温湿度控制、电力供应、电磁防护。' },

        ph:  { x:170, y:110, label:'机房"十查"', sub:'10 个子类逐项判定', info:'机房"十查"：以《安全物理环境测评检查表》逐项对照判定（符合/部分符合/不符合/不适用），每一项都要给出证据（照片、记录、配置）。' },

        ph1: { x:90,  y:210, label:'位置与门禁', sub:'选址 · 访问控制 · 防盗', info:'物理位置选择 + 物理访问控制 + 防盗窃防破坏——3 个子类聚焦"谁能进机房、设备安不安全"。' },

        ph2: { x:250, y:210, label:'环境与电力', sub:'防火·防水·温湿度·电力', info:'防雷击 + 防火 + 防水防潮 + 防静电 + 温湿度控制 + 电力供应 + 电磁防护——7 个子类聚焦"机房环境能不能撑住"。' }

    }, edges: [['top','ph'],['ph','ph1'],['ph','ph2']] },

    '3.2': { h: 250, nodes: {

        top: { x:340, y:30,  label:'网络架构合规', sub:'3.2 区域划分与传输', info:'通信网络是连接机房各设备的"马路"——按 GB/T 22239 "安全通信网络"核查网络架构、通信传输、可信验证三个子类。重点：三级系统要求关键设备硬件冗余、传输采用密码技术保证保密性。' },

        net: { x:170, y:110, label:'网络架构 + 传输', sub:'3 子类 · 有图有依据', info:'网络架构（区域划分、关键设备冗余）+ 通信传输（完整性、保密性、可信验证）——3 个子类。判定时必须对着拓扑图找证据。' },

        net1:{ x:90,  y:210, label:'网络架构', sub:'分区 · 冗余 · 边界', info:'网络架构：划分不同网络区域、分配地址；重要区域技术隔离；三级要求关键设备硬件冗余。判定证据看拓扑图。' },

        net2:{ x:250, y:210, label:'通信传输', sub:'校验 · 加密 · 可信验证', info:'通信传输：采用校验技术或密码技术保证数据完整性；三级要求对传输加密保证保密性；可信验证验证系统引导程序。' }

    }, edges: [['top','net'],['net','net1'],['net','net2']] }

    };

    
;


    /* ================= 知识结构图数据（第二部分：任务4 / 5 / 6 / 7 / 8） ================= */

    KM_DATA['4.1'] = { h: 250, nodes: {

        top:{ x:340, y:30,  label:'主机安全基线', sub:'4.1 服务器的"基本功"', info:'主机安全基线是等保测评中工作量最大的一类。Windows/Linux 服务器的口令策略、登录失败处理、审计日志、补丁更新、入侵防范等是核查重点——一项一台，逐台判定。' },

        ph:  { x:170, y:110, label:'主机基线核查', sub:'OS · 11 个子类', info:'以主机操作系统基线为准（如 CIS Benchmark），逐条核查：身份鉴别、访问控制、安全审计、入侵防范、恶意代码防范、可信验证、数据完整性、数据保密性、数据备份恢复、剩余信息保护、个人信息保护。' },

        ph1: { x:90,  y:210, label:'身份与访问', sub:'口令 · 权限 · 审计', info:'身份鉴别（口令复杂度、双因素）+ 访问控制（最小权限、共享账号）+ 安全审计（日志留存 ≥6 个月、防篡改）。' },

        ph2: { x:250, y:210, label:'入侵与数据', sub:'入侵防范 · 备份恢复', info:'入侵防范（补丁、HIDS）+ 恶意代码防范 + 数据完整性/保密性 + 数据备份恢复（热备/冷备/演练）。' }

    }, edges: [['top','ph'],['ph','ph1'],['ph','ph2']] };

    KM_DATA['4.2'] = { h: 250, nodes: {

        top:{ x:340, y:30,  label:'网络设备配置', sub:'4.2 路由器/交换机/防火墙', info:'网络设备配置核查覆盖路由器、交换机、防火墙——设备配置依赖手工核对、命令回显、配置文件导出。每一项配置都要有"当前在线配置"作为证据，避免被改回默认。' },

        ne:  { x:170, y:110, label:'设备配置核查', sub:'路由·交换·防火墙', info:'路由器（路由策略、SNMPv3、口令强度）+ 交换机（端口安全、VLAN 划分、ACL）+ 防火墙（最小化策略、入侵防御联动）。每一类设备都有专属核查清单。' },

        ne1: { x:90,  y:210, label:'边界防护', sub:'防火墙 · ACL · 区域隔离', info:'边界防护：防火墙策略是否最小化、ACL 是否覆盖管理口与业务口、互联网边界是否有 WAF。判定要看当前配置文件，不是听口头介绍。' },

        ne2: { x:250, y:210, label:'访问控制', sub:'SNMP · AAA · 登录失败', info:'访问控制：SNMPv3 替代 v2c、AAA 集中认证、登录失败锁定、Console/SSH 登录口令强度——避免设备本身被攻击者接管。' }

    }, edges: [['top','ne'],['ne','ne1'],['ne','ne2']] };

    KM_DATA['4.3'] = { h: 250, nodes: {

        top:{ x:340, y:30,  label:'数据库安全配置', sub:'4.3 MySQL · SQL Server · Oracle', info:'数据库是敏感数据的"金库"——核查重点：账户权限（最小化、无空口令）、口令强度、日志审计（登录日志、慢查询日志）、备份策略（热备/冷备/异地）。导出数据时严守最小必要原则。' },

        db:  { x:170, y:110, label:'数据库基线核查', sub:'账户 · 权限 · 日志', info:'账户权限（最小化、禁用过期账户）+ 口令策略（复杂度、定期更换）+ 日志审计（登录、DDL、慢查询）+ 备份与恢复（每日冷备、热冗余、定期演练）。' },

        db1: { x:90,  y:210, label:'账户与权限', sub:'最小化 · 无空口令', info:'账户权限：禁用默认账户、撤销不必要的 PUBLIC 权限、应用账户只授所需库表权限；口令复杂度+定期更换+历史密码不能重复。' },

        db2: { x:250, y:210, label:'审计与备份', sub:'日志留存 ≥6 月', info:'审计日志：登录、DDL、权限变更、慢查询必须留存 ≥6 个月；备份：每日冷备+热冗余+定期恢复演练——备份文件也要加密保存。' }

    }, edges: [['top','db'],['db','db1'],['db','db2']] };

    KM_DATA['4.4'] = { h: 250, nodes: {

        top:{ x:340, y:30,  label:'应用系统安全', sub:'4.4 身份鉴别 · 访问控制 · 会话', info:'应用系统安全功能验证：身份鉴别（密码复杂度、登录失败处理、双因素）、访问控制（按角色授权、无越权）、安全审计（关键操作日志）、会话超时（自动退出）、剩余信息保护（退出后清理临时数据）。' },

        ap:  { x:170, y:110, label:'应用功能验证', sub:'10 项安全功能', info:'身份鉴别、访问控制、安全审计、入侵防范、恶意代码防范、可信验证、数据完整性、数据保密性、数据备份恢复、剩余信息保护——10 项中身份鉴别+访问控制+会话管理是高频卡点。' },

        ap1: { x:90,  y:210, label:'登录与会话', sub:'口令 · 失败 · 超时', info:'登录：口令复杂度、登录失败锁定、可信验证、双因素认证；会话：空闲超时自动退出、并发会话限制、登录后强制修改初始密码。' },

        ap2: { x:250, y:210, label:'授权与审计', sub:'最小权限 · 操作留痕', info:'授权：按角色分配权限、无共享账号、垂直越权与水平越权测试；审计：登录、权限变更、关键操作日志完整且防篡改。' }

    }, edges: [['top','ap'],['ap','ap1'],['ap','ap2']] };

    KM_DATA['4.5'] = { h: 250, nodes: {

        top:{ x:340, y:30,  label:'漏洞扫描与结果分析', sub:'4.5 Nessus · OpenVAS · 解读', info:'漏洞扫描是发现"技术脆弱性"的高效手段——但"高危"标签不等于"真高危"。扫描前必须客户书面授权；扫描结果必须人工复测去误报；最终风险等级 = 漏洞危害 × 资产重要性。' },

        vl:  { x:170, y:110, label:'漏洞扫描流程', sub:'授权 · 扫描 · 复测 · 解读', info:'流程：① 客户书面授权（避免影响业务）→ ② 选择工具（Nessus/OpenVAS）→ ③ 全量/抽样扫描 → ④ 人工复测每个"高危" → ⑤ 出具漏洞分析表。' },

        vl1: { x:90,  y:210, label:'工具与场景', sub:'主机·Web·工控', info:'工具选择：主机/网络基线用 Nessus；Web 应用用 AWVS/Burp；工控慎用主动扫描（可能影响生产）；不同场景对应不同工具，避免一刀切。' },

        vl2: { x:250, y:210, label:'结果分析', sub:'复测 · 风险分级', info:'结果分析：每个高危必须现场复测；区分"已验证高危/中危/低危/误报"四档；结合资产 CIA 赋值算风险等级——失实的报告反噬机构信誉。' }

    }, edges: [['top','vl'],['vl','vl1'],['vl','vl2']] };

    KM_DATA['5'] = { h: 300, nodes: {

        top:{ x:276, y:26,  label:'安全管理体系', sub:'制度·机构·人员·建设·运维', info:'管理是"软件中的软件"：制度、机构、人员、建设、运维五大类。多数安全事件与"人"和"管理"有关。' },

        m1: { x:66,  y:126, label:'制度管理', sub:'文件体系 · 发布修订', info:'安全管理制度：制度体系（总体方针 + 管理制度 + 操作规程 + 记录表单）及其发布、评审、修订流程。' },

        m2: { x:166, y:126, label:'机构管理', sub:'岗位 · 授权 · 沟通', info:'安全管理机构：安全岗位设置、授权审批流程、内外部沟通合作机制。' },

        m3: { x:266, y:126, label:'人员管理', sub:'录用 · 离岗 · 培训', info:'人员安全管理：录用审查、离岗权限回收、安全教育培训、外部人员访问管控。' },

        m4: { x:366, y:126, label:'建设管理', sub:'定级备案 · 方案 · 开发', info:'安全建设管理：定级备案管理、安全方案管理、产品采购管控、开发与测试环境管理。' },

        m5: { x:466, y:126, label:'运维管理', sub:'漏洞 · 备份 · 应急', info:'安全运维管理：漏洞与补丁管理、备份恢复、应急预案与演练、安全事件处置。' },

        ev: { x:276, y:226, label:'证据链思维', sub:'文本+记录+访谈印证', info:'证据链思维：制度文本（有规定）+ 执行记录（有落实）+ 访谈佐证（有人认）三方印证，孤证不定案——这是管理测评的方法论核心。' }

    }, edges: [['top','m1'],['top','m2'],['top','m3'],['top','m4'],['top','m5'],['top','ev']] };

    KM_DATA['6'] = { h: 300, nodes: {

        top:{ x:340, y:26,  label:'从证据到报告', sub:'逐级加工 · 环环相扣', info:'现场测评产生大量记录，报告编制就是把零散证据变成一份规范、有说服力的《等保测评报告》——单项判定 → 整体结论 → 报告编制，一步错则步步错。' },

        k1: { x:88,  y:130, label:'结论生成链条', sub:'单项→单元→整体', info:'测评结论是逐级加工出来的：现场证据 → 单项判定 → 单元汇总 → 整体分析 → 风险评价 → 等级结论（优/良/中/差）。单项是原材料、单元是半成品、整体是成品。' },

        k2: { x:252, y:130, label:'单项结论判定', sub:'四种结果 · 优势证据', info:'每个测评项在每种对象上四选一：符合/部分符合/不符合/不适用；判定必须用"优势证据"法——物理安全：察看>文档>访谈；技术安全：工具>配置>访谈；管理安全：结合实际。' },

        k3: { x:428, y:130, label:'整体结论形成', sub:'符合/基本符合/不符合', info:'不只数"符合"的项数，更要看"不符合/部分符合"项的位置与权重；统计 → 看分布 → 评影响 → 下判断，结论必须与风险描述一致。' },

        k4: { x:592, y:130, label:'报告编制规范', sub:'十要素 · 整改建议', info:'测评报告十要素：封面、目录、项目概述、对象与方法、单项结论、整体结论、问题汇总、整改建议、附件、签章页；整改建议按"问题→风险→建议→优先级"来写，具体可操作。' },

        k1a:{ x:88,  y:236, label:'单元结论汇总', sub:'半成品', info:'单元结论由单项结论汇总而来：全部符合→符合；全部不符合→不符合；出现部分符合→部分符合；全部不适用→不适用。' },

        k2a:{ x:252, y:236, label:'判定四原则', sub:'威胁·拆解·证据·综合', info:'①先判断威胁是否存在 ②逐项拆解要求内容 ③使用优势证据法 ④综合判定（全一致→符合；全不一致→不符合；其余→部分符合）。' },

        k3a:{ x:428, y:236, label:'风险趋势判断', sub:'看位置与权重', info:'不只看"符合"的数量，更看"不符合/部分符合"的位置——核心指标（数据备份恢复、应急预案与事件处置等）出问题，1 项也可能直接改变整体结论。' },

        k4a:{ x:592, y:236, label:'格式与自查', sub:'字体·页码·编号', info:'正文宋体/仿宋、标题黑体；页码从正文开始编；章节编号层级清晰（1→1.1→1.1.1）；引用标准必须标注条款编号（如 8.1.4.1 a)）。' }

    }, edges: [['top','k1'],['top','k2'],['top','k3'],['top','k4'],['k1','k1a'],['k2','k2a'],['k3','k3a'],['k4','k4a']] };

    KM_DATA['7.1'] = { h: 380, nodes: {

        top:{ x:340, y:30,  label:'云计算安全测评', sub:'7.1 架构认知 + 配置核查', info:'云计算把“计算资源”变成“水电”一样按需取用的服务，但责任也随服务模式重新划分。本单元分两半：先用服务模式、责任共担、四层架构把“这朵云”认清楚，再按七个安全类的扩展要求做配置核查取证。' },

        c1: { x:110, y:130, label:'服务模式', sub:'IaaS · PaaS · SaaS', info:'IaaS 给“地基”、PaaS 给“毛坯房”、SaaS 给“精装房”——控制权 IaaS > PaaS > SaaS，用户控制权越多，承担的安全责任越大。' },

        c2: { x:340, y:130, label:'责任共担', sub:'云服务商 × 租户', info:'责任共担模型是云安全测评的“第一原则”：虚拟化层与硬件归云商，数据与访问控制永远归租户。测评前先画清责任矩阵，再决定“查平台”还是“查客户”。' },

        c3: { x:570, y:130, label:'四层架构', sub:'物理·虚拟化·管理·服务', info:'物理层（机房与服务器）→ 虚拟化层（Hypervisor 与资源池）→ 管理平台层（调度/监控/计量）→ 服务层（IaaS/PaaS/SaaS 交付）。CloudLab「平台概览与架构」页可逐层点开对照。' },

        w1: { x:560, y:203, label:'为何单列扩展', sub:'通用假设失效', info:'通用要求默认"资产在自己机房、边界清晰、责任自明"——上云后这三条全部失效：资产在云商资源池、边界是软件定义的 VPC、责任要靠共担模型划分。所以云计算要单独有一套扩展要求。' },

        k1: { x:110, y:276, label:'七个安全类', sub:'扩展要求安全类', info:'云计算扩展要求的安全类：基础设施位置、网络架构、访问控制、安全审计、集中管控、镜像与快照、数据备份恢复等——先知道“有哪些类”，才不会漏测。' },

        k2: { x:340, y:276, label:'指标适用性', sub:'查平台 还是 查客户', info:'同一安全类在不同服务模式下归属不同：虚拟化隔离、集中管控查云商；主机基线、数据安全查租户。逐条标注适用性，才能写出站得住脚的“不适用”理由。' },

        k3: { x:570, y:276, label:'七个核查项', sub:'标准条文 → CloudLab 取证', info:'把标准条文翻译成 CloudLab 的具体操作：身份鉴别看口令策略、访问控制看安全组规则、审计看“审计与告警”页、备份看快照与备份策略——每条核查项都有明确取证位置与证据形式。' }

    }, edges: [['top','c1'],['top','c2'],['top','c3'],['top','w1'],['top','k1'],['top','k2'],['top','k3']] };

    KM_DATA['7.2'] = { h: 270, nodes: {

        top:{ x:340, y:30,  label:'移动互联安全测评', sub:'7.2 架构认知 + 配置核查', info:'移动互联安全 = “端-管-云”三段全查：移动终端（APP 与本地存储）、通信管道（无线接入与传输加密）、云端（业务系统与接口）。架构画清楚了，配置核查才有取证地图。' },

        a1: { x:150, y:140, label:'是什么 · 端—管—云', sub:'三段架构', info:'端：手机/平板上的 APP 与数据；管：无线 AP/AC 与传输链路；云：业务服务器与分发平台。每段都要问“边界在哪、谁在把关、数据怎么流”。' },

        a2: { x:530, y:140, label:'为什么 · 单列扩展', sub:'边界跟着终端走', info:'移动互联扩展要求聚焦：移动终端管控、移动应用管控、无线接入控制、无线传输保密、移动应用软件采购与开发——逐条对应到端/管/云的具体位置。' },

        b1: { x:340, y:240, label:'怎么做 · 五个着力点', sub:'接入·隔离·终端·应用·审计', info:'无线接入认证（WPA2-企业级/Portal）、终端准入（注册与合规检查）、APP 安全（权限最小化、防反编译）、通信加密（HTTPS/VPN）、日志审计（接入日志与行为日志留存告警）。' }

    }, edges: [['top','a1'],['top','a2'],['a1','b1'],['a2','b1']] };

    KM_DATA['7.3'] = { h: 270, nodes: {

        top:{ x:340, y:30,  label:'物联网安全测评', sub:'7.3 架构认知 + 配置核查', info:'物联网是“万物互联”——海量感知设备物理暴露、难以逐一管理。本单元先拆解感知层/网络层/平台应用层，再用“抽样 + 平台侧取证”把测评记录表填出来。' },

        i1: { x:150, y:140, label:'是什么 · 三层架构', sub:'感知—网络—平台应用', info:'感知层：传感器/摄像头等终端（物理暴露）；网络层：无线传输与网关（协议多样）；平台应用层：设备管理平台与数据（集中风险）。每层都有专属威胁。' },

        i2: { x:530, y:140, label:'为什么 · 单列扩展', sub:'海量设备物理暴露', info:'物联网扩展要求聚焦：感知节点设备物理防护、感知网络节点设备标识、网关节点身份鉴别与数据完整性、感知节点管理远程通信接口——“设备是谁、能不能被冒充”是核心。' },

        j1: { x:340, y:240, label:'怎么做 · 取证', sub:'抽样 + 平台侧取证', info:'设备身份标识（唯一编号、防替换）；物理防护（部署环境、防拆防窃）；通信数据（传输加密、完整性校验）；平台权限（默认口令、账号清理）；固件管理（版本、漏洞与升级）。' }

    }, edges: [['top','i1'],['top','i2'],['i1','j1'],['i2','j1']] };

    KM_DATA['7.4'] = { h: 270, nodes: {

        top:{ x:340, y:30,  label:'工控安全测评', sub:'7.4 架构认知 + 配置核查', info:'工业控制系统直接操控物理生产，“可用性优先”是与 IT 最根本的差异。本单元先认识四层架构与五条关键差异，再在“先保生产”的前提下做配置核查与整改建议。' },

        g1: { x:150, y:140, label:'是什么 · 四层架构', sub:'设备—控制—监控—管理', info:'现场设备层（传感器/执行器/PLC）→ 控制层（DCS/SCADA 控制器）→ 监控层（组态监控/工程师站）→ 管理层（MES/ERP）。任一层“卡死”都会停生产。' },

        g2: { x:530, y:140, label:'为什么 · 不照搬IT', sub:'五条关键差异', info:'①可用性优先于机密性；②不能随意停机打补丁；③协议多为专用/老旧、缺认证加密；④设备生命周期 10~20 年；⑤安全的第一性是生产连续与人员安全。' },

        w1: { x:340, y:240, label:'怎么做 · 核查', sub:'六着力点 + 双层整改', info:'生产网与管理网隔离（网闸/防火墙）；账号与权限（默认口令清理）；通信保护（工业协议加密网关）；设备加固（白名单替代杀软）；监控应急（产量异常联动告警）；运维变更（补丁先测试区验证）。' }

    }, edges: [['top','g1'],['top','g2'],['g1','w1'],['g2','w1']] };

    KM_DATA['8'] = { h: 320, nodes: {

        top:{ x:276, y:26,  label:'风险评估', sub:'GB/T 20984', info:'风险评估回答"风险有多大"：依据 GB/T 20984，从资产、威胁、脆弱性三要素出发量化风险。' },

        a1: { x:66,  y:126, label:'资产识别', sub:'CIA 赋值 · 取高', info:'资产识别与 CIA 赋值：按"受损后的业务影响"为 C/I/A 打 1~5 分，资产等级取三者最高——与等保定级"取高"思路一致。' },

        t1: { x:206, y:126, label:'威胁识别', sub:'威胁源 · 频率', info:'威胁识别：分析谁可能搞破坏（病毒、黑客、内部人员、自然灾害）及其出现频率，并赋值。' },

        v1: { x:346, y:126, label:'脆弱性识别', sub:'漏洞 + 核查', info:'脆弱性识别：系统哪里弱——直接复用任务4的漏洞扫描报告与核查记录，这正是"以测促评"的体现。' },

        rc: { x:486, y:126, label:'风险计算', sub:'矩阵法 / 相乘法', info:'风险计算：用矩阵法或相乘法综合三要素，得出每个风险的风险值——前一步的表就是后一步的输入。' },

        rl: { x:276, y:236, label:'风险等级', sub:'高 / 中 / 低', info:'风险等级：按风险值划分高/中/低，高风险优先处置。' },

        rd: { x:486, y:236, label:'风险处置', sub:'降低 / 转移 / 接受', info:'风险处置策略：降低风险（整改加固）、转移风险（保险/外包）、接受风险（在可接受范围内），按等级选择。' }

    }, edges: [['top','a1'],['top','t1'],['top','v1'],['top','rc'],['a1','rc'],['t1','rc'],['v1','rc'],['rc','rl'],['rl','rd']] };

    
;


    /* ================= 知识结构图渲染 + 弹窗逻辑 ================= */

    (function () {

        var NW = 128, NH = 52; // 普通节点宽高

        var SW = 134, SH = 58; // 标准节点宽高（显示完整标准名）

        function isStdNode(n) { return !!(n && (n.std || /^GB\/T\s*\d+/.test(n.label || ''))); }

        function esc(s) { return String(s); }

        function renderKM() {

            document.querySelectorAll('.km-box').forEach(function (box) {

                var key = box.getAttribute('data-km');

                var d = KM_DATA[key];

                if (!d) { box.style.display = 'none'; return; }

                var W = 680, H = d.h;

                var svg = '<svg class="km-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';

                // 连线（先画在节点下层）

                d.edges.forEach(function (e) {

                    var f = d.nodes[e[0]], t = d.nodes[e[1]];

                    if (!f || !t) return;

                    var x1 = Math.max(20, Math.min(W - 20, f.x));

                    var y1 = f.y + (isStdNode(f) ? SH : NH) / 2, x2 = Math.max(20, Math.min(W - 20, t.x)), y2 = t.y - (isStdNode(t) ? SH : NH) / 2;

                    if (Math.abs(x1 - x2) < 6) { // 竖直线

                        svg += '<line class="km-edge" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';

                    } else { // 三段折线

                        var my = (y1 + y2) / 2;

                        svg += '<polyline class="km-edge" fill="none" points="' + x1 + ',' + y1 + ' ' + x1 + ',' + my + ' ' + x2 + ',' + my + ' ' + x2 + ',' + y2 + '"></polyline>';

                    }

                });

                // 节点（GB/T 开头的标准节点加 km-std 类，显示完整标准名，点击直接打开标准原文）

                Object.keys(d.nodes).forEach(function (id) {

                    var n = d.nodes[id];

                    var std = isStdNode(n);

                    var w = std ? SW : NW, hh = std ? SH : NH;

                    var x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, n.x)); // 防越界

                    var cls = std ? 'km-node km-std' : 'km-node';

                    svg += '<g class="' + cls + '" data-km-key="' + key + '" data-km-id="' + id + '">' +

                        '<rect x="' + (x - w / 2) + '" y="' + (n.y - hh / 2) + '" width="' + w + '" height="' + hh + '" rx="8"></rect>';

                    if (std && n.full) { // 标准节点：标准号 + 全称两行

                        var ls = String(n.full).split('|');

                        svg += '<text x="' + x + '" y="' + (n.y - 14) + '" text-anchor="middle" font-size="11">' + esc(n.label) + '</text>' +

                            '<text class="km-full" x="' + x + '" y="' + (n.y + 2) + '" text-anchor="middle" font-size="10">' + esc(ls[0] || '') + '</text>' +

                            '<text class="km-full" x="' + x + '" y="' + (n.y + 16) + '" text-anchor="middle" font-size="10">' + esc(ls[1] || '') + '</text>';

                    } else {

                        svg += '<text x="' + x + '" y="' + (n.y - 2) + '" text-anchor="middle">' + esc(n.label) + '</text>' +

                            '<text class="km-sub" x="' + x + '" y="' + (n.y + 14) + '" text-anchor="middle">' + esc(n.sub) + '</text>';

                    }

                    svg += '</g>';

                });

                svg += '</svg>';

                box.innerHTML = '<div class="km-title">🗺️ 知识模块结构</div>' +

                    '<div class="km-note">点击模块直达对应内容；金色虚线标准节点显示完整标准名，点击直接打开原文 PDF</div>' + svg;

            });

        }

        renderKM();



        // 弹窗

        var pop = document.getElementById('kmPopupOverlay');

        function openPop(key, id) {

            var d = KM_DATA[key];

            if (!d || !d.nodes[id]) return;

            var n = d.nodes[id];

            var unitNames = { '1.1':'单元 1.1','1.2':'单元 1.2','2.1':'单元 2.1','2.2':'单元 2.2','3':'任务3','4':'任务4','5':'任务5','6':'任务6','7':'任务7','7.1':'单元 7.1','7.2':'单元 7.2','7.3':'单元 7.3','7.4':'单元 7.4','8':'任务8' };

            document.getElementById('kmPopTitle').textContent = n.label;

            document.getElementById('kmPopTag').textContent = (unitNames[key] || key) + ' · 知识结构';

            document.getElementById('kmPopBody').innerHTML = '<p>' + n.info + '</p>';

            pop.classList.add('open');

        }

        document.addEventListener('click', function (e) {

            var node = e.target.closest ? e.target.closest('.km-node') : null;

            if (node) {

                // 优先走知识模块中枢：标准节点开原文、模块节点直达内容；其余弹讲解窗

                if (window.kmNodeAction && window.kmNodeAction(node.getAttribute('data-km-key'), node.getAttribute('data-km-id'))) return;

                openPop(node.getAttribute('data-km-key'), node.getAttribute('data-km-id'));

                return;

            }

            if (e.target === pop || e.target.id === 'kmPopClose') pop.classList.remove('open');

        });

        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pop.classList.remove('open'); });

    })();

    
;


    /* ================= 单元测评系统 ================= */

    (function () {

        var DIM_NAME = { k: '知识', s: '实验', q: '素养' };

        var PASS_KEY = 'isec_quiz_pass_';

        var UNIT_ORDER = ['1.1', '1.2', '2.1', '2.2', '3', '4', '5', '6', '7', '8'];

        var _progReady = false;   // 账号进度（含云端合并）是否已就绪

        var overlay = document.getElementById('quizOverlay');

        var quizBody = document.getElementById('quizBody');

        var curUnit = null, sel = {}; // sel[题号] = [选项索引]



        /* ---------- 单元测评状态（串行解锁） ---------- */

        function unitTitle(u) { var d = QUIZ_DATA[u]; return d ? d.title : u; }

        function passState(u) {

            if (typeof isQuizPassed === 'function') { try { return !!isQuizPassed(u); } catch (e) { /* 降级 */ } }

            try { return localStorage.getItem(PASS_KEY + u) === '1'; } catch (e2) { return false; }

        }

        /* 当前单元所有前置单元均已满分通过？ */

        function allPrevPassed(u) {

            var idx = UNIT_ORDER.indexOf(u);

            if (idx <= 0) return true;

            for (var i = 0; i < idx; i++) if (!passState(UNIT_ORDER[i])) return false;

            return true;

        }

        /* 返回拦截本单元的最近一个未通过前置单元（null = 未锁定） */

        function lockedByUnit(u) {

            var idx = UNIT_ORDER.indexOf(u);

            if (idx <= 0) return null;

            for (var i = 0; i < idx; i++) {

                var pre = UNIT_ORDER[i];

                if (!passState(pre)) return pre;

            }

            return null;

        }



        // ----- 按钮状态刷新（通过 / 锁定 / 可测） -----

        function refreshQuizBtns() {

            document.querySelectorAll('.quiz-btn').forEach(function (btn) {

                var u = btn.getAttribute('data-quiz');

                if (!u) return;

                btn.classList.remove('passed', 'locked');

                if (passState(u)) {

                    btn.classList.add('passed');

                    btn.textContent = '✅ 已通过 · 可复习';

                    btn.title = '本单元已满分通过，可随时复习或重测（不影响已解锁状态）';

                } else {

                    var lb = lockedByUnit(u);

                    if (lb) {

                        btn.classList.add('locked');

                        btn.textContent = '🔒 待前置通过后解锁';

                        btn.title = '请先通过【' + unitTitle(lb) + '】的单元测评（满分 100 分）';

                    } else {

                        btn.textContent = '📝 单元测评';

                        btn.title = '开始本单元测评（共 10 题，满分 100 分通过）';

                    }

                }

            });

            refreshStageMarks();

        }



        // ----- 顶部时间线任务点打勾：该任务全部子单元满分通过即标记 ✔ -----

        var STAGE_UNITS = { 1: ['1.1', '1.2'], 2: ['2.1', '2.2'], 3: ['3'], 4: ['4'], 5: ['5'], 6: ['6'], 7: ['7'], 8: ['8'] };

        function refreshStageMarks() {

            document.querySelectorAll('.timeline-item[data-stage]').forEach(function (item) {

                var s = parseInt(item.getAttribute('data-stage'), 10);

                var units = STAGE_UNITS[s] || [];

                var ok = units.length > 0 && units.every(function (u) { return passState(u); });

                item.classList.toggle('is-passed', ok);

            });

        }



        // ----- 初始化进度：先按本地立即渲染，再等云端/本地合并后二次刷新 -----

        function initQuizProgress() {

            refreshQuizBtns();

            if (typeof loadProgress !== 'function') { _progReady = true; return; }

            loadProgress(true).then(function (p) {

                _progReady = true;

                migrateLegacyPass(p);

                refreshQuizBtns();

            }).catch(function () { _progReady = true; refreshQuizBtns(); });

        }

        /* 一次性迁移：把整改前遗留的 isec_quiz_pass_* 旧标记写入账号进度（云端为主） */

        function migrateLegacyPass(p) {

            if (!p || typeof saveProgress !== 'function') return;

            var changed = false;

            UNIT_ORDER.forEach(function (u) {

                var rec = p.quizPass && p.quizPass[u];

                if (rec && rec.pass) return;

                var legacy = false;

                try { legacy = localStorage.getItem(PASS_KEY + u) === '1'; } catch (e) { /* noop */ }

                if (legacy) {

                    if (!p.quizPass) p.quizPass = {};

                    p.quizPass[u] = { ts: Date.now(), pass: true, score: 100 };

                    changed = true;

                }

            });

            if (changed) { try { saveProgress(p); } catch (e) { /* noop */ } }

        }

        refreshQuizBtns();



        // ----- 打开测评（含锁定拦截；已通过单元进入复习/重测） -----

        document.addEventListener('click', function (e) {

            var btn = e.target.closest ? e.target.closest('.quiz-btn') : null;

            if (!btn) return;

            var u = btn.getAttribute('data-quiz');

            if (!u) return;

            if (passState(u)) { openQuiz(u); return; }           // 已通过 → 允许复习/重测

            var lb = lockedByUnit(u);

            if (lb) {

                alert('🔒 该单元测评尚未解锁。\n请先通过【' + unitTitle(lb) + '】的单元测评（满分 100 分），即可开启本单元测评。');

                return;

            }

            openQuiz(u);

        });

        function openQuiz(u) {

            if (!allPrevPassed(u)) {

                var lb = lockedByUnit(u);

                if (lb) { alert('🔒 该单元测评尚未解锁。\n请先通过【' + unitTitle(lb) + '】的单元测评（满分 100 分）。'); return; }

            }

            curUnit = u; sel = {};

            var d = QUIZ_DATA[u];

            var review = passState(u);

            document.getElementById('quizTitle').textContent = d.title;

            document.getElementById('quizSub').textContent =

                (review ? '🧪 复习模式（本单元已通过，成绩不影响解锁状态） · ' : '') +

                '共 ' + d.qs.length + ' 题 · 知识 / 实验 / 素养 三维考查 · 满分 100 分方可通过';

            renderQuestions(false);

            overlay.classList.add('open');

            overlay.scrollTop = 0;

            if (typeof trackOperation === 'function') trackOperation(review ? '复习单元测评' : '开始单元测评', d.title);

        }

        document.getElementById('quizCloseBtn').addEventListener('click', function () { overlay.classList.remove('open'); });

        initQuizProgress();



        // ----- 题目渲染 -----

        function renderQuestions(review) {

            var d = QUIZ_DATA[curUnit];

            var h = '';

            d.qs.forEach(function (q, qi) {

                h += '<div class="q-card"><div class="q-head">' +

                    '<span class="q-badge ' + (q.t === 'single' ? 'q-single' : 'q-multi') + '">' + (q.t === 'single' ? '单选' : '多选') + '</span>' +

                    '<span class="q-dim q-dim-' + q.d + '">' + DIM_NAME[q.d] + '维度</span>' +

                    '<span class="q-pts">' + q.pts + ' 分</span></div>' +

                    '<div class="q-text">' + (qi + 1) + '. ' + q.q + '</div>';

                q.o.forEach(function (opt, oi) {

                    var cls = 'q-opt';

                    if (review) {

                        var picked = (sel[qi] || []).indexOf(oi) >= 0;

                        if (q.a.indexOf(oi) >= 0) cls += ' correct';

                        else if (picked) cls += ' wrong';

                    } else {

                        if ((sel[qi] || []).indexOf(oi) >= 0) cls += ' selected';

                    }

                    h += '<div class="' + cls + '" data-q="' + qi + '" data-o="' + oi + '">' + String.fromCharCode(65 + oi) + '. ' + opt + '</div>';

                });

                if (review) {

                    var ok = arraysEqual(sel[qi] || [], q.a);

                    h += '<span class="q-ans-state" style="color:' + (ok ? '#2e7d32' : '#c0392b') + '">' + (ok ? '✔ 答对了' : '✘ 答错了') + '</span>' +

                         '<div class="q-exp"><strong>解析：</strong>' + q.e + '</div>';

                }

                h += '</div>';

            });

            if (!review) {

                h += '<div class="quiz-actions"><button class="quiz-submit" id="quizSubmitBtn">提交答卷</button></div>' +

                     '<div class="quiz-hint" id="quizHint" style="display:none">还有题目未作答，请完成所有题目后提交</div>';

            }

            quizBody.innerHTML = h;

        }

        function arraysEqual(a, b) {

            if (a.length !== b.length) return false;

            var s = a.slice().sort(), t = b.slice().sort();

            for (var i = 0; i < s.length; i++) if (s[i] !== t[i]) return false;

            return true;

        }



        // ----- 答题（事件委托） -----

        quizBody.addEventListener('click', function (e) {

            var opt = e.target.closest ? e.target.closest('.q-opt') : null;

            if (opt) {

                var qi = +opt.getAttribute('data-q'), oi = +opt.getAttribute('data-o');

                var d = QUIZ_DATA[curUnit], q = d.qs[qi];

                if (!sel[qi]) sel[qi] = [];

                if (q.t === 'single') { sel[qi] = [oi]; renderQuestions(false); }

                else {

                    var idx = sel[qi].indexOf(oi);

                    if (idx >= 0) sel[qi].splice(idx, 1); else sel[qi].push(oi);

                    renderQuestions(false);

                }

                return;

            }

            if (e.target.id === 'quizSubmitBtn') submitQuiz();

            if (e.target.id === 'quizRetakeBtn') { sel = {}; renderQuestions(false); overlay.scrollTop = 0; }

            if (e.target.id === 'quizDoneBtn') overlay.classList.remove('open');

        });



        // ----- 判分 -----

        function submitQuiz() {

            var d = QUIZ_DATA[curUnit];

            for (var i = 0; i < d.qs.length; i++) {

                if (!sel[i] || sel[i].length === 0) {

                    document.getElementById('quizHint').style.display = 'block';

                    return;

                }

            }

            var total = 0, dim = { k: [0, 0], s: [0, 0], q: [0, 0] }; // [得分, 满分]

            var wrongIdx = [];

            d.qs.forEach(function (q, qi) {

                dim[q.d][1] += q.pts;

                if (arraysEqual(sel[qi], q.a)) { total += q.pts; dim[q.d][0] += q.pts; }

                else wrongIdx.push(qi);

            });

            var isReview = passState(curUnit);   // 提交前本单元是否已通过（复习/重测）

            var passed = total === 100;

            if (passed) {

                // 兼容旧标记 + 写入账号进度（本地即时、云端异步同步）

                try { localStorage.setItem(PASS_KEY + curUnit, '1'); } catch (e) { /* noop */ }

                if (typeof saveProgress === 'function') {

                    try {

                        saveProgress(function (p) {

                            if (!p.quizPass) p.quizPass = {};

                            p.quizPass[curUnit] = { ts: Date.now(), pass: true, score: total };

                            return p;

                        });

                    } catch (e) { /* noop */ }

                }

                refreshQuizBtns();

            }



            var k = Math.round(dim.k[0] / dim.k[1] * 100),

                s = Math.round(dim.s[0] / dim.s[1] * 100),

                qz = Math.round(dim.q[0] / dim.q[1] * 100);



            var h = '<div class="quiz-score-wrap"><div class="quiz-score ' + (passed ? 'pass' : 'fail') + '">' + total + '</div>' +

                '<div class="quiz-score-label">综合得分（满分 100' + (passed ? ' · 已通过' : '）· 未达 100 分，需重新测评') + '</div></div>' +

                '<div class="quiz-result-grid"><div class="radar-box">' + radarSVG(k, s, qz) +

                '<div class="quiz-score-label" style="margin-top:8px">知识 · 实验 · 素养 三维能力雷达</div></div>' +

                '<div class="quiz-summary"><h3>🧠 智能测评总结</h3>' + genSummary(total, k, s, qz, wrongIdx.length) + '</div></div>';



            if (passed) {

                var nxt = UNIT_ORDER[UNIT_ORDER.indexOf(curUnit) + 1];

                var unlockTxt = nxt

                    ? '下一单元【' + unitTitle(nxt) + '】测评已解锁，可以继续学习。'

                    : '全部单元测评均已通过，祝贺你完成整个测评之旅！';

                h += '<div class="quiz-pass-note">🎉 恭喜！满分通过本单元测评。知识、实验与素养三维度全部达标，' + unlockTxt + '</div>' +

                     '<div class="quiz-actions"><button class="quiz-submit" id="quizDoneBtn">完成，返回学习</button></div>';

            } else if (isReview) {

                h += '<div class="quiz-retake-note">📌 本次复习得分 ' + total + ' 分（未满分）。本单元此前已通过，解锁状态不受影响，可继续复习或重测。</div>' +

                     '<div class="quiz-actions"><button class="quiz-submit" id="quizRetakeBtn">🔄 重新测评</button>' +

                     '<button class="quiz-submit" id="quizDoneBtn" style="background:#78909c;">完成，返回学习</button></div>';

            } else {

                h += '<div class="quiz-retake-note">📌 未达到 100 分，需要重新测评。请先根据下方错题解析复习，再点击"重新测评"。</div>' +

                     '<div class="quiz-actions"><button class="quiz-submit" id="quizRetakeBtn">🔄 重新测评</button></div>';

            }

            if (wrongIdx.length > 0) h += '<h4 class="quiz-wrong-title">📋 错题回顾与解析（答错 ' + wrongIdx.length + ' 题）</h4>';

            quizBody.innerHTML = h;

            // 附带全部题目（含正误着色与解析）

            renderReviewAppend();

            overlay.scrollTop = 0;

            if (typeof trackOperation === 'function') trackOperation(passed ? '单元测评通过' : '单元测评未通过', d.title + ' 得分 ' + total);

        }

        function renderReviewAppend() {

            var frag = document.createElement('div');

            var d = QUIZ_DATA[curUnit];

            var h = '';

            d.qs.forEach(function (q, qi) {

                h += '<div class="q-card"><div class="q-head">' +

                    '<span class="q-badge ' + (q.t === 'single' ? 'q-single' : 'q-multi') + '">' + (q.t === 'single' ? '单选' : '多选') + '</span>' +

                    '<span class="q-dim q-dim-' + q.d + '">' + DIM_NAME[q.d] + '维度</span>' +

                    '<span class="q-pts">' + q.pts + ' 分</span></div>' +

                    '<div class="q-text">' + (qi + 1) + '. ' + q.q + '</div>';

                q.o.forEach(function (opt, oi) {

                    var cls = 'q-opt';

                    var picked = (sel[qi] || []).indexOf(oi) >= 0;

                    if (q.a.indexOf(oi) >= 0) cls += ' correct';

                    else if (picked) cls += ' wrong';

                    h += '<div class="' + cls + '">' + String.fromCharCode(65 + oi) + '. ' + opt + '</div>';

                });

                var ok = arraysEqual(sel[qi] || [], q.a);

                h += '<span class="q-ans-state" style="color:' + (ok ? '#2e7d32' : '#c0392b') + '">' + (ok ? '✔ 答对了' : '✘ 答错了') + '</span>' +

                     '<div class="q-exp"><strong>解析：</strong>' + q.e + '</div></div>';

            });

            frag.innerHTML = h;

            quizBody.appendChild(frag);

        }



        // ----- 雷达图（SVG） -----

        function radarSVG(k, s, qz) {

            var cx = 150, cy = 138, R = 96;

            var angs = [-90, 30, 150].map(function (d) { return d * Math.PI / 180; });

            function pt(f, i) { return (cx + R * f * Math.cos(angs[i])).toFixed(1) + ',' + (cy + R * f * Math.sin(angs[i])).toFixed(1); }

            var vals = [k / 100, s / 100, qz / 100];

            var labels = ['知识', '实验', '素养'], scores = [k, s, qz];

            var svg = '<svg width="300" height="268" viewBox="0 0 300 268" xmlns="http://www.w3.org/2000/svg">';

            [0.25, 0.5, 0.75, 1].forEach(function (f) {

                svg += '<polygon points="' + pt(f, 0) + ' ' + pt(f, 1) + ' ' + pt(f, 2) + '" fill="none" stroke="#d8ccf0" stroke-width="1"></polygon>';

            });

            angs.forEach(function (a, i) {

                var ex = cx + (R + 14) * Math.cos(a), ey = cy + (R + 14) * Math.sin(a);

                svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(1, i).split(',')[0] + '" y2="' + pt(1, i).split(',')[1] + '" stroke="#d8ccf0" stroke-width="1"></line>';

                svg += '<text x="' + (cx + (R + 34) * Math.cos(a)) + '" y="' + (ey + 4) + '" text-anchor="middle" font-size="12.5" font-weight="700" fill="#4527a0">' + labels[i] + ' ' + scores[i] + '</text>';

            });

            svg += '<polygon points="' + pt(vals[0], 0) + ' ' + pt(vals[1], 1) + ' ' + pt(vals[2], 2) + '" fill="rgba(123,31,162,0.28)" stroke="#7b1fa2" stroke-width="2"></polygon>';

            vals.forEach(function (v, i) {

                var p = pt(v, i).split(',');

                svg += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="#7b1fa2"></circle>';

            });

            svg += '</svg>';

            return svg;

        }



        // ----- 总结生成 -----

        function genSummary(total, k, s, qz, wrongN) {

            var p = '';

            if (total === 100) p += '<p>🎉 <strong>满分达成！</strong>本单元的知识、实验与素养三个维度全部达标，说明你既能"记得住"，也能"做得出"，还"站得正"。</p>';

            else p += '<p>本次得分 <strong>' + total + '</strong> 分（答错 ' + wrongN + ' 题）。距离 100 分通过还差 ' + (100 - total) + ' 分——请针对薄弱维度复习后重新测评。</p>';

            p += '<p><strong>📖 知识维度（' + k + ' 分）：</strong>' + (k === 100 ? '基本概念与标准体系掌握扎实，继续保持。' : (k >= 70 ? '大部分概念已掌握，但仍有细节遗漏，建议回到"知识"页重看相关概念框。' : '概念性错误较多，建议从头梳理本单元知识结构，再重新作答。')) + '</p>';

            p += '<p><strong>🛠️ 实验维度（' + s + ' 分）：</strong>' + (s === 100 ? '操作与分析类判断全部正确，方法运用得当。' : (s >= 70 ? '实操方法基本掌握，个别场景的处置流程还需巩固，建议重做"实验"页对应步骤。' : '操作层面的判断偏差较大，建议对照实验步骤重新演练关键场景。')) + '</p>';

            p += '<p><strong>🌱 素养维度（' + qz + ' 分）：</strong>' + (qz === 100 ? '情景判断全部正确，已具备测评从业者的职业操守与责任意识。' : '情景分析出现偏差——建议重温本单元"情景分析"案例，体会其中的职业判断与责任意识。') + '</p>';

            return p;

        }

    })();

    
;


    (function () {

        // ★ 唯一需要修改的配置：在腾讯元器发布新智能体后，

        //   把下面的链接替换为元器「发布 → 网页/WebIM」给出的新链接即可

        var YUANQI_CHAT_URL = "https://yuanqi.tencent.com/webim/#/chat/PzdKHW?appid=2097199783704980544&experience=true";



        var trigger = document.getElementById('db-assistant-trigger');

        var panel = document.getElementById('db-assistant-panel');

        var iframe = document.getElementById('db-assistant-iframe');

        var closeBtn = document.getElementById('db-assistant-close');

        var popoutBtn = document.getElementById('db-assistant-popout');

        var loaded = false;



        function openPanel() {

            if (!loaded) { iframe.src = YUANQI_CHAT_URL; loaded = true; } // 懒加载：首次打开才加载，不影响首屏速度

            panel.classList.add('open');

            trigger.setAttribute('aria-expanded', 'true');

            var tip = trigger.querySelector('.db-assistant-tip');

            if (tip) tip.classList.remove('show');

        }

        function closePanel() {

            panel.classList.remove('open');

            trigger.setAttribute('aria-expanded', 'false');

        }

        function togglePanel() { panel.classList.contains('open') ? closePanel() : openPanel(); }



        trigger.addEventListener('click', togglePanel);

        closeBtn.addEventListener('click', closePanel);

        if (popoutBtn) {

            popoutBtn.addEventListener('click', function () {

                window.open(YUANQI_CHAT_URL, 'yuanqi-assistant', 'noopener,noreferrer');

            });

        }

        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });



        // 顶部"智能助教（所有任务通用）"链接：点击时改为打开悬浮窗（JS 失效时仍保留外链跳转兜底）

        var headerLink = document.querySelector('a.info-link[href*="yuanqi.tencent.com"]');

        if (headerLink) {

            headerLink.addEventListener('click', function (e) {

                e.preventDefault();

                openPanel();

            });

        }



        // 首次访问 5 秒后轻微提示一次，引导学生发现新入口

        setTimeout(function () {

            if (!panel.classList.contains('open')) {

                var tip = trigger.querySelector('.db-assistant-tip');

                if (tip) {

                    tip.classList.add('show');

                    setTimeout(function () { tip.classList.remove('show'); }, 4000);

                }

            }

        }, 5000);

    })();

    
;


    function rbCaseToggle(btn) {

        var box = document.getElementById('rbCase42');

        if (!box) { return; }

        var folded = box.classList.toggle('is-folded');

        btn.textContent = folded ? '展开 ▾' : '折叠 ▴';

        btn.setAttribute('aria-expanded', folded ? 'false' : 'true');

        if (typeof trackOperation === 'function') {

            trackOperation(folded ? '折叠测评记录表案例' : '展开测评记录表案例', '4.2 网络设备配置核查');

        }

    }

    
;

/* ==================== 5.2 模拟人员访谈 · 对话智能体（纯前端，无需联网） ====================
   设计说明：
   - 三位被访谈人的人设与"实际执行情况"完全取自《5.2 模拟人员访谈》PPT 的角色卡（张三 / 李四 / 王五）。
   - 交互：学生选角色 → 自己输入问题 → 智能体按角色特点自动应答。
   - 教学机制：每个话题"第一次问"回答的是制度口径（写没写），"追问第二次"才吐出真实执行情况（做没做）
     ——对应 PPT 里"访谈是验证真实性的关键手段"。
   ================================================================================== */
(function () {
    'use strict';

    var ROLES = {
        sysadmin: {
            name: '系统管理员 · 张三',
            short: '张三',
            post: '系统管理员（负责 3 台服务器、2 个数据库的日常运维）',
            hello: '（抬头）您好，我是张三，服务器和数据库这块平时都是我在管。您问吧，我尽量答。',
            topics: [
                { kws: ['岗位职责', '职责', '负责什么', '负责哪些', '做什么工作', '工作内容', '管什么'],
                  off: '我主要负责 3 台服务器和 2 个数据库的日常运维——装系统、配权限、做备份、盯着服务别出问题。',
                  tru: '（笑了笑）说是"主要"，其实服务器、数据库、网络、还有办公电脑出毛病都找我一个人，人手就我一个，实在忙不过来。' },
                { kws: ['密码策略', '密码', '口令', '多久换', '更换周期', '复杂度'],
                  off: '密码是按规定来的：长度、复杂度都有要求，90 天更换一次，这个制度文件里都写着。',
                  tru: '（压低声音）说实话，太忙了，基本想不起来换。有几台机器还是出厂默认口令，测试库那个口令就是 123456——您别记太细啊。' },
                { kws: ['账户', '账号', '用户', '权限分配', '离职', '离岗', '清理'],
                  off: '账户按申请流程开：谁需要谁提申请，我这边建账号、分权限，都留了台账。',
                  tru: '（犹豫了一下）离职的……嗯，有 3 个离职员工的账号还在系统里，一直没顾上清。人都走了，我想着不影响使用就先留着了。' },
                { kws: ['日志', '审计', '记录', '有没有人看', '谁看'],
                  off: '审计日志是开启的，系统里的操作都有记录，这个是按要求做的。',
                  tru: '（摆摆手）开着是开着，但真没人看。日志文件一直涨，几个月没人翻过，出了事才想起来查一查。' },
                { kws: ['补丁', '更新', '升级', '打补丁', '漏洞修补'],
                  off: '补丁有更新流程：先测试环境验证，再上生产环境。',
                  tru: '（压低声音）流程是那么写的。实际上怕出问题，能不更新就不更新——有几台机器快一年没打过补丁了，等厂家催或者真出事再说。' },
                { kws: ['备份', '恢复', '还原', '演练'],
                  off: '备份是做的：数据库每天有备份任务，服务器也有镜像。',
                  tru: '（停顿）备份确实有，但恢复没试过。真出事能不能还原……说实话我心里没底，没演练过。' },
                { kws: ['安全事件', '应急', '处置', '出事', '被攻击', '中招', '上报'],
                  off: '出了安全事件先报告领导，然后按应急预案处理。',
                  tru: '（挠头）应急预案我知道有这么个文件，具体条款真没细看过。真出事我大概就是先看日志、先断网，再给主管打电话——差不多是这样。' },
                { kws: ['培训', '学习', '考核'],
                  off: '安全培训我参加过，公司统一组织的。',
                  tru: '（想了想）今年就一次，听完就散了，也没考试。讲得比较宏观，具体到我们怎么操作的内容不多。' }
            ],
            chips: ['请先简单介绍一下您的岗位职责？', '密码策略是怎么规定的？多久换一次？', '账户是怎么管理的？离职人员的账号会清理吗？', '系统日志有人看吗？', '补丁一般多久更新一次？', '系统出了安全事件，您会怎么处理？'],
            fb: '（挠头）您问的这个……我这边不太清楚，可能得问我们主管。设备、账号、补丁、备份这些事是我在管，您可以问这些。'
        },
        secmgr: {
            name: '安全主管 · 李四',
            short: '李四',
            post: '安全主管（负责制定安全管理制度、组织安全培训）',
            hello: '您好您好，我是李四，安全和制度这块是我在抓。您有什么问题尽管问，我们还是很重视安全的。',
            topics: [
                { kws: ['岗位职责', '职责', '负责什么', '负责哪些', '做什么工作', '工作内容', '组织架构', '机构'],
                  off: '我负责制定安全管理制度、组织安全培训，还有日常安全工作的协调。组织架构上我们是有一个安全管理小组的。',
                  tru: '（顿了顿）小组是挂了名的，但专职的安全人员就我一个，其他都是各部门兼职挂着。制度、培训、预案、风险评估，全压在我这儿。' },
                { kws: ['制度', '安全策略', '发布', '审批', '已制定'],
                  off: '制度我们早就制定了，一整套都齐了，安全策略、管理办法都有。',
                  tru: '（降低声音）制度写是写了，但审批流程还没走完，到现在没正式发文。所以严格说，现在是"有稿子、没生效"。' },
                { kws: ['培训', '教育', '考核', '演练培训'],
                  off: '培训我们很重视，每年都会安排，覆盖全员。',
                  tru: '（苦笑）今年就组织了一次全员培训，走个过场，签到完就结束，也没做考核。说实话效果有限。' },
                { kws: ['应急预案', '预案', '演练', '应急响应'],
                  off: '应急预案已经编制完成，也报备了。',
                  tru: '（停顿）预案是编好了，但从来没演练过。真出事能不能按预案跑起来，我们自己也没底。' },
                { kws: ['风险评估', '风险', '定期评估', '自查'],
                  off: '风险评估是定期开展的，按规定周期来。',
                  tru: '（压低声音）这个……没定期做。主要是没人懂怎么做风险评估，工具、方法都不熟，就一直拖着。' },
                { kws: ['第三方', '外包', '供应商', '访问流程', '保密协议'],
                  off: '第三方人员进来要走审批、签保密协议，我们是有流程的。',
                  tru: '（想了想）流程有，但执行得比较松——有的运维是直接远程连进来干活，权限给得比较宽，离场也没专门清理。' },
                { kws: ['密码', '口令', '多久换', '密码策略'],
                  off: '密码策略在制度里有明确规定：复杂度、更换周期都写了，90 天一次。',
                  tru: '（摇头）制度规定 90 天，实际执行嘛……上次内部检查就发现有人一年没换。这个是执行层面的事，得盯着才行。' },
                { kws: ['日志', '审计', '审查', '检查记录'],
                  off: '安全审计工作我们是有安排的，日志定期审查。',
                  tru: '（摆手）说是定期，其实主要靠系统管理员自己看。我这边没有审查记录，检查的时候也拿不出签字的东西。' }
            ],
            chips: ['贵单位的安全管理组织架构是怎样的？', '安全管理制度是什么时候制定的？正式发布了吗？', '安全培训多久组织一次？有考核吗？', '应急预案演练过吗？多久一次？', '风险评估是定期开展的吗？', '第三方人员访问系统需要走什么流程？'],
            fb: '这个具体细节我不太掌握，您可以问安全策略、制度发布、培训、预案、风险评估这些方面——这些是我在负责的。'
        },
        staff: {
            name: '普通员工 · 王五',
            short: '王五',
            post: '业务部门普通员工（日常使用 OA 系统办公）',
            hello: '啊，您好。我就是业务部门的，平时用 OA 办公，安全的那些东西……我了解得不多，您问吧。',
            topics: [
                { kws: ['岗位', '职责', '负责什么', '做什么工作', '工作内容', '部门'],
                  off: '我是业务部门的，平时就是处理业务单据、走 OA 流程，跟系统打交道的部分不多。',
                  tru: '（想了想）我们部门就我一个人兼顾这些，安全上要做什么，其实也不太清楚该找谁问。' },
                { kws: ['安全制度', '制度', '知道吗', '了解吗', '内容包括'],
                  off: '公司有安全制度的，这个我知道，入职的时候好像讲过。',
                  tru: '（不好意思）具体内容真不太清楚，就记得有这么个制度。要是问里面的条款，我答不上来。' },
                { kws: ['培训', '学习', '考核', '参加过'],
                  off: '培训我参加过。',
                  tru: '（想了想）就参加过 1 次，讲得挺快的，我没太听懂。也没考试，听完就过去了。' },
                { kws: ['密码', '口令', '密码怎么设', '复杂度', '换密码'],
                  off: '密码我是按要求设置的，设置了密码。',
                  tru: '（笑）我用的是"生日 + 姓名首字母"，好记啊。太复杂的我怕忘了，写的便利贴还贴在显示器边上呢。' },
                { kws: ['钓鱼', '邮件', '附件', '可疑', '安全事件', '点击'],
                  off: '可疑邮件我们收到要上报的。',
                  tru: '（压低声音）我收到过一次可疑邮件，说是什么发票，我没多想就点开附件了，后来好像也没什么事，就没跟人说。' },
                { kws: ['备份', '数据', '文件存放'],
                  off: '重要文件我都存在 OA 系统里，也存了一份在自己电脑上。',
                  tru: '（顿了顿）重要的资料就是本地电脑和共享盘各放一份，U 盘有时候也拷。没有专门的备份规矩，都是自己看着办。' }
            ],
            chips: ['请简单介绍一下您的工作内容？', '您知道公司有哪些安全管理制度吗？', '安全培训您参加过几次？有考试吗？', '您的登录密码是怎么设置的？', '如果收到可疑邮件您会怎么做？', '重要文件平时怎么保存？'],
            fb: '哎呀，这个我真不懂。安全的事您得问我们主管或者系统管理员，我就是个用系统的。'
        }
    };

    var PROBE = ['最近', '上一次', '上次', '实际', '具体', '多久', '多少', '谁负责', '谁看', '谁做', '哪次', '有没有', '有没', '例外', '记录', '台账', '到底', '真的', '确实'];

    var el = function (id) { return document.getElementById(id); };
    var chat, note, input, chipsBox;
    var cur = null;          // 当前角色 key
    var asked = {};          // { roleKey: { topicIndex: 次数 } }
    var lastTopic = {};      // { roleKey: topicIndex } —— 支持"那最近一次呢？"这类追问延续话题
    var log = [];            // [{who:'me'|'role'|'sys', text}]
    var truthCount = 0;

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

    function push(who, text, whoLabel) {
        var d = document.createElement('div');
        d.className = 'rpa-msg rpa-msg--' + (who === 'me' ? 'me' : who === 'role' ? 'role' : 'sys');
        d.innerHTML = (who === 'role' && whoLabel ? '<span class="rpa-who">' + esc(whoLabel) + '</span>' : '') + esc(text);
        chat.appendChild(d);
        chat.scrollTop = chat.scrollHeight;
        log.push({ who: who, text: text, whoLabel: whoLabel || '' });
    }

    function sysTip(text) { push('sys', text); }

    function updateNote() {
        if (!note) return;
        if (!cur) { note.textContent = '先选一位被访谈人，再开始提问'; return; }
        var n = (asked[cur] ? Object.keys(asked[cur]).length : 0);
        note.textContent = '当前访谈：' + ROLES[cur].short + ' · 已提问 ' + (asked[cur + '_q'] || 0) + ' 次 · 已问出实情 ' + (asked[cur + '_t'] || 0) + ' 项';
    }

    function renderChips() {
        if (!chipsBox) return;
        chipsBox.innerHTML = '';
        if (!cur) return;
        ROLES[cur].chips.forEach(function (q) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'rpa-chip';
            b.textContent = q;
            b.addEventListener('click', function () { ask(q); });
            chipsBox.appendChild(b);
        });
    }

    function switchRole(key) {
        cur = key;
        // 换角色 = 重新开始一次访谈：对话与统计都重置
        asked[key] = {};
        asked[key + '_q'] = 0;
        asked[key + '_t'] = 0;
        asked[key + '_hit'] = {};
        lastTopic[key] = null;
        log = [];
        if (chat) chat.innerHTML = '';
        var rs = document.querySelectorAll('#rpaRoles .rpa-role');
        for (var i = 0; i < rs.length; i++) {
            rs[i].classList.toggle('active', rs[i].getAttribute('data-role') === key);
        }
        push('role', ROLES[key].hello, ROLES[key].name);
        updateNote();
        renderChips();
        if (input) { input.disabled = false; input.focus(); }
        if (typeof trackOperation === 'function') { try { trackOperation('访谈智能体选角色', ROLES[key].name); } catch (e) {} }
    }

    function matchTopic(role, t) {
        var best = -1, bestLen = 0;
        role.topics.forEach(function (tp, ti) {
            tp.kws.forEach(function (k) {
                if (t.indexOf(k) >= 0 && k.length > bestLen) { bestLen = k.length; best = ti; }
            });
        });
        return best;
    }

    function ask(text) {
        text = (text === undefined ? (input ? input.value : '') : text) || '';
        text = text.replace(/^\s+|\s+$/g, '');
        if (!text) return;
        if (!cur) { alert('请先选择一位被访谈人（角色）再提问。'); return; }
        if (input) input.value = '';
        push('me', text);

        var role = ROLES[cur];
        var t = text.replace(/\s/g, '');
        var isProbeQ = PROBE.some(function (k) { return t.indexOf(k) >= 0; });
        var ti = matchTopic(role, t);

        // 追问延续：没提到话题关键词、但明显是针对上一个话题追问（如"那最近一次呢？"）时，延续上一话题
        if (ti < 0 && isProbeQ && t.length <= 30 && lastTopic[cur] !== undefined && lastTopic[cur] !== null) {
            ti = lastTopic[cur];
        }

        asked[cur + '_q'] = (asked[cur + '_q'] || 0) + 1;

        if (ti < 0) {
            push('role', role.fb, role.name);
            sysTip('💡 这个问题不在该角色的职责范围内。可以换个角度问：制度怎么规定的？最近一次实际执行是什么时候？');
            updateNote();
            if (typeof trackOperation === 'function') { try { trackOperation('访谈智能体提问', role.short + '·未命中话题'); } catch (e) {} }
            return;
        }
        lastTopic[cur] = ti;

        var n = (asked[cur][ti] || 0) + 1;
        asked[cur][ti] = n;

        if (n === 1) {
            push('role', role.topics[ti].off, role.name);
            sysTip('💡 这是"制度口径"。同一个话题再追问一次（如"最近一次是什么时候？""这件事谁负责？"），才能问出真实执行情况。');
        } else {
            var tru = role.topics[ti].tru;
            // 实情文本自带语气描写（以"（"开头）时不再叠加追问前缀，避免"（压低声音）（压低声音）"
            var msg = tru.charAt(0) === '（' ? tru : (isProbeQ ? '（顿了顿，压低声音）' : '（左右看了看）') + tru;
            push('role', msg, role.name);
            if (!asked[cur + '_hit']) { asked[cur + '_hit'] = {}; }
            if (!asked[cur + '_hit'][ti]) {
                asked[cur + '_hit'][ti] = 1;
                asked[cur + '_t'] = (asked[cur + '_t'] || 0) + 1;
                truthCount++;
            }
        }
        updateNote();
        if (typeof trackOperation === 'function') { try { trackOperation('访谈智能体提问', role.short + '·' + role.topics[ti].kws[0]); } catch (e) {} }
    }

    // 组装访谈记录文本（导出 / 复制共用）
    function buildText() {
        if (!cur || !log.length) return '';
        var now = new Date();
        var pad = function (x) { return (x < 10 ? '0' : '') + x; };
        var stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        var role = ROLES[cur];
        var lines = [];
        lines.push('【模拟人员访谈 · 对话记录】');
        lines.push('任务：5.2 模拟人员访谈（对话智能体）');
        lines.push('被访谈人：' + role.name);
        lines.push('岗位：' + role.post);
        lines.push('访谈时间：' + stamp);
        lines.push('提问次数：' + (asked[cur + '_q'] || 0) + '　问出执行层面实情：' + (asked[cur + '_t'] || 0) + ' 项');
        lines.push('————————————————');
        log.filter(function (x) { return x.who !== 'sys'; }).forEach(function (x) {
            lines.push((x.who === 'me' ? '问：' : '答（' + x.whoLabel + '）：') + x.text);
            lines.push('');
        });
        lines.push('————————————————');
        lines.push('整理提示：把上面的要点整理进《人员访谈记录表》（素材1）——只写事实与关键数字（如“90 天”“3 个离职账号未清理”），不要写结论；');
        lines.push('“初步判断与发现的问题”从回答中暴露的矛盾与缺口提炼；“下一步核查建议”写明查什么记录、找谁核实。');
        return lines.join('\r\n');
    }

    // 还没有实质问答（只有开场白）时不导出
    function noQA() {
        if (!cur || !log.length) return true;
        var q = 0;
        for (var i = 0; i < log.length; i++) { if (log[i].who === 'me') q++; }
        return q === 0;
    }

    function copyLog() {
        if (noQA()) { alert('还没有问答内容：先在下面输入问题、问几轮，再复制。'); return; }
        var txt = buildText();
        var done = function () { alert('已复制本次访谈问答。\r\n粘贴到《人员访谈记录表》里，再整理成"访谈要点 / 发现的问题 / 下一步核查建议"。'); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt, done); });
        } else { fallbackCopy(txt, done); }
    }

    // 导出本次对话为 .txt 文件（UTF-8 BOM，Windows 记事本 / Word 打开不乱码）
    function exportLog() {
        if (noQA()) { alert('还没有问答内容：先在下面输入问题、问几轮，再导出对话记录。'); return; }
        var txt = buildText();
        if (!txt) { alert('还没有访谈内容，先选角色并提问。'); return; }
        var now = new Date();
        var pad = function (x) { return (x < 10 ? '0' : '') + x; };
        var fname = '模拟人员访谈_' + ROLES[cur].short + '_' + now.getFullYear() + pad(now.getMonth() + 1) +
                    pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes()) + '.txt';
        var blob = new Blob(['\ufeff' + txt], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1500);
        if (typeof trackOperation === 'function') { try { trackOperation('导出访谈对话', ROLES[cur].short); } catch (e) {} }
        alert('已导出对话记录：\r\n' + fname + '\r\n\r\n（保存在浏览器的“下载”目录）\r\n用法：打开文件，把要点整理进《人员访谈记录表》（素材1）。');
    }

    function fallbackCopy(txt, done) {
        var ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败，请手动选中聊天内容复制。'); }
        document.body.removeChild(ta);
    }

    function reset() {
        if (!cur) return;
        if (!confirm('确认清空当前角色的对话，重新开始访谈？')) return;
        asked[cur] = {};
        asked[cur + '_q'] = 0;
        asked[cur + '_t'] = 0;
        asked[cur + '_hit'] = {};
        switchRole(cur);
    }

    function init() {
        chat = el('rpaChat');
        note = el('rpaNote');
        input = el('rpaInput');
        chipsBox = el('rpaChips');
        if (!chat || !input) return;

        var rs = document.querySelectorAll('#rpaRoles .rpa-role');
        for (var i = 0; i < rs.length; i++) {
            rs[i].addEventListener('click', function () { switchRole(this.getAttribute('data-role')); });
        }
        var send = el('rpaSend');
        if (send) send.addEventListener('click', function () { ask(); });
        if (input) {
            input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
        }
        var cp = el('rpaCopy');
        if (cp) cp.addEventListener('click', copyLog);
        var ex = el('rpaExport');
        if (ex) ex.addEventListener('click', exportLog);
        var rp = el('rpaReset');
        if (rp) rp.addEventListener('click', reset);

        var em = el('rpaEmpty');
        if (em) em.parentNode.removeChild(em);
        input.disabled = true;
        updateNote();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

;

/* AI 使用提醒：全站默认折叠，点标题展开；打印时自动展开 */
(function () {
    var TIP_SEL = '.ai-tip-box';

    function tipTitle(box) {
        for (var i = 0; i < box.children.length; i++) {
            if (box.children[i].classList.contains('ai-tip-title')) return box.children[i];
        }
        return null;
    }

    function setOpen(box, title, open) {
        box.classList.toggle('is-collapsed', !open);
        if (title) title.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function init() {
        var boxes = document.querySelectorAll(TIP_SEL);
        Array.prototype.forEach.call(boxes, function (box) {
            if (box.classList.contains('ai-acc')) return;
            var title = tipTitle(box);
            if (!title) return;
            box.classList.add('ai-acc', 'is-collapsed');
            title.setAttribute('role', 'button');
            title.setAttribute('tabindex', '0');
            title.setAttribute('aria-expanded', 'false');
            title.title = '点击展开 / 收起 AI 使用提醒';
            title.addEventListener('click', function () {
                setOpen(box, title, box.classList.contains('is-collapsed'));
            });
            title.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    setOpen(box, title, box.classList.contains('is-collapsed'));
                }
            });
        });
    }

    // 供“素养”页 AI 索引跳转时自动展开
    window.__aiTipExpandFor = function (el) {
        if (!el || !el.closest) return;
        var box = el.closest('.ai-tip-box.is-collapsed');
        if (!box) return;
        setOpen(box, tipTitle(box), true);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
