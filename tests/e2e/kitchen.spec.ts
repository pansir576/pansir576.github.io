import { expect, test, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("cooking-lab:onboarding:v1", "done");
    window.localStorage.setItem("cooking-lab:sound:v1", "off");
  });
}

async function startHeating(
  page: Page,
  temperature: string,
) {
  await page.getByRole("tab", { name: "火候" }).click();
  await page.getByRole("button", { name: /煎香/ }).click();
  await page.getByRole("button", { name: /大火/ }).click();
  await page.getByLabel("目标温度").fill(temperature);
  await page.getByRole("button", { name: /点火开始/ }).click();
  await expect(page.getByText("加热中")).toBeVisible();
  await page.waitForTimeout(1700);
  await page.getByRole("button", { name: /暂停加热/ }).click();
  await expect(page.getByText("已暂停", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /关火并记录/ }).click();
}

test("guided flow, live cooking, save and reload", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/kitchen/?ingredient=potato");

  await expect(
    page.getByRole("heading", { name: "处理食材，不只照做。" }),
  ).toBeVisible();
  await expect(page.locator(".workflow-guide")).toBeVisible();
  await expect(page.locator(".workflow-step.is-active")).toContainText("清洗、切配与控水");
  await expect(page.locator(".workflow-task.is-active")).toContainText("清洗食材");

  await page.getByRole("button", { name: /清洗食材/ }).click();
  await page.locator(".treatment-grid button.is-task-focus").click();
  await expect(page.locator(".workflow-task").first()).toHaveClass(/is-complete/);

  await page.locator(".workflow-task").nth(1).click();
  await page.locator(".treatment-grid button.is-task-focus").click();
  await expect(page.locator(".kitchen-sample")).toHaveClass(/form-cut|form-small-pieces/);

  await page.locator(".workflow-task").nth(2).click();
  await page.locator(".treatment-grid button.is-task-focus").click();
  await page.locator(".workflow-task").nth(3).click();
  await expect(page.locator(".station-location-status")).toContainText("炒锅");

  await startHeating(page, "190");
  await expect(page.locator(".scene-temperature")).not.toHaveText("20°C");
  await page.getByRole("tab", { name: "调味" }).click();
  await page.getByRole("radio", { name: /^盐/ }).click();
  await page.getByRole("button", { name: /加入食盐/ }).click();
  await expect(page.locator(".timeline-count")).toHaveText("5 步");

  await page.getByLabel("实验名称").fill("土豆实时烹饪实验");
  await page.getByRole("button", { name: /保存 1 号试验锅/ }).click();
  await expect(page.getByText("土豆实时烹饪实验", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("土豆实时烹饪实验", { exact: true })).toBeVisible();
});

test("first-run onboarding appears once and can be replayed", async ({ page }) => {
  await page.goto("/kitchen/?ingredient=greens");
  await expect(page.getByRole("dialog", { name: "厨房新手引导" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "先看五步流程" })).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByRole("button", { name: "开始实验" }).click();
  await expect(page.getByRole("dialog", { name: "厨房新手引导" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "厨房新手引导" })).toHaveCount(0);
  await page.getByRole("button", { name: /重看引导/ }).click();
  await expect(page.getByRole("dialog", { name: "厨房新手引导" })).toBeVisible();
});

test("empty pan is blocked and prediction feedback still works", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/kitchen/?ingredient=tofu");
  await page.getByRole("tab", { name: "火候" }).click();
  await page.getByRole("button", { name: /点火开始/ }).click();
  await expect(page.getByText(/锅是空的/).first()).toBeVisible();

  await page.getByRole("tab", { name: "处理" }).click();
  await page.getByText("先预测再揭晓", { exact: true }).click();
  await page.getByRole("button", { name: "会失水" }).click();
  await page.getByRole("button", { name: /压出内部水分/ }).click();
  await expect(page.getByText(/预测到/)).toBeVisible();
});

test("two live pans isolate one heat variable", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/kitchen/?ingredient=potato");
  await page.getByRole("button", { name: /切成细丝/ }).click();
  await page.getByRole("button", { name: /复制为 2 号试验锅/ }).click();

  await page.getByRole("button", { name: /炒锅：入锅与实时烹饪/ }).click();
  await startHeating(page, "220");
  await page.locator(".branch-tab").first().click();
  await page.getByRole("button", { name: /炒锅：入锅与实时烹饪/ }).click();
  await startHeating(page, "180");

  await expect(page.getByText("只改变了一个变量").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "两口试验锅，一眼看差异" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /保存 1 号试验锅/ }).click();
  await page.locator(".branch-tab").nth(1).click();
  await page.getByRole("button", { name: /保存 2 号试验锅/ }).click();
  await page.goto("/compare/");
  await expect(page.getByText(/1 号试验锅/).first()).toBeVisible();
  await expect(page.getByText(/2 号试验锅/).first()).toBeVisible();
});

test("mobile click path and catalog additions remain usable", async ({ page }) => {
  await skipOnboarding(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/kitchen/?ingredient=greens");
  await expect(page.locator(".kitchen-sample")).toHaveAttribute("draggable", "true");
  await page.getByRole("button", { name: /清洗食材/ }).click();
  await page.locator(".treatment-grid button.is-task-focus").click();
  await expect(page.locator(".kitchen-sample")).toHaveClass(/form-washed/);
  await page.getByRole("tab", { name: "调味" }).click();
  await expect(page.getByRole("radio", { name: /^盐/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /加入食盐/ })).toBeVisible();

  await page.goto("/ingredients/");
  await expect(page.getByText("55 种常见食材")).toBeVisible();
  await page.goto("/kitchen/?ingredient=shrimp", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".selector-label strong")).toHaveText("虾");
  await expect(page.getByRole("button", { name: /改刀或开背/ })).toBeVisible();
  await page.getByRole("button", { name: /关闭音效|开启音效/ }).click();
});

test("reset experiment clears branches, actions and live feedback", async ({
  page,
}) => {
  await skipOnboarding(page);
  await page.goto("/kitchen/?ingredient=potato");
  await page.getByRole("button", { name: /清洗食材/ }).click();
  await page.locator(".treatment-grid button.is-task-focus").click();
  await page.getByRole("button", { name: /重置实验/ }).click();

  await expect(page.locator(".branch-tab")).toHaveCount(1);
  await expect(page.locator(".timeline-count")).toHaveText("0 步");
  await expect(page.locator(".workflow-task.is-active")).toContainText("清洗食材");
  await expect(page.locator(".station-location-status")).toContainText("水槽");
  await expect(page.getByText("实验已全部重置")).toBeVisible();
});

test("user-provided ingredient photos are served", async ({ page }) => {
  await skipOnboarding(page);
  await page.goto("/ingredients/pork-loin/");
  const photo = page.getByAltText("里脊肉食材摄影");
  await expect(photo).toBeVisible();
  expect(
    await photo.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);

  await page.goto("/kitchen/?ingredient=pork-loin", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".selector-label strong")).toHaveText("里脊肉");
});
