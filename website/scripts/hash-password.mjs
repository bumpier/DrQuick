// Prints one ADMIN_USERS entry for the blog editor. No dependencies.
//
//   npm run admin:hash -- editor@example.com "Sam Editor"
//
// It asks for the password without echoing it. Join several entries with ";"
// and set the result as ADMIN_USERS (Vercel env, or .env.local for dev).
// The format must match hashPassword() in lib/admin-auth.ts.
import { randomBytes, scryptSync } from 'node:crypto';
import { stdin, stdout, argv, exit } from 'node:process';

const [email, name] = argv.slice(2);
if (!email || !name || !email.includes('@')) {
  console.error('usage: npm run admin:hash -- <email> "<Display Name>"');
  exit(2);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    stdout.write(prompt);
    let value = '';
    const raw = stdin.isTTY;
    if (raw) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          if (raw) stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') exit(130);
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const password = process.env.ADMIN_PASSWORD ?? await askHidden('Password (12+ characters): ');
if (password.length < 12) {
  console.error('Use at least 12 characters.');
  exit(1);
}
const N = 16384;
const salt = randomBytes(16);
const key = scryptSync(password.normalize('NFKC'), salt, 64, { N });
console.log(`${email.toLowerCase()}|${name}|scrypt:${N}:${salt.toString('base64url')}:${key.toString('base64url')}`);
