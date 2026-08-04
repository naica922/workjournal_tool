import { z } from "zod";

// Google-Calendar-like event colors; the name is shown in the color picker.
export const BLOCK_COLORS = [
  { name: "Blue", value: "#039be5" },
  { name: "Sky", value: "#4fc3f7" },
  { name: "Teal", value: "#009688" },
  { name: "Green", value: "#33b679" },
  { name: "Basil", value: "#0b8043" },
  { name: "Yellow", value: "#f6bf26" },
  { name: "Orange", value: "#f4511e" },
  { name: "Red", value: "#d50000" },
  { name: "Flamingo", value: "#e67c73" },
  { name: "Pink", value: "#d81b60" },
  { name: "Purple", value: "#8e24aa" },
  { name: "Lavender", value: "#7986cb" },
  { name: "Indigo", value: "#3f51b5" },
  { name: "Brown", value: "#795548" },
  { name: "Gray", value: "#616161" },
] as const;

export const DEFAULT_BLOCK_COLOR = BLOCK_COLORS[0].value;

// Selectable project icons (Material Symbols names, rendered with md-icon).
export const PROJECT_ICONS = [
  "folder",
  "work",
  "school",
  "groups",
  "person",
  "campaign",
  "event",
  "calendar_month",
  "code",
  "terminal",
  "bug_report",
  "build",
  "settings",
  "science",
  "experiment",
  "design_services",
  "brush",
  "palette",
  "lightbulb",
  "rocket_launch",
  "flag",
  "target",
  "trending_up",
  "analytics",
  "monitoring",
  "database",
  "cloud",
  "storage",
  "security",
  "handshake",
  "support_agent",
  "description",
  "task_alt",
  "checklist",
  "book",
  "translate",
  "shopping_cart",
  "payments",
  "business",
  "store",
  "public",
  "map",
  "celebration",
  "star",
  "favorite",
  "bolt",
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
