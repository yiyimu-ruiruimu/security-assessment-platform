# -*- coding: utf-8 -*-
import io
p=io.open('p2.html',encoding='utf-8').read()
p=p.replace('placeholder:"示例：2台", groups:[["2台","两台","全部","100%"]], expect:"2台（全部纳入）"',
            'placeholder:"示例：2台", nums:[2], groups:[["2台","两台","全部","100%"]], expect:"2台（全部纳入）"')
p=p.replace('placeholder:"示例：4台", groups:[["4台","四台","全部","100%"]], expect:"4台（全部纳入）"',
            'placeholder:"示例：4台", nums:[4], groups:[["4台","四台","全部","100%"]], expect:"4台（全部纳入）"')
p=p.replace('placeholder:"示例：2台", groups:[["2台","两台","抽2","66%"]], expect:"2台（抽样，66% ≥ 30%）"',
            'placeholder:"示例：2台", nums:[2], groups:[["2台","两台","抽2","66%"]], expect:"2台（抽样，66% ≥ 30%）"')
p=p.replace('placeholder:"示例：1台", groups:[["1台","一台","抽1","50%"]], expect:"1台（抽样，50%）"',
            'placeholder:"示例：1台", nums:[1], groups:[["1台","一台","抽1","50%"]], expect:"1台（抽样，50%）"')
p=p.replace('placeholder:"示例：0台", groups:[["0台","0 台","不纳","不测","不抽","排除","否"]]',
            'placeholder:"示例：0台", nums:[0], groups:[["0台","0 台","不纳","不测","不抽","排除","否"]]')
io.open('p2.html','w',encoding='utf-8',newline='\n').write(p)
print('nums added:', p.count('nums:['))
