import { test, expect } from "@playwright/test";

test.describe("Multi-Browser Host & Participant Sync E2E Tests", () => {
  test("Verify Real-Time sync, websocket pushes, idempotency locks, and leaderboard refreshes", async ({
    browser,
  }) => {
    // 1. Setup Presenter Context and Page
    const presenterContext = await browser.newContext();
    const presenterPage = await presenterContext.newPage();

    // Authenticate Presenter
    await presenterPage.goto("/login");
    await presenterPage.click('button:has-text("Continue with Google")');
    await expect(presenterPage).toHaveURL(/\/dashboard/);

    // Create a new room with Quiz auth mode to enable correct answers
    await presenterPage.click('button:has-text("Create New PulseRoom")');
    await presenterPage.fill("#session-name-input", "Playwright Sync E2E Room");
    await presenterPage.selectOption("#session-auth-mode", "quiz_gmail");
    await presenterPage.click('button:has-text("Create PulseRoom")');

    // Wait for redirect and extract PIN/code
    await presenterPage.waitForURL(/\/session\/[0-9a-zA-Z-]+\/host/);
    const code = presenterPage.url().split("/session/")[1].split("/host")[0];
    console.log(`[E2E] Created Sync presenter Room code: ${code}`);

    // Activate the PulseRoom
    await presenterPage.click('button:has-text("Activate PulseRoom")');
    await expect(presenterPage.locator('button:has-text("Deactivate PulseRoom")')).toBeVisible();

    // Add a Multiple Choice Question with correct Option 1 (index 0)
    await presenterPage.fill("#prompt", "Playwright Sync MC Question");
    await presenterPage.selectOption("#correct-option-select", "0");
    await presenterPage.click('button:has-text("Save to PulseRoom Stack")');
    await expect(presenterPage.locator("text=Playwright Sync MC Question")).toBeVisible();

    // 2. Setup Participant (Audience) Context and Page
    const audienceContext = await browser.newContext();
    const audiencePage = await audienceContext.newPage();

    // Navigate to participant login gateway
    await audiencePage.goto(`/session/${code}/login`);
    await expect(audiencePage.locator("text=PulseRoom Login Gate")).toBeVisible();

    // Click Google OAuth Join button (skips standard flow under test mode and registers automatically)
    await audiencePage.click('button:has-text("Join with Google")');
    
    // Verify participant successfully reaches the waiting lobby
    await audiencePage.waitForURL(new RegExp(`/session/${code}$`));
    await expect(audiencePage.locator("text=Waiting for presenter to launch a question")).toBeVisible();

    // 3. Presenter Launches the Question Manually
    await presenterPage.click('button:has-text("Start Manual")');
    await expect(presenterPage.locator("text=LIVE: Q1")).toBeVisible();

    // 4. Verify Audience instantly transitions to active question via Pusher WS
    await expect(audiencePage.locator("text=Playwright Sync MC Question")).toBeVisible();
    await expect(audiencePage.locator('button:has-text("Option 1")')).toBeVisible();
    await expect(audiencePage.locator('button:has-text("Submit Answer")')).toBeVisible();

    // 5. Audience Votes on Option 1 (index 0)
    await audiencePage.click('button:has-text("Option 1")');
    await audiencePage.click('button:has-text("Submit Answer")');

    // 6. Verify Idempotency UI Lock
    // Assert options and submit buttons are immediately disabled
    await expect(audiencePage.locator('button:has-text("Option 1")')).toBeDisabled();
    await expect(audiencePage.locator('button:has-text("Submit Answer")')).toBeDisabled();
    
    // Assert thank you message is visible
    await expect(audiencePage.locator("text=Thank you! Your feedback has been safely submitted")).toBeVisible();

    // 7. Verify Presenter Console Leaderboard Instantly Updates with score
    // The participant name is "Playwright Tester" and correct MC option index 0 was chosen, yielding 10 pts
    await expect(presenterPage.locator("text=Playwright Tester")).toBeVisible();
    await expect(presenterPage.locator("text=10 pts")).toBeVisible();

    // Teardown Contexts
    await audienceContext.close();
    await presenterContext.close();
  });
});
