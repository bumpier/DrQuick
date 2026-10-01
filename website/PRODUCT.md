# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML/CSS/JS, single file, no build step and no dependencies — confirmed as the deliberate choice for now, not an accident.

**Confirmed decision (Aug 2026):** stay static through the pre-launch period, then migrate to a framework later. The migration has no trigger date or chosen framework yet. `Docs/Dr_Quick_Research_Report.md` §5 recommends Next.js for web and React Native + Expo for the native apps, but that is a research recommendation, not an accepted decision.

**Confirmed direction:** this codebase is eventually intended to become the product web app, not just a marketing site. Any framework decision made later must account for that, so it is made once rather than twice.

**Hosting constraint:** the waitlist endpoint is to be a serverless function on Vercel or Netlify (confirmed). Both serve static files alongside functions, so this is compatible with staying static — but it does mean the host is no longer a pure static file server, and the deploy target is effectively decided even though the framework is not.

## Users

Two audiences of **equal priority** on this surface (confirmed decision — the current implementation's patient-first, GP-in-the-footer weighting is not the intended end state):

- **Patients (England).** People who are unwell now and want to be seen fast without waiting for an NHS appointment or a booked private slot. YouGov: 52% of people who go private do so "to be seen quicker." They are buying *seen fast, cheap, prescription sorted* — not a matching algorithm.
- **GPs (UK, GMC-registered).** Underemployed, locum, and ARRS-displaced GPs. BMA survey of 1,000+ GPs: 15% can find no GP work at all, 56% want more NHS hours but cannot find them, 60% report falling pay rates, 69% report stress or anxiety tied to under- or unemployment. FTE GP job adverts in England fell 45% between Q1 2022/23 and Q2 2025/26 (919 → 504) even as newly-qualified GPs rose 49% (2015–2024).

Both audiences must get first-class, parallel entry points. Neither is a secondary afterthought.

**The page opens on GPs (the user's decision, 2026-10-01).** The GP sign-up is the main page: the site's address shows the GP mode, the GP mode comes first in the document, and the head describes it. Patients keep a full page of their own, one tap away on the switch and at `?role=patient`. Supply is the durable moat (below), and this puts the entry point where the moat is built.

## Product Purpose

Dr Quick is an on-demand, pay-per-consult, no-membership GP video consultation marketplace connecting patients to available GPs in real time — matched live rather than booked into a fixed future slot.

The venture sits at the intersection of two documented, opposing failures in English healthcare: patients cannot get timely GP access, while a large and growing share of qualified GPs cannot find enough work. DHSC has itself described inheriting "a ludicrous situation where patients can't get a GP, yet qualified GPs couldn't get a job."

**Current stage: pre-launch.** The only job of this website today is waitlist capture — patient and GP emails. No accounts, no health data, no tracking.

Success at this stage is validated demand and validated supply, not traffic. Per the research report, the two numbers that decide everything are **real CAC** (plan assumes £16) and **repeat consults per patient per year** (plan assumes 1.8). Every comparable pure-B2C UK telehealth player that died, died on CAC and unit economics — not on product.

## Positioning

**The wedge:** minutes instead of hours. tapGP charges £49 same-day "usually within a few hours"; DocTap £55–65; Bupa self-pay £59–79; Livi £60; eMed ~£45.

**Pricing is demand-based as of 2026-09-04** — the user's decision, reversing the research report's recommendation. The flat £39 undercut every synchronous incumbent above by £10–25; that price wedge has been deliberately given up. Speed is now the entire wedge, and at peak the price may sit above every competitor named here. The £30–45 the business plan modelled is now a band the price travels through rather than a point on it.

**The honest limits of that wedge, recorded so future work does not overstate it:**

- "Live Uber-style matching" is a supply-side mechanic, not a patient benefit. Patients do not buy the algorithm.
- The speed wedge is real but narrow and trivially copiable — DocTap or tapGP could add a queue.
- Even at its floor the price sits *above* the async layer (Boots from ~£15, Superdrug £0 consult fee) which already handles high-volume protocolisable cases, and above free Pharmacy First (3.3m consults last year) and free Livi-via-NHS for ~10m NHS patients. At peak it moves further above them, and the free alternatives do not surge.
- **Demand pricing raises the price exactly when the alternatives are worst** — a Sunday evening, a bank holiday, a flu wave. That is ordinary supply economics and it is the single most quotable thing about the model; "private GP app charges more when you are sickest" is the headline it invites. The ASA has already ruled time-pressure pricing in this category "socially irresponsible". Defensible, but it must be presented as a price shown up front and held, never as a reason to hurry.
- Demand is plateauing, not booming: self-pay private admissions grew 0.2% in 2025, NHS access is slowly improving, and ARRS now funds practices to hire the very GPs Dr Quick targets.

**The durable moat is supply depth (GPs actually online at 9pm) and compliance execution — not the matching algorithm.** Positioning claims should rest there.

## Operating Context

- **Market:** UK private-pay GP market ~£1.6bn; private consultations rose from 3% to 13% of all GP consultations over two decades. 139 tracked CQC providers; video GP price range £25–75.
- **Critical path is regulatory, not technical.** CQC registration is the longest lead item: ~3–6 months end to end, £1,522 application fee, DBS checks are the bottleneck. Requires a Registered Manager and a Nominated Individual; directors face the Fit and Proper Persons test. In CQC's first sweep of online providers, 86% initially failed "safe."
- **Regulatory geography — confirmed decision: England only at launch.** Scotland (HIS) and Wales (HIW) are separate regimes. No copy may imply UK-wide availability.
- **Supply economics:** the business plan assumed £24–33 per 15-minute consult ≈ £96–132/hour fully utilised, above the BMA locum floor. **Superseded on 2026-10-01 by a commission:** a GP keeps 60% of the consultation price, 70% after 100 completed consultations and 75% after 500 (see "GP sign-up fee and commission" below). Against the plan's £32 base price that is £19.20, £22.40 and £24.00 a consultation, so a new GP starts below the plan's band and reaches its floor only at the top tier or at higher prices. Whether that still clears the locum floor is a question for whoever sets the price floor. Private telehealth is **not** covered by CNSGP (NHS work only) — GPs need MDO cover at £1,500–4,000/yr each, which will kill casual supply unless Dr Quick buys block/corporate indemnity.
- **Realistic build cost:** £80–150k over 4–6 months with a senior 3–4 person team, plus £15–30k first-year compliance.

## Capabilities and Constraints

### What this site does today

**Pages (2026-09-25):** the landing page plus About, How it works, Pricing, Contact, and draft Privacy and Terms pages, and a blog written by named admins in an on-site Markdown editor. Blog posts must pass the same compliance rules as the site (`lib/compliance.ts`: no medicine names, no CQC claim beyond the approved wording, no price figures or ranges, no time pressure, no UK-wide claim, no named doctor); publishing is blocked on any breach. The Privacy and Terms drafts block launch until the legal entity exists and a lawyer has reviewed them. No page collects anything beyond the waitlist forms on the landing page.

The page runs as two modes behind a nav switch — a GP page, which it opens on, and a patient page. The two patient forms (hero, closing band) POST JSON to `/api/waitlist`: `{ "email": "...", "role": "patient", "source": "hero" | "recap" }`; email is the only field a patient ever types. A honeypot field and client-side validation are in place.

### GP sign-up fee and commission (the user's decisions, 2026-10-01)

- **The GP sign-up is a pop-up that ends in a payment.** The GP hero, the closing band and the nav each open one pop-up: four fields (name, email, mobile, GMC number), the fee, and one button to Stripe's hosted payment page. `POST /api/gp-signup` stores the application as unpaid and creates the Stripe Checkout Session; the Stripe webhook records the fee as paid and only then sends the confirmation email and the team alert. `/api/waitlist` refuses the GP role, so there is no way to sign up as a GP without paying.
- **The fee is £50, paid once** (`lib/gp-fee.ts`). It is stated beside every sign-up button before the click, in the pop-up above the pay button, in the FAQ and on Stripe's page.
- **It is refunded in full if the GMC registration cannot be verified or the GP is not taken on.** That sentence is a commitment made to doctors next to a payment button; it is written once (`GP_FEE_REFUND`) and never paraphrased. Refunds are made by the team in the Stripe Dashboard, and the admin shows them once the webhook reports them. Nothing refunds automatically.
- **Commission** (`lib/finance/commission.ts`): the GP keeps 60% of each consultation's price and Dr Quick 40%; after 100 completed consultations 70 / 30; after 500, 75 / 25, which is the top. The count is a GP's lifetime completed consultations, it never resets, and a tier applies to the consultations after its threshold, never back to earlier ones.

Not decided, and not to be decided in code: whether a GP who withdraws of their own accord gets the fee back (the withdraw page says only that withdrawing does not refund it by itself, and to get in touch first); whether the fee carries VAT; whether the commission is of the price before or after Stripe's own charges (the code takes it of the full price the patient pays).

### The doctor portal and ratings (the user's decisions, 2026-10-01)

- **An approved GP has a portal at `/doctor`.** They sign in, go online, take the consultation they are offered, see what they have earned and where each payout is, and edit their profile. There is no separate registration: a GP claims the account through a one-time link emailed to the address they signed up with, and it unlocks when the team marks their application Active.
- **A consultation is offered to one GP at a time.** The offer lasts 45 seconds; a decline or a timeout passes it to the next GP who is online, and never to the same GP twice. The oldest request goes first, to the GP who has been available longest. Price never moves a request up the queue. Before accepting, the GP sees the reason, the age band, whether the NHS record is shared, and what the consultation pays them, which is the figure they are then paid.
- **Earnings are read-only.** The portal shows what a GP has earned, what is awaiting a payout, what is on its way and what has been paid, and where they stand on the commission tiers. Payouts are still made by the team; the portal cannot request or move money.
- **Each GP has a rating out of five. This reverses the earlier "no ratings" rule.** A patient gives a completed consultation one to five stars, once, with no comment. The GP sees their average, how many patients rated them and the spread, and never which consultation a rating came from. A patient sees the rating of the GP they are matched with, still without a name or a face.

Nothing creates a consultation yet: the patient side is still a prototype. Until a real patient flow exists, a live server has no offers, no earnings and no ratings, and no rating may be shown that a real patient did not give.

Chosen as defaults while building, not by the user, and open to change: a patient sees a GP's rating only once five patients have rated them; a GP who lets an offer run out, or has just finished a consultation, is not offered another until they tap "Back online", and a GP who declines is; a request older than fifteen minutes is never offered; a GP's portal that goes silent for fifteen seconds loses its offer.

Not decided, and not to be decided in code: whether a no-show or a call that ends early pays the GP anything (today it pays nothing); what a GP may be told about a low rating, and whether a rating can ever be removed; and, when a GP who has taken consultations asks to be erased, how much of their record must be kept (today their name and GMC number stay with the financial records and everything else goes).

**Built (2026-08-27):** `/api/waitlist` is a Vercel serverless function with no npm dependencies, storing email, role, source and an ISO timestamp in Redis over the REST API. It does **not** retain IP addresses — the rate-limit key is a salted SHA-256 hash under a 600-second TTL and never enters the waitlist record. `/api/waitlist-export` returns CSV and `/api/waitlist-delete` executes an erasure request; both require a `WAITLIST_EXPORT_TOKEN` bearer token and refuse everything when it is unset.

**Blocking before this page collects a real address:** UK GDPR Article 13 requires the data controller's registered name and address and a working privacy contact at the point of collection. The legal entity is still undecided (below), so the page cannot state them. A `DEPLOY / LEGAL` comment marks where they go.

### Hard compliance constraints — future work must never violate these

These are not preferences. Several carry criminal or regulatory penalty.

- **Dynamic pricing is permitted; time-pressure presentation is not.** The user decided on 2026-09-04 to price on supply and demand, overriding the research report's recommendation of a single fixed price. What that decision does **not** override, because it is law rather than strategy: the price must be shown in full before the patient commits and must not move afterwards (since April 2025 the CMA can fine up to 10% of global turnover under the DMCC Act, and drip pricing is banned outright); price may never be framed as urgency (the ASA ruled time-pressure pricing in medical-service ads "socially irresponsible" — Menwell/Juniper, 2026); and price may never buy clinical priority over a more urgent patient. `Docs/Dr_Quick_Landing_Page_info.pdf`'s "£82 Priority · busier than usual" breaks all three and remains superseded: the model was reinstated, its presentation was not.
- **All-inclusive headline price.** No add-ons layered on top of an advertised price (no £9 fit-note surcharges).
- **Never claim CQC registration before it exists.** Current permitted wording is "CQC-registered clinical service at launch." Never use "operating under a CQC-registered clinical partner" — CQC registration attaches to the legal entity carrying on the regulated activity, and a platform that recruits GPs, runs triage, sets prices and fronts the brand must register itself. Precedent: Pharmacorp Ltd t/a Medicine Direct was criminally prosecuted for running an unregistered online doctor service.
- **Never name medicines or imply a consultation guarantees a prescription.** Advertising prescription-only medicines to the public is a criminal offence (Human Medicines Regulations 2012 + CAP 12.12). There is an active ASA/MHRA/GPhC enforcement wave hitting this category. "See a GP in minutes" is permitted; naming drugs is not.
- **Keep the emergency disclaimer.** 999/A&E, visible.
- **Collect nothing beyond email on this page.** No symptoms, no health information. The moment intake collects symptoms, Dr Quick is a data controller of Article 9 special-category health data.
- **Storyset attribution link is required by licence** whenever a Storyset asset is on a page. None ships since the 2026-09-25 rebrand; if one returns, the link returns with it.

### Product-level constraints inherited from regulation

Recorded because they constrain what the site may ever promise:

- Controlled drugs (Schedule 2/3) require wet-ink FP10PCD signatures and are to be prohibited platform-wide.
- Questionnaire-only prescribing is dead for weight-loss drugs, medicines liable to misuse, and long-term-condition medicines needing monitoring (Feb 2025 GPhC guidance).
- MVP intake must stay a structured questionnaire with human red-flag rules for booking logistics only. Algorithmic urgency scoring shown to the patient would make it software as a medical device under MHRA guidance.
- Patient data cannot be held solely by the doctor. Reg 17(2)(c) requires the registered provider to maintain records; retention is patient lifetime + 10 years.

### Explicitly undecided

- **Waitlist retention period.** The page currently promises deletion "until launch and for no more than twelve months after that". That figure was chosen as a defensible default, not by the user, and should be confirmed or changed before launch — the page is making the promise either way.

- Framework and migration timing for the eventual product web app.
- Legal entity, Registered Manager, Nominated Individual, and medical director / Clinical Safety Officer appointments — status unknown to this repo.
- The floor, the ceiling and the maximum multiplier for demand-based pricing. The flat £39 is settled as gone (2026-09-04); what replaces it is not specified anywhere — the business plan modelled £30–45, and nothing has decided whether peak may exceed it. Until those three numbers exist, no surface can quote a range honestly.
- ~~What a GP is paid under demand pricing, and whether it tracks the patient price.~~ **Decided 2026-10-01:** a share of the patient price, in three tiers (above). What stays open is the list at the end of "GP sign-up fee and commission".
- Native iOS/Android apps are anticipated (research recommends React Native + Expo) but are **not** part of this repository.

## Brand Commitments

- **Name:** Dr Quick. Wordmark renders as "DrQuick".
- **Voice, as evidenced by the shipped page:** short, plain, declarative. No eyebrow labels, no section labels, no fine print beyond what compliance requires. "Keep it simple, stupid" is stated design law in `CLAUDE.md`.
- **Visual direction: Lime & Forest (decided 2026-09-25, by the user).** The user asked for a complete redesign away from the clinical look: modern, green, HelloFresh-like, bento boxes; "not clinical, not NHS"; meant to inspire, create trust and look new. From four options they chose **Lime & Forest** (Wise / Cash App energy), Plus Jakarta Sans throughout, the redesign reaching every surface, and photography for imagery. This **reverses** the earlier standing preference for the category canon played straight with Uber as the craft bar (2026-08-27) and the TechMed Modern palette (2026-09-02); neither is to be restored by later work. Future visual work executes Lime & Forest at full fidelity.
- **Palette:** a faint green off-white ground, forest `#163300` for text and dark fills, lime `#9FE870` as the action fill (never a line on a light surface, where `primary-ink` `#2F6B0F` takes over), and lime-wash, stone and sage bento tones. NHS Blue and NHS Green, and their neighbours, remain excluded so a private provider never reads as NHS-branded. Earlier systems, in order: navy/amber/paper, true black / `#1447E6`, TechMed Modern.
- **Warmth never outruns honesty.** The friendlier look adds no claims: no invented statistics, testimonials, GP faces or counts, and photographs must never pass for real Dr Quick GPs (`docs/photo-brief.md`).
- **Binding visual law lives in `CLAUDE.md` and `DESIGN.md`** (palette, type, bento layout, the equal-billing hero, imagery rules). Recorded here by reference as binding; not restated or expanded in this file.

## Evidence on Hand

Real, in-repo:

- `Docs/Dr_Quick_Research_Report.md` — sourced August 2026 regulatory, market, architecture and build research. The authoritative document; `CLAUDE.md` requires reading it before big changes.
- `Docs/Dr_Quick_Business_Plan.pdf` — executive summary, problem, solution, marketplace model, financial forecast (revenue £2.46m Year 1 → £21.6m Year 3, EBITDA breakeven Year 2, 17.6% margin Year 3). **These forecasts are unvalidated projections and must never be presented as achieved results.**
- `Docs/Dr_Quick_Landing_Page_info.pdf` — a **superseded** earlier landing-page concept, retained as an anti-reference for its *presentation*. Its demand-based pricing model was reinstated by the user on 2026-09-04; its "£82 Priority · busier than usual" framing — a live price quoted as scarcity, beside a purchasable queue position — was not, and remains banned in code by `tests/constraints.test.ts`.
- `assets/doctors-bro.svg`, `assets/doctor-online.svg` — retired Storyset illustrations (no longer on the site). Masters in `../Illustrations/`.

**Absences future work must not fabricate:**

- No customers, no patients, no consultations — the service has not launched.
- No testimonials, no case studies, no press coverage, no reviews. No invented rating: a GP's rating is the average of the stars real patients gave (see "The doctor portal and ratings"), there are none until the service has consultations, and no marketing page shows one.
- No CQC registration. No CQC rating. No registration number.
- No named GPs, no GP headcount, no "X doctors online" figure. The superseded concept showed "6 GPs seeing patients right now" — that number was illustrative and is not real.
- No app in any app store. No download links.
- No funding announcement, no investor names, no partnerships.
- Third-party pricing in this file was verified Aug 2026 and will go stale; re-verify before publishing any comparison.

## Product Principles

1. **Compliance is the product, not overhead.** CQC registration is the critical path and the moat. No claim may outrun the registration status that is actually true on the day it publishes.
2. **One price, shown in full, never moved after.** Fixed and transparent. Any mechanism that varies price by urgency, time, or demand is off the table permanently — commercially and legally.
3. **Collect the minimum, always.** Email only, pre-launch. Health data never touches a marketing surface. Data minimisation is a stated brand position, so it must be true.
4. **Both sides get first-class treatment.** Patients and GPs are equal audiences. Supply is the durable advantage; treating GPs as a footer afterthought undercuts the moat.
5. **Claim only the narrow, honest wedge.** Faster and cheaper than synchronous incumbents, in England, at a fixed price. Not "the future of healthcare," not clinical outcomes, not scale that does not exist yet.

## Accessibility & Inclusion

No formal conformance target has been confirmed yet — recorded as an open decision rather than assumed.

Product-derived needs that are already established:

- Primary patients are **people who are currently unwell**, often on a phone, often in a hurry, sometimes impaired by illness, pain, or anxiety. Low cognitive load and large, unambiguous targets are functional requirements, not polish.
- The emergency disclaimer must be reachable and legible for someone scanning in distress.
- The shipped page already uses `aria-live` status regions, labelled email inputs, and a visible `:focus-visible` outline. Future work must preserve at minimum this level.
