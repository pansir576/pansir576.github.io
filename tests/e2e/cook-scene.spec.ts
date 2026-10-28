import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/cook/classic/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:guided-session:v1");
    window.localStorage.removeItem("simulating-cook:community-share:v1");
  });
  await page.reload();
});

test("guided kitchen completes a dish and produces a recap", async ({ page }) => {
  await page.locator('[data-partner-id="zhiwei"]').click();
  await expect(
    page.locator('section[data-guided-phase="ingredient"]'),
  ).toBeVisible();

  await page.locator('[data-goal-id="crisper"]').click();
  await page.locator('[data-ingredient-id="potato"]').click();
  await expect(
    page.locator('section[data-guided-phase="prepare"]'),
  ).toBeVisible();

  await page.locator('[data-operation-id="wash"]').first().click();
  await page.locator('[data-operation-id="cut-small"]').first().click();
  await page.locator('[data-operation-id="archetype-root-dry"]').first().click();

  await page.locator('[data-phase-action="advance-pan"]').click();
  await page.locator('[data-phase-action="move-pan"]').click();
  await page.locator('[data-phase-action="start-heat"]').click();
  await page.waitForTimeout(9000);
  await page.locator('[data-phase-action="stop-heat"]').click();
  await page.locator('[data-phase-action="plate"]').click();

  await expect(
    page.locator('section[data-guided-phase="recap"]'),
  ).toBeVisible();
  await expect(page.locator('[data-recap-action="new-round"]')).toBeVisible();
  await expect(page.locator('[data-recap-action="community"]')).toBeVisible();
  await expect(page.locator('[data-recap-action="exit"]')).toBeVisible();

  const savedExperiments = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("cooking-lab:experiments:v2") ?? "[]",
    ),
  );
  expect(savedExperiments.length).toBeGreaterThan(0);

  await page.locator('[data-recap-action="new-round"]').click();
  await expect(
    page.locator('section[data-guided-phase="ingredient"]'),
  ).toBeVisible();
});

test("guided session resumes after refresh", async ({ page }) => {
  await page.locator('[data-partner-id="axian"]').click();
  await page.locator('[data-ingredient-id="greens"]').click();
  await page.locator('[data-operation-id="wash"]').first().click();

  await page.reload();
  await expect(page.locator("[data-resume-session]")).toBeVisible();
  await page.locator("[data-resume-session]").click();
  await expect(
    page.locator('section[data-guided-phase="prepare"]'),
  ).toBeVisible();
  await expect(
    page.locator('section[data-active-station="sink"]'),
  ).toBeVisible();
});

test("mobile guided kitchen keeps controls and station navigation usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('[data-partner-id="xiaoyan"]').click();
  await page.locator('[data-ingredient-id="greens"]').click();

  await expect(page.locator("[data-station-dock]")).toHaveCount(6);
  await page.locator('[data-station-dock="prep"]').click();
  await expect(
    page.locator('section[data-active-station="prep"]'),
  ).toBeVisible();
  await page.locator("[data-panel-toggle]").click();
  await expect(page.locator("[data-panel-toggle]")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.locator("[data-operation-guide]").click();
  await expect(page.locator("[data-guide-drawer]")).toBeVisible();
  await expect(page.locator('[data-guide-mode="chat"]')).toBeVisible();
  await page.locator('[data-guide-mode="chat"]').click();
  await expect(page.locator("textarea")).toBeVisible();
});
