ALTER TABLE "calendar_block" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Migrate the existing single go/critique/buganizer links into the array.
UPDATE "calendar_block" SET "links" =
  (CASE WHEN coalesce("go_link", '') <> '' THEN jsonb_build_array(jsonb_build_object('type','go','url',"go_link")) ELSE '[]'::jsonb END)
  || (CASE WHEN coalesce("critique_link", '') <> '' THEN jsonb_build_array(jsonb_build_object('type','critique','url',"critique_link")) ELSE '[]'::jsonb END)
  || (CASE WHEN coalesce("buganizer_link", '') <> '' THEN jsonb_build_array(jsonb_build_object('type','buganizer','url',"buganizer_link")) ELSE '[]'::jsonb END);--> statement-breakpoint
ALTER TABLE "calendar_block" DROP COLUMN "go_link";--> statement-breakpoint
ALTER TABLE "calendar_block" DROP COLUMN "critique_link";--> statement-breakpoint
ALTER TABLE "calendar_block" DROP COLUMN "buganizer_link";
