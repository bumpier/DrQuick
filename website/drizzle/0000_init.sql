CREATE TABLE "admin_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_errors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"tone" text NOT NULL,
	"status" text NOT NULL,
	"author_email" text NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consultations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"gp_id" uuid,
	"status" text NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"price_pence" integer NOT NULL,
	"gp_fee_pence" integer NOT NULL,
	"platform_fee_pence" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider_id" text,
	"error" text,
	"signup_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"visitor_id" uuid,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signup_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"gmc" text NOT NULL,
	"status" text DEFAULT 'onboarding' NOT NULL,
	"stripe_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"amount_pence" integer NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"status" text NOT NULL,
	"stripe_payment_intent_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_items" (
	"payout_id" uuid NOT NULL,
	"consultation_id" uuid NOT NULL,
	CONSTRAINT "payout_items_payout_id_consultation_id_pk" PRIMARY KEY("payout_id","consultation_id")
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gp_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_pence" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_transfer_id" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_pence" integer NOT NULL,
	"reason" text,
	"stripe_refund_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visitor_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"entry_path" text NOT NULL,
	"exit_path" text NOT NULL,
	"current_path" text NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"engaged_seconds" integer DEFAULT 0 NOT NULL,
	"max_scroll" integer DEFAULT 0 NOT NULL,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"device" text NOT NULL,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"viewport_width" integer
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"first_referrer" text,
	"first_utm_source" text,
	"first_utm_medium" text,
	"first_utm_campaign" text,
	"first_path" text,
	"device" text,
	"browser" text,
	"os" text,
	"sessions" integer DEFAULT 0 NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"engaged_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"mobile" text,
	"gmc" text,
	"source" text DEFAULT 'landing' NOT NULL,
	"status" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"visitor_id" uuid,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"referrer" text,
	"landing_path" text,
	"unsubscribe_token" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "errors_created" ON "app_errors" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_slug" ON "blog_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "blog_published" ON "blog_posts" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "consultations_requested" ON "consultations" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "consultations_gp" ON "consultations" USING btree ("gp_id");--> statement-breakpoint
CREATE INDEX "email_created" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_signup" ON "email_log" USING btree ("signup_id");--> statement-breakpoint
CREATE INDEX "events_type_ts" ON "events" USING btree ("type","ts");--> statement-breakpoint
CREATE INDEX "events_path_type_ts" ON "events" USING btree ("path","type","ts");--> statement-breakpoint
CREATE INDEX "events_session" ON "events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "events_visitor" ON "events" USING btree ("visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gps_gmc" ON "gps" USING btree ("gmc");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_email" ON "patients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_paid" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_intent" ON "payments" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payouts_gp" ON "payouts" USING btree ("gp_id");--> statement-breakpoint
CREATE INDEX "payouts_period" ON "payouts" USING btree ("period_end");--> statement-breakpoint
CREATE INDEX "refunds_created" ON "refunds" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_started" ON "sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sessions_visitor" ON "sessions" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "sessions_last_seen" ON "sessions" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "visitors_last_seen" ON "visitors" USING btree ("last_seen");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_role_email" ON "waitlist_signups" USING btree ("role","email");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_unsubscribe_token" ON "waitlist_signups" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX "waitlist_created" ON "waitlist_signups" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "waitlist_visitor" ON "waitlist_signups" USING btree ("visitor_id");