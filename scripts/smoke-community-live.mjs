import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const projectRoot = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(
  await readFile(path.join(projectRoot, ".supabase-setup.local.json"), "utf8"),
);
const stamp = String(Date.now());
const nicknameA = `验收A-${stamp}`;
const nicknameB = `验收B-${stamp}`;
const message = `实时大厅验收消息 ${stamp}`;
const postTitle = `实时讨论验收帖 ${stamp}`;

const browser = await chromium.launch({
  executablePath:
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
});

async function createLobbyUser(nickname) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("http://localhost:3000/community/", {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("textbox", { name: "厨友昵称" }).fill(nickname);
  await page.getByRole("button", { name: "进入厨友交流" }).click();
  await page.getByRole("dialog", { name: "设置厨友昵称" }).waitFor({
    state: "hidden",
    timeout: 20_000,
  });
  return { context, page };
}

let success = false;
try {
  const userA = await createLobbyUser(nicknameA);
  const userB = await createLobbyUser(nicknameB);
  await userB.page.waitForTimeout(1500);

  await userA.page.getByLabel("实时大厅消息").fill(message);
  await userA.page.getByRole("button", { name: "发送大厅消息" }).click();
  await userB.page.getByText(message, { exact: true }).waitFor({
    state: "visible",
    timeout: 20_000,
  });

  await userA.page.getByRole("tab", { name: /实验讨论/ }).click();
  await userA.page.getByRole("button", { name: /^发帖/ }).click();
  await userA.page.getByLabel("帖子标题").fill(postTitle);
  await userA.page
    .getByLabel("帖子正文")
    .fill("这是一条自动验收帖子，确认匿名用户能够发帖，另一用户可以读取。");
  await userA.page.getByRole("button", { name: "发布帖子" }).click();
  await userA.page.getByRole("dialog", { name: "发布实验讨论" }).waitFor({
    state: "hidden",
    timeout: 20_000,
  });

  await userB.page.getByRole("tab", { name: /实验讨论/ }).click();
  await userB.page.getByText(postTitle, { exact: true }).waitFor({
    state: "visible",
    timeout: 20_000,
  });

  console.log(
    JSON.stringify(
      {
        realtimeMessageDelivered: true,
        discussionPostPublished: true,
        sender: nicknameA,
        receiver: nicknameB,
      },
      null,
      2,
    ),
  );
  success = true;
  await userA.context.close();
  await userB.context.close();
} finally {
  await browser.close();
  const escapedA = nicknameA.replaceAll("'", "''");
  const escapedB = nicknameB.replaceAll("'", "''");
  const cleanup = `
    delete from auth.users
    where id in (
      select id from public.community_profiles
      where nickname in ('${escapedA}', '${escapedB}')
    );
  `;
  await fetch(
    `https://api.supabase.com/v1/projects/${config.projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: cleanup, read_only: false }),
    },
  );
}

if (!success) process.exitCode = 1;
