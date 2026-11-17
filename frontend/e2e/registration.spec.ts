import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("a visitor registers, restores the session, and publishes a film list", async ({ page }) => {
  const name = "viewer" + randomUUID().slice(0, 8);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/register");
  await page.locator("#register-username").fill(name);
  await page.locator("#register-email").fill(name + "@example.test");
  await page.locator("#register-password").fill("ExamplePass123");
  await page.locator("#register-confirm-password").fill("ExamplePass123");
  await page.locator('form button[type="submit"]').click();

  const profileLink = page.getByRole("link", { name, exact: true });
  await expect(profileLink).toBeVisible();
  await profileLink.click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.reload();
  await expect(profileLink).toBeVisible();
  await expect(page).toHaveURL(/\/profile$/);

  const title = "Cinema " + name;
  await page.goto("/lists/new");
  await page.locator("#list-title").fill(title);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(new RegExp("/lists/cinema-" + name + "$"));
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
});
