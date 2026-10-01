ALTER TABLE "waitlist_signups" ADD COLUMN "fee_refund_id" text;--> statement-breakpoint
ALTER TABLE "waitlist_signups" ADD COLUMN "pending_details" jsonb;