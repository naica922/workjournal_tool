import { getSession } from "@/lib/session";
import { getProfile } from "@/server/settings";
import { BugReportForm } from "@/components/bug-report-form";

export const metadata = { title: "Report a bug" };

// Public page: reachable without a session so a bug that blocks sign-in can
// still be reported. When signed in, name and email are prefilled.
export default async function ReportBugPage() {
  const session = await getSession();
  let identity: { firstName: string; lastName: string; email: string } | null =
    null;
  if (session) {
    try {
      const profile = await getProfile();
      identity = {
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        email: profile.email,
      };
    } catch {
      identity = null;
    }
  }

  return <BugReportForm identity={identity} />;
}
