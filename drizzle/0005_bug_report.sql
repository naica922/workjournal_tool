CREATE TABLE "bug_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"description" text NOT NULL,
	"device_type" text,
	"form_factor" text,
	"page" text,
	"screenshot" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
