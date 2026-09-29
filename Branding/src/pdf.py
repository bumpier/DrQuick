"""Prints guide/drquick-brand-guidelines.html to PDF and takes review screenshots. Uses any installed Chromium (Brave here)."""
import sys, os
from playwright.sync_api import sync_playwright
EXE = os.environ.get('CHROMIUM', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
G = os.path.abspath('../guide'); html = f'file://{G}/drquick-brand-guidelines.html'
shots = sys.argv[1] if len(sys.argv) > 1 else None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=EXE, headless=True, args=['--no-first-run'])
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.goto(html, wait_until='load', timeout=60000)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(1200)
    pg.pdf(path=f'{G}/drquick-brand-guidelines.pdf', format='A4', landscape=True, print_background=True, prefer_css_page_size=True)
    if shots:
        os.makedirs(shots, exist_ok=True)
        pg.screenshot(path=f'{shots}/desktop.png', full_page=True)
        pg.set_viewport_size({'width': 390, 'height': 844})
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{shots}/phone.png', full_page=True)
        print('overflow', pg.evaluate('document.documentElement.scrollWidth'), 'font', pg.evaluate('document.fonts.check("800 20px \\"Plus Jakarta Sans\\"")'))
    b.close()
print('pdf ok')

# Copy the web build into the website, which serves it at /brand (see website/next.config.ts).
import shutil
WEB = os.path.abspath('../../website/public/brand')
if os.path.isdir(os.path.dirname(WEB)):
    os.makedirs(WEB, exist_ok=True)
    shutil.copy(f'{G}/web-index.html', f'{WEB}/index.html')
    shutil.copy(f'{G}/PlusJakartaSans-Variable.woff2', WEB)
    shutil.copy(f'{G}/drquick-brand-guidelines.pdf', WEB)
    print('copied to', WEB)
