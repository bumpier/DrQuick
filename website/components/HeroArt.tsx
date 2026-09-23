import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The patient hero illustration, inlined at build time from the asset file so
// the idle loop can be paused off-screen — the same result as the flat page's
// inline art, with the asset file staying the single source of truth. Read
// once at module scope: this is a server component, evaluated at build.
const ART = readFileSync(join(process.cwd(), 'public/assets/doctors-bro.svg'), 'utf8');

export function HeroArt() {
  return <div className="hero-img" data-reveal="load" dangerouslySetInnerHTML={{ __html: ART }} />;
}
