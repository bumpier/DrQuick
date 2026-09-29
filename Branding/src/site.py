"""Puts the brand into the website: the Wordmark component, the favicon set and the share card.
Run from Branding/src after build.py: python3 site.py"""
import json, os, re, shutil

ROOT = os.path.abspath('..'); WEB = os.path.abspath('../../website')
ASSETS = f'{WEB}/public/assets'

# ---- components/Wordmark.tsx, from the colour wordmark (paths: Dr, pill, Quick, knob, plus)
svg = open(f'{ROOT}/logo/svg/colour/drquick-wordmark-colour.svg').read()
vb = re.search(r'viewBox="([^"]+)"', svg).group(1)
dr, pill, quick, knob, plus = re.findall(r' d="([^"]+)"', svg)
h = float(vb.split()[3])
em = h / 150  # the artwork sets its type at 150 units, so 1em of font-size = 150 units
tsx = f'''import {{ cn }} from '@/lib/utils';

// The wordmark, defined once: the Plus switch logo (DESIGN.md; the brand
// guidelines are at /brand, their source in ../Branding). "Dr" takes the
// surface's text colour, so it is forest on light surfaces and white on the
// band; the lime pill, "Quick" and the knob with its plus read the same on
// every surface. The paths are the brand artwork, written by
// ../Branding/src/site.py: never edit them by hand, and never set the name in
// live type instead. The accessible name stays "DrQuick" through the
// visually hidden span, and a wrapping link can override it with aria-label.
// It is sized in em: the text-* class on the wrapper sets the cap height the
// live wordmark used to have, so existing sizes carry over.
const DR = '{dr}';
const PILL = '{pill}';
const QUICK = '{quick}';
const KNOB = '{knob}';
const PLUS = '{plus}';

export function Wordmark({{ className }}: {{ className?: string }}) {{
  return (
    <span className={{cn('inline-flex align-middle whitespace-nowrap', className)}}>
      <svg viewBox="{vb}" aria-hidden="true" focusable="false" className="h-[{em:.4f}em] w-auto">
        <path className="fill-current" d={{DR}} />
        <path className="fill-primary" d={{PILL}} />
        <path className="fill-ink" d={{QUICK}} />
        <path className="fill-ink" d={{KNOB}} />
        <path className="fill-primary" d={{PLUS}} />
      </svg>
      <span className="sr-only">DrQuick</span>
    </span>
  );
}}
'''
open(f'{WEB}/components/Wordmark.tsx', 'w').write(tsx)

# ---- favicon set and share card, served from /assets (the CSP's img-src 'self')
F = f'{ROOT}/favicon'
for name in ('favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'android-chrome-192.png', 'android-chrome-512.png', 'maskable-512.png'):
    shutil.copy(f'{F}/{name}', f'{ASSETS}/{name}')
shutil.copy(f'{F}/favicon.ico', f'{WEB}/public/favicon.ico')  # browsers still ask for /favicon.ico
m = json.load(open(f'{F}/site.webmanifest'))
for i in m['icons']: i['src'] = '/assets' + i['src']
json.dump(m, open(f'{ASSETS}/site.webmanifest', 'w'), indent=2)
shutil.copy(f'{ROOT}/social/og-image-1200x630.png', f'{ASSETS}/og.png')
print('site updated:', vb, f'{em:.4f}em')
