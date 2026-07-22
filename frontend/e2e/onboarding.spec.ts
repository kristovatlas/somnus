import { test, expect } from "./fixtures";
import { completeOnboarding } from "./helpers";

test.describe("Onboarding flow", () => {
  test("fresh app redirects to onboarding", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/onboarding/);
    await expect(
      page.getByRole("heading", { name: "Welcome to Somnus" }),
    ).toBeVisible();
  });

  test("can complete onboarding and land on /log", async ({ page }) => {
    await page.goto("/");
    await completeOnboarding(page);

    // Should be on the daily log page
    await expect(page).toHaveURL(/\/log\/\d{4}-\d{2}-\d{2}/);

    // Nav should be visible (Layout is rendering the main app).
    // #36: scope to the nav landmark — the "Somnus" title is also a
    // button accessibly named "Dashboard".
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("button", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Settings" })).toBeVisible();
  });

  test("completed user is redirected away from /onboarding", async ({
    page,
  }) => {
    await page.goto("/");
    await completeOnboarding(page);

    // Try to navigate back to onboarding
    await page.goto("/onboarding");
    await page.waitForURL(/\/log/);
    await expect(page).toHaveURL(/\/log\//);
  });
});
