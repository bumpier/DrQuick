import ctypes.util, sys, os, glob
_f = ctypes.util.find_library
ctypes.util.find_library = lambda n: '/opt/homebrew/lib/libcairo.2.dylib' if 'cairo' in n else _f(n)
import cairosvg
def render(src, dst, h=384, bg='white'):
    cairosvg.svg2png(url=src, write_to=dst, output_height=h, background_color=bg)
if __name__ == '__main__':
    os.makedirs('renders', exist_ok=True)
    for f in sys.argv[1:]:
        render(f, 'renders/' + os.path.basename(f)[:-4] + '.png')
    print('done')
