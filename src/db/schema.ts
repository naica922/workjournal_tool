import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (user, session, account, verification)
// The user table is extended with the role and the profile fields a host
// needs to identify a learner (apprentice year, team, birthday).
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role", { enum: ["learner", "host"] })
    .notNull()
    .default("learner"),
  apprenticeYear: integer("apprentice_year"),
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
// Host assignments: a learner invites a host by email. The invite is pending
// until the host accepts it in their settings. hostId is filled in on accept,
// so invites can target hosts that have not registered yet.
// ---------------------------------------------------------------------------

export const hostAssignment = pgTable(
  "host_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: text("learner_id")
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
    uniqueIndex("host_assignment_learner_email_idx").on(
      table.learnerId,
      table.hostEmail,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Calendar blocks: one row per journal entry of a learner.
// Recurring events store the recurrence on the block itself; occurrences are
// expanded when the calendar is read.
// ---------------------------------------------------------------------------

export const calendarBlock = pgTable("calendar_block", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  description: text("description"),
  blockers: text("blockers"),
  solutionSteps: text("solution_steps"),
  location: text("location", { enum: ["home", "office"] }),
  color: text("color"),
  recurrence: text("recurrence", { enum: ["none", "weekly", "biweekly"] })
    .notNull()
    .default("none"),
  goLink: text("go_link"),
  critiqueLink: text("critique_link"),
  buganizerLink: text("buganizer_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type HostAssignment = typeof hostAssignment.$inferSelect;
export type CalendarBlock = typeof calendarBlock.$inferSelect;
export type NewCalendarBlock = typeof calendarBlock.$inferInsert;
