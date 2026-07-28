import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { CreateEventButton } from "@/components/create-event-button";
import { TopBar } from "@/components/top-bar";
import styles from "./app-shell.module.css";

// Material Symbols outlined font is loaded in the root layout; the md-icon
// component renders the glyph by its name.
export function AppShell({
  active,
  role = "apprentice",
  userName = "",
  railExtra,
  children,
}: {
  active:
    | "calendar"
    | "todos"
    | "projects"
    | "export"
    | "apprentices"
    | "settings";
  role?: "apprentice" | "host";
  userName?: string;
  railExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isHost = role === "host";

  return (
    <div className={styles.shell}>
      <TopBar userName={userName} role={role} active={active} />
      <div className={styles.body}>
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
          {!isHost && (
            <>
              <Link
                href="/todos"
                className={
                  active === "todos" ? styles.railLinkActive : styles.railLink
                }
              >
                <md-icon>checklist</md-icon>
                To-dos
              </Link>
              <Link
                href="/projects"
                className={
                  active === "projects"
                    ? styles.railLinkActive
                    : styles.railLink
                }
              >
                <md-icon>folder</md-icon>
                Projects
              </Link>
            </>
          )}
          {isHost && (
            <Link
              href="/apprentices"
              className={
                active === "apprentices"
                  ? styles.railLinkActive
                  : styles.railLink
              }
            >
              <md-icon>group</md-icon>
              My apprentices
            </Link>
          )}
          <Link
            href="/export"
            className={
              active === "export" ? styles.railLinkActive : styles.railLink
            }
          >
            <md-icon>picture_as_pdf</md-icon>
            Export
          </Link>
          <Link
            href="/settings"
            className={
              active === "settings" ? styles.railLinkActive : styles.railLink
            }
          >
            <md-icon>settings</md-icon>
            Settings
          </Link>
          {railExtra}
          <div className={styles.railSpacer} />
          <Link href="/report-bug" className={styles.railLinkMuted}>
            <md-icon>bug_report</md-icon>
            Report a bug
          </Link>
          <SignOutButton iconOnly />
        </nav>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
