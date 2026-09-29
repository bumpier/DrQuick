"""Builds Branding/guide/drquick-brand-guidelines.html from the shipped SVGs. Run after build.py."""
import re, os, datetime

ROOT = os.path.abspath('..')
def raw(mark, cw):
    return open(f'{ROOT}/logo/svg/{cw}/drquick-{mark}-{cw}.svg').read()
def vb(svg): return [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
def inner(svg): return re.sub(r'^.*?<title>.*?</title>|</svg>\s*$', '', svg, flags=re.S)
def m(mark, cw, cls='', label=None):
    """A mark inline. Decorative unless a label is given."""
    s = raw(mark, cw); x, y, w, h = vb(s)
    a11y = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    return f'<svg class="{cls}" viewBox="{x} {y} {w} {h}" {a11y}>{inner(s)}</svg>'
def file(path): return open(f'{ROOT}/{path}').read()
def svgfile(path, cls='', label=None, style=''):
    s = file(path); a11y = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
    st = f' style="{style}"' if style else ''
    return re.sub(r'<svg [^>]*?viewBox="([^"]+)"[^>]*>(<title>.*?</title>)?', lambda k: f'<svg class="{cls}"{st} viewBox="{k.group(1)}" {a11y}>', s, count=1)

ANN = '#4D5B45'
sym = raw('symbol', 'colour'); sym_in = inner(sym)

# ---------- construction diagram (symbol units: track 224 x 128, T = 128) ----------
construction = f'''<svg class="diagram" viewBox="-70 -70 380 290" role="img" aria-label="Symbol construction: the track is 1.75T wide and T tall; the knob sits T/8 in from the edge with radius 3T/8; the plus arms are 0.58 of the knob radius long and 0.42 thick">
  <g stroke="{ANN}" stroke-width="1.5" fill="none" stroke-dasharray="5 5">
    <rect x="0" y="0" width="224" height="128"/>
    <line x1="160" y1="-30" x2="160" y2="160"/><line x1="-30" y1="64" x2="250" y2="64"/>
    <circle cx="160" cy="64" r="64"/>
  </g>
  {sym_in}
  <g fill="none" stroke="{ANN}" stroke-width="1.5">
    <line x1="0" y1="-40" x2="224" y2="-40"/><line x1="0" y1="-46" x2="0" y2="-34"/><line x1="224" y1="-46" x2="224" y2="-34"/>
    <line x1="-40" y1="0" x2="-40" y2="128"/><line x1="-46" y1="0" x2="-34" y2="0"/><line x1="-46" y1="128" x2="-34" y2="128"/>
    <line x1="208" y1="150" x2="224" y2="150"/><line x1="208" y1="144" x2="208" y2="156"/><line x1="224" y1="144" x2="224" y2="156"/>
  </g>
  <g fill="{ANN}" font-family="Plus Jakarta Sans, sans-serif" font-size="14" font-weight="700">
    <text x="112" y="-48" text-anchor="middle">1.75T</text>
    <text x="-50" y="69" text-anchor="end">T</text>
    <text x="216" y="176" text-anchor="middle">T/8</text>
    <text x="112" y="208" text-anchor="middle">knob r = 3T/8 · plus arm 0.58r · bar 0.42r</text>
  </g>
</svg>'''

# ---------- clear space (wordmark units: pill height 176, knob radius 66) ----------
wm = raw('wordmark', 'colour'); wx, wy, ww, wh = vb(wm); X = 66
clear_wm = f'''<svg class="diagram" viewBox="{wx-X} {wy-X} {ww+2*X} {wh+2*X}" role="img" aria-label="Clear space around the wordmark equals the knob's radius on every side">
  <rect x="{wx-X+1.5}" y="{wy-X+1.5}" width="{ww+2*X-3}" height="{wh+2*X-3}" fill="none" stroke="#2F6B0F" stroke-width="3" stroke-dasharray="10 8"/>
  <rect x="{wx}" y="{wy}" width="{ww}" height="{wh}" fill="none" stroke="{ANN}" stroke-width="1.5" stroke-dasharray="4 5"/>
  {inner(wm)}
  <g fill="#2F6B0F"><rect x="{wx-X}" y="{wy+wh/2-1.5}" width="{X}" height="3"/><rect x="{wx+ww/2-1.5}" y="{wy-X}" width="3" height="{X}"/></g>
  <g fill="#2F6B0F" font-family="Plus Jakarta Sans, sans-serif" font-size="30" font-weight="800">
    <text x="{wx-X/2}" y="{wy+wh/2-12}" text-anchor="middle">x</text><text x="{wx+ww/2+14}" y="{wy-X/2+10}">x</text>
  </g>
</svg>'''
sx, sy, sw_, sh = vb(sym); XS = 48
clear_sym = f'''<svg class="diagram small" viewBox="{sx-XS} {sy-XS} {sw_+2*XS} {sh+2*XS}" role="img" aria-label="Clear space around the symbol equals the knob's radius">
  <rect x="{sx-XS+1.5}" y="{sy-XS+1.5}" width="{sw_+2*XS-3}" height="{sh+2*XS-3}" fill="none" stroke="#2F6B0F" stroke-width="3" stroke-dasharray="8 6"/>
  {sym_in}
  <rect x="{sx+sw_}" y="{sy+sh/2-1.5}" width="{XS}" height="3" fill="#2F6B0F"/>
  <text x="{sx+sw_+XS/2}" y="{sy+sh/2-10}" text-anchor="middle" fill="#2F6B0F" font-family="Plus Jakarta Sans, sans-serif" font-size="24" font-weight="800">x</text>
</svg>'''

# ---------- android safe zone ----------
fg = file('app-icon/android/ic_launcher_foreground.svg')
safe = f'''<svg class="diagram small" viewBox="0 0 432 432" role="img" aria-label="Android adaptive icon: the mark sits inside the 66dp safe circle of the 108dp canvas">
  <rect width="432" height="432" fill="#163300"/>
  {inner(fg)}
  <circle cx="216" cy="216" r="144" fill="none" stroke="#B5C9A5" stroke-width="2" stroke-dasharray="6 6"/>
  <circle cx="216" cy="216" r="132" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <text x="216" y="410" text-anchor="middle" fill="#FFFFFF" font-family="Plus Jakarta Sans, sans-serif" font-size="18" font-weight="700">66dp safe zone · 72dp visible mask</text>
</svg>'''

# ---------- motion demo: the knob slides to "on" ----------
paths = re.findall(r'<path [^>]+/>', sym)
motion = f'''<svg class="motion-mark" viewBox="{sx} {sy} {sw_} {sh}" aria-hidden="true">{paths[0]}<g class="knob">{''.join(paths[1:])}</g></svg>'''

CW = [('colour', 'Colour', 'White, ground, lime-wash, sage and stone', 'ground'),
      ('reversed', 'Reversed', 'Forest and dark photography tiles', 'band'),
      ('forest', 'Forest', 'Single colour on light grounds and on lime', 'white'),
      ('lime', 'Lime', 'Single colour on forest only', 'band'),
      ('black', 'Black', 'Black-only print, stamps, newspapers, engraving', 'white'),
      ('white', 'White', 'Single colour on dark grounds and photography tiles', 'band')]
colourways = ''.join(f'''<div class="cw"><div class="sw t-{bg}">{m('wordmark', k, 'cw-wm')}{m('symbol', k, 'cw-sym')}</div>
  <b>{name}</b><span>{use}</span><code>logo/svg/{k}/</code></div>''' for k, name, use, bg in CW)

FAMILY = [('wordmark', 'Wordmark', 'Primary', 'The default everywhere there is room: the site header, email, documents, signage, press.', 'ground'),
          ('lockup-horizontal', 'Horizontal lockup', 'Secondary', 'Wide, short spaces where the symbol should lead: app store headers, partner lists, footers.', 'ground'),
          ('lockup-stacked', 'Stacked lockup', 'Secondary', 'Square or tall spaces: posters, merchandise, event screens.', 'ground'),
          ('symbol', 'Symbol', 'Supporting', 'Only where the name is present nearby or the space is square: app icon, avatars, loaders.', 'band'),
          ('knob', 'Knob', 'Small sizes only', 'Below 24px, where the switch gets too thin: the favicon and tiny UI badges.', 'ground')]
family = ''.join(f'''<div class="fam fam-{k}"><div class="sw t-{bg}">{m(k, 'colour', 'fam-mark')}</div>
  <div class="fam-t"><div class="fam-h"><b>{name}</b><span class="pill {'rec' if role == 'Primary' else 'kind'}">{role}</span></div><p>{use}</p><code>drquick-{k}-*.svg</code></div></div>''' for k, name, role, use, bg in FAMILY)

BGS = [('White', 'white', 'colour', True), ('Ground', 'ground', 'colour', True), ('Lime-wash', 'wash', 'colour', True),
       ('Sage', 'sage', 'colour', True), ('Stone', 'stone', 'colour', True), ('Forest, reversed', 'band', 'reversed', True),
       ('Lime, forest single colour', 'lime', 'forest', True), ('Lime, colour version', 'lime', 'colour', False),
       ('Forest, colour version', 'band', 'colour', False), ('Mid-tone ground', 'outline', 'colour', False)]
bgs = ''.join(f'''<div class="bg"><div class="sw t-{bg}">{m('wordmark', cw, 'bg-mark')}</div><span class="{'ok' if ok else 'no'}">{'✓' if ok else '✕'} {name}</span></div>''' for name, bg, cw, ok in BGS)

wm_c = m('wordmark', 'colour', 'dont-mark')
sym_c = m('symbol', 'colour', 'dont-sym')
DONTS = [
    (wm_c.replace('class="dont-mark"', 'class="dont-mark" style="transform:scaleX(1.35)"'), 'Stretch, squash or skew it.'),
    (sym_c.replace('class="dont-sym"', 'class="dont-sym" style="transform:scaleX(-1)"'), 'Flip the switch. The plus always sits on the right, in the on position.'),
    (wm_c.replace('<path fill="#9FE870"', '<defs><pattern id="hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="#FFFFFF"/><rect width="5" height="14" fill="#6B7A63"/></pattern></defs><path fill="url(#hatch)"', 1), 'Recolour it. Only forest, lime and white. NHS blue and NHS green, and anything near either, are banned.'),
    (wm_c.replace('class="dont-mark"', 'class="dont-mark" style="transform:rotate(-8deg)"'), 'Rotate it or set it on a curve.'),
    (wm_c.replace('class="dont-mark"', 'class="dont-mark" style="filter:drop-shadow(0 6px 6px rgb(0 0 0 / .45))"'), 'Add shadows, glows, gradients, bevels or outlines.'),
    ('<span class="retyped">Dr Quick</span>', 'Retype it or split the name into two words. Always place the artwork file.'),
    (sym_c.replace('#163300', '#FFFFFF', 1), 'Rebuild or recolour the parts: the knob is forest and the plus is lime.'),
    (f'<div class="urgent">{wm_c}<span>Prices surging now! Book before it rises</span></div>', 'Put it next to price urgency, countdowns or "busy now" language.'),
    (f'<div class="photo">{m("wordmark", "colour", "dont-mark")}</div>', 'Set it straight on a photograph. Put it on a forest or white tile.'),
    (f'<div class="ui-row"><span>Notifications</span>{sym_c}</div>', 'Use the symbol as a working switch in the product UI.'),
    (f'<div class="crowd">{m("wordmark", "colour", "dont-mark")}<span>Book now</span></div>', 'Crowd it. Keep the clear space free of text and edges.'),
    (m('wordmark', 'colour', 'dont-mark').replace('<path fill="#163300"', '<path fill="#9FE870"', 1), 'Set "Dr" in lime. On a light ground lime is a fill, never text.'),
]
donts = ''.join(f'<div class="dont"><div class="sw">{art}<span class="x" aria-hidden="true">✕</span></div><span>{txt}</span></div>' for art, txt in DONTS)

head_snippet = file('favicon/head.html').strip()
esc = lambda t: t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

TREE = '''Branding/
├── README.md
├── guide/drquick-brand-guidelines.html
├── logo/
│   ├── svg/{colour,reversed,forest,lime,black,white}/
│   │   └── drquick-{wordmark,lockup-horizontal,lockup-stacked,symbol,knob}-<colourway>.svg
│   └── png/<colourway>/…-1000.png and …-4000.png   (long edge, transparent)
├── app-icon/
│   ├── app-icon-master.svg              square, full bleed
│   ├── ios/AppIcon.appiconset/          Xcode: one opaque 1024px image
│   ├── ios/sizes/icon-20 … icon-180.png
│   ├── android/res/                     adaptive, monochrome, legacy mipmaps
│   ├── android/play-store-512.png
│   └── expo/                            icon, adaptive icon, splash, app.json snippet
├── favicon/                             ico, svg, PNGs, touch icon, manifest, head.html
├── social/                              avatar, Open Graph card, email signature
└── src/                                 build.py, guide.py, outline.py, font'''

today = datetime.date(2026, 9, 29).strftime('%-d %B %Y')
fav_at = lambda px, label=None: svgfile('favicon/favicon.svg', 'ai', label, f'width:{px}px;height:{px}px;flex:none')

def render(font_url, pdf_url):
  pdf_link = f'<a class="pill dl" href="{pdf_url}" download>Download PDF</a>' if pdf_url else ''
  return f'''<title>DrQuick Brand Guidelines</title>
<meta name="description" content="How to use the DrQuick logo, colour, icons and type.">
<style>
@font-face {{ font-family: "Plus Jakarta Sans"; src: url("{font_url}") format("woff2"); font-weight: 200 800; font-style: normal; font-display: swap; }}
/* Layout: the site's bento. Numbered chapters on the green ground, rounded tiles 16px apart, forest for the payoff.
   Single look by choice: the brand has no dark theme (DESIGN.md), so every colour is set explicitly. */
:root {{
  --surface: #F5F7F2; --surface-mid: #EDF1E8; --white: #FFFFFF; --ink: #163300; --ink-2: #4D5B45; --rule: #DCE4D4;
  --band: #163300; --band-ink-2: #B5C9A5; --primary: #9FE870; --primary-ink: #2F6B0F;
  --wash: #E2F6D5; --sage: #C9DDB8; --stone: #E8E5DB; --error: #C8322A;
  --font: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  color-scheme: light;
}}
body {{ background: var(--surface); color: var(--ink); font: 400 16px/1.55 var(--font); }}
.wrap {{ max-width: 1200px; margin: 0 auto; padding-inline: 24px; padding-block: 24px 72px; display: grid; gap: 72px; }}
h1, h2, h3 {{ margin: 0; text-wrap: balance; }}
h1 {{ font-size: clamp(40px, 6vw, 76px); font-weight: 800; line-height: 1.02; letter-spacing: -0.035em; }}
h2 {{ font-size: clamp(30px, 4vw, 48px); font-weight: 800; line-height: 1.08; letter-spacing: -0.03em; }}
h3 {{ font-size: 18px; font-weight: 700; letter-spacing: -0.015em; }}
p {{ margin: 0; }}
svg {{ max-width: 100%; }}
code {{ font-family: var(--mono); font-size: .84em; background: rgb(22 51 0 / .07); padding: 1px 6px; border-radius: 6px; overflow-wrap: anywhere; }}
.muted {{ color: var(--ink-2); }}
.tile {{ border-radius: 32px; padding: 28px; min-width: 0; display: grid; gap: 14px; align-content: start; }}
.t-white {{ background: var(--white); box-shadow: 0 0 0 1px rgb(22 51 0 / .06); }}
.t-ground {{ background: var(--surface); }} .t-quiet {{ background: var(--surface-mid); }}
.t-band {{ background: var(--band); color: var(--white); }}
.t-band p, .t-band .muted {{ color: var(--band-ink-2); }} .t-band h3 {{ color: var(--primary); }}
.t-band code {{ background: rgb(255 255 255 / .12); }}
.t-wash {{ background: var(--wash); }} .t-sage {{ background: var(--sage); }} .t-stone {{ background: var(--stone); }}
.t-lime {{ background: var(--primary); }} .t-outline {{ background: #6B7A63; }}
.pill {{ display: inline-flex; align-items: center; border-radius: 9999px; padding: 5px 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }}
.rec {{ background: var(--primary); color: var(--ink); }}
.kind {{ background: var(--white); box-shadow: inset 0 0 0 2px var(--rule); }}
.sw {{ border-radius: 20px; display: grid; place-items: center; padding: 18px; min-height: 110px; }}
.sw.t-white {{ box-shadow: 0 0 0 1px var(--rule); }}
a {{ color: var(--primary-ink); }}
a:focus-visible, button:focus-visible {{ outline: 3px solid var(--ink); outline-offset: 3px; border-radius: 6px; }}

.cover {{ display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }}
.cover .t-band {{ padding: 44px; gap: 36px; min-height: 380px; align-content: space-between; }}
.cover-wm {{ width: min(100%, 520px); height: auto; }}
.cover .t-band h1 {{ color: var(--white); }}
.meta {{ display: flex; gap: 10px; flex-wrap: wrap; }}
.meta .pill {{ background: rgb(255 255 255 / .1); color: var(--white); }}
.toc {{ list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }}
.toc a {{ display: grid; grid-template-columns: 2.2em 1fr; padding: 7px 10px; border-radius: 12px; text-decoration: none; color: var(--ink); font-weight: 500; font-variant-numeric: tabular-nums; }}
.toc a:hover {{ background: var(--surface-mid); }}
.toc a span {{ color: var(--primary-ink); font-weight: 800; }}

.ch {{ display: grid; gap: 20px; scroll-margin-top: 16px; }}
.ch-head {{ display: grid; gap: 10px; max-width: 72ch; }}
.ch-head .num {{ font-size: 14px; font-weight: 800; color: var(--primary-ink); font-variant-numeric: tabular-nums; letter-spacing: .02em; }}
.ch-head p {{ color: var(--ink-2); font-size: 17px; }}
.g {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }}
.s2 {{ grid-column: span 2; }} .s3 {{ grid-column: span 3; }} .s4 {{ grid-column: span 4; }} .s6 {{ grid-column: span 6; }}

.idea {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }}
.idea .tile > svg {{ height: 64px; width: auto; justify-self: start; margin-bottom: 8px; }}

.family {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }}
.fam {{ display: grid; gap: 12px; align-content: start; background: var(--white); border-radius: 32px; padding: 16px; box-shadow: 0 0 0 1px rgb(22 51 0 / .06); min-width: 0; }}
.fam-wordmark {{ grid-column: span 6; grid-template-columns: 1.4fr 1fr; align-items: center; }}
.fam-wordmark .sw {{ min-height: 220px; }} .fam-wordmark .fam-mark {{ width: min(100%, 460px); max-height: none; }}
.fam-lockup-horizontal, .fam-lockup-stacked, .fam-symbol, .fam-knob {{ grid-column: span 3; }}
.fam .sw {{ min-height: 180px; }}
.fam-mark {{ width: min(100%, 320px); height: auto; max-height: 140px; }}
.fam-t {{ display: grid; gap: 6px; padding: 4px 8px 8px; }}
.fam-h {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }}
.fam-t p {{ color: var(--ink-2); font-size: 15px; }}

.diagram {{ width: 100%; height: auto; display: block; }}
.diagram.small {{ max-width: 360px; margin: 0 auto; }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid rgb(22 51 0 / .12); vertical-align: top; }}
th {{ font-weight: 700; font-size: 13px; color: var(--ink-2); }}
.tscroll {{ overflow-x: auto; }}

.swatches {{ display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 12px; }}
.swatch {{ border-radius: 24px; min-height: 180px; padding: 18px; display: grid; align-content: end; gap: 2px; font-size: 13px; font-variant-numeric: tabular-nums; }}
.swatch b {{ font-size: 18px; margin-bottom: 4px; }}
.swatch.inkfill {{ background: var(--primary-ink); color: var(--white); }}
.swatch.paper {{ background: var(--white); box-shadow: 0 0 0 1px var(--rule); }}
.tones {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }}
.tone {{ border-radius: 18px; min-height: 84px; padding: 12px; display: grid; align-content: end; font-size: 12px; font-variant-numeric: tabular-nums; }}
.tone b {{ font-size: 13px; }}
.tone.ground {{ background: var(--surface); box-shadow: inset 0 0 0 1px var(--rule); }}
.ratio {{ display: flex; height: 32px; border-radius: 9999px; overflow: hidden; box-shadow: 0 0 0 1px var(--rule); }}
.ratio span {{ display: grid; place-items: center; font-size: 12px; font-weight: 700; }}

.cws {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }}
.cw {{ display: grid; gap: 6px; align-content: start; font-size: 14px; }}
.cw .sw {{ gap: 18px; min-height: 180px; }}
.cw-wm {{ width: min(100%, 260px); height: auto; }} .cw-sym {{ width: 88px; height: auto; }}
.cw span {{ color: var(--ink-2); }}

.bgs {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }}
.bg {{ display: grid; gap: 6px; font-size: 13px; font-weight: 700; align-content: start; }}
.bg .sw {{ min-height: 96px; padding: 14px; }} .bg-mark {{ width: 100%; max-width: 150px; height: auto; }}
.ok {{ color: var(--primary-ink); }} .no {{ color: var(--error); }}

.donts {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
.dont {{ display: grid; gap: 8px; font-size: 14px; align-content: start; }}
.dont .sw {{ position: relative; min-height: 130px; background: var(--white); box-shadow: 0 0 0 1px rgb(22 51 0 / .06); overflow: hidden; }}
.dont-mark {{ width: 100%; max-width: 170px; height: auto; }} .dont-sym {{ width: 90px; height: auto; }}
.x {{ position: absolute; top: 10px; right: 10px; width: 24px; height: 24px; border-radius: 9999px; background: var(--error); color: var(--white); display: grid; place-items: center; font-weight: 800; font-size: 12px; line-height: 1; }}
.retyped {{ font-weight: 800; font-size: 30px; letter-spacing: -.04em; }}
.urgent {{ display: grid; justify-items: center; gap: 6px; }} .urgent span {{ font-size: 11px; font-weight: 700; color: var(--error); }}
.photo {{ position: relative; width: 100%; height: 100px; border-radius: 14px; display: grid; place-items: center; background: var(--sage); overflow: hidden; }}
.photo::before {{ content: ""; position: absolute; width: 150px; height: 150px; border-radius: 50%; background: var(--stone); right: -30px; top: -40px; }}
.photo svg {{ position: relative; }}
.ui-row {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; max-width: 210px; background: var(--surface); border-radius: 12px; padding: 10px 12px; font-size: 13px; font-weight: 500; }}
.ui-row svg {{ width: 48px; height: auto; }}
.crowd {{ display: grid; justify-items: center; }} .crowd span {{ font-size: 13px; font-weight: 800; margin-top: -2px; }}

.appicons {{ display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }}
.appicons figure, .favs figure {{ margin: 0; display: grid; justify-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); font-variant-numeric: tabular-nums; }}
.ai {{ display: block; height: auto; }}
.sq {{ border-radius: 22.5%; }} .round {{ border-radius: 50%; }}
.tab {{ display: flex; align-items: center; gap: 8px; background: var(--white); border-radius: 12px 12px 0 0; padding: 10px 14px; max-width: 300px; font-size: 13px; box-shadow: 0 0 0 1px rgb(22 51 0 / .08); }}
.tab span {{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }}
.favs {{ display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }}
pre {{ margin: 0; background: var(--band); color: var(--wash); border-radius: 18px; padding: 18px; overflow-x: auto; font: 13px/1.6 var(--mono); }}
pre.tree {{ background: var(--white); color: var(--ink); box-shadow: 0 0 0 1px var(--rule); }}
.btn {{ justify-self: start; font: 700 15px var(--font); background: var(--primary); color: var(--ink); border: 0; border-radius: 9999px; padding: 12px 20px; cursor: pointer; min-height: 48px; }}
.btn:hover {{ background: #8BDB57; }}
.dl {{ background: var(--primary) !important; color: var(--ink) !important; text-decoration: none; }}
.og {{ width: 100%; height: auto; border-radius: 18px; display: block; }}

.type-spec {{ gap: 14px; }}
.type-row {{ display: grid; grid-template-columns: 8em 1fr; gap: 14px; align-items: baseline; border-bottom: 1px solid rgb(22 51 0 / .1); padding-bottom: 12px; }}
.type-row small {{ color: var(--ink-2); font-size: 12px; font-variant-numeric: tabular-nums; }}

.motion {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }}
.stage {{ place-items: center; gap: 22px; min-height: 260px; align-content: center; }}
.motion-mark {{ width: min(70%, 280px); height: auto; }}
.motion-mark .knob {{ transform: translateX(-96px); transition: transform 420ms cubic-bezier(.34, 1.36, .64, 1); }}
.stage.on .motion-mark .knob {{ transform: translateX(0); }}
@media (prefers-reduced-motion: reduce) {{ .motion-mark .knob {{ transition: none; }} }}

.rules {{ margin: 0; padding-left: 1.15em; display: grid; gap: 10px; }}
.rules li::marker {{ color: var(--primary-ink); }}
.t-band .rules li::marker {{ color: var(--primary); }}
footer {{ display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; font-size: 14px; color: var(--ink-2); border-top: 1px solid var(--rule); padding-top: 20px; }}

@page {{ size: A4 landscape; margin: 11mm; }}
@media print {{
  :root {{ print-color-adjust: exact; -webkit-print-color-adjust: exact; }}
  body {{ font-size: 13px; }}
  .wrap {{ max-width: none; padding: 0; gap: 0; display: block; zoom: .8; }}
  pre {{ font-size: 10px; white-space: pre; overflow: visible; }}
  .cover {{ min-height: 180mm; }}
  .ch {{ break-before: page; gap: 12px; padding-top: 2mm; }}
  .ch-head p {{ font-size: 14px; }}
  h2 {{ font-size: 30px; }}
  .tile, .fam, .cw, .bg, .dont, tr, pre {{ break-inside: avoid; }}
  .tile {{ padding: 16px; border-radius: 20px; gap: 10px; }}
  .btn, .dl, .toc a:hover {{ display: none; }}
  .motion-mark .knob {{ transform: none !important; transition: none !important; }}
  .fam-wordmark .sw {{ min-height: 150px; }} .fam .sw {{ min-height: 120px; }}
  .cw .sw {{ min-height: 120px; }} .cw-wm {{ width: 200px; }} .cw-sym {{ width: 64px; }}
  .donts {{ grid-template-columns: repeat(6, 1fr); }} .dont .sw {{ min-height: 96px; }}
  .dont-mark {{ max-width: 120px; }} .dont-sym {{ width: 64px; }} .dont {{ font-size: 11px; }}
  .bgs {{ grid-template-columns: repeat(10, 1fr); }} .bg .sw {{ min-height: 64px; padding: 8px; }} .bg {{ font-size: 10px; }}
  .diagram.small {{ max-width: 250px; }}
  footer {{ break-before: avoid; margin-top: 16px; }}
}}
@media (max-width: 1080px) {{
  .s2 {{ grid-column: span 3; }} .s4 {{ grid-column: span 6; }}
  .donts {{ grid-template-columns: repeat(3, 1fr); }}
  .swatches {{ grid-template-columns: 1fr 1fr; }}
}}
@media (max-width: 900px) {{
  .cover, .idea, .motion {{ grid-template-columns: 1fr; }}
  .g, .family {{ grid-template-columns: 1fr; }}
  .s2, .s3, .s4, .s6, .fam-wordmark, .fam-lockup-horizontal, .fam-lockup-stacked, .fam-symbol, .fam-knob {{ grid-column: 1 / -1; }}
  .fam-wordmark {{ grid-template-columns: 1fr; }}
  .cws, .donts {{ grid-template-columns: 1fr 1fr; }}
  .bgs, .tones {{ grid-template-columns: repeat(3, 1fr); }}
}}
@media (max-width: 560px) {{
  .wrap {{ padding-inline: 16px; gap: 56px; }}
  .tile {{ padding: 22px; border-radius: 24px; }}
  .cover .t-band {{ padding: 26px; min-height: 0; }}
  .cws, .donts, .swatches {{ grid-template-columns: 1fr; }}
  .bgs, .tones {{ grid-template-columns: 1fr 1fr; }}
  .type-row {{ grid-template-columns: 1fr; gap: 4px; }}
}}
</style>

<main class="wrap">
  <header class="cover">
    <div class="tile t-band">
      {m('wordmark', 'reversed', 'cover-wm', 'DrQuick')}
      <div style="display:grid;gap:16px">
        <h1>Brand guidelines</h1>
        <div class="meta">{pdf_link}<span class="pill">Version 1.0</span><span class="pill">{today}</span><span class="pill">Logo, colour, icons, type</span></div>
      </div>
    </div>
    <nav class="tile t-white" aria-label="Contents">
      <h3>Contents</h3>
      <ol class="toc">
        <li><a href="#idea"><span>01</span>The idea</a></li>
        <li><a href="#family"><span>02</span>Logo family</a></li>
        <li><a href="#construction"><span>03</span>Construction</a></li>
        <li><a href="#space"><span>04</span>Clear space and minimum size</a></li>
        <li><a href="#colour"><span>05</span>Colour</a></li>
        <li><a href="#colourways"><span>06</span>Colourways, single colour, black and white</a></li>
        <li><a href="#backgrounds"><span>07</span>Backgrounds</a></li>
        <li><a href="#app"><span>08</span>App icon</a></li>
        <li><a href="#web"><span>09</span>Favicon and web</a></li>
        <li><a href="#social"><span>10</span>Social</a></li>
        <li><a href="#type"><span>11</span>Typography</a></li>
        <li><a href="#motion"><span>12</span>Motion</a></li>
        <li><a href="#context"><span>13</span>Using the logo responsibly</a></li>
        <li><a href="#misuse"><span>14</span>Misuse</a></li>
        <li><a href="#files"><span>15</span>Files</a></li>
      </ol>
    </nav>
  </header>

  <section class="ch" id="idea">
    <div class="ch-head"><span class="num">01</span><h2>Switch on a doctor</h2>
      <p>DrQuick puts a GP on video within minutes of asking. The logo says that in one picture: a switch in the on position, with a plus in its knob.</p></div>
    <div class="idea">
      <div class="tile t-wash"><svg viewBox="0 0 224 128" aria-hidden="true"><path fill="#9FE870" d="M64,0 H160 A64,64 0 0 1 160,128 H64 A64,64 0 0 1 64,0Z"/></svg><h3>The pill</h3><p class="muted">Lime pills are the action on the site: every primary button, every selected state. In the logo, one holds "Quick".</p></div>
      <div class="tile t-sage">{m('symbol', 'colour')}<h3>The switch</h3><p class="muted">On demand. There is no appointment to book, just a GP to switch on. The knob always sits at the right, in the on position.</p></div>
      <div class="tile t-stone">{m('knob', 'colour')}<h3>The plus</h3><p class="muted">Care, in the most widely understood sign there is. Rounded like the type, lime like the action.</p></div>
    </div>
  </section>

  <section class="ch" id="family">
    <div class="ch-head"><span class="num">02</span><h2>Logo family</h2>
      <p>Five versions of one mark. Use the wordmark unless the space calls for another, and never place two versions side by side.</p></div>
    <div class="family">{family}</div>
  </section>

  <section class="ch" id="construction">
    <div class="ch-head"><span class="num">03</span><h2>Construction</h2>
      <p>Every proportion comes from T, the height of the switch. Never redraw the mark by eye; the master SVGs are exact.</p></div>
    <div class="g">
      <div class="tile t-white s4">{construction}</div>
      <div class="tile t-quiet s2">
        <h3>The numbers</h3>
        <div class="tscroll"><table>
          <tr><th>Part</th><th>Size</th></tr>
          <tr><td>Track</td><td>1.75T × T, fully rounded</td></tr>
          <tr><td>Knob inset</td><td>T/8 on every side</td></tr>
          <tr><td>Knob radius</td><td>3T/8</td></tr>
          <tr><td>Plus arm</td><td>0.58 × knob radius, from the centre</td></tr>
          <tr><td>Plus bar</td><td>0.42 × knob radius, round ends</td></tr>
          <tr><td>Wordmark pill</td><td>1.57 × the cap height of "Dr"</td></tr>
          <tr><td>Lettering</td><td>Plus Jakarta Sans 800, −0.04em</td></tr>
        </table></div>
      </div>
    </div>
  </section>

  <section class="ch" id="space">
    <div class="ch-head"><span class="num">04</span><h2>Clear space and minimum size</h2>
      <p>The clear-space unit x is the knob's radius at whatever size the logo is set. Nothing enters that margin: no text, no edge, no other logo.</p></div>
    <div class="g">
      <div class="tile t-white s4">{clear_wm}</div>
      <div class="tile t-white s2">{clear_sym}<p class="muted">The same rule holds for the symbol, the lockups and the knob.</p></div>
      <div class="tile t-wash s6">
        <h3>Minimum sizes</h3>
        <div class="tscroll"><table>
          <tr><th>Version</th><th>Screen</th><th>Print</th><th>Smaller than that</th></tr>
          <tr><td>Wordmark</td><td>96px wide</td><td>25mm wide</td><td>Use the symbol</td></tr>
          <tr><td>Horizontal lockup</td><td>140px wide</td><td>35mm wide</td><td>Use the wordmark</td></tr>
          <tr><td>Stacked lockup</td><td>64px tall</td><td>18mm tall</td><td>Use the symbol</td></tr>
          <tr><td>Symbol</td><td>28px wide</td><td>8mm wide</td><td>Use the knob</td></tr>
          <tr><td>Knob</td><td>16px</td><td>4mm</td><td>Don't go smaller</td></tr>
        </table></div>
      </div>
    </div>
  </section>

  <section class="ch" id="colour">
    <div class="ch-head"><span class="num">05</span><h2>Colour</h2>
      <p>Two colours carry the logo. Forest is the one dark, for text and for the fill that lands the point. Lime is the action. The rest are grounds.</p></div>
    <div class="g">
      <div class="tile t-white s6">
        <div class="swatches">
          <div class="swatch t-band"><b>Forest</b><span>HEX #163300</span><span>RGB 22 51 0</span><span>CMYK 57 0 100 80</span></div>
          <div class="swatch t-lime"><b>Lime</b><span>HEX #9FE870</span><span>RGB 159 232 112</span><span>CMYK 31 0 52 9</span></div>
          <div class="swatch paper"><b>White</b><span>HEX #FFFFFF</span><span>RGB 255 255 255</span><span>Paper white</span></div>
          <div class="swatch inkfill"><b>Lime ink</b><span>HEX #2F6B0F</span><span>RGB 47 107 15</span><span>Lines and text only</span></div>
        </div>
        <h3 style="margin-top:8px">Grounds</h3>
        <div class="tones">
          <div class="tone ground"><b>Ground</b>#F5F7F2</div>
          <div class="tone t-wash"><b>Lime-wash</b>#E2F6D5</div>
          <div class="tone t-sage"><b>Sage</b>#C9DDB8</div>
          <div class="tone t-stone"><b>Stone</b>#E8E5DB</div>
          <div class="tone t-quiet"><b>Quiet</b>#EDF1E8</div>
        </div>
      </div>
      <div class="tile t-white s3">
        <h3>Balance in a layout</h3>
        <div class="ratio" role="img" aria-label="About 60 percent grounds and white, 30 percent forest, 10 percent lime">
          <span style="flex:6;background:var(--surface)">Grounds 60%</span>
          <span style="flex:3;background:var(--band);color:var(--white)">Forest 30%</span>
          <span style="flex:1;background:var(--primary)">10%</span>
        </div>
        <p class="muted">Lime is the action, so keep it scarce: about a tenth of any layout. When everything is lime, nothing stands out.</p>
      </div>
      <div class="tile t-white s3">
        <h3>Rules</h3>
        <ul class="rules">
          <li><p>Lime is a fill, never text or a line on a light ground, where it has only 1.4:1 contrast with white. Use lime ink for anything that must be read.</p></li>
          <li><p>Forest is the only dark. Never use true black, except in the black single-colour logo.</p></li>
          <li><p>NHS blue and NHS green, and anything near either, are banned so a private service never reads as the NHS.</p></li>
          <li><p>The CMYK values are straight conversions. Set Pantone references from a press proof before the first print run.</p></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="ch" id="colourways">
    <div class="ch-head"><span class="num">06</span><h2>Colourways, single colour, black and white</h2>
      <p>Every version of the logo comes in six colourways. The single-colour versions knock "Quick" and the knob out of the pill and keep the plus solid, so the mark reads in one ink.</p></div>
    <div class="cws">{colourways}</div>
  </section>

  <section class="ch" id="backgrounds">
    <div class="ch-head"><span class="num">07</span><h2>Backgrounds</h2>
      <p>The colour logo works on every light brand ground. On forest, use the reversed version. On lime, use forest single colour, because a lime pill disappears into a lime ground.</p></div>
    <div class="tile t-white"><div class="bgs">{bgs}</div>
      <p class="muted">On photography, set the logo on a forest or white tile at the image's edge, never on the image itself. On a partner's colour, use black or white single colour.</p></div>
  </section>

  <section class="ch" id="app">
    <div class="ch-head"><span class="num">08</span><h2>App icon</h2>
      <p>A forest square with the lime switch across 76% of its width. Supply the square, full-bleed artwork; iOS and Android cut their own corners.</p></div>
    <div class="g">
      <div class="tile t-stone s3">
        <h3>On a home screen</h3>
        <div class="appicons">
          <figure>{svgfile('app-icon/app-icon-master.svg', 'ai sq', 'DrQuick app icon', 'width:92px')}<figcaption>iOS, 60pt</figcaption></figure>
          <figure>{svgfile('app-icon/app-icon-master.svg', 'ai sq', None, 'width:60px')}<figcaption>40pt</figcaption></figure>
          <figure>{svgfile('app-icon/app-icon-master.svg', 'ai sq', None, 'width:44px')}<figcaption>29pt</figcaption></figure>
          <figure>{svgfile('app-icon/app-icon-master.svg', 'ai round', None, 'width:92px')}<figcaption>Android</figcaption></figure>
        </div>
      </div>
      <div class="tile t-white s3">{safe}</div>
      <div class="tile t-white s6">
        <h3>Specifications</h3>
        <div class="tscroll"><table>
          <tr><th>Platform</th><th>What to supply</th><th>File</th></tr>
          <tr><td>iOS (Xcode 14+)</td><td>One opaque 1024 × 1024 PNG with no transparency and no corners</td><td><code>app-icon/ios/AppIcon.appiconset/</code></td></tr>
          <tr><td>iOS, older targets</td><td>20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167 and 180px</td><td><code>app-icon/ios/sizes/</code></td></tr>
          <tr><td>Android 8+</td><td>Adaptive icon: forest background colour, 108dp foreground inside the 66dp safe zone, monochrome layer for themed icons</td><td><code>app-icon/android/res/</code></td></tr>
          <tr><td>Android, legacy</td><td>Square and round launcher icons, mdpi to xxxhdpi</td><td><code>res/mipmap-*/</code></td></tr>
          <tr><td>Google Play</td><td>512 × 512 PNG, full bleed</td><td><code>android/play-store-512.png</code></td></tr>
          <tr><td>Expo / React Native</td><td>Icon, adaptive foreground and monochrome, splash icon, <code>app.json</code> snippet</td><td><code>app-icon/expo/</code></td></tr>
        </table></div>
        <p class="muted">Don't add a name, a badge, a gloss or a second colour to the icon. The icon uses the symbol, not the knob: at app-icon sizes the switch is legible, and it is the distinctive part.</p>
      </div>
    </div>
  </section>

  <section class="ch" id="web">
    <div class="ch-head"><span class="num">09</span><h2>Favicon and web</h2>
      <p>At 16 to 48px the switch is too thin to read, so the favicon is the knob alone: a forest disc with a lime plus, on a lime tile.</p></div>
    <div class="g">
      <div class="tile t-sage s2">
        <h3>In a browser tab</h3>
        <div class="tab">{fav_at(16, 'DrQuick favicon')}<span>See a GP in minutes | DrQuick</span></div>
        <div class="favs">
          <figure>{fav_at(16)}<figcaption>16</figcaption></figure>
          <figure>{fav_at(32)}<figcaption>32</figcaption></figure>
          <figure>{fav_at(48)}<figcaption>48</figcaption></figure>
          <figure>{fav_at(96)}<figcaption>96</figcaption></figure>
        </div>
      </div>
      <div class="tile t-white s4">
        <h3>Add this to the site's &lt;head&gt;</h3>
        <pre id="head-code">{esc(head_snippet)}</pre>
        <button class="btn" id="copy-head" type="button">Copy snippet</button>
        <div class="tscroll"><table>
          <tr><th>File</th><th>Use</th></tr>
          <tr><td><code>favicon.ico</code></td><td>16, 32 and 48px, for every browser</td></tr>
          <tr><td><code>favicon.svg</code></td><td>Sharp at any size in modern browsers</td></tr>
          <tr><td><code>apple-touch-icon.png</code></td><td>180px, opaque, for iOS home screens</td></tr>
          <tr><td><code>android-chrome-192/512.png</code>, <code>maskable-512.png</code></td><td>Installed web-app icons, listed in <code>site.webmanifest</code></td></tr>
          <tr><td><code>safari-pinned-tab.svg</code></td><td>Single-colour knob for Safari pinned tabs</td></tr>
        </table></div>
      </div>
    </div>
  </section>

  <section class="ch" id="social">
    <div class="ch-head"><span class="num">10</span><h2>Social</h2>
      <p>Profile pictures use the symbol on forest, sized to survive a circular crop. Link previews use the reversed wordmark and one plain line.</p></div>
    <div class="g">
      <div class="tile t-white s2">{svgfile('social/avatar.svg', 'ai round', 'DrQuick profile picture', 'width:160px')}<p class="muted"><code>social/avatar-1024.png</code> is the profile picture for every platform.</p></div>
      <div class="tile t-white s4">{svgfile('social/og-image.svg', 'og', 'DrQuick link preview: See a GP in minutes')}<p class="muted"><code>social/og-image-1200x630.png</code> is for Open Graph and X cards. <code>social/email-signature-600.png</code> is the wordmark on white for email signatures; display it at 200px wide.</p></div>
    </div>
  </section>

  <section class="ch" id="type">
    <div class="ch-head"><span class="num">11</span><h2>Typography</h2>
      <p>One family everywhere: Plus Jakarta Sans. It is free under the SIL Open Font License, which allows logo use, and it is the face the wordmark is drawn from.</p></div>
    <div class="g">
      <div class="tile t-white s4 type-spec">
        <div class="type-row"><small>Display · 800<br>−0.035em</small><span style="font-weight:800;font-size:clamp(34px,4.6vw,56px);letter-spacing:-.035em;line-height:1.05">See a GP in minutes</span></div>
        <div class="type-row"><small>Heading · 700<br>−0.02em</small><span style="font-weight:700;font-size:22px;letter-spacing:-.02em">A GP on video, from home</span></div>
        <div class="type-row"><small>Body · 400<br>16px / 1.5</small><span>Tell us what's wrong, see the full price up front, and we'll match you with a GP who is online now.</span></div>
        <div class="type-row"><small>Small · 400<br>13px</small><span style="font-size:13px;color:var(--ink-2)">If it's an emergency, call 999 or go to A&amp;E.</span></div>
      </div>
      <div class="tile t-quiet s2">
        <h3>Rules</h3>
        <ul class="rules">
          <li><p>Use weights 400, 500, 700 and 800. Nothing lighter.</p></li>
          <li><p>Headlines are 800 with tight tracking. Body text stays at normal tracking.</p></li>
          <li><p>Never set the name in type in place of the logo. In running text, write it as one word: DrQuick.</p></li>
          <li><p>Fallback: system-ui, then the platform sans.</p></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="ch" id="motion">
    <div class="ch-head"><span class="num">12</span><h2>Motion</h2>
      <p>The logo has one move: the knob slides from off to on, with a small overshoot. Use it once, at an app launch, on a splash screen or when a page loads, and never on a loop.</p></div>
    <div class="motion">
      <div class="tile t-band stage on" id="stage">{motion}<button class="btn" id="play" type="button">Replay</button></div>
      <div class="tile t-white">
        <h3>Timing</h3>
        <div class="tscroll"><table>
          <tr><th>Property</th><th>Value</th></tr>
          <tr><td>Travel</td><td>From the left end of the track to the right: 0.75T</td></tr>
          <tr><td>Duration</td><td>420ms</td></tr>
          <tr><td>Easing</td><td><code>cubic-bezier(.34, 1.36, .64, 1)</code></td></tr>
          <tr><td>Reduced motion</td><td>Show the finished logo with no movement</td></tr>
        </table></div>
        <p class="muted">In brand motion the knob never slides back to off.</p>
      </div>
    </div>
  </section>

  <section class="ch" id="context">
    <div class="ch-head"><span class="num">13</span><h2>Using the logo responsibly</h2>
      <p>DrQuick is a regulated healthcare service. Whatever sits next to the logo is held to the same rules as the site.</p></div>
    <div class="g">
      <div class="tile t-band s3">
        <h3>Price and speed</h3>
        <ul class="rules">
          <li><p>Never pair the logo with price urgency: no "surge", no countdowns, no "busy now, book before it rises". The ASA has ruled time-pressure pricing in medical ads socially irresponsible.</p></li>
          <li><p>Keep speed claims plain. "See a GP in minutes" is fine.</p></li>
          <li><p>Any price shown near the logo is the full, all-inclusive price.</p></li>
        </ul>
      </div>
      <div class="tile t-band s3">
        <h3>Claims</h3>
        <ul class="rules">
          <li><p>Until registration is granted, the only permitted CQC wording is "CQC-registered clinical service at launch". Never place a CQC mark near the logo before then.</p></li>
          <li><p>Never put medicine names, pills or prescriptions next to the logo, and never suggest that a consultation guarantees a prescription.</p></li>
          <li><p>DrQuick launches in England only. Don't pair the logo with UK-wide claims.</p></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="ch" id="misuse">
    <div class="ch-head"><span class="num">14</span><h2>Misuse</h2>
      <p>If a use isn't shown in this guide, ask before you publish it.</p></div>
    <div class="donts">{donts}</div>
  </section>

  <section class="ch" id="files">
    <div class="ch-head"><span class="num">15</span><h2>Files</h2>
      <p>Everything lives in <code>Branding/</code>. SVG is the master for every logo. PNGs come at 1000px and 4000px on the long edge, with transparent backgrounds.</p></div>
    <div class="g">
      <div class="tile t-white s4"><pre class="tree">{esc(TREE)}</pre></div>
      <div class="tile t-quiet s2">
        <h3>Which file?</h3>
        <ul class="rules">
          <li><p>Web and apps: SVG.</p></li>
          <li><p>Slides, documents and email: PNG at 1000px.</p></li>
          <li><p>Print and signage: SVG, or PNG at 4000px if the printer can't take vectors.</p></li>
          <li><p>Embroidery and engraving: a single-colour SVG.</p></li>
          <li><p>To change anything, edit <code>src/build.py</code> and run it again. Never edit an exported file by hand.</p></li>
        </ul>
      </div>
    </div>
  </section>

  <footer><span>DrQuick brand guidelines · Version 1.0 · {today}</span><span>Trademark clearance search pending</span></footer>
</main>

<script>
(() => {{
  const btn = document.getElementById('copy-head');
  const code = document.getElementById('head-code');
  const select = () => {{
    const r = document.createRange(); r.selectNodeContents(code);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    btn.textContent = 'Selected. Press Ctrl+C or ⌘C';
  }};
  btn.addEventListener('click', () => {{
    const done = () => {{ btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy snippet'), 1600); }};
    try {{ navigator.clipboard.writeText(code.textContent).then(done, select); }} catch (e) {{ select(); }}
  }});
  const stage = document.getElementById('stage');
  const play = () => {{
    stage.classList.remove('on'); void stage.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => stage.classList.add('on')));
  }};
  document.getElementById('play').addEventListener('click', play);
  setTimeout(play, 500);
}})();
</script>
'''
import shutil, sys
FONT = 'PlusJakartaSans-Variable.woff2'
G = f'{ROOT}/guide'; os.makedirs(G, exist_ok=True)
shutil.copy(FONT, f'{G}/{FONT}')
# Branding/guide: relative font, links to the PDF next to it
def doc(body):
    # a full document for the file and the website; the artifact host adds its own skeleton
    head, rest = body.split('<main', 1)
    return ('<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="robots" content="noindex">\n<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">\n'
            + head + '<style>body {{ margin: 0; }}</style>\n</head>\n<body>\n<main' + rest + '\n</body>\n</html>\n').replace('{{', '{').replace('}}', '}')
open(f'{G}/drquick-brand-guidelines.html', 'w').write(doc(render(FONT, 'drquick-brand-guidelines.pdf')))
# the published artifact: relative font (published alongside), no download link (downloads are inert there)
open(f'{G}/artifact.html', 'w').write(render(FONT, None))
# the website copy, served at /brand: absolute paths, because /brand has no trailing slash
open(f'{G}/web-index.html', 'w').write(doc(render('/brand/' + FONT, '/brand/drquick-brand-guidelines.pdf')))
print('ok')
