// Shared by both modes: a full-bleed forest block. The second of the two 999
// links lives here, so the page never loses it. No Storyset asset is on the
// page any more, so its licence attribution went with the illustrations; put
// it back if one returns.
import { Wordmark } from '@/components/Wordmark';

export function Footer() {
  return (
    <footer className="bg-band pt-14 pb-16 text-fine text-band-ink-2">
      <div className="wrap flex flex-wrap items-end justify-between gap-y-8 gap-x-10">
        <div>
          <p className="warn text-label font-semibold text-white tracking-[-.01em]">
            Not for emergencies — <a className="tel" href="tel:999">call 999</a> or go to A&amp;E.
          </p>
          <p className="mt-3">© 2026 Dr Quick · CQC-registered clinical service at launch · Available in England at launch</p>
        </div>
        <Wordmark className="text-3xl text-white" />
      </div>
    </footer>
  );
}
