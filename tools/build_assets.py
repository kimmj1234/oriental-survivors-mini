"""받은 CC0 도트 에셋(Ninja Adventure)을 게임용 스프라이트 시트로 변환한다.

원본(tools/vendor/ninja_adventure, CC0, 제작자 pixel-boy):
  Actor/Character/Spirit, Character/Tengu  (주인공은 tools/make_hero.py 로 직접 그린 오리지널 도트)
  Actor/Monster/Spirit2, Monster/KappaGreen, Monster/Skull
  Actor/Boss/GiantRedSamurai
시트 구조: 16x16 칸, 가로 = 방향(아래·위·왼·오른), 세로 = 걷기 프레임. 여기서는 '오른쪽' 열을 쓰고 왼쪽은 뒤집어 그린다.
변환: 프레임 선택 -> 여백 자르기 -> 정수 배 확대 -> 발 위치 정렬
결과: assets/<역할>.png (가로로 이어붙인 프레임) + assets/sprites.js (칸 크기·프레임 수·속도·그리기 배율)
실행: python tools/make_sprites.py && python tools/build_assets.py
"""
import json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ACT = os.path.join(HERE, 'vendor', 'ninja_adventure', 'Ninja Adventure - Asset Pack', 'Actor')
OUT = os.path.join(HERE, '..', 'assets')
MIN_CELL = 72


def right_walk(path):                      # 16x16 시트의 '정면(아래)' 열 4프레임: 얼굴이 보여서 탑다운에서 읽기 쉽다
    return path, [(0, r * 16, 16, 16) for r in range(4)]


def column(path, size, n=4):               # 세로로 이어진 프레임(직접 만든 주인공 시트)
    return path, [(0, r * size, size, size) for r in range(n)]


def strip(path, fw, fh, n):                # 가로로 이어진 프레임
    return path, [(i * fw, 0, fw, fh) for i in range(n)]


# role: (파일, 프레임 상자 목록), fps, 화면 밀도(원본 1픽셀 = 캔버스 몇 px)
ROLES = {
    'player': (column(os.path.join(HERE, 'hero_sheet.png'), 30), 8, 2),
    'bat':    (right_walk(os.path.join(ACT, 'Monster', 'Spirit2', 'SpriteSheet.png')), 8, 2),
    'zombie': (right_walk(os.path.join(ACT, 'Monster', 'KappaGreen', 'SpriteSheet.png')), 6, 2),
    'skel':   (right_walk(os.path.join(ACT, 'Monster', 'Skull', 'SpriteSheet.png')), 8, 2),
    'wraith': (right_walk(os.path.join(ACT, 'Character', 'Spirit', 'SpriteSheet.png')), 6, 2),
    'brute':  (right_walk(os.path.join(ACT, 'Character', 'Tengu', 'SpriteSheet.png')), 6, 3),
    'boss':   (strip(os.path.join(ACT, 'Boss', 'GiantRedSamurai', 'Walk.png'), 96, 48, 6), 7, 1.5),
}


def build(name, spec):
    (path, boxes), fps, density = spec
    sheet = Image.open(path).convert('RGBA')
    frames = [sheet.crop((x, y, x + w, y + h)) for x, y, w, h in boxes]
    bb = [f.getbbox() for f in frames]
    x0, y0 = min(b[0] for b in bb), min(b[1] for b in bb)
    x1, y1 = max(b[2] for b in bb), max(b[3] for b in bb)
    w, h = x1 - x0, y1 - y0
    k = max(1, min((MIN_CELL - 2) // w, (MIN_CELL - 2) // h))
    cw, ch = max(MIN_CELL, w * k + 2), max(MIN_CELL, h * k + 2)
    out = Image.new('RGBA', (cw * len(frames), ch), (0, 0, 0, 0))
    for n, f in enumerate(frames):
        c = f.crop((x0, y0, x1, y1)).resize((w * k, h * k), Image.NEAREST)
        out.alpha_composite(c, (n * cw + (cw - w * k) // 2, ch - 2 - h * k))
    out.save(os.path.join(OUT, name + '.png'))
    return {'n': len(frames), 'fps': fps, 'draw': round(density / k, 4), 'cw': cw, 'ch': ch, 'feetY': ch - 2,
            'face': 1, 'native': [w, h], 'k': k}


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = {name: build(name, spec) for name, spec in ROLES.items()}
    # file:// 로 열어도 되도록 JS 파일로 내보낸다 (fetch 불필요)
    with open(os.path.join(OUT, 'sprites.js'), 'w', encoding='utf8') as fp:
        fp.write('window.SPRITES = ' + json.dumps(manifest, ensure_ascii=False) + ';\n')
    for n, m in manifest.items():
        print(n, m['n'], 'frames', 'cell', m['cw'], 'x', m['ch'], 'draw', m['draw'])


if __name__ == '__main__':
    main()
