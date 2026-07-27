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

// Reads the newest verification code Mailpit received for the address.
async function fetchOtp(page: Page, email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await page.request.get(
      `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const { messages } = await search.json();
    if (messages?.length) {
      const detail = await page.request.get(
        `http://localhost:8025/api/v1/message/${messages[0].ID}`,
      );
      const { Text } = await detail.json();
      const match = Text.match(/\b(\d{6})\b/);
      if (match) {
        return match[1];
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`No verification code arrived for ${email}`);
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

  // Email verification: enter the code that Mailpit received.
  await expect(page).toHaveURL(/\/verify-email/, { timeout: 15_000 });
  const otp = await fetchOtp(page, email);
  await textField(page, "otp").fill(otp);
  await page.locator("md-filled-button", { hasText: "Verify" }).click();
  await expect(page.getByText("Email verified")).toBeVisible({
    timeout: 15_000,
  });

  await signIn(page, email);
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
  const dialog = page.locator("md-dialog");

  // The drag-select occasionally does not register; retry a couple of times.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.mouse.move(x, startBox.y + 2);
    await page.mouse.down();
    // Release in the second half of the 10:00 slot: with 15-minute snapping
    // the selection then ends at 10:30.
    await page.mouse.move(x, endBox.y + endBox.height / 2 + 2, { steps: 8 });
    await page.mouse.up();
    try {
      await expect(dialog).toBeVisible({ timeout: 2000 });
      return;
    } catch {
      // retry
    }
  }
  await expect(dialog).toBeVisible();
}
