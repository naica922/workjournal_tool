"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { hostAssignment, user } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { sendHostInviteEmail } from "@/lib/mail";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  birthday: z.iso.date().nullable(),
  apprenticeshipStart: z.iso.date().nullable(),
  team: z.string().trim().max(200).nullable(),
});

export async function getProfile() {
  const session = await requireSession();
  const profile = await db.query.user.findFirst({
    where: eq(user.id, session.user.id),
    columns: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      apprenticeshipStart: true,
      team: true,
      birthday: true,
    },
  });
  if (!profile) {
    throw new Error("Profile not found");
  }
  return profile;
}

export async function updateProfile(input: unknown) {
  const session = await requireSession();
  const data = profileSchema.parse(input);

  const [updated] = await db
    .update(user)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      birthday: data.birthday,
      apprenticeshipStart: data.apprenticeshipStart,
      team: data.team,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id))
    .returning({ id: user.id });

  return updated;
}

// Onboarding for accounts created via Google sign-in: they arrive with only
// a name and email and must provide the remaining required fields once.
const completeProfileSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    birthday: z.iso.date(),
    role: z.enum(["apprentice", "host"]),
    apprenticeshipStart: z.iso.date().nullable(),
  })
  .refine((data) => data.role !== "apprentice" || !!data.apprenticeshipStart, {
    message: "Apprenticeship start date is required",
    path: ["apprenticeshipStart"],
  });

export async function completeProfile(input: unknown) {
  const session = await requireSession();
  const data = completeProfileSchema.parse(input);

  const [updated] = await db
    .update(user)
    .set({
      firstName: data.firstName,
      lastName: data.lastName,
      name: `${data.firstName} ${data.lastName}`.trim(),
      birthday: data.birthday,
      role: data.role,
      apprenticeshipStart:
        data.role === "apprentice" ? data.apprenticeshipStart : null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, session.user.id))
    .returning({ id: user.id });

  return updated;
}

// A user may change their own role, e.g. a former apprentice who now
// supervises apprentices. Their journal history stays on the account either
// way; access to other calendars is still governed solely by accepted
// assignments.
export async function updateRole(role: "apprentice" | "host") {
  const session = await requireSession();
  const parsed = z.enum(["apprentice", "host"]).parse(role);

  const [updated] = await db
    .update(user)
    .set({ role: parsed, updatedAt: new Date() })
    .where(eq(user.id, session.user.id))
    .returning({ id: user.id, role: user.role });

  return updated;
}

// ---------------------------------------------------------------------------
// Apprentice side: invite hosts by email, list and remove own invitations.
// ---------------------------------------------------------------------------

export async function addHostInvite(input: { email: string }) {
  const session = await requireSession();
  const email = z.email().parse(input.email).toLowerCase();

  if (email === session.user.email.toLowerCase()) {
    throw new Error("You cannot add yourself as a host");
  }

  const existing = await db.query.hostAssignment.findFirst({
    where: and(
      eq(hostAssignment.apprenticeId, session.user.id),
      eq(hostAssignment.hostEmail, email),
    ),
  });
  if (existing) {
    throw new Error("This host has already been added");
  }

  const [created] = await db
    .insert(hostAssignment)
    .values({ apprenticeId: session.user.id, hostEmail: email })
    .returning();

  // The invitation exists either way; a mail failure must not lose it.
  let emailSent = true;
  try {
    await sendHostInviteEmail({
      to: email,
      apprenticeName: session.user.name,
      apprenticeEmail: session.user.email,
    });
  } catch (error) {
    console.error("Failed to send host invite email", error);
    emailSent = false;
  }

  return { ...created, emailSent };
}

export async function listMyHosts() {
  const session = await requireSession();
  const assignments = await db.query.hostAssignment.findMany({
    where: eq(hostAssignment.apprenticeId, session.user.id),
    orderBy: (assignment, { asc }) => [asc(assignment.createdAt)],
  });
  return assignments.map((assignment) => ({
    id: assignment.id,
    hostEmail: assignment.hostEmail,
    status: assignment.status,
  }));
}

export async function removeHost(assignmentId: string) {
  const session = await requireSession();
  const [deleted] = await db
    .delete(hostAssignment)
    .where(
      and(
        eq(hostAssignment.id, assignmentId),
        eq(hostAssignment.apprenticeId, session.user.id),
      ),
    )
    .returning({ id: hostAssignment.id });
  if (!deleted) {
    throw new Error("Invitation not found");
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// Host side: see pending invitations addressed to the own email, accept or
// decline them, and list all apprentices that granted access.
// ---------------------------------------------------------------------------

export async function listMyInvites() {
  const session = await requireSession();
  const invites = await db
    .select({
      id: hostAssignment.id,
      apprenticeName: user.name,
      apprenticeEmail: user.email,
    })
    .from(hostAssignment)
    .innerJoin(user, eq(user.id, hostAssignment.apprenticeId))
    .where(
      and(
        eq(hostAssignment.hostEmail, session.user.email.toLowerCase()),
        eq(hostAssignment.status, "pending"),
      ),
    );
  return invites;
}

export async function acceptInvite(assignmentId: string) {
  const session = await requireSession();
  const [accepted] = await db
    .update(hostAssignment)
    .set({ hostId: session.user.id, status: "accepted" })
    .where(
      and(
        eq(hostAssignment.id, assignmentId),
        // Only the invited email address may accept.
        eq(hostAssignment.hostEmail, session.user.email.toLowerCase()),
        eq(hostAssignment.status, "pending"),
      ),
    )
    .returning({ id: hostAssignment.id });
  if (!accepted) {
    throw new Error("Invitation not found");
  }
  return accepted;
}

export async function declineInvite(assignmentId: string) {
  const session = await requireSession();
  const [declined] = await db
    .delete(hostAssignment)
    .where(
      and(
        eq(hostAssignment.id, assignmentId),
        eq(hostAssignment.hostEmail, session.user.email.toLowerCase()),
        eq(hostAssignment.status, "pending"),
      ),
    )
    .returning({ id: hostAssignment.id });
  if (!declined) {
    throw new Error("Invitation not found");
  }
  return declined;
}

export async function listMyApprentices() {
  const session = await requireSession();
  const apprentices = await db
    .select({
      assignmentId: hostAssignment.id,
      id: user.id,
      name: user.name,
      email: user.email,
      apprenticeshipStart: user.apprenticeshipStart,
      team: user.team,
    })
    .from(hostAssignment)
    .innerJoin(user, eq(user.id, hostAssignment.apprenticeId))
    .where(
      and(
        eq(hostAssignment.hostId, session.user.id),
        eq(hostAssignment.status, "accepted"),
      ),
    );
  return apprentices;
}
