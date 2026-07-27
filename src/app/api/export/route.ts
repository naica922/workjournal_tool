import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarBlock, hostAssignment, project, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { buildWorkSummary } from "@/lib/work-summary";
import { renderWorkSummaryPdf } from "@/lib/work-summary-pdf";

export const runtime = "nodejs";

// GET /api/export?months=6&apprenticeId=... → work summary PDF download.
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const months = Math.min(
    24,
    Math.max(1, Number(url.searchParams.get("months") ?? 6)),
  );
  const apprenticeId = url.searchParams.get("apprenticeId") ?? session.user.id;

  // A host may export a calendar only for an apprentice that granted access.
  if (apprenticeId !== session.user.id) {
    const assignment = await db.query.hostAssignment.findFirst({
      where: and(
        eq(hostAssignment.apprenticeId, apprenticeId),
        eq(hostAssignment.hostId, session.user.id),
        eq(hostAssignment.status, "accepted"),
      ),
    });
    if (!assignment) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  const [owner, projects, blocks] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, apprenticeId) }),
    db.query.project.findMany({ where: eq(project.userId, apprenticeId) }),
    db.query.calendarBlock.findMany({
      where: eq(calendarBlock.userId, apprenticeId),
    }),
  ]);

  const personName = owner?.name ?? "Apprentice";
  const summary = buildWorkSummary(personName, projects, blocks, from, to);
  const pdf = await renderWorkSummaryPdf(summary);

  const safeName = personName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="workjournal-${safeName}-${months}m.pdf"`,
    },
  });
}
