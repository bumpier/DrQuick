// Stubs for the mail provider: what a test needs to see an email go out, or
// fail to. Each stubs the keys too, so the code under test tries to send.
import { vi } from 'vitest';

export function mailWorks(): Array<{ to: string[]; text: string }> {
  const sent: Array<{ to: string[]; text: string }> = [];
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
  }));
  return sent;
}

export function mailIsDown(): void {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ message: 'provider is down' }), { status: 500 })));
}

// The token= value in the link an email carried.
export function tokenIn(text: string): string {
  const match = text.match(/token=([A-Za-z0-9_%-]+)/);
  if (!match) throw new Error('no token in the email');
  return decodeURIComponent(match[1]);
}
