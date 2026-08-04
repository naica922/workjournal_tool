import { expect, test } from "@playwright/test";
import {
  dragCreateSlot,
  register,
  signIn,
  textField,
  uniqueEmail,
} from "./helpers";

test("UC-05/UC-06: an apprentice creates a calendar block with details and sees it in the calendar", async ({
  page,
}) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  // Plan in the future so the block keeps its saturated colour (past blocks
  // fade to pastel).
  await dragCreateSlot(page, { nextWeek: true });

  await textField(page, "title").fill("Write IPA documentation");
  // Blockers live in a collapsible section as blocker/solution pairs. The
  // card is collapsed by default (progressive disclosure), so open it first.
  await page
    .locator("button", { hasText: "Blockers & solutions" })
    .click();
  await page.locator("md-text-button", { hasText: "Add blocker" }).click();
  await page
    .locator('[data-testid="blocker-0"] textarea')
    .fill("Waiting for review from my host");
  await page
    .locator('[data-testid="solution-0"] textarea')
    .fill("Asked in the team chat");
  // Pick the green color swatch.
  await page.getByRole("radio", { name: "Green" }).click();
  await page.locator("md-filled-button", { hasText: "Save" }).click();

  const event = page.locator(".fc-event", {
    hasText: "Write IPA documentation",
  });
  await expect(event).toBeVisible({ timeout: 15_000 });
  // The chosen green color fills the block (saturated, like the mock).
  await expect(event).toHaveAttribute(
    "style",
    /background-color:\s*(#33b679|rgb\(51, 182, 121\))/,
  );
  // The block shows its time range like in the mock.
  await expect(event).toContainText("09:00 – 10:30");
});

test("a created block can be edited and deleted", async ({ page }) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  await dragCreateSlot(page);
  await textField(page, "title").fill("Initial title");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  const event = page.locator(".fc-event", { hasText: "Initial title" });
  await expect(event).toBeVisible({ timeout: 15_000 });

  // Edit the title.
  await event.click();
  await expect(page.locator('md-dialog, aside[role="dialog"]')).toBeVisible();
  await textField(page, "title").fill("Renamed block");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  const renamed = page.locator(".fc-event", { hasText: "Renamed block" });
  await expect(renamed).toBeVisible({ timeout: 15_000 });

  // Delete it.
  await renamed.click();
  await expect(page.locator('md-dialog, aside[role="dialog"]')).toBeVisible();
  await page.locator("md-text-button", { hasText: "Delete" }).click();
  await expect(page.locator(".fc-event")).toHaveCount(0, { timeout: 15_000 });
});

test("host flow: invited host accepts and sees the apprentice's calendar read-only", async ({
  page,
}) => {
  const apprenticeEmail = uniqueEmail("apprentice");
  const hostEmail = uniqueEmail("host");

  // Apprentice creates a block and invites the host.
  await register(page, { name: "E2E Apprentice", email: apprenticeEmail });
  await dragCreateSlot(page);
  await textField(page, "title").fill("Visible to host");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  await expect(
    page.locator(".fc-event", { hasText: "Visible to host" }),
  ).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Settings" }).click();
  await textField(page, "hostEmail").fill(hostEmail);
  await page.locator("md-filled-tonal-button").click();
  await expect(page.getByText("Pending")).toBeVisible();
  await page.locator('md-icon-button[title="Sign out"]').click();
  await expect(page).toHaveURL(/\/login/);

  // Host registers, accepts, and opens the apprentice's calendar.
  await register(page, { name: "E2E Host", email: hostEmail, role: "host" });
  await page.getByRole("link", { name: "My apprentices" }).click();
  await expect(page.getByText("E2E Apprentice")).toBeVisible({
    timeout: 15_000,
  });
  // Let both the invites and apprentices queries settle so the Accept button
  // does not detach mid-click when the second query resolves.
  await page.waitForLoadState("networkidle");
  await page.locator("md-filled-button", { hasText: "Accept" }).click();
  await expect(
    page.locator("md-filled-tonal-button", { hasText: "Inspect" }),
  ).toBeVisible();

  // The list flags last week's status: this apprentice logged nothing then.
  await expect(page.getByText(/Under 40 h/)).toBeVisible();

  // The host can export this apprentice's journal from the list.
  await page.locator("md-text-button", { hasText: "Export" }).click();
  await expect(
    page.getByText("A written summary of what you worked on"),
  ).toBeVisible();
  const exportLink = page.locator("a[download]");
  await expect(exportLink).toBeVisible();
  await expect(exportLink).toHaveAttribute(
    "href",
    /\/api\/export\?.*apprenticeId=/,
  );

  // Inspect opens the per-apprentice dashboard with recent-week stats.
  await page.locator("md-filled-tonal-button", { hasText: "Inspect" }).click();
  await expect(page.getByText("Recent weeks")).toBeVisible();
  await expect(page.getByText("Hours (last week)")).toBeVisible();

  await page
    .locator("md-outlined-button", { hasText: "Open calendar" })
    .click();

  await expect(page.getByRole("heading", { name: /E2E Apprentice's calendar/ })).toBeVisible();
  const event = page.locator(".fc-event", { hasText: "Visible to host" });
  await expect(event).toBeVisible({ timeout: 15_000 });

  // Read-only: opening the event shows a clean summary, not an editable form.
  await event.click();
  const detail = page.locator('md-dialog, aside[role="dialog"]');
  await expect(detail).toBeVisible();
  // The entry's title is the heading; the details are labelled, read-only.
  await expect(detail.getByText("Visible to host")).toBeVisible();
  await expect(detail.getByText("When", { exact: true })).toBeVisible();
  // No editable title field and no save button.
  await expect(detail.locator('md-outlined-text-field[name="title"]')).toHaveCount(
    0,
  );
  await expect(
    page.locator("md-filled-button", { hasText: "Save" }),
  ).toHaveCount(0);
  await expect(page.locator("md-text-button", { hasText: "Close" })).toBeVisible();
  await page.locator("md-text-button", { hasText: "Close" }).click();

  // The host turns on daily submission for this apprentice.
  await page.getByRole("link", { name: "My apprentices" }).click();
  const dailySwitch = page.locator("md-switch").first();
  await dailySwitch.click();
  await expect(dailySwitch).toHaveJSProperty("selected", true);

  // Signing back in as the apprentice, they now see the daily reminder.
  await page.context().clearCookies();
  await signIn(page, apprenticeEmail);
  await expect(page.getByText(/Daily submission required/)).toBeVisible({
    timeout: 15_000,
  });
});

test("projects: assigned events aggregate hours in the projects view", async ({
  page,
}) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  // Create a project.
  await page.getByRole("link", { name: "Projects" }).click();
  await textField(page, "name").fill("Coop event");
  await page.locator("md-filled-tonal-button", { hasText: "Create" }).click();
  await expect(page.getByText("Coop event")).toBeVisible();

  // Create an event assigned to the project. It is moved a week into the
  // past so the time counts as invested regardless of the current time.
  await page.getByRole("link", { name: "Calendar" }).click();
  await dragCreateSlot(page);
  await textField(page, "title").fill("Coop planning");
  const lastWeek = new Date(Date.now() - 7 * 864e5);
  const pad = (n: number) => String(n).padStart(2, "0");
  await page
    .locator('input[name="date"]')
    .fill(
      `${lastWeek.getFullYear()}-${pad(lastWeek.getMonth() + 1)}-${pad(lastWeek.getDate())}`,
    );
  // Pick the project via its one-click chip.
  await page
    .locator('button[role="radio"]', { hasText: "Coop event" })
    .click();
  // With a project chosen, the colour is inherited (no colour picker).
  await expect(page.getByText(/Colour inherited from Coop event/)).toBeVisible();
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  await expect(page.locator('md-dialog, aside[role="dialog"]')).toHaveCount(0, { timeout: 15_000 });

  // The projects view shows the invested time and the event.
  await page.getByRole("link", { name: "Projects" }).click();
  const card = page
    .locator("section", { has: page.getByRole("button", { name: /Coop event/ }) })
    .last();
  await expect(card.getByText("1 h 30 min")).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: /Coop event/ }).click();
  await expect(card.getByText("Coop planning")).toBeVisible();
});

test("drag reschedules an event", async ({ page }) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  await dragCreateSlot(page);
  await textField(page, "title").fill("Movable");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  // Exclude the drag mirror FullCalendar shows during an interaction.
  const event = page.locator(".fc-event:not(.fc-event-mirror)", {
    hasText: "Movable",
  });
  await expect(event).toBeVisible({ timeout: 15_000 });
  await expect(event).toContainText("09:00 – 10:30");

  // One hour in pixels = distance between the 09:00 and 10:00 slot lanes.
  const slot9 = await page
    .locator('td.fc-timegrid-slot-lane[data-time="09:00:00"]')
    .boundingBox();
  const slot10 = await page
    .locator('td.fc-timegrid-slot-lane[data-time="10:00:00"]')
    .boundingBox();
  const hourPx = slot10!.y - slot9!.y;

  // Drag the event down by about one hour; it now starts an hour later
  // (exact minute depends on 15-minute snapping).
  const box = await event.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 4);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 4 + hourPx, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(event).toContainText(/10:(00|15) – 11:(30|45)/, {
    timeout: 15_000,
  });
});

test("create shows a live draft that syncs with the side panel", async ({
  page,
}) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  // Drag-select opens the non-blocking panel and drops a live draft on the
  // grid (dashed outline) at Tuesday 09:00–10:30.
  await dragCreateSlot(page);
  const draftEvent = page.locator(".fc-event.wj-draft");
  await expect(draftEvent).toBeVisible();
  await expect(draftEvent).toContainText("09:00 – 10:30");

  // Panel -> grid: changing the end time in the panel resizes the draft.
  await page.locator('label:has-text("To") select').selectOption("11:00");
  await expect(draftEvent).toContainText("09:00 – 11:00");

  // Grid -> panel: dragging the draft down by an hour updates the panel time.
  const slot9 = await page
    .locator('td.fc-timegrid-slot-lane[data-time="09:00:00"]')
    .boundingBox();
  const slot10 = await page
    .locator('td.fc-timegrid-slot-lane[data-time="10:00:00"]')
    .boundingBox();
  const hourPx = slot10!.y - slot9!.y;
  const box = await draftEvent.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 6);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 6 + hourPx, {
    steps: 12,
  });
  await page.mouse.up();
  await expect(page.locator('label:has-text("From") select')).toHaveValue(
    /10:(00|15)/,
    { timeout: 15_000 },
  );

  // Saving turns the draft into a real event (the dashed draft disappears).
  await textField(page, "title").fill("Drafted block");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  const saved = page.locator(".fc-event:not(.fc-event-mirror)", {
    hasText: "Drafted block",
  });
  await expect(saved).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".fc-event.wj-draft")).toHaveCount(0);
});
