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

  // The period may be given as an explicit from/to range (used by the Export
  // tab, including its custom option) or as a number of months (used by the
  // host's quick-export links). from/to wins when both are valid.
  const parseDate = (value: string | null) => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const fromParam = parseDate(url.searchParams.get("from"));
  const toParam = parseDate(url.searchParams.get("to"));

  let from: Date;
  let to: Date;
  let rangeLabel: string;
  if (fromParam && toParam && fromParam <= toParam) {
    from = fromParam;
    // Include the whole end day.
    to = new Date(toParam);
    to.setHours(23, 59, 59, 999);
    rangeLabel = `${url.searchParams.get("from")}_${url.searchParams.get("to")}`;
  } else {
    const months = Math.min(
      24,
      Math.max(1, Number(url.searchParams.get("months") ?? 6)),
    );
    to = new Date();
    from = new Date();
    from.setMonth(from.getMonth() - months);
    rangeLabel = `${months}m`;
  }

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
      "Content-Disposition": `attachment; filename="workjournal-${safeName}-${rangeLabel}.pdf"`,
    },
  });
}
