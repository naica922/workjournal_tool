-- Rename "learner" terminology to "apprentice"
ALTER TABLE "host_assignment" RENAME COLUMN "learner_id" TO "apprentice_id";--> statement-breakpoint
ALTER INDEX "host_assignment_learner_email_idx" RENAME TO "host_assignment_apprentice_email_idx";--> statement-breakpoint
UPDATE "user" SET "role" = 'apprentice' WHERE "role" = 'learner';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'apprentice';
