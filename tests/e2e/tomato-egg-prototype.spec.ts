import { expect, test, type Page } from "@playwright/test";

type VoiceMockMode = "resolve" | "fallback" | "blocked";

async function mockVoicePlayback(
  page: Page,
  mode: VoiceMockMode = "resolve",
) {
  await page.addInitScript((mockMode) => {
    const voiceWindow = window as typeof window & {
      __voicePlayed?: string[];
      __voicePaused?: number;
      __allowVoicePlay?: boolean;
      __spoken?: string[];
    };
    voiceWindow.__voicePlayed = [];
    voiceWindow.__voicePaused = 0;
    voiceWindow.__allowVoicePlay = mockMode !== "blocked";
    voiceWindow.__spoken = [];

    HTMLMediaElement.prototype.play = function play() {
      voiceWindow.__voicePlayed?.push(this.src);
      if (!voiceWindow.__allowVoicePlay) {
        return Promise.reject(
          new DOMException("Autoplay blocked", "NotAllowedError"),
        );
      }
      if (mockMode === "fallback") {
        return Promise.reject(
          new DOMException("Audio unavailable", "NotSupportedError"),
        );
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function pause() {
      voiceWindow.__voicePaused = (voiceWindow.__voicePaused ?? 0) + 1;
    };

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(value: { text: string }) {
          voiceWindow.__spoken?.push(value.text);
        },
        getVoices() {
          return [];
        },
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        voice: unknown;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  }, mode);
}

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
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  expect(box).toBeTruthy();
  const y = box!.y + box!.height * 0.5;
  await page.mouse.move(box!.x + box!.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.75, y, { steps: 8 });
  await page.mouse.up();
}

async function prepareIngredients(page: Page) {
  await dragTo(
    page,
    '[data-ingredient-drag="tomato"]',
    '[data-drop-zone="board"]',
  );
  await dragTo(
    page,
    '[data-ingredient-drag="egg"]',
    '[data-drop-zone="bowl"]',
  );
  await swipeOnce(page, "[data-cut-surface]");
  await swipeOnce(page, "[data-whisk-surface]");
  await page.locator("[data-prepare-scallion]").click();
  await expect(page.locator("[data-tomato-chunks]").first()).toBeVisible();
  await expect(page.locator("[data-egg-liquid]").first()).toBeVisible();
  await expect(page.locator("[data-scallion-bits]").first()).toBeVisible();
  await expect(page.locator("[data-tomato-egg-stage]")).toHaveAttribute(
    "data-phase",
    "heat",
  );
}

test("follows the four-step recipe and earns a three-star finish", async ({
  page,
}) => {
  test.setTimeout(40_000);
  await page.goto("/cook/story/tomato-egg/");
  await expect(page.locator("[data-kitchen-background]")).toHaveCSS(
    "background-image",
    /kitchen-play-bg\.svg/,
  );
  await prepareIngredients(page);
  await expect(page.locator("[data-voice-line]")).toHaveAttribute(
    "data-voice-line",
    "phase-heat",
  );

  await page.locator('[data-heat="medium"]').click();
  await expect(page.locator("[data-add-oil]")).toBeVisible();
  await dragTo(
    page,
    '[data-ingredient-drag="egg"]',
    '[data-drop-zone="wok"]',
  );
  await expect(
    page.locator('[data-drop-zone="bowl"] [data-ingredient-drag="egg"]'),
  ).toBeVisible();
  await page.locator("[data-add-oil]").click();
  await expect(page.locator("[data-oil-sheen]")).toBeVisible();
  await dragTo(
    page,
    '[data-ingredient-drag="egg"]',
    '[data-drop-zone="wok"]',
  );
  await expect(page.locator('[data-cook-state="ready"]')).toBeVisible({
    timeout: 7_000,
  });
  await page.locator("[data-reserve-egg]").click();
  await expect(page.locator("[data-reserved-egg]")).toBeVisible();
  await expect(page.locator("[data-voice-line]")).toHaveAttribute(
    "data-voice-line",
    "phase-tomato",
  );

  await dragTo(
    page,
    '[data-ingredient-drag="tomato"]',
    '[data-drop-zone="wok"]',
  );
  await page
    .locator('[data-amount-control="sugar"][data-amount-value="0"]')
    .click();
  await expect(
    page.locator('[data-drop-zone="wok"] [data-tomato-chunks]'),
  ).toHaveAttribute("data-cook-state", "raw");
  await expect(
    page.locator(
      '[data-drop-zone="wok"] [data-tomato-chunks][data-cook-state="ready"]',
    ),
  ).toBeVisible({
    timeout: 9_000,
  });
  await expect(
    page.locator('[data-drop-zone="wok"] [data-tomato-chunks]'),
  ).toHaveAttribute("data-cook-state", "ready");
  await expect(
    page.locator('[data-drop-zone="wok"] [data-tomato-chunks]'),
  ).toHaveAttribute("aria-label", "番茄软化出沙");
  await expect(
    page.locator('[data-drop-zone="wok"] [data-tomato-pulp]'),
  ).toHaveCount(13);
  await page.locator("[data-return-egg]").click();
  await expect(page.locator("[data-tomato-egg-stage]")).toHaveAttribute(
    "data-phase",
    "finish",
  );

  await page
    .locator('[data-amount-control="salt"][data-amount-value="1"]')
    .click();
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
  await expect(
    page.getByRole("heading", { name: "四步都落在点上" }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("3 星评价")).toBeVisible();
  await expect(page.locator("[data-voice-line]")).toHaveAttribute(
    "data-voice-line",
    "outcome-perfect",
  );
  await page.locator("[data-restart-game]").click();
  await expect(page.locator("[data-tomato-egg-stage]")).toHaveAttribute(
    "data-phase",
    "prep",
  );
});

test("mobile flow keeps targets usable and prevents horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(25_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cook/story/tomato-egg/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await prepareIngredients(page);
  await page.locator('[data-heat="high"]').click();
  await page.locator("[data-add-oil]").click();
  await dragTo(
    page,
    '[data-ingredient-drag="egg"]',
    '[data-drop-zone="wok"]',
  );
  await expect(page.locator("[data-reserve-egg]")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("undercooking still produces the independent raw outcome", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.goto("/cook/story/tomato-egg/");
  await prepareIngredients(page);
  await page.locator('[data-heat="high"]').click();
  await page.locator("[data-add-oil]").click();
  await dragTo(
    page,
    '[data-ingredient-drag="egg"]',
    '[data-drop-zone="wok"]',
  );
  await expect(page.locator("[data-reserve-egg]")).toBeEnabled();
  await page.locator("[data-reserve-egg]").click();
  await dragTo(
    page,
    '[data-ingredient-drag="tomato"]',
    '[data-drop-zone="wok"]',
  );
  await page
    .locator('[data-amount-control="sugar"][data-amount-value="0"]')
    .click();
  await expect(page.locator("[data-return-egg]")).toBeEnabled();
  await page.locator("[data-return-egg]").click();
  await page
    .locator('[data-amount-control="salt"][data-amount-value="1"]')
    .click();
  await dragTo(
    page,
    '[data-ingredient-drag="dish"]',
    '[data-drop-zone="plate"]',
  );
  await expect(page.locator('[data-outcome="raw"]')).toBeVisible();
  await expect(page.getByText("火候不足 · 夹生")).toBeVisible();
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

test("keeps the original 25-recipe story as a separate route", async ({
  page,
}) => {
  await page.goto("/cook/story/");
  await expect(page.locator("[data-story-recipe-id]")).toHaveCount(25);
  await expect(page.locator("[data-tomato-egg-stage]")).toHaveCount(0);
});

test("Xiami voice plays the packaged clip, advances, replays and persists", async ({
  page,
}) => {
  await mockVoicePlayback(page);
  await page.goto("/cook/story/tomato-egg/");
  await page.locator("[data-voice-toggle]").click();
  await expect(page.locator("[data-voice-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __voicePlayed?: string[] }
          ).__voicePlayed?.at(-1),
      ),
    )
    .toMatch(/\/audio\/xiami\/tomato-egg\/v1\/phase-prep\.mp3$/);
  await page.locator("[data-voice-replay]").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __voicePlayed?: string[] }
          ).__voicePlayed?.length ?? 0,
      ),
    )
    .toBeGreaterThan(1);
  await prepareIngredients(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __voicePlayed?: string[] }
          ).__voicePlayed?.at(-1),
      ),
    )
    .toMatch(/\/audio\/xiami\/tomato-egg\/v1\/phase-heat\.mp3$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __voicePaused?: number }
          ).__voicePaused ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator("[data-voice-toggle]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Xiami audio failures fall back to system speech once", async ({
  page,
}) => {
  await mockVoicePlayback(page, "fallback");
  await page.goto("/cook/story/tomato-egg/");
  await page.locator("[data-voice-toggle]").click();
  await expect(
    page.getByText("夏弥配音加载失败，已切换系统语音。"),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & { __spoken?: string[] }
          ).__spoken?.length ?? 0,
      ),
    )
    .toBe(1);
});

test("Xiami voice offers a replay gesture when autoplay is blocked", async ({
  page,
}) => {
  await mockVoicePlayback(page, "blocked");
  await page.goto("/cook/story/tomato-egg/");
  await page.locator("[data-voice-toggle]").click();
  const replay = page.locator("[data-voice-replay]");
  await expect(replay).toHaveAttribute("data-voice-play", "true");
  await expect(replay).toHaveText("点击播放");
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __spoken?: string[] }).__spoken?.length ??
        0,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    (
      window as typeof window & { __allowVoicePlay?: boolean }
    ).__allowVoicePlay = true;
  });
  await replay.click();
  await expect(replay).toHaveText("重听");
});

test("all 12 packaged Xiami clips are served successfully", async ({
  page,
}) => {
  const lineIds = [
    "phase-prep",
    "phase-heat",
    "phase-egg",
    "phase-tomato",
    "phase-finish",
    "outcome-burnt-egg",
    "outcome-burnt-tomato",
    "outcome-raw-egg",
    "outcome-raw-tomato",
    "outcome-salty",
    "outcome-bland",
    "outcome-perfect",
  ];
  for (const lineId of lineIds) {
    const response = await page.request.get(
      `/audio/xiami/tomato-egg/v1/${lineId}.mp3`,
    );
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBeGreaterThan(10_000);
  }
});
