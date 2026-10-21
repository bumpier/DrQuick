# Encrypted video calls design

2026-10-13. For `feat/livekit-video`, branched from `main`. Part 1 of 2: part 2, encrypting the patient information already stored (with disk and backup encryption), comes next. `PRODUCT.md` holds the product decisions and `CLAUDE.md` ("Doctor portal") the working rules; this is the design behind them.

**Revised the same day after a security review** of LiveKit's own code (`livekit-client` 2.22.4 `src/e2ee`, the LiveKit server and `livekit-server-sdk`) and of LiveKit Cloud's contract. Patient security is the first requirement: DrQuick has to be regulated in the UK (UK GDPR and the ICO, CQC Regulation 17, the NHS DSPT). Where a choice trades convenience for security, this design takes security.

## Why

A GP and a patient need a private video consultation, and many must run at once. The first attempt framed doxy.me's pages in the portal (`feat/doxy-video`, unmerged). Its live check showed what a third-party page cannot do:

- The user did not want another company's page inside the product.
- doxy.me has no API: nothing could create a room per consultation, close it, or tell the site that a call happened.
- doxy.me has no "video only" mode, and our styles cannot reach into another site's frame.
- Its media runs on Vonage's servers, which can decrypt it.
- In Safari, the framed sign-in and check-in depend on third-party storage.

## Decisions

Made by the user on 2026-10-13.

| Question | Decision |
|---|---|
| Video technology | **LiveKit with end-to-end encryption (E2EE)**, behind our own call screen. |
| Where real calls run | **Our own LiveKit servers in AWS London (eu-west-2).** Not LiveKit Cloud: see "Why not LiveKit Cloud". |
| Development and testing | LiveKit Cloud's free plan, with staff and made-up patients only. Same code; only `LIVEKIT_URL` changes. |
| Call shape | Many separate one-to-one calls at once. No calls with three or more people. |
| Keys | Random, per participant, per consultation, made by our server, sealed at rest, deleted when the consultation ends. |
| Patient side | Only the patient prototype, and only in development. The real patient join comes with the real patient flow. |
| Audit trail | Every pass issued, and LiveKit's signed join and leave notices: role and time only. |
| Resilience | DDoS resilience: AWS Shield Standard, minimal open ports, a WAF and rate limits, two availability zones, infrastructure as code. |
| Branch | Fresh from `main`. `feat/doxy-video` stays unmerged, as a reference. |
| Order | Part 1 (this design), then part 2. |

**Why LiveKit (research on 2026-10-13):**
- **Amazon Chime SDK:** AWS decrypts media on its servers to mix audio; there is no E2EE.
- **Daily and Whereby:** E2EE only peer-to-peer, and their own signalling servers could swap keys.
- **Vonage:** E2EE costs $550 a month and does not support Firefox.
- **LiveKit:** encrypts every frame through its server with keys it never holds. It works in Chrome, Firefox and Safari (iOS 15.4+), and it is open source, so we can run it ourselves.

**Why not LiveKit Cloud for real patients.** Its DPA (dated 10/06/2026) makes LiveKit an *independent controller* of call telemetry: each participant's IP address, device, browser, rough location, ISP, identity and room name. It keeps that for 60 days, can use it for its own purposes, and processes it through US sub-processors. Its breach notice is 72 hours, which is our entire ICO window. Run on AWS, LiveKit is software, and AWS is a processor only: NHS DSPT 2025-26 "Standards Exceeded", Cyber Essentials Plus, and a UK GDPR addendum (IDTA) that applies automatically.

## How a call works

1. **Open.** The GP accepts an offer and the consultation goes `in_progress`. The first time a pass is asked for, `openCall` creates the consultation's `consultation_calls` row, idempotently:
   - a random room name (128 bits);
   - two random participant identities (128 bits each), one for the GP and one for the patient;
   - two 256-bit keys, one per participant, each sealed (see Keys).

   It is not done inside `acceptOffer`, which stays one guarded database statement with no network call.
2. **Room.** Before any pass, our server creates the LiveKit room itself (`ensureRoom`: `maxParticipants: 2`, `emptyTimeout: 120`, `departureTimeout: 20`). Room limits apply only to a room the server created; production servers also refuse to create rooms on join (`auto_create: false`). After `ensureRoom` the server re-checks that the call is still open. If it closed meanwhile, it deletes the room again and answers 409.
3. **Pass.** The server checks who is asking:
   - a GP must hold this `in_progress` consultation;
   - in development, the patient pass is for the live consultation.

   It returns `{ url, token, identity, peerIdentity, ownKey, peerKey }` and records `pass_issued`. The token:
   - is valid for **120 seconds**;
   - grants exactly `roomJoin` for that one room, `canPublish`, `canSubscribe`, `canPublishData: false` and `canPublishSources: [camera, microphone]`;
   - grants no create, admin, recording, listing or metadata rights;
   - carries no name, metadata or attributes.
4. **Join.** The browser checks `isE2EESupported()` **before** it asks for a pass, so keys never reach a browser that cannot encrypt. It then:
   1. builds a fresh encryption worker;
   2. sets `ownKey` for its own identity and `peerKey` for the other identity, as raw 256-bit bytes, with per-participant keys (`sharedKey: false`) and no ratcheting;
   3. turns encryption on;
   4. connects with the `encryption:` room option.

   Every audio and video frame is encrypted on the device before it leaves. LiveKit's server and TURN relays carry only ciphertext. Video uses VP9, falling back to VP8; never AV1, which breaks E2EE. There is no data channel, no RPC, no chat and no screen share.
5. **What is shown.** The browser trusts nothing the server says about encryption:
   - It plays a remote track only if it comes from `peerIdentity`, is a camera or microphone, and its publication is marked encrypted.
   - Any unencrypted track or unexpected participant detaches everything, disconnects, and fails the call (`not_encrypted`, `unexpected_participant`).
   - Encryption errors show *Checking encryption…*; after 10 seconds the call fails.
   - "Encrypted end to end" shows only while all of these hold: encryption is on, every publication is encrypted, decoded frames are arriving (or the other camera is off and audio is arriving), and there has been no encryption error for 10 seconds.
   - A duplicate identity, meaning the call was opened somewhere else, fails the call and says so.
6. **End.** `completeConsultation` and `markNoShow` run `end()` in `lib/doctor/shift.ts`. It becomes one guarded statement that ends the consultation, sets the call's `closed_at`, clears both keys and returns the room. The action then deletes the LiveKit room in `after()`, which disconnects both people. A connected browser already holds the keys, so **deleting the room is what cuts the media**. The delete is retried until confirmed, by the delete succeeding or by the `room_finished` webhook. Five failures write `close_failed` to `app_errors`. A database CHECK enforces that a closed call holds no key.
7. **Sweep.** Each `/doctor/pulse` runs one guarded UPDATE that closes every call whose consultation is no longer `in_progress`. It then retries unconfirmed room deletes in `after()`, so the pulse never waits on LiveKit. It also prunes webhook de-duplication rows older than a day.

**What the media server still sees, even with E2EE** (for the DPIA):
- IP addresses, timings and packet sizes;
- the audio-level header, which shows who is speaking when;
- one header byte per Opus packet, and VP8 header bytes when VP8 is used;
- call length.

It never sees names, emails, reasons, or decodable audio or video.

**Never stored, by us or by the media server:** video, audio, chat, recordings, transcripts. "This call is not recorded." holds by design.

## Keys

- **Generation:** two 256-bit keys per call from `crypto.randomBytes`, one per participant. Each browser encrypts with its own key and decrypts the other's, so a malicious server cannot swap or reflect streams between people.
- **At rest:** each key is sealed by `lib/crypto/sealed.ts`:
  - AES-256-GCM with a random 96-bit IV;
  - the key derived by HKDF-SHA256 from `CALL_KEY_SECRET` with the label `dq/call-key/v1`;
  - associated data `consultation_id|role`, so a sealed key copied into another row or role fails to open;
  - the format `v1.<iv>.<ciphertext>.<tag>`, base64url.

  `open` throws a fixed error on any tampering, a wrong secret, label or associated data, truncation or a wrong version. `CALL_KEY_SECRET` must decode to at least 32 bytes and must differ from every other secret.
- **In flight:** keys reach a browser only in a pass response (`no-store`, HTTPS). They never go to LiveKit or into a URL, a log, an error message or `app_errors`.
- **In the browser:** passed as `ArrayBuffer`s; the worker is terminated and the buffers zeroed when the call ends. JavaScript cannot guarantee memory is wiped, so a strict CSP (below) is the real protection.
- **End of life:** cleared in the same statement that ends the consultation; the pulse sweep is the backstop.

## Data model

Migration `0005_consultation_calls`. Conventions as elsewhere: text enums, `timestamptz`, uuid ids, no foreign keys, the application's clock.

**`consultation_calls`**, one row per consultation that has had a call:
- `consultation_id` uuid, primary key.
- `room`, `gp_identity`, `patient_identity`: text, each unique.
- `sealed_gp_key`, `sealed_patient_key`: text, null once closed.
- `opened_at` not null; `closed_at`, `room_deleted_at` nullable; `close_attempts` integer, default 0.
- CHECK: `closed_at IS NULL OR (sealed_gp_key IS NULL AND sealed_patient_key IS NULL)`.
- A partial index on rooms that are closed but not yet confirmed deleted.

**`call_events`**, the audit trail:
- `id` uuid, primary key; `consultation_id`, indexed; `at`.
- `role`: `gp`, `patient` or `none`.
- `kind`: `pass_issued`, `joined`, `left`, `room_closed`, `close_failed`, `unknown_participant` or `unencrypted_track`.

**`livekit_events`**: `id` (the webhook event id, primary key) and `received_at`, for de-duplication.

No consultation is ever deleted today, so `erasePerson` needs no change.

## Modules

| Module | Does |
|---|---|
| `lib/role-script.ts` | The inline role script, moved out of `app/layout.tsx` so its hash can be computed for the CSP. |
| `lib/csp.ts` | `doctorCsp({ nonce, livekitOrigin, dev })` and `livekitOrigin(url)`, which accepts only a bare `wss://` origin. |
| `lib/crypto/sealed.ts` | `seal` and `open` (Keys above). `node:crypto` only. |
| `lib/video/livekit.ts` | The only module that knows LiveKit: `videoConfig()`, `mintPass()`, `ensureRoom()`, `closeRoom()`, `removeParticipant()`, `readWebhook()`. In production it refuses a `*.livekit.cloud` URL. |
| `lib/video/calls.ts` | The call lifecycle: `openCall`, `gpPass`, `devPatientPass`, `sweepCalls`, `retryRoomDeletes`, `applyWebhook`. Every write is one guarded statement. |
| `app/doctor/call/route.ts` | `POST /doctor/call`, the GP's pass. Follows `/doctor/pulse`: `currentDoctor()`, 403 for a cross-site request, 401 signed out, 503 without a database, `no-store`, takes no id from the browser. Rate limited (`rl:call-pass`, 6 per 5 minutes per doctor). Listed in `proxy.ts`'s `open` paths. |
| `app/dev/call/route.ts` | The patient's pass in development: 404 in production, refuses a non-loopback Host, runs `assertLocal()`, returns fixed error codes. |
| `app/api/webhooks/livekit/route.ts` | Raw body capped at 64 KB; verifies the signature and the body's hash; rejects `createdAt` more than 300 seconds old or 60 seconds in the future; de-duplicates by event id; rate limited (`rl:livekit-webhook`). Records joins and leaves by role. An unknown participant is removed and recorded as `unknown_participant`. An unencrypted track deletes the room and is recorded as `unencrypted_track`. Both raise an alert. |
| `components/call/keys.ts` | The per-participant key provider (`sharedKey: false`, 256-bit, no ratcheting). |
| `components/call/verify.ts` | `verifyEncryption(snapshot)`: the pure rule for what may be shown and when the badge may say "Encrypted end to end". |
| `components/call/useEncryptedCall.ts` | The browser side of a call: support check, worker, keys, connect, track filtering, states, cleanup. The only place a track is attached. |
| `components/call/CallView.tsx` | The call screen: the other person large, your own picture small, Mute, Camera, the status line and the verified badge. shadcn components; lucide icons at `strokeWidth={2}`. |
| `components/doctor/CallPanel.tsx` | In the portal layout. Shown during a consultation on every portal page, hidden rather than unmounted. "Start video" asks for the pass. Disconnects when the shift leaves `consultation`. Full screen and Leave video. |
| Patient `VideoFrame` | In development with video configured, "Join video" uses `CallView`, as tall as the screen allows with End call in view. Otherwise the placeholder, unchanged. |

Packages, pinned to exact versions: `livekit-client` 2.22.4 (browser) and `livekit-server-sdk` 2.19.1 or later (server; it fixes tokens without expiry being accepted).

## What the GP and the patient see

**GP:**
- There is no video while the GP waits, and nothing to sign in to.
- On accept, the consultation card gains the call panel with **Start video**, which asks for the camera and microphone.
- Once joined: the patient large, the GP small; **Mute**, **Camera off**, **Full screen**, **Leave video** (they can rejoin).
- The status line reads *Waiting for the patient…*, *Connected*, *Reconnecting…*, *Checking encryption…* or *The patient left*.
- The lock badge *Encrypted end to end · Not recorded* shows only when verified.
- The panel survives the GP opening Earnings or Profile. **Complete consultation** and **Patient did not arrive** end the call for both.

**Patient prototype (development):**
- The GP large, the patient small; **Mute** and **Camera** beside the docked **End call**.
- The screen keeps "This call is not recorded." and adds the verified badge.
- Before the GP connects it says *Your GP will join shortly*.

**When something goes wrong.** Each case says what to do, and none falls back to an unencrypted call:
- the camera or microphone is blocked;
- the browser cannot encrypt: *This browser can't make an encrypted call. Update to the latest Safari or Chrome.*;
- the call was opened somewhere else;
- encryption could not be confirmed;
- the video service is unreachable or not set up;
- the connection dropped and is coming back.

## Security and UK regulation

**Controls:**
1. **E2EE:** 256-bit per-participant keys; fails closed; the browser verifies encryption itself rather than trusting the server.
2. **Keys at rest:** sealed with AES-256-GCM, bound to their consultation and role, under a secret held only in the environment. Deleted when the consultation ends.
3. **Access:** a GP pass needs the doctor's session plus an `in_progress` consultation held by that doctor. Patient passes exist only in development.
4. **Least privilege:** one room, 120 seconds, camera and microphone only, two people at most. No data, admin, recording or metadata rights.
5. **Minimisation:** random room names and identities; nothing about the patient or the GP reaches the media server.
6. **Audit trail:** `call_events` records passes, joins, leaves, closes and alerts.
7. **CSP on `/doctor`** (and `/patient` in development), because a cross-site scripting bug would leak keys:
   - `proxy.ts` sets a per-request nonce: `script-src 'self' 'nonce-…' 'strict-dynamic' 'sha256-<role script>'` with **no `unsafe-inline` scripts**;
   - `connect-src 'self'` plus only the media server's origin;
   - `worker-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`;
   - `next.config.ts` stops sending its own CSP there, and adds `Permissions-Policy` (camera, microphone and fullscreen for self only) and `Cross-Origin-Opener-Policy: same-origin`;
   - Trusted Types starts report-only.
8. **Errors:** every video path returns a fixed error code. No error message, token or key reaches a response, `app_errors` or the console.
9. **Secrets:** `LIVEKIT_API_SECRET`, the webhook secret and `CALL_KEY_SECRET` live only in the environment. The admin's Technical page shows whether each is set, never its value.
10. **Transport:** HTTPS with HSTS; WebRTC's DTLS-SRTP beneath the E2EE layer; TURN over TLS on 443.

**What this gives UK regulators:**
- **UK GDPR and the ICO:**
  - Art 32, security of processing: encryption, pseudonymous identities, minimisation.
  - Art 28: AWS as a processor under its DPA.
- **CQC Regulation 17, good governance:** controlled access, an audit trail of every call, no recordings.
- **NHS DSPT:** encryption in transit and at rest for call data, access logging, an assured supplier (AWS), and UK-only hosting.

## Production infrastructure

A separate phase, in Terraform (`infra/livekit/`), in AWS eu-west-2:

- **Compute:**
  - two Graviton instances (c7g.xlarge to start, sized by load test, under 60% CPU at peak) in two availability zones, with Elastic IPs;
  - encrypted disks and IMDSv2;
  - no SSH and no port 22; access through SSM Session Manager, with sessions logged;
  - LiveKit pinned by image digest; secrets loaded from Secrets Manager into a mode-0600 file.
- **Redis:** ElastiCache across availability zones, with TLS and AUTH, reachable from the LiveKit nodes only.
- **`livekit.yaml`:**
  - `room`: `auto_create: false`, `max_participants: 2`, `empty_timeout: 120`, `departure_timeout: 20`, codecs `opus`, `vp8` and `vp9`;
  - TCP 7881, UDP 7882, `use_external_ip`;
  - TURN over TLS on 443;
  - a minting key and a separate webhook key;
  - `logging: warn`, as JSON;
  - limits on tracks and bandwidth;
  - Prometheus on the private network only.
- **Network:**
  - signalling through an ALB on 443 with an ACM certificate and a WAF rate rule;
  - ALB access logs off, and WAF logs with query strings redacted, because tokens travel in the WebSocket URL;
  - TURN/TLS through an NLB on 443;
  - security groups open nothing else;
  - the site accepts the webhook from the Elastic IPs only.
- **Protection:** Shield Standard, GuardDuty, CloudTrail, VPC Flow Logs (30 days), and CloudWatch alarms, including the `unencrypted_track` and `unknown_participant` alerts.
- **Operations:**
  - weekly SSM patching, one node at a time;
  - a monthly check of LiveKit releases and security advisories;
  - key rotation by adding the new key, deploying, then removing the old.
- **Load test** (`lk load-test`):
  - 50, 100 and 200 one-to-one rooms;
  - TURN only, with UDP blocked;
  - a node killed to test failover;
  - the WAF rule checked.

## Configuration

| Variable | Use |
|---|---|
| `LIVEKIT_URL` | The media server's `wss://` origin. Read at request time for the CSP. |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Sign passes and call the room API. Server only. |
| `LIVEKIT_WEBHOOK_API_KEY` / `LIVEKIT_WEBHOOK_API_SECRET` | Optional: a separate key for webhooks, so it can be rotated on its own. |
| `CALL_KEY_SECRET` | At least 32 random bytes, base64. Seals the call keys. Never reused from another secret. |

With any required variable missing, video is off:
- the call panel says *Video calls are not set up on this server*;
- `/doctor/call` answers 501;
- the GP can still complete or mark a no-show by hand.

## Testing

Test first, phase by phase. Each phase ends with a security gate.

- **CSP:** no `unsafe-inline` scripts on `/doctor`; a fresh nonce on every request; `connect-src` names only the media origin; a hostile `LIVEKIT_URL` is refused; the public and production `/patient` headers are unchanged.
- **`sealed`:** a seal round-trips; tampering, a wrong secret, label or associated data, truncation and a wrong version all fail; IVs are unique; error messages are fixed.
- **`livekit`:**
  - the decoded pass matches an exact allow-list of claims, with a 120-second TTL;
  - webhooks are rejected when the body is altered, the signature is bad, `createdAt` is stale or in the future, or the body is too large;
  - a Cloud URL is refused in production.
- **`calls`, on PGlite:**
  - only the holding doctor gets a pass, and every other state is refused;
  - `openCall` is idempotent and concurrency-safe;
  - keys are unique, and a key swapped between rows fails to open;
  - `end()` clears the keys and returns the room;
  - the race between `end()` and `ensureRoom` leaves no pass;
  - the sweep retries deletes;
  - a forced failure leaves no key or token anywhere.
- **Routes:** every status code (403, 401, 409, 429, 501, 503); a replayed webhook; a duplicate event id; an unknown identity; an unencrypted track; ids from the browser ignored; the dev route a 404 in production.
- **Browser core, against a mocked `livekit-client`:**
  - `encryption:` is used, never `e2ee:`;
  - keys are set as `ArrayBuffer`s before encryption is enabled, which happens before connecting;
  - an unsupported browser never fetches a pass;
  - **a plaintext track is never attached**;
  - an unexpected identity is refused, and a duplicate identity fails the call;
  - no data or RPC handlers are registered;
  - the codec is never AV1;
  - cleanup terminates the worker;
  - the badge truth table;
  - a source test that `attach(` is called in exactly one guarded function.
- **Bundles:** the landing page never loads `livekit-client`; browser code never imports `lib/crypto`, `lib/video` or the server SDK.
- **Live check, on LiveKit Cloud, no patients**, in two Chrome profiles:
  - encryption is on and every publication is encrypted;
  - no CSP violations;
  - three pairs at once stay isolated;
  - Complete disconnects both and the room is gone;
  - a second tab is detected;
  - an unencrypted publisher is refused.

**Local data:** delete `.data/pglite` before migrating; a directory used on `feat/doxy-video` holds that branch's `0005`.

## Before any real patient

This list needs people. It is recorded in `PRODUCT.md`.

- A DPIA covering the metadata list above, and recording that our own app server is the root of trust.
- The AWS DPA in place and the transfer basis recorded.
- A CREST penetration test covering the app, the LiveKit set-up and the E2EE code.
- NHS DSPT "Standards Met", Cyber Essentials Plus, CQC registration.
- The privacy notice finalised. This build drafts a bracketed paragraph.
- Part 2 done: patient data encrypted at rest, plus disk and backup encryption.
- Incident runbook (72-hour ICO notice) and key-rotation runbook rehearsed.
- Load and failover tests passed.
- No LiveKit Cloud credentials in production.
- A clinical safety case (DCB0129/0160) recommended.

## Risks

1. **Our app server is the root of trust.** It holds `CALL_KEY_SECRET` and the LiveKit keys. Its host is not yet named; part 2 considers moving it to AWS London.
2. **Keys in the browser cannot be fully wiped from memory.** The strict CSP, and having no third-party scripts, are the mitigation.
3. **The patient holds the GP's decryption key**, by design. There is no replay protection within a call.
4. **LiveKit Cloud may connect to region-specific hosts in development.** If the exact `connect-src` blocks them, allow `*.livekit.cloud` in development only.
5. **TURN over TLS across several nodes is unproven.** The fallback is one active node with a warm standby.
6. **VP9 with E2EE on Safari needs checking.** VP8 leaks a few header bytes.
7. **Trusted Types stays report-only** until the console is clean.
8. **Backups may capture the sealed keys of a call in progress.** Part 2 handles backups.

## Not in this build

- A real patient joining.
- Calls with three or more people.
- Chat and screen sharing.
- Recording, ever.
- Automatic no-show marking from webhook events.
- Part 2.

**For the user to decide later:** a maximum call length; whether a security alert should end the consultation itself; the patient sign-in model for the real patient flow.
