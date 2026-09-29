# DrQuick branding

The DrQuick logo is the **Plus switch**: a lime switch in the on position whose knob carries a plus. "Switch on a doctor."
The rules for using it are in `guide/drquick-brand-guidelines.html`. Open it in a browser.

## What's here

| Folder | Contents |
|---|---|
| `guide/` | The brand guidelines as HTML and PDF (logo family, construction, clear space, colour, colourways, backgrounds, app icon, favicon, social, type, motion, responsible use, misuse) |
| `logo/svg/<colourway>/` | Master artwork. Five versions × six colourways |
| `logo/png/<colourway>/` | Every SVG as a transparent PNG at 1000px and 4000px on the long edge |
| `app-icon/` | iOS asset catalogue and sizes, Android adaptive, monochrome and legacy icons, Play Store icon, Expo assets |
| `favicon/` | `favicon.ico`, `favicon.svg`, PNG sizes, Apple touch icon, Android/maskable icons, `site.webmanifest`, `head.html` |
| `social/` | Profile picture, Open Graph card (1200 × 630), email-signature wordmark |
| `src/` | The build scripts and font. Everything above is generated from here |

**Versions:** `wordmark` (primary), `lockup-horizontal`, `lockup-stacked`, `symbol`, `knob` (below 24px only).

**Colourways:**
- `colour`: for light grounds
- `reversed`: for forest
- `forest`, `black`, `white`: single colour
- `lime`: single colour, on forest only

File names follow `drquick-<version>-<colourway>[-<px>].<ext>`.

## Colours

| Name | HEX | RGB | CMYK |
|---|---|---|---|
| Forest | `#163300` | 22 51 0 | 57 0 100 80 |
| Lime | `#9FE870` | 159 232 112 | 31 0 52 9 |
| Lime ink (text and lines only) | `#2F6B0F` | 47 107 15 | n/a |

The CMYK values are straight conversions. Set Pantone references from a press proof before the first print run.

## Adding the favicon to a site

Copy everything in `favicon/` to the web root and paste `favicon/head.html` into the `<head>`.

## Rebuilding

Never edit exported files by hand. Change `src/build.py`, then run:

```bash
cd Branding/src
python3 build.py   # every logo, icon, favicon and social image
python3 guide.py   # the guidelines page, from the files build.py wrote
python3 pdf.py     # prints the PDF and copies the guide into website/public/brand (served at /brand)
python3 site.py    # writes website/components/Wordmark.tsx and the site's favicon set and og.png
```

`pdf.py` drives any installed Chromium through Playwright (`pip3 install playwright`); it defaults to Brave, and `CHROMIUM=/path/to/chrome` overrides that.

Requires Python 3 with `fonttools`, `brotli`, `skia-pathops` and `cairosvg`, plus the Cairo library (`brew install cairo`) and ImageMagick for `favicon.ico`.

## Notes

- The wordmark is drawn from Plus Jakarta Sans ExtraBold (SIL Open Font License, which permits logo use) and converted to outlines, so no font is needed to display it.
- A trademark clearance search has not been run yet. Have one done before registering or printing at scale.
- Earlier logo explorations are in `../Brand/logo/`. They are not for use.
