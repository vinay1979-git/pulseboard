import { test, expect } from "@playwright/test";

test.describe("Presenter Console State Machine E2E Tests", () => {
  test("Verify 4-state UI Launch Toolbar and Active Gating", async ({ page }) => {
    // Increase timeout for this comprehensive E2E state machine lifecycle test
    test.setTimeout(60000);

    // Catch browser errors and console logs
    page.on("console", (msg) => console.log(`[Browser Log] ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`[Browser Error] ${err.message}`));

    // 1. Authenticate Presenter (Test Mode Bypass)
    await page.goto("/login");
    if (page.url().includes("/login")) {
      await page.click('button:has-text("Continue with Google")');
    }
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

    // Add Question 1 (MC option is chosen by default)
    await page.fill("#prompt", "Playwright E2E Prompt 1");
    await page.click('button:has-text("Save to PulseRoom Stack")');
    await expect(page.locator("text=Playwright E2E Prompt 1")).toBeVisible();

    // Add Question 2
    await page.fill("#prompt", "Playwright E2E Prompt 2");
    await page.click('button:has-text("Save to PulseRoom Stack")');
    await expect(page.locator("text=Playwright E2E Prompt 2")).toBeVisible();

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
    await page.click('button:has-text("End & Complete")');
    
    // Verify return to Idle State
    await expect(page.locator('button:has-text("Start Manual")')).toBeVisible();
    await expect(page.locator('button:has-text("Auto-Launch")')).toBeVisible();

    // State D: Auto-Launch Countdown & Controls (Rigorous Lifecycle Verification)
    
    // Test Case 1: Initial Frame Verification (The "Zero-Second" Prevention Bug)
    await page.click('button:has-text("Auto-Launch")');
    await page.fill('input[type="number"]', "15");
    await page.click('button:has-text("Start")');
    
    // Immediately assert that the UI contains the exact initial duration and doesn't flash 0s
    await expect(page.locator("text=AUTO-LIVE: Q1")).toBeVisible();
    await expect(page.locator("text=AUTO-LIVE: Q1")).toContainText(/\(⏱️ 15s remaining\)/);
    
    // Verify auto mode is active with Pause, Skip, and Cancel buttons visible
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();
    await expect(page.locator('button:has-text("Skip to Next")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();

    // Test Pause & Resume transitions
    await page.click('button:has-text("Pause")');
    await expect(page.locator('button:has-text("Resume")')).toBeVisible();
    await page.click('button:has-text("Resume")');
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();

    // Test Case 2: Sequential Time Decrement
    // Verify the timer ticks downward smoothly
    await page.waitForTimeout(2000);
    // It should have ticked down to 13s or 14s
    await expect(page.locator("text=AUTO-LIVE: Q1")).toContainText(/\(⏱️ 1[34]s remaining\)/);

    // Cancel the first loop so we can test the next cases cleanly
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('button:has-text("Start Manual")')).toBeVisible();

    // Test Case 3: Zero-Trigger Progression and Lifecycle
    await page.click('button:has-text("Auto-Launch")');
    await page.fill('input[type="number"]', "10");
    await page.click('button:has-text("Start")');

    // Verify it starts on Q1 with 10s
    await expect(page.locator("text=AUTO-LIVE: Q1")).toContainText(/\(⏱️ 10s remaining\)/);

    // Wait until it ticks down to 0 and auto-progresses to Q2
    // Timeout of 15 seconds is more than enough for a 10s countdown
    await expect(page.locator("text=AUTO-LIVE: Q2")).toBeVisible({ timeout: 15000 });

    // Assert that Question 1's UI card immediately updates to show completed state
    await expect(page.locator("li:has-text('Playwright E2E Prompt 1')").locator("text=Done")).toBeVisible();

    // Assert that the ticking timer state variable re-initializes immediately back to 10s remaining on Q2
    await expect(page.locator("text=AUTO-LIVE: Q2")).toContainText(/\(⏱️ 10s remaining\)/);

    // Test Case 4: No-Loop Terminal State Enforcer
    // Let's wait for Q2 (the final question) to tick down and complete the session
    await expect(page.locator('button:has-text("Start Manual")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("Auto-Launch")')).toBeVisible({ timeout: 15000 });

    // Assert that the final question (Q2) transitions to completed/Done
    await expect(page.locator("li:has-text('Playwright E2E Prompt 2')").locator("text=Done")).toBeVisible();

    // Verify that Question 1 is NOT set back to live (no infinite loop)
    await expect(page.locator("li:has-text('Playwright E2E Prompt 1')").locator("text=LIVE")).not.toBeVisible();
  });
});
