# -*- coding: utf-8 -*-
import io
base = r'C:\Users\BITC\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\denbao-pm-game'
with io.open(base + r'\index.html', encoding='utf-8') as f:
    html = f.read()
inject = '''<script>
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    document.getElementById('btnStart').click();
    setTimeout(function(){
      for(var i=0;i<20;i++){
        records[i] = {answer:'模拟答案'+i, stars:(i%3)+1, score:10, verdict:'判定优秀', comment:'点评文本', teach:'知识点', expect:'参考要点'};
      }
      score = 175;
      openReport();
    }, 400);
  }, 300);
});
</script>
</body>'''
html = html.replace('</body>', inject, 1)
with io.open(base + r'\_test_report.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('report test copy written')
