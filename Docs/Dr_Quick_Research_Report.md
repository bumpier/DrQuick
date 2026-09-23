# Dr Quick — How to Actually Build This
### Research report · August 2026

This report answers the question you asked ("how do we achieve this?") and corrects three assumptions in the current plan that will not survive contact with UK regulation. Everything is sourced; links are at the end of each section.

---

## 1. The blunt verdict first

The business idea is viable in a narrow form. The supply side is genuinely strong: GP underemployment is real (BMA: 15% of GPs can find no work, 56% want more hours), and £24–33 per 15-minute consult equals £96–132/hour fully utilised — above the BMA locum floor. GPs will sign up.

But three things you've stated need to change before anything gets built:

**1. "Patient data should be stored solely by the doctor" — this is legally impossible for you.** Dr Quick will almost certainly be the CQC-registered provider, and Regulation 17(2)(c) of the Health and Social Care Act regulations requires *the registered provider* to "maintain securely an accurate, complete and contemporaneous record in respect of each service user." Records must be retrievable for the patient's lifetime + 10 years after death. A self-employed locum who keeps records on their own laptop and then leaves, retires, or dies orphans those records — breaking subject access requests, complaints investigation, safeguarding, and every doctor's own medico-legal defence. Also: the moment your app collects symptoms at intake, *you* are a data controller of special-category health data under UK GDPR — before any doctor is even matched. There is no architecture in which the platform "never holds patient data." What you *can* do — and should — is data minimisation within a controlled system (Section 4).

**2. "Operating under a CQC-registered clinical partner" (per your landing page footer) is a red flag, not a shortcut.** CQC registration attaches to the legal entity carrying on the regulated activity. A platform that recruits the GPs, runs triage, sets prices, and fronts the brand is carrying on "Treatment of disease, disorder or injury" and must register itself. Precedent: Pharmacorp Ltd t/a Medicine Direct was criminally prosecuted for running an unregistered online doctor service (~£13,700 fine + costs). Dr Quick registers with CQC in its own name. Budget 3–6 months and start before writing code — it's the longest lead item.

**3. Surge pricing on sick people is your biggest self-inflicted risk.** There is no UK precedent for dynamic pricing in healthcare; the nearest analogue is the Oasis/Ticketmaster scandal, which ended in a CMA investigation and forced undertakings. Since April 2025 the CMA can directly fine up to 10% of global turnover for unfair commercial practices under the DMCC Act, drip pricing is banned, and the ASA has already ruled time-pressure pricing in medical-service ads "socially irresponsible" (Menwell/Juniper, 2026). Your landing page's "£82 Priority · busier than usual" is a Daily Mail headline waiting to be written ("app charges sick children more at night"). The survivable version: a fixed, transparent price with a capped, pre-disclosed "busy period" band and an off-peak *discount* framing — and honestly, at your volumes, dynamic pricing adds regulatory surface for near-zero revenue gain.

One more market truth: **"live Uber-style matching" is a supply-side mechanic, not a patient benefit.** YouGov: 52% of people who go private do it "to be seen quicker." Patients buy *seen fast, cheap, prescription sorted*. tapGP already delivers "same day, usually within a few hours" at £49. Your real wedge is "minutes instead of hours, £35–45 instead of £49–70" — real, but narrow, and trivially copiable by DocTap or tapGP adding a queue. The durable moat is supply (GPs online at 9pm) and compliance execution, not the matching algorithm.

---

## 2. The regulatory path (England)

### CQC registration — the long pole
- Regulated activity: **"Treatment of disease, disorder or injury"** (TDDI); add **"Transport services, triage and medical advice provided remotely"** if the platform itself does clinical triage.
- Application fee £1,522; realistic end-to-end **3–6 months** (DBS checks are the bottleneck). Annual fees from ~£509 + per-patient charges (~£3,300/yr at 5,000 patients).
- You need a **Registered Manager** (passes a CQC fit-person interview, CQC-countersigned DBS) and a **Nominated Individual**. Directors face the Fit and Proper Persons test.
- CQC runs a dedicated online-primary-care inspection programme. In its first sweep, **86% of online providers initially failed "safe"**. Their specific expectations for services like yours: identity verification at every consultation (a credit card is not ID), systems to detect multiple identities, **parental-responsibility checks for children** (Push Doctor was temporarily banned from treating children in 2017 over exactly this), Gillick competence for 16–17s, safeguarding policies written for online settings, and — critically — **if a patient has no NHS GP or refuses consent to share the consultation summary, the doctor should decline to prescribe** where they lack sufficient information. First inspection typically lands within ~3 months of registration.
- Scotland (HIS) and Wales (HIW) are separate regimes — launch England-only first.

### GMC remote prescribing — what your doctors can and can't do
- Governing text: GMC *Good practice in prescribing and managing medicines and devices* (updated Dec 2024). Doctors must have access to reliable patient information, seek consent to inform the patient's NHS GP of medicine changes, and switch to face-to-face when examination is needed.
- **High-risk medicines**: since Feb 2025 (GPhC guidance, mirrored by all regulators), questionnaire-only prescribing is dead for weight-loss drugs, medicines liable to misuse, and long-term-condition medicines needing monitoring — prescribers must independently verify via records access or contact with the patient's GP.
- **Controlled drugs**: Schedule 2/3 CDs still require wet-ink signatures on paper (FP10PCD) — they are effectively incompatible with a fully digital on-demand flow. Do what every competitor does: prohibit them platform-wide, in the clinical protocol and marketing.
- Push Doctor's 2017 CQC failure is your design checklist in reverse: unverified child identities, anticoagulants issued without blood tests, 137 prescriptions from their own "do not prescribe" list in 12 months. CQC will look for exactly these metrics in you.

### Prescription delivery
- Private prescriptions **cannot go through NHS EPS** — that's NHS-funded prescribing only. Use private e-prescription rails: **SignatureRx** (advanced e-signature, patient redeems at any UK pharmacy, pennies per script, REST API, pre-built Semble integration) or **CloudRx** (JSON API, own GPhC-registered pharmacy, delivery).

### Doctor verification stack (all of it, per doctor)
GMC register + licence to practise + GP Register (CCT) check · enhanced DBS with barred-list check (~£50) · right-to-work · indemnity certificate verified annually · revalidation status. Two traps: (a) the state-backed CNSGP indemnity **covers NHS work only** — private telehealth needs MDO cover at **£1,500–4,000/yr per GP**, which will kill casual supply unless Dr Quick buys block/corporate indemnity out of its ~45% take; (b) at scale you should become a **designated body with your own Responsible Officer** so your GPs can revalidate through you.

### Your triage feature may be a medical device
MHRA guidance: software that algorithmically ranks urgency or signposts "go to A&E vs see a GP" based on analysis of symptoms qualifies as **software as a medical device** (Class I, or IIa if it decisively informs diagnosis) — meaning UKCA marking, MHRA registration, a QMS, and post-market surveillance (new PMS regulations in force June 2025). Design decision for the MVP: keep the intake form a **structured questionnaire + human red-flag rules for booking logistics only** (no algorithmic urgency scoring shown to the patient) and you stay outside SaMD scope. Add algorithmic triage later, deliberately, with compliance budget.

### Advertising
Advertising prescription-only medicines to the public is a criminal offence (Human Medicines Regulations 2012 + CAP 12.12). You can advertise "see a GP in minutes"; you cannot name drugs, imply the consult ends in a prescription of a specific POM, or use urgency/countdown pricing pressure. There's an active ASA/MHRA/GPhC enforcement wave (2025–26) hitting exactly this category.

---

## 3. Market reality check

### What incumbents charge today (verified Aug 2026)

| Provider | Price | Speed |
|---|---|---|
| tapGP | £49 incl. prescription | Same day, "usually within a few hours" |
| DocTap | £55–65 (£49.50 with pass) | Same day |
| Bupa self-pay video | £59–79 | Often same/next day |
| Livi (pay-as-you-go) | £60 — free for ~10m NHS patients | Same day |
| eMed (ex-Babylon) | ~£45 | Same day |
| Medicspot | £29–75 | Same day |
| Boots Online Doctor (async) | from ~£15 incl. med | 2–24 hrs |
| Superdrug Online Doctor (async) | £0 consult fee, pay for meds | < 24 hrs |

Market range for video GP: £25–75 across 139 tracked CQC providers. Your £30–45 undercuts synchronous incumbents by £10–25, but sits *above* the async layer that already handles the high-volume protocolisable stuff (UTIs, skin, sexual health), and above free Pharmacy First (3.3m consults last year, expanding autumn 2026) and free Livi-via-NHS.

### The graveyard, and what it teaches
- **Babylon**: $4.2bn peak → Chapter 7 in Aug 2023. Losses of $221m in 2022. B2C revenue never covered clinician cost + customer acquisition.
- **Push Doctor**: ~£50m raised, £7.6m loss in its last year, sold in a rescue to Square Health, which is a B2B insurer-channel business.
- **GPDQ**: the original "Uber for GPs" (2016). Consumer product is gone; now sells B2B to ICBs and corporates.
- **eMed**: made ~150 GPs redundant in 2024, shifting to cheaper ANPs.

The pattern is uniform: every pure-B2C UK telehealth player died, was absorbed into insurer channels, or pivoted B2B. The survivors in pay-per-consult B2C (DocTap, tapGP) are small, lean, profitable clinics — not venture-scale outcomes. What killed the big ones was CAC and unit economics, not product. Your plan's £16 CAC and 1.8 repeat consults/patient/year assumptions are the two numbers that decide everything — validate them in a pilot before spending on anything else.

Also note: demand is plateauing, not booming. Self-pay private admissions grew just 0.2% in 2025; the GP Patient Survey shows NHS access slowly *improving*; the 2025/26 GP contract forces practices to keep online consultation tools open all day; and ARRS now funds practices to hire the very unemployed GPs you're targeting.

---

## 4. Data architecture — the corrected version of your instinct

Your instinct (minimal data, encrypted, no snooping) is right. Your proposed implementation (doctor holds everything, platform holds nothing) is wrong in law. Here's the version that is both compliant and genuinely privacy-maximising — this is essentially how Livi and Doxy.me do it:

**Three tiers, strictly separated:**

1. **Platform tier** (Dr Quick is data controller): account, ID-verification results, payment tokens (held by Stripe, not you), booking/matching metadata, audit logs. The intake symptom text is Article 9 health data — it goes straight into the clinical tier and is *never* copied into analytics or marketing stores.

2. **Clinical tier** (one provider-controlled record system, not per-doctor silos): the consultation record lives in a proper clinical system — **buy Semble, don't build** — under strict role-based access control: a clinician sees only patients they are matched to (role + legitimate-relationship, the NHS RBAC pattern), field-level encryption at rest, UK data residency (AWS eu-west-2), immutable audit logs, and audited break-glass for emergencies. Retention: lifetime + 10 years. This is what CQC will inspect.

3. **Video tier** (genuinely zero-retention — this part of your vision is fully achievable): WebRTC encrypted in transit; **no recording, ever, by design** — the clinical note is the legal record, not the video. Doxy.me built its entire brand on "we store no video, no audio, no chat" and it's true — but only because the clinician's record system holds the record. Same trick here.

**On "unqualified users must never access patient data":** as an absolute it's unworkable — complaints handling, safeguarding leads, and SAR administrators legitimately need scoped access. The lawful formulation (UK GDPR Art 9(3) / DPA 2018 s.11, Caldicott Principle 4) is *need-to-know RBAC under the responsibility of a professional bound by confidentiality*, with everything audited. Non-clinical staff see the minimum, never browse, and every access is logged and reviewable.

**Compliance checklist (all mandatory or effectively so):** ICO registration + fee · DPIA (mandatory — health data + novel tech + matching) · DPO (mandatory — large-scale special-category processing) · appropriate policy document under DPA 2018 Sch 1 · DSPT if you touch any NHS system (you will, the moment you send summaries to NHS GPs) · Cyber Essentials Plus · pen test pre-launch (~£4–6k) · DCB0129 clinical safety file + named Clinical Safety Officer (your medical director can double up; standards under revision, consultation closes 11 Sep 2026) · ISO 27001 in year 2.

---

## 5. Build recommendation

The engineering should be deliberately boring. This is tens of consults per hour, not Uber scale, and there's no geospatial problem — video is location-independent.

**Apps:** React Native + Expo + TypeScript (one codebase for iOS/Android — video SDK support and UK hiring both favour RN over Flutter), Next.js for web. App-store traps: Apple requires health apps to be submitted by the legal entity providing care (guideline 5.1.1(ix)); Google Play requires a verified org account with D-U-N-S number + Health Apps Declaration for medical apps since Jan 2026. Have your CQC certificate ready to attach to review notes.

**Backend:** one Node/TypeScript monolith on AWS London. Postgres as source of truth; the matching queue is a single Postgres transaction (`SELECT … FOR UPDATE SKIP LOCKED`) with a 45-second offer window per GP; Redis for doctor presence (30s heartbeat); WebSockets + high-priority push for "your GP is ready." ETA = queue position × rolling average consult length. No Kafka, no microservices, no Kubernetes, no ML matching. A single modest instance handles 100× your load.

**Video:** Daily.co (~$0.004/participant-min + $500/mo healthcare tier: no PHI stored, recording off, BAA/DPA) or Whereby Embedded (EU-based, NHS precedent). Video costs ~12p per consult — choose on compliance and SDK quality, not price. Don't build WebRTC infrastructure.

**Clinical records:** Semble (the default private-GP EHR in the UK, GraphQL API, CQC toolkit, ~£119–199/mo) with its built-in SignatureRx e-prescribing. GPs write notes in Semble; your app writes consultation metadata via API. Building your own EHR is a multi-year liability for zero differentiation.

**Payments & ID:** Stripe PaymentIntents with manual capture — authorise on request, capture on match, instant release on no-match (the ride-hail pattern; auths are valid 7 days). Stripe Connect Express for GP payouts. Stripe Identity (£1.25/check) for patient ID verification; Yoti + manual GMC checks for doctor onboarding.

**Do not build:** WebRTC stack · EHR · e-prescribing rails · Uber-grade dispatch · custom ID verification · NHS login integration (months of partner onboarding, not available to purely private MVPs) · video recording (creates consent/retention problems with zero MVP payoff).

**Money and time:** realistic MVP is **£80–150k over 4–6 months** with a senior 3–4 person team, plus **£15–30k first-year compliance** (CQC fees, CSO, pen test, indemnity, tooling). Your plan's £45k for "CQC + legal setup" is roughly right for registration alone but light once DCB0129, pen testing, block indemnity, and the DPO are counted.

---

## 6. Recommended sequence

1. **Now:** decide the legal entity, appoint Registered Manager + Nominated Individual + medical director (doubling as Clinical Safety Officer), and start CQC registration. Nothing else matters until this is moving — it's the critical path.
2. **In parallel:** direct outreach to 20–30 underemployed/ARRS GPs to validate the payout and get block-indemnity quotes (MDU/MPS corporate schemes) — indemnity economics can quietly kill the supply side.
3. **Kill surge pricing; keep live queuing.** Fixed transparent price (e.g. £39), capped pre-disclosed evening/weekend band, off-peak discount framing. All-inclusive headline price (DMCC drip-pricing ban — no £9 fit-note add-ons on top of an advertised price).
4. **Scope the MVP triage as a questionnaire, not an algorithm**, to stay outside MHRA medical-device scope at launch.
5. **Build the boring stack** (Section 5) against the three-tier data architecture (Section 4). London-only quiet pilot.
6. **Measure the two numbers that killed everyone else:** real CAC and repeat rate. If CAC lands nearer £50 than £16, pivot the same asset to B2B2C (employers/insurers) — the direction every survivor took — before the marketing budget is gone.

---

## Key sources

CQC: online primary care guidance, scope of registration, Additional guidance for online providers (cqc.org.uk) · Pharmacorp/Medicine Direct prosecution (cqc.org.uk news) · GMC: Good practice in prescribing; remote prescribing high-level principles (gmc-uk.org) · GPhC online pharmacy guidance Feb 2025 (pharmacyregulation.org) · MHRA symptom-checker SaMD guidance (gov.uk) · NHS Records Management Code of Practice; Reg 17 (legislation.gov.uk) · ICO controller/processor and special-category guidance (ico.org.uk) · NHS England: Identifying controllers and processors in health and care (digital.nhs.uk) · DMCC Act consumer powers Apr 2025 (CMA; cms.law; reedsmith.com) · ASA weight-loss POM enforcement notice Sep 2025 (asa.org.uk) · BMA GP underemployment campaign (bma.org.uk) · LaingBuisson private GP market report; PHIN market update Jun 2026 (phin.org.uk) · IHPN Going Private 2025 · Babylon collapse (TechCrunch, Fierce Healthcare) · Push Doctor (Pulse Today) · provider pricing pages: doctap.co.uk, tapgp.co.uk, livi.co.uk, bupa.co.uk, treatcompare.com · Daily.co, Vonage, LiveKit, Amazon Chime pricing pages · Semble (semble.io), SignatureRx, CloudRx · Stripe docs (manual capture, Identity) · Apple App Review 1.4/5.1.1; Google Play Health Apps policy.
