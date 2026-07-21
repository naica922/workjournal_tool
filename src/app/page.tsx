import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignOutButton } from "@/components/auth/sign-out-button";
import styles from "./page.module.css";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className="headline-small">
          Welcome, {session.user.name || session.user.email}
        </h1>
        <p className="body-medium">
          The weekly calendar will appear here in the next step.
        </p>
        <SignOutButton />
      </main>
    </div>
  );
}
