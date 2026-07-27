import { requireProfile } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { TodosView } from "@/components/todos/todos-view";

export const metadata = { title: "To-dos" };

export default async function TodosPage() {
  const session = await requireProfile();
  const role = session.user.role === "host" ? "host" : "apprentice";

  return (
    <AppShell active="todos" role={role} userName={session.user.name}>
      <TodosView />
    </AppShell>
  );
}
