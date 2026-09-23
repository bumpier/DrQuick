'use client';

import { useEffect, useState } from 'react';

// A live region filled after mount, never born with text: a region announces
// what is added to it, and the server HTML must stay silent. The caller passes
// a sentence that changes only when something worth saying changes (a queue
// place, a whole minute), so nothing is spoken every second.
export function Announce({ text, politeness = 'polite' }: { text: string; politeness?: 'polite' | 'assertive' }) {
  const [said, setSaid] = useState('');
  useEffect(() => { setSaid(text); }, [text]);
  return <p data-slot="announce" className="sr-only" aria-live={politeness} aria-atomic="true">{said}</p>;
}
