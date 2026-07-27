import type { CalendarBlock } from "@/db/schema";

export type BlockOccurrence = Omit<CalendarBlock, "start" | "end"> & {
  start: Date;
  end: Date;
  // For recurring blocks: id of the concrete occurrence shown in the
  // calendar; editing an occurrence always edits the whole series.
  occurrenceId: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Milliseconds between occurrences for a block's recurrence, or null for none.
function recurrenceIntervalMs(block: CalendarBlock): number | null {
  switch (block.recurrence) {
    case "daily":
      return DAY_MS;
    case "weekly":
      return WEEK_MS;
    case "biweekly":
      return 2 * WEEK_MS;
    case "custom": {
      const interval = block.recurrenceInterval ?? 1;
      const unit = block.recurrenceUnit === "week" ? WEEK_MS : DAY_MS;
      return Math.max(1, interval) * unit;
    }
    default:
      return null;
  }
}

/**
 * Expands calendar blocks into the concrete occurrences that fall inside
 * [rangeStart, rangeEnd). Non-recurring blocks yield at most one occurrence;
 * recurring blocks yield one per interval from their start onwards
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

    const intervalMs = recurrenceIntervalMs(block);
    if (intervalMs === null) {
      if (start < rangeEnd && end > rangeStart) {
        result.push({ ...block, start, end, occurrenceId: block.id });
      }
      continue;
    }

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
