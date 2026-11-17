# -*- coding: utf-8 -*-
"""生成说明书插图（真实像素演示 + 界面示意图）"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '说明书_图')
os.makedirs(OUT, exist_ok=True)

NAVY  = (22, 50, 92)
NAVY2 = (30, 66, 120)
GOLD  = (216, 178, 92)
ICE   = (127, 196, 255)
BG    = (238, 242, 248)
CARD  = (255, 255, 255)
LINE  = (215, 224, 238)
INK   = (28, 43, 69)
SUB   = (91, 107, 136)
OK    = (31, 122, 77)
BAD   = (192, 57, 43)

FP = 'C:/Windows/Fonts/msyh.ttc'
FPB = 'C:/Windows/Fonts/msyhbd.ttc'
def F(size, bold=False):
    return ImageFont.truetype(FPB if bold else FP, size)

f_h1  = F(30, True); f_h2 = F(22, True); f_h3 = F(17, True)
f_b   = F(15);       f_s  = F(13);       f_xs = F(11.5)
f_num = F(15, True)


def fit(d, xy, s, font, fill, maxw=None, anchor='la'):
    """按可用宽度自动缩字，避免溢出"""
    if maxw:
        while font.size > 9 and d.textlength(s, font=font) > maxw:
            font = F(font.size - 1, font.path == FPB)
    d.text(xy, s, font=font, fill=fill, anchor=anchor)
    return font


def wrap(d, s, font, maxw):
    lines, cur = [], ''
    for ch in s:
        if ch == '\n':
            lines.append(cur); cur = ''; continue
        if d.textlength(cur + ch, font=font) > maxw and cur:
            lines.append(cur); cur = ch
        else:
            cur += ch
    lines.append(cur)
    return lines


# ---------------- 素材：星形角色 ----------------
def star_mask(size=320, ss=4, rot=0.0):
    S = size * ss
    im = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(im)
    cx = cy = S / 2
    R = S * 0.46
    r = R * 0.40
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + rot + i * math.pi / 5
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    d.polygon(pts, fill=255)
    return np.array(im.resize((size, size), Image.Resampling.LANCZOS), dtype=np.float32) / 255.0


def star_rgb(size=320, rot=0.0):
    """金色渐变本体色 (size,size,3)"""
    a = star_mask(size, rot=rot)
    yy = np.linspace(0, 1, size)[:, None]
    top = np.array([255, 226, 128], np.float32)
    bot = np.array([226, 126, 40], np.float32)
    g = top[None, None, :] * (1 - yy[..., None]) + bot[None, None, :] * yy[..., None]
    g = np.repeat(g, size, axis=1)
    return a, g


def over_white(rgb, a):
    """alpha 合成到白底：模拟海报里「边缘被白底污染」的样子"""
    w = np.array([255, 255, 255], np.float32)
    return np.clip(rgb * a[..., None] + w * (1 - a[..., None]), 0, 255).astype(np.uint8)


def inpaint(rgb, a, core=0.94, rad=6):
    """去色边：把半透明像素的 RGB 换成邻近实心像素的平均色"""
    m = (a >= core).astype(np.float32)
    src = rgb * m[..., None]
    out = rgb.copy()
    denom = np.zeros(a.shape, np.float32)
    for c in range(3):
        im = Image.fromarray(np.clip(src[..., c], 0, 255).astype(np.uint8))
        out[..., c] = np.array(im.filter(ImageFilter.GaussianBlur(rad)), np.float32)
    im = Image.fromarray((m * 255).astype(np.uint8))
    denom = np.array(im.filter(ImageFilter.GaussianBlur(rad)), np.float32) / 255.0
    safe = np.maximum(denom, 1e-3)
    for c in range(3):
        out[..., c] = np.where(denom > 0.02, out[..., c] / safe, out[..., c])
    edge = (a > 0.03) & (a < core)
    res = rgb.copy()
    for c in range(3):
        res[..., c] = np.where(edge, out[..., c], rgb[..., c])
    return np.clip(res, 0, 255)


def checker(size, cs=16, c1=(251, 252, 254), c2=(228, 234, 243)):
    im = Image.new('RGB', (size, size), c1)
    d = ImageDraw.Draw(im)
    for y in range(0, size, cs):
        for x in range(0, size, cs):
            if (x // cs + y // cs) % 2 == 0:
                d.rectangle([x, y, x + cs - 1, y + cs - 1], fill=c2)
    return im


def to_rgba(rgb, a):
    arr = np.dstack([rgb, np.clip(a * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def paste_center(canvas, im, box):
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    x, y, w, h = box
    s = min(w / im.width, h / im.height, 1.0)
    if s < 1.0:
        im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.Resampling.LANCZOS)
    canvas.alpha_composite(im, (int(x + (w - im.width) / 2), int(y + (h - im.height) / 2)))


# ---------------- 通用版式 ----------------
def sheet(w, h, title, subtitle=None):
    im = Image.new('RGBA', (w, h), CARD + (255,))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 66], fill=(249, 251, 254))
    d.line([0, 66, w, 66], fill=LINE, width=2)
    d.rounded_rectangle([22, 22, 27, 44], 2, fill=GOLD)
    fit(d, (38, 18), title, f_h2, NAVY, w - 320)
    if subtitle:
        fit(d, (w - 22, 30), subtitle, f_xs, SUB, 300, anchor='ra')
    return im, d


def tag(d, xy, n, color=GOLD):
    """圆形编号标记"""
    x, y = xy
    d.ellipse([x, y, x + 26, y + 26], fill=color)
    d.text((x + 13, y + 12), str(n), font=f_num, fill=(58, 44, 8) if color == GOLD else (12, 44, 80), anchor='mm')


# ================= 图 1：界面总览 =================
def fig_ui():
    W, H = 1460, 830
    im, d = sheet(W, H, '指针工坊 Pro · 界面总览', '1440 × 800 典型窗口布局')
    # 顶栏
    d.rectangle([0, 66, W, 118], fill=NAVY)
    fit(d, (20, 80), '🎯 指针工坊 Pro', F(18, True), (255, 255, 255))
    d.rounded_rectangle([210, 80, 232, 102], 5, fill=(255, 255, 255))
    fit(d, (221, 91), '①', F(13, True), NAVY, anchor='mm')
    fit(d, (238, 84), '抠图 / 素材', f_s, (255, 255, 255))
    fit(d, (330, 84), '② 指针设计', f_s, (255, 255, 255, 200))
    d.rounded_rectangle([420, 80, 530, 102], 6, fill=(255, 255, 255, 40), outline=(255, 255, 255, 90))
    fit(d, (430, 84), '我的指针', f_xs, (255, 255, 255))
    bx = 560
    for lb in ['打开图片', '导入 .cur', '撤销', '重做', '导出皮肤']:
        wdt = 26 + d.textlength(lb, font=f_xs)
        fill = GOLD if lb == '导出皮肤' else (46, 74, 116)
        d.rounded_rectangle([bx, 80, bx + wdt, 102], 6, fill=fill, outline=(255, 255, 255, 60))
        fit(d, (bx + 13, 84), lb, f_xs, (58, 44, 8) if lb == '导出皮肤' else (255, 255, 255))
        bx += wdt + 8

    # 左侧工具条
    d.rectangle([0, 118, 56, 660], fill=CARD)
    d.line([56, 118, 56, 660], fill=LINE, width=1)
    tools = [('🪄', '魔棒'), ('🧽', '擦除'), ('🖌', '恢复'), ('✂️', '裁切'), ('✋', '抓手'), ('⬚', '切块'), ('♻️', '重置'), ('🗑️', '清空')]
    for i, (ic, nm) in enumerate(tools):
        y = 132 + i * 44
        if i == 0:
            d.rounded_rectangle([9, y, 47, y + 36], 9, fill=(227, 238, 252), outline=ICE)
        fit(d, (28, y + 8), ic, F(16), INK, anchor='ma')
        fit(d, (28, y + 27), nm, F(8.5), SUB, anchor='ma')

    # 顶部操作条
    d.rectangle([56, 118, 1180, 152], fill=CARD)
    d.line([56, 152, 1180, 152], fill=LINE, width=1)
    d.rounded_rectangle([66, 125, 110, 145], 8, fill=(234, 242, 255))
    fit(d, (75, 128), '① 抠图', F(11.5, True), NAVY2)
    fit(d, (120, 129), '魔棒点背景 → 画笔修边 → 点「用作指针画面」，不用再切块', f_xs, SUB, 600)
    for i, (lb, c) in enumerate([('✅ 用作指针画面', GOLD), ('🎞 加入为帧', ICE)]):
        x = 830 + i * 130
        d.rounded_rectangle([x, 124, x + 122, 146], 6, fill=c)
        fit(d, (x + 8, 128), lb, F(11), (58, 44, 8) if c == GOLD else (12, 44, 80))
    d.rounded_rectangle([1100, 124, 1124, 146], 6, fill=(238, 243, 250))
    fit(d, (1112, 128), '⇥', f_xs, SUB, anchor='ma')
    d.rounded_rectangle([1130, 124, 1154, 146], 6, fill=(238, 243, 250))
    fit(d, (1142, 128), '⇩', f_xs, SUB, anchor='ma')

    # 画布
    canvas = Image.new('RGBA', (1124, 508), (223, 230, 240, 255))
    cd = ImageDraw.Draw(canvas)
    # 棋盘 + 抠好的星
    a, rgb = star_rgb(300)
    rgb2 = inpaint(rgb, a)
    ck = checker(500, 20).convert('RGBA')
    canvas.alpha_composite(ck, (312, 4))
    canvas.alpha_composite(to_rgba(rgb2, a), (412, 104))
    d._image.paste(canvas, (56, 152))
    d = ImageDraw.Draw(im)
    # 缩放条
    d.rounded_rectangle([1030, 612, 1170, 644], 10, fill=(255, 255, 255), outline=LINE)
    fit(d, (1044, 620), '−  125%  ＋  适应 1:1', f_xs, SUB)

    # 右面板
    d.rectangle([1186, 118, W, 690], fill=CARD)
    d.line([1186, 118, 1186, 690], fill=LINE, width=1)
    cards = [('抠图工具', ['魔棒容差 ───○─── 30', '取样  ● 连通   ○ 全图', '画笔大小 ──○──── 24']),
             ('裁切取景', ['✓ 裁切到此区域    取消', '⬚ 自动裁到内容边界']),
             ('批量去背 / 边缘精修', ['亮度≥ ─────○─ 205', '饱和≤ ──○──── 46', '去色边 ─○───── 1']),
             ('一键变清晰', ['放大 [ 2× 放大 ▾ ]', '锐化 ────○── 100', '☑ 先去噪点']),
             ('精灵图切块（可选）', ['行 × 列  1 × 1', '▦ 整图网格分割']),
             ('素材列表', ['[缩略图] [缩略图]'])]
    y = 128
    for t, rows in cards:
        hgt = 34 + len(rows) * 22
        d.rectangle([1196, y, W - 12, y + hgt], fill=(253, 254, 255), outline=(232, 238, 247))
        d.ellipse([1206, y + 12, 1215, y + 21], fill=GOLD)
        fit(d, (1222, y + 8), t, F(12, True), NAVY, 200)
        for i, r in enumerate(rows):
            if '缩略图' in r:
                for k in range(2):
                    d.rounded_rectangle([1210 + k * 58, y + 30, 1260 + k * 58, y + 30 + hgt - 38], 6, fill=(232, 238, 247))
            else:
                fit(d, (1210, y + 30 + i * 22), r, F(10.5), SUB if i else INK, 218)
        y += hgt + 8

    # 底部托盘
    d.rectangle([0, 696, W, H - 26], fill=CARD)
    d.line([0, 696, W, 696], fill=LINE, width=2)
    d.rounded_rectangle([14, 706, 108, 728], 8, fill=(231, 240, 253), outline=ICE)
    fit(d, (24, 710), '素材 3', f_xs, NAVY)
    d.rounded_rectangle([116, 706, 196, 728], 8, fill=(247, 250, 255), outline=LINE)
    fit(d, (126, 710), '帧 12', f_xs, SUB)
    for i in range(6):
        x = 120 + i * 70
        d.rounded_rectangle([x, 738, x + 60, 798], 8, fill=(240, 245, 252), outline=LINE)
        fit(d, (x + 30, 763), '帧 %d' % (i + 1), F(10), SUB, anchor='mm')
    d.rounded_rectangle([1250, 706, W - 14, H - 34], 10, fill=(246, 249, 253), outline=LINE)
    fit(d, (1262, 714), '预览  48×   [浅底 ▾]', f_xs, SUB)
    # 预览方格
    d.rounded_rectangle([1284, 740, 1390, 786], 6, fill=(255, 255, 255), outline=LINE)

    # 编号
    tag(d, (1006, 128), 1)      # 顶部操作条
    tag(d, (10, 128), 2)        # 左工具条
    tag(d, (60, 160), 3)        # 画布
    tag(d, (1330, 128), 4)      # 右面板
    tag(d, (300, 700), 5)       # 底托盘
    tag(d, (400, 78), 6, ICE)   # 顶栏
    tag(d, (1050, 604), 7)      # 缩放条

    # 图例
    leg = [('1 顶部操作条 · 主按钮', 1), ('2 工具条 · 当前工具', 2), ('3 画布 · 抠图/设计区', 3),
           ('4 右面板 · 参数卡片', 4), ('5 底部托盘 · 素材/帧', 5), ('6 顶栏 · 打开/撤销/导出', 6)]
    d.rectangle([0, H - 26, W, H], fill=(247, 250, 254))
    x = 16
    for t, n in leg:
        tag(d, (x, H - 24), n)
        fit(d, (x + 32, H - 22), t, F(11), SUB)
        x += 30 + int(d.textlength(t, font=F(11))) + 26
    im.convert('RGB').save(OUT + '/fig1_ui.png', optimize=True)
    print('fig1', im.size)


# ================= 图 2：工作流程 =================
def fig_flow():
    W, H = 1460, 470
    im, d = sheet(W, H, '从一张图到一套鼠标指针：8 步', '灰色为可选步骤')
    a, rgb = star_rgb(240)
    steps = [
        ('1', '打开素材', '拖进窗口 / Ctrl+V 粘贴 / 点「打开图片」', False),
        ('2', '抠掉背景', '魔棒点背景；容差 30 → 45 → 60 逐步加', False),
        ('3', '修边', '🧽 擦 / 🖌 补；40× 放大到像素级', False),
        ('4', '变清晰（可选）', '糊图先 2× 放大 + 去噪，再锐化', True),
        ('5', '用作指针画面', '✅ 一键进 ②，不用切块、不用导出中间文件', False),
        ('6', '设热点', '📍 放在“真正点下去”的那个点', False),
        ('7', '加帧（可选）', '🎞 多帧 = .ani 动画指针', True),
        ('8', '导出皮肤', 'ZIP → 安装皮肤.bat → 鼠标属性里选方案', False),
    ]
    cw, ch, gap = 330, 150, 22
    for i, (n, t, s, opt) in enumerate(steps):
        col, row = i % 4, i // 4
        x = 20 + col * (cw + gap)
        y = 92 + row * (ch + 46)
        fill = (250, 250, 252) if opt else (246, 251, 255)
        outline = (203, 203, 210) if opt else (196, 219, 245)
        d.rounded_rectangle([x, y, x + cw, y + ch], 14, fill=fill, outline=outline, width=2)
        d.ellipse([x + 16, y + 16, x + 46, y + 46], fill=(GOLD if not opt else (170, 178, 192)))
        d.text((x + 31, y + 24), n, font=F(15, True), fill=(58, 44, 8) if not opt else (255, 255, 255), anchor='ma')
        fit(d, (x + 58, y + 18), t, F(16, True), NAVY if not opt else SUB, cw - 74)
        for j, ln in enumerate(wrap(d, s, f_s, cw - 34)):
            fit(d, (x + 18, y + 62 + j * 22), ln, f_s, SUB)
        if opt:
            fit(d, (x + cw - 52, y + 18), '可选', F(11), (150, 150, 160))
        # 箭头
        if i % 4 != 3:
            ax = x + cw + 3
            d.line([ax, y + ch / 2, ax + gap - 8, y + ch / 2], fill=(160, 180, 210), width=3)
            d.polygon([(ax + gap - 8, y + ch / 2 - 6), (ax + gap - 8, y + ch / 2 + 6), (ax + gap - 2, y + ch / 2)], fill=(160, 180, 210))
        elif i != 7:
            d.line([x + cw / 2, y + ch + 4, x + cw / 2, y + ch + 34], fill=(160, 180, 210), width=3)
            d.polygon([(x + cw / 2 - 6, y + ch + 32), (x + cw / 2 + 6, y + ch + 32), (x + cw / 2, y + ch + 40)], fill=(160, 180, 210))
            d.line([x + cw / 2, y + ch + 38, 20 + cw / 2, y + ch + 38], fill=(160, 180, 210), width=3)
            d.polygon([(20 + cw / 2 + 2, y + ch + 32), (20 + cw / 2 + 2, y + ch + 44), (14 + cw / 2, y + ch + 38)], fill=(160, 180, 210))
    fit(d, (20, H - 44), '提示：整套皮肤只需做一张“箭头”图；其余 16 个角色会自动复用同一张图（也可在导出对话框里单独替换）。', F(12.5), SUB, W - 40)
    im.convert('RGB').save(OUT + '/fig2_flow.png', optimize=True)
    print('fig2', im.size)


# ================= 图 3：抠图四步真图 =================
def fig_cut():
    W, H = 1460, 470
    im, d = sheet(W, H, '抠图四步：同一张图的真实像素变化', '棋盘格 = 透明区域')
    a, rgb = star_rgb(300)
    on_white = over_white(rgb, a)          # ① 原图（白底，边缘被白污染）
    cleared = to_rgba(rgb, a)              # ② 抠掉背景（边缘留白雾）
    fixed_rgb = inpaint(rgb, a)            # ③ 去色边
    fixed = to_rgba(fixed_rgb, a)
    small = fixed.resize((64, 64), Image.Resampling.LANCZOS)

    cells = [
        ('① 原图', '白底不透明，边缘混了白色', Image.fromarray(on_white, 'RGB'), (255, 255, 255)),
        ('② 魔棒 / 抠掉浅色底', '背景变透明，但边缘留下白雾边', cleared, None),
        ('③ 一键精修边缘', '边缘像素换成邻近主体色，白边消失', fixed, None),
        ('④ 缩到 64×64', '实际指针大小（此处放大展示）', small, None),
    ]
    cw = 330
    for i, (t, s, img, flat) in enumerate(cells):
        x = 20 + i * (cw + 22)
        d.rounded_rectangle([x, 92, x + cw, 300], 12, fill=(252, 253, 255), outline=LINE, width=2)
        d.rectangle([x + 2, 94, x + cw - 2, 296], fill=(246, 249, 253))
        if flat is None:
            ck = checker(240, 20).convert('RGBA')
            im.alpha_composite(ck, (x + 45, 96))
            paste_center(im, img, (x + 4, 96, cw - 8, 198))
        else:
            paste_center(im, img, (x + 4, 96, cw - 8, 198))
        d = ImageDraw.Draw(im)
        fit(d, (x + 16, 310), t, F(14.5, True), NAVY, cw - 30)
        for j, ln in enumerate(wrap(d, s, f_s, cw - 32)):
            fit(d, (x + 16, 336 + j * 21), ln, f_s, SUB)
    fit(d, (20, H - 46), '说明：② 之前如果背景是浅粉/浅蓝，用「抠掉浅色底」(亮度≥205、饱和≤46) 一次就能整片去掉，比魔棒点十几次快。', F(12.5), SUB, W - 40)
    fit(d, (20, H - 22), '③ 的「去色边」强度 1 就够；白边很重时调到 2，再配「羽化 1」让边缘不发毛。', F(12.5), SUB, W - 40)
    im.convert('RGB').save(OUT + '/fig3_cut.png', optimize=True)
    print('fig3', im.size)


# ================= 图 4：尺寸对比 =================
def fig_sizes():
    W, H = 1460, 400
    im, d = sheet(W, H, '指针尺寸怎么选：同一张图在 6 种尺寸下的真实样子', '左 = 小尺寸（省资源、边缘更软），右 = 大尺寸（细节更多）')
    a, rgb = star_rgb(300)
    fixed = to_rgba(inpaint(rgb, a), a)
    sizes = [16, 32, 48, 64, 128, 256]
    cw = 218
    for i, s in enumerate(sizes):
        x = 22 + i * (cw + 20)
        d.rounded_rectangle([x, 92, x + cw, 330], 12, fill=(252, 253, 255), outline=LINE, width=2)
        ck = checker(180, 15).convert('RGBA')
        im.alpha_composite(ck, (x + 19, 100))
        thumb = fixed.resize((s, s), Image.Resampling.LANCZOS)
        im.alpha_composite(thumb, (x + 19 + (180 - s) // 2, 100 + (180 - s) // 2))
        d = ImageDraw.Draw(im)
        fit(d, (x + cw / 2, 292), '%d × %d' % (s, s), F(15, True), NAVY, cw - 20, anchor='ma')
        note = {16: '极小，看清轮廓', 32: '标准小箭头', 48: '常用', 64: '推荐默认', 128: '高清屏友好', 256: '极限（Windows 上限）'}[s]
        fit(d, (x + cw / 2, 314), note, F(11), SUB, cw - 16, anchor='ma')
    fit(d, (22, 344), '导出时「.cur 多尺寸」勾选 48 / 64 / 96，Windows 会按当前 DPI 自动挑最合适的一档；只勾一个尺寸在缩放显示器上会糊。',
        F(12.5), SUB, W - 44)
    im.convert('RGB').save(OUT + '/fig4_sizes.png', optimize=True)
    print('fig4', im.size)


# ================= 图 5：热点 =================
def fig_hotspot():
    W, H = 1460, 430
    im, d = sheet(W, H, '热点（Hotspot）：鼠标真正“点”下去的位置', '红色十字 = 热点；灰色虚线圈 = 你以为的点')
    a, rgb = star_rgb(300)
    fixed = to_rgba(inpaint(rgb, a), a)

    cases = [
        ('✅ 正确：箭尖', (0.5, 0.06), '左上角的箭尖、图形指向的那一端', OK),
        ('⚠️ 偏了：图形中心', (0.5, 0.5), '点按钮时总差半个图形，手感很飘', (200, 140, 20)),
        ('❌ 错误：画布左上角', (0.03, 0.03), '热点跑到图形外，点不准任何东西', BAD),
    ]
    cw = 330
    for i, (t, (fx, fy), s, col) in enumerate(cases):
        x = 20 + i * (cw + 22)
        d.rounded_rectangle([x, 92, x + cw, 300], 12, fill=(252, 253, 255), outline=LINE, width=2)
        ck = checker(200, 16).convert('RGBA')
        im.alpha_composite(ck, (x + 65, 96))
        im.alpha_composite(fixed, (x + 65, 96))
        d = ImageDraw.Draw(im)
        # 热点十字
        hx, hy = x + 65 + 200 * fx, 96 + 200 * fy
        d.ellipse([hx - 13, hy - 13, hx + 13, hy + 13], outline=col, width=3)
        d.line([hx - 20, hy, hx + 20, hy], fill=col, width=3)
        d.line([hx, hy - 20, hx, hy + 20], fill=col, width=3)
        fit(d, (x + 16, 306), t, F(14, True), col, cw - 30)
        for j, ln in enumerate(wrap(d, s, f_s, cw - 32)):
            fit(d, (x + 16, 330 + j * 21), ln, f_s, SUB)
    fit(d, (20, H - 46), '工具会自动猜一个热点：取「最上面一行不透明像素的平均 X」。箭头类基本准，圆形/人像请手动改。', F(12.5), SUB, W - 40)
    fit(d, (20, H - 22), '设置方式：② 指针设计 → 左侧 📍 → 在画布上点一下；或直接改右侧「热点 X / Y」数字。', F(12.5), SUB, W - 40)
    im.convert('RGB').save(OUT + '/fig5_hotspot.png', optimize=True)
    print('fig5', im.size)


# ================= 图 6：动画帧 =================
def fig_frames():
    W, H = 1460, 400
    im, d = sheet(W, H, '动画指针（.ani）：帧 + 每帧停留时间', '3 帧 × 120ms 的“旋转星星”')
    rots = [0, 0.22, 0.44, 0.66]
    cw = 250
    for i, r in enumerate(rots):
        x = 24 + i * (cw + 26)
        a, rgb = star_rgb(260, rot=r)
        fixed = to_rgba(inpaint(rgb, a), a)
        d.rounded_rectangle([x, 92, x + cw, 268], 12, fill=(252, 253, 255), outline=LINE, width=2)
        ck = checker(150, 15).convert('RGBA')
        im.alpha_composite(ck, (x + (cw - 150) // 2, 100))
        im.alpha_composite(fixed.resize((150, 150), Image.Resampling.LANCZOS), (x + (cw - 150) // 2, 100))
        d = ImageDraw.Draw(im)
        fit(d, (x + cw / 2, 276), '第 %d 帧 · 120 ms' % (i + 1), F(13, True), NAVY, cw - 20, anchor='ma')
        if i < 3:
            fit(d, (x + cw + 6, 170), '→', F(22), (170, 190, 215))
    # 时间轴
    d.rounded_rectangle([24, 306, 1000, 336], 8, fill=(243, 247, 252), outline=LINE)
    for i in range(4):
        x = 24 + i * 244
        d.rectangle([x + 2, 308, x + 242, 334], fill=(232, 240, 252) if i % 2 == 0 else (244, 248, 254))
        fit(d, (x + 122, 314), '120ms', F(11), SUB, anchor='ma')
    fit(d, (24, 346), '动画总时长 = 帧数 × 每帧 ms；右键托盘「时长→全部」可一次改齐。播放按钮在右下预览区，导出时自动打包成 .ani。',
        F(12.5), SUB, W - 48)
    d.rounded_rectangle([1080, 96, W - 24, 300], 12, fill=(249, 252, 255), outline=LINE)
    fit(d, (1096, 108), '什么时候需要动画？', F(14, True), NAVY, 320)
    tips = ['· 加载中（转圈、沙漏）', '· 忙碌状态（跳动、闪烁）', '· 纯装饰（尾巴摆动）',
            '· 帧数 3~8 足够；太多文件大、还容易掉帧']
    for j, t in enumerate(tips):
        fit(d, (1096, 136 + j * 24), t, f_s, SUB, 320)
    fit(d, (1096, 250), '只有 1 帧 → 导出 .cur（静态）', F(12.5), OK, 320)
    im.convert('RGB').save(OUT + '/fig6_frames.png', optimize=True)
    print('fig6', im.size)


# ================= 图 7：INF 安装原理 =================
def fig_inf():
    W, H = 1460, 430
    im, d = sheet(W, H, '为什么装完不会弄坏系统默认指针', 'INF 只“新增一个方案”，不覆盖原有指针文件')
    # 左：ZIP 内容
    d.rounded_rectangle([20, 92, 470, 372], 12, fill=(250, 252, 255), outline=LINE, width=2)
    fit(d, (36, 104), '导出的 ZIP 里有什么', F(15, True), NAVY)
    items = [('Install.inf', '方案定义（UTF-16，右键可安装）'),
             ('17 个 .cur / .ani', 'Arrow、Wait、Hand … 每个角色一个文件'),
             ('安装皮肤.bat', '申请管理员 → 复制到 C:\\Windows\\Cursors'),
             ('立即启用.bat', '写注册表 17 个值 + 通知系统刷新'),
             ('卸载皮肤.bat', '只删自己那一项方案'),
             ('恢复默认指针.bat', '一键回到 Windows 默认方案'),
             ('说明.txt', '角色 ↔ 文件名对照表')]
    for i, (a1, a2) in enumerate(items):
        y = 138 + i * 32
        d.rounded_rectangle([36, y + 4, 44, y + 12], 2, fill=GOLD)
        fit(d, (52, y), a1, F(12.5, True), NAVY, 150)
        fit(d, (200, y + 1), a2, F(11.5), SUB, 258)
    # 箭头
    d.line([476, 232, 526, 232], fill=(160, 180, 210), width=3)
    d.polygon([(524, 226), (524, 238), (536, 232)], fill=(160, 180, 210))
    # 中：注册表结构
    d.rounded_rectangle([542, 92, 980, 372], 12, fill=(250, 252, 255), outline=LINE, width=2)
    fit(d, (558, 104), '注册表里只是多了“一项”', F(15, True), NAVY)
    tree = [('HKCU\\Control Panel\\Cursors', '', SUB, 12.5),
            ('├─ (默认)', 'Windows 默认', SUB, 12),
            ('├─ Arrow', 'aero_arrow.cur', SUB, 12),
            ('└─ Schemes  ← 方案列表', '', NAVY2, 12.5),
            ('     ├─ Windows 默认', '系统自带', SUB, 12),
            ('     ├─ Windows 黑', '系统自带', SUB, 12),
            ('     └─ ★ 你的皮肤名', '17 个路径，全部指向自己的文件夹', OK, 12)]
    for i, (t1, t2, col, sz) in enumerate(tree):
        y = 138 + i * 30
        fit(d, (558 + (18 if i in (1, 2, 4, 5, 6) else 0), y), t1, F(sz, i in (0, 3)), col, 300)
        if t2:
            fit(d, (830, y + 1), t2, F(11.5), SUB, 140)
    fit(d, (558, 344), '系统自带的 Aero 指针文件一个字节都没动', F(12), OK, 400)
    # 右：装在哪
    d.rounded_rectangle([996, 92, W - 20, 372], 12, fill=(250, 252, 255), outline=LINE, width=2)
    fit(d, (1012, 104), '文件落在独立文件夹', F(15, True), NAVY)
    fit(d, (1012, 140), 'C:\\Windows\\Cursors\\', F(12.5), SUB)
    fit(d, (1012, 162), '└─ <你的皮肤名>\\', F(12.5, True), NAVY2)
    for i, n in enumerate(['pointer.cur', 'work.ani', 'busy.ani', 'hand.cur', '… 共 17 个']):
        fit(d, (1040, 186 + i * 24), n, F(12), SUB)
    fit(d, (1012, 316), '卸载 = 删这个文件夹 + 删 Schemes 里那一项', F(12), SUB, 420)
    fit(d, (1012, 340), '不会影响任何系统自带方案', F(12, True), OK)
    im.convert('RGB').save(OUT + '/fig7_inf.png', optimize=True)
    print('fig7', im.size)


if __name__ == '__main__':
    fig_ui(); fig_flow(); fig_cut(); fig_sizes(); fig_hotspot(); fig_frames(); fig_inf()
    for f in sorted(os.listdir(OUT)):
        print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB')
