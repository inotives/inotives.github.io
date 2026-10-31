"""Pixel-grid inoTives logo generator: prints an ASCII preview and writes SVGs."""
import sys
from pathlib import Path

N = 32
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')

# --- hexagon (pointy top, 2:1 stepped edges) ---------------------------------
TOP, CAP, SIDE = 1, 7, 16  # first row, rows in each sloped cap, straight-side rows
CX = 16  # centre line falls between columns 15 and 16


def hex_span(y):
    r = y - TOP
    if r < 0 or r >= 2 * CAP + SIDE:
        return None
    if r < CAP:
        half = 2 + 2 * r
    elif r < CAP + SIDE:
        half = 2 + 2 * (CAP - 1)
    else:
        half = 2 + 2 * (2 * CAP + SIDE - 1 - r)
    return CX - half, CX + half - 1


inside = {(x, y) for y in range(N) if (s := hex_span(y)) for x in range(s[0], s[1] + 1)}
outline = {(x, y) for (x, y) in inside
           if any((x + dx, y + dy) not in inside for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}


# --- glyph ---------------------------------------------------------------------
def rect(x0, y0, x1, y1):
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)}


# the I: long top bar (it doubles as the crossbar of the hooked stroke), rising
# to the right in 1px steps like the hand-drawn original
top_bar = rect(7, 11, 15, 12) | rect(16, 10, 20, 11) | rect(21, 9, 25, 10)
letter_i = top_bar | rect(10, 13, 11, 20) | rect(7, 21, 15, 22)

# the hooked stroke: a stepped diagonal cutting through the bar, then a squared hook
hook = set()
diag = [(12, 6), (13, 7), (13, 8), (14, 9), (14, 10), (15, 11), (15, 12), (16, 13), (16, 14),
        (17, 15), (17, 16), (18, 17), (18, 18), (19, 19), (19, 20)]
for x, y in diag:
    hook |= rect(x, y, x + 1, y)
hook |= rect(20, 21, 22, 22)          # base of the hook
hook |= rect(23, 20, 24, 21)          # turn up
hook |= rect(24, 17, 25, 19)          # rise
hook |= rect(25, 15, 26, 16)          # flick out to the right

hook = {(x + 1, y) for x, y in hook}  # nudged right, clear of the I's stem
letter_i -= hook  # the stroke sits on top where they cross

# centre the glyph optically inside the hexagon
SHIFT = (-1, 0)
letter_i = {(x + SHIFT[0], y + SHIFT[1]) for x, y in letter_i}
hook = {(x + SHIFT[0], y + SHIFT[1]) for x, y in hook}

THEMES = {
    'dark': dict(fill='#1d2026', edge='#8b9099', ink='#e4e1d8', accent='#1fefd7'),
    'light': dict(fill='#f3f4f6', edge='#4b5563', ink='#111827', accent='#0f766e'),
}


def preview():
    for y in range(N):
        row = ''
        for x in range(N):
            p = (x, y)
            row += ('o' if p in hook else '#' if p in letter_i else
                    '+' if p in outline else '.' if p in inside else ' ')
        print(f'{y:2d} {row}')


def runs(pixels):
    """Merge pixels into horizontal runs so the SVG stays small."""
    out = []
    for y in range(N):
        xs = sorted(x for x, yy in pixels if yy == y)
        start = prev = None
        for x in xs + [None]:
            if start is None:
                start = prev = x
            elif x == prev + 1:
                prev = x
            else:
                out.append(f'M{start} {y}h{prev - start + 1}v1h-{prev - start + 1}z')
                start = prev = x
    return ''.join(out)


def bbox(pixels):
    xs = [x for x, _ in pixels]
    ys = [y for _, y in pixels]
    return min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1


def svg(theme, with_hex):
    c = THEMES[theme]
    if with_hex:
        vb = f'0 0 {N} {N}'
        layers = [(c['fill'], inside - outline), (c['edge'], outline)]
    else:
        x, y, w, h = bbox(letter_i | hook)
        size = max(w, h) + 2  # square canvas with a 1px margin
        vb = f'{x - (size - w) // 2} {y - (size - h) // 2} {size} {size}'
        layers = []
    layers += [(c['ink'], letter_i), (c['accent'], hook)]
    paths = '\n  '.join(f'<path fill="{fill}" d="{runs(px)}"/>' for fill, px in layers)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
            f'shape-rendering="crispEdges" role="img" aria-label="inoTives">\n'
            f'  <title>inoTives</title>\n  {paths}\n</svg>\n')


if __name__ == '__main__':
    preview()
    OUT.mkdir(parents=True, exist_ok=True)
    for theme in THEMES:
        (OUT / f'logo-{theme}.svg').write_text(svg(theme, True))
        (OUT / f'mark-{theme}.svg').write_text(svg(theme, False))
