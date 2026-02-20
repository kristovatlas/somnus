import { test, expect } from "./fixtures";
import { completeOnboarding } from "./helpers";

test.describe("Daily log", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await completeOnboarding(page);
  });

  test("add caffeine via quick-add, save, and verify persistence", async ({
    page,
  }) => {
    // Caffeine section should be open by default
    await expect(page.getByText("+ Espresso (63mg)")).toBeVisible();

    // Quick-add an espresso
    await page.getByText("+ Espresso (63mg)").click();

    // Should show total with 63mg
    await expect(page.locator(".caffeine-total")).toContainText("63mg");

    // Save the log
    await page.getByRole("button", { name: "Save" }).click();

    // Wait for save to complete (button returns to "Save")
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

    // Reload the page and verify persistence
    await page.reload();

    // Wait for the page to load
    await expect(page.getByText("+ Espresso (63mg)")).toBeVisible();

    // The saved caffeine entry should still be visible
    await expect(page.locator(".caffeine-total")).toContainText("63mg");
  });

  test("add notes and verify persistence", async ({ page }) => {
    const notesText = "Felt great today, slept well last night";

    await page
      .getByPlaceholder("Any other notes about today...")
      .fill(notesText);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

    await page.reload();
    await expect(
      page.getByPlaceholder("Any other notes about today..."),
    ).toHaveValue(notesText);
  });
});
