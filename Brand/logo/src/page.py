"""Builds Brand/logo/drquick-logo.html from the shipped SVGs (variants.json)."""
import json, re

V = json.load(open('variants.json'))

def s(d, name, cls=''):
    """Inline one variant, dropping the <title> so the page doesn't tooltip every mark."""
    svg = re.sub(r'<title>.*?</title>', '', V[d][name])
    return svg.replace('<svg ', f'<svg class="{cls}" aria-hidden="true" ', 1)

DIRS = [
    dict(key='a-switch', letter='A', name='Switch on', kind='Symbol + evolved wordmark', rec=True,
         idea='A doctor you switch on. The lime pill the site already uses for "Quick" becomes a switch in the on position.',
         why=['Builds on equity you already own: every primary button on the site is a lime pill, and so is the current wordmark.',
              'Says on-demand without a clock, a bolt or a cross. Nothing in UK private GP branding looks like it.',
              'The simplest shape of the three. It holds at 16px as a lime bar with a dark dot.'],
         risk='On its own the symbol can read as a settings toggle. It needs the wordmark beside it until people know it.',
         hero_bg='band', hero=('a-switch', 'symbol-colour'), onecol=[('symbol-forest', 'white'), ('symbol-white', 'band'), ('symbol-black', 'white'), ('lockup-forest', 'white')]),
    dict(key='b-bubble-q', letter='B', name='Talking Q', kind='Lettermark', rec=False,
         idea='The Q of Quick is a speech bubble: a GP, talking to you, on a video call.',
         why=['Names the product (a 1:1 consultation) and the brand (Quick) in one letter.',
              'Heavy, round and friendly, in the same weight as the Jakarta 800 wordmark.',
              'The strongest favicon of the three. The tail still reads at 16px.'],
         risk='Speech bubbles are common across telehealth and messaging apps, so it is the least ownable of the three.',
         hero_bg='wash', hero=('b-bubble-q', 'symbol-forest'), onecol=[('symbol-forest', 'white'), ('symbol-white', 'band'), ('symbol-black', 'white'), ('symbol-lime', 'band')]),
    dict(key='c-dq', letter='C', name='dq', kind='Monogram', rec=False,
         idea='d and q are the same letter flipped. One bowl and one full-height stroke give both initials.',
         why=['A typographic idea with no medical clichés, so it can stretch to GP-facing and future products.',
              'Two primitives, a ring and a bar, so it is the easiest mark to animate (the stroke drops from d to q).',
              'Tall and upright, which suits app-store tiles.'],
         risk='Abstract. Most people will read a "d" first, and it says nothing about speed until the brand teaches it.',
         hero_bg='wash', hero=('c-dq', 'symbol-forest'), onecol=[('symbol-forest', 'white'), ('symbol-white', 'band'), ('symbol-black', 'white'), ('symbol-lime', 'band')]),
]

def direction(d):
    k = d['key']
    rec = '<span class="pill rec">Recommended</span>' if d['rec'] else ''
    why = ''.join(f'<li>{w}</li>' for w in d['why'])
    oc = ''.join(f'<div class="oc t-{bg}">{s(k, v, "oc-mark" + (" wide" if v.startswith("lockup") else ""))}</div>' for v, bg in d['onecol'])
    return f'''
<section class="dir" id="{d['letter'].lower()}">
  <div class="dir-head"><h2><span class="letter">{d['letter']}</span> {d['name']}</h2><span class="pill kind">{d['kind']}</span>{rec}</div>
  <div class="bento">
    <div class="tile hero t-{d['hero_bg']}">{s(*d['hero'], 'hero-mark')}</div>
    <div class="tile idea t-white">
      <p class="lede">{d['idea']}</p>
      <ul class="why">{why}</ul>
      <p class="risk"><strong>Risk.</strong> {d['risk']}</p>
    </div>
    <div class="tile lock t-white">{s(k, 'lockup-colour', 'lockup')}</div>
    <div class="tile lock t-band">{s(k, 'lockup-on-forest', 'lockup')}</div>
    <div class="tile use t-stone">
      <h3>App icon</h3>
      <div class="home">
        <div class="app">{s(k, 'app-icon', 'app-l')}<span>DrQuick</span></div>
        <div class="app">{s(k, 'app-icon', 'app-m')}<span>60pt</span></div>
        <div class="app">{s(k, 'app-icon', 'app-s')}<span>40pt</span></div>
      </div>
    </div>
    <div class="tile use t-sage">
      <h3>Favicon, actual size</h3>
      <div class="tab">{s(k, 'favicon', 'f16')}<span class="tab-title">See a GP in minutes | DrQuick</span></div>
      <div class="favrow">
        <figure>{s(k, 'favicon', 'f16')}<figcaption>16</figcaption></figure>
        <figure>{s(k, 'favicon', 'f32')}<figcaption>32</figcaption></figure>
        <figure>{s(k, 'favicon', 'f48')}<figcaption>48</figcaption></figure>
      </div>
    </div>
    <div class="tile ones t-quiet">
      <h3>One colour</h3>
      <div class="ocrow">{oc}</div>
    </div>
  </div>
</section>'''

A = 'a-switch'
lock_vb = re.search(r'viewBox="0 0 (\d+) 256"', V[A]['lockup-colour']).group(1)
KX = 66  # clear-space unit: the knob's radius in lockup units (the lockup is 256 tall)
lock_inner = re.sub(r'^<svg[^>]*>|</svg>\s*$', '', re.sub(r'<title>.*?</title>', '', V[A]['lockup-colour']))
W_, H_ = int(lock_vb) + 2 * KX, 256 + 2 * KX
clear = f'''<svg class="clear" viewBox="0 0 {W_} {H_}" role="img" aria-label="Clear space around the lockup equals the knob's radius on every side">
  <rect x="1.5" y="1.5" width="{W_-3}" height="{H_-3}" fill="none" stroke="#2F6B0F" stroke-width="3" stroke-dasharray="10 8"/>
  <g transform="translate({KX},{KX})">{lock_inner}</g>
  <g fill="#2F6B0F" font-family="Plus Jakarta Sans, sans-serif" font-weight="700" font-size="30">
    <rect x="{KX-1}" y="0" width="3" height="{KX}"/><text x="{KX+12}" y="{KX//2+10}">x</text>
    <rect x="0" y="{H_//2}" width="{KX}" height="3"/><text x="{KX//2-8}" y="{H_//2-12}">x</text>
  </g>
</svg>'''

sym_off = s(A, 'symbol-colour').replace('cx="176"', 'cx="80"').replace('<svg ', '<svg style="max-width:96px" ', 1)
nhs = s(A, 'lockup-colour').replace('#9FE870', '#005EB8')
stretched = s(A, 'lockup-colour').replace('<svg ', '<svg style="transform:scaleX(1.4);max-width:130px" ', 1)
toggle_ui = s(A, 'symbol-colour').replace('<svg ', '<svg style="max-width:56px" ', 1)

page = f'''<title>DrQuick Logo Directions</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap">
<style>
/* Layout: the site's own bento. Headings sit on the faint green ground, rounded tiles 16px apart, forest for the payoff.
   Single look by choice: the brand has no dark theme (DESIGN.md), so every colour is set explicitly. */
:root {{
  --surface: #F5F7F2; --surface-mid: #EDF1E8; --white: #FFFFFF;
  --ink: #163300; --ink-2: #4D5B45; --rule: #DCE4D4;
  --band: #163300; --band-ink-2: #B5C9A5;
  --primary: #9FE870; --primary-ink: #2F6B0F; --wash: #E2F6D5; --sage: #C9DDB8; --stone: #E8E5DB;
  --error: #C8322A;
  --font: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color-scheme: light;
}}
body {{ background: var(--surface); color: var(--ink); font: 400 16px/1.5 var(--font); }}
.wrap {{ max-width: 1200px; margin: 0 auto; padding-inline: 24px; padding-block: 24px 64px; display: grid; gap: 56px; }}
h1, h2, h3 {{ margin: 0; text-wrap: balance; }}
h1 {{ font-size: clamp(38px, 5.4vw, 68px); font-weight: 800; line-height: 1.04; letter-spacing: -0.035em; }}
h2 {{ font-size: clamp(28px, 3.6vw, 44px); font-weight: 800; line-height: 1.08; letter-spacing: -0.03em; }}
h3 {{ font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }}
p {{ margin: 0; }}
svg {{ max-width: 100%; }}
.tile {{ border-radius: 32px; padding: 28px; min-width: 0; }}
.t-white {{ background: var(--white); box-shadow: 0 0 0 1px rgb(22 51 0 / .06); }}
.t-band {{ background: var(--band); color: var(--white); }}
.t-wash {{ background: var(--wash); }} .t-sage {{ background: var(--sage); }} .t-stone {{ background: var(--stone); }}
.t-quiet {{ background: var(--surface-mid); }} .t-lime {{ background: var(--primary); }}
.pill {{ display: inline-flex; align-items: center; border-radius: 9999px; padding: 6px 14px; font-size: 13px; font-weight: 700; white-space: nowrap; }}
.kind {{ background: var(--white); box-shadow: inset 0 0 0 2px var(--rule); }}
.rec {{ background: var(--primary); color: var(--ink); }}
a:focus-visible {{ outline: 3px solid var(--ink); outline-offset: 3px; }}

.intro {{ display: grid; grid-template-columns: 1.35fr 1fr; gap: 16px; }}
.intro > .t-white {{ display: grid; gap: 20px; align-content: start; padding: 40px; }}
.sub {{ font-size: clamp(17px, 1.6vw, 20px); color: var(--ink-2); max-width: 58ch; }}
.trio {{ display: flex; gap: 12px; flex-wrap: wrap; }}
.trio a {{ display: grid; place-items: center; min-width: 84px; height: 84px; border-radius: 24px; background: var(--surface-mid); text-decoration: none; color: var(--ink); font-weight: 700; font-size: 15px; }}
.trio a.txt {{ padding: 0 22px; }}
.trio svg {{ width: 56px; height: 56px; }}
.note {{ display: grid; gap: 12px; align-content: start; }}
.note p {{ color: var(--ink-2); font-size: 15px; }}
.note h3 {{ font-size: 18px; }}
.brief {{ display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 15px; }}
.brief li {{ display: grid; grid-template-columns: 6.5em 1fr; gap: 8px; }}

.dir {{ display: grid; gap: 20px; scroll-margin-top: 16px; }}
.dir-head {{ display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }}
.letter {{ display: inline-grid; place-items: center; width: 1.25em; height: 1.25em; border-radius: 9999px; background: var(--ink); color: var(--primary); font-size: .8em; vertical-align: .08em; margin-right: .1em; }}
.bento {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }}
.hero {{ grid-column: span 2; grid-row: span 2; display: grid; place-items: center; min-height: 340px; }}
.hero-mark {{ width: min(78%, 260px); height: auto; }}
.idea {{ grid-column: span 4; display: grid; gap: 14px; align-content: start; }}
.lede {{ font-size: clamp(19px, 1.9vw, 24px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.3; }}
.why {{ margin: 0; padding-left: 1.1em; display: grid; gap: 6px; color: var(--ink-2); }}
.why li::marker, .rules li::marker {{ color: var(--primary-ink); }}
.risk {{ font-size: 14px; color: var(--ink-2); padding-top: 12px; border-top: 1px solid var(--rule); }}
.risk strong {{ color: var(--ink); }}
.lock {{ grid-column: span 2; display: grid; place-items: center; min-height: 150px; }}
.lockup {{ width: 100%; max-width: 300px; height: auto; }}
.use {{ grid-column: span 3; display: grid; gap: 18px; align-content: start; }}
.home {{ display: flex; align-items: flex-end; gap: 22px; flex-wrap: wrap; }}
.app {{ display: grid; justify-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--ink-2); }}
.app-l {{ width: 92px; height: 92px; }} .app-m {{ width: 60px; height: 60px; }} .app-s {{ width: 40px; height: 40px; }}
.tab {{ display: flex; align-items: center; gap: 8px; background: var(--white); border-radius: 12px 12px 0 0; padding: 10px 14px; max-width: 290px; font-size: 13px; box-shadow: 0 0 0 1px rgb(22 51 0 / .08); }}
.tab-title {{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }}
.f16 {{ width: 16px; height: 16px; flex: none; display: block; }} .f32 {{ width: 32px; height: 32px; display: block; }} .f48 {{ width: 48px; height: 48px; display: block; }}
.favrow {{ display: flex; align-items: flex-end; gap: 22px; }}
.favrow figure {{ margin: 0; display: grid; justify-items: center; gap: 6px; }}
.favrow figcaption {{ font-size: 12px; color: var(--ink-2); font-variant-numeric: tabular-nums; }}
.ones {{ grid-column: span 6; display: grid; gap: 16px; }}
.ocrow {{ display: grid; grid-template-columns: 1fr 1fr 1fr 1.6fr; gap: 12px; }}
.oc {{ border-radius: 24px; display: grid; place-items: center; min-height: 120px; padding: 18px; }}
.oc-mark {{ width: 72px; height: 72px; }} .oc-mark.wide {{ width: 100%; max-width: 230px; height: auto; }}

.guide {{ display: grid; gap: 20px; scroll-margin-top: 16px; }}
.guide-head {{ display: grid; gap: 10px; }}
.guide-head p {{ color: var(--ink-2); max-width: 70ch; }}
.g {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }}
.g h3 {{ font-size: 18px; margin-bottom: 14px; }}
.g p, .g li {{ font-size: 15px; }}
.muted {{ color: var(--ink-2); }}
.mt {{ margin-top: 14px; }}
.span2 {{ grid-column: span 2; }} .span3 {{ grid-column: span 3; }} .span4 {{ grid-column: span 4; }} .span6 {{ grid-column: span 6; }}
.versions {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
.ver {{ display: grid; gap: 8px; align-content: start; }}
.sw {{ border-radius: 20px; display: grid; place-items: center; min-height: 110px; padding: 16px; }}
.sw.lined {{ box-shadow: 0 0 0 1px var(--rule); }}
.ver .sw svg {{ width: 100%; max-width: 190px; height: auto; }} .ver .sw svg.sym {{ width: 64px; }}
.ver b {{ font-size: 14px; }} .ver span {{ font-size: 13px; color: var(--ink-2); }}
.clear {{ width: 100%; height: auto; max-width: 520px; display: block; margin: 0 auto; }}
table {{ border-collapse: collapse; width: 100%; font-size: 14px; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 9px 10px 9px 0; border-bottom: 1px solid rgb(22 51 0 / .12); vertical-align: top; }}
th {{ font-weight: 700; font-size: 13px; color: var(--ink-2); }}
.tscroll {{ overflow-x: auto; }}
.swatches {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }}
.swatch {{ border-radius: 20px; min-height: 120px; padding: 14px; display: grid; align-content: end; gap: 2px; font-size: 13px; font-variant-numeric: tabular-nums; }}
.swatch b {{ font-size: 15px; }}
.swatch.inkfill {{ background: var(--primary-ink); color: var(--white); }}
.bgs {{ display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }}
.bg {{ display: grid; gap: 6px; font-size: 13px; font-weight: 700; }}
.bg .sw {{ min-height: 84px; padding: 12px; }}
.bg .sw svg {{ width: 100%; max-width: 130px; height: auto; }}
.bg .no {{ color: var(--error); }}
.ground {{ background: var(--surface); }}
.donts {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
.dont {{ display: grid; gap: 8px; font-size: 14px; align-content: start; }}
.dont .sw {{ position: relative; min-height: 110px; padding: 14px; background: var(--surface); overflow: hidden; }}
.dont .sw svg {{ width: 100%; max-width: 170px; height: auto; }}
.dont .x {{ position: absolute; top: 10px; right: 10px; width: 24px; height: 24px; border-radius: 9999px; background: var(--error); color: var(--white); display: grid; place-items: center; font-weight: 800; font-size: 13px; line-height: 1; }}
.retyped {{ font-weight: 800; font-size: 30px; letter-spacing: -.04em; }}
.urgent {{ display: grid; justify-items: center; gap: 6px; }}
.urgent span {{ font-size: 12px; font-weight: 700; color: var(--error); }}
.uilabel {{ position: absolute; bottom: 12px; font-size: 12px; font-weight: 700; }}
.rules {{ margin: 0; padding-left: 1.1em; display: grid; gap: 10px; }}
.files {{ display: grid; gap: 10px; font-size: 15px; }}
.files h3 {{ font-size: 18px; }}
code {{ font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .88em; background: rgb(22 51 0 / .07); padding: 1px 6px; border-radius: 6px; overflow-wrap: anywhere; }}
.t-band code {{ background: rgb(255 255 255 / .12); }}
.t-band p {{ color: var(--band-ink-2); }}
.t-band h3 {{ color: var(--primary); }}

@media (max-width: 1080px) {{
  .hero {{ grid-column: span 3; grid-row: auto; min-height: 280px; }}
  .idea, .lock {{ grid-column: span 3; }}
  .ocrow {{ grid-template-columns: repeat(2, 1fr); }}
  .span2, .span4 {{ grid-column: span 6; }}
}}
@media (max-width: 900px) {{
  .intro, .bento, .g {{ grid-template-columns: 1fr; }}
  .hero, .idea, .lock, .use, .ones, .span2, .span3, .span4, .span6 {{ grid-column: 1 / -1; }}
  .versions, .donts, .swatches {{ grid-template-columns: 1fr 1fr; }}
  .bgs {{ grid-template-columns: repeat(3, 1fr); }}
}}
@media (max-width: 560px) {{
  .wrap {{ padding-inline: 16px; gap: 44px; }}
  .tile {{ padding: 22px; border-radius: 24px; }}
  .intro > .t-white {{ padding: 26px; }}
  .versions, .donts, .ocrow {{ grid-template-columns: 1fr; }}
  .bgs {{ grid-template-columns: 1fr 1fr; }}
  .brief li {{ grid-template-columns: 1fr; gap: 0; }}
}}
</style>

<main class="wrap">
  <header class="intro">
    <div class="tile t-white">
      <h1>Three logo directions for DrQuick</h1>
      <p class="sub">Each direction has one idea, drawn in Lime &amp; Forest and set in Plus Jakarta Sans 800 like the site. Each is shown as an app icon, as a favicon at actual size and in one colour. The usage guide covers the recommended direction, A.</p>
      <nav class="trio" aria-label="Directions">
        <a href="#a" aria-label="Direction A, Switch on">{s('a-switch', 'symbol-forest')}</a>
        <a href="#b" aria-label="Direction B, Talking Q">{s('b-bubble-q', 'symbol-forest')}</a>
        <a href="#c" aria-label="Direction C, dq">{s('c-dq', 'symbol-forest')}</a>
        <a href="#guide" class="txt">Usage guide</a>
      </nav>
    </div>
    <div class="tile t-stone note">
      <h3>The brief</h3>
      <ul class="brief">
        <li><b>Promise</b><span>A GP on video within minutes of asking.</span></li>
        <li><b>Feel</b><span>Quick, warm, confident. Never clinical, never NHS.</span></li>
        <li><b>Must work</b><span>16px favicon, app icon, one colour, reversed on forest.</span></li>
        <li><b>Avoid</b><span>Crosses, stethoscopes, heartbeat lines, shields, clocks, lightning bolts, NHS blue and green.</span></li>
      </ul>
      <h3 class="mt">Why the logo doesn't show surge pricing</h3>
      <p>Demand pricing belongs in the product, where the price is shown in full and held. Putting it in the logo would make price the brand. The ASA has ruled time-pressure pricing in medical ads socially irresponsible, and "charges more when you're sickest" is the headline critics will reach for. All three marks carry speed and availability instead.</p>
    </div>
  </header>

  {''.join(direction(d) for d in DIRS)}

  <section class="guide" id="guide">
    <div class="guide-head">
      <div class="dir-head"><h2>Usage guide</h2><span class="pill rec">Direction A · Switch on</span></div>
      <p>One page for anyone placing the logo. If you choose B or C, the same rules apply: their symbol replaces the switch, and the clear-space unit becomes the symbol's stroke width.</p>
    </div>
    <div class="g">
      <div class="tile t-white span6">
        <h3>Versions</h3>
        <div class="versions">
          <div class="ver"><div class="sw ground">{s(A, 'lockup-colour')}</div><b>Primary lockup</b><span>The default wherever there is room: site header, email, documents, signage.</span></div>
          <div class="ver"><div class="sw t-band">{s(A, 'symbol-colour', 'sym')}</div><b>Symbol</b><span>Only where the name is already present or the space is square: app icon, favicon, avatars.</span></div>
          <div class="ver"><div class="sw lined">{s(A, 'lockup-forest')}</div><b>One colour</b><span>Forest, black or white, with "Quick" and the knob knocked out. For print, embroidery, stamps and lime grounds.</span></div>
        </div>
      </div>

      <div class="tile t-white span4">
        <h3>Clear space</h3>
        {clear}
        <p class="muted mt">Keep at least <b>x</b> clear on every side, where x is the knob's radius. No text, edge or other logo enters that box.</p>
      </div>
      <div class="tile t-wash span2">
        <h3>Minimum size</h3>
        <div class="tscroll"><table>
          <tr><th>Version</th><th>Screen</th><th>Print</th></tr>
          <tr><td>Lockup</td><td>96px wide</td><td>25mm wide</td></tr>
          <tr><td>Symbol</td><td>16px</td><td>6mm wide</td></tr>
          <tr><td>App icon</td><td>29pt</td><td>n/a</td></tr>
        </table></div>
        <p class="muted mt">Below 24px, use the favicon cut. Its knob is smaller, so the rim stays open.</p>
      </div>

      <div class="tile t-white span6">
        <h3>Colour</h3>
        <div class="swatches">
          <div class="swatch t-band"><b>Forest</b><span>#163300</span><span>RGB 22 51 0</span><span>CMYK 57 0 100 80</span></div>
          <div class="swatch t-lime"><b>Lime</b><span>#9FE870</span><span>RGB 159 232 112</span><span>CMYK 31 0 52 9</span></div>
          <div class="swatch t-white" style="box-shadow:0 0 0 1px var(--rule)"><b>White</b><span>#FFFFFF</span><span>RGB 255 255 255</span><span>Paper</span></div>
          <div class="swatch inkfill"><b>Lime ink</b><span>#2F6B0F</span><span>RGB 47 107 15</span><span>For lines and text, never the logo</span></div>
        </div>
        <p class="muted mt">The CMYK values are straight conversions. Set Pantone references from a press proof before the first print run. Lime is always a fill, never an outline or text on a light ground, where it has only 1.4:1 contrast.</p>
      </div>

      <div class="tile t-white span6">
        <h3>Backgrounds</h3>
        <div class="bgs">
          <div class="bg"><div class="sw lined">{s(A, 'lockup-colour')}</div><span>White: colour</span></div>
          <div class="bg"><div class="sw ground">{s(A, 'lockup-colour')}</div><span>Ground: colour</span></div>
          <div class="bg"><div class="sw t-band">{s(A, 'lockup-on-forest')}</div><span>Forest: reversed</span></div>
          <div class="bg"><div class="sw t-lime">{s(A, 'lockup-forest')}</div><span>Lime: one colour</span></div>
          <div class="bg"><div class="sw t-lime">{s(A, 'lockup-colour')}</div><span class="no">Lime: colour ✕</span></div>
        </div>
        <p class="muted mt">On a lime ground the lime pill disappears, so use the forest one-colour version. On photography, set the logo on a forest or white tile, never directly on the image.</p>
      </div>

      <div class="tile t-white span6">
        <h3>Don't</h3>
        <div class="donts">
          <div class="dont"><div class="sw">{sym_off}<span class="x" aria-hidden="true">✕</span></div><span>Flip the switch. The knob always sits on the right, in the on position.</span></div>
          <div class="dont"><div class="sw">{nhs}<span class="x" aria-hidden="true">✕</span></div><span>Recolour it. NHS blue and green, and anything near them, are banned outright.</span></div>
          <div class="dont"><div class="sw">{stretched}<span class="x" aria-hidden="true">✕</span></div><span>Stretch, skew, rotate or outline it, or add shadows or gradients.</span></div>
          <div class="dont"><div class="sw"><span class="retyped">Dr Quick</span><span class="x" aria-hidden="true">✕</span></div><span>Retype it. The wordmark is outlined artwork, so always place the file.</span></div>
          <div class="dont"><div class="sw"><div class="urgent">{s(A, 'lockup-colour')}<span>Prices surging now!</span></div><span class="x" aria-hidden="true">✕</span></div><span>Pair it with price urgency, countdowns or "busy now" language.</span></div>
          <div class="dont"><div class="sw">{toggle_ui}<span class="uilabel">Notifications</span><span class="x" aria-hidden="true">✕</span></div><span>Use the symbol as a toggle in the product UI. It is the logo, not a control.</span></div>
        </div>
      </div>

      <div class="tile t-band span3">
        <h3>App icon and favicon</h3>
        <ul class="rules">
          <li><p>App icon: a forest tile with the lime switch at 74% of its width. Submit the full-bleed square <code>app-icon-ios.svg</code> at 1024px; iOS and Android apply their own corner mask.</p></li>
          <li><p>Favicon: the favicon cut at 92% of the tile. Ship <code>favicon.svg</code> and <code>favicon.ico</code> (16, 32 and 48px).</p></li>
          <li><p>Apple touch icon: <code>png/app-icon-180.png</code>.</p></li>
        </ul>
      </div>
      <div class="tile t-stone span3">
        <h3>Type</h3>
        <p>The wordmark is Plus Jakarta Sans ExtraBold (800) at −0.04em tracking, converted to outlines. Set headlines in the same face at 800 and body text at 400, as on the site. The font's SIL Open Font License allows logo use.</p>
      </div>
    </div>
  </section>

  <section class="tile t-quiet files">
    <h3>Files</h3>
    <p>Each direction lives in <code>Brand/logo/&lt;direction&gt;/</code>. It holds the symbol and lockup as SVGs in colour, forest, black and white, a reversed lockup, <code>app-icon.svg</code>, <code>app-icon-ios.svg</code>, <code>favicon.svg</code> and <code>favicon.ico</code>, with PNGs in <code>png/</code>. The sources that rebuild everything are in <code>Brand/logo/src/</code>.</p>
    <p class="muted">Before you commit to a direction, have a trademark attorney run a clearance search. I checked these marks by eye against the category, not against the trademark registers.</p>
  </section>
</main>
'''
open('../drquick-logo.html', 'w').write(page)
print(len(page))
