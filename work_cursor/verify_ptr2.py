import struct, sys, zipfile, io, os, re
OUT = r'./_ptr2_out'
ok = fail = 0
def T(name, cond, extra=''):
    global ok, fail
    if cond:
        ok += 1; print('PASS', name, extra)
    else:
        fail += 1; print('FAIL', name, extra)

u16 = lambda b,o: struct.unpack_from('<H', b, o)[0]
u32 = lambda b,o: struct.unpack_from('<I', b, o)[0]
i32 = lambda b,o: struct.unpack_from('<i', b, o)[0]

# ---------------- 1. CUR ----------------
cur = open(os.path.join(OUT,'test_multi.cur'),'rb').read()
T('cur reserved=0', u16(cur,0)==0)
T('cur type=2 (cursor)', u16(cur,2)==2)
n = u16(cur,4)
T('cur entries=3', n==3, f'n={n}')
entries=[]
for i in range(n):
    e = 6+16*i                      # ICONDIRENTRY 起点
    entries.append(dict(w=cur[e], h=cur[e+1], hx=u16(cur,e+4), hy=u16(cur,e+6),
                        size=u32(cur,e+8), off=u32(cur,e+12)))
print('  entries:', entries)
T('cur hotspots', [ (e['hx'],e['hy']) for e in entries]==[(5,7),(8,11),(10,14)])
T('cur sizes', sorted(e['w'] for e in entries)==[32,48,64])

def read_dib(buf, off):
    assert u32(buf,off)==40, 'biSize!=40'
    w, h2 = i32(buf,off+4), i32(buf,off+8)
    bpp = u16(buf,off+14)
    h = h2//2
    xor = buf[off+40: off+40+w*h*4]
    stride = ((w+31)//32)*4
    andm = buf[off+40+w*h*4: off+40+w*h*4+stride*h]
    return w,h,bpp,xor,andm,stride

for e in entries:
    w,h,bpp,xor,andm,stride = read_dib(cur, e['off'])
    T(f'cur {e["w"]}px: dib 40/32bpp/h*2', w==e['w'] and h==e['w'] and bpp==32 and i32(cur,e['off']+8)==h*2)

# 32px 那张逐像素验 BGRA + 自下而上 + 透明块
w,h,bpp,xor,andm,stride = read_dib(cur, entries[0]['off'])
def px(x,y):  # 图像坐标 -> (B,G,R,A)
    j = h-1-y
    o = (j*w+x)*4
    return xor[o], xor[o+1], xor[o+2], xor[o+3]
b,g,r,a = px(10,5)
T('cur pixel BGRA 顺序', (b,g,r,a)==(200, 5*8, 10*8, 255), f'got {(b,g,r,a)}')
b,g,r,a = px(0,0)
T('cur 首行是图像上边（非倒置）', (r,g)==(0,0), f'got r={r},g={g}')
b,g,r,a = px(0,h-1)
T('cur 透明块 alpha=0', a==0)
and_bit = (andm[(h-1-(h-1))*stride + (0>>3)] >> (7-(0&7))) & 1
T('cur AND 掩码置位(1=透明)', and_bit==1)

# ---------------- 2. ANI ----------------
ani = open(os.path.join(OUT,'test.ani'),'rb').read()
T('ani RIFF/ACON', ani[:4]==b'RIFF' and ani[8:12]==b'ACON')
T('ani RIFF size 正确', u32(ani,4)==len(ani)-8, f'{u32(ani,4)} vs {len(ani)-8}')
chunks=[]; p=12
while p+8<=len(ani):
    cid=ani[p:p+4].decode('latin1'); sz=u32(ani,p+4); chunks.append((cid,sz,p+8))
    p += 8+sz+(sz%2)
print('  chunks:', [(c,s) for c,s,_ in chunks])
T('ani 含 LIST/anih/rate/fram*3',
  [c for c,_,_ in chunks].count('fram')==3 and 'anih' in [c for c,_,_ in chunks], str([c for c,_,_ in chunks]))
anih_off = [d for c,s,d in chunks if c=='anih'][0]
T('anih cbSize=36', u32(ani,anih_off)==36)
T('anih nFrames=3 nSteps=3', u32(ani,anih_off+4)==3 and u32(ani,anih_off+8)==3)
T('anih flags=1', u32(ani,anih_off+32)==1)
rate_off = [d for c,s,d in chunks if c=='rate'][0]
rates=[u32(ani,rate_off+4*i) for i in range(3)]
T('rate = jif 帧数', rates==[5,7,4], str(rates))
# LIST INFO / INAM
list_off=[d for c,s,d in chunks if c=='LIST'][0]
T('LIST 类型 INFO', ani[list_off:list_off+4]==b'INFO')
inam_off=list_off+4          # LIST 载荷先 'INFO'，紧跟 INAM 块
T('INAM 块 id', ani[inam_off:inam_off+4]==b'INAM')
T('INAM 是 UTF-16LE 中文名', ani[inam_off+8:inam_off+8+8].decode('utf-16-le').startswith('测试'), ani[inam_off+8:inam_off+8+8].decode('utf-16-le'))
# 每帧 icon 里的 CUR 热点
for k,(c,s,d) in enumerate([x for x in chunks if x[0]=='fram']):
    q=d                          # fram 载荷就是 icon 子块
    icon_id=ani[q:q+4]; icon_sz=u32(ani,q+4); icon_d=q+8
    T(f'fram{k+1} 内含 icon', icon_id==b'icon')
    T(f'fram{k+1} CUR 类型=2', u16(ani,icon_d+2)==2)
    T(f'fram{k+1} 热点=(5,7)', (u16(ani,icon_d+10),u16(ani,icon_d+12))==(5,7),
      str((u16(ani,icon_d+10),u16(ani,icon_d+12))))

# ---------------- 3. ZIP ----------------
z = zipfile.ZipFile(os.path.join(OUT,'skin.zip'))
names = z.namelist()
print('  zip entries:', len(names))
T('zip 17 个指针文件', len([x for x in names if x.endswith(('.ani','.cur'))])==17)
for need in ['Install.inf','安装皮肤.bat','立即启用.bat','卸载皮肤.bat','恢复默认指针.bat','说明.txt','立即生效.ps1','恢复默认.ps1']:
    T('zip 含 '+need, need in names)
inf_raw = z.read('Install.inf')
T('INF 是 UTF-16LE+BOM', inf_raw[:2]==b'\xff\xfe')
inf = inf_raw.decode('utf-16-le')
if inf and inf[0]=='\ufeff': inf = inf[1:]

# ---------------- 4. INF 结构 ----------------
for sec in ['[Version]','[DefaultInstall]','[DestinationDirs]','[Scheme.Reg]','[Scheme.Cur]','[Strings]']:
    T('INF 含 '+sec, sec in inf)
T('INF signature CHICAGO', 'signature="$CHICAGO$"' in inf)
T('INF CopyFiles/AddReg', 'CopyFiles=Scheme.Cur' in inf and 'AddReg=Scheme.Reg' in inf)
T('INF 目标目录 =%windir%\\Cursors\\皮肤名', 'Scheme.Cur=10,"%CUR_DIR%"' in inf and 'CUR_DIR="Cursors\\测试皮肤"' in inf)
m = re.search(r'HKCU,"Control Panel\\Cursors\\Schemes","%SCHEME_NAME%",0x00020000,"([^"]+)"', inf)
T('INF Schemes 注册行存在', bool(m))
val = m.group(1) if m else ''
parts = val.split(',')
T('Schemes 值 = 17 项', len(parts)==17, f'{len(parts)} 项')
T('Schemes 每项用 %10%\\%CUR_DIR%\\%name%', all(x.startswith('%10%\\%CUR_DIR%\\%') for x in parts), parts[0])
sc = inf.split('[Scheme.Cur]')[1].split('[Strings]')[0]
T('[Scheme.Cur] 17 行', len([l for l in sc.splitlines() if l.strip().startswith('"')])==17)
T('[Strings] SCHEME_NAME', 'SCHEME_NAME="测试皮肤"' in inf)
strs = [l for l in inf.split('[Strings]')[1].splitlines() if '="' in l]
maps=[l for l in strs if re.match(r'^[A-Za-z0-9_]+=".+\.(ani|cur)"$', l)]
T('[Strings] 17 个文件映射', len(maps)==17, f'{len(maps)}/{len(strs)}')
T('SCHEME 名与文件名一致', 'SCHEME_NAME="测试皮肤"' in inf and '测试皮肤' not in [l for l in strs])

# zip 里每个指针文件都能解析成 CUR
bad=[]
for nm in [x for x in names if x.endswith(('.ani','.cur'))]:
    b = z.read(nm)
    if nm.endswith('.ani'):
        if b[:4]!=b'RIFF' or b[8:12]!=b'ACON': bad.append(nm)
    else:
        if not (u16(b,0)==0 and u16(b,2)==2): bad.append(nm)
T('17 个文件格式合法', not bad, str(bad))

# 脚本内容
install_bat = z.read('安装皮肤.bat').decode('utf-8')
T('安装 bat: 自提升', 'Start-Process -FilePath \'%~f0\' -Verb RunAs' in install_bat)
T('安装 bat: InstallHinfSection 132', 'InstallHinfSection DefaultInstall 132' in install_bat)
T('安装 bat: 复制到 ASCII 临时目录', '%TEMP%\\CursorSkin_' in install_bat)
apply_bat = z.read('立即启用.bat').decode('utf-8')
T('启用 bat: 17 次 reg add', apply_bat.count('reg add "HKCU\\Control Panel\\Cursors" /v ')==17,
  str(apply_bat.count('reg add "HKCU\\Control Panel\\Cursors" /v ')))
T('启用 bat: 用 REG_EXPAND_SZ', apply_bat.count('/t REG_EXPAND_SZ')==17)
T('启用 bat: 写方案名到默认值', '/ve /t REG_SZ /d "测试皮肤"' in apply_bat)
T('启用 bat: 调用 SPI 脚本', '立即生效.ps1' in apply_bat)
un_bat = z.read('卸载皮肤.bat').decode('utf-8')
T('卸载 bat: 删 Schemes 键值', 'reg delete "HKCU\\Control Panel\\Cursors\\Schemes" /v "测试皮肤"' in un_bat)
T('卸载 bat: 删目录', 'rd /s /q "%SystemRoot%\\Cursors\\测试皮肤"' in un_bat)
rd = z.read('恢复默认.ps1').decode('utf-8-sig')
T('恢复 ps1: 读 Windows 默认方案', 'Windows 默认' in rd and 'Windows Default' in rd)
T('恢复 ps1: 17 个值名', rd.count('"Arrow"')==1 and '"Person"' in rd)
T('恢复 ps1: SPI 0x2029', '0x2029' in rd)
readme = z.read('说明.txt').decode('utf-8')
T('说明.txt 含角色映射 17 行', readme.count('←')==17, str(readme.count('←')))

print('---')
print(f'RESULT: pass={ok} fail={fail}')
sys.exit(1 if fail else 0)
