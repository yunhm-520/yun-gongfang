# -*- coding: utf-8 -*-
import base64, io, os, re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 仓库根目录
parts = ['work_docs/_manual_1.html', 'work_docs/_manual_2.html',
         'work_docs/_manual_3.html', 'work_docs/_manual_4.html']
html = '\n'.join(io.open(os.path.join(BASE, p), encoding='utf-8').read() for p in parts)

# 目录计数器作用域
html = html.replace('.toc ol{list-style:none;', '.toc ol{counter-reset:toc;list-style:none;')

# 图片内联
figs = re.findall(r'src="说明书_图/([^"]+)"', html)
total = 0
for fn in sorted(set(figs)):
    path = os.path.join(BASE, '说明书_图', fn)
    raw = open(path, 'rb').read()
    total += len(raw)
    uri = 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii')
    html = html.replace('src="说明书_图/%s"' % fn, 'src="%s"' % uri)

out = os.path.join(BASE, '指针工坊_使用说明书.html')
io.open(out, 'w', encoding='utf-8').write(html)
print('figs', len(set(figs)), 'raw KB', total // 1024)
print('out KB', os.path.getsize(out) // 1024)
