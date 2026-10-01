// The whole database, one file. Drizzle generates the migrations in drizzle/
// from this (`npm run db:generate`), and deploy applies them (`db:migrate`).
//
// Conventions: timestamps are timestamptz, money is integer pence in GBP, ids
// are uuids except the append-only logs (bigserial). No raw IP address is ever
// stored anywhere: rate limits key on a salted hash, analytics on a random id.
import { sql } from 'drizzle-orm';
import {
  bigserial, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

// Relative, not '@/': drizzle-kit reads this file outside the app's bundler.
import { FEE_STATUSES, type FeeStatus } from '../gp-fee';

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------- waitlist */

export { FEE_STATUSES, type FeeStatus };
export type PendingDetails = { name: string; mobile: string; gmc: string };

export const WAITLIST_ROLES = ['patient', 'gp'] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number];

// A patient is either subscribed or not. A GP moves through the recruitment
// pipeline the admin board shows, left to right, or is rejected.
export const PATIENT_STATUSES = ['subscribed', 'unsubscribed'] as const;
export const GP_STATUSES = ['new', 'contacted', 'gmc_verified', 'onboarding', 'active', 'rejected'] as const;
export type GpStatus = (typeof GP_STATUSES)[number];

export const waitlistSignups = pgTable('waitlist_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: text('role', { enum: WAITLIST_ROLES }).notNull(),
  email: text('email').notNull(),
  name: text('name'),
  mobile: text('mobile'),
  gmc: text('gmc'),
  source: text('source').notNull().default('landing'),
  status: text('status').notNull(),
  notes: text('notes').notNull().default(''),
  visitorId: uuid('visitor_id'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  referrer: text('referrer'),
  landingPath: text('landing_path'),
  unsubscribeToken: text('unsubscribe_token').notNull(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  // The GP sign-up fee (lib/gp-fee.ts). Null on every patient row and on a GP
  // who signed up before the fee existed; 'unpaid' from the moment a GP submits
  // the form until Stripe confirms the payment. The Stripe ids are what the
  // webhook matches a payment or a refund back to this row with.
  feeStatus: text('fee_status', { enum: FEE_STATUSES }),
  feePence: integer('fee_pence'),
  feePaidAt: timestamp('fee_paid_at', { withTimezone: true }),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  // The Stripe refund that marked the fee refunded, so that only that refund
  // failing can put it back to paid.
  feeRefundId: text('fee_refund_id'),
  // The details typed with each checkout that has been started, keyed by its
  // Stripe session id. The row itself keeps the FIRST details submitted for an
  // address; when a checkout is paid, the details typed with THAT checkout
  // replace them. So nobody can rewrite someone else's application by posting
  // their email address: only the person who pays decides what it says.
  pendingDetails: jsonb('pending_details').$type<Record<string, PendingDetails>>(),
  createdAt: created(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Someone may sign up as both a patient and a GP; each role keeps its own row.
  uniqueIndex('waitlist_role_email').on(t.role, t.email),
  uniqueIndex('waitlist_unsubscribe_token').on(t.unsubscribeToken),
  index('waitlist_created').on(t.createdAt),
  index('waitlist_visitor').on(t.visitorId),
  // One payment pays one sign-up, however often Stripe tells us about it.
  uniqueIndex('waitlist_fee_intent').on(t.stripePaymentIntentId),
]);

/* ---------------------------------------------------------- rate limits */

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  windowEndsAt: timestamp('window_ends_at', { withTimezone: true }).notNull(),
});

/* ----------------------------------------------------------------- blog */

export const blogPosts = pgTable('blog_posts', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  tone: text('tone').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull(),
  authorEmail: text('author_email').notNull(),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('blog_slug').on(t.slug),
  index('blog_published').on(t.status, t.publishedAt),
]);

/* --------------------------------------------------------- system logs */

export const emailLog = pgTable('email_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  to: text('to').notNull(),
  template: text('template').notNull(),
  subject: text('subject').notNull(),
  status: text('status', { enum: ['sent', 'failed', 'skipped'] }).notNull(),
  providerId: text('provider_id'),
  error: text('error'),
  signupId: uuid('signup_id'),
  createdAt: created(),
}, (t) => [index('email_created').on(t.createdAt), index('email_signup').on(t.signupId)]);

export const adminAuditLog = pgTable('admin_audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  adminEmail: text('admin_email').notNull(),
  action: text('action').notNull(),
  target: text('target'),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: created(),
}, (t) => [index('audit_created').on(t.createdAt)]);

export const appErrors = pgTable('app_errors', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  route: text('route').notNull(),
  message: text('message').notNull(),
  createdAt: created(),
}, (t) => [index('errors_created').on(t.createdAt)]);

/* ------------------------------------------------------------ analytics */

// A visitor exists only once they accept analytics cookies; cookieless
// pageviews carry no visitor and no session.
export const visitors = pgTable('visitors', {
  id: uuid('id').primaryKey(),
  firstSeen: timestamp('first_seen', { withTimezone: true }).notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull(),
  firstReferrer: text('first_referrer'),
  firstUtmSource: text('first_utm_source'),
  firstUtmMedium: text('first_utm_medium'),
  firstUtmCampaign: text('first_utm_campaign'),
  firstPath: text('first_path'),
  device: text('device'),
  browser: text('browser'),
  os: text('os'),
  sessions: integer('sessions').notNull().default(0),
  pageviews: integer('pageviews').notNull().default(0),
  engagedSeconds: integer('engaged_seconds').notNull().default(0),
}, (t) => [index('visitors_last_seen').on(t.lastSeen)]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  visitorId: uuid('visitor_id'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull(),
  entryPath: text('entry_path').notNull(),
  exitPath: text('exit_path').notNull(),
  currentPath: text('current_path').notNull(),
  pageviews: integer('pageviews').notNull().default(0),
  engagedSeconds: integer('engaged_seconds').notNull().default(0),
  maxScroll: integer('max_scroll').notNull().default(0),
  referrer: text('referrer'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),
  device: text('device').notNull(),
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  viewportWidth: integer('viewport_width'),
}, (t) => [
  index('sessions_started').on(t.startedAt),
  index('sessions_visitor').on(t.visitorId),
  index('sessions_last_seen').on(t.lastSeen),
]);

export const EVENT_TYPES = [
  'pageview', 'scroll', 'section_view', 'engaged_time', 'click',
  'form_view', 'form_start', 'field_focus', 'field_error', 'form_submit', 'form_success', 'form_fail',
  'cta_click', 'outbound_click',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const events = pgTable('events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sessionId: uuid('session_id'),
  visitorId: uuid('visitor_id'),
  type: text('type').notNull(),
  path: text('path').notNull(),
  ts: timestamp('ts', { withTimezone: true }).notNull(),
  // Cookieless pageviews still record the device class and referrer host here.
  props: jsonb('props').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (t) => [
  index('events_type_ts').on(t.type, t.ts),
  index('events_path_type_ts').on(t.path, t.type, t.ts),
  index('events_session').on(t.sessionId),
  index('events_visitor').on(t.visitorId),
]);

/* -------------------------------------------------------------- finance */
// Empty until consultations go live. Stripe ids are nullable so rows can be
// written by the webhook (app/api/webhooks/stripe) once it is switched on.

export const gps = pgTable('gps', {
  id: uuid('id').primaryKey().defaultRandom(),
  signupId: uuid('signup_id'),
  name: text('name').notNull(),
  email: text('email').notNull(),
  gmc: text('gmc').notNull(),
  status: text('status', { enum: ['onboarding', 'active', 'paused', 'offboarded'] }).notNull().default('onboarding'),
  stripeAccountId: text('stripe_account_id'),
  createdAt: created(),
}, (t) => [uniqueIndex('gps_gmc').on(t.gmc)]);

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: created(),
}, (t) => [uniqueIndex('patients_email').on(t.email)]);

export const CONSULTATION_STATUSES = ['requested', 'in_progress', 'completed', 'cancelled', 'no_show'] as const;

export const consultations = pgTable('consultations', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientId: uuid('patient_id').notNull(),
  gpId: uuid('gp_id'),
  status: text('status', { enum: CONSULTATION_STATUSES }).notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  pricePence: integer('price_pence').notNull(),
  gpFeePence: integer('gp_fee_pence').notNull(),
  platformFeePence: integer('platform_fee_pence').notNull(),
}, (t) => [index('consultations_requested').on(t.requestedAt), index('consultations_gp').on(t.gpId)]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  consultationId: uuid('consultation_id').notNull(),
  amountPence: integer('amount_pence').notNull(),
  currency: text('currency').notNull().default('GBP'),
  status: text('status', { enum: ['pending', 'succeeded', 'failed'] }).notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [
  index('payments_paid').on(t.paidAt),
  index('payments_consultation').on(t.consultationId),
  uniqueIndex('payments_intent').on(t.stripePaymentIntentId),
]);

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull(),
  amountPence: integer('amount_pence').notNull(),
  reason: text('reason'),
  stripeRefundId: text('stripe_refund_id'),
  createdAt: created(),
}, (t) => [
  index('refunds_created').on(t.createdAt),
  index('refunds_payment').on(t.paymentId),
  // The webhook inserts a refund once per Stripe refund, however often it is told.
  uniqueIndex('refunds_stripe').on(t.stripeRefundId),
]);

export const PAYOUT_STATUSES = ['pending', 'processing', 'paid', 'failed'] as const;

export const payouts = pgTable('payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  gpId: uuid('gp_id').notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  amountPence: integer('amount_pence').notNull(),
  status: text('status', { enum: PAYOUT_STATUSES }).notNull().default('pending'),
  stripeTransferId: text('stripe_transfer_id'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [
  index('payouts_gp').on(t.gpId),
  index('payouts_period').on(t.periodEnd),
  uniqueIndex('payouts_transfer').on(t.stripeTransferId),
]);

// Every Stripe event id the webhook has applied, so a redelivery is a no-op.
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payoutItems = pgTable('payout_items', {
  payoutId: uuid('payout_id').notNull(),
  consultationId: uuid('consultation_id').notNull(),
}, (t) => [primaryKey({ columns: [t.payoutId, t.consultationId] })]);
