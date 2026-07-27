import { BugReportForm } from "@/components/bug-report-form";

export const metadata = { title: "Report a bug - Arbeitsjournal Tool" };

// Public page: reachable without a session so a bug that blocks sign-in can
// still be reported.
export default function ReportBugPage() {
  return <BugReportForm />;
}
