CREATE TABLE "todo_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "todo_list" ADD CONSTRAINT "todo_list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "list_id" uuid;--> statement-breakpoint
ALTER TABLE "todo" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "todo" ADD CONSTRAINT "todo_list_id_todo_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."todo_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: give every user that already has tasks a default "My Tasks" list.
INSERT INTO "todo_list" ("user_id", "title", "position")
	SELECT DISTINCT "user_id", 'My Tasks', 0 FROM "todo";--> statement-breakpoint
-- Move existing tasks into their user's default list.
UPDATE "todo" t SET "list_id" = l."id"
	FROM "todo_list" l WHERE l."user_id" = t."user_id" AND t."list_id" IS NULL;--> statement-breakpoint
-- Order existing tasks by creation time within each user's list (open and done separately).
UPDATE "todo" t SET "position" = o.rn FROM (
	SELECT "id", (row_number() OVER (PARTITION BY "user_id", "done" ORDER BY "created_at") - 1) AS rn FROM "todo"
) o WHERE o."id" = t."id";
