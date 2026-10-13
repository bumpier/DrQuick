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

const IN_CALL = new Set(['connecting', 'waiting', 'connected', 'reconnecting', 'peer_left']);

export function CallView({ who, active, requestPass, className }: {
  who: Who; active: boolean; requestPass: () => Promise<Response>; className?: string;
}) {
  const call = useEncryptedCall({ requestPass });
  const frame = useRef<HTMLDivElement>(null);
  const { state } = call;
  const inCall = IN_CALL.has(state.status);

  // The consultation is over: leave the call, if one is going.
  const { leave } = call;
  useEffect(() => { if (!active && inCall) void leave(); }, [active, inCall, leave]);

  const line = statusLine(state, who);
  const canStart = state.status === 'idle' || state.status === 'ended' || state.status === 'failed';
  return (
    <div data-slot="call-view" className={cn('grid gap-3', className)}>
      <div ref={frame} className="relative h-full min-h-48 overflow-hidden rounded-xl bg-band text-white">
        <video ref={call.remoteVideoRef} autoPlay playsInline hidden={!inCall} className="size-full object-cover" />
        <audio ref={call.remoteAudioRef} autoPlay hidden />
        <video
          ref={call.localVideoRef} autoPlay playsInline muted hidden={!inCall} aria-label="Your camera"
          className="absolute right-3 bottom-3 w-28 -scale-x-100 rounded-md shadow-pop max-phone:w-20"
        />
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
          <Button type="button" size="sm" onClick={() => void call.start()}>
            <VideoIcon strokeWidth={2} aria-hidden="true" />
            {state.status === 'idle' ? (who === 'gp' ? 'Start video' : 'Join video') : 'Rejoin video'}
          </Button>
        )}
        {inCall && (
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => void call.toggleMic()}>
              {state.micOn ? <MicIcon strokeWidth={2} aria-hidden="true" /> : <MicOffIcon strokeWidth={2} aria-hidden="true" />}
              {state.micOn ? 'Mute' : 'Unmute'}
            </Button>
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
