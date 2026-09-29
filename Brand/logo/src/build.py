import json, subprocess, math, os
F, L, W = '#163300', '#9FE870', '#FFFFFF'
os.makedirs('concepts', exist_ok=True)
def outline(t, size=100, track=-0.04):
    return json.loads(subprocess.check_output(['python3', 'outline.py', t, '--size', str(size), '--track', str(track)]))
def svg(body, w=256, h=256, title='DrQuick'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
def circ(cx, cy, r, ccw=False):
    # full circle as two arcs; ccw reverses winding for holes
    s = 0 if ccw else 1
    return f'M{cx-r},{cy} A{r},{r} 0 1 {s} {cx+r},{cy} A{r},{r} 0 1 {s} {cx-r},{cy}Z'
def stadium(x, y, w, h, ccw=False):
    r = h/2; s = 0 if ccw else 1
    if not ccw:
        return f'M{x+r},{y} H{x+w-r} A{r},{r} 0 0 1 {x+w-r},{y+h} H{x+r} A{r},{r} 0 0 1 {x+r},{y}Z'
    return f'M{x+r},{y} A{r},{r} 0 0 0 {x+r},{y+h} H{x+w-r} A{r},{r} 0 0 0 {x+w-r},{y} Z'
def save(name, s): open(f'concepts/{name}.svg', 'w').write(s)

# ---------- A: Switch-on ----------
# track 224x128 centred; knob r48 inset 16 at the "on" end
A_track = stadium(16, 64, 224, 128); A_knob = (176, 128, 48)
save('a-symbol', svg(f'<path fill="{F}" fill-rule="evenodd" d="{A_track} {circ(*A_knob)}"/>'))
save('a-symbol-color', svg(f'<path fill="{L}" d="{A_track}"/><circle cx="176" cy="128" r="48" fill="{F}"/>'))

# ---------- B: Speech-bubble Q ----------
cx, cy, R, r = 122, 122, 100, 54
tip = (236, 236)
def hit(deg):
    # walk from the tip back along a clean 30/60deg edge to the outer circle
    dx, dy = -math.cos(math.radians(deg)), -math.sin(math.radians(deg))
    fx, fy = tip[0]-cx, tip[1]-cy; b = fx*dx + fy*dy; c = fx*fx + fy*fy - R*R
    t = -b - math.sqrt(b*b - c); return (tip[0]+t*dx, tip[1]+t*dy)
p1, p2 = hit(75), hit(15)
# straight-sided bubble tail on the Q's 45deg axis; closes along the chord, clear of the counter
tail = f'M{p1[0]:.2f},{p1[1]:.2f} L{tip[0]},{tip[1]} L{p2[0]:.2f},{p2[1]:.2f}Z'
B_d = f'{circ(cx, cy, R)} {tail} {circ(cx, cy, r, ccw=True)}'
save('b-symbol', svg(f'<path fill="{F}" d="{B_d}"/>'))

# ---------- C: dq monogram ----------
# one bowl, one full-height stem: d above the midline, q below
C_bowl = circ(127, 128, 74); C_hole = circ(127, 128, 34, ccw=True)
C_stem = stadium(0, 0, 0, 0)  # placeholder
stem = f'M163,40 A20,20 0 0 1 203,40 V216 A20,20 0 0 1 163,216Z'
C_d = f'{C_bowl} {stem} {C_hole}'
save('c-symbol', svg(f'<path fill="{F}" d="{C_d}"/>'))
save('c-symbol-color', svg(f'<path fill="{F}" d="{C_d}"/><circle cx="127" cy="128" r="22" fill="{L}"/>'))

# ---------- lockups (height 256): symbol at 256, word cap height ~ 100 ----------
def lockup(name, sym_body, sym_w=256, gap=40, size=150):
    o = outline('DrQuick', size=size)
    ty = 128 + o['capHeight']/2
    w = sym_w + gap + o['width'] + 8
    body = f'{sym_body}<path fill="{F}" transform="translate({sym_w+gap},{ty:.2f})" d="{o["d"]}"/>'
    save(name, svg(body, w=round(w), h=256))
lockup('b-lockup', f'<path fill="{F}" d="{B_d}"/>')
lockup('c-lockup', f'<path fill="{F}" d="{C_d}"/>')

# A lockup = the existing wordmark evolved: "Dr" then the lime pill holding "Quick" and the knob
size = 150
dr = outline('Dr', size=size); q = outline('Quick', size=size)
H = 256; cap = dr['capHeight']; base = 128 + cap/2
pill_h = 176; pill_y = 128 - pill_h/2; pad = 0.32*size*0.9
x0 = dr['width'] + 0.12*size
knob_r = pill_h/2 - 22
qx = x0 + pad
pill_w = pad + q['width'] + 0.18*size + 2*knob_r + 22
kcx = x0 + pill_w - 22 - knob_r
body = (f'<path fill="{F}" transform="translate(0,{base:.2f})" d="{dr["d"]}"/>'
        f'<path fill="{L}" d="{stadium(x0, pill_y, pill_w, pill_h)}"/>'
        f'<path fill="{F}" transform="translate({qx:.2f},{base:.2f})" d="{q["d"]}"/>'
        f'<circle cx="{kcx:.2f}" cy="128" r="{knob_r}" fill="{F}"/>')
save('a-lockup', svg(body, w=round(x0 + pill_w + 2), h=H))
print('ok')

# ---------- icons: tile + mark, symbol scaled into the tile ----------
def tile_icon(name, bg, body, scale, rx=56, dy=0):
    off = 128 - 128*scale
    save(name, svg(f'<rect width="256" height="256" rx="{rx}" fill="{bg}"/>'
                   f'<g transform="translate({off:.2f},{off+dy:.2f}) scale({scale})">{body}</g>'))
A_col = lambda t, k, kr=48: f'<path fill="{t}" d="{A_track}"/><circle cx="176" cy="128" r="{kr}" fill="{k}"/>'
tile_icon('a-app', F, A_col(L, F), 0.74)
tile_icon('a-fav', F, A_col(L, F, 42), 0.92, rx=48)
tile_icon('b-app', L, f'<path fill="{F}" d="{B_d}"/>', 0.66, dy=2)
tile_icon('b-fav', L, f'<path fill="{F}" d="{B_d}"/>', 0.86, rx=48, dy=2)
tile_icon('c-app', F, f'<path fill="{L}" d="{C_d}"/>', 0.74, dy=0)
tile_icon('c-fav', F, f'<path fill="{L}" d="{C_d}"/>', 0.9, rx=48)

# ================= deliverable variants =================
OUT = '..'
def put(dirn, name, s):
    os.makedirs(f'{OUT}/{dirn}', exist_ok=True); open(f'{OUT}/{dirn}/{name}.svg', 'w').write(s)
wq = outline('DrQuick', size=150)
def word_lockup(sym_body, col, w_extra=0):
    ty = 128 + wq['capHeight']/2
    return sym_body, f'<path fill="{col}" transform="translate(296,{ty:.2f})" d="{wq["d"]}"/>', round(296 + wq['width'] + 8)

VARIANTS = {}  # dirn -> {name: svg}
def reg(dirn, name, s): VARIANTS.setdefault(dirn, {})[name] = s; put(dirn, name, s)

# --- A ---
d = 'a-switch'
a_mono = lambda c: svg(f'<path fill="{c}" fill-rule="evenodd" d="{A_track} {circ(*A_knob)}"/>')
reg(d, 'symbol-colour', svg(A_col(L, F)))
reg(d, 'symbol-forest', a_mono(F)); reg(d, 'symbol-black', a_mono('#000000')); reg(d, 'symbol-white', a_mono(W))
def a_lock(dr_col, pill_col, q_col, knob_col, mono=None):
    if mono:
        # one colour: pill with "Quick" and the knob knocked out
        qd = ' '.join(f'M0,0' for _ in [])  # unused
        return svg(f'<path fill="{mono}" transform="translate(0,{base:.2f})" d="{dr["d"]}"/>'
                   f'<path fill="{mono}" fill-rule="evenodd" d="{stadium(x0, pill_y, pill_w, pill_h)} {circ(round(kcx,2), 128, knob_r)} {translate_path(q["d"], qx, base)}"/>',
                   w=round(x0 + pill_w + 2), h=256)
    return svg(f'<path fill="{dr_col}" transform="translate(0,{base:.2f})" d="{dr["d"]}"/>'
               f'<path fill="{pill_col}" d="{stadium(x0, pill_y, pill_w, pill_h)}"/>'
               f'<path fill="{q_col}" transform="translate({qx:.2f},{base:.2f})" d="{q["d"]}"/>'
               f'<circle cx="{kcx:.2f}" cy="128" r="{knob_r}" fill="{knob_col}"/>', w=round(x0 + pill_w + 2), h=256)
import re as _re
def translate_path(dd, tx, ty):
    q2 = json.loads(subprocess.check_output(['python3', 'outline.py', 'Quick', '--size', '150', '--track', '-0.04']))
    # re-outline with offset baked in via fontTools-free transform of absolute commands
    out = []; toks = _re.findall(r'[MLQCZHV]|-?\d*\.?\d+(?:e-?\d+)?', dd)
    i = 0; cmd = None; xy = 0
    for t in toks:
        if _re.match(r'[A-Z]', t): cmd = t; out.append(t); xy = 0; continue
        v = float(t)
        if cmd == 'H': v += tx
        elif cmd == 'V': v += ty
        else: v += tx if xy % 2 == 0 else ty; xy += 1
        out.append(f'{v:.2f}')
    return ' '.join(out)
reg(d, 'lockup-colour', a_lock(F, L, F, F))
reg(d, 'lockup-on-forest', a_lock(W, L, F, F))
reg(d, 'lockup-forest', a_lock(None, None, None, None, mono=F))
reg(d, 'lockup-black', a_lock(None, None, None, None, mono='#000000'))
reg(d, 'lockup-white', a_lock(None, None, None, None, mono=W))
reg(d, 'app-icon', open('concepts/a-app.svg').read()); reg(d, 'favicon', open('concepts/a-fav.svg').read())
reg(d, 'app-icon-ios', open('concepts/a-app.svg').read().replace('rx="56"', 'rx="0"'))

# --- B, C ---
for d, sd, app, fav in (('b-bubble-q', B_d, 'b-app', 'b-fav'), ('c-dq', C_d, 'c-app', 'c-fav')):
    for nm, c in (('forest', F), ('black', '#000000'), ('white', W), ('lime', L)):
        reg(d, f'symbol-{nm}', svg(f'<path fill="{c}" d="{sd}"/>'))
    for nm, sc, wc in (('colour', F, F), ('on-forest', L, W), ('forest', F, F), ('black', '#000000', '#000000'), ('white', W, W)):
        sb, wb, ww = word_lockup(f'<path fill="{sc}" d="{sd}"/>', wc)
        reg(d, f'lockup-{nm}', svg(sb + wb, w=ww, h=256))
    reg(d, 'app-icon', open(f'concepts/{app}.svg').read()); reg(d, 'favicon', open(f'concepts/{fav}.svg').read())
    reg(d, 'app-icon-ios', open(f'concepts/{app}.svg').read().replace('rx="56"', 'rx="0"'))
json.dump(VARIANTS, open('variants.json', 'w'))
print('variants', {k: len(v) for k, v in VARIANTS.items()})
