-- First/last name and apprenticeship start date instead of apprentice year
ALTER TABLE "user" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "apprenticeship_start" date;--> statement-breakpoint
-- Existing names are split on the first space
UPDATE "user" SET
  "first_name" = split_part("name", ' ', 1),
  "last_name" = NULLIF(trim(substring("name" from length(split_part("name", ' ', 1)) + 1)), '');--> statement-breakpoint
-- Approximate the start date from the apprentice year (Swiss apprenticeships
-- start on August 1st): year N means the apprenticeship started N-1 years ago.
UPDATE "user" SET "apprenticeship_start" = make_date(
  extract(year from CURRENT_DATE)::int
    - ("apprentice_year" - 1)
    - CASE WHEN extract(month from CURRENT_DATE) < 8 THEN 1 ELSE 0 END,
  8, 1)
WHERE "apprentice_year" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "apprentice_year";
