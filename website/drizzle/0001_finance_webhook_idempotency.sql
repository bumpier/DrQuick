CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payments_consultation" ON "payments" USING btree ("consultation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_transfer" ON "payouts" USING btree ("stripe_transfer_id");--> statement-breakpoint
CREATE INDEX "refunds_payment" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_stripe" ON "refunds" USING btree ("stripe_refund_id");