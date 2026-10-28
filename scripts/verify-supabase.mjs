import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(
  await readFile(path.join(projectRoot, ".supabase-setup.local.json"), "utf8"),
);

const base = `https://api.supabase.com/v1/projects/${config.projectRef}`;
const headers = {
  Authorization: `Bearer ${config.accessToken}`,
  Accept: "application/json",
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const authConfig = await request(`${base}/config/auth`);
const keys = await request(`${base}/api-keys?reveal=true`);
const functions = await request(`${base}/functions`);
const adminEmail = String(config.adminEmail).replaceAll("'", "''");
const publishable = keys.find(
  (key) => key.type === "publishable" && key.api_key,
);
let adminLoginStatus = 0;
if (publishable) {
  const loginResponse = await fetch(
    `https://${config.projectRef}.supabase.co/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: publishable.api_key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: config.adminEmail,
        password: config.adminPassword,
      }),
    },
  );
  adminLoginStatus = loginResponse.status;
}
const result = await request(`${base}/database/query`, {
  method: "POST",
  body: JSON.stringify({
    query: `
      select
        (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name like 'community_%') as community_tables,
        (select count(*) from public.community_profiles p
         join auth.users u on u.id = p.id
         where u.email = '${adminEmail}'
           and p.is_admin = true) as admin_profiles,
        to_regclass('public.guided_ai_usage') is not null as guided_ai_table,
        to_regprocedure('public.claim_guided_ai_request()') is not null as guided_rate_limit_rpc,
        to_regclass('public.simulating_cook_progress') is not null as three_d_progress_table,
        to_regclass('public.simulating_cook_runs') is not null as three_d_runs_table,
        to_regprocedure('public.record_simulating_cook_training(jsonb)') is not null as three_d_record_rpc,
        to_regprocedure('public.get_simulating_cook_progress()') is not null as three_d_progress_rpc
    `,
    read_only: true,
  }),
});

console.log(
  JSON.stringify(
    {
      anonymousAuthEnabled:
        authConfig.external_anonymous_users_enabled === true,
      communityTables: Number(result?.[0]?.community_tables ?? 0),
      adminProfiles: Number(result?.[0]?.admin_profiles ?? 0),
      guidedAiTable: result?.[0]?.guided_ai_table === true,
      guidedRateLimitRpc: result?.[0]?.guided_rate_limit_rpc === true,
      threeDProgressTable: result?.[0]?.three_d_progress_table === true,
      threeDRunsTable: result?.[0]?.three_d_runs_table === true,
      threeDRecordRpc: result?.[0]?.three_d_record_rpc === true,
      threeDProgressRpc: result?.[0]?.three_d_progress_rpc === true,
      guidedFunctionDeployed: functions.some(
        (item) => item.slug === "cooking-guide" && item.status === "ACTIVE",
      ),
      adminLoginStatus,
      projectUrl: `https://${config.projectRef}.supabase.co`,
    },
    null,
    2,
  ),
);
