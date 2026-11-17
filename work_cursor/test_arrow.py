# -*- coding: utf-8 -*-
import sys, math
sys.path.insert(0, '.')
from curlib import *
from PIL import Image

S = 100.0  # design units


def arrow_pts(sx=1.0, sy=1.0, dx=0.0, dy=0.0):
    base = [(0.00, 0.00), (0.00, 0.80), (0.27, 0.615), (0.455, 0.995),
            (0.60, 0.935), (0.435, 0.565), (0.735, 0.565)]
    return [(p[0]*S*sx+dx, p[1]*S*sy+dy) for p in base]


def draw_arrow(cv, dx=0.0, dy=0.0, sc=1.0):
    pts = arrow_pts(sc, sc, dx, dy)
    m = cv.mask(pts)
    cv.glow(m, (120, 200, 255, 255), 3.6, 0.85)
    cv.outline(pts, WHITE, 3.2)
    cv.fill(pts, (10, 26, 56, 255), (48, 104, 178, 255), vertical=True)
    # inner highlight along left edge
    cv.stroke([(p[0]*0.82+3, p[1]*0.82+3) for p in [(0.03, 0.06), (0.03, 0.55)]], (150, 210, 255, 90), 1.6)
    return pts


cv = Canvas(S, S, ss=8)
p = draw_arrow(cv, 4, 4, 0.72)
# bow at the barb
bow(cv, 14, 60, 26, 22, -18)
gem_drop(cv, 14, 82, 12, 20, 6)
cv.out(400).save('./test_arrow.png')
print('ok')
