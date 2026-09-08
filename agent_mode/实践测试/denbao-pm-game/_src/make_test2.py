# -*- coding: utf-8 -*-
import io
base = r'C:\Users\BITC\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\denbao-pm-game'
with io.open(base + r'\index.html', encoding='utf-8') as f:
    html = f.read()
inject = '''<script>
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    var start = document.getElementById('btnStart');
    if(start) start.click();
    setTimeout(function(){
      current = 6;           // 跳到第 7 关：评定业务信息安全等级 S
      submitted = false;
      renderStep();
      setTimeout(function(){
        var inp = document.getElementById('answerInput');
        inp.value = 'S=3，因为系统存储大量公民个人敏感信息，一旦泄露将严重损害公共利益';
        document.getElementById('btnSubmit').click();
      }, 300);
    }, 400);
  }, 300);
});
</script>
</body>'''
html = html.replace('</body>', inject, 1)
with io.open(base + r'\_test_ui.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('test copy written (jump to step 6)')
