// A bento photo tile (DESIGN.md, Lime & Forest). Real photography is the plan;
// until it is shot or licensed, each tile holds its slot with a flat tone, one
// hard-edged disc in a partner tone and an authored glyph — no stock people, no
// captions, nothing that could pass for a Dr Quick GP. `slot` names the shot in
// docs/photo-brief.md, so dropping a photo in is `src` + `alt` and nothing else.
import Image from 'next/image';
import { cn } from '@/lib/utils';

export type PhotoTone = 'wash' | 'peach' | 'sun' | 'quiet';
export type Glyph = 'phone' | 'video' | 'home' | 'laptop' | 'chat';

const TONE: Record<PhotoTone, { ground: string; disc: string }> = {
  wash: { ground: 'bg-lime-wash', disc: 'bg-primary' },
  peach: { ground: 'bg-peach', disc: 'bg-sun' },
  sun: { ground: 'bg-sun', disc: 'bg-white' },
  quiet: { ground: 'bg-surface-mid', disc: 'bg-lime-wash' },
};

// 24-unit line icons at stroke 2, drawn in the house style of the #i-yes / #i-no
// sprite: round caps and joins, currentColor.
const GLYPHS: Record<Glyph, React.ReactNode> = {
  phone: <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18h3" /></>,
  video: <><rect x="2.5" y="6" width="13" height="12" rx="2.5" /><path d="M15.5 10.5l6-3.5v10l-6-3.5" /></>,
  home: <><path d="M3.5 11L12 4l8.5 7" /><path d="M6 9.5V20h12V9.5" /><path d="M10 20v-5h4v5" /></>,
  laptop: <><rect x="4.5" y="5" width="15" height="10.5" rx="1.5" /><path d="M2.5 19h19" /></>,
  chat: <><path d="M4 5.5h16v10H9l-5 4v-14z" /><path d="M8 9.5h8M8 12.5h5" /></>,
};

export function PhotoTile({ slot, tone, glyph, src, alt = '', className, sizes = '(max-width: 900px) 100vw, 40vw' }: {
  slot: string;
  tone: PhotoTone;
  glyph: Glyph;
  src?: string;
  alt?: string;
  className?: string;
  sizes?: string;
}) {
  const t = TONE[tone];
  return (
    <figure data-photo={slot} className={cn('relative isolate overflow-hidden rounded-2xl', t.ground, className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <>
          <span aria-hidden="true" className={cn('absolute -right-[18%] -bottom-[22%] -z-10 aspect-square w-[78%] rounded-full', t.disc)} />
          <span aria-hidden="true" className="absolute top-5 left-5 grid size-16 place-items-center rounded-full bg-white text-ink max-phone:top-3.5 max-phone:left-3.5 max-phone:size-12">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {GLYPHS[glyph]}
            </svg>
          </span>
        </>
      )}
    </figure>
  );
}

export type PhotoSpec = { slot: string; tone: PhotoTone; glyph: Glyph; src?: string; alt?: string };

// The hero's right-hand cluster: one tall tile beside two short ones. Both modes
// use the same cluster so the two heroes stay the same shape (CLAUDE.md).
export function HeroTiles({ tiles }: { tiles: [PhotoSpec, PhotoSpec, PhotoSpec] }) {
  const [tall, top, bottom] = tiles;
  return (
    <div className="hero-art grid grid-cols-2 grid-rows-2 gap-4 min-h-[480px] max-cols:min-h-[300px] max-phone:min-h-[220px] max-phone:gap-3" data-reveal="load">
      <PhotoTile {...tall} className="row-span-2" />
      <PhotoTile {...top} />
      <PhotoTile {...bottom} />
    </div>
  );
}
