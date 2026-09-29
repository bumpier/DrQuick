"""Round 2: three refinements of direction A (Switch on) that say 'doctor'."""
import json, subprocess, os, math
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.svgPathPen import SVGPathPen
F, L, W, K = '#163300', '#9FE870', '#FFFFFF', '#000000'

def P(d):
    p = pathops.Path(); parse_path(d, p.getPen()); return p
def D(p):
    pen = SVGPathPen(None); p.draw(pen); return pen.getCommands()
def op(a, b, kind):
    return pathops.op(a, b, getattr(pathops.PathOp, kind))
def U(*ps):
    r = ps[0]
    for p in ps[1:]: r = op(r, p, 'UNION')
    return r
def circ(cx, cy, r):
    return P(f'M{cx-r},{cy} A{r},{r} 0 1 1 {cx+r},{cy} A{r},{r} 0 1 1 {cx-r},{cy}Z')
def stad(x, y, w, h):
    r = min(w, h)/2
    if w >= h:
        return P(f'M{x+r},{y} H{x+w-r} A{r},{r} 0 0 1 {x+w-r},{y+h} H{x+r} A{r},{r} 0 0 1 {x+r},{y}Z')
    return P(f'M{x},{y+r} A{r},{r} 0 0 1 {x+w},{y+r} V{y+h-r} A{r},{r} 0 0 1 {x},{y+h-r} Z')
def plus(cx, cy, arm, t):
    # rounded plus: two stadiums, arm = half-length, t = bar thickness
    return U(stad(cx-arm, cy-t/2, 2*arm, t), stad(cx-t/2, cy-arm, t, 2*arm))
def svg(body, w=256, h=256, title='DrQuick'):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
def path(p, fill): return f'<path fill="{fill}" d="{D(p)}"/>'

M = {}  # name -> dict(colour=[(path, fill)...], mono=path, fav=[(path, fill)], tile=bg for icons)

# ---- R1: Plus knob. The switch is on, and what it switches on is a doctor. ----
track = stad(16, 64, 224, 128)
knob = circ(176, 128, 48)
pl = plus(176, 128, 28, 20)
M['r1-plus-knob'] = dict(
    colour=[(track, L), (op(knob, pl, 'DIFFERENCE'), F)],
    mono=op(op(track, knob, 'DIFFERENCE'), pl, 'UNION') if False else U(op(track, knob, 'DIFFERENCE'), pl),
    fav=[(op(circ(128, 128, 118), plus(128, 128, 66, 46), 'DIFFERENCE'), F)], favtile=L,
    tile=F, scale=0.76, favscale=1.0, knob='disc')

# ---- R2: Switch cross. A medical plus built from two switch tracks; the knob sits at the 'on' end. ----
hbar = stad(16, 84, 224, 88); vbar = stad(84, 16, 88, 224)
cross = U(hbar, vbar)
k2 = circ(194, 128, 34)
M['r2-switch-cross'] = dict(
    colour=[(cross, L), (k2, F)],
    mono=op(cross, k2, 'DIFFERENCE'),
    fav=[(cross, L), (circ(194, 128, 34), F)],
    tile=F, scale=0.78, favscale=0.96)

# ---- R3: Plus knob, bare. The plus itself has slid to "on". ----
p3 = plus(176, 128, 40, 30)
M['r3-plus-on'] = dict(
    colour=[(track, L), (p3, F)],
    mono=op(track, p3, 'DIFFERENCE'),
    fav=[(track, L), (plus(176, 128, 44, 36), F)],
    tile=F, scale=0.76, favscale=0.96, knob='plus')

def outline(t, size=150, track=-0.04):
    return json.loads(subprocess.check_output(['python3', 'outline.py', t, '--size', str(size), '--track', str(track)]))
wq = outline('DrQuick')
def tr(p, dx, dy, s=1.0):
    q = pathops.Path(); 
    from fontTools.pens.transformPen import TransformPen
    p.draw(TransformPen(q.getPen(), (s, 0, 0, s, dx, dy))); return q
def textpath(dx, dy): return tr(P(wq['d']), dx, dy)

V = {}
for name, m in M.items():
    out = f'../{name}'; os.makedirs(f'{out}/png', exist_ok=True)
    reg = lambda n, s_: (V.setdefault(name, {}).__setitem__(n, s_), open(f'{out}/{n}.svg', 'w').write(s_))
    col = ''.join(path(p, f) for p, f in m['colour'])
    reg('symbol-colour', svg(col))
    for nm, c in (('forest', F), ('black', K), ('white', W)):
        reg(f'symbol-{nm}', svg(path(m['mono'], c)))
    # lockup: symbol, gap, DrQuick set in Jakarta 800 (text cap height centred on the symbol)
    ty = 128 + wq['capHeight']/2; gap = 36; lw = round(256 + gap + wq['width'] + 6)
    txt = D(textpath(256 + gap, ty))
    for nm, sym, tc in (('colour', col, F), ('on-forest', col, W)):
        reg(f'lockup-{nm}', svg(sym + f'<path fill="{tc}" d="{txt}"/>', w=lw))
    for nm, c in (('forest', F), ('black', K), ('white', W)):
        reg(f'lockup-{nm}', svg(path(m['mono'], c) + f'<path fill="{c}" d="{txt}"/>', w=lw))
    def icon(parts, sc, rx, bg=None):
        off = 128 - 128*sc
        return svg(f'<rect width="256" height="256" rx="{rx}" fill="{bg or m["tile"]}"/>' + ''.join(path(tr(p, off, off, sc), f) for p, f in parts))
    reg('app-icon', icon(m['colour'], m['scale'], 56))
    reg('app-icon-ios', icon(m['colour'], m['scale'], 0))
    reg('favicon', icon(m['fav'], m['favscale'], 48, m.get('favtile')))
    if m.get('knob'):
        # primary lockup = the site's wordmark: "Dr", then the lime pill holding "Quick" and the knob
        size = 150; dr = outline('Dr', size); q = outline('Quick', size)
        base = 128 + dr['capHeight']/2; ph = 176; py = 128 - ph/2; pad = 0.32*size*0.9
        x0 = dr['width'] + 0.12*size; kr = ph/2 - 22; qx = x0 + pad
        pw = pad + q['width'] + 0.18*size + 2*kr + 22; kcx = x0 + pw - 22 - kr
        pill = stad(x0, py, pw, ph); drp = tr(P(dr['d']), 0, base); qp = tr(P(q['d']), qx, base)
        if m['knob'] == 'disc':
            kd = op(circ(kcx, 128, kr), plus(kcx, 128, kr*0.58, kr*0.42), 'DIFFERENCE'); kmono = U(op(pill, circ(kcx, 128, kr), 'DIFFERENCE'), plus(kcx, 128, kr*0.58, kr*0.42))
        else:
            kd = plus(kcx, 128, kr*0.83, kr*0.62); kmono = op(pill, kd, 'DIFFERENCE')
        pw_ = round(x0 + pw + 2)
        for nm, dc in (('colour', F), ('on-forest', W)):
            reg(f'wordmark-{nm}', svg(path(drp, dc) + path(pill, L) + path(qp, F) + path(kd, F), w=pw_))
        mono_pill = op(kmono, qp, 'DIFFERENCE')
        for nm, c in (('forest', F), ('black', K), ('white', W)):
            reg(f'wordmark-{nm}', svg(path(drp, c) + path(mono_pill, c), w=pw_))
json.dump(V, open('variants2.json', 'w'))
print({k: len(v) for k, v in V.items()})
