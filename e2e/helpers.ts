import { expect, type Page } from "@playwright/test";

export const PASSWORD = "password123";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@e2e.test`;
}

// Material text fields render a native input (or textarea) inside their
// shadow DOM; Playwright locators pierce shadow roots automatically.
export function textField(page: Page, name: string) {
  return page.locator(
    `md-outlined-text-field[name="${name}"] :is(input, textarea)`,
  );
}

export async function register(
  page: Page,
  {
    name,
    email,
    role = "apprentice",
  }: { name: string; email: string; role?: "apprentice" | "host" },
) {
  const [firstName, ...rest] = name.split(" ");
  await page.goto("/register");
  await textField(page, "firstName").fill(firstName);
  await textField(page, "lastName").fill(rest.join(" ") || "Test");
  await textField(page, "email").fill(email);
  await textField(page, "password").fill(PASSWORD);
  await page.locator('input[name="birthday"]').fill("2007-03-14");
  if (role === "host") {
    await page.locator('md-radio[value="host"]').click();
  } else {
    await page.locator('input[name="apprenticeshipStart"]').fill("2024-08-01");
  }
  await page.locator("md-filled-button").click();
  await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });
}

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await textField(page, "email").fill(email);
  await textField(page, "password").fill(PASSWORD);
  await page.locator("md-filled-button").click();
  await expect(page.locator(".fc")).toBeVisible({ timeout: 15_000 });
}

export async function signOut(page: Page) {
  // React 19 sets aria-label as an ARIA property (no attribute); the title
  // attribute is reflected and therefore selectable.
  await page.locator('md-icon-button[title="Sign out"]').click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
}

// Drags over the tuesday 09:00-10:00 slots of the current week to open the
// creation dialog, like a user planning a block in the calendar.
export async function dragCreateSlot(page: Page) {
  const column = page.locator(".fc-timegrid-col.fc-day-tue");
  const columnBox = await column.boundingBox();
  const slotStart = page.locator('td.fc-timegrid-slot-lane[data-time="09:00:00"]');
  const startBox = await slotStart.boundingBox();
  const slotEnd = page.locator('td.fc-timegrid-slot-lane[data-time="10:00:00"]');
  const endBox = await slotEnd.boundingBox();
  if (!columnBox || !startBox || !endBox) {
    throw new Error("Calendar grid not found");
  }

  const x = columnBox.x + columnBox.width / 2;
  await page.mouse.move(x, startBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(x, endBox.y + 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator("md-dialog")).toBeVisible();
}
