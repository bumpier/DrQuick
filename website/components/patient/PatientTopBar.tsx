import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PATIENT_ACCOUNT } from '@/lib/fixtures';
import { PatientNav } from './PatientNav';
import { Wordmark } from '@/components/Wordmark';

// The wordmark home, the destinations (not during a request) and who is
// signed in, as a fixture reference, never a name.
export function PatientTopBar({ screen, flow }: { screen: string; flow: boolean }) {
  return (
    <header
      data-slot="top-bar"
      className="flex h-16 items-center gap-6 border-b border-rule bg-white px-6 max-phone:h-14 max-phone:gap-3 max-phone:px-4"
    >
      <Link
        href="/patient"
        aria-label="Dr Quick, home"
        className="text-xl no-underline"
      >
        <Wordmark />
      </Link>
      {!flow && <PatientNav screen={screen} />}
      <div className="ml-auto flex items-center gap-3">
        <Avatar size="sm"><AvatarFallback>{PATIENT_ACCOUNT.initials}</AvatarFallback></Avatar>
        <span className="text-fine font-semibold max-phone:sr-only">{PATIENT_ACCOUNT.ref}</span>
      </div>
    </header>
  );
}
