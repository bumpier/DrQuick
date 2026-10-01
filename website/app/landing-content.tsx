import type { FaqItem } from '@/components/Faq';
import { COMMISSION_TIERS, gpSharePercent, platformSharePercent } from '@/lib/finance/commission';
import { GP_FEE_LABEL, GP_FEE_REFUND } from '@/lib/gp-fee';

// Typed copy for the landing page, transcribed verbatim from the flat page.
// Compliance sentences live here and are guarded by tests; do not paraphrase.
export type Tile = { title: string; body: string };
export type CoversCol = { title: string; tone: 'yes' | 'no'; items: string[] };

export const PATIENT_STEPS: [Tile, Tile, Tile] = [
  { title: 'Tell us what’s wrong.', body: 'A two-minute form in plain English, so the GP already knows why you’re calling.' },
  { title: 'Get matched.', body: 'You’re handed to the next available GP instead of picking a time slot.' },
  { title: 'Talk by video.', body: 'A secure video consultation, with a prescription, fit note or referral afterwards if you need one.' },
];

export const GP_STEPS: [Tile, Tile, Tile] = [
  { title: 'Go online.', body: 'No rota and no minimum hours. You are only matched while you have said you are available.' },
  { title: 'A patient is matched to you.', body: 'They have already completed a structured intake form, so you know why they are calling before the call starts.' },
  { title: 'Consult, and get paid.', body: 'Fifteen minutes by secure video, with a prescription, fit note or referral afterwards where you judge it clinically appropriate.' },
];

export const PATIENT_COVERS: [CoversCol, CoversCol] = [
  { title: 'It covers', tone: 'yes', items: [
    'A GMC-registered GP assessing new or worsening symptoms.',
    'A prescription sent to a pharmacy you choose, if the GP judges you need one. You pay the pharmacy for the medicine itself.',
    'A fit note, if the GP judges you’re not fit to work.',
    'A referral letter for private specialist care.',
    'A straight answer on whether you need to be seen in person.',
  ] },
  { title: 'It doesn’t', tone: 'no', items: [
    'Emergencies — call 999 or go to A&E.',
    'Anything needing a physical examination, a test or a scan.',
    'Controlled drugs such as strong opioids and sedatives. Schedule 2 and 3 medicines are never prescribed on Dr Quick.',
    'Ongoing medication that needs monitoring, without access to your records.',
    'Replacing your NHS GP. Dr Quick works alongside them, with your consent.',
  ] },
];

export const GP_COVERS: [CoversCol, CoversCol] = [
  { title: 'We do', tone: 'yes', items: [
    'Verify you once — GMC register, licence to practise, enhanced DBS, right to work and indemnity — and keep those checks current.',
    'Confirm the patient’s identity and take their payment before you are matched.',
    'Put a completed intake form in front of you before the consultation starts.',
    'Hold the clinical record, which the registered provider is required to keep.',
    'Send a summary to the patient’s NHS GP, with their consent.',
  ] },
  { title: 'We don’t', tone: 'no', items: [
    'Make clinical decisions for you, or set any target for prescribing.',
    'Ask for exclusivity, notice or a minimum number of hours. NHS, locum and partnership work carry on alongside.',
    'Cover your medical defence. Private telehealth sits outside the NHS schemes, so you keep your own MDO cover.',
    'Pass on requests for Schedule 2 or 3 controlled drugs. Those are prohibited across the platform.',
    'Send you a patient outside England. Scotland, Wales and Northern Ireland are regulated separately.',
  ] },
];

export const PATIENT_FAQ: FaqItem[] = [
  { q: 'Are these real GPs?', a: <p>Every doctor who takes consultations on Dr Quick will hold GMC registration, a licence to practise and a place on the GP Register. Nobody sees a patient until those have been checked.</p> },
  { q: 'How quickly will I be seen?', a: <p>You’re matched to the next GP who is free, rather than booking a slot in a diary. We’ll publish our actual waiting times once we have launched and can measure them.</p> },
  { q: 'Can I get a prescription?', a: <p>If the GP judges that you need one, yes — writing it is covered by the price you were quoted. You pay the pharmacy for the medicine itself, as you would with any private prescription. Some medicines cannot safely be prescribed remotely, and Schedule 2 and 3 controlled drugs never are.</p> },
  { q: 'Is Dr Quick CQC registered?', a: <p>Not yet — we have not launched. Dr Quick will be a CQC-registered clinical service at launch, and nobody will be seen before that registration is in place.</p> },
  { q: 'Will my own GP find out?', a: <p>With your consent we send a summary of the consultation to your NHS GP. That is good practice for remote care, and it keeps your medical record complete. If you would rather we did not, that is your call — but without it the GP may not have enough information to prescribe safely, and may decline. The same applies if you are not registered with an NHS GP.</p> },
  { q: 'Can I use it for my children?', a: <p>We will confirm how consultations for under-18s work before we open. Parental responsibility and identity checks have to be right first.</p> },
  {
    q: 'What happens to my email address?',
    a: (
      <p>
        We use it to tell you when Dr Quick opens, and for nothing else. We do not share it or sell it,
        and your email address is the only thing we ask you for today. We keep it until launch and for no
        more than twelve months after that, then delete it. You can ask us to delete it sooner at any
        time, and if you think we have handled it badly you can complain to the Information
        Commissioner’s Office.
        {/* DEPLOY / LEGAL: UK GDPR Art 13 also requires the data controller's registered
            name and address and a working privacy contact. PRODUCT.md records the legal
            entity as undecided, so they cannot be written yet. Add them here and in the
            footer before this page collects a single real address. */}
      </p>
    ),
  },
  { q: 'Where can I use Dr Quick?', a: <p>England, at launch. Scotland, Wales and Northern Ireland are regulated separately, so they are not covered at launch.</p> },
];

// The commission and the fee are read from their modules, so an answer here can
// never state a figure the product does not pay or charge.
const [T_START, T_MID, T_TOP] = COMMISSION_TIERS;

export const GP_FAQ: FaqItem[] = [
  { q: 'Am I employed by Dr Quick?', a: <p>No. You would work as a self-employed contractor and invoice per consultation. There is no exclusivity and no notice period, so NHS, locum or partnership work carries on alongside it.</p> },
  {
    q: 'How much do I keep?',
    a: (
      <p>
        You keep {gpSharePercent(T_START)}% of the price of each consultation, and Dr Quick keeps {platformSharePercent(T_START)}%.
        After {T_MID.from} completed consultations you keep {gpSharePercent(T_MID)}%, and after {T_TOP.from} you
        keep {gpSharePercent(T_TOP)}%, which is the top rate. The count is of consultations you complete, and it never
        resets. What a consultation pays is shown in full before you accept it.
      </p>
    ),
  },
  {
    q: 'What is the sign-up fee?',
    a: (
      <p>
        {GP_FEE_LABEL}, paid once by card when you sign up. {GP_FEE_REFUND} The payment is taken by Stripe, so
        Dr Quick never sees your card details.
      </p>
    ),
  },
  { q: 'What indemnity do I need?', a: <p>Your own. Private telehealth is not covered by the NHS clinical negligence schemes, so you need cover from a medical defence organisation for this work. We check it before your first consultation and we do not provide it for you.</p> },
  { q: 'What gets checked before I start?', a: <p>GMC registration, your licence to practise, your place on the GP Register, an enhanced DBS check, right to work and indemnity. Nothing is matched to you until all of them are in place, and we re-check them as they fall due.</p> },
  { q: 'Do I have to prescribe?', a: <p>No. Whether a prescription is appropriate at all is entirely your clinical judgement, and nothing on the platform is measured on how often you write one. Schedule 2 and 3 controlled drugs are prohibited across the platform, so those requests do not reach you.</p> },
  { q: 'How long is a consultation?', a: <p>Fifteen minutes is the standard consultation. If someone needs longer, needs a physical examination, or needs to be seen in person, saying so is the right clinical answer and it is not held against you.</p> },
  { q: 'What equipment do I need?', a: <p>A computer with a camera, a private room and a reliable connection. The consultation runs in the browser, so there is nothing to install.</p> },
  {
    q: 'What happens to my details?',
    a: (
      <p>
        We use your name, email address, mobile number and GMC reference number to check you on the
        GMC register and to contact you about launching. That is all — we do not sell them, and we ask
        for nothing else today. The only company we pass anything to is Stripe, which takes the sign-up
        fee: it receives your email address and your card details, and the card details never reach us.
        We keep your details until launch and for no more than twelve months after that, then delete
        them; a record of the payment is kept for as long as the law requires. You can ask us to delete
        your details sooner at any time, and if you think we have handled them badly you can complain to
        the Information Commissioner’s Office.
        {/* DEPLOY / LEGAL: UK GDPR Art 13 also requires the data controller's registered
            name and address and a working privacy contact — and this form now collects a
            name, a mobile number and a GMC reference, not just an email, and takes a
            payment, so the exposure is larger than the patient one. Stripe is a processor
            and must be named in the privacy notice; a record of the payment has to be kept
            for tax after the rest is deleted. PRODUCT.md records the legal entity as
            undecided, so none of this can be written yet. Add it here and in the footer
            before this page collects a single real doctor's details or takes a real fee. */}
      </p>
    ),
  },
  { q: 'Where are the patients?', a: <p>England at launch. Scotland, Wales and Northern Ireland are regulated separately, so they are not covered at launch.</p> },
  { q: 'When does this start?', a: <p>We have not launched. Dr Quick will be a CQC-registered clinical service at launch, and no consultation happens before that registration is in place. Signing up now puts you in the first group we talk to.</p> },
];
