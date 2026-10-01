// DRAFT privacy notice for the pre-launch waitlist. DEPLOY / LEGAL: the legal
// entity is undecided (PRODUCT.md), so the controller's name, address and
// privacy contact, the lawful basis and the hosting processors are bracketed
// placeholders. This page is noindexed and carries a draft banner until a
// lawyer has reviewed it and the placeholders are real. It describes only what
// the code actually does: app/api/waitlist/route.ts and lib/waitlist.ts for the
// waitlist, app/api/gp-signup/route.ts and lib/stripe.ts for the GP sign-up and
// its fee, and lib/analytics/track.ts with app/api/collect/route.ts for the
// analytics (retention: scripts/prune-analytics.mjs).
import { CONTACT_EMAIL } from '@/lib/site';

export const PRIVACY_UPDATED = '1 October 2026';

export const PRIVACY_MD = `
## Who we are

Dr Quick is run by **[registered company name]**, **[registered address]**, company number **[number]**. We are the controller of the personal data described here. You can contact us about your data at **[privacy contact address]** or ${CONTACT_EMAIL}.

Dr Quick has not launched. This notice covers the waitlist and the analytics on this website only. A full notice covering consultations will be published before anyone is seen.

## What we collect

**If you join the patient waitlist:** your email address, that you joined as a patient, which form you used, and when.

**If you sign up as a GP:** your name, email address, mobile number and GMC reference number, that you signed up as a GP, which form you used, and when. When you pay the sign-up fee we also keep that you paid it, how much, when, and Stripe’s reference for the payment. Your card details go to Stripe and never reach us.

If you accepted analytics cookies, we also link your sign-up to the anonymous visitor ID described below, so we can see how you found us and what you read before joining. Whether or not you accepted, your sign-up records which campaign link, referring site and page brought you to the form.

We do not ask for any health information on this website.

## What we don’t collect

- **No IP address is stored.** To stop abuse, we briefly keep a one-way scrambled code made from your IP address. It cannot be turned back into your address, and it is deleted after ten minutes.
- **No advertising cookies,** and nothing is shared with advertisers.

## Analytics

We run our own analytics on this website to learn which pages and sections help people and where they give up. It is not a third-party service: everything stays in our own database.

**If you have not chosen, or you declined:** we count page visits only. We record the page, the site that sent you, your device type (phone, tablet or computer) and your browser, with no ID, so no two visits can be linked to each other or to you. Nothing is stored on your device except a cookie remembering that you declined.

**If you accept analytics cookies:** we set a cookie holding a random visitor ID (kept for 13 months) and keep a visit ID in your browser for the length of your visit. With them we record which pages you view, how long you spend on them, how far you scroll, how long each section is on screen, where on the page you click, and which form fields you use and whether they showed an error. We never record what you type.

We do not use analytics if your browser sends a Global Privacy Control or Do Not Track signal. You can change your choice at any time with **Cookie settings** at the bottom of every page; declining removes the visitor ID cookie. Your choice is remembered for 12 months.

Analytics data is deleted after 13 months. The one exception: if you joined the waitlist, a short summary of how you first found us stays linked to your sign-up for as long as we keep the sign-up, and is deleted with it.

## Why we use it

- **Patients:** to tell you when Dr Quick opens. Nothing else.
- **GPs:** to check you on the GMC register, to contact you about launching, and to take your sign-up fee and refund it where we have said we will.

Our lawful basis is **[lawful basis — to be confirmed]**. We never sell your details, and we pass them on only as described next.

## Who else handles it

Your details are stored with **[database and hosting providers — to be confirmed]**, who process them only on our instructions.

**Stripe** takes the GP sign-up fee. If you pay it, Stripe receives your email address and your card details and handles them under [its own privacy policy](https://stripe.com/gb/privacy). **[Stripe’s role and the transfer safeguards — to be confirmed by legal review.]**

## How long we keep it

Until launch, and for no more than twelve months after that. Then we delete it. You can ask us to delete it sooner at any time. The record of a sign-up fee payment is the exception: it is kept for as long as tax law requires, **[period — to be confirmed]**.

## Your rights

You can ask to see the data we hold about you, to correct it, to delete it, to restrict or object to how we use it, or to receive a copy. Email ${CONTACT_EMAIL} and we will respond within one month.

If you are unhappy with how we have handled your data, you can complain to the Information Commissioner’s Office at [ico.org.uk](https://ico.org.uk) or on 0303 123 1113.
`;
