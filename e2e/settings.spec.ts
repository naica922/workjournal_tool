import { expect, test } from "@playwright/test";
import { register, textField, uniqueEmail } from "./helpers";

test("apprentice edits their profile and switches to a host account", async ({
  page,
}) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "Edit Me", email });

  // Report a bug lives in the top bar; Export is no longer a nav tab.
  await expect(page.getByRole("link", { name: "Report a bug" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Export" })).toHaveCount(0);

  await page.getByRole("link", { name: "Settings" }).click();

  // Personal fields are editable now (not read-only text).
  await textField(page, "firstName").fill("Renamed");
  await page.locator("md-filled-button", { hasText: "Save" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // Export moved into settings.
  await expect(page.getByText("Export your journal")).toBeVisible();

  // Self-service, double-confirmed role switch to host.
  await page
    .locator("md-outlined-button", { hasText: "Switch to host account" })
    .click();
  await page
    .locator("md-filled-button", { hasText: "Yes, switch me to host" })
    .click();

  // Now a host: the apprentices nav entry appears.
  await expect(
    page.getByRole("link", { name: "My apprentices" }),
  ).toBeVisible({ timeout: 15_000 });
});
