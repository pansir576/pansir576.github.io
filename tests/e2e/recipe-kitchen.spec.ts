import { expect, test } from "@playwright/test";

test("2D recipe kitchen completes a recipe and combines variables", async ({
  page,
}) => {
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();

  await expect(page.locator("button[data-recipe-id]")).toHaveCount(25);
  await page.locator('button[data-recipe-id="1"]').click();
  await expect(page.locator("[data-recipe-id]").last()).toHaveAttribute(
    "data-recipe-id",
    "1",
  );

  await page.locator("[data-recipe-next]").click();
  await page.locator("[data-recipe-next]").click();
  await expect(page.getByRole("button", { name: "早放醋" })).toBeVisible();
  await page.getByRole("button", { name: "早放醋" }).click();
  await page.getByRole("button", { name: "盐偏少" }).click();
  await expect(page.getByRole("button", { name: "早放醋" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "盐偏少" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator("[data-recipe-next]").click();
  await page.locator("[data-recipe-next]").click();
  await expect(page.locator("[data-recipe-complete]")).toHaveAttribute(
    "data-recipe-complete",
    "true",
  );
  await expect(page.getByText("味觉平衡")).toBeVisible();
  await expect(page.getByText("模拟成品 · 教学近似")).toBeVisible();
  await expect(page.locator("[data-recipe-history]")).toContainText("操作路径");
});

test("safety risk blocks progress until the standard operation is restored", async ({
  page,
}) => {
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();
  await page.locator('button[data-recipe-id="8"]').click();
  await page.locator("[data-recipe-next]").click();
  await page.getByRole("button", { name: /偏短/ }).click();
  await expect(page.locator("[data-recipe-step-status]")).toHaveAttribute(
    "data-recipe-step-status",
    "safety",
  );
  await page.locator("[data-recipe-next]").click();
  await expect(page.locator("[data-recipe-step-status]")).toHaveAttribute(
    "data-recipe-blocked",
    "true",
  );
  await expect(page.getByText("已阻止进入下一步")).toBeVisible();
  await expect(page.locator("[data-recipe-step]")).toHaveAttribute(
    "data-recipe-step",
    "1",
  );

  await page.getByRole("button", { name: "适中" }).click();
  await page.locator("[data-recipe-next]").click();
  await expect(page.locator("[data-recipe-step]")).toHaveAttribute(
    "data-recipe-step",
    "2",
  );
});

test("quality deviation continues and is recorded in the recap", async ({
  page,
}) => {
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();
  await page.locator('button[data-recipe-id="1"]').click();
  await page.locator("[data-recipe-next]").click();
  await page.locator("[data-recipe-next]").click();
  await page.getByRole("button", { name: /盐偏多/ }).click();
  await expect(page.locator("[data-recipe-step-status]")).toHaveAttribute(
    "data-recipe-step-status",
    "quality",
  );
  await page.locator("[data-recipe-next]").click();
  await page.locator("[data-recipe-next]").click();
  await expect(page.locator("[data-recipe-complete]")).toHaveAttribute(
    "data-recipe-complete",
    "true",
  );
  await expect(page.locator("[data-recipe-history]")).toContainText("偏差");
});

test("recipe coach falls back to local guidance when online AI is unavailable", async ({
  page,
}) => {
  await page.route("**/functions/v1/cooking-guide", (route) => route.abort());
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();
  await page.locator('button[data-recipe-id="1"]').click();
  await page.getByLabel("向菜谱教练提问").fill("为什么盐会让食材出水？");
  await page.getByRole("button", { name: "发送问题" }).click();
  await expect(page.getByText("本地知识库")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("[data-recipe-coach]")).toContainText("当前选择符合标准操作");
});

test("voice narration can be enabled and persists", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak() {},
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        text: string;
        lang = "";
        rate = 1;
        pitch = 1;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();
  await page.locator('button[data-recipe-id="1"]').click();
  const voice = page.locator("[data-recipe-voice]");
  await voice.click();
  await expect(voice).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.locator("[data-recipe-voice]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("recipe session restores after refresh", async ({ page }) => {
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();
  await page.locator('button[data-recipe-id="2"]').click();
  await page.locator("[data-recipe-next]").click();
  await page.reload();
  await expect(page.locator("[data-recipe-step]")).toHaveAttribute(
    "data-recipe-step",
    "1",
  );
  await expect(page.getByText("番茄炒蛋").first()).toBeVisible();
});

test("recipe, story kitchen and classic kitchen routes remain available", async ({
  page,
}) => {
  await page.goto("/cook/");
  await expect(page.getByRole("heading", { name: /不背整段教程/ })).toBeVisible();
  await page.getByRole("link", { name: /进入烹语剧场/ }).click();
  await expect(page).toHaveURL(/\/cook\/story\/(recipe\/\d+|tomato-egg|garlic-lettuce)\/$/);
  await expect(page.locator("[data-generic-recipe-id], [data-tomato-egg-stage], [data-garlic-lettuce-stage]").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /3D/ })).toHaveCount(0);
  await page.goto("/cook/classic/");
  await expect(page.locator('section[data-guided-phase="partner"]')).toBeVisible();
});

test("recipe kitchen remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:recipe-session:v1");
  });
  await page.reload();
  await page.locator('button[data-recipe-id="8"]').click();
  await expect(page.locator("[data-recipe-step]")).toHaveAttribute(
    "data-recipe-step",
    "0",
  );
  await expect(page.locator("[data-recipe-next]")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "干煸四季豆" }),
  ).toBeVisible();
});
