import { redirect } from 'next/navigation';

// /admin/waitlist has no page of its own; the patient list is its first section.
export default function WaitlistIndex() {
  redirect('/admin/waitlist/patients');
}
