"""픽셀 스프라이트 생성기 (Pillow만 사용, 외부 서비스·키 불필요).

36x36 격자에 그린 뒤 2배 확대해 72x72 PNG로 저장한다.
  - 캐릭터 시트: 72x72 프레임 2장을 가로로 이어붙인 144x72
  - items.png  : 72x72 아이템 10개를 가로로 이어붙인 720x72
  - ground.png : 72x72 이음매 없는 바닥 타일
실행: python tools/make_sprites.py
"""
import os, random
from PIL import Image

S = 36
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def mul(c, k):
    return (min(255, int(c[0] * k)), min(255, int(c[1] * k)), min(255, int(c[2] * k)), c[3])


class Canvas:
    def __init__(self):
        self.p = [[None] * S for _ in range(S)]

    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S:
            self.p[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.px(x, y, c)

    def ell(self, cx, cy, rx, ry, c):
        for y in range(S):
            for x in range(S):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                    self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def poly(self, pts, c):
        n = len(pts)
        for y in range(S):
            for x in range(S):
                px_, py_, inside, j = x + .5, y + .5, False, n - 1
                for i in range(n):
                    xi, yi = pts[i]; xj, yj = pts[j]
                    if (yi > py_) != (yj > py_) and px_ < (xj - xi) * (py_ - yi) / (yj - yi + 1e-9) + xi:
                        inside = not inside
                    j = i
                if inside:
                    self.px(x, y, c)

    def finish(self, outline='#15111f', bevel=True):
        p = self.p
        q = [row[:] for row in p]
        if bevel:
            for y in range(S):
                for x in range(S):
                    if p[y][x] is None:
                        continue
                    c = p[y][x]
                    up = p[y - 1][x] if y > 0 else None
                    dn = p[y + 1][x] if y < S - 1 else None
                    lf = p[y][x - 1] if x > 0 else None
                    rt = p[y][x + 1] if x < S - 1 else None
                    if up is None: c = mul(c, 1.25)
                    elif dn is None: c = mul(c, 0.72)
                    if lf is None: c = mul(c, 1.1)
                    elif rt is None: c = mul(c, 0.85)
                    q[y][x] = c
        if outline is None:
            self.p = q
            return self
        oc = hx(outline)
        for y in range(S):
            for x in range(S):
                if p[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < S and 0 <= ny < S and p[ny][nx] is not None:
                            q[y][x] = oc
                            break
        self.p = q
        return self

    def image(self):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        for y in range(S):
            for x in range(S):
                if self.p[y][x] is not None:
                    im.putpixel((x, y), self.p[y][x])
        return im.resize((S * 2, S * 2), Image.NEAREST)


# ───────── 색 ─────────
SKIN, WHITE, EYE = hx('#f2d2ac'), hx('#ffffff'), hx('#1b1426')
RED, GOLD, WOOD = hx('#e0413f'), hx('#ffc94a'), hx('#8a5a2b')


def player(f):
    """참조 이미지 디자인: 보라색 후드 망토, 창백한 얼굴, 벨트, 밝은 바지, 검은 부츠"""
    c = Canvas(); b = -f
    CL, CLD, CLL = hx('#7a2fd0'), hx('#3d1a73'), hx('#9a58ec')
    VEST, SHIRT, BELT = hx('#6b5a7a'), hx('#d3c8da'), hx('#4a3022')
    PANT, PANTD, BOOT = hx('#dcd8e0'), hx('#a8a2b2'), hx('#2b2024')
    c.poly([(13, 9 + b), (23, 9 + b), (27, 15 + b), (31, 32), (5, 32), (9, 15 + b)], CL)
    c.poly([(15, 14 + b), (21, 14 + b), (23, 32), (13, 32)], CLD)
    c.rect(14, 14 + b, 22, 23 + b, VEST)
    c.rect(17, 14 + b, 19, 22 + b, SHIRT)
    c.rect(14, 23 + b, 22, 24 + b, BELT); c.px(18, 23 + b, GOLD)
    lx = 1 if f else 0
    c.rect(14 - lx, 25, 17 - lx, 31, PANT); c.rect(19 + lx, 25, 22 + lx, 31, PANT)
    c.rect(14 - lx, 25, 14 - lx, 31, PANTD); c.rect(22 + lx, 25, 22 + lx, 31, PANTD)
    c.rect(13 - lx, 31, 17 - lx, 33, BOOT); c.rect(19 + lx, 31, 23 + lx, 33, BOOT)
    c.poly([(9, 15 + b), (14, 14 + b), (13, 30), (5, 32)], hx('#6a28b8'))
    c.poly([(27, 15 + b), (22, 14 + b), (23, 30), (31, 32)], hx('#6a28b8'))
    c.rect(10, 19 + b, 11, 26 + b, CLL)
    c.ell(18, 7 + b, 6.5, 6.5, CLL)
    c.ell(18, 9 + b, 4, 4.5, hx('#2a1850'))
    c.ell(18, 11 + b, 2.6, 2.4, hx('#e2d3e0'))
    c.px(17, 9 + b, hx('#efe6ff')); c.px(19, 9 + b, hx('#efe6ff'))
    return c.finish()


def player_mage(f):
    c = Canvas(); b = -f
    CLOAK, CLOAK_D, CLOAK_L, HAIR = hx('#5b3fc9'), hx('#3a2790'), hx('#8c6cf0'), hx('#2c2166')
    c.poly([(12, 16 + b), (24, 16 + b), (28, 29 + b), (8, 29 + b)], CLOAK)
    c.poly([(16, 19 + b), (20, 19 + b), (22, 29 + b), (14, 29 + b)], CLOAK_D)
    c.rect(14, 24 + b, 22, 25 + b, GOLD)
    c.ell(18, 16 + b, 7, 2.5, CLOAK_L)
    c.ell(18, 10 + b, 6, 6, HAIR)
    c.ell(18, 12 + b, 4.3, 4, SKIN)
    c.rect(14, 8 + b, 22, 9 + b, HAIR)
    c.px(16, 12 + b, EYE); c.px(20, 12 + b, EYE)
    boots = hx('#3b2a1a')
    if f == 0:
        c.rect(13, 30, 16, 32, boots); c.rect(20, 30, 23, 32, boots)
    else:
        c.rect(11, 30, 14, 32, boots); c.rect(22, 30, 25, 32, boots)
    c.line(29, 14 + b, 30, 32, WOOD)
    c.ell(29, 11 + b, 2.6, 2.6, hx('#7fd0ff')); c.px(28, 10 + b, WHITE)
    return c.finish()


def bat(f):
    c = Canvas(); W, WD = hx('#7a5cf0'), hx('#4b36a8')
    if f == 0:
        c.poly([(14, 17), (3, 9), (5, 16), (8, 14), (10, 20), (13, 19)], W)
        c.poly([(22, 17), (33, 9), (31, 16), (28, 14), (26, 20), (23, 19)], W)
    else:
        c.poly([(14, 18), (3, 24), (6, 21), (9, 27), (11, 22), (13, 21)], W)
        c.poly([(22, 18), (33, 24), (30, 21), (27, 27), (25, 22), (23, 21)], W)
    c.ell(18, 19, 5, 6, WD)
    c.poly([(14, 14), (15, 18), (13, 18)], WD); c.poly([(22, 14), (23, 18), (21, 18)], WD)
    c.px(16, 18, RED); c.px(20, 18, RED); c.px(17, 22, WHITE); c.px(19, 22, WHITE)
    return c.finish()


def zombie(f):
    c = Canvas(); G, GD, SH = hx('#72b35c'), hx('#4f8a43'), hx('#6a6f9c')
    s = f
    c.rect(13, 28, 16, 32 - s, hx('#3b4a6b')); c.rect(20, 28, 23, 31 + s, hx('#3b4a6b'))
    c.rect(12, 17, 24, 28, SH)
    c.rect(14, 22, 17, 23, hx('#4c507a')); c.rect(20, 25, 22, 26, hx('#4c507a'))
    c.ell(18, 11, 6, 6, G)
    c.rect(24, 17 - s, 32, 19 - s, G); c.rect(4, 18 - s, 11, 20 - s, G)
    c.rect(31, 17 - s, 32, 20 - s, GD)
    c.px(16, 10, hx('#ffe65a')); c.px(20, 10, hx('#ffe65a')); c.px(15, 10, EYE); c.px(21, 10, EYE)
    c.rect(16, 14, 20, 14, hx('#3a1d1d'))
    c.px(14, 6, GD); c.px(15, 5, GD); c.px(21, 5, GD)
    return c.finish()


def skel(f):
    c = Canvas(); B, BD = hx('#ebe5d2'), hx('#b9b29a')
    s = f
    c.ell(18, 9, 6, 6, B); c.rect(14, 12, 22, 15, B)
    c.rect(14, 8, 16, 11, EYE); c.rect(20, 8, 22, 11, EYE); c.px(18, 12, EYE)
    c.rect(15, 15, 16, 15, EYE); c.rect(18, 15, 18, 15, EYE); c.rect(20, 15, 21, 15, EYE)
    c.rect(17, 16, 19, 26, B)
    for y in (18, 20, 22):
        c.rect(13, y, 23, y, B); c.rect(13, y + 1, 23, y + 1, BD)
    c.line(13, 18, 9, 24 - s, B); c.line(23, 18, 27, 23 + s, B)
    c.rect(14, 27, 16, 32 - s, B); c.rect(20, 27, 22, 31 + s, B)
    c.rect(26, 21 + s, 27, 27 + s, hx('#c9ccd8'))
    return c.finish()


def wraith(f):
    c = Canvas(); T, TD = hx('#58c9e0'), hx('#2c8ea8')
    c.ell(18, 14, 9, 9, T)
    c.rect(9, 14, 27, 28, T)
    for i, x in enumerate(range(9, 28, 3)):
        h = 4 if (i + f) % 2 == 0 else 1
        c.rect(x, 29, x + 2, 29 + h, T)
    c.rect(9, 22, 12, 29, TD); c.rect(24, 22, 27, 29, TD)
    c.ell(18, 14, 5, 5, hx('#0b2c38'))
    c.rect(15, 13, 16, 15, WHITE); c.rect(20, 13, 21, 15, WHITE)
    return c.finish()


def brute(f):
    c = Canvas(); R, RD, HEAD = hx('#b8522c'), hx('#7e331a'), hx('#d0703f')
    s = f
    c.rect(10, 28, 15, 33 - s, RD); c.rect(21, 28, 26, 32 + s, RD)
    c.ell(18, 21, 12, 9, R)
    c.ell(5, 22 - s, 4, 6, R); c.ell(31, 21 + s, 4, 6, R)
    c.rect(3, 26 - s, 7, 28 - s, hx('#2a1a14')); c.rect(29, 25 + s, 33, 27 + s, hx('#2a1a14'))
    c.ell(18, 11, 7, 6, HEAD)
    c.poly([(11, 8), (7, 0), (14, 6)], hx('#f4e8c4')); c.poly([(25, 8), (29, 0), (22, 6)], hx('#f4e8c4'))
    c.rect(14, 10, 16, 11, hx('#ffdd55')); c.rect(20, 10, 22, 11, hx('#ffdd55'))
    c.rect(15, 15, 21, 16, hx('#2a1a14')); c.px(15, 17, WHITE); c.px(21, 17, WHITE)
    c.rect(12, 20, 24, 21, RD)
    return c.finish()


def boss(f):
    c = Canvas(); CAPE, CAPE_D, FACE = hx('#a21d4c'), hx('#5e0f2c'), hx('#2b0d1b')
    s = f
    c.poly([(18, 8), (33, 31 + s), (3, 31 + s)], CAPE)
    c.poly([(18, 14), (26, 31 + s), (10, 31 + s)], CAPE_D)
    c.rect(2, 30 + s, 34, 32 + s, hx('#7a1639'))
    c.ell(18, 13, 7, 7, FACE)
    c.rect(13, 11, 16, 13, GOLD); c.rect(20, 11, 23, 13, GOLD)
    c.px(14, 12, WHITE); c.px(21, 12, WHITE)
    c.rect(15, 17, 21, 17, hx('#e8e2cf')); c.px(16, 18, hx('#e8e2cf')); c.px(18, 18, hx('#e8e2cf')); c.px(20, 18, hx('#e8e2cf'))
    c.rect(11, 5, 25, 6, GOLD)
    for x, h in ((11, 4), (15, 6), (18, 7), (21, 6), (25, 4)):
        c.rect(x - 1, 5 - h, x, 5, GOLD)
    c.px(18, 3, RED)
    c.ell(7, 24 + s, 3, 5, CAPE_D); c.ell(29, 24 - s, 3, 5, CAPE_D)
    return c.finish()


def sheet(fn):
    im = Image.new('RGBA', (S * 4, S * 2), (0, 0, 0, 0))
    for f in range(2):
        im.paste(fn(f).image(), (f * S * 2, 0))
    return im


# ───────── 아이템 (72x72 칸 10개) ─────────
# ───────── 바닥 타일 (72x72, 이음매 없음) ─────────
def ground():
    N = 72
    rnd = random.Random(7)
    im = Image.new('RGBA', (N, N), hx('#1b2b46'))              # 푸른 밤 들판
    px = im.load()

    def put(x, y, c):
        px[x % N, y % N] = c
    for y in range(N):
        for x in range(N):
            if rnd.random() < 0.18:
                put(x, y, hx('#223858'))
            elif rnd.random() < 0.06:
                put(x, y, hx('#14223a'))
    for _ in range(46):
        x, y = rnd.randrange(N), rnd.randrange(N)
        c = hx(rnd.choice(['#2f5f86', '#356b94', '#2a5578']))
        put(x, y, c); put(x, y - 1, c)
        if rnd.random() < 0.5:
            put(x + 1, y - 2, c)
    for _ in range(5):
        x, y = rnd.randrange(N), rnd.randrange(N)
        for dx, dy in ((0, 0), (1, 0), (2, 0), (0, 1), (1, 1)):
            put(x + dx, y + dy, hx('#586070'))
        put(x, y, hx('#7c8496'))
    return im


def main():
    os.makedirs(OUT, exist_ok=True)
    sprites = {'player': player, 'bat': bat, 'zombie': zombie, 'skel': skel, 'wraith': wraith, 'brute': brute, 'boss': boss}
    for name, fn in sprites.items():
        sheet(fn).save(os.path.join(OUT, name + '.png'))
    from make_oriental import items_sheet, decor_sheet      # 동양식 아이콘·장식은 make_oriental.py
    items_sheet().save(os.path.join(OUT, 'items.png'))
    decor_sheet().save(os.path.join(OUT, 'decor.png'))
    ground().save(os.path.join(OUT, 'ground.png'))
    # 미리보기 (확대)
    names = list(sprites)
    pv = Image.new('RGBA', (144 * len(names) // 1, 72 + 72 + 10), (40, 60, 44, 255))
    for i, n in enumerate(names):
        pv.alpha_composite(Image.open(os.path.join(OUT, n + '.png')), (i * 144, 0))
    pv2 = Image.new('RGBA', (720, 72), (40, 60, 44, 255))
    pv2.alpha_composite(Image.open(os.path.join(OUT, 'items.png')), (0, 0))
    pv.paste(pv2.crop((0, 0, min(720, pv.width), 72)), (0, 82))
    pv.resize((pv.width * 2, pv.height * 2), Image.NEAREST).save(os.path.join(os.path.dirname(os.path.abspath(__file__)), '_preview.png'))
    print('saved to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
