// 验证表格关渲染与反馈的 HTML 结构（简易 DOM stub）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = {};
const stubEl = (id) => ({
  id: id||'', textContent:'', innerHTML:'', value:'', disabled:false, dataset:{},
  classList:{ add(){}, remove(){}, toggle(){}, contains(){return false} },
  style:{}, addEventListener(){}, focus(){},
  querySelectorAll(){ return []; },
  querySelector(){ return null; },
  appendChild(){}, removeChild(){}, setAttribute(){}
});
global.document = {
  getElementById(id){ if(!store[id]) store[id]=stubEl(id); return store[id]; },
  querySelectorAll(){ return []; },
  addEventListener(){},
  createElement(){ return Object.assign(stubEl(), {appendChild(){}, removeChild(){}}) },
  body:{ appendChild(){}, removeChild(){} }
};
global.window = { scrollTo(){}, addEventListener(){} };
global.localStorage = { getItem(){return null}, setItem(){}, removeItem(){} };
global.confirm = () => true;
global.navigator = {};

const src = fs.readFileSync(path.join(__dirname,'combined.js'),'utf8');
vm.runInThisContext(src);

let fail = 0;
function check(name, cond){
  console.log((cond?'PASS ':'FAIL ')+name);
  if(!cond) fail++;
}

const c = CASES[0];
const steps = buildSteps(c);

// 1) 认知记录表
renderTable(steps[0]);
let html = store['tableSlot'].innerHTML;
check('s0 表格含表头', html.includes('<th>字段</th>'));
check('s0 表格含 3 个输入格', (html.match(/class="tcell"/g)||[]).length === 3);
check('s0 预填行存在', html.includes('tbl-prefill'));
check('s0 项目名预填', html.includes(c.name));

// 2) 对象分析表
renderTable(steps[12]);
html = store['tableSlot'].innerHTML;
check('s12 含 6 个输入格', (html.match(/class="tcell"/g)||[]).length === 6);
check('s12 含抽样提示', html.includes('3台（同配置）'));

// 3) 等级差异表
renderTable(steps[13]);
html = store['tableSlot'].innerHTML;
check('s13 含 6 个输入格', (html.match(/class="tcell"/g)||[]).length === 6);

// 4) evaluateTable 的 detail 供 feedback 渲染
const tr = evaluateTable(steps[0], ['GB/T 22239-2019、GB/T 28448-2019','待定','范围']);
check('evaluateTable 返回 detail', Array.isArray(tr.detail) && tr.detail.length===3);

// 5) 全流程满分仍为 100
let total=0;
steps.forEach(s=>{
  if(s.type==='table'){
    const rows=s.table.rows.filter(r=>r.editable!==false);
    total += evaluateTable(s, rows.map(r=>r.expect)).score;
  }else{
    total += evaluate(s, s.expect).score;
  }
});
check('20关全对=100', total===100);

// 6) renderStep 表格关切换分支不抛错
renderStep();
check('renderStep 表格关正常', store['answerRow']!==undefined && store['btnTableSubmit']!==undefined);

console.log('\n'+(fail===0?'ALL OK':'FAILED: '+fail));
process.exit(fail?1:0);
