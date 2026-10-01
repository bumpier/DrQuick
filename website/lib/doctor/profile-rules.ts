// The profile's rules, in one place so the form and the server cannot drift.
// The form checks to keep a doctor out of a round trip; the server checks again
// because the browser is not the authority. Pure: no imports that need a server.
import { GP_MESSAGES, isUkMobile, normaliseMobile, normaliseName } from '@/lib/gp-signup';

export type Profile = { name: string; mobile: string; bio: string; languages: string };
export type ProfileField = keyof Profile;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const BIO_MAX = 600;
export const LANGUAGES_MAX = 120;

const oneLine = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

// Only the four fields are read: anything else posted (an email, a GMC number)
// is ignored rather than refused.
export function normaliseProfile(raw: Record<string, unknown>): Profile {
  return {
    name: normaliseName(raw.name),
    mobile: normaliseMobile(raw.mobile),
    bio: String(raw.bio ?? '').trim(),
    languages: oneLine(raw.languages),
  };
}

export function profileErrors(p: Profile): ProfileErrors {
  const errors: ProfileErrors = {};
  if (p.name.length < 2) errors.name = GP_MESSAGES.name;
  if (!isUkMobile(p.mobile)) errors.mobile = GP_MESSAGES.mobile;
  if (p.bio.length > BIO_MAX) errors.bio = `Keep this to ${BIO_MAX} characters.`;
  if (p.languages.length > LANGUAGES_MAX) errors.languages = `Keep this to ${LANGUAGES_MAX} characters.`;
  return errors;
}
