import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const forceDemo = process.env.NEXT_PUBLIC_COMMUNITY_DEMO === "true";

let client: SupabaseClient | null | undefined;

export function isCommunityConfigured(): boolean {
  return Boolean(!forceDemo && url && anonKey);
}

export function getCommunityClient(): SupabaseClient | null {
  if (!isCommunityConfigured()) return null;
  client ??= createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export async function ensureAnonymousUser() {
  const supabase = getCommunityClient();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
