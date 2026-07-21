import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { HostDashboard } from "@/components/settings/host-dashboard";
import styles from "@/app/settings/settings.module.css";

export const metadata = { title: "My apprentices - Arbeitsjournal Tool" };

export default async function ApprenticesPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "host") {
    redirect("/");
  }

  return (
    <AppShell active="apprentices" role="host" userName={session.user.name}>
      <div className={styles.page}>
        <h1 className={`${styles.heading} headline-small`}>My apprentices</h1>
        <HostDashboard />
      </div>
    </AppShell>
  );
}
