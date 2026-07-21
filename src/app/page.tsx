import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell active="calendar">
      <CalendarView />
    </AppShell>
  );
}
