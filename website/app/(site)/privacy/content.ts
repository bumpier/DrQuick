// DRAFT privacy notice for the pre-launch waitlist. DEPLOY / LEGAL: the legal
// entity is undecided (PRODUCT.md), so the controller's name, address and
// privacy contact, the lawful basis and the hosting processors are bracketed
// placeholders. This page is noindexed and carries a draft banner until a
// lawyer has reviewed it and the placeholders are real. It describes only what
// the code actually does: app/api/waitlist/route.ts and lib/waitlist.ts.
import { CONTACT_EMAIL } from '@/lib/site';

export const PRIVACY_UPDATED = '25 September 2026';

export const PRIVACY_MD = `
## Who we are

Dr Quick is run by **[registered company name]**, **[registered address]**, company number **[number]**. We are the controller of the personal data described here. You can contact us about your data at **[privacy contact address]** or ${CONTACT_EMAIL}.

Dr Quick has not launched. This notice covers the waitlist on this website only. A full notice covering consultations will be published before anyone is seen.

## What we collect

**If you join the patient waitlist:** your email address, that you joined as a patient, which form you used, and when.

**If you sign up as a GP:** your name, email address, mobile number and GMC reference number, that you signed up as a GP, which form you used, and when.

That is everything. We do not ask for any health information on this website.

## What we don’t collect

- **No IP address is stored.** To stop abuse, we briefly keep a one-way scrambled code made from your IP address. It cannot be turned back into your address, and it is deleted after ten minutes.
- **No tracking or advertising cookies,** and no analytics.

## Why we use it

- **Patients:** to tell you when Dr Quick opens. Nothing else.
- **GPs:** to check you on the GMC register and to contact you about launching.

Our lawful basis is **[lawful basis — to be confirmed]**. We never share or sell your details.

## Who else handles it

Your details are stored with **[database and hosting providers — to be confirmed]**, who process them only on our instructions.

## How long we keep it

Until launch, and for no more than twelve months after that. Then we delete it. You can ask us to delete it sooner at any time.

## Your rights

You can ask to see the data we hold about you, to correct it, to delete it, to restrict or object to how we use it, or to receive a copy. Email ${CONTACT_EMAIL} and we will respond within one month.

If you are unhappy with how we have handled your data, you can complain to the Information Commissioner’s Office at [ico.org.uk](https://ico.org.uk) or on 0303 123 1113.
`;
