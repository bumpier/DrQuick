ALTER TABLE "waitlist_signups" ADD COLUMN "fee_status" text;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "fee_pence" integer;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "fee_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_fee_intent" ON "waitlist_signups" USING btree ("stripe_payment_intent_id");