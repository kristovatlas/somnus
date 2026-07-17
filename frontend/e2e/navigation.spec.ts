import { test, expect } from "./fixtures";
import { completeOnboarding } from "./helpers";

test.describe("Navigation guards", () => {
  test("unauthenticated routes redirect to /onboarding", async ({ page }) => {
    // Fresh DB — onboarding not completed
    await page.goto("/log");
    await page.waitForURL(/\/onboarding/);
    await expect(
      page.getByRole("heading", { name: "Welcome to Somnus" }),
    ).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to /onboarding", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/onboarding/);
  });

  test("unauthenticated /settings redirects to /onboarding", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForURL(/\/onboarding/);
  });
});

test.describe("Page navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await completeOnboarding(page);
  });

  test("all nav buttons navigate to correct pages", async ({ page }) => {
    // Dashboard
    await page.getByRole("button", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Analysis
    await page.getByRole("button", { name: "Analysis" }).click();
    await expect(page).toHaveURL(/\/analysis/);

    // Recommendations
    await page.getByRole("button", { name: "Recommendations" }).click();
    await expect(page).toHaveURL(/\/recommendations/);

    // Reports
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page).toHaveURL(/\/reports/);

    // Settings
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);

    // Title click → back to /log
    await page.getByText("Somnus").first().click();
    await expect(page).toHaveURL(/\/log\//);
  });

  test("pages load without errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const routes = [
      "/dashboard",
      "/analysis",
      "/recommendations",
      "/reports",
      "/settings",
    ];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
    }

    // Filter out known noise (e.g. React dev warnings)
    const realErrors = consoleErrors.filter(
      (e) => !e.includes("Download the React DevTools"),
    );
    expect(realErrors).toHaveLength(0);
  });

  test("unknown URL shows the themed not-found page (#51)", async ({
    page,
  }) => {
    await page.goto("/");
    await completeOnboarding(page);
    await page.goto("/definitely/not/a/route");
    await expect(page.getByText("Page not found")).toBeVisible();
    await page.getByText("Go to today's log").click();
    await expect(page).toHaveURL(/\/log\//);
  });
});
