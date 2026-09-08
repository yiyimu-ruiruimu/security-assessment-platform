import io,re
html=io.open('../index.html',encoding='utf-8').read()
ids=set(re.findall(r'id="([^"]+)"',html))
js=io.open('combined.js',encoding='utf-8').read()
used=set(re.findall(r'\$\("([A-Za-z0-9_]+)"\)',js))
missing=sorted(u for u in used if u not in ids)
print('used ids:',len(used),'missing:',missing)
