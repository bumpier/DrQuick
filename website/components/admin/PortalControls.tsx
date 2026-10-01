'use client';
import { MailIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendDoctorLinkAction, setDoctorPausedAction } from '@/app/admin/(panel)/waitlist/actions';
import { ConfirmAction } from './ConfirmAction';

// The two things the team does to a doctor's portal account directly. Each
// asks first, and its outcome is a toast.
export function PauseDoctorButton({ id, paused }: { id: string; paused: boolean }) {
  return paused ? (
    <ConfirmAction
      trigger={<Button variant="secondary" size="sm"><PlayIcon strokeWidth={2} />Resume this doctor</Button>}
      title="Resume this doctor?"
      description="They will be able to go online and take consultations again. They stay offline until they choose to."
      confirmLabel="Resume"
      run={() => setDoctorPausedAction(id, false)}
    />
  ) : (
    <ConfirmAction
      trigger={<Button variant="secondary" size="sm"><PauseIcon strokeWidth={2} />Pause this doctor</Button>}
      title="Pause this doctor?"
      description="They go offline now and cannot go online until you resume them. An offer they are holding passes to the next GP. A consultation already in progress is not interrupted."
      confirmLabel="Pause"
      run={() => setDoctorPausedAction(id, true)}
    />
  );
}

export function SendDoctorLinkButton({ id, claimed }: { id: string; claimed: boolean }) {
  return (
    <ConfirmAction
      trigger={<Button variant="secondary" size="sm"><MailIcon strokeWidth={2} />Email a sign-in link</Button>}
      title="Email them a sign-in link?"
      description={claimed
        ? 'They will get a one-time link to choose a new password. Their current password keeps working until they use it.'
        : 'They will get a one-time link to choose a password and set up the portal.'}
      confirmLabel="Send it"
      run={() => sendDoctorLinkAction(id)}
    />
  );
}
