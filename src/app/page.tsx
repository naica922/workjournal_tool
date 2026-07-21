import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const role = session.user.role === "host" ? "host" : "apprentice";

  return (
    <AppShell active="calendar" role={role}>
      <CalendarView title={role === "host" ? "My journal" : undefined} />
    </AppShell>
  );
}
