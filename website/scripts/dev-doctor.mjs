// Demo data for the doctor portal, on a development machine.
//
//   npm run db:seed:doctor    one doctor with a history, an unclaimed GP sign-up,
//                             and two patients waiting
//   npm run doctor:request    one more patient asks for a GP, now
//
// Both call the running dev server (`npm run dev`) at /dev/doctor, because local
// development runs on PGlite, which only the server's own process can open.
// The route answers 404 in a production build. PORT picks another port.
const action = process.argv[2];
if (action !== 'seed' && action !== 'request') {
  console.error('Usage: node scripts/dev-doctor.mjs seed | request');
  process.exit(1);
}

const base = process.env.DEV_URL || `http://localhost:${process.env.PORT || 3000}`;
let response;
try {
  response = await fetch(`${base}/dev/doctor?do=${action}`, { method: 'POST' });
} catch {
  console.error(`Could not reach ${base}. Start the dev server first: npm run dev`);
  process.exit(1);
}
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Failed (${response.status}): ${body.error ?? 'no detail'}`);
  process.exit(1);
}

if (action === 'seed') {
  console.log(`Demo doctor ready. Sign in at ${base}/doctor/login`);
  console.log(`  email     ${body.doctor.email}`);
  console.log(`  password  ${body.doctor.password}`);
  console.log(`${body.consultations} consultations, ${body.waiting} waiting. Go online within 15 minutes to be offered them.`);
  console.log(`To try claiming an account: ${base}/doctor/register with ${body.applicant.email} (the link is printed by the dev server).`);
} else {
  console.log(`A patient is waiting (consultation ${body.consultationId}).`);
}
