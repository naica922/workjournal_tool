import { expect, test } from "@playwright/test";
import { dragCreateSlot, register, textField, uniqueEmail } from "./helpers";

test("apprentice sets a day location and a specific spot on an entry", async ({
  page,
}) => {
  await register(page, { name: "Loc Tester", email: uniqueEmail("apprentice") });

  await dragCreateSlot(page);
  await textField(page, "title").fill("Standup");

  // Day-level work location.
  await page.locator('button[role="radio"]', { hasText: "Home" }).click();
  // Specific spot via a suggestion chip.
  await page.locator("button", { hasText: "8th floor" }).click();

  await page.locator("md-filled-button", { hasText: "Save" }).click();

  const event = page.locator(".fc-event", { hasText: "Standup" });
  await expect(event).toBeVisible({ timeout: 15_000 });
  // The block shows its specific spot.
  await expect(event).toContainText("8th floor");
});
