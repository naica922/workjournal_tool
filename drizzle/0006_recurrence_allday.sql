ALTER TABLE "calendar_block" ADD COLUMN "all_day" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "calendar_block" ADD COLUMN "recurrence_interval" integer;--> statement-breakpoint
ALTER TABLE "calendar_block" ADD COLUMN "recurrence_unit" text;
