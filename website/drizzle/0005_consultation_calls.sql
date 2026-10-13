CREATE TABLE "call_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"consultation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_calls" (
	"consultation_id" uuid PRIMARY KEY NOT NULL,
	"room" text NOT NULL,
	"gp_identity" text NOT NULL,
	"patient_identity" text NOT NULL,
	"sealed_gp_key" text,
	"sealed_patient_key" text,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"room_deleted_at" timestamp with time zone,
	"close_attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "consultation_calls_closed_keeps_no_key" CHECK ("consultation_calls"."closed_at" is null or ("consultation_calls"."sealed_gp_key" is null and "consultation_calls"."sealed_patient_key" is null))
);
--> statement-breakpoint
CREATE TABLE "livekit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "call_events_consultation" ON "call_events" USING btree ("consultation_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_calls_room" ON "consultation_calls" USING btree ("room");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_calls_gp_identity" ON "consultation_calls" USING btree ("gp_identity");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_calls_patient_identity" ON "consultation_calls" USING btree ("patient_identity");--> statement-breakpoint
CREATE INDEX "consultation_calls_undeleted" ON "consultation_calls" USING btree ("closed_at") WHERE "consultation_calls"."closed_at" is not null and "consultation_calls"."room_deleted_at" is null;