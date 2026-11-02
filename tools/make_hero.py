"""주인공(무림 검객) 도트 스프라이트 생성기 - 오리지널 디자인.

컨셉: 높이 묶은 검은 머리, 검은 무복에 붉은 교차 깃, 허리띠, 어깨 옆에 세운 검.
한 픽셀씩 직접 찍어 만들고(정면, 걷기 4프레임), 자동 외곽선을 붙인다.
결과: tools/hero_sheet.png (24x24 칸 4개를 세로로 이어붙임) -> tools/build_assets.py 가 읽는다.
실행: python tools/make_hero.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CELL, W, H, OX, OY = 30, 20, 26, 3, 6


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


K = hx('#17121f')
HAIR, HAIR_L = hx('#2b2536'), hx('#4d4764')
SKIN, SKIN_S = hx('#f3cba3'), hx('#d9a47c')
EYE, EYE_W = hx('#1a1324'), hx('#ffffff')
ROBE, ROBE_L, ROBE_D = hx('#2b2b39'), hx('#42425a'), hx('#1e1e29')
COL, COL_D, PINK = hx('#c8374f'), hx('#8e2340'), hx('#ffa6bd')
SASH, GOLD, GOLD_D = hx('#1c1c25'), hx('#e6b53f'), hx('#a8801f')
BLADE, BLADE_S = hx('#e9f0fa'), hx('#9fb0cb')
BOOT, BOOT_L = hx('#2a2330'), hx('#463d52')


class Pix:
    def __init__(self):
        self.p = {}

    def put(self, x, y, c):
        self.p[(x, y)] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c)

    def image(self):
        im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        occ = {(x + OX, y + OY): c for (x, y), c in self.p.items()}
        for (x, y), c in occ.items():
            if 0 <= x < CELL and 0 <= y < CELL:
                im.putpixel((x, y), c)
        for (x, y) in list(occ):                        # 자동 외곽선
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n not in occ and 0 <= n[0] < CELL and 0 <= n[1] < CELL:
                    im.putpixel(n, K)
        return im


def hero(f):
    g = Pix()
    b = 1 if f in (1, 3) else 0                         # 걸음마다 상체가 한 칸 위로
    sway = (0, 1, 0, -1)[f]                             # 머리카락 흔들림
    lift_l, lift_r = f == 1, f == 3

    # ── 어깨 옆에 세운 검 (몸 뒤) ──
    g.put(15, 1 - b, BLADE); g.rect(15, 2 - b, 15, 11 - b, BLADE); g.rect(16, 3 - b, 16, 11 - b, BLADE_S)
    g.rect(14, 12 - b, 16, 12 - b, GOLD); g.put(14, 12 - b, GOLD_D)
    g.rect(15, 13 - b, 15, 14 - b, BOOT); g.put(15, 15 - b, GOLD)

    # ── 머리카락: 높이 묶은 꼬리, 붉은 끈, 늘어진 긴 머리 ──
    g.rect(8, -3 - b, 10, -3 - b, HAIR); g.rect(7, -2 - b, 11, -2 - b, HAIR); g.rect(7, -1 - b, 10, -1 - b, HAIR)
    g.put(11, -3 - b, HAIR); g.put(12, -2 - b, HAIR_L)                                              # 휘날리는 꼬리 끝
    g.rect(8, 0 - b, 9, 0 - b, COL)                                                                  # 붉은 머리끈
    g.rect(5, 1 - b, 11, 1 - b, HAIR); g.rect(4, 2 - b, 12, 3 - b, HAIR)
    g.rect(6, 2 - b, 8, 2 - b, HAIR_L)
    g.rect(4, 4 - b, 7, 4 - b, HAIR); g.rect(9, 4 - b, 12, 4 - b, HAIR)                            # 가르마 앞머리
    g.rect(4, 5 - b, 4, 8 - b, HAIR); g.rect(12, 5 - b, 12, 8 - b, HAIR)                            # 귀 옆 머리
    for y in range(4, 14):                                                                           # 왼쪽으로 늘어진 긴 머리
        sh = sway if y > 9 else 0
        g.put(3 + sh, y - b, HAIR); g.put(2 + sh, y - b, HAIR)
    g.put(2 + sway, 13 - b, HAIR_L); g.put(2 + sway, 14 - b, HAIR)

    # ── 얼굴 ──
    g.rect(5, 5 - b, 11, 8 - b, SKIN); g.put(8, 4 - b, SKIN); g.rect(6, 9 - b, 10, 9 - b, SKIN)
    g.put(5, 8 - b, SKIN_S); g.put(11, 8 - b, SKIN_S)
    for ex in (6, 10):
        g.rect(ex, 6 - b, ex, 7 - b, EYE)
    g.put(7, 5 - b, HAIR)                                                                           # 흘러내린 앞머리 한 올
    g.put(8, 8 - b, SKIN_S); g.put(9, 8 - b, SKIN_S)                                               # 비스듬한 미소
    g.rect(7, 10 - b, 9, 10 - b, SKIN_S)                                                           # 목

    # ── 무복 상체 ──
    g.rect(4, 10 - b, 12, 16 - b, ROBE); g.rect(4, 10 - b, 5, 16 - b, ROBE_L); g.rect(11, 10 - b, 12, 16 - b, ROBE_D)
    # 붉은 교차 깃: 왼쪽 어깨에서 오른쪽 허리로 비스듬히
    for i in range(6):
        g.put(5 + i, 10 + i - b, COL); g.put(6 + i, 10 + i - b, COL if i % 2 == 0 else COL_D)
    g.put(11, 10 - b, COL); g.put(10, 10 - b, COL); g.put(10, 11 - b, COL_D)
    g.put(8, 11 - b, SKIN_S); g.put(9, 11 - b, SKIN_S)
    # 가슴의 매화 문양
    g.put(11, 13 - b, PINK); g.put(10, 13 - b, COL); g.put(12, 13 - b, COL); g.put(11, 12 - b, COL); g.put(11, 14 - b, COL_D)
    # 소매와 손
    g.rect(2, 11 - b, 3, 16 - b, ROBE_L); g.rect(2, 16 - b, 3, 16 - b, ROBE_D); g.rect(2, 17 - b, 3, 17 - b, SKIN)
    g.rect(13, 11 - b, 14, 12 - b, ROBE_D); g.rect(14, 13 - b, 14, 14 - b, SKIN)
    # 허리띠와 매듭, 늘어진 끈
    g.rect(4, 17 - b, 12, 17 - b, SASH); g.rect(8, 17 - b, 9, 18 - b, SASH)
    g.rect(10, 18 - b, 10, 20 - b, SASH); g.rect(8, 19 - b, 8, 20 - b, SASH)
    # 아래 자락
    g.rect(4, 18 - b, 12, 19 - b, ROBE_D); g.rect(4, 18 - b, 5, 19 - b, ROBE); g.put(8, 19 - b, K)

    # ── 바지와 신발 ──
    if lift_l:
        g.rect(9, 19, 11, 21, ROBE_D); g.rect(9, 22, 12, 22, BOOT)
        g.rect(5, 19, 7, 20, ROBE_D); g.rect(4, 21, 7, 21, BOOT); g.put(4, 21, BOOT_L)
    elif lift_r:
        g.rect(5, 19, 7, 21, ROBE_D); g.rect(4, 22, 7, 22, BOOT)
        g.rect(9, 19, 11, 20, ROBE_D); g.rect(9, 21, 12, 21, BOOT); g.put(12, 21, BOOT_L)
    else:
        g.rect(5, 19, 7, 21, ROBE_D); g.rect(9, 19, 11, 21, ROBE_D)
        g.rect(4, 22, 7, 22, BOOT); g.rect(9, 22, 12, 22, BOOT); g.put(4, 22, BOOT_L); g.put(9, 22, BOOT_L)
    return g.image()


def main():
    sheet = Image.new('RGBA', (CELL, CELL * 4), (0, 0, 0, 0))
    for f in range(4):
        sheet.paste(hero(f), (0, f * CELL))
    sheet.save(os.path.join(HERE, 'hero_sheet.png'))
    pv = Image.new('RGBA', (CELL * 4, CELL), (28, 42, 70, 255))
    for f in range(4):
        pv.alpha_composite(sheet.crop((0, f * CELL, CELL, f * CELL + CELL)), (f * CELL, 0))
    pv.resize((pv.width * 10, pv.height * 10), Image.NEAREST).save(os.path.join(HERE, '_hero_preview.png'))
    print('ok')


if __name__ == '__main__':
    main()
