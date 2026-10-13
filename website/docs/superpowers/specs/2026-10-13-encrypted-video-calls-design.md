# Encrypted video calls design

2026-10-13. For `feat/livekit-video`, branched from `main`. Part 1 of 2: part 2, encrypting the patient information already stored, is designed next. `PRODUCT.md` holds the product decisions and `CLAUDE.md` ("Doctor portal") the working rules; this is the design behind them.

## Why

A GP and a patient need a private video consultation. The first attempt framed doxy.me's own pages in the portal (`feat/doxy-video`, unmerged). Its live check on 2026-10-13 showed what a third-party page cannot do:

- The user did not want another company's page inside the product.
- doxy.me has no API. Nothing could create a room per consultation, close it, or tell the site that a call happened.
- There is no "video only" mode, and our styles cannot reach into another site's frame.
- doxy.me's media runs on Vonage's servers, which can decrypt it.
- In Safari, the framed sign-in and check-in depend on third-party storage.

Security decides this choice: DrQuick has to be regulated by UK bodies, so every video and every piece of patient information must be encrypted.

## Decisions

Made by the user on 2026-10-13.

| Question | Decision |
|---|---|
| Provider | **LiveKit Cloud with end-to-end encryption (E2EE).** |
| Call shape | Many separate one-to-one calls at once: one GP, one patient, one room. No calls with three or more people. |
| Encryption key | One random key per consultation, made by our server, stored sealed, handed only to that GP and that patient, and deleted when the consultation ends. |
| Patient side | Only the patient prototype, and only in development. The real patient join comes with the real patient flow. |
| Audit trail | Record every pass we issue, and LiveKit's signed join and leave notices: role and time only. |
| Branch | Fresh from `main`. `feat/doxy-video` stays unmerged, as a reference. |
| Order | Part 1 (this design) first, then part 2: patient information at rest, plus VPS disk and backup encryption. |

**Why LiveKit, from research on 2026-10-13:**
- **Amazon Chime SDK:** AWS decrypts media on its servers to mix audio, and there is no E2EE.
- **Daily and Whereby:** E2EE only peer-to-peer, and their own signalling servers could swap keys.
- **Vonage:** E2EE costs $550 a month and does not support Firefox.
- **LiveKit:** encrypts every frame through its servers with a key it never sees ("does not (and cannot) store or transport" keys). It costs nothing extra on any plan and works in Chrome, Firefox and Safari, including iOS 15.4+.
- **Plans:**
  - Build: free, 100 concurrent connections, so 50 calls at once.
  - Ship: $50 a month, 1,000 connections, so 500 calls at once.
- **It is open source**, so moving to self-hosted servers in the UK later needs no rewrite.

## How a call works

1. **Open.** The GP accepts an offer and the consultation goes `in_progress`. The first time either side asks for a pass, `openCall` creates a `consultation_calls` row for it:
   - a random room name of 128 bits (base64url), which means nothing outside our database;
   - a fresh 256-bit key, sealed (see Security).

   It is idempotent: a second request gets the same room and key. It is not done inside `acceptOffer`, which stays one guarded database statement with no network call.
2. **Pass.** A browser asks our server for a pass. The server checks who is asking:
   - for a GP, the signed-in doctor holds this `in_progress` consultation;
   - for a patient, this is development, and the consultation is the live one.

   It returns the LiveKit URL, a signed LiveKit token (the pass) and the key, and writes a `pass_issued` event. The pass is valid for one room, for 10 minutes, and grants camera and microphone publishing and subscribing. It grants no data channel, no admin and no recording. The room is created with at most two participants and closes 5 minutes after it empties.
3. **Join.** The browser checks that it can do E2EE, gives the key to LiveKit's key provider, turns encryption on, and only then connects. Every audio and video frame is encrypted on the device before it leaves. LiveKit's servers and TURN relays carry only ciphertext. Identities are `gp` and `patient`, so a second connection with the same role replaces the first.
4. **End.** `completeConsultation` and `markNoShow` both run `end()` in `lib/doctor/shift.ts`. After the status changes, `closeCall`:
   - deletes the sealed key;
   - sets `closed_at`;
   - asks LiveKit to delete the room, which disconnects both people. This is best-effort: a failure is logged to `app_errors` and the key is still gone.

   No pass is issued for a closed or ended consultation.
5. **Sweep.** Each `/doctor/pulse` also runs one guarded UPDATE that deletes the key of any call whose consultation is no longer `in_progress`. A key never outlives its consultation by more than one poll, even if `closeCall` was interrupted.

**What LiveKit sees:**
- the room name, which is random;
- the roles `gp` and `patient`;
- IP addresses, timings and the size of the encrypted packets.

It never sees names, emails, the reason, or any audio or video it can decode.

**What is never stored, by us or LiveKit:** video, audio, chat, recordings and transcripts. "This call is not recorded." holds by design, for three reasons:
- LiveKit only ever holds ciphertext;
- our passes never grant recording;
- we run no egress.

## Data model

Migration `0005_consultation_calls`. Conventions as elsewhere: text enums, `timestamptz`, uuid ids, no foreign keys. Every time is the application's clock, passed in.

**`consultation_calls`**, one row per consultation that has had a call:
- `consultation_id` uuid, primary key.
- `room` text, unique: the random LiveKit room name.
- `sealed_key` text, null once the call has closed: the sealed E2EE key.
- `opened_at` timestamptz, not null.
- `closed_at` timestamptz, null while open.

**`call_events`**, the audit trail:
- `id` uuid, primary key.
- `consultation_id` uuid, indexed.
- `role` text: `gp` or `patient`.
- `kind` text: `pass_issued`, `joined` or `left`.
- `at` timestamptz.

No content and no identity beyond the role. The consultation already records which GP. Part 2 decides whether these rows are sealed as well; they hold no patient information.

`erasePerson` (`lib/waitlist.ts`) keeps a consultation's financial record. Its calls and events go with the consultation when one is ever deleted. None are deleted today.

## Modules

| Module | Does | Depends on |
|---|---|---|
| `lib/crypto/sealed.ts` | `seal(bytes, purpose)` and `open(sealed, purpose)`: AES-256-GCM with a random 96-bit IV. The key is derived with HKDF-SHA256 from `CALL_KEY_SECRET` plus a purpose label (`dq/call-key/v1`), so part 2 can seal other data under other labels. The format is `v1.<iv>.<ciphertext>.<tag>`, base64url. `open` throws on any tampering, a wrong secret or a wrong label. | `node:crypto` only |
| `lib/video/livekit.ts` | The only module that knows LiveKit: `videoConfig()` (null unless all three variables are set), `mintPass({ room, role })`, `closeRoom(room)` and `readWebhook(body, authorization)`. | `livekit-server-sdk` |
| `lib/video/calls.ts` | The call lifecycle in our database: `openCall`, `gpPass(db, gpId)`, `devPatientPass(db)`, `closeCall(db, consultationId)`, `sweepKeys(db)` and `recordEvent`. Every write is one guarded statement, as in `lib/doctor/shift.ts`. | `sealed`, `livekit`, the schema |
| `app/doctor/call/route.ts` | `POST /doctor/call`: the GP's pass. A route handler like `/doctor/pulse`, so a slow request never queues behind Accept. It answers 401 rather than redirecting, sends `Cache-Control: no-store`, and never takes an id from the browser. | `requireDoctor`'s session check, `calls` |
| `app/dev/doctor/route.ts` | Adds `?do=patient-call`: the patient's pass for the live consultation. Development only, a 404 in a production build, like the rest of `/dev/doctor`. | `calls` |
| `app/api/webhooks/livekit/route.ts` | Verifies LiveKit's signed webhook, maps the room to a consultation, and records `joined` and `left` for `gp` and `patient`. It ignores any other room or identity, answers 401 to a bad signature and 501 when video is not configured. | `livekit`, `calls` |
| `components/call/useEncryptedCall.ts` | Client hook over `livekit-client`. It checks `isE2EESupported()`, sets the key on an `ExternalE2EEKeyProvider`, turns E2EE on, then connects and publishes the camera and microphone. States: `connecting`, `waiting`, `connected`, `reconnecting`, `peer-left`, `ended`, `failed` (with a reason) and `unsupported`. Toggles: mute and camera. | `livekit-client` |
| `components/call/CallView.tsx` | Presentational: the other person's video large, your own small, controls, the status line, and "Encrypted end to end · Not recorded". Built from shadcn components and lucide icons at `strokeWidth={2}`. | the hook's state |
| `components/doctor/CallPanel.tsx` | Mounted in the portal layout, shown during a consultation on every portal page, hidden rather than unmounted, as the shift requires. "Start video" fetches `/doctor/call` and renders `CallView`. It disconnects when the shift leaves `consultation`. Also has Full screen and Leave video. | `useShift`, `CallView` |
| Patient `VideoFrame` | In development with video configured, "Join video" fetches the patient pass and renders `CallView` in the frame, as tall as the screen allows, with End call always in view. Otherwise the placeholder, unchanged. | `CallView` |

Packages: `livekit-client` (browser) and `livekit-server-sdk` (server), both pinned to exact versions at install.

## What the GP and the patient see

**GP:**
- There is no video while the GP waits for a patient, and nothing to sign in to.
- On accept, the consultation card gains the call panel with a **Start video** button. The browser asks for the camera and microphone on that click.
- Once joined:
  - the patient's video is large, with the GP's own in the corner;
  - the buttons are **Mute**, **Camera off**, **Full screen** and **Leave video** (they can rejoin);
  - the status line reads *Waiting for the patient…*, *Connected*, *Reconnecting…* or *The patient left*;
  - a lock icon and *Encrypted end to end · Not recorded* sit beside the video.
- The panel survives the GP opening Earnings or Profile.
- **Complete consultation** and **Patient did not arrive** end the call for both.

**Patient prototype (development):**
- The GP's video is large and the patient's own small.
- **Mute** and **Camera** sit beside the docked **End call**.
- The screen keeps "This call is not recorded." and adds *Encrypted end to end*.
- Before the GP connects, it shows *Your GP will join shortly*.

**When something goes wrong.** Each case says what to do, and none falls back to an unencrypted call:
- the camera or microphone is blocked;
- the browser cannot encrypt: *This browser can't make an encrypted call. Update to the latest Safari or Chrome.*;
- the video service is unreachable or not configured;
- the connection dropped and is coming back.

## Security and UK regulation

**Controls:**
1. **End-to-end encryption.** LiveKit's frame encryption, with our per-consultation 256-bit key. The call fails closed: no E2EE support means no call.
2. **Keys at rest.**
   - Keys are sealed with AES-256-GCM under `CALL_KEY_SECRET`, which lives only in the server environment. A copied database yields no key.
   - A key is deleted at the end of its consultation, with the pulse sweep as the backstop.
   - Keys are never logged and never sent to LiveKit.
3. **Access.** A GP pass needs the doctor's session, checked by `requireDoctor` against the `gps` row on every request, plus an `in_progress` consultation held by that doctor. Patient passes exist only in development.
4. **Least privilege.** One room, 10 minutes, camera and microphone only, at most two participants. No data channel, admin or recording grants.
5. **Minimisation.** Random room names, roles instead of identities, nothing about the patient.
6. **Audit trail.** `call_events` records every pass issued, plus signed joins and leaves.
7. **Transport.** HTTPS with HSTS, as today. WebRTC adds DTLS-SRTP beneath the E2EE layer, and TURN runs over TLS on 443 for locked-down networks.
8. **Headers.**
   - `/doctor/:path*` keeps the admin CSP and `X-Frame-Options: DENY`.
   - `connect-src` admits exactly the LiveKit project's origin (`wss://` and `https://`, derived from `LIVEKIT_URL` when the config loads).
   - `Permissions-Policy` sets `camera=(self)`, `microphone=(self)` and `fullscreen=(self)`.
   - `/patient/:path*` gets the same only in development.
   - There are no third-party frames anywhere.
   - If the E2EE worker needs `worker-src blob:`, the implementation adds exactly that and records why.
9. **Secrets.** `LIVEKIT_API_SECRET` and `CALL_KEY_SECRET` live only in the environment. The admin's Technical page (`lib/admin/queries/system.ts`) shows whether each is set, never its value.

**What this gives UK regulators:**
- **UK GDPR and the ICO:**
  - Art 32, security of processing: encryption, pseudonymous roles and minimisation.
  - Art 28: LiveKit is a named processor under its DPA, which includes the UK Addendum and the DPF UK Extension.
- **CQC Regulation 17, good governance:** controlled access to consultations, an audit trail of every call, and no recordings.
- **NHS DSPT:** encryption in transit and at rest for call data, access logging, and supplier assurance. LiveKit holds SOC 2 Type II; its ISO 27001 is "in progress". **Log that as a supplier risk.**

**Not done by this build: each needs a person, and is recorded in `PRODUCT.md`:**
- **A DPIA** (UK GDPR Art 35), mandatory for health data with new technology.
- **Sign LiveKit's DPA.** Create the project in the **EU data region**. Record the transfer basis for metadata such as IP addresses, which LiveKit (a US company) processes.
- **Legal review of the privacy notice's LiveKit paragraph**, which this build drafts in brackets.
- **A penetration test** before a real patient joins a call.
- **Cyber Essentials** for the organisation.
- **Part 2:** sealing the patient fields already stored, and VPS disk and backup encryption.

## Configuration

| Variable | Use |
|---|---|
| `LIVEKIT_URL` | The project's `wss://…livekit.cloud` URL. Its origin also goes into the CSP. |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Sign passes and verify webhooks. Server only. |
| `CALL_KEY_SECRET` | At least 32 random bytes, base64. Seals the call keys. Never the admin or doctor session secret. |

With any of these missing, video is off:
- the call panel says *Video calls are not set up on this server*;
- `/doctor/call` answers 501;
- the GP can still complete or mark a no-show by hand.

**LiveKit setup, by a person:**
1. Create a LiveKit Cloud account. Build, the free plan, is enough for development.
2. Create a project and choose the **EU** data region.
3. Make an API key.
4. Add the webhook URL `https://<site>/api/webhooks/livekit` once deployed.
5. Do not enable egress or recording; the build never uses them.

## Testing

**Unit tests (vitest), written first:**
- **`sealed`:** round trip; tampering, a wrong secret and a wrong purpose are all rejected; every seal gets a fresh IV.
- **`livekit`:** a decoded pass carries exactly the room, identity, expiry and grants, with no recording or admin grant; webhook verification accepts a good signature and rejects a bad one.
- **`calls`, on PGlite:**
  - only the holding doctor gets a pass; another doctor, an offer or a closed consultation do not;
  - `openCall` is idempotent;
  - `closeCall` deletes the key and stops new passes;
  - the sweep deletes stale keys;
  - every pass writes `pass_issued`.
- **`shift`:** Complete and Did not arrive close the call.
- **Webhook route:** maps the room to a consultation, ignores strangers, answers 401 to a bad signature.
- **`useEncryptedCall` and `CallView`, against a mocked `livekit-client`:**
  - E2EE is on before connect;
  - `unsupported` never connects;
  - the states and the toggles behave.
- **Headers:** `/doctor` allows the camera and microphone and admits only the LiveKit origin. Production `/patient` is unchanged, and the dev `/patient` rule matches `/doctor`'s.
- **Patient screens:** with video configured in development, "Join video" renders the call; otherwise the placeholder.

**Live check** (Chrome for Testing, two profiles, fake devices, a LiveKit project):
- A GP and a patient join, and DevTools confirms `room.isE2EEEnabled` and an encrypted track on both sides.
- The call survives portal navigation.
- Complete disconnects both.
- **Three GP–patient pairs at once** stay isolated, each in its own room with its own key.

**On a deployed HTTPS server:** iPhone Safari (its camera needs HTTPS), and the webhook end to end.

**Local data:** a PGlite directory used on `feat/doxy-video` already holds that branch's `0005`. Delete `.data/pglite` before running this branch's migrations.

## Docs

- **`docs/video-calls.md`:** how it works, the setup, the live check, and the regulatory to-dos.
- **`CLAUDE.md`, Doctor portal:** the video bullet, the new variables, and a "Before a doctor sees a patient" line in Before deploy.
- **`PRODUCT.md`:** the provider decision and why, plus the open items above.
- **`.env.example`:** the four variables, with comments.
- **`app/(site)/privacy/content.ts`:** a bracketed draft paragraph naming LiveKit as the processor for video calls, for legal review.

## Not in this build

- A real patient joining. That comes with the patient flow, which will call `openCall` and issue the patient's pass the way the dev route does.
- Calls with three or more people.
- Chat and screen sharing.
- Recording. Never.
- Automatically marking a no-show from the webhook events. The data is there; the rule is a product decision.
- Part 2: encrypting the patient information already stored.
