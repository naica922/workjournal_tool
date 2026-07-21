"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./app-shell.module.css";

// Sidebar "Create" button like in the mock. On the calendar page it opens the
// event dialog directly; elsewhere it navigates home first and opens it there.
export function CreateEventButton() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/" && window.sessionStorage.getItem("wj-create")) {
      window.sessionStorage.removeItem("wj-create");
      window.dispatchEvent(new CustomEvent("workjournal:create"));
    }
  }, [pathname]);

  function handleClick() {
    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent("workjournal:create"));
    } else {
      window.sessionStorage.setItem("wj-create", "1");
      router.push("/");
    }
  }

  return (
    <button type="button" className={styles.createButton} onClick={handleClick}>
      <md-icon>add</md-icon>
      Create
    </button>
  );
}
