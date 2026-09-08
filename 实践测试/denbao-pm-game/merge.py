import io, re
p1=io.open('_src/p1.html',encoding='utf-8').read()
p2=io.open('_src/p2.html',encoding='utf-8').read()
p3=io.open('_src/p3.html',encoding='utf-8').read()
html = p1 + '\n<script>\n' + p2 + '\n</script>\n<script>\n' + p3 + '\n</script>\n</body>\n</html>\n'
io.open('index.html','w',encoding='utf-8',newline='\n').write(html)
blocks=re.findall(r'<script>(.*?)</script>',html,re.S)
io.open('_src/combined.js','w',encoding='utf-8',newline='\n').write('\n'.join(blocks))
print('merged', len(html.encode('utf-8')))
