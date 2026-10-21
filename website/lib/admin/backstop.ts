// The ADMIN_USERS list: accounts that live in the environment, not the
// database. They always work, so the team can never be locked out of its own
// panel, and they cannot be edited from it. Server-only.
//
//   email|Display Name|scrypt:16384:<salt>:<hash>   entries separated by ";"
export type BackstopAccount = { email: string; name: string; hash: string };

export function adminAccounts(env = process.env.ADMIN_USERS ?? ''): Map<string, BackstopAccount> {
  const accounts = new Map<string, BackstopAccount>();
  for (const entry of env.split(';')) {
    const [email, name, hash] = entry.split('|').map((s) => s.trim());
    if (email && name && hash?.startsWith('scrypt:')) accounts.set(email.toLowerCase(), { email: email.toLowerCase(), name, hash });
  }
  return accounts;
}
