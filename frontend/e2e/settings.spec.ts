import { test, expect } from "./fixtures";
import { completeOnboarding } from "./helpers";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await completeOnboarding(page);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test("change chronotype and verify persistence after reload", async ({
    page,
  }) => {
    // Wait for settings to load
    await expect(page.getByText("Profile")).toBeVisible();

    // Change chronotype to Night Owl
    const chronotypeSelect = page
      .locator(".select-input")
      .filter({ hasText: "Chronotype" })
      .locator("select");
    await chronotypeSelect.selectOption("late");

    // Brief wait for the auto-save PATCH to complete
    await page.waitForTimeout(500);

    // Reload and verify
    await page.reload();
    await expect(page.getByText("Profile")).toBeVisible();

    const reloadedSelect = page
      .locator(".select-input")
      .filter({ hasText: "Chronotype" })
      .locator("select");
    await expect(reloadedSelect).toHaveValue("late");
  });

  test("change age and verify persistence", async ({ page }) => {
    await expect(page.getByText("Profile")).toBeVisible();

    const ageInput = page
      .locator(".number-input")
      .filter({ hasText: "Age" })
      .locator("input[type=number]");
    await ageInput.fill("30");

    // Brief wait for auto-save
    await page.waitForTimeout(500);

    await page.reload();
    await expect(page.getByText("Profile")).toBeVisible();

    const reloadedAge = page
      .locator(".number-input")
      .filter({ hasText: "Age" })
      .locator("input[type=number]");
    await expect(reloadedAge).toHaveValue("30");
  });

  test("display mode change applies the theme immediately and persists (#46)", async ({
    page,
  }) => {
    await expect(page.getByText("Profile")).toBeVisible();

    // Default is circadian
    await expect(page.locator("body")).toHaveClass(/theme-circadian/);

    const displaySelect = page
      .locator(".select-input")
      .filter({ hasText: "Display Mode" })
      .locator("select");
    await displaySelect.selectOption("light");

    // Applies without a reload...
    await expect(page.locator("body")).toHaveClass(/theme-light/);

    // ...and survives one (no restore needed: fixtures reset the DB per test)
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText("Profile")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/theme-light/);
  });
});
