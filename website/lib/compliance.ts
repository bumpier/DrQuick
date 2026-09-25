// The copy rules, in one place. tests/constraints.test.ts scans the source with
// them, and the blog editor and its publish action run checkCopy() over every
// post, so a rule added here is enforced on code and on content alike.
//
// This file has to name what it bans, so it is the one file the source scan in
// tests/constraints.test.ts excludes (and asserts it is the only one).
// Why each rule exists: CLAUDE.md "Compliance constraints" and PRODUCT.md
// "Hard compliance constraints".

// Advertising a prescription-only medicine to the public is a criminal offence
// (Human Medicines Regulations 2012, CAP 12.12). Lowercase; matched as words.
export const MEDICINES = [
  'amoxicillin', 'azithromycin', 'clarithromycin', 'doxycycline', 'penicillin',
  'trimethoprim', 'nitrofurantoin', 'prednisolone', 'salbutamol', 'omeprazole',
  'metformin', 'atorvastatin', 'levothyroxine', 'sertraline', 'fluoxetine',
  'citalopram', 'amitriptyline', 'naproxen', 'ibuprofen', 'paracetamol',
  'codeine', 'tramadol', 'morphine', 'oxycodone', 'diazepam', 'zopiclone',
  'pregabalin', 'gabapentin', 'semaglutide', 'tirzepatide', 'wegovy',
  'ozempic', 'mounjaro',
] as const;

// Pricing became dynamic on 2026-09-04, but these stayed banned: the reversal
// was to the pricing *model*, not to its presentation. Word-boundary patterns:
// a bare substring match on "surge" also fires on "surgery".
export const BANNED_PATTERNS = [
  /\bsurge\b/i,
  /\bpriority queue\b/i,
  /\bbusier than usual\b/i,
  /\bcqc-registered clinical partner\b/i,
  /\bcqc (registration )?number\b/i,
];

export type Sampled = readonly [RegExp, string];

/* The patient surface's stricter lists: the booking flow is where a nudge beside
   a live price does the most harm, so bare "busy" and "priority" are banned
   there outright. Each pattern carries a sample it must catch. */
export const PATIENT_PRESSURE_PATTERNS: ReadonlyArray<Sampled> = [
  [/(?<![-\w])busy\b/i, 'Our GPs are busy right now'],
  [/\bbusier\b/i, 'Busier than usual'],
  [/\bsurge\b/i, 'Surge pricing applies'],
  [/\bpriority\b/i, 'Priority queue'],
  [/\bhurry\b/i, 'Hurry, prices rise soon'],
  [/\bact now\b/i, 'Act now to hold this price'],
  [/\blimited time\b/i, 'For a limited time'],
  [/\bjump the queue\b/i, 'Pay more to jump the queue'],
  [/\bskip the queue\b/i, 'Skip the queue'],
  [/\bfrom £\d/i, 'Consultations from £32'],
  [/\bup to £\d/i, 'Pay up to £48'],
  [/\b(urgency|triage|severity|risk) score\b/i, 'Your triage score is 4'],
  [/\d+\s*GPs?\s+online/i, '3 GPs online'],
];
export const PATIENT_CLAIM_PATTERNS: ReadonlyArray<Sampled> = [
  [/\bguarantee/i, 'Guaranteed prescription'],
  [/\bprescriptions included\b/i, 'Prescriptions included'],
  [/\bUK-wide\b/i, 'A UK-wide service'],
  [/\bacross the UK\b/i, 'Available across the UK'],
  [/\bany UK pharmacy\b/i, 'Collect from any UK pharmacy'],
  [/\b(is|are|will be|being) recorded\b/i, 'This call is recorded for training'],
  [/\bCQC\b/i, 'CQC registered'],
];
// Case-sensitive on purpose: a named doctor is a capitalised surname.
export const NAMED_DOCTOR: Sampled = [/\bDr\.? (?!Quick\b)[A-Z][a-z]+/, 'Dr Patel has accepted'];
export const LITERAL_MONEY: Sampled = [/£\s?\d/, 'Request a GP for £40'];

/* ---------------------------------------------------------------------------
   Public copy: the blog and the marketing pages. The same exposures as the
   patient surface, worded for prose — "a busy week" and "your health is our
   priority" are ordinary English, so only the pricing and queue senses are
   caught — plus the one approved CQC sentence.
--------------------------------------------------------------------------- */
export type CopyRule = { id: string; pattern: RegExp; sample: string; why: string };

export const APPROVED_CQC = 'CQC-registered clinical service at launch';

export const PUBLIC_COPY_RULES: ReadonlyArray<CopyRule> = [
  { id: 'surge', pattern: /\bsurge\b/i, sample: 'Surge pricing applies', why: 'Time-pressure pricing: the ASA ruled it socially irresponsible in medical services.' },
  { id: 'busier', pattern: /\bbusier than usual\b|\b(we are|we're|GPs are|it is|it's) (very )?busy\b/i, sample: 'GPs are busy right now', why: 'Scarcity framing near a price is time pressure.' },
  { id: 'pressure', pattern: /\bhurry\b|\bact now\b|\blimited time\b|\bbefore (it|the price) (goes up|rises)\b/i, sample: 'Act now before the price rises', why: 'Urging someone to book before a price changes is time pressure.' },
  { id: 'priority', pattern: /\bpriority (queue|access|appointment|booking|slot)s?\b|\b(jump|skip) the queue\b/i, sample: 'Pay for priority access', why: 'A patient can never pay to be seen before a more urgent patient.' },
  { id: 'price-range', pattern: /\b(from|up to|only|just) £\s?\d/i, sample: 'Consultations from £32', why: 'Pricing is dynamic: no page may state a starting price or a range.' },
  { id: 'money', pattern: /£\s?\d/, sample: 'It costs £40', why: 'Pricing is dynamic: no page may state a price. Say the price is shown in full before you book.' },
  { id: 'gp-count', pattern: /\d+\s*(GPs?|doctors?)\s+(are\s+)?(online|available)/i, sample: '12 GPs online now', why: 'No GP headcount exists yet; a count is an unsubstantiated claim.' },
  { id: 'score', pattern: /\b(urgency|triage|severity|risk) score\b/i, sample: 'Your triage score', why: 'Showing a patient an urgency score would make intake a medical device.' },
  { id: 'guarantee', pattern: /\bguarantee/i, sample: 'Guaranteed prescription', why: 'A consultation never guarantees a prescription; keep it conditional ("any prescription you need").' },
  { id: 'prescriptions-included', pattern: /\bprescriptions? (is |are )?included\b|\bprice (includes|covers) (the )?(medicine|medication)/i, sample: 'Prescriptions included', why: 'The price covers writing a prescription, never the medicine; the pharmacy charges separately.' },
  { id: 'uk-wide', pattern: /\bUK-wide\b|\bacross the UK\b|\bnationwide\b|\bany UK pharmacy\b|\bthroughout the UK\b/i, sample: 'A UK-wide service', why: 'Dr Quick launches in England only; Scotland, Wales and Northern Ireland are separate regulators.' },
  { id: 'cqc', pattern: /\bCQC\b(?!-registered clinical service at launch)/i, sample: 'We are CQC registered', why: `CQC registration does not exist yet. The only permitted wording is "${APPROVED_CQC}".` },
  { id: 'named-doctor', pattern: NAMED_DOCTOR[0], sample: NAMED_DOCTOR[1], why: 'No named GPs: Dr Quick has none to name yet, and a name implies a real clinician.' },
];

export type Hit = { rule: string; phrase: string; index: number; why: string };

const MEDICINE_RULE = new RegExp(`\\b(${MEDICINES.join('|')})\\b`, 'gi');
const MEDICINE_WHY = 'Naming a medicine in advertising is illegal (prescription-only medicines).';

// Every rule hit in the text, in reading order. Each hit carries the phrase and
// its offset so the editor can jump to it.
export function checkCopy(text: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of text.matchAll(MEDICINE_RULE)) {
    hits.push({ rule: 'medicine', phrase: m[0], index: m.index ?? 0, why: MEDICINE_WHY });
  }
  for (const rule of PUBLIC_COPY_RULES) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
    for (const m of text.matchAll(new RegExp(rule.pattern.source, flags))) {
      // A price range is also a literal amount; report it once, as the range.
      if (rule.id === 'money' && hits.some((h) => h.rule === 'price-range' && h.index <= (m.index ?? 0) && (m.index ?? 0) < h.index + h.phrase.length)) continue;
      hits.push({ rule: rule.id, phrase: m[0], index: m.index ?? 0, why: rule.why });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}
