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

// Selectable project icons (Material Symbols names, rendered with md-icon).
export const PROJECT_ICONS = [
  "folder",
  "work",
  "school",
  "groups",
  "campaign",
  "event",
  "code",
  "bug_report",
  "lightbulb",
  "rocket_launch",
  "handshake",
  "celebration",
  "analytics",
  "business",
  "palette",
  "star",
] as const;

export const CRITIQUE_PREFIX = "cl/";
export const BUGANIZER_PREFIX = "b/";

// Link types an event entry can reference; multiple of each are allowed.
export const LINK_TYPES = [
  { value: "go", label: "Go link", placeholder: "go/…" },
  { value: "critique", label: "Critique", placeholder: "cl/…" },
  { value: "buganizer", label: "Buganizer", placeholder: "b/…" },
  { value: "other", label: "Link", placeholder: "https://…" },
] as const;

export type LinkType = (typeof LINK_TYPES)[number]["value"];

export function linkLabel(type: string): string {
  return LINK_TYPES.find((t) => t.value === type)?.label ?? "Link";
}

export const blockerEntrySchema = z.object({
  blocker: z.string().trim().max(5000),
  solutionSteps: z.string().trim().max(5000),
});

export const blockInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    start: z.iso.datetime({ offset: true, local: true }),
    end: z.iso.datetime({ offset: true, local: true }),
    allDay: z.boolean().default(false),
    description: z.string().max(5000).optional(),
    projectId: z.uuid().nullable().optional(),
    blockerEntries: z.array(blockerEntrySchema).max(20).default([]),
    location: z.enum(["home", "office"]),
    color: z
      .enum(BLOCK_COLORS.map((c) => c.value) as [string, ...string[]])
      .optional(),
    recurrence: z
      .enum(["none", "daily", "weekly", "biweekly", "custom"])
      .default("none"),
    recurrenceInterval: z.coerce.number().int().min(1).max(52).nullable().optional(),
    recurrenceUnit: z.enum(["day", "week"]).nullable().optional(),
    links: z
      .array(
        z.object({
          type: z.enum(["go", "critique", "buganizer", "other"]),
          url: z.string().trim().max(500),
        }),
      )
      .max(30)
      .default([]),
  })
  .refine((data) => new Date(data.end) > new Date(data.start), {
    message: "End time must be after the start time",
    path: ["end"],
  })
  .refine(
    (data) =>
      data.recurrence !== "custom" ||
      (!!data.recurrenceInterval && !!data.recurrenceUnit),
    {
      message: "Choose how often the custom event repeats",
      path: ["recurrenceInterval"],
    },
  );

export type BlockInput = z.infer<typeof blockInputSchema>;

export const listRangeSchema = z.object({
  start: z.iso.datetime({ offset: true, local: true }),
  end: z.iso.datetime({ offset: true, local: true }),
  apprenticeId: z.string().optional(),
});
