# Email (Resend)

The site sends three emails, through Resend's HTTP API (`lib/email.ts`):

- **Patient joins:** "You're on the Dr Quick waitlist", with an unsubscribe link.
- **GP applies:** "Your Dr Quick GP application", with what happens next and a withdraw link.
- **Team alert:** "New GP application", sent to every address in `ADMIN_ALERT_EMAILS`, with a link to the GP in the admin.

The templates are in `lib/email-templates.ts`.

An email is only attempted after the sign-up is saved. If sending fails, the sign-up still succeeds. Every attempt is logged, and you can see and resend it in **Admin → System → Emails**.

## Setup

1. Create a Resend account at resend.com and add the domain (e.g. `drquick.co.uk`) under **Domains**.
2. Add the DNS records Resend shows at your DNS host: the SPF `TXT` record, the DKIM `TXT` record and, if offered, the `MX` record for the bounce subdomain. Wait for Resend to show the domain as **Verified**.
3. Add a DMARC record if the domain has none. A safe start is `_dmarc  TXT  "v=DMARC1; p=none; rua=mailto:<your address>"`.
4. Create an API key with **Sending access** only, restricted to that domain.
5. Add these to `/var/www/drquick/website/.env.production`:

   ```
   RESEND_API_KEY=re_...
   EMAIL_FROM=Dr Quick <hello@drquick.co.uk>
   ADMIN_ALERT_EMAILS=you@drquick.co.uk,colleague@drquick.co.uk
   ```

6. Deploy (`bash scripts/deploy.sh`), then join the waitlist with your own address. Admin → System → Technical should show Email as set up, and Admin → System → Emails should show the send as `sent`.

## Unsubscribing

The link in each email opens `/unsubscribe?token=…`. Opening the link changes nothing, because mail scanners open every link in a message. The person has to press the button to confirm. Confirming erases their sign-up and any analytics linked to it, as the emails promise.

## Legal

Resend is a processor based in the US. Before real addresses are collected, the privacy notice must name it (the `[processors]` placeholder in `app/(site)/privacy/content.ts`), along with the transfer safeguard (the UK Extension to the EU–US Data Privacy Framework, or the IDTA).
