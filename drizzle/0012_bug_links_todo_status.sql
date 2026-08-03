ALTER TABLE "bug_report" ADD COLUMN "links" text;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
-- Existing done tasks start out labelled done; the rest stay open.
UPDATE "todo" SET "status" = 'done' WHERE "done" = true;
