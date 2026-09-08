import io

p1=io.open('p1.html',encoding='utf-8').read()
p1=p1.replace('<small>/ 200</small>','<small>/ 100</small>')
io.open('p1.html','w',encoding='utf-8',newline='\n').write(p1)

p2=io.open('p2.html',encoding='utf-8').read()
p2=p2.replace('base:10','base:5')
io.open('p2.html','w',encoding='utf-8',newline='\n').write(p2)

p3=io.open('p3.html',encoding='utf-8').read()
p3=p3.replace('Math.min(10,Math.round(3+3*ratio))','Math.min(5,Math.round(2+1.5*ratio))')
p3=p3.replace('Math.min(10,Math.round(6+4*ratio))','Math.min(5,Math.round(3+2*ratio))')
p3=p3.replace('STEPS.length*10','STEPS.length*5')
p3=p3.replace('/ 200</span>','/ 100</span>')
p3=p3.replace('"总得分："+score+"/200"','"总得分："+score+"/100"')
io.open('p3.html','w',encoding='utf-8',newline='\n').write(p3)

print('done')
