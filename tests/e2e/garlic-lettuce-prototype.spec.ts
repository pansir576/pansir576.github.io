import { expect, test, type Page } from "@playwright/test";

async function dragTo(
  page: Page,
  sourceSelector: string,
  targetSelector: string,
) {
  const source = page.locator(sourceSelector);
  const target = page.locator(targetSelector);
  await source.scrollIntoViewIfNeeded();
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox && targetBox).toBeTruthy();
  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
}

async function swipeOnce(page: Page, selector: string) {
  const target = page.locator(selector);
  const box = await target.boundingBox();
  expect(box).toBeTruthy();
  const y = box!.y + box!.height * 0.5;
  await page.mouse.move(box!.x + box!.width * 0.2, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.8, y, { steps: 8 });
  await page.mouse.up();
}

async function prepare(page: Page) {
  await dragTo(
    page,
    '[data-ingredient-drag="greens"]',
    '[data-drop-zone="board"]',
  );
  await dragTo(
    page,
    '[data-ingredient-drag="garlic"]',
    '[data-drop-zone="bowl"]',
  );
  await swipeOnce(page, "[data-wash-cut-surface]");
  await page.locator("[data-mince-garlic]").click();
  await expect(page.locator("[data-garlic-lettuce-stage]")).toHaveAttribute(
    "data-phase",
    "heat",
  );
}

test("follows the garlic lettuce recipe to a perfect finish", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.goto("/cook/story/garlic-lettuce/");
  await prepare(page);
  await page.locator('[data-heat="high"]').click();
  await page.locator("[data-add-oil]").click();
  await dragTo(
    page,
    '[data-ingredient-drag="garlic"]',
    '[data-drop-zone="wok"]',
  );
  await expect(page.locator("[data-garlic-particles]")).toBeVisible();
  await expect(page.locator('[data-cook-state="ready"]')).toBeVisible({
    timeout: 4_000,
  });
  await dragTo(
    page,
    '[data-ingredient-drag="greens"]',
    '[data-drop-zone="wok"]',
  );
  await page
    .locator('[data-amount-control="salt"][data-amount-value="1"]')
    .click();
  await expect(page.locator('[data-cook-state="ready"]')).toBeVisible({
    timeout: 6_000,
  });
  await swipeOnce(page, '[data-drop-zone="wok"]');
  await page.locator("[data-serve-greens]").click();
  await expect(page.locator("[data-plate-vessel]")).toBeVisible();
  await dragTo(
    page,
    '[data-ingredient-drag="dish"]',
    '[data-drop-zone="plate"]',
  );
  await expect(page.locator('[data-outcome="perfect"]')).toBeVisible();
  await expect(page.locator("[data-recap-plate]")).toBeVisible();
  await expect(
    page.locator("[data-character-mood]"),
  ).toHaveAttribute("data-character-mood", "normal");
  await expect(page.getByLabel("3 星评价")).toBeVisible();
  await page.locator("[data-restart-game]").click();
  await expect(page.locator("[data-garlic-lettuce-stage]")).toHaveAttribute(
    "data-phase",
    "prep",
  );
});

test("undercooked greens produce the raw-greens outcome", async ({ page }) => {
  test.setTimeout(25_000);
  await page.goto("/cook/story/garlic-lettuce/");
  await prepare(page);
  await page.locator('[data-heat="high"]').click();
  await page.locator("[data-add-oil]").click();
  await dragTo(
    page,
    '[data-ingredient-drag="garlic"]',
    '[data-drop-zone="wok"]',
  );
  await expect(page.locator('[data-cook-state="ready"]')).toBeVisible({
    timeout: 4_000,
  });
  await dragTo(
    page,
    '[data-ingredient-drag="greens"]',
    '[data-drop-zone="wok"]',
  );
  await page
    .locator('[data-amount-control="salt"][data-amount-value="1"]')
    .click();
  await swipeOnce(page, '[data-drop-zone="wok"]');
  await expect(page.locator("[data-serve-greens]")).toBeEnabled({
    timeout: 2_000,
  });
  await page.locator("[data-serve-greens]").click();
  await dragTo(
    page,
    '[data-ingredient-drag="dish"]',
    '[data-drop-zone="plate"]',
  );
  await expect(page.locator('[data-outcome="raw-greens"]')).toBeVisible();
  await expect(page.locator("[data-recap-plate]")).toBeVisible();
  await expect(
    page.locator("[data-character-mood]"),
  ).toHaveAttribute("data-character-mood", "dejected");
  await expect(page.locator("[data-dejected-sigh]")).toHaveText("唉……");
  await expect(page.getByText("赏……个脸呗……把菜做好。")).toBeVisible();
  await expect(page.locator("[data-voice-line]")).toHaveAttribute(
    "data-voice-line",
    "low-score-dejected",
  );
});

test("mobile prep and cooking remain inside the viewport", async ({ page }) => {
  test.setTimeout(20_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cook/story/garlic-lettuce/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await prepare(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("all 12 garlic-lettuce voice clips are served", async ({ page }) => {
  const ids = [
    "garlic-phase-prep",
    "garlic-phase-heat",
    "garlic-phase-garlic",
    "garlic-phase-greens",
    "garlic-phase-serve",
    "garlic-outcome-burnt-garlic",
    "garlic-outcome-weak-garlic",
    "garlic-outcome-raw-greens",
    "garlic-outcome-over-greens",
    "garlic-outcome-salty",
    "garlic-outcome-bland",
    "garlic-outcome-perfect",
  ];
  for (const id of ids) {
    const response = await page.request.get(
      `/audio/xiami/garlic-lettuce/v1/${id}.mp3`,
    );
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBeGreaterThan(10_000);
  }
  const sharedResponse = await page.request.get(
    "/audio/xiami/shared/v1/low-score-dejected.mp3",
  );
  expect(sharedResponse.status()).toBe(200);
  expect((await sharedResponse.body()).byteLength).toBeGreaterThan(10_000);
});

test("packaged Xiami audio starts without falling back to system speech", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const voiceWindow = window as typeof window & {
      __xiamiAudio?: { status: string; src: string; error?: string };
    };
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      return originalPlay.call(this).then(
        () => {
          voiceWindow.__xiamiAudio = { status: "playing", src: this.src };
        },
        (error) => {
          voiceWindow.__xiamiAudio = {
            status: "failed",
            src: this.src,
            error: error instanceof Error ? error.message : String(error),
          };
          throw error;
        },
      );
    };
  });
  await page.goto("/cook/story/garlic-lettuce/");
  await page.locator("[data-voice-toggle]").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __xiamiAudio?: { status: string };
            }
          ).__xiamiAudio?.status,
      ),
    )
    .toBe("playing");
  await expect(
    page.getByText("夏弥配音加载失败，已切换系统语音。"),
  ).toHaveCount(0);
});
