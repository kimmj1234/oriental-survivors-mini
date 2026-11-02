"""동양식 아이콘(items.png)과 맵 장식(decor.png) 생성기 (Pillow만 사용).

items.png 칸: 0~2 구슬(파랑·초록·빨강) / 3 복숭아(회복) / 4 부적 / 5 쿠나이 / 6 낫 / 7 풍차 수리검 / 8 도도깨비불 /
              9 적 탄(원귀 불꽃) / 10 향로 / 11 인장 / 12 투구 / 13 호리병 / 14 날개 나막신 / 15 태극 / 16 엽전 꿰미
decor.png 칸: 0·1 흙 / 2 꽃 / 3 풀 / 4 괴석 / 5 대나무 / 6 소나무 / 7 벚나무 / 8 마른 나무 / 9 비석 / 10 봉분 /
              11 석등 / 12 장승 / 13 해골 / 14 디딤돌 / 15 홍살문 / 16 연못
"""
import math, os, random
from PIL import Image
from make_sprites import Canvas, S, hx, OUT

WHITE, INK = hx('#ffffff'), hx('#2a1f14')
STEEL, STEEL_D, STEEL_L = hx('#c9d3e6'), hx('#8b97b5'), hx('#eef3ff')
GOLD, GOLD_D = hx('#e8b83a'), hx('#b58722')
RED, RED_D = hx('#c8322e'), hx('#8f1f1f')
WOOD, WOOD_D, WOOD_L = hx('#8a5a2b'), hx('#5e3b1b'), hx('#b07a3f')


def ring(c, cx, cy, r0, r1, col):
    for y in range(S):
        for x in range(S):
            d = math.hypot(x - cx, y - cy)
            if r0 <= d <= r1:
                c.px(x, y, col)


# ───────── 아이콘 ─────────
def pearl(main, dark, light):
    c = Canvas()
    c.ell(18, 18, 7, 7, dark); c.ell(17, 17, 6, 6, main); c.ell(15, 15, 2.4, 2.4, light); c.px(20, 21, dark)
    return c.finish(bevel=False)


def peach():                              # 회복: 복숭아
    c = Canvas()
    c.ell(18, 21, 10, 9.5, hx('#ffb7a1')); c.ell(22, 23, 6, 6, hx('#ff8795')); c.ell(14, 17, 3, 3, hx('#ffe0d4'))
    c.line(18, 12, 18, 31, hx('#e88a85'))
    c.poly([(18, 12), (27, 6), (25, 13), (19, 13)], hx('#4fa84a')); c.line(18, 12, 17, 8, WOOD)
    return c.finish()


def talisman():                           # 부적(마법 지팡이 대체): 노란 종이 + 붉은 글씨
    c = Canvas(); P, PD = hx('#f6e7a8'), hx('#d6bf6a')
    c.rect(12, 4, 24, 32, P); c.rect(12, 4, 13, 32, hx('#fff6cc')); c.rect(23, 4, 24, 32, PD)
    c.rect(12, 4, 24, 7, RED)
    c.rect(17, 10, 19, 29, RED); c.rect(14, 13, 22, 14, RED); c.rect(14, 19, 22, 20, RED); c.rect(14, 25, 22, 26, RED)
    c.px(15, 9, RED); c.px(21, 9, RED); c.px(15, 30, RED); c.px(21, 30, RED)
    return c.finish()


def kunai():                              # 쿠나이
    c = Canvas()
    c.poly([(33, 18), (18, 12), (14, 18), (18, 24)], STEEL); c.poly([(33, 18), (18, 18), (14, 18), (18, 24)], STEEL_D)
    c.line(32, 18, 17, 18, STEEL_L)
    c.rect(11, 15, 15, 21, hx('#3a3f5a')); c.rect(11, 15, 11, 21, hx('#565c80'))
    for x in (12, 14): c.line(x, 15, x, 21, RED)
    ring(c, 7, 18, 2.2, 4.4, STEEL_D)
    return c.finish()


def kama():                               # 낫(도끼 대체)
    c = Canvas()
    c.rect(16, 8, 19, 33, WOOD); c.rect(16, 8, 17, 33, WOOD_L); c.rect(16, 28, 19, 33, WOOD_D)
    c.poly([(19, 7), (27, 4), (33, 8), (34, 15), (30, 11), (24, 10), (19, 12)], STEEL)
    c.poly([(19, 10), (24, 10), (30, 11), (34, 15), (29, 14), (19, 13)], STEEL_D)
    c.rect(15, 7, 20, 9, GOLD_D)
    return c.finish()


def shuriken():                           # 풍차 수리검(십자가 대체)
    c = Canvas()
    c.poly([(18, 2), (21, 15), (34, 18), (21, 21), (18, 34), (15, 21), (2, 18), (15, 15)], STEEL)
    c.poly([(18, 18), (21, 21), (18, 34), (15, 21)], STEEL_D); c.poly([(18, 18), (21, 15), (34, 18), (21, 21)], STEEL_D)
    c.line(18, 4, 18, 14, STEEL_L); c.line(4, 18, 14, 18, STEEL_L)
    c.ell(18, 18, 2.6, 2.6, hx('#2a2f3d'))
    return c.finish()


def hitodama():                           # 도깨비불(성서 대체): 푸른 혼불
    c = Canvas()
    c.poly([(18, 2), (11, 16), (25, 16)], hx('#4fb8e8'))
    c.ell(18, 21, 9, 9, hx('#4fb8e8')); c.ell(18, 22, 6.5, 6.5, hx('#9fe4ff')); c.ell(17, 22, 3.5, 3.5, hx('#eafaff'))
    c.px(14, 18, WHITE); c.px(22, 19, hx('#c8f2ff'))
    return c.finish(bevel=False, outline='#1b2b5a')


def bullet():                             # 적 탄: 원귀 불꽃
    c = Canvas()
    c.ell(18, 18, 6, 6, hx('#b04dff')); c.ell(18, 18, 3.6, 3.6, hx('#e2b8ff')); c.px(17, 17, WHITE)
    return c.finish(bevel=False, outline='#2a1040')


def censer():                             # 향로(마늘 대체)
    c = Canvas(); B, BD, BL = hx('#b07a3a'), hx('#7a5224'), hx('#e0b068')
    for x in (11, 17, 23): c.rect(x, 28, x + 2, 32, BD)
    c.ell(18, 24, 11, 7, B); c.rect(7, 22, 29, 24, BL); c.ell(18, 18, 8, 4, BD)
    c.poly([(11, 19), (25, 19), (22, 14), (14, 14)], B); c.rect(16, 11, 20, 14, GOLD)
    c.line(18, 10, 15, 6, hx('#dfe6ef')); c.line(15, 6, 18, 3, hx('#cfd8e6')); c.line(19, 9, 22, 5, hx('#dfe6ef')); c.px(22, 4, hx('#cfd8e6'))
    c.line(10, 24, 26, 24, BD)
    return c.finish()


def seal():                               # 인장(파워)
    c = Canvas()
    c.rect(14, 3, 22, 11, hx('#eadcb0')); c.rect(14, 3, 16, 11, WHITE)
    c.rect(9, 12, 27, 30, RED); c.rect(9, 12, 11, 30, hx('#e45a52')); c.rect(25, 12, 27, 30, RED_D)
    for rect in ((14, 16, 22, 17), (17, 16, 19, 27), (13, 21, 23, 22), (14, 26, 22, 27)):
        c.rect(*rect, hx('#fbe9e0'))
    return c.finish()


def kabuto():                             # 투구(갑옷)
    c = Canvas(); H, HD = hx('#6a7aa8'), hx('#444f78')
    c.poly([(5, 22), (31, 22), (33, 31), (3, 31)], HD)
    for x in (9, 14, 19, 24): c.line(x, 23, x - 1, 31, hx('#2e3658'))
    c.ell(18, 17, 11, 9, H); c.ell(14, 12, 4, 3, hx('#9aaad8'))
    c.rect(6, 20, 30, 23, GOLD)
    c.poly([(18, 2), (12, 10), (18, 8), (24, 10)], GOLD); c.px(18, 14, RED)
    return c.finish()


def gourd():                              # 호리병(최대 체력)
    c = Canvas(); G, GL = hx('#d9962a'), hx('#f1c25d')
    c.rect(16, 3, 20, 6, WOOD); c.ell(18, 11, 5.5, 5.5, G); c.ell(18, 24, 10, 9, G)
    c.rect(14, 15, 22, 17, RED); c.line(14, 17, 12, 22, RED)
    c.ell(15, 9, 1.8, 1.8, GL); c.ell(13, 22, 3, 3, GL)
    return c.finish()


def geta():                               # 날개 달린 나막신(이동 속도)
    c = Canvas()
    c.poly([(7, 22), (28, 22), (31, 27), (6, 27)], WOOD_L); c.rect(6, 26, 31, 27, WOOD)
    c.rect(11, 27, 14, 32, WOOD_D); c.rect(22, 27, 25, 32, WOOD_D)
    c.line(18, 12, 10, 22, RED); c.line(18, 12, 26, 22, RED); c.line(19, 12, 11, 22, RED_D); c.line(19, 12, 27, 22, RED_D)
    c.poly([(7, 17), (0, 9), (3, 17), (0, 22), (8, 23)], hx('#f6f9ff')); c.poly([(7, 19), (2, 17), (4, 21), (8, 24)], hx('#c6d2ee'))
    return c.finish()


def taegeuk():                            # 태극(쿨다운)
    c = Canvas(); R_, B_ = hx('#d63a3a'), hx('#2f58b8')
    for y in range(S):
        for x in range(S):
            dx, dy = x - 17.5, y - 17.5
            if math.hypot(dx, dy) > 12.5:
                continue
            col = R_ if dy < 0 else B_
            if math.hypot(dx, dy + 6.2) <= 6.2: col = B_
            if math.hypot(dx, dy - 6.2) <= 6.2: col = R_
            if math.hypot(dx, dy + 6.2) <= 2: col = R_
            if math.hypot(dx, dy - 6.2) <= 2: col = B_
            c.px(x, y, col)
    return c.finish(bevel=False)


def coins():                              # 엽전 꿰미(자석)
    c = Canvas()
    c.line(18, 2, 18, 33, RED)
    for cy in (9, 18, 27):
        c.ell(18, cy, 7, 7, GOLD_D); c.ell(18, cy, 6, 6, GOLD); c.ell(15, cy - 2, 1.5, 1.5, hx('#fff0a8'))
        c.rect(16, cy - 2, 20, cy + 2, INK)
    return c.finish()


# ───────── 맵 장식 ─────────
def dirt_patch(seed):
    c = Canvas(); rnd = random.Random(seed)
    base, mid, lite = hx('#4a3a28'), hx('#5b4832'), hx('#6d5a40')
    blobs = [(18, 18, 14, 9), (10 + rnd.randint(-2, 2), 17, 8, 6), (26, 19, 8, 6), (16, 14, 7, 5)]
    for cx, cy, rx, ry in blobs:
        c.ell(cx, cy, rx, ry, base)
    for cx, cy, rx, ry in blobs[:2]:
        c.ell(cx, cy - 1, rx * .6, ry * .6, mid)
    for _ in range(14):
        c.px(rnd.randint(7, 29), rnd.randint(12, 24), lite)
    return c.finish(bevel=False, outline=None)


def flowers():
    c = Canvas(); rnd = random.Random(5)
    for _ in range(9):
        x, y = rnd.randint(8, 28), rnd.randint(12, 26)
        c.line(x, y, x, y + 2, hx('#3f8a52'))
        c.px(x, y - 1, hx(rnd.choice(['#ffffff', '#ffd84a', '#ff8fb5', '#c9a6ff'])))
    return c.finish(bevel=False, outline=None)


def grass_tuft():
    c = Canvas()
    for x, h in ((13, 6), (15, 9), (17, 7), (19, 10), (21, 6), (23, 8)):
        c.line(x, 29, x + (1 if x < 18 else -1), 29 - h, hx('#4aa65a'))
        c.px(x, 29 - h, hx('#7fd08a'))
    return c.finish(bevel=False, outline=None)


def scholar_rock():                       # 괴석: 구멍 뚫린 이끼 낀 바위
    c = Canvas()
    c.poly([(9, 33), (7, 22), (11, 11), (16, 4), (22, 7), (27, 15), (29, 33)], hx('#8a92a3'))
    c.poly([(16, 4), (22, 7), (27, 15), (29, 33), (20, 33), (21, 16)], hx('#6e768a'))
    c.poly([(11, 11), (16, 4), (17, 14), (12, 22)], hx('#a8b0c4'))
    c.ell(16, 19, 2.6, 3.8, hx('#2c313d')); c.ell(22, 12, 1.5, 2, hx('#2c313d'))
    c.ell(14, 32, 6, 2.5, hx('#3c8a4a')); c.ell(25, 31, 3, 2, hx('#3c8a4a'))
    return c.finish()


def bamboo():                             # 대나무
    c = Canvas(); G, GD, GL = hx('#4aa65a'), hx('#2f7a42'), hx('#7fd08a')
    for x, top in ((8, 6), (16, 2), (24, 8), (30, 11)):
        c.rect(x, top, x + 2, 33, G); c.rect(x, top, x, 33, GL); c.rect(x + 2, top, x + 2, 33, GD)
        for y in range(top + 5, 33, 7): c.rect(x - 1, y, x + 3, y, GD)
        c.poly([(x + 3, top + 3), (x + 9, top), (x + 5, top + 5)], GL)
        c.poly([(x - 1, top + 9), (x - 7, top + 6), (x - 3, top + 11)], G)
    return c.finish()


def korean_pine():                        # 소나무: 굽은 줄기 + 층진 솔잎
    c = Canvas(); T, TD = hx('#7a4a2a'), hx('#4e2f1a')
    c.poly([(16, 34), (21, 34), (22, 24), (19, 18), (23, 10), (20, 9), (16, 17), (17, 25)], T)
    c.line(21, 20, 25, 14, T)
    for cx, cy, rx, ry in ((18, 8, 11, 4), (10, 16, 8, 3.5), (27, 15, 7, 3.2), (24, 24, 8, 3.2)):
        c.ell(cx, cy, rx, ry, hx('#1f5e36')); c.ell(cx, cy - 1, rx * .8, ry * .6, hx('#2f8a4e'))
        c.ell(cx - rx * .3, cy - 1.5, rx * .35, ry * .3, hx('#56b672'))
    c.rect(16, 30, 17, 34, TD)
    return c.finish()


def cherry_tree():                        # 벚나무(매화): 분홍 꽃구름
    c = Canvas()
    c.rect(15, 24, 20, 34, hx('#5e3b2a')); c.rect(15, 24, 16, 34, hx('#7a4e3a')); c.line(18, 25, 24, 17, hx('#5e3b2a')); c.line(17, 26, 11, 19, hx('#5e3b2a'))
    c.ell(18, 13, 12, 10, hx('#e98fb0')); c.ell(9, 19, 7, 6, hx('#e98fb0')); c.ell(27, 19, 7, 6, hx('#d97a9f'))
    c.ell(14, 9, 6, 4, hx('#ffc4d8')); c.ell(22, 12, 3, 2, hx('#ffd8e6')); c.ell(8, 17, 3, 2, hx('#ffc4d8'))
    for x, y in ((12, 15), (20, 8), (25, 17), (17, 19), (6, 21), (29, 22)): c.px(x, y, WHITE)
    for x, y in ((14, 31), (22, 32), (11, 29)): c.px(x, y, hx('#ffc4d8'))
    return c.finish()


def dead_tree():
    c = Canvas(); B, BL = hx('#4e3a2e'), hx('#6f5645')
    c.poly([(16, 34), (20, 34), (19, 18), (17, 18)], B)
    c.line(18, 20, 8, 10, B); c.line(18, 17, 27, 8, B); c.line(17, 24, 10, 20, B); c.line(19, 22, 26, 17, B)
    c.line(8, 10, 6, 6, B); c.line(8, 10, 11, 5, B); c.line(27, 8, 30, 5, B); c.line(27, 8, 29, 11, B)
    c.rect(16, 24, 16, 33, BL)
    return c.finish()


def stele():                              # 비석: 한자 새긴 돌비
    c = Canvas(); G, GL, GD = hx('#8b93a6'), hx('#a8b0c4'), hx('#5f6678')
    c.rect(9, 30, 27, 33, GD)
    c.rect(11, 10, 25, 31, G); c.ell(18, 10, 7, 4.5, G); c.rect(11, 10, 13, 31, GL); c.rect(23, 10, 25, 31, GD)
    for x in (15, 18, 21):
        for y in range(14, 28, 3): c.rect(x, y, x, y + 1, GD)
    c.px(18, 8, RED); c.px(17, 8, RED); c.px(19, 8, RED)
    c.ell(13, 31, 3.5, 1.8, hx('#3c8a4a'))
    return c.finish()


def mound():                              # 봉분(둥근 무덤) + 작은 상석
    c = Canvas()
    c.ell(18, 28, 14, 9, hx('#3c8a4a')); c.ell(14, 24, 6, 3, hx('#5bbd72')); c.ell(24, 30, 6, 3, hx('#2f7a42'))
    c.rect(15, 20, 21, 28, hx('#8b93a6')); c.rect(15, 20, 16, 28, hx('#a8b0c4')); c.rect(20, 20, 21, 28, hx('#5f6678'))
    c.rect(17, 22, 19, 22, hx('#5f6678')); c.rect(17, 24, 19, 24, hx('#5f6678'))
    return c.finish()


def stone_lantern():                      # 석등
    c = Canvas(); G, GD, GL = hx('#9aa2b4'), hx('#656d80'), hx('#bcc4d6')
    c.rect(12, 30, 24, 33, GD); c.rect(15, 28, 21, 30, G)
    c.rect(16, 21, 20, 28, G); c.rect(16, 21, 17, 28, GL)
    c.rect(11, 13, 25, 21, G); c.rect(11, 13, 12, 21, GL); c.rect(24, 13, 25, 21, GD)
    c.rect(14, 15, 22, 19, hx('#ffd27a')); c.rect(16, 16, 20, 18, hx('#fff0b8'))
    c.poly([(6, 13), (30, 13), (24, 7), (12, 7)], GD); c.rect(6, 12, 30, 13, G)
    c.ell(18, 5, 2.4, 2.4, G)
    return c.finish()


def jangseung():                          # 장승
    c = Canvas()
    c.rect(12, 8, 24, 34, WOOD); c.rect(12, 8, 14, 34, WOOD_L); c.rect(22, 8, 24, 34, WOOD_D)
    c.poly([(8, 9), (28, 9), (23, 3), (13, 3)], hx('#3a4a6a')); c.rect(8, 8, 28, 9, hx('#566a92'))
    c.ell(14.5, 14, 2.8, 2.8, WHITE); c.ell(21.5, 14, 2.8, 2.8, WHITE); c.rect(14, 14, 15, 15, INK); c.rect(21, 14, 22, 15, INK)
    c.rect(17, 15, 19, 19, WOOD_D)
    c.rect(14, 22, 22, 24, WHITE); c.rect(15, 22, 15, 24, INK); c.rect(18, 22, 18, 24, INK); c.rect(21, 22, 21, 24, INK)
    c.rect(13, 18, 14, 19, RED); c.rect(22, 18, 23, 19, RED)
    c.rect(12, 28, 24, 29, RED_D)
    return c.finish()


def bones():
    c = Canvas(); B = hx('#e8e2cf')
    c.ell(14, 24, 5, 4, B); c.px(12, 24, INK); c.px(15, 24, INK); c.rect(12, 27, 16, 28, B)
    c.line(20, 22, 30, 28, B); c.line(21, 27, 29, 21, B); c.px(30, 28, B); c.px(29, 21, B)
    return c.finish(outline='#3a2c22', bevel=False)


def stepping_stones():                    # 디딤돌
    c = Canvas(); G, GL = hx('#7d8497'), hx('#a0a8bc')
    for cx, cy, rx, ry in ((9, 22, 5, 3), (19, 25, 6, 3.4), (28, 20, 5, 3)):
        c.ell(cx, cy + 1, rx, ry, hx('#4e5468')); c.ell(cx, cy, rx, ry, G); c.ell(cx - 1, cy - 1, rx * .5, ry * .4, GL)
    return c.finish(bevel=False, outline=None)


def gate():                               # 홍살문
    c = Canvas()
    for x in (5, 28):
        c.rect(x, 12, x + 3, 33, RED); c.rect(x, 12, x, 33, hx('#e45a52')); c.rect(x + 3, 12, x + 3, 33, RED_D)
        c.rect(x - 1, 31, x + 4, 33, hx('#7d8497'))
    c.rect(3, 10, 33, 13, RED_D); c.rect(3, 10, 33, 10, RED)
    for x in range(6, 31, 3): c.rect(x, 5, x, 10, hx('#3a3f5a'))
    c.rect(6, 5, 30, 5, hx('#3a3f5a'))
    c.rect(4, 17, 32, 18, RED_D)
    return c.finish()


def pond():                               # 연못(바닥 데칼)
    c = Canvas()
    c.ell(18, 20, 16, 9.5, hx('#2a4a66')); c.ell(18, 20, 15, 8.5, hx('#2f8fb0')); c.ell(15, 18, 10, 5.5, hx('#55bcdb'))
    for cx, cy in ((11, 21), (22, 17), (26, 22)):
        c.ell(cx, cy, 3.2, 2, hx('#3f9a55')); c.px(cx + 1, cy - 1, hx('#ffb7d0')); c.px(cx, cy - 1, WHITE)
    c.px(17, 16, hx('#9fd8ee')); c.px(20, 23, hx('#9fd8ee'))
    return c.finish(bevel=False, outline=None)


def items_sheet():
    fns = [lambda: pearl(hx('#4aa3ff'), hx('#2a62b8'), hx('#cfe6ff')),
           lambda: pearl(hx('#4fd97a'), hx('#2a9150'), hx('#d6ffe2')),
           lambda: pearl(hx('#ff5b5b'), hx('#b02a2a'), hx('#ffdede')),
           peach, talisman, kunai, kama, shuriken, hitodama, bullet,
           censer, seal, kabuto, gourd, geta, taegeuk, coins]
    im = Image.new('RGBA', (S * 2 * len(fns), S * 2), (0, 0, 0, 0))
    for i, fn in enumerate(fns):
        im.paste(fn().image(), (i * S * 2, 0))
    return im


DECOR = [lambda: dirt_patch(1), lambda: dirt_patch(2), flowers, grass_tuft, scholar_rock, bamboo, korean_pine, cherry_tree,
         dead_tree, stele, mound, stone_lantern, jangseung, bones, stepping_stones, gate, pond]


def decor_sheet():
    im = Image.new('RGBA', (S * 2 * len(DECOR), S * 2), (0, 0, 0, 0))
    for i, fn in enumerate(DECOR):
        im.paste(fn().image(), (i * S * 2, 0))
    return im
