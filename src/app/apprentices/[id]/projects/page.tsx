import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hostAssignment, user } from "@/db/schema";
import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { ProjectsView } from "@/components/projects/projects-view";

export default async function ApprenticeProjectsPage(
  props: PageProps<"/apprentices/[id]/projects">,
) {
  const session = await requireProfile();
  const { id } = await props.params;

  // Only hosts with an accepted assignment may see an apprentice's projects.
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
      <ProjectsView ownerId={id} readOnly />
    </AppShell>
  );
}
