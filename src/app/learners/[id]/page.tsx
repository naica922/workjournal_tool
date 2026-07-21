import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hostAssignment, user } from "@/db/schema";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function LearnerCalendarPage(
  props: PageProps<"/learners/[id]">,
) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const { id } = await props.params;

  // Only hosts with an accepted assignment may open a learner's calendar.
  const [assignment] = await db
    .select({ learnerName: user.name })
    .from(hostAssignment)
    .innerJoin(user, eq(user.id, hostAssignment.learnerId))
    .where(
      and(
        eq(hostAssignment.learnerId, id),
        eq(hostAssignment.hostId, session.user.id),
        eq(hostAssignment.status, "accepted"),
      ),
    );

  if (!assignment) {
    notFound();
  }

  return (
    <AppShell active="calendar">
      <CalendarView
        ownerId={id}
        readOnly
        title={`${assignment.learnerName}'s calendar`}
      />
    </AppShell>
  );
}
