import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { ProjectsView } from "@/components/projects/projects-view";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const session = await requireProfile();
  const role = session.user.role === "host" ? "host" : "apprentice";

  return (
    <AppShell active="projects" role={role} userName={session.user.name}>
      <ProjectsView />
    </AppShell>
  );
}
