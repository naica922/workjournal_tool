import { expect, test } from "@playwright/test";
import {
  dragCreateSlot,
  register,
  textField,
  uniqueEmail,
} from "./helpers";

test("UC-05/UC-06: an apprentice creates a calendar block with details and sees it in the calendar", async ({
  page,
}) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  await dragCreateSlot(page);

  await textField(page, "title").fill("Write IPA documentation");
  // Blockers live in a collapsible section as blocker/solution pairs.
  await page.getByRole("button", { name: /Blockers & solutions/ }).click();
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
  // The chosen green color is applied to the block (as a pastel mix).
  await expect(event).toHaveAttribute(
    "style",
    /color-mix\(in srgb, (#33b679|rgb\(51, 182, 121\)) 30%, white\)/,
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
  await expect(page.locator("md-dialog")).toBeVisible();
  await textField(page, "title").fill("Renamed block");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  const renamed = page.locator(".fc-event", { hasText: "Renamed block" });
  await expect(renamed).toBeVisible({ timeout: 15_000 });

  // Delete it.
  await renamed.click();
  await expect(page.locator("md-dialog")).toBeVisible();
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
  await expect(page.getByText("E2E Apprentice")).toBeVisible();
  await page.locator("md-filled-button", { hasText: "Accept" }).click();
  await expect(
    page.locator("md-outlined-button", { hasText: "Open calendar" }),
  ).toBeVisible();
  await page.locator("md-outlined-button", { hasText: "Open calendar" }).click();

  await expect(page.getByRole("heading", { name: /E2E Apprentice's calendar/ })).toBeVisible();
  const event = page.locator(".fc-event", { hasText: "Visible to host" });
  await expect(event).toBeVisible({ timeout: 15_000 });

  // Read-only: opening the event shows no save button.
  await event.click();
  await expect(page.locator("md-dialog")).toBeVisible();
  await expect(
    page.locator("md-filled-button", { hasText: "Save" }),
  ).toHaveCount(0);
  await expect(page.locator("md-text-button", { hasText: "Close" })).toBeVisible();
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
  await page
    .locator('md-outlined-select[name="projectId"]')
    .evaluate((select: HTMLSelectElement, name) => {
      const option = [...select.querySelectorAll("md-select-option")].find(
        (o) => o.textContent?.includes(name),
      ) as (Element & { value: string }) | undefined;
      select.value = option!.value;
    }, "Coop event");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  await expect(page.locator("md-dialog")).toHaveCount(0, { timeout: 15_000 });

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
