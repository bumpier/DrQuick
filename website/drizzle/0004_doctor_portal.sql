CREATE TABLE "consultation_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consultation_id" uuid NOT NULL,
	"gp_id" uuid NOT NULL,
	"status" text DEFAULT 'offered' NOT NULL,
	"gp_fee_pence" integer NOT NULL,
	"offered_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "consultation_ratings" (
	"consultation_id" uuid PRIMARY KEY NOT NULL,
	"gp_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doctor_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "age_band" text;--> statement-breakpoint
ALTER TABLE "consultations" ADD COLUMN "record_consent" boolean;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "session_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "languages" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "online_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "available_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gps" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "offers_consultation_gp" ON "consultation_offers" USING btree ("consultation_id","gp_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_live_consultation" ON "consultation_offers" USING btree ("consultation_id") WHERE "consultation_offers"."status" = 'offered';--> statement-breakpoint
CREATE UNIQUE INDEX "offers_live_gp" ON "consultation_offers" USING btree ("gp_id") WHERE "consultation_offers"."status" = 'offered';--> statement-breakpoint
CREATE INDEX "offers_gp_offered" ON "consultation_offers" USING btree ("gp_id","offered_at");--> statement-breakpoint
CREATE INDEX "ratings_gp" ON "consultation_ratings" USING btree ("gp_id");--> statement-breakpoint
CREATE INDEX "doctor_tokens_email" ON "doctor_tokens" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "consultations_gp_live" ON "consultations" USING btree ("gp_id") WHERE "consultations"."status" = 'in_progress';--> statement-breakpoint
CREATE INDEX "consultations_waiting" ON "consultations" USING btree ("requested_at") WHERE "consultations"."status" = 'requested';--> statement-breakpoint
CREATE UNIQUE INDEX "gps_email" ON "gps" USING btree ("email");--> statement-breakpoint
CREATE INDEX "gps_signup" ON "gps" USING btree ("signup_id");