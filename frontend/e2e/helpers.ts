import { type Page } from "@playwright/test";

/**
 * Clicks through all 6 onboarding wizard steps to completion.
 * Assumes the page is on /onboarding (fresh app state).
 */
export async function completeOnboarding(page: Page): Promise<void> {
  // Step 0: Welcome — click "Get Started"
  await page.getByRole("heading", { name: "Welcome to Somnus" }).waitFor();
  await page.getByRole("button", { name: "Get Started" }).click();

  // Step 1: Data Storage (before Oura so the DB location — where the token
  // will live — can be changed first; issue #8) — click "Next"
  await page
    .getByRole("heading", { name: "Your Data Stays Local" })
    .waitFor();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 2: Oura — click "Skip"
  await page.getByRole("heading", { name: "Oura Ring Integration" }).waitFor();
  await page.getByRole("button", { name: "Skip" }).click();

  // Step 3: Sleep Profile — click "Next"
  await page.getByRole("heading", { name: "Sleep Profile" }).waitFor();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 4: Tracking Setup — click "Next"
  await page
    .getByRole("heading", { name: "What do you want to track?" })
    .waitFor();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 5: Done — click "Start Logging"
  await page.getByRole("heading", { name: "You're All Set!" }).waitFor();
  await page.getByRole("button", { name: "Start Logging" }).click();

  // Wait for redirect to /log
  await page.waitForURL(/\/log\//);
}
