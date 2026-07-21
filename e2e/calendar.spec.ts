import { expect, test } from "@playwright/test";
import {
  dragCreateSlot,
  register,
  textField,
  uniqueEmail,
} from "./helpers";

test("UC-05/UC-06: a learner creates a calendar block with details and sees it in the calendar", async ({
  page,
}) => {
  const email = uniqueEmail("learner");
  await register(page, { name: "E2E Learner", email });

  await dragCreateSlot(page);

  await textField(page, "title").fill("Write IPA documentation");
  await textField(page, "blockers").fill("Waiting for review from my host");
  // Pick the green color swatch.
  await page.getByRole("radio", { name: "Green" }).click();
  await page.locator("md-filled-button", { hasText: "Save" }).click();

  const event = page.locator(".fc-event", {
    hasText: "Write IPA documentation",
  });
  await expect(event).toBeVisible({ timeout: 15_000 });
  // The chosen green color is applied to the event block.
  await expect(event).toHaveCSS("background-color", "rgb(51, 182, 121)");
  // The event shows its time range.
  await expect(event).toContainText("09:00");
});

test("a created block can be edited and deleted", async ({ page }) => {
  const email = uniqueEmail("learner");
  await register(page, { name: "E2E Learner", email });

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

test("host flow: invited host accepts and sees the learner's calendar read-only", async ({
  page,
}) => {
  const learnerEmail = uniqueEmail("learner");
  const hostEmail = uniqueEmail("host");

  // Learner creates a block and invites the host.
  await register(page, { name: "E2E Learner", email: learnerEmail });
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

  // Host registers, accepts, and opens the learner's calendar.
  await register(page, { name: "E2E Host", email: hostEmail, role: "host" });
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("E2E Learner")).toBeVisible();
  await page.locator("md-filled-button", { hasText: "Accept" }).click();
  await expect(
    page.locator("md-outlined-button", { hasText: "Open calendar" }),
  ).toBeVisible();
  await page.locator("md-outlined-button", { hasText: "Open calendar" }).click();

  await expect(page.getByRole("heading", { name: /E2E Learner's calendar/ })).toBeVisible();
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
