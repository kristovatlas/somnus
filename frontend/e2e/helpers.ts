import { type Page } from "@playwright/test";

/**
 * Clicks through all 6 onboarding wizard steps to completion.
 * Assumes the page is on /onboarding (fresh app state).
 */
export async function completeOnboarding(page: Page): Promise<void> {
  // Step 0: Welcome — click "Get Started"
  await page.getByRole("heading", { name: "Welcome to Somnus" }).waitFor();
  await page.getByRole("button", { name: "Get Started" }).click();

  // Step 1: Oura — click "Skip"
  await page.getByRole("heading", { name: "Oura Ring Integration" }).waitFor();
  await page.getByRole("button", { name: "Skip" }).click();

  // Step 2: Sleep Profile — click "Next"
  await page.getByRole("heading", { name: "Sleep Profile" }).waitFor();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 3: Tracking Setup — click "Next"
  await page
    .getByRole("heading", { name: "What do you want to track?" })
    .waitFor();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 4: Data Storage — click "Next"
  await page
    .getByRole("heading", { name: "Your Data Stays Local" })
    .waitFor();
  await page.getByRole("button", { name: "Next" }).click();

  // Step 5: Done — click "Start Logging"
  await page.getByRole("heading", { name: "You're All Set!" }).waitFor();
  await page.getByRole("button", { name: "Start Logging" }).click();

  // Wait for redirect to /log and let its data fetches settle — an
  // in-flight daily-log 404 (empty day) must not bleed into the
  // caller's console/network assertions.
  await page.waitForURL(/\/log\//);
  await page.waitForLoadState("networkidle");
}
