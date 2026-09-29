"""Builds every DrQuick brand asset from geometry. Run from Branding/src: python3 build.py

The mark (the Plus switch): a lime switch in the on position whose knob carries a plus.
All proportions come from the switch track height T:
  knob radius  = T/2 - T/8   (inset T/8 on every side)
  plus arm     = 0.58 x knob radius (half-length), plus bar = 0.42 x knob radius
The wordmark is Plus Jakarta Sans ExtraBold at -0.04em, outlined, with "Quick" and the knob
set inside the same lime pill.
"""
import json, os, subprocess, ctypes.util
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

_f = ctypes.util.find_library
ctypes.util.find_library = lambda n: '/opt/homebrew/lib/libcairo.2.dylib' if 'cairo' in n else _f(n)
import cairosvg

ROOT = os.path.abspath('..')
CONVERT = '/opt/ImageMagick/bin/convert'
FOREST, LIME, WHITE, BLACK, GROUND = '#163300', '#9FE870', '#FFFFFF', '#000000', '#F5F7F2'
BAND_INK_2 = '#B5C9A5'

# ---------------------------------------------------------------- geometry helpers
def P(d):
    p = pathops.Path(); parse_path(d, p.getPen()); return p
def D(p):
    pen = SVGPathPen(None); p.draw(pen); return pen.getCommands()
def op(a, b, kind): return pathops.op(a, b, getattr(pathops.PathOp, kind))
def U(*ps):
    r = ps[0]
    for p in ps[1:]: r = op(r, p, 'UNION')
    return r
def sub(a, *bs):
    for b in bs: a = op(a, b, 'DIFFERENCE')
    return a
def circ(cx, cy, r): return P(f'M{cx-r},{cy} A{r},{r} 0 1 1 {cx+r},{cy} A{r},{r} 0 1 1 {cx-r},{cy}Z')
def stad(x, y, w, h):
    r = min(w, h) / 2
    if w >= h:
        return P(f'M{x+r},{y} H{x+w-r} A{r},{r} 0 0 1 {x+w-r},{y+h} H{x+r} A{r},{r} 0 0 1 {x+r},{y}Z')
    return P(f'M{x},{y+r} A{r},{r} 0 0 1 {x+w},{y+r} V{y+h-r} A{r},{r} 0 0 1 {x},{y+h-r} Z')
def plus(cx, cy, arm, t): return U(stad(cx-arm, cy-t/2, 2*arm, t), stad(cx-t/2, cy-arm, t, 2*arm))
def tr(p, dx=0, dy=0, s=1.0):
    q = pathops.Path(); p.draw(TransformPen(q.getPen(), (s, 0, 0, s, dx, dy))); return q
def bounds(parts):
    xs = [p.bounds for p, _ in parts]
    return min(b[0] for b in xs), min(b[1] for b in xs), max(b[2] for b in xs), max(b[3] for b in xs)
def outline(text, size=150, track=-0.04, wght=800):
    return json.loads(subprocess.check_output(['python3', 'outline.py', text, '--size', str(size), '--track', str(track), '--wght', str(wght)]))

# ---------------------------------------------------------------- the mark
def knob_parts(cx, cy, r):
    return circ(cx, cy, r), plus(cx, cy, r * 0.58, r * 0.42)
def switch(x, y, h, w=None):
    """Track, knob disc and plus for a switch of height h (width defaults to 1.75h)."""
    w = w or h * 1.75
    track = stad(x, y, w, h)
    disc, pl = knob_parts(x + w - h / 2, y + h / 2, h / 2 - h / 8)
    return track, disc, pl

TRACK, DISC, PLUS = switch(0, 0, 128)               # symbol: 224 x 128
DR = outline('Dr'); QUICK = outline('Quick'); WORD = outline('DrQuick')
SIZE = 150

def wordmark_geom():
    cap = DR['capHeight']; ph = 176; base = ph / 2 + cap / 2
    pad = 0.32 * SIZE * 0.9; x0 = DR['width'] + 0.12 * SIZE
    kr = ph / 2 - ph / 8
    pw = pad + QUICK['width'] + 0.18 * SIZE + 2 * kr + ph / 8
    pill = stad(x0, 0, pw, ph)
    disc, pl = knob_parts(x0 + pw - ph / 2, ph / 2, kr)
    return tr(P(DR['d']), 0, base), pill, tr(P(QUICK['d']), x0 + pad, base), disc, pl

def text_word(dx, dy): return tr(P(WORD['d']), dx, dy)

MONO = {'forest': FOREST, 'black': BLACK, 'white': WHITE, 'lime': LIME}

# Each mark = function(colourway) -> list of (path, fill). Colourways:
#   colour   forest + lime, for white, ground, lime-wash, sage and stone
#   reversed for forest grounds
#   forest | black | white | lime   single colour; knockouts show the ground
def mark_symbol(cw):
    if cw in ('colour', 'reversed'):
        return [(TRACK, LIME), (DISC, FOREST), (PLUS, LIME)]
    return [(U(sub(TRACK, DISC), PLUS), MONO[cw])]

def mark_knob(cw):
    disc, pl = knob_parts(0, 0, 100)
    if cw == 'colour': return [(disc, FOREST), (pl, LIME)]
    if cw == 'reversed': return [(disc, LIME), (pl, FOREST)]
    return [(sub(disc, pl), MONO[cw])]

def mark_wordmark(cw):
    dr, pill, q, disc, pl = wordmark_geom()
    if cw in ('colour', 'reversed'):
        return [(dr, FOREST if cw == 'colour' else WHITE), (pill, LIME), (q, FOREST), (disc, FOREST), (pl, LIME)]
    c = MONO[cw]
    return [(dr, c), (U(sub(pill, q, disc), pl), c)]

def mark_lockup(cw, stacked=False):
    sym = mark_symbol(cw)
    tc = {'colour': FOREST, 'reversed': WHITE}.get(cw, MONO.get(cw))
    if not stacked:
        # symbol at 1.5x (192 tall, about 1.7x the cap height); symbol and caps share a centre line;
        # the gap is one knob diameter of the scaled symbol
        s = 1.5
        sym = [(tr(p, 0, 0, s), f) for p, f in sym]
        return sym + [(text_word(224 * s + 96 * s * 0.75, 64 * s + WORD['capHeight'] / 2), tc)]
    s = 1.5; sw = 224 * s
    sym = [(tr(p, (WORD['width'] - sw) / 2, 0, s), f) for p, f in sym]
    return sym + [(text_word(0, 128 * s + 72 + WORD['capHeight']), tc)]

MARKS = {
    'wordmark': mark_wordmark,
    'symbol': mark_symbol,
    'lockup-horizontal': lambda cw: mark_lockup(cw),
    'lockup-stacked': lambda cw: mark_lockup(cw, stacked=True),
    'knob': mark_knob,
}
COLOURWAYS = ['colour', 'reversed', 'forest', 'lime', 'black', 'white']

# ---------------------------------------------------------------- writers
def svg_doc(parts, vb=None, title='DrQuick'):
    x0, y0, x1, y1 = vb or bounds(parts)
    body = ''.join(f'<path fill="{f}" d="{D(p)}"/>' for p, f in parts)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {x1-x0:.2f} {y1-y0:.2f}" '
            f'role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n')

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w').write(text)

def png(svg_text, path, w=None, h=None, bg=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(bytestring=svg_text.encode(), write_to=path, output_width=w, output_height=h, background_color=bg)

def fit(parts, box, into):
    """Scale parts so their width is `into` and centre them in a square box."""
    x0, y0, x1, y1 = bounds(parts); s = into / (x1 - x0)
    ox = (box - (x1 - x0) * s) / 2 - x0 * s; oy = (box - (y1 - y0) * s) / 2 - y0 * s
    return [(tr(p, ox, oy, s), f) for p, f in parts]

def tile(size, bg, parts, rx=0, h=None):
    h = h or size; rect = pathops.Path()
    if rx: parse_path(f'M{rx},0 H{size-rx} A{rx},{rx} 0 0 1 {size},{rx} V{h-rx} A{rx},{rx} 0 0 1 {size-rx},{h} H{rx} A{rx},{rx} 0 0 1 0,{h-rx} V{rx} A{rx},{rx} 0 0 1 {rx},0 Z', rect.getPen())
    else: parse_path(f'M0,0 H{size} V{h} H0 Z', rect.getPen())
    return [(rect, bg)] + parts

manifest = {}
def log(kind, path): manifest.setdefault(kind, []).append(os.path.relpath(path, ROOT))

# ---------------------------------------------------------------- 1. logos
for mark, fn in MARKS.items():
    for cw in COLOURWAYS:
        parts = fn(cw)
        svg = svg_doc(parts)
        base = f'drquick-{mark}-{cw}'
        p_svg = f'{ROOT}/logo/svg/{cw}/{base}.svg'; write(p_svg, svg); log('logo-svg', p_svg)
        x0, y0, x1, y1 = bounds(parts); wide = (x1 - x0) >= (y1 - y0)
        for long_edge in (1000, 4000):
            kw = dict(w=long_edge) if wide else dict(h=long_edge)
            p_png = f'{ROOT}/logo/png/{cw}/{base}-{long_edge}.png'; png(svg, p_png, **kw); log('logo-png', p_png)

# ---------------------------------------------------------------- 2. app icons
APP_SCALE = 0.76  # the switch spans 76% of the tile width
def app_parts(size, bg=FOREST, rx=0, scale=APP_SCALE):
    return tile(size, bg, fit(mark_symbol('colour'), size, size * scale), rx)

ios_master = svg_doc(app_parts(1024), vb=(0, 0, 1024, 1024), title='DrQuick app icon')
write(f'{ROOT}/app-icon/app-icon-master.svg', ios_master); log('app', f'{ROOT}/app-icon/app-icon-master.svg')
rounded = svg_doc(app_parts(1024, rx=230), vb=(0, 0, 1024, 1024), title='DrQuick app icon')
write(f'{ROOT}/app-icon/app-icon-rounded-preview.svg', rounded)
png(rounded, f'{ROOT}/app-icon/app-icon-rounded-preview-1024.png', w=1024)

# iOS: Xcode 14+ takes one opaque 1024 image; the listed sizes cover older targets and marketing use.
iosset = f'{ROOT}/app-icon/ios/AppIcon.appiconset'
png(ios_master, f'{iosset}/AppIcon-1024.png', w=1024, bg=FOREST)
write(f'{iosset}/Contents.json', json.dumps({
    'images': [{'filename': 'AppIcon-1024.png', 'idiom': 'universal', 'platform': 'ios', 'size': '1024x1024'}],
    'info': {'author': 'xcode', 'version': 1}}, indent=2) + '\n')
for n in (20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180):
    png(ios_master, f'{ROOT}/app-icon/ios/sizes/icon-{n}.png', w=n, bg=FOREST)
log('app', iosset)

# Android adaptive icon: 108dp layers; the mark stays inside the 66dp safe circle.
# The stadium's farthest points are its ends, so its width may equal the safe diameter.
FG = 432; SAFE = FG * 66 / 108
fg = svg_doc(fit(mark_symbol('colour'), FG, SAFE * 0.96), vb=(0, 0, FG, FG), title='DrQuick adaptive icon foreground')
mono = svg_doc(fit(mark_symbol('white'), FG, SAFE * 0.96), vb=(0, 0, FG, FG), title='DrQuick monochrome icon')
A = f'{ROOT}/app-icon/android'
write(f'{A}/ic_launcher_foreground.svg', fg); png(fg, f'{A}/res/mipmap-xxxhdpi/ic_launcher_foreground.png', w=FG)
write(f'{A}/ic_launcher_monochrome.svg', mono); png(mono, f'{A}/res/mipmap-xxxhdpi/ic_launcher_monochrome.png', w=FG)
write(f'{A}/res/values/ic_launcher_background.xml', f'<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">{FOREST}</color>\n</resources>\n')
adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>\n'
write(f'{A}/res/mipmap-anydpi-v26/ic_launcher.xml', adaptive)
write(f'{A}/res/mipmap-anydpi-v26/ic_launcher_round.xml', adaptive)
legacy_sq = svg_doc(app_parts(512, rx=90), vb=(0, 0, 512, 512))
legacy_rd = svg_doc(app_parts(512, rx=256, scale=0.66), vb=(0, 0, 512, 512))
for dpi, n in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
    png(legacy_sq, f'{A}/res/mipmap-{dpi}/ic_launcher.png', w=n)
    png(legacy_rd, f'{A}/res/mipmap-{dpi}/ic_launcher_round.png', w=n)
png(ios_master, f'{A}/play-store-512.png', w=512, bg=FOREST)
log('app', A)

# Expo / React Native (the stack the research report recommends for the native apps)
E = f'{ROOT}/app-icon/expo'
png(ios_master, f'{E}/icon.png', w=1024, bg=FOREST)
png(svg_doc(fit(mark_symbol('colour'), 1024, 1024 * 66 / 108 * 0.96), vb=(0, 0, 1024, 1024)), f'{E}/adaptive-icon.png', w=1024)
png(svg_doc(fit(mark_symbol('white'), 1024, 1024 * 66 / 108 * 0.96), vb=(0, 0, 1024, 1024)), f'{E}/adaptive-icon-monochrome.png', w=1024)
png(svg_doc(fit(mark_symbol('colour'), 1024, 512), vb=(0, 0, 1024, 1024)), f'{E}/splash-icon.png', w=1024)
write(f'{E}/app.json.snippet.json', json.dumps({'expo': {
    'icon': './assets/icon.png',
    'splash': {'image': './assets/splash-icon.png', 'resizeMode': 'contain', 'backgroundColor': FOREST},
    'ios': {'icon': './assets/icon.png'},
    'android': {'adaptiveIcon': {'foregroundImage': './assets/adaptive-icon.png',
                                 'monochromeImage': './assets/adaptive-icon-monochrome.png',
                                 'backgroundColor': FOREST}}}}, indent=2) + '\n')
log('app', E)

# ---------------------------------------------------------------- 3. favicons and web icons
W_ = f'{ROOT}/favicon'
# At 16-48px the switch is too thin, so the favicon is the knob alone on a lime tile.
fav = svg_doc(tile(256, LIME, fit(mark_knob('colour'), 256, 236), rx=48), vb=(0, 0, 256, 256), title='DrQuick')
write(f'{W_}/favicon.svg', fav)
for n in (16, 32, 48, 96):
    png(fav, f'{W_}/favicon-{n}.png', w=n)
subprocess.run([CONVERT, f'{W_}/favicon-16.png', f'{W_}/favicon-32.png', f'{W_}/favicon-48.png', f'{W_}/favicon.ico'], check=True, stderr=subprocess.DEVNULL)
png(ios_master, f'{W_}/apple-touch-icon.png', w=180, bg=FOREST)
any_icon = svg_doc(app_parts(512, rx=112), vb=(0, 0, 512, 512))
png(any_icon, f'{W_}/android-chrome-192.png', w=192); png(any_icon, f'{W_}/android-chrome-512.png', w=512)
png(svg_doc(app_parts(512, scale=0.62), vb=(0, 0, 512, 512)), f'{W_}/maskable-512.png', w=512, bg=FOREST)
write(f'{W_}/safari-pinned-tab.svg', svg_doc(mark_knob('black'), title='DrQuick'))
write(f'{W_}/site.webmanifest', json.dumps({
    'name': 'DrQuick', 'short_name': 'DrQuick', 'theme_color': FOREST, 'background_color': GROUND, 'display': 'standalone',
    'icons': [{'src': '/android-chrome-192.png', 'sizes': '192x192', 'type': 'image/png'},
              {'src': '/android-chrome-512.png', 'sizes': '512x512', 'type': 'image/png'},
              {'src': '/maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}, indent=2) + '\n')
write(f'{W_}/head.html', '''<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#163300">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#163300">
''')
log('web', W_)

# ---------------------------------------------------------------- 4. social
S = f'{ROOT}/social'
avatar = svg_doc(tile(1024, FOREST, fit(mark_symbol('colour'), 1024, 1024 * 0.62)), vb=(0, 0, 1024, 1024), title='DrQuick')
write(f'{S}/avatar.svg', avatar); png(avatar, f'{S}/avatar-1024.png', w=1024)
# Open Graph card: the reversed wordmark and the permitted line "See a GP in minutes"
wm = mark_wordmark('reversed'); x0, y0, x1, y1 = bounds(wm); s = 640 / (x1 - x0)
wm = [(tr(p, (1200 - 640) / 2 - x0 * s, 200 - y0 * s, s), f) for p, f in wm]
line = outline('See a GP in minutes', size=46, track=-0.02, wght=700)
line_p = tr(P(line['d']), (1200 - line['width']) / 2, 200 + (y1 - y0) * s + 96)
og = svg_doc(tile(1200, FOREST, wm + [(line_p, BAND_INK_2)], h=630), vb=(0, 0, 1200, 630), title='DrQuick. See a GP in minutes')
write(f'{S}/og-image.svg', og); png(og, f'{S}/og-image-1200x630.png', w=1200)
png(svg_doc(mark_wordmark('colour')), f'{S}/email-signature-600.png', w=600, bg=WHITE)
log('social', S)

json.dump(manifest, open('manifest.json', 'w'), indent=1)
print({k: len(v) for k, v in manifest.items()})
