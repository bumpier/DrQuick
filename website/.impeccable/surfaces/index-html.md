---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

Scope: the single-page pre-launch landing page (index.html) and its waitlist API. Visitor mode: Persuade.

Audience and job: two audiences at equal billing. A patient in England who is unwell now and wants to know they can be seen fast and what it will cost; and a GMC-registered GP, often underemployed or locum, deciding whether this is worth their time. Neither is secondary — the previous page's footer treatment of GPs was the defect this replacement corrected.

Action: one action per audience, both email-only. Patient joins the waitlist (twice on the page: hero and closing band); GP registers interest. All POST to /api/waitlist with role patient|gp. Email is the only field, ever.

Proof and content available: no customers, no CQC registration, no testimonials, no GP headcount, no app. The only honest proof is the fixed £39, the GMC-registration of the doctors, and the plainness of the offer. The expectation-setting sections carry the rest: what a consultation covers and does not, and an FAQ that answers the trust questions without inventing facts. Where an answer is genuinely undecided (under-18s, real waiting times) the page says so rather than filling the gap.

Constraints specific to this surface: never show surge, dynamic or time-pressured pricing; never claim CQC registration before it exists ("CQC-registered clinical service at launch" is the permitted wording); never name a medicine or imply a guaranteed prescription — keep every prescription reference conditional; keep the 999/A&E disclaimer both as a band under the hero and in the footer; collect nothing but email; keep the Storyset attribution link (licence requirement); do not imply availability outside England.

Section order and why: nav (sticky, primary action and the Patients / GPs switch always reachable), then whichever mode is active. Patient: hero capture → 999 band → how it works → what it covers and doesn't → price → FAQ → closing capture. GP: hero capture → how a shift works → what Dr Quick does and doesn't → what you're paid → FAQ → closing capture. Footer is shared. Expectation-setting sits before price so the £39 is read against a known scope; the FAQ sits after price because most of its questions are prompted by it.

Chosen direction: the standing exit — the category canon, played straight, at a craft bar the user named as Uber. This was chosen over a rolled direction ("The Surgery Notice Board") and three challengers, so convention is the commitment here, not a fallback.

Memorable moment: the switch itself, and the dark pay band it leads to. Giving the supply side a whole page rather than one section is what makes the equal-billing decision legible rather than merely claimed, and the slate-900 fill lands on £24–33 — the fact a GP came to find out.

Unresolved: og:image and twitter:image carry a REPLACE-WITH-PRODUCTION-DOMAIN placeholder until a domain exists. Real photography is the recorded upgrade path over the recoloured Storyset illustration. Whether £39 is final. The accessibility conformance target. No canonical URL. assets/doctor-online.svg is unused.
