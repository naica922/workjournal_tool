import { z } from "zod";

// Google-Calendar-like event colors; the name is shown in the color picker.
export const BLOCK_COLORS = [
  { name: "Blue", value: "#039be5" },
  { name: "Green", value: "#33b679" },
  { name: "Yellow", value: "#f6bf26" },
  { name: "Red", value: "#d50000" },
  { name: "Purple", value: "#8e24aa" },
  { name: "Gray", value: "#616161" },
] as const;

export const DEFAULT_BLOCK_COLOR = BLOCK_COLORS[0].value;

export const blockInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    start: z.iso.datetime({ offset: true, local: true }),
    end: z.iso.datetime({ offset: true, local: true }),
    description: z.string().max(5000).optional(),
    blockers: z.string().max(5000).optional(),
    solutionSteps: z.string().max(5000).optional(),
    location: z.enum(["home", "office"]).optional(),
    color: z
      .enum(BLOCK_COLORS.map((c) => c.value) as [string, ...string[]])
      .optional(),
    recurrence: z.enum(["none", "weekly", "biweekly"]).default("none"),
    goLink: z.string().max(500).optional(),
    critiqueLink: z.string().max(500).optional(),
    buganizerLink: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.end) > new Date(data.start), {
    message: "End time must be after the start time",
    path: ["end"],
  });

export type BlockInput = z.infer<typeof blockInputSchema>;

export const listRangeSchema = z.object({
  start: z.iso.datetime({ offset: true, local: true }),
  end: z.iso.datetime({ offset: true, local: true }),
  apprenticeId: z.string().optional(),
});
