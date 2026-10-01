// The GP sign-up contract, in one place so the form and the route cannot drift.
// The client validates to keep a doctor out of a round trip; the route validates
// again because the client is not the authority. Both read these rules.

export type GpField = 'name' | 'email' | 'mobile' | 'gmc';

export type GpSignup = { name: string; email: string; mobile: string; gmc: string };

// The failure copy is shared too: a message the reader saw before submitting must
// be the same message the server sends back for the same field.
export const GP_MESSAGES: Record<GpField, string> = {
  name: 'Enter your full name, as it appears on the GMC register.',
  email: 'Enter a valid email address, like name@example.com.',
  mobile: 'Enter a UK mobile number, like 07700 900123.',
  gmc: 'Enter your GMC reference number — seven digits.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A GMC reference number is seven digits. Whether it is *yours* is settled by the
// register check before a first consultation, not by this form — so the shape is
// all that is enforced here, and the copy promises nothing more.
const GMC = /^\d{7}$/;
// UK mobile, stored in the 07 national form. +44 / 0044 / a bare 44 all fold into it.
const UK_MOBILE = /^07\d{9}$/;

export const MAX_NAME = 100;
export const MAX_EMAIL = 254;

/** Collapse runs of whitespace and trim; the register writes names, not layout. */
export function normaliseName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function normaliseEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

/** Strip the spacing people actually type, then fold every UK prefix to `07…`. */
export function normaliseMobile(value: unknown): string {
  let digits = String(value ?? '').replace(/[\s().-]/g, '');
  if (digits.startsWith('+44')) digits = '0' + digits.slice(3);
  else if (digits.startsWith('0044')) digits = '0' + digits.slice(4);
  else if (/^44\d{10}$/.test(digits)) digits = '0' + digits.slice(2);
  return digits;
}

/** Whether an already-normalised number is a UK mobile. */
export const isUkMobile = (mobile: string) => UK_MOBILE.test(mobile);

export function normaliseGmc(value: unknown): string {
  return String(value ?? '').replace(/\s/g, '');
}

export function normaliseGpSignup(payload: Record<string, unknown>): GpSignup {
  return {
    name: normaliseName(payload.name),
    email: normaliseEmail(payload.email),
    mobile: normaliseMobile(payload.mobile),
    gmc: normaliseGmc(payload.gmc),
  };
}

/**
 * The first field that fails, in the order the reader meets them — so focus lands
 * on the topmost problem rather than the last one checked. `null` means valid.
 */
export function firstInvalidField(signup: GpSignup): GpField | null {
  if (signup.name.length < 2) return 'name';
  if (!EMAIL.test(signup.email) || signup.email.length > MAX_EMAIL) return 'email';
  if (!UK_MOBILE.test(signup.mobile)) return 'mobile';
  if (!GMC.test(signup.gmc)) return 'gmc';
  return null;
}
