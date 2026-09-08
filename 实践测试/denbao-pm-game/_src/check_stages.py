# -*- coding: utf-8 -*-
import io, re
from collections import Counter
base = r'C:\Users\BITC\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\denbao-pm-game'
with io.open(base + r'\_src\p2.html', encoding='utf-8') as f:
    d = f.read()
ids = re.findall(r'id:"s(\d+)", stage:(\d+)', d)
print(ids)
print(Counter(s for _, s in ids))
