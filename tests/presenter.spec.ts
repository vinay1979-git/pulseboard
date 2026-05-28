import { test, expect } from "@playwright/test";

test.describe("Presenter Console State Machine E2E Tests", () => {
  test("Verify 4-state UI Launch Toolbar and Active Gating", async ({ page }) => {
    // 1. Authenticate Presenter (Test Mode Bypass)
    await page.goto("/login");
    await page.click('button:has-text("Continue with Google")');
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Create a New PulseRoom
    await page.click('button:has-text("Create New PulseRoom")');
    await page.fill("#session-name-input", "Playwright Presenter Spec Room");
    await page.selectOption("#session-auth-mode", "anonymous");
    await page.click('button:has-text("Create PulseRoom")');

    // Wait for redirect to Host Console
    await page.waitForURL(/\/session\/[0-9a-zA-Z-]+\/host/);
    const hostUrl = page.url();
    
    // Extract unique room PIN/code
    const code = hostUrl.split("/session/")[1].split("/host")[0];
    console.log(`[E2E] Created Presenter Room: ${code}`);

    // State A: Inactive Room Gating
    // Verify toolbar controls are hidden/disabled and activation prompt is displayed
    await expect(page.locator("text=Activate the PulseRoom to enable launch controls.")).toBeVisible();
    await expect(page.locator('button:has-text("Start Manual")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Auto-Launch")')).not.toBeVisible();

    // Activate the PulseRoom
    await page.click('button:has-text("Activate PulseRoom")');
    await expect(page.locator('button:has-text("Deactivate PulseRoom")')).toBeVisible();

    // Verify Idle State controls are now fully exposed
    await expect(page.locator('button:has-text("Start Manual")')).toBeVisible();
    await expect(page.locator('button:has-text("Auto-Launch")')).toBeVisible();

    // Add Question 1 (MC option is chosen by default)
    await page.fill("#prompt", "Playwright E2E Prompt 1");
    await page.click('button:has-text("Save to PulseRoom Stack")');
    await expect(page.locator("text=Playwright E2E Prompt 1")).toBeVisible();

    // Add Question 2
    await page.fill("#prompt", "Playwright E2E Prompt 2");
    await page.click('button:has-text("Save to PulseRoom Stack")');
    await expect(page.locator("text=Playwright E2E Prompt 2")).toBeVisible();

    // State B: Idle to Manual Transition
    await page.click('button:has-text("Start Manual")');
    
    // Verify manual toolbar state matches sequentially
    await expect(page.locator("text=LIVE: Q1")).toBeVisible();
    await expect(page.locator('button:has-text("Launch Next")')).toBeVisible();
    await expect(page.locator('button:has-text("End & Complete")')).toBeVisible();

    // State C: Manual Progression Sequence
    await page.click('button:has-text("Launch Next")');
    await expect(page.locator("text=LIVE: Q2")).toBeVisible();
    
    // End Manual Sequence
    await page.click('button:has-text("Finish")');
    
    // Verify return to Idle State
    await expect(page.locator('button:has-text("Start Manual")')).toBeVisible();
    await expect(page.locator('button:has-text("Auto-Launch")')).toBeVisible();

    // State D: Auto-Launch Countdown & Controls
    await page.click('button:has-text("Auto-Launch")');
    await page.fill('input[type="number"]', "45");
    await page.click('button:has-text("Start")');
    
    // Verify auto mode is active with Pause, Skip, and Cancel buttons visible
    await expect(page.locator("text=AUTO-LIVE: Q1")).toBeVisible();
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();
    await expect(page.locator('button:has-text("Skip to Next")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Test Pause & Resume transitions
    await page.click('button:has-text("Pause")');
    await expect(page.locator('button:has-text("Resume")')).toBeVisible();
    await page.click('button:has-text("Resume")');
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();

    // Cancel Auto-Launch countdown
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button:has-text("Start Manual")')).toBeVisible();
  });
});
