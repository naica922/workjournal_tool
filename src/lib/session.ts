import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isProfileComplete } from "@/lib/apprenticeship";

// Data-access-layer session check: validates the session cookie against the
// database. Cached per request so multiple callers share one lookup.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}

// For pages: requires a session AND a completed profile. Accounts created
// via Google sign-in are sent through the one-time onboarding first.
export async function requireProfile() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!isProfileComplete(session.user)) {
    redirect("/complete-profile");
  }
  return session;
}
