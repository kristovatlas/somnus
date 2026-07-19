import { test as base } from "@playwright/test";

/**
 * Extended test fixture that resets the backend DB and clears
 * browser localStorage before each test for full isolation.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Reset backend database
    const res = await page.request.post("http://localhost:8000/api/test/reset");
    if (!res.ok()) {
      throw new Error(
        `DB reset failed (${res.status()}). Is the backend running with SOMNUS_TESTING=1?`,
      );
    }

    // Clear localStorage before navigating
    await page.addInitScript(() => localStorage.clear());

    await use(page);
  },
});

export { expect } from "@playwright/test";
