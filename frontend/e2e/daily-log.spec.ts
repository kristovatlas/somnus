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

  test("nap quick-add fills start, end, and duration; persists", async ({
    page,
  }) => {
    // Expand the collapsed Naps section
    await page.getByRole("button", { name: /Naps/ }).click();
    await page.getByRole("button", { name: "+ 20 min nap" }).click();

    const napCard = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last();
    const timeInputs = napCard.locator('input[type="time"]');
    const duration = napCard.locator('input[type="number"]');

    // All three fields populated and consistent (issue #13)
    await expect(duration).toHaveValue("20");
    const start = await timeInputs.nth(0).inputValue();
    const end = await timeInputs.nth(1).inputValue();
    expect(start).toMatch(/^\d{2}:\d{2}$/);
    expect(end).toMatch(/^\d{2}:\d{2}$/);
    const toMin = (t: string) =>
      Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    expect((toMin(end) - toMin(start) + 1440) % 1440).toBe(20);

    // Persists through save + reload
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.reload();
    // localStorage is cleared on navigation by the fixture, so re-expand
    await page.getByRole("button", { name: /Naps/ }).click();
    const reloadedCard = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Remove" }) })
      .last();
    await expect(reloadedCard.locator('input[type="number"]')).toHaveValue(
      "20",
    );
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
