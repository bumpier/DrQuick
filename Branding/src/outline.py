"""Outline Plus Jakarta Sans at a given weight into SVG path data.
usage: outline.py TEXT [--wght 800] [--track -0.04] [--size 100]
prints JSON {d, width, ascent, capHeight, glyphs:[{char,x,adv,d}]}"""
import sys, json, argparse
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
ap = argparse.ArgumentParser(); ap.add_argument('text'); ap.add_argument('--wght', type=float, default=800)
ap.add_argument('--track', type=float, default=-0.04); ap.add_argument('--size', type=float, default=100)
a = ap.parse_args()
f = TTFont(__file__.rsplit('/',1)[0] + '/PlusJakartaSans-Variable.woff2')
f = instantiateVariableFont(f, {'wght': a.wght})
from fontTools.ttLib.removeOverlaps import removeOverlaps
removeOverlaps(f)  # merged outlines, so knockouts and one-colour fills stay clean
upm = f['head'].unitsPerEm; s = a.size / upm
cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']
cap = f['OS/2'].sCapHeight * s; asc = f['hhea'].ascent * s
x = 0; out = []; full = []
for ch in a.text:
    g = cmap[ord(ch)]; adv = hmtx[g][0] * s
    pen = SVGPathPen(gs); tp = TransformPen(pen, (s, 0, 0, -s, x, 0)); gs[g].draw(tp)
    d = pen.getCommands(); out.append({'char': ch, 'x': round(x, 2), 'adv': round(adv, 2), 'd': d}); full.append(d)
    x += adv + a.track * a.size
print(json.dumps({'d': ' '.join(full), 'width': round(x - a.track * a.size, 2), 'capHeight': round(cap, 2), 'ascent': round(asc, 2), 'glyphs': out}))
