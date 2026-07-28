import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { CalendarView } from "@/components/calendar/calendar-view";
import { MiniMonth } from "@/components/calendar/mini-month";

export default async function Home() {
  const session = await requireProfile();
  const role = session.user.role === "host" ? "host" : "apprentice";

  return (
    <AppShell
      active="calendar"
      role={role}
      userName={session.user.name}
      railExtra={<MiniMonth />}
    >
      <CalendarView />
    </AppShell>
  );
}
