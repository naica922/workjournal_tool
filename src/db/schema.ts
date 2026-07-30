import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (user, session, account, verification)
// The user table is extended with the role and the profile fields a host
// needs to identify a apprentice (apprentice year, team, birthday).
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["apprentice", "host"] })
    .notNull()
    .default("apprentice"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // Start of the apprenticeship; the current year is derived from it.
  apprenticeshipStart: date("apprenticeship_start"),
  team: text("team"),
  birthday: date("birthday"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Host assignments: a apprentice invites a host by email. The invite is pending
// until the host accepts it in their settings. hostId is filled in on accept,
// so invites can target hosts that have not registered yet.
// ---------------------------------------------------------------------------

export const hostAssignment = pgTable(
  "host_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apprenticeId: text("apprentice_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hostEmail: text("host_email").notNull(),
    hostId: text("host_id").references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("host_assignment_apprentice_email_idx").on(
      table.apprenticeId,
      table.hostEmail,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Projects: an apprentice groups journal entries into projects (e.g.
// "coop event") to show a host how much time went into each one.
// ---------------------------------------------------------------------------

export const project = pgTable("project", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull(),
  icon: text("icon"),
  // Optional project link (e.g. go/ or a doc) and point of contact.
  link: text("link"),
  poc: text("poc"),
  // Set when the project is marked completed; completed projects are no
  // longer selectable for new entries but stay visible in their own list.
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Calendar blocks: one row per journal entry of a apprentice.
// Recurring events store the recurrence on the block itself; occurrences are
// expanded when the calendar is read. Each blocker is paired with its own
// solution steps in blockerEntries.
// ---------------------------------------------------------------------------

export type BlockerEntry = { blocker: string; solutionSteps: string };
export type EventLink = {
  type: "go" | "critique" | "buganizer" | "other";
  url: string;
};

export const calendarBlock = pgTable("calendar_block", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  description: text("description"),
  blockerEntries: jsonb("blocker_entries")
    .$type<BlockerEntry[]>()
    .notNull()
    .default([]),
  location: text("location", { enum: ["home", "office"] }),
  color: text("color"),
  recurrence: text("recurrence", {
    enum: ["none", "daily", "weekly", "biweekly", "custom"],
  })
    .notNull()
    .default("none"),
  // For "custom": repeat every N units.
  recurrenceInterval: integer("recurrence_interval"),
  recurrenceUnit: text("recurrence_unit", { enum: ["day", "week"] }),
  links: jsonb("links").$type<EventLink[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// To-dos: personal tasks with an optional deadline, description and a link to
// a project. Separate from calendar entries.
// ---------------------------------------------------------------------------

// A named to-do list (like a Google Tasks list). Tasks belong to one list.
export const todoList = pgTable("todo_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // Order of the list on the board.
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const todo = pgTable("todo", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // The list this task lives in; a task is removed when its list is deleted.
  listId: uuid("list_id").references(() => todoList.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description"),
  deadline: timestamp("deadline", { withTimezone: true }),
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "set null",
  }),
  done: boolean("done").notNull().default(false),
  // Order of the task within its list (open and done ordered separately).
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Bug reports: submitted through the public /report-bug page. No login is
// required so a bug that blocks sign-in can still be reported.
// ---------------------------------------------------------------------------

export const bugReport = pgTable("bug_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  description: text("description").notNull(),
  deviceType: text("device_type"),
  formFactor: text("form_factor", { enum: ["mobile", "laptop"] }),
  page: text("page"),
  screenshot: text("screenshot"), // optional base64 data URL
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type HostAssignment = typeof hostAssignment.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Todo = typeof todo.$inferSelect;
export type TodoList = typeof todoList.$inferSelect;
export type CalendarBlock = typeof calendarBlock.$inferSelect;
export type NewCalendarBlock = typeof calendarBlock.$inferInsert;
