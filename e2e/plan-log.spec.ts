import { expect, test } from "@playwright/test";
import { dragCreateSlot, register, textField, uniqueEmail } from "./helpers";

test("apprentice keeps this week's log and next week's plan separate", async ({
  page,
}) => {
  await register(page, {
    name: "Plan Tester",
    email: uniqueEmail("apprentice"),
  });

  // The mode toggle and the submission countdown are shown.
  await expect(page.getByRole("tab", { name: "Log · this week" })).toBeVisible();
  await expect(page.getByText(/Auto-submits Friday 18:00/)).toBeVisible();

  // Create a log entry in the current week.
  await dragCreateSlot(page);
  await textField(page, "title").fill("Log entry");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  await expect(page.locator(".fc-event", { hasText: "Log entry" })).toBeVisible({
    timeout: 15_000,
  });

  // Switch to Plan (next week): the log entry is not shown here.
  await page.getByRole("tab", { name: "Plan · next week" }).click();
  await expect(page.locator(".fc-event", { hasText: "Log entry" })).toHaveCount(
    0,
  );

  // Plan a next-week entry.
  await dragCreateSlot(page);
  await textField(page, "title").fill("Plan entry");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  await expect(
    page.locator(".fc-event", { hasText: "Plan entry" }),
  ).toBeVisible({ timeout: 15_000 });

  // Back to the log: the plan entry is not shown, the log entry is.
  await page.getByRole("tab", { name: "Log · this week" }).click();
  await expect(page.locator(".fc-event", { hasText: "Plan entry" })).toHaveCount(
    0,
  );
  await expect(
    page.locator(".fc-event", { hasText: "Log entry" }),
  ).toBeVisible();
});
