import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hostAssignment, user } from "@/db/schema";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function ApprenticeCalendarPage(
  props: PageProps<"/apprentices/[id]">,
) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const { id } = await props.params;

  // Only hosts with an accepted assignment may open an apprentice's calendar.
  const [assignment] = await db
    .select({ apprenticeName: user.name })
    .from(hostAssignment)
    .innerJoin(user, eq(user.id, hostAssignment.apprenticeId))
    .where(
      and(
        eq(hostAssignment.apprenticeId, id),
        eq(hostAssignment.hostId, session.user.id),
        eq(hostAssignment.status, "accepted"),
      ),
    );

  if (!assignment) {
    notFound();
  }

  return (
    <AppShell active="apprentices" role="host" userName={session.user.name}>
      <CalendarView
        ownerId={id}
        readOnly
        title={`${assignment.apprenticeName}'s calendar`}
      />
    </AppShell>
  );
}
