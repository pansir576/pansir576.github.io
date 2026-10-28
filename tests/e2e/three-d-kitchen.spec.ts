import { expect, test } from "@playwright/test";

async function holdAction(page: import("@playwright/test").Page, ms: number) {
  const action = page.locator("[data-3d-action]");
  const box = await action.boundingBox();
  if (!box) throw new Error("3D action button is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  await page.waitForTimeout(180);
}

test("3D kitchen completes washing, chopping, cooking and plating", async ({
  page,
}) => {
  await page.goto("/cook/3d/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:3d-session:v1");
    window.localStorage.removeItem("simulating-cook:3d-progress:v1");
  });
  await page.reload();
  await page.locator("[data-3d-start]").click();
  await page.waitForTimeout(1000);
  const initialX = Number(
    await page.locator("[data-player-x]").getAttribute("data-player-x"),
  );
  await page.keyboard.down("d");
  await page.waitForTimeout(650);
  await page.keyboard.up("d");
  await expect
    .poll(async () =>
      Number(
        await page.locator("[data-player-x]").getAttribute("data-player-x"),
      ),
    )
    .toBeGreaterThan(initialX);

  await page.locator('[data-teleport="fridge"]').click();
  await page.waitForTimeout(450);
  await page.locator("[data-3d-action]").click();
  await expect(page.locator("[data-3d-fridge]")).toBeVisible();
  await page.locator('[data-3d-ingredient="potato"]').click();
  await expect(page.locator("[data-3d-phase]")).toHaveAttribute(
    "data-3d-phase",
    "wash",
  );

  await page.locator('[data-teleport="sink"]').click();
  await page.waitForTimeout(400);
  await holdAction(page, 1000);
  const partialProgress = Number(
    await page.locator("[data-3d-hold]").getAttribute("data-hold-progress"),
  );
  expect(partialProgress).toBeGreaterThan(10);
  expect(partialProgress).toBeLessThan(90);
  await holdAction(page, 2000);
  await expect(page.locator("[data-3d-phase]")).toHaveAttribute(
    "data-3d-phase",
    "chop",
  );

  await page.locator('[data-teleport="board"]').click();
  await page.waitForTimeout(400);
  await holdAction(page, 4850);
  await expect(page.locator("[data-3d-phase]")).toHaveAttribute(
    "data-3d-phase",
    "cook",
  );

  await page.locator('[data-teleport="stove"]').click();
  await page.waitForTimeout(400);
  await page.locator("[data-3d-action]").click();
  await expect(page.locator("[data-3d-stove]")).toBeVisible();
  await page.locator("[data-3d-add-oil]").click();
  await page.locator("[data-3d-start-heat]").click();
  await page.waitForTimeout(11000);
  await page.locator("[data-3d-stop-heat]").click();
  await expect(page.locator("[data-3d-stove]")).toHaveCount(0);
  await expect(page.locator("[data-3d-phase]")).toHaveAttribute(
    "data-3d-phase",
    "plate",
  );

  await page.locator('[data-teleport="plating"]').click();
  await page.waitForTimeout(400);
  await page.locator("[data-3d-action]").click();
  await expect(page.locator("[data-3d-result]")).toBeVisible();
  await expect(page.getByText("香煎土豆")).toBeVisible();
});

test("3D kitchen exposes mobile controls and classic fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/cook/3d/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:3d-session:v1");
  });
  await page.reload();
  await expect(page.locator("[data-3d-start]")).toBeVisible();
  await expect(page.getByRole("link", { name: /2.5D/ })).toBeVisible();
  await page.locator("[data-3d-start]").click();
  await page.waitForTimeout(1000);
  await expect(page.locator("[data-virtual-joystick]")).toBeVisible();
  await expect(page.locator("[data-3d-action]")).toBeVisible();
  await expect(page.locator("[data-teleport]")).toHaveCount(6);
  const initialX = Number(
    await page.locator("[data-player-x]").getAttribute("data-player-x"),
  );
  const joystick = page.locator("[data-virtual-joystick]");
  const joystickBox = await joystick.boundingBox();
  if (!joystickBox) throw new Error("joystick is not visible");
  await page.mouse.move(
    joystickBox.x + joystickBox.width / 2,
    joystickBox.y + joystickBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    joystickBox.x + joystickBox.width - 8,
    joystickBox.y + joystickBox.height / 2,
  );
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page.locator("[data-player-x]").getAttribute("data-player-x"),
      ),
    )
    .not.toBe(initialX);
  await expect
    .poll(() =>
      page
        .locator("[data-3d-phase]")
        .getAttribute("data-guide-motion"),
    )
    .toMatch(/walk|jog/);
  await page.locator('[data-teleport="fridge"]').click();
  await page.waitForTimeout(350);
  await page.locator("[data-3d-action]").click();
  await expect(page.locator("[data-3d-fridge]")).toBeVisible();
});

test("3D page shows a usable fallback without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      options?: unknown,
    ) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.call(
        this,
        type as "2d",
        options as CanvasRenderingContext2DSettings,
      );
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/cook/3d/");
  await expect(page.getByRole("heading", { name: /无法运行 3D 厨房/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /进入经典厨房/ })).toBeVisible();
});

test("reduced motion keeps movement feedback without decorative animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cook/3d/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:3d-session:v1");
  });
  await page.reload();
  await page.locator("[data-3d-start]").click();
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.down("d");
  await page.waitForTimeout(1200);
  await expect
    .poll(() =>
      page
        .locator("[data-3d-phase]")
        .getAttribute("data-guide-motion"),
    )
    .toMatch(/walk|jog/);
  await page.keyboard.up("d");
  await expect(page.locator("[data-3d-action]")).toBeVisible();
});

test("3D kitchen keeps the selected guide in the active session", async ({
  page,
}) => {
  await page.goto("/cook/3d/");
  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:3d-session:v1");
  });
  await page.reload();

  const yellow = page.locator('[data-3d-guide-choice="yellow"]');
  await yellow.click();
  await expect(yellow).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-3d-start]").click();
  await expect(page.locator("[data-3d-guide-active]")).toHaveAttribute(
    "data-3d-guide-active",
    "yellow",
  );

  await page.evaluate(() => {
    window.localStorage.removeItem("simulating-cook:3d-session:v1");
  });
  await page.reload();
  const orange = page.locator('[data-3d-guide-choice="orange"]');
  await orange.click();
  await expect(orange).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-3d-start]").click();
  await expect(page.locator("[data-3d-guide-active]")).toHaveAttribute(
    "data-3d-guide-active",
    "orange",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.down("d");
  await expect
    .poll(() =>
      page
        .locator("[data-3d-phase]")
        .getAttribute("data-guide-motion"),
    )
    .toMatch(/walk|jog/);
  await page.keyboard.up("d");
  const riggedModel = await page.request.get("/models/xiaomi-rigged.glb");
  expect(riggedModel.ok()).toBeTruthy();
  expect((await riggedModel.body()).byteLength).toBeGreaterThan(1_000_000);
});
