'use client';
import { useEffect, useRef } from 'react';
import { LockIcon, Maximize2Icon, MicIcon, MicOffIcon, PhoneOffIcon, VideoIcon, VideoOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEncryptedCall, type CallFailureReason, type CallState } from './useEncryptedCall';

// Our own call screen, for the GP's portal and the patient prototype
// (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md): the
// other person large, your own picture small, and the few controls a
// consultation needs. No third-party page, no chat, no screen sharing.
//
// The lock shows only when useEncryptedCall has proved the call is end-to-end
// encrypted. When something goes wrong the screen says what to do, and it
// never falls back to an unencrypted call. The video elements are always in
// the page, hidden until needed, so a verified track always has somewhere to go.

type Who = 'gp' | 'patient';

const FAILURE: Record<CallFailureReason, string> = {
  not_encrypted: 'The call ended because its encryption couldn’t be confirmed.',
  unexpected_participant: 'The call ended because its encryption couldn’t be confirmed.',
  encryption_failed: 'The call ended because its encryption couldn’t be confirmed.',
  opened_elsewhere: 'This call was opened somewhere else.',
  media_blocked: 'Allow the camera and microphone for this site, then try again.',
  video_off: 'Video calls are not set up on this server.',
  no_consultation: 'There is no consultation in progress.',
  signed_out: 'Sign in again to join the call.',
  unavailable: 'The video service can’t be reached. Try again.',
};

function statusLine(state: CallState, who: Who): string | null {
  switch (state.status) {
    case 'idle': return null;
    case 'unsupported': return 'This browser can’t make an encrypted call. Update to the latest Safari or Chrome.';
    case 'connecting': return 'Connecting…';
    case 'waiting': return who === 'gp' ? 'Waiting for the patient…' : 'Your GP will join shortly';
    case 'connected': return state.badge === 'checking' ? 'Checking encryption…' : 'Connected';
    case 'reconnecting': return 'Reconnecting…';
    case 'peer_left': return who === 'gp' ? 'The patient left the call.' : 'Your GP left the call.';
    case 'ended': return 'The call has ended.';
    case 'failed': return state.failure ? FAILURE[state.failure] : 'The video service can’t be reached. Try again.';
  }
}

// Before the call, the frame says what happens next rather than standing blank.
function idleLine(who: Who, autoStart: boolean): string {
  if (who === 'gp') return 'Start the video when you’re ready.';
  return autoStart ? 'Connecting you to your GP…' : 'Join the video when you’re ready.';
}

// Over a picture whose camera is off: the frozen last frame is covered, and the
// icon says why. Text for a screen reader, since the icon is only a picture.
function CameraOff({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-band text-band-muted">
      <VideoOffIcon strokeWidth={2} className={small ? 'size-6' : 'size-12'} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function MutedBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('absolute grid size-7 place-items-center rounded-full bg-ink/70 text-white', className)}>
      <MicOffIcon strokeWidth={2} className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

const IN_CALL = new Set(['connecting', 'waiting', 'connected', 'reconnecting', 'peer_left']);

export function CallView({ who, active, requestPass, className, autoStart = false, demoPatient = false }: {
  who: Who; active: boolean; requestPass: () => Promise<Response>; className?: string;
  // Joins as the screen opens, with no button to press: the patient's side.
  autoStart?: boolean;
  // The investor demo's patient: a generated picture and no microphone (useEncryptedCall).
  demoPatient?: boolean;
}) {
  const call = useEncryptedCall({ requestPass, demoPatient });
  const frame = useRef<HTMLDivElement>(null);
  const { state } = call;
  const inCall = IN_CALL.has(state.status);

  // The consultation is over: leave the call, if one is going.
  const { leave } = call;
  useEffect(() => { if (!active && inCall) void leave(); }, [active, inCall, leave]);

  // Started on the tick after mounting, once. In development React runs every
  // effect twice, and in between the call's own unmount cleanup would mark a
  // call already under way as finished, stranding it half joined. So the start
  // waits on a timer that this effect's cleanup cancels, and only the mount
  // that stays fires it. The ref keeps it to one start for the life of the screen.
  const { start } = call;
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    const timer = setTimeout(() => { autoStarted.current = true; void start(); }, 0);
    return () => clearTimeout(timer);
  }, [autoStart, start]);

  const line = statusLine(state, who);
  const canStart = (state.status === 'idle' && !autoStart) || state.status === 'ended' || state.status === 'failed';
  return (
    <div data-slot="call-view" className={cn('grid gap-3', className)}>
      <div ref={frame} className="relative h-full min-h-48 overflow-hidden rounded-xl bg-band text-white">
        <video ref={call.remoteVideoRef} autoPlay playsInline hidden={!inCall} className="size-full object-cover" />
        <audio ref={call.remoteAudioRef} autoPlay hidden />
        {state.status === 'idle' && (
          <div data-slot="call-idle" className="absolute inset-0 grid place-content-center justify-items-center gap-3 px-6 text-center">
            <VideoIcon strokeWidth={2} className="size-12 text-band-muted" aria-hidden="true" />
            <p className="text-body">{idleLine(who, autoStart)}</p>
          </div>
        )}
        {inCall && state.peerCameraOff && <CameraOff label={who === 'gp' ? 'The patient’s camera is off' : 'Your GP’s camera is off'} />}
        {inCall && state.peerMicMuted && (
          <MutedBadge label={who === 'gp' ? 'The patient is muted' : 'Your GP is muted'} className="bottom-3 left-3" />
        )}
        <div hidden={!inCall} className="absolute right-3 bottom-3 aspect-[4/3] w-28 overflow-hidden rounded-md bg-band shadow-pop max-phone:w-20">
          {/* A camera shows you as a mirror would; the demo's drawn picture, with its label, is not a reflection. */}
          <video
            ref={call.localVideoRef} autoPlay playsInline muted aria-label="Your camera"
            className={cn('size-full object-cover', !demoPatient && '-scale-x-100')}
          />
          {!state.cameraOn && <CameraOff small label="Your camera is off" />}
          {!state.micOn && <MutedBadge label="You are muted" className="top-1 left-1" />}
        </div>
        <div className="absolute top-3 left-3 grid justify-items-start gap-2">
          {state.badge === 'verified' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-fine font-semibold">
              <LockIcon strokeWidth={2} className="size-4" aria-hidden="true" />
              {who === 'gp' ? 'Encrypted end to end · Not recorded' : 'Encrypted end to end'}
            </span>
          )}
          {line && <p role="status" aria-live="polite" className="max-w-[40ch] text-body text-band-muted">{line}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canStart && (
          <Button type="button" size="lg" onClick={() => void call.start()}>
            <VideoIcon strokeWidth={2} aria-hidden="true" />
            {state.status === 'idle' ? (who === 'gp' ? 'Start video' : 'Join video') : 'Rejoin video'}
          </Button>
        )}
        {inCall && (
          <>
            {!demoPatient && (
              <Button type="button" size="sm" variant="secondary" onClick={() => void call.toggleMic()}>
                {state.micOn ? <MicIcon strokeWidth={2} aria-hidden="true" /> : <MicOffIcon strokeWidth={2} aria-hidden="true" />}
                {state.micOn ? 'Mute' : 'Unmute'}
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={() => void call.toggleCamera()}>
              {state.cameraOn ? <VideoIcon strokeWidth={2} aria-hidden="true" /> : <VideoOffIcon strokeWidth={2} aria-hidden="true" />}
              {state.cameraOn ? 'Camera off' : 'Camera on'}
            </Button>
            {who === 'gp' && (
              <Button type="button" size="sm" variant="secondary" onClick={() => void frame.current?.requestFullscreen()}>
                <Maximize2Icon strokeWidth={2} aria-hidden="true" />
                Full screen
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" onClick={() => void call.leave()}>
              <PhoneOffIcon strokeWidth={2} aria-hidden="true" />
              Leave video
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
