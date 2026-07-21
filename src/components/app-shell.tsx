import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import styles from "./app-shell.module.css";

// Material Symbols outlined font is loaded in the root layout; the md-icon
// component renders the glyph by its name.
export function AppShell({
  active,
  children,
}: {
  active: "calendar" | "settings";
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <nav className={styles.rail} aria-label="Main navigation">
        <Link
          href="/"
          className={
            active === "calendar" ? styles.railLinkActive : styles.railLink
          }
        >
          <md-icon>calendar_month</md-icon>
          Calendar
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
        <div className={styles.railSpacer} />
        <SignOutButton iconOnly />
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
