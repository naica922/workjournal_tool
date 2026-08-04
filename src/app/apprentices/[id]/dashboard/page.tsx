import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hostAssignment, user } from "@/db/schema";
import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { ApprenticeDashboard } from "@/components/calendar/apprentice-dashboard";

export const metadata = { title: "Apprentice" };

export default async function ApprenticeDashboardPage(
  props: PageProps<"/apprentices/[id]/dashboard">,
) {
  const session = await requireProfile();
  const { id } = await props.params;

  const [assignment] = await db
    .select({
      apprenticeName: user.name,
      apprenticeshipStart: user.apprenticeshipStart,
    })
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
      <ApprenticeDashboard
        apprenticeId={id}
        apprenticeName={assignment.apprenticeName}
        apprenticeshipStart={assignment.apprenticeshipStart ?? null}
      />
    </AppShell>
  );
}
