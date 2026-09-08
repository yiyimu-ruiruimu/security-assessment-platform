# -*- coding: utf-8 -*-
import io
base = r'C:\Users\BITC\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\denbao-pm-game'
with io.open(base + r'\index.html', encoding='utf-8') as f:
    html = f.read()
answers = [
    "确认项目基本信息：项目名称、委托单位、被测系统、安全保护等级、测评依据，并与客户沟通确认范围，签署保密协议",
    "依据GB/T 22239-2019和GB/T 28448-2019",
    "项目经理、技术测评工程师（网络、主机、应用）、管理测评工程师（制度、人员）、测试组（漏洞扫描）",
    "签署保密协议，明确授权范围，收集系统资料与资产清单，准备测评工具",
    "解读定级报告；定级第一步是确定定级对象",
    "定级对象、业务信息安全等级S（数据被泄露篡改破坏后的受害程度）、系统服务安全等级A（服务中断的受害范围）"
]
inject = '''<script>
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    var start = document.getElementById('btnStart');
    if(start) start.click();
    setTimeout(function(){
      var i = 0;
      function step(){
        var inp = document.getElementById('answerInput');
        var btn = document.getElementById('btnSubmit');
        if(!inp || !btn) return;
        if(i < 6){
          inp.value = ''' + repr(answers).replace("'", '"') + '''[i];
          btn.click();
          setTimeout(function(){
            var next = document.getElementById('btnNext');
            if(next) next.click();
            i++;
            setTimeout(step, 350);
          }, 350);
        } else {
          inp.value = 'S=3，因为系统存储大量公民个人敏感信息，一旦泄露将严重损害公共利益';
          btn.click();
        }
      }
      step();
    }, 400);
  }, 300);
});
</script>
</body>'''
html = html.replace('</body>', inject, 1)
with io.open(base + r'\_test_ui.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('test copy written')
