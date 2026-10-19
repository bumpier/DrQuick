'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CallView } from '@/components/call/CallView';
import { useShift } from './ShiftProvider';

// The doctor's video call, in the portal layout (docs/superpowers/specs/
// 2026-10-13-encrypted-video-calls-design.md). Mounted once, beside every
// portal page, so the call survives the doctor opening Earnings or Profile:
// shown during a consultation, hidden rather than unmounted otherwise, because
// unmounting would end the call. Each consultation gets a fresh call screen,
// and when the consultation ends this browser leaves; the server deletes the
// room as well, which is what disconnects the patient.

const requestPass = () => fetch('/doctor/call', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });

export function CallPanel() {
  const { state } = useShift();
  const consultationId = state.kind === 'consultation' && 'consultationId' in state ? String(state.consultationId) : null;
  const active = state.kind === 'consultation';
  return (
    <Card hidden={!active} size="sm" className="mb-4" data-slot="call-panel" aria-labelledby="call-panel-title">
      <CardHeader className="sr-only">
        <CardTitle><h2 id="call-panel-title" className="text-headline-sm">Video call</h2></CardTitle>
      </CardHeader>
      <CardContent>
        <CallView
          key={consultationId ?? 'none'}
          who="gp"
          active={active}
          requestPass={requestPass}
          className="[&>div:first-child]:h-[max(18rem,min(calc(100svh-24rem),40rem))] max-phone:[&>div:first-child]:h-[60svh]"
        />
      </CardContent>
    </Card>
  );
}
