"use server";

import { z } from "zod";
import { db } from "@/db";
import { bugReport } from "@/db/schema";

// Screenshots are stored inline as base64 data URLs; cap the size so a
// report cannot bloat the database.
const MAX_SCREENSHOT_CHARS = 3_000_000; // ~2 MB image

const bugReportSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.email("A valid email is required"),
  description: z
    .string()
    .trim()
    .min(10, "Please describe the problem in a bit more detail")
    .max(5000),
  deviceType: z.string().trim().max(200).optional(),
  formFactor: z.enum(["mobile", "laptop"]).optional(),
  page: z.string().trim().max(200).optional(),
  screenshot: z
    .string()
    .max(MAX_SCREENSHOT_CHARS, "The screenshot is too large (max ~2 MB)")
    .refine((value) => value.startsWith("data:image/"), {
      message: "The screenshot must be an image",
    })
    .optional(),
});

export async function submitBugReport(input: unknown) {
  const data = bugReportSchema.parse(input);

  await db.insert(bugReport).values({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    description: data.description,
    deviceType: data.deviceType || null,
    formFactor: data.formFactor ?? null,
    page: data.page || null,
    screenshot: data.screenshot || null,
  });

  return { ok: true };
}
