"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import styles from "./top-bar.module.css";

// App bar like the mocks: brand + avatar on desktop, plus a hamburger menu
// with a navigation drawer on mobile (where the sidebar is hidden).
export function TopBar({
  userName,
  role,
  active,
}: {
  userName: string;
  role: "apprentice" | "host";
  active: "calendar" | "projects" | "export" | "apprentices" | "settings";
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initial = (userName.trim()[0] ?? "?").toUpperCase();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const links = [
    {
      href: "/",
      key: "calendar",
      icon: "calendar_month",
      label: role === "host" ? "My journal" : "Calendar",
    },
    ...(role === "host"
      ? [
          {
            href: "/apprentices",
            key: "apprentices",
            icon: "group",
            label: "My apprentices",
          },
        ]
      : [
          {
            href: "/projects",
            key: "projects",
            icon: "folder",
            label: "Projects",
          },
        ]),
    { href: "/export", key: "export", icon: "picture_as_pdf", label: "Export" },
    { href: "/settings", key: "settings", icon: "settings", label: "Settings" },
  ];

  return (
    <>
      <header className={styles.bar}>
        <md-icon-button
          type="button"
          class={styles.menuButton}
          title="Menu"
          onClick={() => setDrawerOpen(true)}
        >
          <md-icon>menu</md-icon>
        </md-icon-button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" width={28} height={28} className={styles.brandLogo} />
        <span className={styles.brand}>Workjournal</span>
        <Link
          href="/settings"
          className={styles.avatar}
          aria-label="Your profile"
          title="Your profile"
        >
          {initial}
        </Link>
      </header>

      {drawerOpen && (
        <div
          className={styles.scrim}
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <nav
            className={styles.drawer}
            aria-label="Menu"
            onClick={(event) => event.stopPropagation()}
          >
            <span className={`${styles.drawerBrand} title-medium`}>
              Workjournal
            </span>
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className={
                  active === link.key ? styles.drawerLinkActive : styles.drawerLink
                }
                onClick={() => setDrawerOpen(false)}
              >
                <md-icon>{link.icon}</md-icon>
                {link.label}
              </Link>
            ))}
            <Link
              href="/report-bug"
              className={styles.drawerLink}
              onClick={() => setDrawerOpen(false)}
            >
              <md-icon>bug_report</md-icon>
              Report a bug
            </Link>
            <button
              type="button"
              className={styles.drawerLink}
              onClick={handleSignOut}
            >
              <md-icon>logout</md-icon>
              Sign out
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
