import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityAuthor,
  CommunityChatMessage,
  CommunityPost,
  CommunityProfile,
  CommunityReply,
  ExperimentSummary,
  ModerationReport,
  PostCategory,
  ReportTarget,
} from "./types";

interface ProfileRow {
  id: string;
  nickname: string;
  avatar_color: string;
  is_admin: boolean;
  banned_until: string | null;
  created_at: string;
}

interface AuthorRow {
  nickname: string;
  avatar_color: string;
}

interface PostRow {
  id: string;
  user_id: string;
  category: PostCategory;
  title: string;
  body: string;
  tags: string[] | null;
  image_paths: string[] | null;
  experiment_summary: ExperimentSummary | null;
  like_count: number;
  reply_count: number;
  is_pinned: boolean;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
}

interface ReplyRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  is_hidden: boolean;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
}

interface ChatRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author: AuthorRow | AuthorRow[] | null;
}

interface ReportRow {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  target_preview: string;
  reason: string;
  status: ModerationReport["status"];
  created_at: string;
  reporter: AuthorRow | AuthorRow[] | null;
}

function author(row: AuthorRow | AuthorRow[] | null, userId: string): CommunityAuthor {
  const value = Array.isArray(row) ? row[0] : row;
  return {
    id: userId,
    nickname: value?.nickname || "匿名厨友",
    avatarColor: value?.avatar_color || "#39724b",
  };
}

function mapProfile(row: ProfileRow): CommunityProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarColor: row.avatar_color,
    isAdmin: row.is_admin,
    bannedUntil: row.banned_until,
    createdAt: row.created_at,
  };
}

export async function loadProfile(
  client: SupabaseClient,
  userId: string,
): Promise<CommunityProfile | null> {
  const { data, error } = await client
    .from("community_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function saveProfile(
  client: SupabaseClient,
  nickname: string,
  avatarColor: string,
): Promise<CommunityProfile> {
  const { data, error } = await client.rpc("community_save_profile", {
    p_nickname: nickname.trim(),
    p_avatar_color: avatarColor,
  });
  if (error) throw error;
  return mapProfile(data as ProfileRow);
}

export async function loadPosts(
  client: SupabaseClient,
  userId: string,
): Promise<CommunityPost[]> {
  const { data, error } = await client
    .from("community_posts")
    .select(
      "*, author:community_profiles!community_posts_user_id_fkey(nickname, avatar_color)",
    )
    .eq("is_hidden", false)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];
  const ids = rows.map((row) => row.id);
  let liked = new Set<string>();
  if (ids.length > 0) {
    const { data: likeRows } = await client
      .from("community_post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", ids);
    liked = new Set(
      ((likeRows ?? []) as { post_id: string }[]).map((row) => row.post_id),
    );
  }
  return rows.map((row) => ({
    id: row.id,
    author: author(row.author, row.user_id),
    category: row.category,
    title: row.title,
    body: row.body,
    tags: row.tags ?? [],
    imageUrls: row.image_paths ?? [],
    experimentSummary: row.experiment_summary,
    likeCount: row.like_count,
    replyCount: row.reply_count,
    likedByMe: liked.has(row.id),
    isPinned: row.is_pinned,
    createdAt: row.created_at,
  }));
}

export async function uploadPostImages(
  client: SupabaseClient,
  userId: string,
  files: File[],
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage
      .from("community-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function createPost(
  client: SupabaseClient,
  input: {
    category: PostCategory;
    title: string;
    body: string;
    tags: string[];
    imagePaths: string[];
    experimentSummary?: ExperimentSummary | null;
  },
): Promise<string> {
  const { data, error } = await client.rpc("community_create_post", {
    p_category: input.category,
    p_title: input.title.trim(),
    p_body: input.body.trim(),
    p_tags: input.tags,
    p_image_paths: input.imagePaths,
    p_experiment_summary: input.experimentSummary ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function loadReplies(
  client: SupabaseClient,
  postId: string,
): Promise<CommunityReply[]> {
  const { data, error } = await client
    .from("community_replies")
    .select(
      "*, author:community_profiles!community_replies_user_id_fkey(nickname, avatar_color)",
    )
    .eq("post_id", postId)
    .eq("is_hidden", false)
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as ReplyRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    author: author(row.author, row.user_id),
    body: row.body,
    createdAt: row.created_at,
    isHidden: row.is_hidden,
  }));
}

export async function createReply(
  client: SupabaseClient,
  postId: string,
  body: string,
): Promise<string> {
  const { data, error } = await client.rpc("community_create_reply", {
    p_post_id: postId,
    p_body: body.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function deleteOwnPost(
  client: SupabaseClient,
  postId: string,
): Promise<void> {
  const { error } = await client
    .from("community_posts")
    .delete()
    .eq("id", postId);
  if (error) throw error;
}

export async function deleteOwnReply(
  client: SupabaseClient,
  replyId: string,
): Promise<void> {
  const { error } = await client
    .from("community_replies")
    .delete()
    .eq("id", replyId);
  if (error) throw error;
}

export async function togglePostLike(
  client: SupabaseClient,
  postId: string,
  userId: string,
  currentlyLiked: boolean,
): Promise<void> {
  if (currentlyLiked) {
    const { error } = await client
      .from("community_post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await client
      .from("community_post_likes")
      .insert({ post_id: postId, user_id: userId });
    if (error) throw error;
  }
}

export async function reportContent(
  client: SupabaseClient,
  targetType: ReportTarget,
  targetId: string,
  preview: string,
  reason = "用户举报内容不当",
): Promise<void> {
  const { error } = await client.rpc("community_report_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_target_preview: preview.slice(0, 160),
    p_reason: reason,
  });
  if (error) throw error;
}

export async function loadChatMessages(
  client: SupabaseClient,
): Promise<CommunityChatMessage[]> {
  const { data, error } = await client
    .from("community_chat_messages")
    .select(
      "*, author:community_profiles!community_chat_messages_user_id_fkey(nickname, avatar_color)",
    )
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as ChatRow[])
    .reverse()
    .map((row) => ({
      id: row.id,
      author: author(row.author, row.user_id),
      body: row.body,
      createdAt: row.created_at,
    }));
}

export async function sendChat(
  client: SupabaseClient,
  body: string,
): Promise<string> {
  const { data, error } = await client.rpc("community_send_chat", {
    p_body: body.trim(),
  });
  if (error) throw error;
  return data as string;
}

export async function loadAdminReports(
  client: SupabaseClient,
): Promise<ModerationReport[]> {
  const { data, error } = await client
    .from("community_reports")
    .select(
      "*, reporter:community_profiles!community_reports_reporter_id_fkey(nickname, avatar_color)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as ReportRow[]).map((row) => ({
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetPreview: row.target_preview,
    reason: row.reason,
    status: row.status,
    reporter: author(row.reporter, ""),
    createdAt: row.created_at,
  }));
}

export async function adminResolveReport(
  client: SupabaseClient,
  reportId: string,
  status: "resolved" | "dismissed",
): Promise<void> {
  const { error } = await client.rpc("community_admin_resolve_report", {
    p_report_id: reportId,
    p_status: status,
  });
  if (error) throw error;
}

export async function adminModerateContent(
  client: SupabaseClient,
  targetType: ReportTarget,
  targetId: string,
  action: "hide" | "restore" | "delete",
): Promise<void> {
  const { error } = await client.rpc("community_admin_moderate_content", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_action: action,
  });
  if (error) throw error;
}

export async function adminBanUser(
  client: SupabaseClient,
  userId: string,
  hours: number,
): Promise<void> {
  const { error } = await client.rpc("community_admin_ban_user", {
    p_user_id: userId,
    p_hours: hours,
  });
  if (error) throw error;
}

export async function adminBanContentAuthor(
  client: SupabaseClient,
  targetType: ReportTarget,
  targetId: string,
  hours: number,
): Promise<void> {
  const { error } = await client.rpc("community_admin_ban_content_author", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_hours: hours,
  });
  if (error) throw error;
}
