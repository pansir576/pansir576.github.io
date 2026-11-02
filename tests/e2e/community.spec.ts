import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const supabaseConfigured =
  process.env.NEXT_PUBLIC_COMMUNITY_DEMO !== "true" &&
  existsSync(envPath) &&
  /^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*\S+/m.test(
    readFileSync(envPath, "utf8"),
  );

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("cooking-lab:community-profile:v1");
  });
});

test("unconfigured community works as a safe demo", async ({ page }) => {
  test.skip(supabaseConfigured, "已启用真实 Supabase，演示降级由单元测试覆盖");
  await page.goto("/community/");
  await expect(page.getByText(/演示模式/).first()).toBeVisible();
  await expect(page.getByRole("dialog", { name: "设置厨友昵称" })).toBeVisible();
  await page.getByRole("textbox", { name: "厨友昵称" }).fill("演示厨友");
  await page.getByRole("button", { name: "进入厨友交流" }).click();
  await expect(page.getByText("演示厨友", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "发送大厅消息" })).toBeDisabled();

  await page.getByRole("tab", { name: /实验讨论/ }).click();
  await expect(page.getByRole("heading", { name: "厨友实验讨论" })).toBeVisible();
  await expect(page.getByText("土豆丝先冲洗还是保留淀粉？")).toBeVisible();
  await expect(page.getByRole("button", { name: /^发帖/ })).toBeDisabled();
  await page.getByRole("button", { name: /条回复/ }).first().click();
  await expect(page.getByText("建议把切丝粗细也保持一致")).toBeVisible();
  await expect(page.getByLabel("回复内容")).toBeDisabled();
});

test("community and admin page render directly", async ({ page }) => {
  await page.goto("/community/");
  await expect(page).toHaveURL(/community/);
  await page.goto("/community/admin/");
  if (supabaseConfigured) {
    await expect(page.getByRole("heading", { name: "管理员登录" })).toBeVisible();
    await expect(page.getByText(/使用管理员邮箱和密码登录/)).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "社区管理后台" })).toBeVisible();
    await expect(page.getByText(/Supabase 环境变量尚未配置/)).toBeVisible();
  }
});

test("community stays usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/community/");
  await page.getByRole("textbox", { name: "厨友昵称" }).fill("手机厨友");
  await page.getByRole("button", { name: "进入厨友交流" }).click();
  await expect(page.getByRole("tab", { name: /实时大厅/ })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "设置厨友昵称" }),
  ).toBeHidden();
  await page.getByRole("tab", { name: /实验讨论/ }).click();
  await expect(page.getByRole("heading", { name: "厨友实验讨论" })).toBeVisible();
});

test("guided cooking opens a prefilled experiment post", async ({ page }) => {
  await page.goto("/community/");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "simulating-cook:community-share:v1",
      JSON.stringify({
        category: "experiment",
        title: "我做了快炒土豆，想分享这次变化",
        body: "这次只改变了一个处理变量，想和大家讨论口感变化。",
        tags: ["土豆", "更脆"],
        experimentSummary: {
          experimentId: "guided-demo",
          name: "快炒土豆",
          ingredientId: "potato",
          goal: "crisper",
          actionCount: 4,
          appearance: "切丝受热",
          flavorSummary: "整体清淡",
          textureSummary: "嫩度 30，脆度 68",
        },
      }),
    );
  });

  await page.goto("/community/?tab=discussion&compose=1");
  await expect(page.getByLabel("帖子标题")).toHaveValue(
    "我做了快炒土豆，想分享这次变化",
  );
  await expect(page.getByText("已附加：快炒土豆 · 4 步")).toBeVisible();
});
