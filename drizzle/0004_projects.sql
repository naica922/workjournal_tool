-- Projects and paired blocker/solution entries
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_block" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "calendar_block" ADD CONSTRAINT "calendar_block_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_block" ADD COLUMN "blocker_entries" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Existing blocker/solution texts become one paired entry
UPDATE "calendar_block" SET "blocker_entries" = jsonb_build_array(jsonb_build_object('blocker', coalesce("blockers", ''), 'solutionSteps', coalesce("solution_steps", '')))
WHERE coalesce("blockers", '') <> '' OR coalesce("solution_steps", '') <> '';--> statement-breakpoint
ALTER TABLE "calendar_block" DROP COLUMN "blockers";--> statement-breakpoint
ALTER TABLE "calendar_block" DROP COLUMN "solution_steps";
