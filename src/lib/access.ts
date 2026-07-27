import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hostAssignment } from "@/db/schema";

// A user may read a calendar (and its projects) if it is their own, or if
// they are an accepted host of that apprentice. Checked on every request.
export async function assertCanViewCalendar(
  viewerId: string,
  ownerId: string,
) {
  if (viewerId === ownerId) {
    return;
  }
  const assignment = await db.query.hostAssignment.findFirst({
    where: and(
      eq(hostAssignment.apprenticeId, ownerId),
      eq(hostAssignment.hostId, viewerId),
      eq(hostAssignment.status, "accepted"),
    ),
  });
  if (!assignment) {
    throw new Error("Not authorized to view this calendar");
  }
}
