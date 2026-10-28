import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const configPath = path.join(projectRoot, ".supabase-setup.local.json");
const migrationDirectory = path.join(projectRoot, "supabase", "migrations");

const config = JSON.parse(await readFile(configPath, "utf8"));
if (!/^sbp_/.test(config.accessToken || "")) {
  throw new Error("accessToken must start with sbp_");
}
if (!/^[a-z]{20}$/.test(config.projectRef || "")) {
  throw new Error("projectRef must contain exactly 20 lowercase letters");
}
if (!config.adminEmail || !config.adminPassword) {
  throw new Error("Admin email and password are required");
}
if (config.adminPassword.length < 8) {
  throw new Error("Admin password must contain at least 8 characters");
}

const managementBase = "https://api.supabase.com/v1";
const headers = {
  Authorization: `Bearer ${config.accessToken}`,
  Accept: "application/json",
};

async function management(pathname, options = {}) {
  const response = await fetch(`${managementBase}${pathname}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const error = new Error(
      `Supabase API ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

console.log("[1/6] Checking project...");
const project = await management(`/projects/${config.projectRef}`);
const projectUrl = `https://${config.projectRef}.supabase.co`;
console.log(`Project: ${project.name}`);

console.log("[2/6] Enabling Anonymous Sign-Ins...");
await management(`/projects/${config.projectRef}/config/auth`, {
  method: "PATCH",
  body: JSON.stringify({ external_anonymous_users_enabled: true }),
});

console.log("[3/6] Reading project API keys...");
const keys = await management(
  `/projects/${config.projectRef}/api-keys?reveal=true`,
);
const publishable = keys.find((key) => key.type === "publishable" && key.api_key);
const secret = keys.find((key) => key.type === "secret" && key.api_key);
if (!publishable) {
  throw new Error(
    "Publishable key was not returned. Copy it manually into .env.local.",
  );
}
if (!secret) {
  throw new Error(
    "Secret key was not returned. Create the admin user in Authentication -> Users first.",
  );
}

console.log("[4/6] Running database migrations...");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
let cronWarning = false;
for (const migrationFile of migrationFiles) {
  console.log(`  Applying ${migrationFile}`);
  let migration = await readFile(
    path.join(migrationDirectory, migrationFile),
    "utf8",
  );
  try {
    await management(`/projects/${config.projectRef}/database/query`, {
      method: "POST",
      body: JSON.stringify({ query: migration, read_only: false }),
    });
  } catch (error) {
    if (/pg_cron|cron\.schedule|schema "cron"/i.test(String(error.message))) {
      cronWarning = true;
      migration = migration
        .replace("create extension if not exists pg_cron;", "")
        .replace(/select cron\.schedule\([\s\S]*?\$\$\);\s*$/, "");
      await management(`/projects/${config.projectRef}/database/query`, {
        method: "POST",
        body: JSON.stringify({ query: migration, read_only: false }),
      });
    } else {
      throw error;
    }
  }
}
if (cronWarning) {
  console.log("pg_cron unavailable; migrations ran without scheduled cron.");
}

console.log("[5/6] Creating or updating admin account...");
const adminResponse = await fetch(`${projectUrl}/auth/v1/admin/users`, {
  method: "POST",
  headers: {
    apikey: secret.api_key,
    Authorization: `Bearer ${secret.api_key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: config.adminEmail,
    password: config.adminPassword,
    email_confirm: true,
  }),
  signal: AbortSignal.timeout(60_000),
});
if (![200, 201, 409, 422].includes(adminResponse.status)) {
  throw new Error(
    `Admin user creation failed (${adminResponse.status}): ${await adminResponse.text()}`,
  );
}
if ([409, 422].includes(adminResponse.status)) {
  console.log("Admin user already exists; updating community profile.");
}

const nickname = String(config.adminNickname || "Kitchen Admin").replaceAll(
  "'",
  "''",
);
const email = String(config.adminEmail).replaceAll("'", "''");
const adminSql = `
insert into public.community_profiles (id, nickname, avatar_color, is_admin)
select id, '${nickname}', '#39724b', true
from auth.users
where email = '${email}'
on conflict (id) do update
set is_admin = true,
    nickname = excluded.nickname;
`;
await management(`/projects/${config.projectRef}/database/query`, {
  method: "POST",
  body: JSON.stringify({ query: adminSql, read_only: false }),
});

console.log("[6/6] Writing .env.local...");
await writeFile(
  path.join(projectRoot, ".env.local"),
  `NEXT_PUBLIC_SUPABASE_URL=${projectUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${publishable.api_key}\n`,
  "utf8",
);

console.log("");
console.log("Supabase community setup completed.");
console.log(`Project URL: ${projectUrl}`);
console.log("Admin: http://localhost:3000/community/admin/");
if (cronWarning) {
  console.log(
    "Action required: call public.community_prune_lobby() hourly.",
  );
}
