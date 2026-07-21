"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  if (iconOnly) {
    return (
      <md-icon-button
        type="button"
        onClick={handleSignOut}
        aria-label="Sign out"
        title="Sign out"
      >
        <md-icon>logout</md-icon>
      </md-icon-button>
    );
  }

  return (
    <md-outlined-button type="button" onClick={handleSignOut}>
      Sign out
    </md-outlined-button>
  );
}
