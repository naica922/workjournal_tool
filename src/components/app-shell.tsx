import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreateEventButton } from "@/components/create-event-button";
import styles from "./app-shell.module.css";

// Material Symbols outlined font is loaded in the root layout; the md-icon
// component renders the glyph by its name.
export function AppShell({
  active,
  role = "apprentice",
  children,
}: {
  active: "calendar" | "apprentices" | "settings";
  role?: "apprentice" | "host";
  children: React.ReactNode;
}) {
  const isHost = role === "host";

  return (
    <div className={styles.shell}>
      <nav className={styles.rail} aria-label="Main navigation">
        <CreateEventButton />
        <Link
          href="/"
          className={
            active === "calendar" ? styles.railLinkActive : styles.railLink
          }
        >
          <md-icon>calendar_month</md-icon>
          {isHost ? "My journal" : "Calendar"}
        </Link>
        {isHost && (
          <Link
            href="/apprentices"
            className={
              active === "apprentices" ? styles.railLinkActive : styles.railLink
            }
          >
            <md-icon>group</md-icon>
            My apprentices
          </Link>
        )}
        <Link
          href="/settings"
          className={
            active === "settings" ? styles.railLinkActive : styles.railLink
          }
        >
          <md-icon>settings</md-icon>
          Settings
        </Link>
        <div className={styles.railSpacer} />
        <SignOutButton iconOnly />
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
