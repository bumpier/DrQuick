import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { formatClock } from '@/lib/booking';

// The call. A labelled placeholder that says what it is, never a fake stream;
// or, on a developer's machine with video calls set up (devVideoCalls in
// lib/video/calls.ts), the real encrypted call, joined as the patient of the
// consultation a GP is in. Capped in height on a phone so the control that
// ends the call is always on screen: a patient must never have to scroll to get
// out of a consultation.
const requestDevPass = () => fetch('/dev/call', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
// Loaded only when the call is real, so a production build's patient pages
// never ship the media library.
const CallView = dynamic(() => import('@/components/call/CallView').then((m) => m.CallView), { ssr: false });

export function VideoFrame({ gpRef, videoCalls = false }: { gpRef: string; videoCalls?: boolean }) {
  if (videoCalls) {
    return (
      <div data-slot="video-frame" className="grid w-full max-w-[48rem] gap-3">
        <CallView
          who="patient"
          active
          requestPass={requestDevPass}
          className="[&>div:first-child]:h-[55svh] md:[&>div:first-child]:h-[calc(100svh-var(--header-h)-10rem)]"
        />
      </div>
    );
  }
  return (
    <div
      data-slot="video-frame"
      className="relative grid aspect-[3/4] max-h-[42svh] w-full max-w-[32rem] place-items-center overflow-hidden rounded-xl bg-band text-band-muted md:aspect-[4/3] md:max-h-[64svh]"
    >
      <Badge className="absolute top-4 left-4 bg-white/15 text-white">Not recorded</Badge>
      <span className="px-6 text-center text-body">{`${gpRef} · connected`}</span>
      <span aria-hidden="true" className="absolute right-4 bottom-4 grid h-20 w-16 place-items-center rounded-lg bg-white/10 text-fine">
        You
      </span>
    </div>
  );
}

export function CallClock({ seconds, gpRef }: { seconds: number; gpRef: string }) {
  return (
    <div className="grid gap-1">
      <span data-slot="consult-clock" className="font-display text-4xl leading-none font-bold tracking-[-.03em] tabular-nums">
        {formatClock(seconds)}
      </span>
      <span className="text-fine text-ink-2">{`With ${gpRef}`}</span>
    </div>
  );
}
