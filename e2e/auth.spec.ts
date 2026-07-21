import { expect, test } from "@playwright/test";
import { register, signIn, signOut, uniqueEmail } from "./helpers";

test("UC-01: the login screen is the first screen a visitor sees", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Arbeitsjournal Tool" })).toBeVisible();
});

test("UC-02: the sign-up link navigates to the registration screen", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/register/);
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
});

test("UC-03: signing in navigates to the calendar", async ({ page }) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });
  await signOut(page);

  await signIn(page, email);
  await expect(page.locator(".fc")).toBeVisible();
});

test("UC-04: the navigation rail leads to the settings screen", async ({
  page,
}) => {
  const email = uniqueEmail("apprentice");
  await register(page, { name: "E2E Apprentice", email });

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My hosts" })).toBeVisible();
});

test("registration rejects a duplicate email address", async ({ page }) => {
  const email = uniqueEmail("dupe");
  await register(page, { name: "First Account", email });
  await signOut(page);

  await page.goto("/register");
  await page
    .locator('md-outlined-text-field[name="name"] input')
    .fill("Second Account");
  await page.locator('md-outlined-text-field[name="email"] input').fill(email);
  await page
    .locator('md-outlined-text-field[name="password"] input')
    .fill("password123");
  await page.locator("md-filled-button").click();

  await expect(page.locator("form")).toContainText(/already exists/i);
  await expect(page).toHaveURL(/\/register/);
});
