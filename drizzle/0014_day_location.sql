CREATE TABLE "day_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"location" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "day_location_user_id_date_unique" UNIQUE("user_id","date")
);--> statement-breakpoint
ALTER TABLE "day_location" ADD CONSTRAINT "day_location_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_block" ADD COLUMN "location_detail" text;--> statement-breakpoint
-- Backfill day-level home/office from existing per-block locations (Zurich day).
INSERT INTO "day_location" ("user_id","date","location")
	SELECT DISTINCT ON ("user_id", ("start" AT TIME ZONE 'Europe/Zurich')::date)
		"user_id", ("start" AT TIME ZONE 'Europe/Zurich')::date, "location"
	FROM "calendar_block"
	WHERE "location" IS NOT NULL
	ORDER BY "user_id", ("start" AT TIME ZONE 'Europe/Zurich')::date, "updated_at" DESC
	ON CONFLICT ("user_id","date") DO NOTHING;
