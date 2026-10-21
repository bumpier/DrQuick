import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { formatClock } from '@/lib/booking';
import { demoMode } from '@/lib/demo';

// The call. A labelled placeholder that says what it is, never a fake stream;
// or, on a developer's machine or in the demo deployment with video calls set
// up (devVideoCalls in lib/video/calls.ts), the real encrypted call, joined as the patient of the
// consultation a GP is in. In the investor demo the patient joins as this
// screen opens and sends a generated picture (components/call/demoCamera.ts) and no microphone,
// because the presenter's one camera is the GP's. Capped in height on a phone
// so the control that ends the call is always on screen: a patient must never
// have to scroll to get out of a consultation.
const requestDevPass = () => fetch('/dev/call', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
// Loaded only when the call is real, so a production build's patient pages
// never ship the media library, or the demo's camera that lives beside it.
// Until it arrives the frame holds its place, so nothing below jumps and the
// badge has a frame to sit on.
const CallView = dynamic(() => import('@/components/call/CallView').then((m) => m.CallView), {
  ssr: false,
  loading: () => (
    <div data-slot="call-loading" className="h-[55svh] min-h-48 rounded-xl bg-band md:h-[calc(100svh-var(--header-h)-10rem)]" />
  ),
});

export function VideoFrame({ gpRef, videoCalls = false }: { gpRef: string; videoCalls?: boolean }) {
  if (videoCalls) {
    return (
      <div data-slot="video-frame" className="relative grid w-full max-w-[48rem] gap-3">
        <CallView
          who="patient"
          active
          autoStart={demoMode()}
          demoPatient={demoMode()}
          requestPass={requestDevPass}
          className="[&>div:first-child]:h-[55svh] md:[&>div:first-child]:h-[calc(100svh-var(--header-h)-10rem)]"
        />
        {/* Top right: the call's own lock and status take the top left. */}
        <Badge className="absolute top-3 right-3 bg-white/15 text-white">Not recorded</Badge>
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
