// Node unit test for the game evaluation engine (DOM stubbed)
const fs = require('fs');
const path = require('path');

const stubEl = () => ({
  addEventListener(){}, classList:{add(){},remove(){},toggle(){}}, style:{},
  textContent:'', innerHTML:'', value:'', dataset:{}, disabled:false, focus(){},
  querySelectorAll(){return[]}
});
global.document = {
  getElementById(){return stubEl()},
  querySelectorAll(){return[]},
  addEventListener(){},
  createElement(){return Object.assign(stubEl(),{appendChild(){},removeChild(){},select(){}})},
  body:{appendChild(){},removeChild(){}}
};
global.window = {scrollTo(){},addEventListener(){}};
global.localStorage = {getItem(){return null},setItem(){},removeItem(){}};
global.confirm = () => true;
global.navigator = {};

const src = fs.readFileSync(path.join(__dirname,'combined.js'),'utf8');
const vm = require('vm');
vm.runInThisContext(src);

let pass = 0, fail = 0;
function eq(name, got, want){
  if(JSON.stringify(got)===JSON.stringify(want)){pass++;console.log('PASS', name);}
  else{fail++;console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want));}
}

// --- parseLevels ---
eq('parse S=3A3', parseLevels('S=3A=3，最终第三级'), {s:3,a:3,level:3});
eq('parse S3A3', parseLevels('S3A3'), {s:3,a:3,level:3});
eq('parse 三级', parseLevels('该系统定为三级'), {s:null,a:null,level:3});
eq('parse 3级', parseLevels('3级'), {s:null,a:null,level:3});
eq('parse 数字3', parseLevels('我认为是3'), {s:null,a:null,level:3});
eq('parse S:2', parseLevels('S：2级，因为...'), {s:2,a:null,level:2});
eq('parse A:4', parseLevels('A=4'), {s:null,a:4,level:null});
eq('parse 五级', parseLevels('第五级'), {s:null,a:null,level:5});

// --- evaluate S step (custom S) ---
const s6 = STEPS[6];
let r = evaluate(s6, 'S=3，因为系统存储大量公民个人敏感信息，一旦泄露将严重损害公共利益');
eq('S good 3星', r.stars, 3);
eq('S good score>0', r.score>0, true);
r = evaluate(s6, 'S=3');
eq('S level ok weak reason 2星', r.stars, 2);
r = evaluate(s6, 'S=2，影响不大');
eq('S wrong 1星', r.stars, 1);
r = evaluate(s6, '服务中断影响很大，所以S=3');
eq('S confusion detected', r.comment.indexOf('S 看数据、A 看服务')>=0, true);

// --- evaluate A step (custom A) ---
const s7 = STEPS[7];
r = evaluate(s7, 'A=3，政务服务中断会影响全市群众办事，严重损害社会秩序');
eq('A good 3星', r.stars, 3);
r = evaluate(s7, 'A=2');
eq('A wrong level', r.stars, 1);
r = evaluate(s7, '数据泄露了，A=3');
eq('A confusion detected', r.comment.indexOf('A 看服务、S 看数据')>=0, true);

// --- evaluate LEVEL step (custom LEVEL) ---
const s8 = STEPS[8];
r = evaluate(s8, '第三级 S3A3，依据GB/T 22240定级指南，取max(S,A)=3');
eq('LEVEL good', r.stars, 3);
r = evaluate(s8, 'S3A3');
eq('LEVEL ok no reason', r.stars, 2);
r = evaluate(s8, '二级吧');
eq('LEVEL wrong', r.stars, 1);

// --- normal steps keyword scoring ---
const s1 = STEPS[1]; // 22239/28448/28449
r = evaluate(s1, '依据GB/T 22239-2019和GB/T 28448-2019');
eq('s1 good', r.stars, 3);
r = evaluate(s1, '依据GB/T 22239-2019和GB/T 28448-2019，还有28449过程指南');
eq('s1 bonus score full', r.score, 5);
r = evaluate(s1, '依据等保标准');
eq('s1 poor', r.stars, 1);
// s10 / s12 / s13 已升级为表格关，见下方 table 测试段
eq('s10 已表格化', STEPS[10].type, 'table');
eq('s12 已表格化', STEPS[12].type, 'table');
eq('s13 已表格化', STEPS[13].type, 'table');

// --- no number in custom step ---
r = evaluate(s6, '数据泄露危害大');
eq('S no number => 1 star', r.stars, 1);

// --- multi-case: 每个案例的定级评分与关卡数量 ---
eq('case count', CASES.length, 4);
CASES.forEach((c,ci)=>{
  const tag='CASE'+(ci+1);
  const st=buildSteps(c);
  eq(tag+' 20关', st.length, 20);
  eq(tag+' 阶段数', STAGES.length, 4);
  const s6=st[6], s7=st[7], s8=st[8];
  eq(tag+' 评S关expected', s6.expectedLevel, c.s);
  eq(tag+' 评A关expected', s7.expectedLevel, c.a);
  eq(tag+' 取高关expected', s8.expectedLevel, Math.max(c.s,c.a));
  eq(tag+' S good 3星', evaluate(s6,'S='+c.s+'，因为'+c.sTeach).stars, 3);
  eq(tag+' S wrong 1星', evaluate(s6,'S='+(c.s===3?2:3)).stars, 1);
  eq(tag+' A good 3星', evaluate(s7,'A='+c.a+'，因为'+c.aTeach).stars, 3);
  eq(tag+' A wrong 1星', evaluate(s7,'A='+(c.a===3?2:3)).stars, 1);
  eq(tag+' LEVEL good 3星', evaluate(s8, L(c.level)+'（S'+c.s+'A'+c.a+'），依据GB/T 22240取高').stars, 3);
  eq(tag+' LEVEL wrong 1星', evaluate(s8, '一级').stars, 1);
  eq(tag+' LEVEL 组含答案', s8.groups.some(g=>g.indexOf('S'+c.s+'A'+c.a)>=0), true);
  eq(tag+' 评S关组', s6.groups.length>=2, true);
});

// --- table 关卡（evaluateTable） ---
const t0=buildSteps(CASES[0])[0];
eq('s0 是表格关', t0.type, 'table');
eq('s0 可填格数', t0.table.rows.filter(r=>r.editable!==false).length, 3);
let tr=evaluateTable(t0, ['GB/T 22239-2019和GB/T 28448-2019','待定级','确认测评范围']);
eq('s0 全对 3星', tr.stars, 3);
eq('s0 全对满分', tr.score, 5);
eq('s0 detail数', tr.detail.length, 3);
tr=evaluateTable(t0, ['22239','三级','范围']);
eq('s0 对1格(22239缺28448)', tr.detail[0].ok, false);
eq('s0 等级格错(写三级)', tr.detail[1].ok, false);
tr=evaluateTable(t0, ['','','']);
eq('s0 全空 1星', tr.stars, 1);
const t10=buildSteps(CASES[0])[10];
eq('s10 是表格关', t10.type, 'table');
tr=evaluateTable(t10, ['项目概述','测评范围','测评对象','测评指标','测评方法','日程与人员']);
eq('s10 全对 3星', tr.stars, 3);
const t12=buildSteps(CASES[0])[12];
eq('s12 是表格关', t12.type, 'table');
eq('s12 每格有示例', t12.table.rows.every(r=>r.editable===false||!!r.placeholder), true);
tr=evaluateTable(t12, ['2台','4台','2台','1台','全部','0台']);
eq('s12 数量写法全对 3星', tr.stars, 3);
eq('s12 数量写法满分', tr.score, 5);
tr=evaluateTable(t12, ['全部','全部','3台','2台','0台','0台']);
eq('s12 处置错误判定', tr.detail[2].ok, false);
tr=evaluateTable(t12, ['2','4','2','1','全部','不纳入']);
eq('s12 台数+不纳入兼容', tr.stars, 3);
const t13=buildSteps(CASES[0])[13];
eq('s13 是表格关', t13.type, 'table');
tr=evaluateTable(t13, ['双因素认证','三级新增双因素强制','结束会话超时自动退出','更严格','不适用未部署','裁剪须说明理由']);
eq('s13 全对 3星', tr.stars, 3);
eq('s13 满分', tr.score, 5);
tr=evaluateTable(t13, ['密码复杂度','','','','','']);
eq('s13 对1格 1星', tr.stars, 1);
// 表格关不影响普通关
eq('s1 仍是普通关', STEPS[1].type, undefined);
// 每个案例的 4 张表都存在
CASES.forEach((c,ci)=>{
  const st=buildSteps(c);
  eq('CASE'+(ci+1)+' 4表格关', [st[0],st[10],st[12],st[13]].filter(s=>s.type==='table').length, 4);
});

console.log('\n===== ' + pass + ' passed, ' + fail + ' failed =====');
process.exit(fail?1:0);
