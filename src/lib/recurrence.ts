import type { CalendarBlock } from "@/db/schema";

export type BlockOccurrence = Omit<CalendarBlock, "start" | "end"> & {
  start: Date;
  end: Date;
  // For recurring blocks: id of the concrete occurrence shown in the
  // calendar; editing an occurrence always edits the whole series.
  occurrenceId: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Expands calendar blocks into the concrete occurrences that fall inside
 * [rangeStart, rangeEnd). Non-recurring blocks yield at most one occurrence;
 * weekly/biweekly blocks yield one per interval from their start onwards
 * (recurrences never occur before the block's own start).
 */
export function expandOccurrences(
  blocks: CalendarBlock[],
  rangeStart: Date,
  rangeEnd: Date,
): BlockOccurrence[] {
  const result: BlockOccurrence[] = [];

  for (const block of blocks) {
    const start = new Date(block.start);
    const end = new Date(block.end);
    const duration = end.getTime() - start.getTime();

    if (block.recurrence === "none") {
      if (start < rangeEnd && end > rangeStart) {
        result.push({ ...block, start, end, occurrenceId: block.id });
      }
      continue;
    }

    const intervalMs = block.recurrence === "weekly" ? WEEK_MS : 2 * WEEK_MS;

    // First interval index whose occurrence could still overlap the range.
    const firstIndex = Math.max(
      0,
      Math.ceil((rangeStart.getTime() - duration - start.getTime()) / intervalMs),
    );

    for (let i = firstIndex; ; i++) {
      const occurrenceStart = new Date(start.getTime() + i * intervalMs);
      if (occurrenceStart >= rangeEnd) {
        break;
      }
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      if (occurrenceEnd > rangeStart) {
        result.push({
          ...block,
          start: occurrenceStart,
          end: occurrenceEnd,
          occurrenceId: `${block.id}:${occurrenceStart.toISOString()}`,
        });
      }
    }
  }

  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}
