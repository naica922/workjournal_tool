import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { ExportView } from "@/components/export/export-view";

export const metadata = { title: "Export" };

export default async function ExportPage() {
  const session = await requireProfile();
  const role = session.user.role === "host" ? "host" : "apprentice";

  return (
    <AppShell active="export" role={role} userName={session.user.name}>
      <ExportView />
    </AppShell>
  );
}
